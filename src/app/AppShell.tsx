import { lazy, Suspense, useEffect, useState } from "react";
import type { NavigationTarget } from "../domain/feature";
import type { HistoryEntry, HistoryRestoreData } from "../domain/history-entry";
import { historyStore } from "../storage/history-store";
import { featureLabels, navigationItems } from "./feature-registry";
import { registerServiceWorker } from "../pwa/register-service-worker";

const CalculatorView = lazy(() => import("../features/calculator/CalculatorView").then(({ CalculatorView }) => ({ default: CalculatorView })));
const AlgebraView = lazy(() => import("../features/algebra/AlgebraView").then(({ AlgebraView }) => ({ default: AlgebraView })));
const EquationView = lazy(() => import("../features/equations/EquationView").then(({ EquationView }) => ({ default: EquationView })));
const CalculusView = lazy(() => import("../features/calculus/CalculusView").then(({ CalculusView }) => ({ default: CalculusView })));
const Graph2DView = lazy(() => import("../features/graphs/Graph2DView").then(({ Graph2DView }) => ({ default: Graph2DView })));
const Graph3DView = lazy(() => import("../features/graphs/Graph3DView").then(({ Graph3DView }) => ({ default: Graph3DView })));
const MatricesView = lazy(() => import("../features/matrices/MatricesView").then(({ MatricesView }) => ({ default: MatricesView })));
const HistoryView = lazy(() => import("../features/history/HistoryView").then(({ HistoryView }) => ({ default: HistoryView })));

export function AppShell() {
  const [active, setActive] = useState<NavigationTarget>("calculator");
  const [restoredEntry, setRestoredEntry] = useState<HistoryEntry | null>(null);
  const [offline, setOffline] = useState(() => !navigator.onLine);
  const [registration, setRegistration] = useState<ServiceWorkerRegistration | null>(null);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [pwaError, setPwaError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;
    const updateNetworkState = () => setOffline(!navigator.onLine);
    window.addEventListener("online", updateNetworkState);
    window.addEventListener("offline", updateNetworkState);
    void registerServiceWorker(() => setUpdateAvailable(true))
      .then((nextRegistration) => {
        if (mounted) {
          setRegistration(nextRegistration);
        }
      })
      .catch((error: unknown) => {
        if (mounted) {
          const reason = error instanceof Error ? error.message : "Неизвестная ошибка регистрации.";
          setPwaError(`Не удалось включить автономный режим: ${reason}`);
        }
      });

    return () => {
      mounted = false;
      window.removeEventListener("online", updateNetworkState);
      window.removeEventListener("offline", updateNetworkState);
    };
  }, []);

  const restore = (entry: HistoryEntry) => {
    setRestoredEntry(entry);
    setActive(entry.feature);
  };

  const restoredEquationSystem = restoredEntry?.feature === "equations"
    && restoredEntry.restoreData?.kind === "equation-system"
    ? restoredEntry.restoreData
    : undefined;
  const restoredMatrixOperation: Extract<HistoryRestoreData, { kind: "matrix-operation" }> | undefined =
    restoredEntry?.feature === "matrices" && restoredEntry.restoreData?.kind === "matrix-operation"
      ? restoredEntry.restoreData
      : undefined;

  const activateUpdate = () => {
    const waitingWorker = registration?.waiting;
    if (!waitingWorker) {
      setUpdateAvailable(false);
      return;
    }

    navigator.serviceWorker.addEventListener("controllerchange", () => window.location.reload(), { once: true });
    waitingWorker.postMessage({ type: "SKIP_WAITING" });
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-header__mark" aria-hidden="true">∑</div>
        <div>
          <h1>Математический прибор</h1>
          <p>На iPhone: Safari → Поделиться → На экран «Домой»</p>
        </div>
      </header>
      {offline && <p className="app-status" role="status">Нет подключения. После первого запуска приложение работает офлайн.</p>}
      {pwaError && <p className="storage-error" role="alert">{pwaError}</p>}
      {updateAvailable && (
        <button className="button button--primary app-update" type="button" onClick={activateUpdate}>
          Обновить приложение
        </button>
      )}
      <nav className="app-nav" aria-label="Разделы приложения">
        {navigationItems.map(({ id, label }) => (
          <button
            key={id}
            className={`app-nav__item${active === id ? " app-nav__item--active" : ""}`}
            type="button"
            aria-current={active === id ? "page" : undefined}
            onClick={() => setActive(id)}
          >
            {label}
          </button>
        ))}
      </nav>
      <div className="app-content">
        <Suspense fallback={<p className="app-loading" role="status">Загрузка раздела…</p>}>
          {active === "calculator" && (
            <CalculatorView
              initialInput={restoredEntry?.feature === "calculator" ? restoredEntry.input : ""}
              store={historyStore}
            />
          )}
          {active === "algebra" && (
            <AlgebraView
              initialInput={restoredEntry?.feature === "algebra" ? restoredEntry.input : ""}
              store={historyStore}
            />
          )}
          {active === "equations" && (
            <EquationView
              initialInput={
                restoredEntry?.feature === "equations" && !restoredEquationSystem
                  ? restoredEntry.input
                  : ""
              }
              initialSystem={restoredEquationSystem}
              store={historyStore}
            />
          )}
          {active === "calculus" && (
            <CalculusView
              initialInput={restoredEntry?.feature === "calculus" ? restoredEntry.input : ""}
              store={historyStore}
            />
          )}
          {active === "graph2d" && (
            <Graph2DView
              initialInput={restoredEntry?.feature === "graph2d" ? restoredEntry.input : "x^2"}
              store={historyStore}
            />
          )}
          {active === "graph3d" && (
            <Graph3DView
              initialInput={restoredEntry?.feature === "graph3d" ? restoredEntry.input : "x+y"}
              store={historyStore}
            />
          )}
          {active === "matrices" && (
            <MatricesView
              initialInput={restoredEntry?.feature === "matrices" ? restoredEntry.input : "1, 2\n3, 4"}
              initialRestore={restoredMatrixOperation}
              store={historyStore}
            />
          )}
          {active === "history" && <HistoryView store={historyStore} onRestore={restore} />}
          {active !== "calculator" && active !== "algebra" && active !== "equations" && active !== "calculus" && active !== "graph2d" && active !== "graph3d" && active !== "matrices" && active !== "history" && (
            <section className="feature-placeholder">
              <div className="feature-heading">
                <h2>{featureLabels[active]}</h2>
              </div>
              <p>Этот инструмент подключается следующим этапом разработки.</p>
            </section>
          )}
        </Suspense>
      </div>
    </main>
  );
}
