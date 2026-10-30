import type { MathOutcome } from "../domain/math-outcome";
import { formatNumericResult } from "../math/evaluate";

type ResultViewProps = {
  outcome: MathOutcome<number> | null;
};

export function ResultView({ outcome }: ResultViewProps) {
  if (!outcome) {
    return <p className="result-view__empty">Введите выражение и запустите вычисление.</p>;
  }
  if (!outcome.ok) {
    return (
      <div className="result-view result-view--error" role="alert">
        <strong>Не удалось вычислить</strong>
        <p>{outcome.message}</p>
      </div>
    );
  }

  return (
    <section className="result-view" aria-label="Результат" aria-live="polite">
      <p className="result-view__status">
        {outcome.status === "exact" ? "Точный результат" : "Приближённое значение"}
      </p>
      <output className="result-view__value">
        {outcome.status === "approximate" ? "≈ " : ""}
        {formatNumericResult(outcome.value)}
      </output>
      {outcome.steps.length > 0 && (
        <ol className="result-view__steps">
          {outcome.steps.map((step, index) => (
            <li key={`${step.expression ?? step.title}-${index}`}>
              {step.expression && <code>{step.expression}</code>}
              <span>{step.explanation}</span>
            </li>
          ))}
        </ol>
      )}
      {outcome.notes.map((note) => <p key={note}>{note}</p>)}
    </section>
  );
}
