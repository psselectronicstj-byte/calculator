import { useCallback, useEffect, useState } from "react";
import type { FeatureKind } from "../../domain/feature";
import type { HistoryEntry } from "../../domain/history-entry";
import { historyStore, type HistoryStore } from "../../storage/history-store";

type HistoryViewProps = {
  onRestore: (item: HistoryEntry) => void;
  store?: HistoryStore;
};

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Не удалось загрузить локальную историю.";
}

function featureName(feature: FeatureKind): string {
  const names: Record<FeatureKind, string> = {
    calculator: "Калькулятор",
    algebra: "Алгебра",
    equations: "Уравнения",
    calculus: "Анализ",
    graph2d: "График 2D",
    graph3d: "График 3D",
    matrices: "Матрицы",
  };
  return names[feature];
}

export function HistoryView({ onRestore, store = historyStore }: HistoryViewProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      const current = await store.list();
      setEntries(current);
      setError(null);
    } catch (loadError) {
      setError(messageOf(loadError));
    }
  }, [store]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const removeEntry = async (id: string) => {
    try {
      await store.delete(id);
      await refresh();
    } catch (deleteError) {
      setError(messageOf(deleteError));
    }
  };

  const clearHistory = async () => {
    try {
      await store.clear();
      await refresh();
    } catch (clearError) {
      setError(messageOf(clearError));
    }
  };

  return (
    <section className="history" aria-labelledby="history-title">
      <div className="feature-heading">
        <h2 id="history-title">История</h2>
        <p>Записи хранятся только в этом браузере</p>
      </div>
      {error && <p className="storage-error" role="alert">{error}</p>}
      {error ? null : entries.length === 0 ? (
        <div className="history__empty">
          <p>История пока пуста.</p>
          <p>Выполните вычисление, чтобы сохранить его здесь.</p>
        </div>
      ) : (
        <>
          <ul className="history__list">
            {entries.map((entry) => (
              <li className="history__item" key={entry.id}>
                <div>
                  <p className="history__feature">{featureName(entry.feature)}</p>
                  <p className="history__input">{entry.input}</p>
                  <p className="history__result">{entry.result}</p>
                </div>
                <div className="history__actions">
                  <button
                    className="button button--quiet"
                    type="button"
                    aria-label={`Открыть ${entry.input}`}
                    onClick={() => onRestore(entry)}
                  >
                    Открыть
                  </button>
                  <button
                    className="button button--quiet"
                    type="button"
                    aria-label={`Удалить ${entry.input}`}
                    onClick={() => void removeEntry(entry.id)}
                  >
                    Удалить
                  </button>
                </div>
              </li>
            ))}
          </ul>
          <button className="button button--quiet history__clear" type="button" onClick={() => void clearHistory()}>
            Очистить историю
          </button>
        </>
      )}
    </section>
  );
}
