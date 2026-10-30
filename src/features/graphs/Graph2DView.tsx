import { useEffect, useRef, useState } from "react";
import type { HistoryEntry } from "../../domain/history-entry";
import { approximate, type MathOutcome } from "../../domain/math-outcome";
import { historyStore, type HistoryStore } from "../../storage/history-store";
import { GraphInputList } from "./GraphInputList";
import type { GraphExpression, GraphPoint, GraphRange } from "./graph-types";
import { sample2D } from "./sampler";

type Graph2DViewProps = {
  initialInput?: string;
  store?: HistoryStore;
};

type Plot = {
  range: GraphRange;
  functions: Array<{ expression: GraphExpression; points: Array<GraphPoint | null> }>;
};

const canvasWidth = 720;
const canvasHeight = 420;
const plotArea = { left: 52, top: 24, right: 700, bottom: 370 };

function initialExpressions(input: string): GraphExpression[] {
  const values = input.split(";").map((expression) => expression.trim());
  return values.length > 0
    ? values.map((expression, index) => ({
      id: crypto.randomUUID(),
      expression,
      color: ["#79d7a4", "#86b6ff", "#ffba78", "#d9a1ff", "#ff8e9b"][index % 5],
    }))
    : [{ id: crypto.randomUUID(), expression: "", color: "#79d7a4" }];
}

function drawPlot(context: CanvasRenderingContext2D, plot: Plot) {
  const { xMin, xMax, yMin, yMax } = plot.range;
  const toCanvasX = (x: number) => plotArea.left + ((x - xMin) / (xMax - xMin)) * (plotArea.right - plotArea.left);
  const toCanvasY = (y: number) => plotArea.bottom - ((y - yMin) / (yMax - yMin)) * (plotArea.bottom - plotArea.top);

  context.clearRect(0, 0, canvasWidth, canvasHeight);
  context.fillStyle = "#101713";
  context.fillRect(0, 0, canvasWidth, canvasHeight);
  context.strokeStyle = "#28362d";
  context.lineWidth = 1;
  context.fillStyle = "#98a89c";
  context.font = "12px system-ui, sans-serif";

  for (let division = 0; division <= 10; division += 1) {
    const x = plotArea.left + ((plotArea.right - plotArea.left) * division) / 10;
    const y = plotArea.top + ((plotArea.bottom - plotArea.top) * division) / 10;
    context.beginPath();
    context.moveTo(x, plotArea.top);
    context.lineTo(x, plotArea.bottom);
    context.stroke();
    context.beginPath();
    context.moveTo(plotArea.left, y);
    context.lineTo(plotArea.right, y);
    context.stroke();
    context.fillText(String(Number((xMin + ((xMax - xMin) * division) / 10).toPrecision(4))), x - 12, plotArea.bottom + 20);
    context.fillText(String(Number((yMax - ((yMax - yMin) * division) / 10).toPrecision(4))), 4, y + 4);
  }

  context.strokeStyle = "#607268";
  context.lineWidth = 1.5;
  if (yMin <= 0 && yMax >= 0) {
    context.beginPath();
    context.moveTo(plotArea.left, toCanvasY(0));
    context.lineTo(plotArea.right, toCanvasY(0));
    context.stroke();
    context.fillText("x", plotArea.right - 8, toCanvasY(0) - 7);
  }
  if (xMin <= 0 && xMax >= 0) {
    context.beginPath();
    context.moveTo(toCanvasX(0), plotArea.top);
    context.lineTo(toCanvasX(0), plotArea.bottom);
    context.stroke();
    context.fillText("y", toCanvasX(0) + 7, plotArea.top + 10);
  }

  context.save();
  context.beginPath();
  context.rect(plotArea.left, plotArea.top, plotArea.right - plotArea.left, plotArea.bottom - plotArea.top);
  context.clip();
  for (const { expression, points } of plot.functions) {
    context.beginPath();
    context.strokeStyle = expression.color;
    context.lineWidth = 2.5;
    let connected = false;
    for (const point of points) {
      if (point === null) {
        connected = false;
      } else {
        const x = toCanvasX(point.x);
        const y = toCanvasY(point.y);
        if (connected) {
          context.lineTo(x, y);
        } else {
          context.moveTo(x, y);
          connected = true;
        }
      }
    }
    context.stroke();
  }
  context.restore();
}

function errorMessage(outcome: MathOutcome<unknown>): string {
  return outcome.ok ? "" : outcome.message;
}

function sampleFunctions(
  expressions: GraphExpression[],
  range: GraphRange,
): MathOutcome<Plot["functions"]> {
  const functions: Plot["functions"] = [];
  for (const expression of expressions) {
    const sampled = sample2D(expression.expression, range, canvasWidth);
    if (!sampled.ok) {
      return sampled;
    }
    functions.push({ expression, points: sampled.value });
  }
  return approximate(functions);
}

export function Graph2DView({ initialInput = "x^2", store = historyStore }: Graph2DViewProps) {
  const [expressions, setExpressions] = useState(() => initialExpressions(initialInput));
  const [range, setRange] = useState<GraphRange>({ xMin: -10, xMax: 10, yMin: -10, yMax: 10 });
  const [plot, setPlot] = useState<Plot | null>(null);
  const [plotError, setPlotError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    if (!plot || !canvasRef.current) {
      return;
    }
    const context = canvasRef.current.getContext("2d");
    if (!context) {
      setRenderError("Canvas 2D недоступен. Проверьте поддержку графики в браузере.");
      return;
    }
    setRenderError(null);
    drawPlot(context, plot);
  }, [plot]);

  const setBound = (key: keyof GraphRange, text: string) => {
    const nextRange = { ...range, [key]: text.trim() === "" ? Number.NaN : Number(text) };
    updateRange(nextRange);
  };

  const updateRange = (nextRange: GraphRange) => {
    setRange(nextRange);
    if (!plot) {
      return;
    }
    const sampled = sampleFunctions(plot.functions.map(({ expression }) => expression), nextRange);
    if (!sampled.ok) {
      setPlot(null);
      setPlotError(sampled.message);
      return;
    }
    setPlot({ range: nextRange, functions: sampled.value });
  };

  const pan = (axis: "x" | "y", direction: number) => {
    const minKey = axis === "x" ? "xMin" : "yMin";
    const maxKey = axis === "x" ? "xMax" : "yMax";
    const min = range[minKey];
    const max = range[maxKey];
    const shift = (max - min) * 0.2 * direction;
    updateRange({ ...range, [minKey]: min + shift, [maxKey]: max + shift });
  };

  const zoom = (factor: number) => {
    const xCenter = (range.xMin + range.xMax) / 2;
    const yCenter = (range.yMin + range.yMax) / 2;
    const xHalf = (range.xMax - range.xMin) * factor / 2;
    const yHalf = (range.yMax - range.yMin) * factor / 2;
    updateRange({
      xMin: xCenter - xHalf,
      xMax: xCenter + xHalf,
      yMin: yCenter - yHalf,
      yMax: yCenter + yHalf,
    });
  };

  const buildGraph = async () => {
    setPlotError(null);
    setRenderError(null);
    setStorageError(null);
    const activeExpressions = expressions.filter((item) => item.expression.trim() !== "");
    if (activeExpressions.length === 0) {
      setPlot(null);
      setPlotError("Введите хотя бы одно выражение для построения графика.");
      return;
    }

    const sampled = sampleFunctions(activeExpressions, range);
    if (!sampled.ok) {
      setPlot(null);
      setPlotError(errorMessage(sampled));
      return;
    }
    const nextPlot = { range, functions: sampled.value };
    setPlot(nextPlot);

    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      feature: "graph2d",
      input: activeExpressions.map((item) => item.expression.trim()).join("; "),
      result: `Диапазон x: ${range.xMin}…${range.xMax}; y: ${range.yMin}…${range.yMax}`,
      status: "approximate",
      createdAt: Date.now(),
    };
    try {
      await store.add(entry);
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "Не удалось сохранить график в истории.");
    }
  };

  return (
    <section className="calculator graph-view" aria-labelledby="graph2d-title">
      <div className="feature-heading">
        <h2 id="graph2d-title">График 2D</h2>
        <p>Постройте одну или несколько функций y = f(x)</p>
      </div>
      <GraphInputList expressions={expressions} onChange={setExpressions} />
      <div className="calculator__controls">
        {([
          ["xMin", "Минимум x"],
          ["xMax", "Максимум x"],
          ["yMin", "Минимум y"],
          ["yMax", "Максимум y"],
        ] as const).map(([key, label]) => (
          <label className="angle-select" key={key}>
            <span>{label}</span>
            <input
              aria-label={label}
              type="number"
              step="any"
              value={Number.isFinite(range[key]) ? range[key] : ""}
              onChange={(event) => setBound(key, event.currentTarget.value)}
            />
          </label>
        ))}
      </div>
      <div className="graph-controls" aria-label="Перемещение и масштаб графика">
        <button className="button button--quiet" type="button" aria-label="Сместить влево" onClick={() => pan("x", -1)}>←</button>
        <button className="button button--quiet" type="button" aria-label="Сместить вправо" onClick={() => pan("x", 1)}>→</button>
        <button className="button button--quiet" type="button" aria-label="Сместить вверх" onClick={() => pan("y", 1)}>↑</button>
        <button className="button button--quiet" type="button" aria-label="Сместить вниз" onClick={() => pan("y", -1)}>↓</button>
        <button className="button button--quiet" type="button" aria-label="Увеличить масштаб" onClick={() => zoom(0.8)}>+</button>
        <button className="button button--quiet" type="button" aria-label="Уменьшить масштаб" onClick={() => zoom(1.25)}>−</button>
        <button className="button button--primary" type="button" onClick={() => void buildGraph()}>
          Построить график
        </button>
      </div>
      {plotError && <p className="result-view--error" role="alert">{plotError}</p>}
      {renderError && <p className="result-view--error" role="alert">{renderError}</p>}
      {storageError && <p className="storage-error" role="alert">{storageError}</p>}
      <canvas
        ref={canvasRef}
        className="graph-canvas"
        width={canvasWidth}
        height={canvasHeight}
        role="img"
        aria-label="График функций"
      />
      {plot && (
        <>
          <output className="graph-range" aria-label="Текущий диапазон графика">
            x: [{plot.range.xMin}; {plot.range.xMax}], y: [{plot.range.yMin}; {plot.range.yMax}]
          </output>
          <ul className="graph-legend" aria-label="Функции на графике">
            {plot.functions.map(({ expression }) => (
              <li key={expression.id}>
                <span className="graph-input-list__swatch" style={{ backgroundColor: expression.color }} aria-hidden="true" />
                <code>{expression.expression}</code>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}
