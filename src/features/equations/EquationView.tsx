import { useState } from "react";
import { MathEditor } from "../../components/MathEditor";
import type { HistoryEntry } from "../../domain/history-entry";
import { failure, type MathOutcome } from "../../domain/math-outcome";
import { formatNumericResult } from "../../math/evaluate";
import { historyStore, type HistoryStore } from "../../storage/history-store";
import { solveEquation, solveLinearSystem, solveRootsInInterval } from "./equation-service";

type EquationViewProps = {
  initialInput?: string;
  store?: HistoryStore;
};

type SystemInput = {
  coefficients: number[][];
  constants: number[];
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Не удалось сохранить результат в истории.";
}

function parseSystemInput(coefficientsText: string, constantsText: string): MathOutcome<SystemInput> {
  const rows = coefficientsText.trim().split(/\r?\n/).map((row) => row.trim()).filter(Boolean);
  const values = constantsText.trim().split(/[,\s;]+/).filter(Boolean).map(Number);
  if (rows.length === 0 || values.length === 0) {
    return failure("invalid-input", "Введите коэффициенты системы и свободные члены.");
  }
  const coefficients = rows.map((row) => row.split(/[,\s;]+/).filter(Boolean).map(Number));
  if (coefficients.some((row) => row.length === 0 || row.some((value) => !Number.isFinite(value)))) {
    return failure("invalid-input", "Коэффициенты должны быть конечными числами.");
  }
  if (values.some((value) => !Number.isFinite(value))) {
    return failure("invalid-input", "Свободные члены должны быть конечными числами.");
  }
  return { ok: true, status: "exact", value: { coefficients, constants: values }, steps: [], notes: [] };
}

function OutcomePanel<T>({
  label,
  outcome,
  formatValue,
}: {
  label: string;
  outcome: MathOutcome<T>;
  formatValue: (value: T) => string;
}) {
  return (
    <div className={`result-view${outcome.ok ? "" : " result-view--error"}`}>
      <p className="result-view__status">{label}</p>
      {outcome.ok ? (
        <output className="result-view__value" aria-label={label}>{formatValue(outcome.value)}</output>
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

export function EquationView({ initialInput = "", store = historyStore }: EquationViewProps) {
  const [input, setInput] = useState(initialInput);
  const [variable, setVariable] = useState("x");
  const [mode, setMode] = useState<"exact" | "decimal">("exact");
  const [equationOutcome, setEquationOutcome] = useState<MathOutcome<string[]> | null>(null);
  const [intervalOutcome, setIntervalOutcome] = useState<MathOutcome<number[]> | null>(null);
  const [systemOutcome, setSystemOutcome] = useState<MathOutcome<number[]> | null>(null);
  const [min, setMin] = useState("-10");
  const [max, setMax] = useState("10");
  const [coefficientsText, setCoefficientsText] = useState("1, 1\n2, -1");
  const [constantsText, setConstantsText] = useState("3, 0");
  const [storageError, setStorageError] = useState<string | null>(null);

  const save = async (entryInput: string, result: string, status: "exact" | "approximate") => {
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      feature: "equations",
      input: entryInput,
      result,
      status,
      createdAt: Date.now(),
    };
    try {
      await store.add(entry);
    } catch (error) {
      setStorageError(messageOf(error));
    }
  };

  const solve = async () => {
    setStorageError(null);
    const result = solveEquation(input, variable, mode);
    setEquationOutcome(result);
    if (result.ok) {
      await save(input, `${variable} = ${result.value.join("; ")}`, result.status);
    }
  };

  const searchInterval = async () => {
    setStorageError(null);
    const from = min.trim() === "" ? Number.NaN : Number(min);
    const to = max.trim() === "" ? Number.NaN : Number(max);
    const result = solveRootsInInterval(input, variable, from, to);
    setIntervalOutcome(result);
    if (result.ok) {
      await save(input, result.value.map(formatNumericResult).join("; "), result.status);
    }
  };

  const solveSystem = async () => {
    setStorageError(null);
    const parsed = parseSystemInput(coefficientsText, constantsText);
    if (!parsed.ok) {
      setSystemOutcome(parsed);
      return;
    }
    const result = solveLinearSystem(parsed.value.coefficients, parsed.value.constants);
    setSystemOutcome(result);
    if (result.ok) {
      const resultText = result.value.map((value, index) => `x${index + 1} = ${formatNumericResult(value)}`).join("; ");
      await save(`${coefficientsText}; b=[${constantsText}]`, resultText, result.status);
    }
  };

  return (
    <section className="calculator" aria-labelledby="equations-title">
      <div className="feature-heading">
        <h2 id="equations-title">Уравнения</h2>
        <p>Точные решения, поиск корней и системы линейных уравнений</p>
      </div>
      <MathEditor value={input} onChange={setInput} />
      <div className="calculator__controls">
        <label className="angle-select">
          <span>Переменная</span>
          <input
            aria-label="Переменная"
            maxLength={1}
            value={variable}
            onChange={(event) => setVariable(event.currentTarget.value)}
          />
        </label>
        <label className="angle-select">
          <span>Точность</span>
          <select
            aria-label="Точность решения"
            value={mode}
            onChange={(event) => setMode(event.currentTarget.value === "decimal" ? "decimal" : "exact")}
          >
            <option value="exact">Точная</option>
            <option value="decimal">Десятичная</option>
          </select>
        </label>
        <button className="button button--primary" type="button" onClick={() => void solve()}>
          Решить уравнение
        </button>
      </div>
      {equationOutcome && (
        <OutcomePanel
          label="Решение уравнения"
          outcome={equationOutcome}
          formatValue={(roots) => roots.join("; ")}
        />
      )}

      <div className="feature-heading">
        <h3>Поиск корней на интервале</h3>
        <p>Численный поиск может пропустить корни между пробами.</p>
      </div>
      <div className="calculator__controls">
        <label className="angle-select">
          <span>Начало интервала</span>
          <input aria-label="Начало интервала" type="number" step="any" value={min} onChange={(event) => setMin(event.currentTarget.value)} />
        </label>
        <label className="angle-select">
          <span>Конец интервала</span>
          <input aria-label="Конец интервала" type="number" step="any" value={max} onChange={(event) => setMax(event.currentTarget.value)} />
        </label>
        <button className="button button--quiet" type="button" onClick={() => void searchInterval()}>
          Найти корни
        </button>
      </div>
      {intervalOutcome && (
        <OutcomePanel
          label="Корни на интервале"
          outcome={intervalOutcome}
          formatValue={(roots) => roots.map(formatNumericResult).join("; ")}
        />
      )}

      <div className="feature-heading">
        <h3>Система линейных уравнений</h3>
        <p>Одна строка коэффициентов и один свободный член на уравнение.</p>
      </div>
      <label className="math-editor">
        <span>Коэффициенты системы</span>
        <textarea
          aria-label="Коэффициенты системы"
          rows={3}
          value={coefficientsText}
          onChange={(event) => setCoefficientsText(event.currentTarget.value)}
        />
      </label>
      <label className="math-editor">
        <span>Свободные члены</span>
        <input
          aria-label="Свободные члены"
          value={constantsText}
          onChange={(event) => setConstantsText(event.currentTarget.value)}
        />
      </label>
      <div className="calculator__controls">
        <button className="button button--quiet" type="button" onClick={() => void solveSystem()}>
          Решить систему
        </button>
      </div>
      {systemOutcome && (
        <OutcomePanel
          label="Решение системы"
          outcome={systemOutcome}
          formatValue={(values) => values.map((value, index) => `x${index + 1} = ${formatNumericResult(value)}`).join("; ")}
        />
      )}
      {storageError && <p className="storage-error" role="alert">{storageError}</p>}
    </section>
  );
}
