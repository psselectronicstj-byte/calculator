import { approximate, failure, type MathOutcome } from "../../domain/math-outcome";
import { evaluateScientific, evaluateScientificAt, formatNumericResult } from "../../math/evaluate";
import { normalizeExpression } from "../../math/expression/normalize";
import { parseExpression } from "../../math/expression/parse";
import { runSymbolic, solveSymbolically } from "../../math/adapters/symbolic";

const symbolicNames = new Set(["pi", "e", "sin", "cos", "tan", "log", "ln", "sqrt", "abs"]);
const rootSubintervals = 1024;
const rootResidualTolerance = 1e-8;

type ParsedEquation = {
  residual: string;
  variables: Set<string>;
};

function isVariableName(variable: string): boolean {
  return /^[a-z]$/.test(variable) && variable !== "e";
}

function variablesIn(expression: string): Set<string> {
  return new Set(
    (expression.match(/[a-z][a-z0-9_]*/g) ?? []).filter((name) => !symbolicNames.has(name)),
  );
}

function parseEquation(input: string): MathOutcome<ParsedEquation> {
  const sides = input.split("=");
  if (sides.length !== 2) {
    return failure("invalid-input", "Введите уравнение с одним знаком равенства.");
  }
  const left = normalizeExpression(sides[0]);
  if (!left.ok) {
    return left;
  }
  const right = normalizeExpression(sides[1]);
  if (!right.ok) {
    return right;
  }

  const residual = `(${left.value})-(${right.value})`;
  const parsed = parseExpression(residual, { allowVariables: true });
  if (!parsed.ok) {
    return parsed;
  }
  return {
    ok: true,
    status: "exact",
    value: { residual, variables: variablesIn(residual) },
    steps: [],
    notes: [],
  };
}

function residualAt(expression: string, variable: string, value: number): number | null {
  const result = evaluateScientificAt(expression, variable, value);
  return result.ok ? result.value : null;
}

function uniqueRoots(roots: Array<{ value: number; expression: string }>) {
  return roots.filter((root, index) => roots.findIndex(
    (candidate) => Math.abs(candidate.value - root.value) <= 1e-7,
  ) === index);
}

export function solveEquation(
  input: string,
  variable: string,
  mode: "exact" | "decimal",
): MathOutcome<string[]> {
  if (!isVariableName(variable) || (mode !== "exact" && mode !== "decimal")) {
    return failure("invalid-input", "Укажите допустимую переменную и режим решения.");
  }
  const parsed = parseEquation(input);
  if (!parsed.ok) {
    return parsed;
  }
  const otherVariables = [...parsed.value.variables].filter((name) => name !== variable);
  if (otherVariables.length > 0) {
    return failure("unsupported", "Решение уравнений с дополнительными переменными пока не поддерживается.");
  }
  if (/\b(?:sin|cos|tan)\s*\(/.test(parsed.value.residual)) {
    return failure("unsupported", "Для тригонометрических уравнений используйте поиск корней на конечном интервале.");
  }

  let solutions: string[];
  try {
    solutions = solveSymbolically(parsed.value.residual, variable);
  } catch (error) {
    return failure(
      "unsupported",
      error instanceof Error
        ? `Символьный решатель не поддерживает это уравнение: ${error.message}`
        : "Символьный решатель не поддерживает это уравнение.",
    );
  }
  if (solutions.length === 0) {
    return failure("no-solution", "Действительных решений не найдено.");
  }
  if (solutions.includes("all")) {
    return failure("underdetermined", "Уравнение выполняется для любого значения переменной.");
  }
  if (solutions.some((solution) => /(?:^|[^a-z])_n(?:$|[^a-z])/.test(solution))) {
    return failure("unsupported", "Решатель вернул семейство корней; используйте поиск на конечном интервале.");
  }

  const realRoots: Array<{ value: number; expression: string }> = [];
  for (const expression of solutions) {
    const evaluated = evaluateScientific(expression, "radians");
    if (!evaluated.ok) {
      continue;
    }
    const residual = residualAt(parsed.value.residual, variable, evaluated.value);
    if (residual === null || Math.abs(residual) > rootResidualTolerance) {
      continue;
    }
    realRoots.push({ value: evaluated.value, expression });
  }

  const roots = uniqueRoots(realRoots);
  if (roots.length === 0) {
    return failure("no-solution", "Действительных решений, удовлетворяющих исходному уравнению, не найдено.");
  }

  if (mode === "exact") {
    return {
      ok: true,
      status: "exact",
      value: roots.map((root) => root.expression),
      steps: [],
      notes: ["Результат проверен подстановкой в исходное уравнение."],
    };
  }
  return approximate(
    roots.map((root) => formatNumericResult(root.value)),
    [],
    ["Десятичные значения получены численной оценкой символьных корней."],
  );
}

function refineBracket(
  expression: string,
  variable: string,
  initialLeft: number,
  initialRight: number,
  initialLeftValue: number,
): number | null {
  let left = initialLeft;
  let right = initialRight;
  let leftValue = initialLeftValue;
  let bestValue = left;
  let bestResidual = Math.abs(leftValue);

  for (let iteration = 0; iteration < 100; iteration += 1) {
    const middle = left + (right - left) / 2;
    if (middle === left || middle === right) {
      break;
    }
    const middleValue = residualAt(expression, variable, middle);
    if (middleValue === null) {
      return null;
    }
    const absoluteResidual = Math.abs(middleValue);
    if (absoluteResidual < bestResidual) {
      bestValue = middle;
      bestResidual = absoluteResidual;
    }
    if (absoluteResidual <= rootResidualTolerance) {
      return middle;
    }
    if (Math.sign(leftValue) === Math.sign(middleValue)) {
      left = middle;
      leftValue = middleValue;
    } else {
      right = middle;
    }
  }

  return bestResidual <= rootResidualTolerance ? bestValue : null;
}

export function solveRootsInInterval(
  equation: string,
  variable: string,
  min: number,
  max: number,
): MathOutcome<number[]> {
  if (!isVariableName(variable)) {
    return failure("invalid-input", "Укажите одну переменную для поиска корней.");
  }
  if (!Number.isFinite(min) || !Number.isFinite(max) || min >= max) {
    return failure("invalid-range", "Начало интервала должно быть меньше его конца.");
  }
  const parsed = parseEquation(equation);
  if (!parsed.ok) {
    return parsed;
  }
  if ([...parsed.value.variables].some((name) => name !== variable)) {
    return failure("unsupported", "Численный поиск поддерживает одно неизвестное.");
  }
  let simplifiedResidual: string;
  try {
    simplifiedResidual = runSymbolic(parsed.value.residual, "simplify");
  } catch (error) {
    return failure(
      "unsupported",
      error instanceof Error
        ? `Не удалось проверить тождественность уравнения: ${error.message}`
        : "Не удалось проверить тождественность уравнения.",
    );
  }
  if (simplifiedResidual === "0") {
    return failure("underdetermined", "Уравнение выполняется для любого значения переменной.");
  }

  const roots: number[] = [];
  const addIfVerified = (candidate: number) => {
    const residual = residualAt(parsed.value.residual, variable, candidate);
    if (residual !== null && Math.abs(residual) <= rootResidualTolerance) {
      roots.push(candidate);
    }
  };

  let previousX = min;
  let previousValue = residualAt(parsed.value.residual, variable, previousX);
  if (previousValue !== null && Math.abs(previousValue) <= rootResidualTolerance) {
    addIfVerified(previousX);
  }

  for (let index = 1; index <= rootSubintervals; index += 1) {
    const currentX = min + ((max - min) * index) / rootSubintervals;
    const currentValue = residualAt(parsed.value.residual, variable, currentX);

    if (currentValue !== null && Math.abs(currentValue) <= rootResidualTolerance) {
      addIfVerified(currentX);
    } else if (
      currentValue !== null
      && previousValue !== null
      && Math.sign(currentValue) !== Math.sign(previousValue)
    ) {
      const refined = refineBracket(
        parsed.value.residual,
        variable,
        previousX,
        currentX,
        previousValue,
      );
      if (refined !== null) {
        addIfVerified(refined);
      }
    }

    previousX = currentX;
    previousValue = currentValue;
  }

  const distinctRoots = roots.filter((root, index) => roots.findIndex(
    (candidate) => Math.abs(candidate - root) <= 1e-7,
  ) === index);
  if (distinctRoots.length === 0) {
    return failure(
      "no-solution",
      "На интервале корни не обнаружены; конечная сетка может пропустить корни между пробами.",
    );
  }

  return approximate(
    distinctRoots,
    [{
      title: "Поиск корней на интервале",
      expression: `${rootSubintervals} подынтервала`,
      explanation: "Знакосменяющие отрезки уточняются методом бисекции.",
    }],
    ["Поиск проверяет конечную сетку и может пропустить корни между пробами."],
  );
}

export function solveLinearSystem(
  coefficients: number[][],
  constants: number[],
): MathOutcome<number[]> {
  const rowCount = coefficients.length;
  const variableCount = coefficients[0]?.length ?? 0;
  if (
    rowCount === 0
    || variableCount === 0
    || constants.length !== rowCount
    || coefficients.some((row) => row.length !== variableCount)
  ) {
    return failure("invalid-shape", "Размеры коэффициентов и свободных членов не совпадают.");
  }
  if (
    coefficients.some((row) => row.some((value) => !Number.isFinite(value)))
    || constants.some((value) => !Number.isFinite(value))
  ) {
    return failure("invalid-input", "Все коэффициенты системы должны быть конечными числами.");
  }

  const original = coefficients.map((row, index) => [...row, constants[index]]);
  const matrix = original.map((row) => [...row]);
  const scale = matrix.flat().reduce((largest, value) => Math.max(largest, Math.abs(value)), 0);
  const tolerance = Math.max(Number.MIN_VALUE, 1e-12 * scale);
  const pivotColumns: number[] = [];
  let pivotRow = 0;

  for (let column = 0; column < variableCount && pivotRow < rowCount; column += 1) {
    let bestRow = pivotRow;
    for (let candidate = pivotRow + 1; candidate < rowCount; candidate += 1) {
      if (Math.abs(matrix[candidate][column]) > Math.abs(matrix[bestRow][column])) {
        bestRow = candidate;
      }
    }
    if (Math.abs(matrix[bestRow][column]) <= tolerance) {
      continue;
    }

    [matrix[pivotRow], matrix[bestRow]] = [matrix[bestRow], matrix[pivotRow]];
    const pivot = matrix[pivotRow][column];
    for (let entry = column; entry <= variableCount; entry += 1) {
      matrix[pivotRow][entry] /= pivot;
    }
    for (let row = 0; row < rowCount; row += 1) {
      if (row === pivotRow) {
        continue;
      }
      const factor = matrix[row][column];
      if (Math.abs(factor) <= tolerance) {
        matrix[row][column] = 0;
        continue;
      }
      for (let entry = column; entry <= variableCount; entry += 1) {
        matrix[row][entry] -= factor * matrix[pivotRow][entry];
      }
    }
    pivotColumns.push(column);
    pivotRow += 1;
  }

  const inconsistent = matrix.some((row) => (
    row.slice(0, variableCount).every((value) => Math.abs(value) <= tolerance)
    && Math.abs(row[variableCount]) > tolerance
  ));
  if (inconsistent) {
    return failure("inconsistent", "Система противоречива и не имеет решений.");
  }
  if (pivotColumns.length < variableCount) {
    return failure("underdetermined", "Система имеет бесконечно много решений.");
  }

  const solution = Array<number>(variableCount).fill(0);
  pivotColumns.forEach((column, row) => {
    solution[column] = matrix[row][variableCount];
  });
  const residualIsAcceptable = original.every((row, index) => {
    const residual = row.slice(0, variableCount)
      .reduce((sum, coefficient, column) => sum + coefficient * solution[column], 0)
      - constants[index];
    return Number.isFinite(residual) && Math.abs(residual) <= 1e-8 * scale;
  });
  if (!residualIsAcceptable) {
    return failure("unsupported", "Система численно неустойчива; решение не удалось подтвердить.");
  }

  return approximate(
    solution,
    [{
      title: "Метод Гаусса",
      expression: `rank(A) = ${pivotColumns.length}`,
      explanation: "Решение найдено исключением переменных с выбором ведущего элемента.",
    }],
    [`Относительный допуск классификации: ${tolerance}.`],
  );
}
