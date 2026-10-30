import { useLayoutEffect, useRef, useState } from "react";
import type { HistoryEntry } from "../../domain/history-entry";
import type { MathOutcome } from "../../domain/math-outcome";
import { evaluateScientific, formatNumericResult, type AngleMode } from "../../math/evaluate";
import { Keypad } from "../../components/Keypad";
import { MathEditor } from "../../components/MathEditor";
import { ResultView } from "../../components/ResultView";
import { historyStore, type HistoryStore } from "../../storage/history-store";

type CalculatorViewProps = {
  initialInput?: string;
  store?: HistoryStore;
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Не удалось сохранить вычисление в истории.";
}

function formatResult(outcome: MathOutcome<number>): string {
  if (!outcome.ok) {
    return `Ошибка: ${outcome.message}`;
  }
  return `${outcome.status === "approximate" ? "≈ " : ""}${formatNumericResult(outcome.value)}`;
}

export function CalculatorView({ initialInput = "", store = historyStore }: CalculatorViewProps) {
  const [input, setInput] = useState(initialInput);
  const [angleMode, setAngleMode] = useState<AngleMode>("radians");
  const [outcome, setOutcome] = useState<MathOutcome<number> | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const editorRef = useRef<HTMLTextAreaElement>(null);
  const pendingCursor = useRef<number | null>(null);

  useLayoutEffect(() => {
    if (pendingCursor.current !== null && editorRef.current) {
      editorRef.current.focus();
      editorRef.current.setSelectionRange(pendingCursor.current, pendingCursor.current);
      pendingCursor.current = null;
    }
  }, [input]);

  const insertAtCursor = (token: string) => {
    const editor = editorRef.current;
    const start = editor?.selectionStart ?? input.length;
    const end = editor?.selectionEnd ?? start;
    const next = `${input.slice(0, start)}${token}${input.slice(end)}`;
    setInput(next);
    pendingCursor.current = start + token.length;
  };

  const calculate = async () => {
    setStorageError(null);
    const result = evaluateScientific(input, angleMode);
    setOutcome(result);
    if (!result.ok) {
      return;
    }

    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      feature: "calculator",
      input,
      result: formatResult(result),
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
    <section className="calculator" aria-labelledby="calculator-title">
      <div className="feature-heading">
        <h2 id="calculator-title">Калькулятор</h2>
        <p>Научные функции и знакомые обозначения</p>
      </div>
      <MathEditor
        ref={editorRef}
        value={input}
        onChange={setInput}
        onKeyDown={(event) => {
          if (event.key === "Enter" && !event.shiftKey) {
            event.preventDefault();
            void calculate();
          }
        }}
      />
      <div className="calculator__controls">
        <label className="angle-select">
          <span>Углы</span>
          <select
            aria-label="Режим углов"
            value={angleMode}
            onChange={(event) => setAngleMode(event.currentTarget.value === "degrees" ? "degrees" : "radians")}
          >
            <option value="radians">Радианы</option>
            <option value="degrees">Градусы</option>
          </select>
        </label>
        <button
          className="button button--quiet"
          type="button"
          onClick={() => {
            setInput("");
            setOutcome(null);
            setStorageError(null);
            editorRef.current?.focus();
          }}
        >
          Очистить
        </button>
        <button className="button button--primary" type="button" onClick={() => void calculate()}>
          Вычислить
        </button>
      </div>
      <Keypad onInsert={insertAtCursor} />
      <ResultView outcome={outcome} />
      {storageError && <p className="storage-error" role="alert">{storageError}</p>}
    </section>
  );
}
