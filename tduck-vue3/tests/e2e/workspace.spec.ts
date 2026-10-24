import { test, expect, type Page } from "@playwright/test";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve } from "node:path";
const fixture = JSON.parse(
  readFileSync(resolve("../.local/tduck-dev/acceptance.json"), "utf8").replace(
    /^\uFEFF/,
    ""
  )
) as {
  owner: string;
  other: string;
  password: string;
  forms: { key: string; name: string }[];
  folderId: number;
  nestedKey: string;
};
const evidence = resolve("../evidence/tduck-vue3");
mkdirSync(evidence, { recursive: true });
async function login(page: Page, account = fixture.owner) {
  await page.goto("/login");
  await page.getByRole("textbox", { name: "邮箱 / 手机号" }).fill(account);
  await page.getByLabel("密码", { exact: true }).fill(fixture.password);
  await page.getByRole("button", { name: "进入工作台" }).click();
  await expect(page).toHaveURL(/\/forms$/);
  await expect(page.getByRole("heading", { name: "我的问卷" })).toBeVisible();
}
test("real login, MySQL-backed list, chart totals, detail, refresh and logout", async ({
  page,
}) => {
  const errors: string[] = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto("/login");
  await page.screenshot({
    path: resolve(evidence, "01-login.png"),
    fullPage: true,
  });
  await login(page);
  await expect(
    page.getByRole("link", { name: fixture.forms[0]!.name, exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("img", {
      name: "当前目录问卷状态：未发布 1，收集中 1，已停止 1",
    })
  ).toBeVisible();
  await page.screenshot({
    path: resolve(evidence, "02-workspace.png"),
    fullPage: true,
  });
  await page
    .getByRole("link", { name: fixture.forms[0]!.name, exact: true })
    .click();
  await expect(
    page.getByRole("heading", { name: "What would improve your experience?" })
  ).toBeVisible();
  await page.screenshot({
    path: resolve(evidence, "03-detail.png"),
    fullPage: true,
  });
  await page.reload();
  await expect(
    page.getByRole("heading", { name: "What would improve your experience?" })
  ).toBeVisible();
  await page.getByRole("button", { name: "退出登录" }).click();
  await expect(page).toHaveURL(/\/login$/);
  await page.goto(`/forms/${fixture.forms[0]!.key}`);
  await expect(page).toHaveURL(/\/login\?redirect=/);
  expect(
    await page.evaluate(() => sessionStorage.getItem("zhiyan.tduck.v3.token"))
  ).toBeNull();
  expect(errors).toEqual([]);
});
test("wrong credentials report a real backend failure", async ({ page }) => {
  await page.goto("/login");
  await page
    .getByRole("textbox", { name: "邮箱 / 手机号" })
    .fill(fixture.owner);
  await page.getByLabel("密码", { exact: true }).fill("Incorrect1!");
  await page.getByRole("button", { name: "进入工作台" }).click();
  await expect(page.getByRole("alert")).toContainText("账号或密码不正确");
  await expect(page).toHaveURL(/\/login$/);
});
test("search and state filter use backend query results", async ({ page }) => {
  await login(page);
  await page
    .getByRole("textbox", { name: "搜索问卷名称" })
    .fill("Learning habits");
  await page.getByRole("button", { name: "搜索", exact: true }).click();
  await expect(
    page.getByRole("link", { name: fixture.forms[1]!.name, exact: true })
  ).toBeVisible();
  await expect(
    page.getByRole("link", { name: fixture.forms[0]!.name, exact: true })
  ).toHaveCount(0);
  await page.getByRole("combobox", { name: "问卷状态筛选" }).press("ArrowDown");
  await page.getByRole("option", { name: "未发布", exact: true }).click();
  await expect(
    page.getByText("没有符合条件的问卷", { exact: true })
  ).toBeVisible();
});
test("folder navigation does not lose existing nested questionnaires", async ({
  page,
}) => {
  await login(page);
  await page
    .getByRole("button", { name: "Archive - acceptance fixture", exact: true })
    .click();
  await expect(page).toHaveURL(new RegExp(`folder=${fixture.folderId}`));
  await page
    .getByRole("link", {
      name: "Nested survey - acceptance fixture",
      exact: true,
    })
    .click();
  await expect(
    page.getByRole("heading", {
      name: "Nested survey - acceptance fixture",
      exact: true,
    })
  ).toBeVisible();
});
test("real cross-account permission denial retains the other session", async ({
  page,
}) => {
  await login(page, fixture.other);
  await expect(
    page.getByText("这个目录还没有问卷", { exact: true })
  ).toBeVisible();
  await page.goto(`/forms/${fixture.forms[0]!.key}`);
  await expect(page.getByRole("alert")).toContainText("没有权限");
  await page.screenshot({
    path: resolve(evidence, "04-forbidden.png"),
    fullPage: true,
  });
  await expect(
    page.getByRole("heading", { name: fixture.forms[0]!.name, exact: true })
  ).toHaveCount(0);
  expect(
    await page.evaluate(() => !!sessionStorage.getItem("zhiyan.tduck.v3.token"))
  ).toBe(true);
});
test("a stale token is rejected by the real backend and redirects to login", async ({
  page,
}) => {
  await page.goto("/login");
  await page.evaluate(() =>
    sessionStorage.setItem("zhiyan.tduck.v3.token", "expired-test-token")
  );
  await page.goto("/forms");
  await expect(page).toHaveURL(/\/login\?.*reason=expired/);
  await expect(
    page.getByText("登录已过期，请重新登录", { exact: true })
  ).toBeVisible();
  expect(
    await page.evaluate(() => sessionStorage.getItem("zhiyan.tduck.v3.token"))
  ).toBeNull();
  await page.screenshot({
    path: resolve(evidence, "05-expired.png"),
    fullPage: true,
  });
});
test("offline fault injection displays a retryable error without logging out", async ({
  page,
  context,
}) => {
  await login(page);
  await expect(
    page.getByRole("link", { name: fixture.forms[0]!.name, exact: true })
  ).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("button", { name: "刷新数据" }).click();
  await expect(page.getByRole("alert").first()).toContainText("网络连接异常");
  expect(
    await page.evaluate(() => !!sessionStorage.getItem("zhiyan.tduck.v3.token"))
  ).toBe(true);
  await page.screenshot({
    path: resolve(evidence, "06-network-error.png"),
    fullPage: true,
  });
  await context.setOffline(false);
  await page.getByRole("button", { name: "重新加载", exact: true }).click();
  await expect(
    page.getByRole("link", { name: fixture.forms[0]!.name, exact: true })
  ).toBeVisible();
});
test("stored rich text is displayed without executing HTML", async ({
  page,
}) => {
  await login(page);
  // Explicit fault injection: this test is not proof of a real backend payload.
  await page.route(
    `**/tduck-api/user/form/${fixture.forms[0]!.key}`,
    async (route) => {
      const actual = await route.fetch();
      const body = await actual.json();
      body.data.description =
        '<img src=x onerror="window.__xss=true"><script>window.__xss=true</script><b>Safe text</b>';
      await route.fulfill({ response: actual, json: body });
    }
  );
  await page
    .getByRole("link", { name: fixture.forms[0]!.name, exact: true })
    .click();
  await expect(page.getByText("Safe text", { exact: true })).toBeVisible();
  expect(await page.evaluate(() => "__xss" in window)).toBe(false);
});
test("mobile layout remains usable", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await login(page);
  await expect(
    page.getByRole("link", { name: fixture.forms[0]!.name, exact: true })
  ).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth
    )
  ).toBe(true);
  await page.screenshot({
    path: resolve(evidence, "07-mobile.png"),
    fullPage: true,
  });
  await page.getByRole("button", { name: "退出登录", exact: true }).click();
  await expect(page).toHaveURL(/\/login$/);
});
