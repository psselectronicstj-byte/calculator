import { all, create } from "mathjs";
import { approximate, exact, failure, type MathOutcome } from "../../domain/math-outcome";
import { solveLinearSystem } from "../equations/equation-service";
import type {
  EigenResult,
  Matrix,
  MatrixOperation,
  MatrixOperationValue,
} from "./matrix-types";

export type { EigenResult, Matrix, MatrixOperation, MatrixOperationValue } from "./matrix-types";

const math = create(all);
const maximumDimension = 20;
const maximumEigenDimension = 10;

function validateMatrix(input: unknown, limit: number): MathOutcome<Matrix> {
  if (!Array.isArray(input) || input.length === 0 || !Array.isArray(input[0]) || input[0].length === 0) {
    return failure("invalid-shape", "Матрица должна содержать хотя бы одну строку и один столбец.");
  }
  const columnCount = input[0].length;
  if (input.length > limit || columnCount > limit) {
    return failure("resource-limit", `Размер матрицы не должен превышать ${limit} × ${limit}.`);
  }

  const matrix: Matrix = [];
  for (const row of input) {
    if (!Array.isArray(row) || row.length !== columnCount) {
      return failure("invalid-shape", "Все строки матрицы должны иметь одинаковое число столбцов.");
    }
    const values: number[] = [];
    for (const value of row) {
      if (typeof value !== "number" || !Number.isFinite(value)) {
        return failure("invalid-input", "Элементы матрицы должны быть конечными числами.");
      }
      values.push(value);
    }
    matrix.push(values);
  }
  return exact(matrix);
}

function isSquare(matrix: Matrix): boolean {
  return matrix.length === matrix[0].length;
}

function matrixRank(matrix: Matrix): number {
  const reduced = matrix.map((row) => [...row]);
  const rowScales = reduced.map((row) => (
    row.reduce((largest, value) => Math.max(largest, Math.abs(value)), 0)
  ));
  const tolerance = 1e-12;
  let pivotRow = 0;

  for (let column = 0; column < reduced[0].length && pivotRow < reduced.length; column += 1) {
    let bestRow = pivotRow;
    let bestRatio = rowScales[bestRow] === 0 ? 0 : Math.abs(reduced[bestRow][column]) / rowScales[bestRow];
    for (let row = pivotRow + 1; row < reduced.length; row += 1) {
      const ratio = rowScales[row] === 0 ? 0 : Math.abs(reduced[row][column]) / rowScales[row];
      if (ratio > bestRatio) {
        bestRow = row;
        bestRatio = ratio;
      }
    }
    if (bestRatio <= tolerance) {
      continue;
    }
    [reduced[pivotRow], reduced[bestRow]] = [reduced[bestRow], reduced[pivotRow]];
    [rowScales[pivotRow], rowScales[bestRow]] = [rowScales[bestRow], rowScales[pivotRow]];
    const pivot = reduced[pivotRow][column];
    for (let entry = column; entry < reduced[pivotRow].length; entry += 1) {
      reduced[pivotRow][entry] /= pivot;
    }
    for (let row = pivotRow + 1; row < reduced.length; row += 1) {
      const factor = reduced[row][column];
      for (let entry = column; entry < reduced[row].length; entry += 1) {
        reduced[row][entry] -= factor * reduced[pivotRow][entry];
      }
    }
    pivotRow += 1;
  }
  return pivotRow;
}

function collectionArray(value: unknown): unknown[] | null {
  if (Array.isArray(value)) {
    return value;
  }
  if (
    typeof value === "object"
    && value !== null
    && "toArray" in value
    && typeof value.toArray === "function"
  ) {
    const result = value.toArray();
    return Array.isArray(result) ? result : null;
  }
  return null;
}

function flatNumbers(value: unknown): number[] | null {
  const values = collectionArray(value);
  if (!values) {
    return null;
  }
  const flattened = values.flat(Infinity);
  const numbers: number[] = [];
  for (const entry of flattened) {
    if (typeof entry !== "number" || !Number.isFinite(entry)) {
      return null;
    }
    numbers.push(entry);
  }
  return numbers;
}

function numericMatrix(value: unknown): Matrix | null {
  const rows = collectionArray(value);
  if (!rows) {
    return typeof value === "number" && Number.isFinite(value) ? [[value]] : null;
  }
  const matrix: Matrix = [];
  for (const row of rows) {
    const values = flatNumbers(row);
    if (!values) {
      return null;
    }
    matrix.push(values);
  }
  return matrix.length > 0 && matrix.every((row) => row.length === matrix[0].length) ? matrix : null;
}

function engineFailure(error: unknown): MathOutcome<never> {
  return failure(
    "unsupported",
    error instanceof Error
      ? `Матричный движок не поддерживает эту операцию: ${error.message}`
      : "Матричный движок не поддерживает эту операцию.",
  );
}

function requireSquare(operation: string, matrix: Matrix): MathOutcome<null> {
  return isSquare(matrix)
    ? exact(null)
    : failure("invalid-shape", `Операция «${operation}» требует квадратную матрицу.`);
}

export function matrixOperation(
  operation: MatrixOperation,
  left: Matrix,
  right?: Matrix,
): MathOutcome<MatrixOperationValue> {
  const maximum = operation === "eigen" ? maximumEigenDimension : maximumDimension;
  const validatedLeft = validateMatrix(left, maximum);
  if (!validatedLeft.ok) {
    return validatedLeft;
  }
  const a = validatedLeft.value;

  if (operation === "add" || operation === "multiply") {
    if (right === undefined) {
      return failure("invalid-shape", "Для этой операции нужна вторая матрица.");
    }
    const validatedRight = validateMatrix(right, maximumDimension);
    if (!validatedRight.ok) {
      return validatedRight;
    }
    const b = validatedRight.value;
    if (operation === "add") {
      if (a.length !== b.length || a[0].length !== b[0].length) {
        return failure("invalid-shape", "Для сложения матрицы должны иметь одинаковый размер.");
      }
      const result = a.map((row, rowIndex) => row.map((value, columnIndex) => value + b[rowIndex][columnIndex]));
      return result.flat().every(Number.isFinite)
        ? approximate(result)
        : failure("domain-error", "Сложение матриц вышло за конечный диапазон чисел.");
    }
    if (a[0].length !== b.length) {
      return failure("invalid-shape", "Число столбцов первой матрицы должно совпадать с числом строк второй.");
    }
    const result = a.map((row) => b[0].map((_, column) => (
      row.reduce((sum, value, index) => sum + value * b[index][column], 0)
    )));
    return result.flat().every(Number.isFinite)
      ? approximate(result)
      : failure("domain-error", "Умножение матриц вышло за конечный диапазон чисел.");
  }

  switch (operation) {
    case "transpose":
      return exact(a[0].map((_, column) => a.map((row) => row[column])));
    case "rank":
      return approximate(matrixRank(a), [], ["Численный ранг определяется с относительным допуском 1e-12."]);
    case "determinant": {
      const square = requireSquare("определитель", a);
      if (!square.ok) {
        return square;
      }
      try {
        const result = math.det(a);
        return typeof result === "number" && Number.isFinite(result)
          ? approximate(result)
          : failure("unsupported", "Определитель не удалось представить конечным вещественным числом.");
      } catch (error) {
        return engineFailure(error);
      }
    }
    case "inverse": {
      const square = requireSquare("обратная матрица", a);
      if (!square.ok) {
        return square;
      }
      if (matrixRank(a) < a.length) {
        return failure("singular", "Обратной матрицы не существует: исходная матрица вырождена.");
      }
      try {
        const result = numericMatrix(math.inv(a));
        if (!result || result.length !== a.length || result.some((row) => row.length !== a.length)) {
          return failure("unsupported", "Не удалось получить вещественную обратную матрицу.");
        }
        return approximate(result);
      } catch (error) {
        return engineFailure(error);
      }
    }
    case "eigen": {
      const square = requireSquare("собственные значения", a);
      if (!square.ok) {
        return square;
      }
      try {
        const decomposition = math.eigs(a);
        const values = flatNumbers(math.flatten(decomposition.values));
        const vectors = decomposition.eigenvectors.map(({ vector }) => (
          flatNumbers(math.flatten(vector))
        ));
        if (
          !values
          || values.length !== a.length
          || vectors.some((vector) => !vector || vector.length !== a.length)
        ) {
          return failure("unsupported", "Поддерживаются только собственные значения и векторы из вещественных чисел.");
        }
        const pairs = values.map((value, index) => ({ value, vector: vectors[index]! }));
        pairs.sort((leftPair, rightPair) => leftPair.value - rightPair.value);
        const result: EigenResult = {
          values: pairs.map(({ value }) => value),
          vectors: pairs.map(({ vector }) => vector),
        };
        return approximate(result);
      } catch (error) {
        return engineFailure(error);
      }
    }
  }
}

export function solveMatrixSystem(
  coefficients: Matrix,
  constants: number[],
): MathOutcome<number[]> {
  const validated = validateMatrix(coefficients, maximumDimension);
  if (!validated.ok) {
    return validated;
  }
  if (!Array.isArray(constants) || constants.length !== validated.value.length) {
    return failure("invalid-shape", "Число свободных членов должно совпадать с числом строк матрицы.");
  }
  if (constants.some((value) => typeof value !== "number" || !Number.isFinite(value))) {
    return failure("invalid-input", "Свободные члены должны быть конечными числами.");
  }
  return solveLinearSystem(validated.value, constants);
}
