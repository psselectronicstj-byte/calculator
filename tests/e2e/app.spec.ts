import { expect, test } from "@playwright/test";

test("calculator result and local history survive a reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Математическое выражение" }).fill("2+3");
  await page.getByRole("button", { name: "Вычислить" }).click();
  await expect(page.locator("output")).toHaveText("5");

  await page.getByRole("button", { name: "История" }).click();
  await expect(page.getByText("2+3")).toBeVisible();
  await expect(page.getByText("5", { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "История" }).click();
  await expect(page.getByText("2+3")).toBeVisible();
});

test("calculator displays a clear domain error", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Математическое выражение" }).fill("sqrt(-1)");
  await page.getByRole("button", { name: "Вычислить" }).click();
  await expect(page.getByRole("alert")).toContainText("Корень из отрицательного числа");
});
