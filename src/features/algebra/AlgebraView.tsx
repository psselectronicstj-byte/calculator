import { useState } from "react";
import type { HistoryEntry } from "../../domain/history-entry";
import type { MathOutcome } from "../../domain/math-outcome";
import { MathEditor } from "../../components/MathEditor";
import { transformExpression } from "./algebra-service";
import type { SymbolicOperation } from "../../math/adapters/symbolic";
import { historyStore, type HistoryStore } from "../../storage/history-store";

type AlgebraViewProps = {
  initialInput?: string;
  store?: HistoryStore;
};

const operationLabels: Record<SymbolicOperation, string> = {
  simplify: "Упростить",
  expand: "Раскрыть скобки",
  factor: "Разложить на множители",
  "solve-for": "Решить относительно переменной",
};

function isSymbolicOperation(value: string): value is SymbolicOperation {
  return Object.hasOwn(operationLabels, value);
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Не удалось сохранить результат в истории.";
}

function ResultPanel({ outcome }: { outcome: MathOutcome<string> }) {
  return (
    <div className={`result-view${outcome.ok ? "" : " result-view--error"}`}>
      <p className="result-view__status">{outcome.ok ? "Символьный результат" : "Преобразование не выполнено"}</p>
      {outcome.ok ? (
        <output className="result-view__value" aria-label="Результат преобразования">{outcome.value}</output>
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

export function AlgebraView({ initialInput = "", store = historyStore }: AlgebraViewProps) {
  const [input, setInput] = useState(initialInput);
  const [operation, setOperation] = useState<SymbolicOperation>("simplify");
  const [variable, setVariable] = useState("x");
  const [outcome, setOutcome] = useState<MathOutcome<string> | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);

  const transform = async () => {
    setStorageError(null);
    const result = transformExpression(input, operation, variable);
    setOutcome(result);
    if (!result.ok) {
      return;
    }

    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      feature: "algebra",
      input,
      result: result.value,
      status: result.status,
      createdAt: Date.now(),
    };
    try {
      await store.add(entry);
    } catch (error) {
      setStorageError(messageOf(error));
    }
  };

  return (
    <section className="calculator" aria-labelledby="algebra-title">
      <div className="feature-heading">
        <h2 id="algebra-title">Алгебра</h2>
        <p>Преобразования и решение относительно выбранной переменной</p>
      </div>
      <MathEditor value={input} onChange={setInput} />
      <div className="calculator__controls">
        <label className="angle-select">
          <span>Операция</span>
          <select
            aria-label="Операция"
            value={operation}
            onChange={(event) => {
              const next = event.currentTarget.value;
              if (isSymbolicOperation(next)) {
                setOperation(next);
              }
            }}
          >
            {Object.entries(operationLabels).map(([value, label]) => (
              <option key={value} value={value}>{label}</option>
            ))}
          </select>
        </label>
        {operation === "solve-for" && (
          <label className="angle-select">
            <span>Переменная</span>
            <input
              aria-label="Переменная"
              maxLength={1}
              value={variable}
              onChange={(event) => setVariable(event.currentTarget.value)}
            />
          </label>
        )}
        <button className="button button--primary" type="button" onClick={() => void transform()}>
          Преобразовать
        </button>
      </div>
      {outcome && <ResultPanel outcome={outcome} />}
      {storageError && <p className="storage-error" role="alert">{storageError}</p>}
    </section>
  );
}
