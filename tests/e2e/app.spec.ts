import { expect, test } from "@playwright/test";

test("phone navigation opens every available feature", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/");

  const features = [
    ["Калькулятор", "Калькулятор"],
    ["Алгебра", "Алгебра"],
    ["Уравнения", "Уравнения"],
    ["Анализ", "Математический анализ"],
    ["2D-график", "График 2D"],
    ["3D-график", "График 3D"],
    ["Матрицы", "Матрицы"],
    ["История", "История"],
  ] as const;

  for (const [navigationLabel, heading] of features) {
    await page.getByRole("button", { name: navigationLabel, exact: true }).click();
    await expect(page.getByRole("heading", { name: heading, exact: true })).toBeVisible();
  }
});

test("keyboard focus remains visible with reduced motion enabled", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.keyboard.press("Tab");

  const calculatorNavigation = page.getByRole("button", { name: "Калькулятор", exact: true });
  await expect(calculatorNavigation).toBeFocused();
  expect(await calculatorNavigation.evaluate((element) => getComputedStyle(element).outlineStyle)).toBe("solid");
  expect(await page.evaluate(() => getComputedStyle(document.documentElement).scrollBehavior)).toBe("auto");
  expect(await page.evaluate(() => window.matchMedia("(prefers-reduced-motion: reduce)").matches)).toBe(true);
});

test("calculator history survives reload", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Математическое выражение" }).fill("2+3");
  await page.getByRole("button", { name: "Вычислить", exact: true }).click();
  await expect(page.locator(".result-view__value")).toHaveText("5");

  await page.getByRole("button", { name: "История", exact: true }).click();
  const historyEntry = page.getByRole("listitem").filter({ hasText: "2+3" });
  await expect(historyEntry).toBeVisible();
  await expect(page.getByText("5", { exact: true })).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "История", exact: true }).click();
  await expect(page.getByRole("listitem").filter({ hasText: "2+3" })).toBeVisible();
});

test("calculator displays a clear domain error", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("textbox", { name: "Математическое выражение" }).fill("sqrt(-1)");
  await page.getByRole("button", { name: "Вычислить", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("Корень из отрицательного числа");
});
