import { useState } from "react";
import type { FeatureKind, NavigationTarget } from "../domain/feature";
import { CalculatorView } from "../features/calculator/CalculatorView";
import { AlgebraView } from "../features/algebra/AlgebraView";
import { EquationView } from "../features/equations/EquationView";
import { CalculusView } from "../features/calculus/CalculusView";
import { Graph2DView } from "../features/graphs/Graph2DView";
import { HistoryView } from "../features/history/HistoryView";
import { historyStore } from "../storage/history-store";
import { featureLabels, navigationItems } from "./feature-registry";

export function AppShell() {
  const [active, setActive] = useState<NavigationTarget>("calculator");
  const [restoredInput, setRestoredInput] = useState("");

  const restore = ({ feature, input }: { feature: FeatureKind; input: string }) => {
    setRestoredInput(input);
    setActive(feature);
  };

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-header__mark" aria-hidden="true">∑</div>
        <div>
          <h1>Математический прибор</h1>
          <p>Вычисления останутся на этом устройстве</p>
        </div>
      </header>
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
        {active === "calculator" && <CalculatorView initialInput={restoredInput} store={historyStore} />}
        {active === "algebra" && <AlgebraView initialInput={restoredInput} store={historyStore} />}
        {active === "equations" && <EquationView initialInput={restoredInput} store={historyStore} />}
        {active === "calculus" && <CalculusView initialInput={restoredInput} store={historyStore} />}
        {active === "graph2d" && <Graph2DView initialInput={restoredInput || "x^2"} store={historyStore} />}
        {active === "history" && <HistoryView store={historyStore} onRestore={restore} />}
        {active !== "calculator" && active !== "algebra" && active !== "equations" && active !== "calculus" && active !== "graph2d" && active !== "history" && (
          <section className="feature-placeholder">
            <div className="feature-heading">
              <h2>{featureLabels[active]}</h2>
            </div>
            <p>Этот инструмент подключается следующим этапом разработки.</p>
          </section>
        )}
      </div>
    </main>
  );
}
