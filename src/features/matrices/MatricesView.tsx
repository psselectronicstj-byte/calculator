import { useState } from "react";
import type { HistoryEntry, HistoryRestoreData } from "../../domain/history-entry";
import { failure, type MathOutcome } from "../../domain/math-outcome";
import { historyStore, type HistoryStore } from "../../storage/history-store";
import { MatrixEditor } from "./MatrixEditor";
import {
  matrixOperation,
  solveMatrixSystem,
  type EigenResult,
  type Matrix,
  type MatrixOperation,
  type MatrixOperationValue,
} from "./matrix-service";

type MatricesViewProps = {
  initialInput?: string;
  initialRestore?: Extract<HistoryRestoreData, { kind: "matrix-operation" }>;
  store?: HistoryStore;
};

type MatrixAction = MatrixOperation | "solve-system";

const operationLabels: Record<MatrixAction, string> = {
  add: "Сложение",
  multiply: "Умножение",
  transpose: "Транспонирование",
  determinant: "Определитель",
  inverse: "Обратная матрица",
  rank: "Ранг",
  eigen: "Собственные значения и векторы",
  "solve-system": "Решить Ax = b",
};

function isMatrixAction(value: string): value is MatrixAction {
  return Object.hasOwn(operationLabels, value);
}

function parseMatrix(input: string): MathOutcome<Matrix> {
  const rows = input.trim().replace(/;/g, "\n").split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
  if (rows.length === 0) {
    return failure("invalid-shape", "Введите хотя бы одну строку матрицы.");
  }
  const matrix = rows.map((row) => row.split(/[,\s]+/).filter(Boolean).map(Number));
  if (matrix.some((row) => row.length === 0)) {
    return failure("invalid-shape", "Каждая строка должна содержать хотя бы один элемент.");
  }
  if (matrix.some((row) => row.some((value) => !Number.isFinite(value)))) {
    return failure("invalid-input", "Элементы матрицы должны быть конечными числами.");
  }
  return { ok: true, status: "exact", value: matrix, steps: [], notes: [] };
}

function parseVector(input: string): MathOutcome<number[]> {
  const values = input.trim().split(/[,\s;]+/).filter(Boolean).map(Number);
  if (values.length === 0) {
    return failure("invalid-input", "Введите свободные члены столбца b.");
  }
  if (values.some((value) => !Number.isFinite(value))) {
    return failure("invalid-input", "Свободные члены должны быть конечными числами.");
  }
  return { ok: true, status: "exact", value: values, steps: [], notes: [] };
}

function isEigenResult(value: MatrixOperationValue): value is EigenResult {
  return typeof value === "object" && value !== null && "values" in value && "vectors" in value;
}

function formatMatrix(matrix: Matrix): string {
  return matrix.map((row) => `[${row.join(", ")}]`).join("\n");
}

function isMatrix(value: number[] | Matrix): value is Matrix {
  return value.length === 0 || Array.isArray(value[0]);
}

function formatValue(value: MatrixOperationValue): string {
  if (typeof value === "number") {
    return String(value);
  }
  if (isEigenResult(value)) {
    return `Значения: ${value.values.join(", ")}\nВекторы:\n${formatMatrix(value.vectors)}`;
  }
  if (value.length === 0) {
    return "[]";
  }
  if (isMatrix(value)) {
    return formatMatrix(value);
  }
  return value.join(", ");
}

function ResultPanel({ outcome }: { outcome: MathOutcome<MatrixOperationValue> }) {
  return (
    <div className={`result-view${outcome.ok ? "" : " result-view--error"}`}>
      <p className="result-view__status">
        {outcome.ok
          ? outcome.status === "approximate" ? "Приближённый результат" : "Точный результат"
          : "Матричная операция не выполнена"}
      </p>
      {outcome.ok ? (
        <output className="matrix-result" aria-label="Результат матричной операции">{formatValue(outcome.value)}</output>
      ) : (
        <p role="alert">{outcome.message}</p>
      )}
      {outcome.ok && outcome.steps.length > 0 && (
        <ol className="result-view__steps">
          {outcome.steps.map((step, index) => (
            <li key={`${step.title}-${index}`}>
              <strong>{step.title}</strong>
              {step.expression && <code>{step.expression}</code>}
              <span>{step.explanation}</span>
            </li>
          ))}
        </ol>
      )}
      {outcome.ok && outcome.notes.length > 0 && (
        <ul className="result-view__steps">
          {outcome.notes.map((note) => <li key={note}>{note}</li>)}
        </ul>
      )}
    </div>
  );
}

export function MatricesView({
  initialInput = "1, 2\n3, 4",
  initialRestore,
  store = historyStore,
}: MatricesViewProps) {
  const [operation, setOperation] = useState<MatrixAction>(initialRestore?.operation ?? "determinant");
  const [leftText, setLeftText] = useState(initialRestore?.leftText ?? initialInput);
  const [rightText, setRightText] = useState(
    initialRestore?.operation === "add" || initialRestore?.operation === "multiply"
      ? initialRestore.rightText
      : "5, 6\n7, 8",
  );
  const [constantsText, setConstantsText] = useState(
    initialRestore?.operation === "solve-system" ? initialRestore.constantsText : "5\n11",
  );
  const [outcome, setOutcome] = useState<MathOutcome<MatrixOperationValue> | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  const calculate = async () => {
    setStorageError(null);
    const left = parseMatrix(leftText);
    if (!left.ok) {
      setOutcome(left);
      return;
    }

    let result: MathOutcome<MatrixOperationValue>;
    if (operation === "solve-system") {
      const constants = parseVector(constantsText);
      if (!constants.ok) {
        setOutcome(constants);
        return;
      }
      result = solveMatrixSystem(left.value, constants.value);
    } else if (operation === "add" || operation === "multiply") {
      const right = parseMatrix(rightText);
      if (!right.ok) {
        setOutcome(right);
        return;
      }
      result = matrixOperation(operation, left.value, right.value);
    } else {
      result = matrixOperation(operation, left.value);
    }
    setOutcome(result);
    if (!result.ok) {
      return;
    }

    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      feature: "matrices",
      input: leftText,
      result: `${operationLabels[operation]}: ${formatValue(result.value)}`,
      status: result.status,
      createdAt: Date.now(),
      restoreData: operation === "add" || operation === "multiply"
        ? { kind: "matrix-operation", operation, leftText, rightText }
        : operation === "solve-system"
          ? { kind: "matrix-operation", operation, leftText, constantsText }
          : { kind: "matrix-operation", operation, leftText },
    };
    try {
      await store.add(entry);
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "Не удалось сохранить результат в истории.");
    }
  };

  return (
    <section className="calculator" aria-labelledby="matrices-title">
      <div className="feature-heading">
        <h2 id="matrices-title">Матрицы</h2>
        <p>Операции, ранг, собственные значения и системы Ax = b</p>
      </div>
      <label className="angle-select matrix-operation">
        <span>Операция</span>
        <select
          aria-label="Операция с матрицами"
          value={operation}
          onChange={(event) => {
            const next = event.currentTarget.value;
            if (isMatrixAction(next)) {
              setOperation(next);
            }
          }}
        >
          {Object.entries(operationLabels).map(([value, label]) => (
            <option key={value} value={value}>{label}</option>
          ))}
        </select>
      </label>
      <div className="matrix-editors">
        <MatrixEditor label="Матрица A" value={leftText} onChange={setLeftText} />
        {(operation === "add" || operation === "multiply") && (
          <MatrixEditor label="Матрица B" value={rightText} onChange={setRightText} />
        )}
        {operation === "solve-system" && (
          <label className="matrix-editor">
            <span>Свободные члены b</span>
            <textarea
              aria-label="Свободные члены b"
              rows={4}
              value={constantsText}
              onChange={(event) => setConstantsText(event.currentTarget.value)}
            />
          </label>
        )}
      </div>
      <div className="calculator__controls">
        <button className="button button--primary" type="button" onClick={() => void calculate()}>
          Вычислить матричную операцию
        </button>
      </div>
      {outcome && <ResultPanel outcome={outcome} />}
      {storageError && <p className="storage-error" role="alert">{storageError}</p>}
    </section>
  );
}
