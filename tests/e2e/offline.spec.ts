import { expect, test } from "@playwright/test";

test("pre-caches the installable app and serves core math features offline", async ({ page, context }) => {
  const remoteRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).origin !== "http://127.0.0.1:4173") {
      remoteRequests.push(request.url());
    }
  });
  await page.addInitScript(() => {
    const getContext = HTMLCanvasElement.prototype.getContext;
    HTMLCanvasElement.prototype.getContext = function (type, ...args) {
      if (type === "webgl" || type === "webgl2" || type === "experimental-webgl") {
        return null;
      }
      return getContext.call(this, type, ...args);
    } as typeof HTMLCanvasElement.prototype.getContext;
  });
  await page.goto("/");

  const manifestLink = page.locator('link[rel="manifest"]');
  await expect(manifestLink).toHaveAttribute("href", /.+/);
  const manifestHref = await manifestLink.getAttribute("href");
  expect(manifestHref).toBeTruthy();
  const manifest = await page.evaluate(async (href) => {
    const response = await fetch(href!);
    return response.json() as Promise<{ display: string; icons: Array<{ sizes: string }> }>;
  }, manifestHref);
  expect(manifest.display).toBe("standalone");
  expect(manifest.icons.map((icon) => icon.sizes)).toEqual(expect.arrayContaining(["192x192", "512x512"]));

  await expect.poll(() => page.evaluate(async () => {
    const registration = await navigator.serviceWorker.getRegistration();
    return registration?.active?.state ?? "missing";
  })).toBe("activated");
  await page.reload();
  await expect.poll(() => page.evaluate(() => navigator.serviceWorker.controller !== null)).toBe(true);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Калькулятор" })).toBeVisible();
  await expect(page.getByRole("status")).toContainText("офлайн");
  await page.getByRole("textbox", { name: "Математическое выражение" }).fill("2+3");
  await page.getByRole("button", { name: "Вычислить", exact: true }).click();
  await expect(page.locator(".result-view__value")).toHaveText("5");
  await page.getByRole("button", { name: "Матрицы", exact: true }).click();
  await page.getByRole("button", { name: "Вычислить матричную операцию" }).click();
  await expect(page.getByLabel("Результат матричной операции")).toHaveText("-2");

  await page.getByRole("button", { name: "Алгебра", exact: true }).click();
  await page.getByRole("textbox", { name: "Математическое выражение" }).fill("2*(x+3)");
  await page.getByRole("combobox", { name: "Операция" }).selectOption("expand");
  await page.getByRole("button", { name: "Преобразовать" }).click();
  await expect(page.getByLabel("Результат преобразования")).toContainText("2");

  await page.getByRole("button", { name: "Уравнения", exact: true }).click();
  await page.getByRole("textbox", { name: "Математическое выражение" }).fill("x-2=0");
  await page.getByRole("button", { name: "Решить уравнение" }).click();
  await expect(page.getByLabel("Решение уравнения")).toContainText("2");

  await page.getByRole("button", { name: "Анализ", exact: true }).click();
  await page.getByRole("textbox", { name: "Математическое выражение" }).fill("x^2");
  await page.getByRole("button", { name: "Найти производную" }).click();
  await expect(page.getByLabel("Результат анализа")).toContainText("2");
  await page.getByLabel("Верхний предел").fill("1");
  await page.getByRole("button", { name: "Вычислить интеграл" }).click();
  await expect(page.getByLabel("Результат анализа")).toHaveText("1/3");

  await page.getByRole("button", { name: "2D-график", exact: true }).click();
  await page.getByRole("button", { name: "Построить график" }).click();
  await expect(page.getByRole("list", { name: "Функции на графике" }).getByText("x^2")).toBeVisible();

  await page.getByRole("button", { name: "3D-график", exact: true }).click();
  await page.getByRole("button", { name: "Построить поверхности" }).click();
  await expect(page.getByRole("list", { name: "Поверхности на графике" }).getByText("x+y")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("WebGL");
  await page.getByRole("button", { name: "История", exact: true }).click();
  await expect(page.getByRole("listitem")).toHaveCount(8);
  expect(remoteRequests).toEqual([]);
  await context.setOffline(false);
});
