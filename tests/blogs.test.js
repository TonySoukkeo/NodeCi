const Page = require("./helpers/page");

let page;

beforeEach(async () => {
  page = await Page.build();
  await page.goto("http://localhost:3000");
});

afterEach(async () => {
  await page.close();
});

describe(`When logged in`, async () => {
  beforeEach(async () => {
    await page.login();
    await page.click(`a.btn-floating`);
  });

  test("can see blog create form", async () => {
    const label = await page.getContentsOf(`form label`);
    expect(label).toEqual(`Blog Title`);
  });

  describe(`And using valid inputs`, async () => {
    const postTitle = "My title";
    const postContent = "My content";

    let saveBtn;

    beforeEach(async () => {
      await page.type(`input[name='title']`, postTitle);
      await page.type(`input[name='content']`, postContent);

      await page.click(`form button`);
      saveBtn = await page.getElement(`form .green`);
    });

    test(`Submitting takes user to review screen`, async () => {
      expect(saveBtn).not.toBeNull();
    });

    test(`Submitting then saving adds blog to index page`, async () => {
      await saveBtn.click();
      await page.waitFor(`.card`);

      const title = await page.getContentsOf(`.card-title`);
      const content = await page.getContentsOf(`p`);

      expect.assertions(2);
      expect(title).toEqual(postTitle);
      expect(content).toEqual(postContent);
    });
  });

  describe(`And using invalid inputs`, async () => {
    beforeEach(async () => {
      await page.click(`form button`);
    });

    test(`the form shows an error message`, async () => {
      const titleText = await page.getContentsOf(`.title .red-text`);
      const contentText = await page.getContentsOf(`.content .red-text`);

      expect.assertions(2);
      expect(titleText.length).not.toEqual(0);
      expect(contentText.length).not.toEqual(0);
    });
  });
});

describe(`User is not logged in`, async () => {
  const actions = [
    {
      method: "get",
      path: "/api/blogs",
    },
    {
      method: "post",
      path: "/api/blogs",
      data: {
        title: "t",
        content: "c",
      },
    },
  ];

  test(`Blog related actions are prohibited`, async () => {
    const results = await page.execRequests(actions);

    for (let result of results) {
      expect(result).toEqual({ error: "You must log in!" });
    }
  });
});
