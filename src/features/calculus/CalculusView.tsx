import { useState } from "react";
import { MathEditor } from "../../components/MathEditor";
import type { HistoryEntry } from "../../domain/history-entry";
import type { MathOutcome } from "../../domain/math-outcome";
import { formatNumericResult } from "../../math/evaluate";
import { historyStore, type HistoryStore } from "../../storage/history-store";
import { antidifferentiate, differentiate, integrateDefinite } from "./calculus-service";

type CalculusViewProps = {
  initialInput?: string;
  store?: HistoryStore;
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Не удалось сохранить результат в истории.";
}

function formatValue(value: number | string): string {
  return typeof value === "number" ? formatNumericResult(value) : value;
}

function ResultPanel({ outcome }: { outcome: MathOutcome<number | string> }) {
  return (
    <div className={`result-view${outcome.ok ? "" : " result-view--error"}`}>
      <p className="result-view__status">
        {outcome.ok
          ? outcome.status === "approximate" ? "Приближённый результат" : "Точный результат"
          : "Вычисление не выполнено"}
      </p>
      {outcome.ok ? (
        <output className="result-view__value" aria-label="Результат анализа">{formatValue(outcome.value)}</output>
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

export function CalculusView({ initialInput = "", store = historyStore }: CalculusViewProps) {
  const [input, setInput] = useState(initialInput);
  const [variable, setVariable] = useState("x");
  const [lower, setLower] = useState("0");
  const [upper, setUpper] = useState("1");
  const [outcome, setOutcome] = useState<MathOutcome<number | string> | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  const save = async (label: string, result: MathOutcome<number | string>) => {
    if (!result.ok) {
      return;
    }
    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      feature: "calculus",
      input: label,
      result: formatValue(result.value),
      status: result.status,
      createdAt: Date.now(),
    };
    try {
      await store.add(entry);
    } catch (error) {
      setStorageError(messageOf(error));
    }
  };

  const runSymbolic = async (operation: "differentiate" | "antidifferentiate") => {
    setStorageError(null);
    const result = operation === "differentiate"
      ? differentiate(input, variable)
      : antidifferentiate(input, variable);
    setOutcome(result);
    await save(input, result);
  };

  const runDefiniteIntegral = async () => {
    setStorageError(null);
    const from = lower.trim() === "" ? Number.NaN : Number(lower);
    const to = upper.trim() === "" ? Number.NaN : Number(upper);
    const result = integrateDefinite(input, variable, from, to);
    setOutcome(result);
    await save(input, result);
  };

  return (
    <section className="calculator" aria-labelledby="calculus-title">
      <div className="feature-heading">
        <h2 id="calculus-title">Математический анализ</h2>
        <p>Производные, первообразные и определённые интегралы</p>
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
        <button className="button button--primary" type="button" onClick={() => void runSymbolic("differentiate")}>
          Найти производную
        </button>
        <button className="button button--quiet" type="button" onClick={() => void runSymbolic("antidifferentiate")}>
          Найти первообразную
        </button>
      </div>
      <div className="calculator__controls">
        <label className="angle-select">
          <span>Нижний предел</span>
          <input aria-label="Нижний предел" type="number" step="any" value={lower} onChange={(event) => setLower(event.currentTarget.value)} />
        </label>
        <label className="angle-select">
          <span>Верхний предел</span>
          <input aria-label="Верхний предел" type="number" step="any" value={upper} onChange={(event) => setUpper(event.currentTarget.value)} />
        </label>
        <button className="button button--quiet" type="button" onClick={() => void runDefiniteIntegral()}>
          Вычислить интеграл
        </button>
      </div>
      {outcome && <ResultPanel outcome={outcome} />}
      {storageError && <p className="storage-error" role="alert">{storageError}</p>}
    </section>
  );
}
