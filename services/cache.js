const mongoose = require("mongoose");
const redis = require("redis");
const util = require("util");
const keys = require("../config/keys");

const client = redis.createClient(keys.redisUrl);
client.hget = util.promisify(client.hget);
const exec = mongoose.Query.prototype.exec;

mongoose.Query.prototype.cache = function (options = {}) {
  this.useCache = true;
  this.hashKey = JSON.stringify(options.key || "");

  return this;
};

mongoose.Query.prototype.exec = async function () {
  if (!this.useCache) {
    return exec.apply(this, arguments);
  }

  // Create key to be used for a uniqye and consistent way of setting up lookup for cache values
  // Key is comprised of the current query that is being queued up, via this.getQuery
  // And need to differentiate between each different collections that we are searching through as well, which can be accessed via this.mongooseCollection.name
  // Create a new object with those values and strginify them to store as keys for redis
  // A new object is created for it so we don't modify the underlying getQuery call
  const key = JSON.stringify(
    Object.assign({}, this.getQuery(), {
      collection: this.mongooseCollection.name,
    })
  );

  // See if we have a value for key in redis
  const cacheValue = await client.hget(this.hashKey, key);

  // If we do return that
  if (cacheValue) {
    // Parse the stringify JSON string into an JavaScript object via JSON.parse
    const doc = JSON.parse(cacheValue);

    // Returns a mongoose document
    // Handles two cases where the parse doc can either be an array or just a single object
    // Ternary checks to see if its an array, if so, loop over and return each JavaScript object and convert them into mongoose models via this.model constructor
    // If not an array then just turn that single JavaScript object into a mongoose model via this.model
    return Array.isArray(doc)
      ? doc.map((d) => new this.model(d))
      : new this.model(doc);
  }

  // Other wise issue the query and store the results in redis
  const result = await exec.apply(this, arguments);

  client.hset(this.hashKey, key, JSON.stringify(result), "EX", 10, () => {});

  return result;
};

module.exports = {
  clearHash(hashKey) {
    client.del(JSON.stringify(hashKey));
  },
};
