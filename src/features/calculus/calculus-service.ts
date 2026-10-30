import { approximate, exact, failure, type MathOutcome } from "../../domain/math-outcome";
import { evaluateScientificAt } from "../../math/evaluate";
import { normalizeExpression } from "../../math/expression/normalize";
import {
  antidifferentiateSymbolically,
  differentiateSymbolically,
  integrateDefiniteSymbolically,
} from "../../math/adapters/calculus";

const symbolicNames = new Set(["pi", "e", "sin", "cos", "tan", "log", "ln", "sqrt", "abs"]);
const absoluteTolerance = 1e-8;
const maximumDepth = 20;
const maximumEvaluations = 4096;

type EvaluationBudget = {
  remaining: number;
};

function isVariableName(variable: string): boolean {
  return /^[a-z]$/.test(variable) && variable !== "e";
}

function normalizeInput(input: string, variable: string): MathOutcome<string> {
  if (!isVariableName(variable)) {
    return failure("invalid-input", "Укажите одну допустимую переменную.");
  }
  return normalizeExpression(input);
}

function variablesIn(expression: string): Set<string> {
  return new Set(
    (expression.match(/[a-z][a-z0-9_]*/g) ?? []).filter((name) => !symbolicNames.has(name)),
  );
}

function hasOnlyIntegrationVariable(expression: string, variable: string): boolean {
  return [...variablesIn(expression)].every((name) => name === variable);
}

function hasVariableDenominator(expression: string, variable: string): boolean {
  const variablePattern = new RegExp(`(^|[^a-z])${variable}([^a-z]|$)`);
  return expression.split("/").slice(1).some((denominator) => variablePattern.test(denominator));
}

function engineError(error: unknown): string {
  return error instanceof Error ? error.message : "Символьный движок не смог обработать выражение.";
}

export function differentiate(input: string, variable: string): MathOutcome<string> {
  const normalized = normalizeInput(input, variable);
  if (!normalized.ok) {
    return normalized;
  }
  try {
    const result = differentiateSymbolically(normalized.value, variable);
    if (!result.trim() || /(?:^|[^a-z])diff\s*\(/.test(result)) {
      return failure("unsupported", "Символьная производная для этого выражения не поддерживается.");
    }
    return exact(result, [], ["Символьный движок не предоставляет проверяемую последовательность правил дифференцирования."]);
  } catch (error) {
    return failure("unsupported", `Не удалось получить символьную производную: ${engineError(error)}`);
  }
}

export function antidifferentiate(input: string, variable: string): MathOutcome<string> {
  const normalized = normalizeInput(input, variable);
  if (!normalized.ok) {
    return normalized;
  }
  try {
    const result = antidifferentiateSymbolically(normalized.value, variable);
    if (result === null || !result.trim()) {
      return failure("unsupported", "Первообразная для этого выражения не поддерживается.");
    }
    return exact(result, [], ["Символьный движок не предоставляет проверяемую последовательность шагов интегрирования."]);
  } catch (error) {
    return failure("unsupported", `Не удалось получить первообразную: ${engineError(error)}`);
  }
}

function sample(
  expression: string,
  variable: string,
  x: number,
  budget: EvaluationBudget,
): MathOutcome<number> {
  if (budget.remaining === 0) {
    return failure("resource-limit", `Численное интегрирование превысило лимит ${maximumEvaluations} вычислений функции.`);
  }
  budget.remaining -= 1;
  return evaluateScientificAt(expression, variable, x);
}

function simpson(a: number, b: number, fa: number, fm: number, fb: number): number {
  return (b - a) * (fa + 4 * fm + fb) / 6;
}

function adaptiveSimpson(
  expression: string,
  variable: string,
  a: number,
  b: number,
  fa: number,
  fm: number,
  fb: number,
  whole: number,
  tolerance: number,
  depth: number,
  budget: EvaluationBudget,
): MathOutcome<number> {
  const middle = a + (b - a) / 2;
  const leftMiddle = a + (middle - a) / 2;
  const rightMiddle = middle + (b - middle) / 2;
  const fl = sample(expression, variable, leftMiddle, budget);
  if (!fl.ok) {
    return fl;
  }
  const fr = sample(expression, variable, rightMiddle, budget);
  if (!fr.ok) {
    return fr;
  }

  const left = simpson(a, middle, fa, fl.value, fm);
  const right = simpson(middle, b, fm, fr.value, fb);
  const delta = left + right - whole;
  if (!Number.isFinite(delta)) {
    return failure("domain-error", "Численное интегрирование получило не конечное промежуточное значение.");
  }
  if (Math.abs(delta) <= 15 * tolerance) {
    return approximate(left + right + delta / 15);
  }
  if (depth === 0) {
    return failure(
      "resource-limit",
      `Численное интегрирование не достигло допуска за ${maximumDepth} уровней уточнения; лимит — ${maximumEvaluations} вычислений функции.`,
    );
  }

  const leftResult = adaptiveSimpson(
    expression,
    variable,
    a,
    middle,
    fa,
    fl.value,
    fm,
    left,
    tolerance / 2,
    depth - 1,
    budget,
  );
  if (!leftResult.ok) {
    return leftResult;
  }
  const rightResult = adaptiveSimpson(
    expression,
    variable,
    middle,
    b,
    fm,
    fr.value,
    fb,
    right,
    tolerance / 2,
    depth - 1,
    budget,
  );
  if (!rightResult.ok) {
    return rightResult;
  }
  return approximate(leftResult.value + rightResult.value);
}

function checkSampledDomain(
  expression: string,
  variable: string,
  lower: number,
  upper: number,
  budget: EvaluationBudget,
): MathOutcome<null> {
  if (!hasOnlyIntegrationVariable(expression, variable)) {
    return exact(null);
  }
  for (const fraction of [0, 0.25, 0.5, 0.75, 1]) {
    const value = lower + (upper - lower) * fraction;
    const result = sample(expression, variable, value, budget);
    if (!result.ok) {
      return result;
    }
  }
  return exact(null);
}

export function integrateDefinite(
  input: string,
  variable: string,
  lower: number,
  upper: number,
): MathOutcome<number | string> {
  const normalized = normalizeInput(input, variable);
  if (!normalized.ok) {
    return normalized;
  }
  if (
    !Number.isFinite(lower)
    || !Number.isFinite(upper)
    || !Number.isFinite(upper - lower)
  ) {
    return failure("invalid-range", "Пределы интегрирования должны быть конечными числами.");
  }
  if (lower === upper) {
    return exact("0");
  }

  const budget = { remaining: maximumEvaluations };
  const domainCheck = checkSampledDomain(normalized.value, variable, lower, upper, budget);
  if (!domainCheck.ok) {
    return domainCheck;
  }

  let symbolicResult: string | null = null;
  let symbolicFailure: string | null = null;
  if (/\btan\s*\(/.test(normalized.value)) {
    symbolicFailure = "Тангенс может иметь полюса внутри интервала интегрирования.";
  } else if (hasVariableDenominator(normalized.value, variable)) {
    symbolicFailure = "Переменный знаменатель требует численной проверки области интегрирования.";
  } else {
    try {
      symbolicResult = integrateDefiniteSymbolically(normalized.value, variable, lower, upper);
    } catch (error) {
      symbolicFailure = engineError(error);
    }
  }
  if (symbolicResult !== null && !/(?:NaN|Infinity|undefined)/i.test(symbolicResult)) {
    return exact(
      symbolicResult,
      [{
        title: "Подстановка пределов",
        expression: `F(${upper}) - F(${lower}) = ${symbolicResult}`,
        explanation: "Значение найдено по символьной первообразной.",
      }],
    );
  }

  const sign = lower < upper ? 1 : -1;
  const a = Math.min(lower, upper);
  const b = Math.max(lower, upper);
  const middle = a + (b - a) / 2;
  const fa = sample(normalized.value, variable, a, budget);
  if (!fa.ok) {
    return fa;
  }
  const fm = sample(normalized.value, variable, middle, budget);
  if (!fm.ok) {
    return fm;
  }
  const fb = sample(normalized.value, variable, b, budget);
  if (!fb.ok) {
    return fb;
  }
  const whole = simpson(a, b, fa.value, fm.value, fb.value);
  if (!Number.isFinite(whole)) {
    return failure("invalid-range", "Интервал слишком широк для численного интегрирования.");
  }
  const numerical = adaptiveSimpson(
    normalized.value,
    variable,
    a,
    b,
    fa.value,
    fm.value,
    fb.value,
    whole,
    absoluteTolerance,
    maximumDepth,
    budget,
  );
  if (!numerical.ok) {
    return numerical;
  }
  const notes = [
    `Адаптивный метод Simpson: абсолютный допуск 1e-8, максимальная глубина ${maximumDepth}, лимит ${maximumEvaluations} вычислений функции.`,
    "Численный результат является приближённым.",
  ];
  if (symbolicFailure) {
    notes.push(`Символьный расчёт недоступен: ${symbolicFailure}`);
  } else {
    notes.push("Символьная первообразная недоступна; использован численный метод.");
  }
  return approximate(sign * numerical.value, [], notes);
}
