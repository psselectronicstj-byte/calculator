import { useEffect, useRef, useState } from "react";
import type { HistoryEntry } from "../../domain/history-entry";
import { approximate, type MathOutcome } from "../../domain/math-outcome";
import { historyStore, type HistoryStore } from "../../storage/history-store";
import { GraphInputList } from "./GraphInputList";
import type { Graph3DPoint, Graph3DRange, GraphExpression } from "./graph-types";
import { DEFAULT_GRAPH3D_RESOLUTION, sample3D } from "./sampler3d";

type Graph3DViewProps = {
  initialInput?: string;
  store?: HistoryStore;
};

type Surface = {
  expression: GraphExpression;
  points: Array<Array<Graph3DPoint | null>>;
};

type Plot = {
  range: Graph3DRange;
  surfaces: Surface[];
};

type ViewControls = {
  rotate: (horizontal: number, vertical: number) => void;
  pan: (horizontal: number, vertical: number) => void;
  zoom: (factor: number) => void;
};

const canvasWidth = 720;
const canvasHeight = 420;
const colors = ["#79d7a4", "#86b6ff", "#ffba78", "#d9a1ff", "#ff8e9b"];

function initialExpressions(input: string): GraphExpression[] {
  return input.split(";").map((expression, index) => ({
    id: crypto.randomUUID(),
    expression: expression.trim(),
    color: colors[index % colors.length],
  }));
}

function errorText(error: unknown): string {
  return error instanceof Error ? error.message : "Не удалось создать WebGL-сцену.";
}

function sampleSurfaces(
  expressions: GraphExpression[],
  range: Graph3DRange,
): MathOutcome<Surface[]> {
  const surfaces: Surface[] = [];
  for (const expression of expressions) {
    const sampled = sample3D(expression.expression, range);
    if (!sampled.ok) {
      return sampled;
    }
    surfaces.push({ expression, points: sampled.value });
  }
  return approximate(surfaces);
}

function surfaceGeometry(
  three: typeof import("three"),
  points: Surface["points"],
  range: Graph3DRange,
  zMinimum: number,
  zMaximum: number,
) {
  const positions = new Float32Array(range.resolution * range.resolution * 3);
  const indices: number[] = [];
  const hasPoint: boolean[] = [];
  const zSpan = zMaximum - zMinimum;

  for (let row = 0; row < range.resolution; row += 1) {
    for (let column = 0; column < range.resolution; column += 1) {
      const index = row * range.resolution + column;
      const point = points[row][column];
      hasPoint[index] = point !== null;
      if (!point) {
        continue;
      }
      positions[index * 3] = ((point.x - range.xMin) / (range.xMax - range.xMin) - 0.5) * 10;
      positions[index * 3 + 1] = zSpan === 0 ? 0 : ((point.z - zMinimum) / zSpan - 0.5) * 8;
      positions[index * 3 + 2] = ((point.y - range.yMin) / (range.yMax - range.yMin) - 0.5) * 10;
    }
  }

  for (let row = 0; row < range.resolution - 1; row += 1) {
    for (let column = 0; column < range.resolution - 1; column += 1) {
      const topLeft = row * range.resolution + column;
      const topRight = topLeft + 1;
      const bottomLeft = topLeft + range.resolution;
      const bottomRight = bottomLeft + 1;
      if ([topLeft, topRight, bottomLeft, bottomRight].every((index) => hasPoint[index])) {
        indices.push(topLeft, bottomLeft, topRight, topRight, bottomLeft, bottomRight);
      }
    }
  }

  const geometry = new three.BufferGeometry();
  geometry.setAttribute("position", new three.BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function pointBounds(surfaces: Surface[]) {
  let minimum = Number.POSITIVE_INFINITY;
  let maximum = Number.NEGATIVE_INFINITY;
  for (const surface of surfaces) {
    for (const row of surface.points) {
      for (const point of row) {
        if (point) {
          minimum = Math.min(minimum, point.z);
          maximum = Math.max(maximum, point.z);
        }
      }
    }
  }
  return { minimum, maximum };
}

export function Graph3DView({ initialInput = "x+y", store = historyStore }: Graph3DViewProps) {
  const [expressions, setExpressions] = useState(() => initialExpressions(initialInput));
  const [range, setRange] = useState<Graph3DRange>({
    xMin: -5,
    xMax: 5,
    yMin: -5,
    yMax: 5,
    resolution: DEFAULT_GRAPH3D_RESOLUTION,
  });
  const [plot, setPlot] = useState<Plot | null>(null);
  const [plotError, setPlotError] = useState<string | null>(null);
  const [renderError, setRenderError] = useState<string | null>(null);
  const [storageError, setStorageError] = useState<string | null>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const controlsRef = useRef<ViewControls | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!plot || !canvas) {
      return;
    }

    let active = true;
    let contextLost = false;
    let renderer: import("three").WebGLRenderer | null = null;
    let scene: import("three").Scene | null = null;
    let camera: import("three").PerspectiveCamera | null = null;
    let cleanup = () => {
      renderer?.dispose();
      scene?.clear();
    };
    const onContextLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      setRenderError("Контекст WebGL потерян. Перестройте поверхность или продолжайте работу в других разделах.");
    };
    const onContextRestored = () => {
      setRenderError("Контекст WebGL восстановлен. Постройте поверхность ещё раз.");
    };
    canvas.addEventListener("webglcontextlost", onContextLost);
    canvas.addEventListener("webglcontextrestored", onContextRestored);
    setRenderError(null);

    void import("three").then((three) => {
      if (!active || contextLost) {
        return;
      }
      try {
        renderer = new three.WebGLRenderer({ canvas, antialias: true, alpha: false });
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
        renderer.setSize(canvasWidth, canvasHeight, false);
        scene = new three.Scene();
        scene.background = new three.Color("#101713");
        cleanup = () => {
          scene?.traverse((object) => {
            if (object instanceof three.Mesh || object instanceof three.Line) {
              object.geometry.dispose();
              const materials = Array.isArray(object.material) ? object.material : [object.material];
              materials.forEach((material) => material.dispose());
            }
          });
          renderer?.dispose();
          scene?.clear();
          controlsRef.current = null;
        };
        camera = new three.PerspectiveCamera(42, canvasWidth / canvasHeight, 0.1, 200);
        scene.add(new three.AxesHelper(5.5));
        scene.add(new three.AmbientLight(0xffffff, 1.8));
        const keyLight = new three.DirectionalLight(0xffffff, 2.2);
        keyLight.position.set(6, 12, 8);
        scene.add(keyLight);

        const bounds = pointBounds(plot.surfaces);
        for (const surface of plot.surfaces) {
          const geometry = surfaceGeometry(three, surface.points, plot.range, bounds.minimum, bounds.maximum);
          const material = new three.MeshStandardMaterial({
            color: surface.expression.color,
            side: three.DoubleSide,
            roughness: 0.62,
            metalness: 0.05,
            transparent: true,
            opacity: 0.88,
          });
          scene.add(new three.Mesh(geometry, material));
        }

        let yaw = Math.PI / 4;
        let pitch = Math.PI / 5;
        let distance = 16;
        const target = new three.Vector3(0, 0, 0);
        const render = () => {
          if (!renderer || !camera || !scene) {
            return;
          }
          const horizontal = distance * Math.cos(pitch);
          camera.position.set(
            target.x + horizontal * Math.sin(yaw),
            target.y + distance * Math.sin(pitch),
            target.z + horizontal * Math.cos(yaw),
          );
          camera.lookAt(target);
          renderer.render(scene, camera);
        };
        controlsRef.current = {
          rotate: (horizontal, vertical) => {
            yaw += horizontal;
            pitch = Math.max(-1.35, Math.min(1.35, pitch + vertical));
            render();
          },
          pan: (horizontal, vertical) => {
            target.x += horizontal;
            target.z += vertical;
            render();
          },
          zoom: (factor) => {
            distance = Math.max(6, Math.min(60, distance * factor));
            render();
          },
        };
        let drag: { x: number; y: number; pan: boolean } | null = null;
        const onPointerDown = (event: PointerEvent) => {
          drag = { x: event.clientX, y: event.clientY, pan: event.shiftKey || event.button === 2 };
          if (canvas.setPointerCapture) {
            canvas.setPointerCapture(event.pointerId);
          }
        };
        const onPointerMove = (event: PointerEvent) => {
          if (!drag) {
            return;
          }
          const deltaX = event.clientX - drag.x;
          const deltaY = event.clientY - drag.y;
          drag = { ...drag, x: event.clientX, y: event.clientY };
          if (drag.pan) {
            controlsRef.current?.pan(deltaX * 0.025, deltaY * 0.025);
          } else {
            controlsRef.current?.rotate(deltaX * 0.008, deltaY * 0.008);
          }
        };
        const stopDragging = () => {
          drag = null;
        };
        const onWheel = (event: WheelEvent) => {
          event.preventDefault();
          controlsRef.current?.zoom(event.deltaY > 0 ? 1.1 : 0.9);
        };
        const onContextMenu = (event: Event) => event.preventDefault();
        canvas.addEventListener("pointerdown", onPointerDown);
        canvas.addEventListener("pointermove", onPointerMove);
        canvas.addEventListener("pointerup", stopDragging);
        canvas.addEventListener("pointercancel", stopDragging);
        canvas.addEventListener("wheel", onWheel, { passive: false });
        canvas.addEventListener("contextmenu", onContextMenu);
        render();
        const disposeListeners = cleanup;
        cleanup = () => {
          canvas.removeEventListener("pointerdown", onPointerDown);
          canvas.removeEventListener("pointermove", onPointerMove);
          canvas.removeEventListener("pointerup", stopDragging);
          canvas.removeEventListener("pointercancel", stopDragging);
          canvas.removeEventListener("wheel", onWheel);
          canvas.removeEventListener("contextmenu", onContextMenu);
          disposeListeners();
        };
      } catch (error) {
        setRenderError(`WebGL недоступен: ${errorText(error)}. Остальные разделы приложения продолжают работать.`);
      }
    }).catch((error: unknown) => {
      if (active) {
        setRenderError(`Не удалось загрузить локальный модуль WebGL: ${errorText(error)}.`);
      }
    });

    return () => {
      active = false;
      canvas.removeEventListener("webglcontextlost", onContextLost);
      canvas.removeEventListener("webglcontextrestored", onContextRestored);
      cleanup();
      camera = null;
    };
  }, [plot]);

  const setBound = (key: keyof Graph3DRange, text: string) => {
    setRange((current) => ({ ...current, [key]: text.trim() === "" ? Number.NaN : Number(text) }));
  };

  const buildSurfaces = async () => {
    setPlotError(null);
    setRenderError(null);
    setStorageError(null);
    const activeExpressions = expressions.filter((item) => item.expression.trim() !== "");
    if (activeExpressions.length === 0) {
      setPlot(null);
      setPlotError("Введите хотя бы одно выражение поверхности.");
      return;
    }
    const sampled = sampleSurfaces(activeExpressions, range);
    if (!sampled.ok) {
      setPlot(null);
      setPlotError(sampled.message);
      return;
    }
    setPlot({ range, surfaces: sampled.value });

    const entry: HistoryEntry = {
      id: crypto.randomUUID(),
      feature: "graph3d",
      input: activeExpressions.map((item) => item.expression.trim()).join("; "),
      result: `Диапазоны x: ${range.xMin}…${range.xMax}, y: ${range.yMin}…${range.yMax}; разрешение: ${range.resolution}`,
      status: "approximate",
      createdAt: Date.now(),
    };
    try {
      await store.add(entry);
    } catch (error) {
      setStorageError(error instanceof Error ? error.message : "Не удалось сохранить поверхность в истории.");
    }
  };

  return (
    <section className="calculator graph-view" aria-labelledby="graph3d-title">
      <div className="feature-heading">
        <h2 id="graph3d-title">График 3D</h2>
        <p>Поверхность z = f(x, y); потяните её, чтобы повернуть</p>
      </div>
      <GraphInputList expressions={expressions} legend="Поверхности графика" onChange={setExpressions} />
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
        <label className="angle-select">
          <span>Проб на ось</span>
          <input
            aria-label="Разрешение поверхности"
            type="number"
            min={2}
            max={128}
            step={1}
            value={range.resolution}
            onChange={(event) => setBound("resolution", event.currentTarget.value)}
          />
        </label>
      </div>
      <div className="graph-controls" aria-label="Управление поверхностью">
        <button className="button button--quiet" type="button" aria-label="Повернуть влево" onClick={() => controlsRef.current?.rotate(-0.15, 0)}>↶</button>
        <button className="button button--quiet" type="button" aria-label="Повернуть вправо" onClick={() => controlsRef.current?.rotate(0.15, 0)}>↷</button>
        <button className="button button--quiet" type="button" aria-label="Сместить поверхность влево" onClick={() => controlsRef.current?.pan(-0.5, 0)}>←</button>
        <button className="button button--quiet" type="button" aria-label="Сместить поверхность вправо" onClick={() => controlsRef.current?.pan(0.5, 0)}>→</button>
        <button className="button button--quiet" type="button" aria-label="Увеличить поверхность" onClick={() => controlsRef.current?.zoom(0.9)}>+</button>
        <button className="button button--quiet" type="button" aria-label="Уменьшить поверхность" onClick={() => controlsRef.current?.zoom(1.1)}>−</button>
        <button className="button button--primary" type="button" onClick={() => void buildSurfaces()}>
          Построить поверхности
        </button>
      </div>
      {plotError && <p className="result-view--error" role="alert">{plotError}</p>}
      {renderError && <p className="result-view--error" role="alert">{renderError}</p>}
      {storageError && <p className="storage-error" role="alert">{storageError}</p>}
      <canvas
        ref={canvasRef}
        className="graph-canvas graph-canvas--3d"
        width={canvasWidth}
        height={canvasHeight}
        role="img"
        aria-label="Трёхмерная поверхность"
      />
      {plot && (
        <ul className="graph-legend" aria-label="Поверхности на графике">
          {plot.surfaces.map(({ expression }) => (
            <li key={expression.id}>
              <span className="graph-input-list__swatch" style={{ backgroundColor: expression.color }} aria-hidden="true" />
              <code>{expression.expression}</code>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
