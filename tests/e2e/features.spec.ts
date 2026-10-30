import { expect, test } from "@playwright/test";

test("calculator, algebra, equations, and calculus show their results", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("textbox", { name: "Математическое выражение" }).fill("2+3");
  await page.getByRole("button", { name: "Вычислить", exact: true }).click();
  await expect(page.locator(".result-view__value")).toHaveText("5");
  await page.getByRole("textbox", { name: "Математическое выражение" }).fill("1/0");
  await page.getByRole("button", { name: "Вычислить", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("дел");

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

  await page.getByLabel("Нижний предел").fill("0");
  await page.getByLabel("Верхний предел").fill("1");
  await page.getByRole("button", { name: "Вычислить интеграл" }).click();
  await expect(page.getByLabel("Результат анализа")).toHaveText("1/3");
});

test("2D graph starts a new path after a singular sample", async ({ page }) => {
  await page.addInitScript(() => {
    const pathMoves = new WeakMap<CanvasRenderingContext2D, number>();
    Reflect.set(window, "__graphPathMoveCounts", []);

    const beginPath = CanvasRenderingContext2D.prototype.beginPath;
    CanvasRenderingContext2D.prototype.beginPath = function (...args) {
      pathMoves.set(this, 0);
      return beginPath.apply(this, args);
    };

    const moveTo = CanvasRenderingContext2D.prototype.moveTo;
    CanvasRenderingContext2D.prototype.moveTo = function (...args) {
      pathMoves.set(this, (pathMoves.get(this) ?? 0) + 1);
      return moveTo.apply(this, args);
    };

    const stroke = CanvasRenderingContext2D.prototype.stroke;
    CanvasRenderingContext2D.prototype.stroke = function (...args) {
      if (this.strokeStyle === "#79d7a4") {
        const counts = Reflect.get(window, "__graphPathMoveCounts") as number[];
        counts.push(pathMoves.get(this) ?? 0);
      }
      return stroke.apply(this, args);
    };
  });
  await page.goto("/");
  await page.getByRole("button", { name: "2D-график", exact: true }).click();

  const pole = -10 + (20 * 359) / 719;
  await page.getByRole("textbox", { name: "Функция 1" }).fill(`1/(x-(${pole}))`);
  await page.getByRole("button", { name: "Построить график" }).click();

  await expect(page.getByRole("img", { name: "График функций" })).toBeVisible();
  await expect.poll(() => page.evaluate(() => Reflect.get(window, "__graphPathMoveCounts"))).toContain(2);
});

test("3D graph displays multiple surfaces and reports unavailable WebGL", async ({ page }) => {
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
  await page.getByRole("button", { name: "3D-график", exact: true }).click();
  await page.getByRole("button", { name: "Добавить функцию" }).click();
  await page.getByRole("textbox", { name: "Функция 2" }).fill("x-y");
  await page.getByRole("button", { name: "Построить поверхности" }).click();

  const legend = page.getByRole("list", { name: "Поверхности на графике" });
  await expect(legend.getByText("x+y")).toBeVisible();
  await expect(legend.getByText("x-y")).toBeVisible();
  await expect(page.getByRole("alert")).toContainText("WebGL");
});

test("matrix operations succeed and incompatible shapes are explicit", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Матрицы", exact: true }).click();
  await page.getByRole("button", { name: "Вычислить матричную операцию" }).click();
  await expect(page.getByLabel("Результат матричной операции")).toHaveText("-2");

  await page.getByRole("textbox", { name: "Матрица A" }).fill("1, 2\n3, 4\n5, 6");
  await page.getByRole("button", { name: "Вычислить матричную операцию" }).click();
  await expect(page.getByRole("alert")).toContainText("квадрат");
});

test("each feature input is saved and restored from local history after reload", async ({ page }) => {
  await page.goto("/");

  await page.getByRole("textbox", { name: "Математическое выражение" }).fill("2+3");
  await page.getByRole("button", { name: "Вычислить", exact: true }).click();

  await page.getByRole("button", { name: "Алгебра", exact: true }).click();
  await page.getByRole("textbox", { name: "Математическое выражение" }).fill("2*(x+3)");
  await page.getByRole("combobox", { name: "Операция" }).selectOption("expand");
  await page.getByRole("button", { name: "Преобразовать" }).click();

  await page.getByRole("button", { name: "Уравнения", exact: true }).click();
  await page.getByRole("textbox", { name: "Математическое выражение" }).fill("x-2=0");
  await page.getByRole("button", { name: "Решить уравнение" }).click();

  await page.getByRole("button", { name: "Анализ", exact: true }).click();
  await page.getByRole("textbox", { name: "Математическое выражение" }).fill("x^2");
  await page.getByRole("button", { name: "Найти производную" }).click();

  await page.getByRole("button", { name: "2D-график", exact: true }).click();
  await page.getByRole("button", { name: "Построить график" }).click();

  await page.getByRole("button", { name: "3D-график", exact: true }).click();
  await page.getByRole("button", { name: "Построить поверхности" }).click();

  await page.getByRole("button", { name: "Матрицы", exact: true }).click();
  await page.getByRole("button", { name: "Вычислить матричную операцию" }).click();

  await page.reload();
  await page.getByRole("button", { name: "История", exact: true }).click();
  await expect(page.getByRole("listitem")).toHaveCount(7);

  const cases = [
    { feature: "Калькулятор", input: "2+3", navigation: "Калькулятор", control: "Математическое выражение", value: "2+3" },
    { feature: "Алгебра", input: "2*(x+3)", navigation: "Алгебра", control: "Математическое выражение", value: "2*(x+3)" },
    { feature: "Уравнения", input: "x-2=0", navigation: "Уравнения", control: "Математическое выражение", value: "x-2=0" },
    { feature: "Анализ", input: "x^2", navigation: "Анализ", control: "Математическое выражение", value: "x^2" },
    { feature: "График 2D", input: "x^2", navigation: "2D-график", control: "Функция 1", value: "x^2" },
    { feature: "График 3D", input: "x+y", navigation: "3D-график", control: "Функция 1", value: "x+y" },
    { feature: "Матрицы", input: "1, 2", navigation: "Матрицы", control: "Матрица A", value: "1, 2\n3, 4" },
  ];

  for (const entry of cases) {
    const item = page.getByRole("listitem").filter({ hasText: entry.feature }).filter({ hasText: entry.input });
    await item.getByRole("button", { name: /^Открыть/ }).click();
    await expect(page.getByRole("button", { name: entry.navigation, exact: true })).toHaveAttribute("aria-current", "page");
    await expect(page.getByRole("textbox", { name: entry.control })).toHaveValue(entry.value);
    await page.getByRole("button", { name: "История", exact: true }).click();
  }
});

test("history supports deleting one result and clearing all remaining results", async ({ page }) => {
  await page.goto("/");
  const expression = page.getByRole("textbox", { name: "Математическое выражение" });
  await expression.fill("2+3");
  await page.getByRole("button", { name: "Вычислить", exact: true }).click();
  await expression.fill("3+4");
  await page.getByRole("button", { name: "Вычислить", exact: true }).click();
  await page.getByRole("button", { name: "История", exact: true }).click();

  await page.getByRole("button", { name: "Удалить 2+3" }).click();
  await expect(page.getByRole("listitem")).toHaveCount(1);
  await page.getByRole("button", { name: "Очистить историю" }).click();
  await expect(page.getByText("История пока пуста.")).toBeVisible();
});
