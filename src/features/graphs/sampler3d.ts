import { approximate, failure, type MathOutcome } from "../../domain/math-outcome";
import { compileScientificEvaluator } from "../../math/evaluate";
import type { Graph3DPoint, Graph3DRange } from "./graph-types";

export const DEFAULT_GRAPH3D_RESOLUTION = 64;
export const MAXIMUM_GRAPH3D_RESOLUTION = 128;
const maximumRangeSpan = 1_000_000;

export type { Graph3DRange } from "./graph-types";

export function sample3D(
  expression: string,
  range: Graph3DRange,
): MathOutcome<Array<Array<Graph3DPoint | null>>> {
  if (
    ![range.xMin, range.xMax, range.yMin, range.yMax].every(Number.isFinite)
    || range.xMin >= range.xMax
    || range.yMin >= range.yMax
    || !Number.isInteger(range.resolution)
    || range.resolution < 2
  ) {
    return failure("invalid-range", "Задайте конечные возрастающие пределы и целое разрешение от 2.");
  }
  if (range.xMax - range.xMin > maximumRangeSpan || range.yMax - range.yMin > maximumRangeSpan) {
    return failure("resource-limit", `Диапазон оси не должен превышать ${maximumRangeSpan}.`);
  }
  if (range.resolution > MAXIMUM_GRAPH3D_RESOLUTION) {
    return failure(
      "resource-limit",
      `Для поверхности разрешено не более ${MAXIMUM_GRAPH3D_RESOLUTION} проб по каждой оси.`,
    );
  }
  if (!expression.trim()) {
    return failure("invalid-input", "Введите выражение z = f(x, y) для поверхности.");
  }

  const compiled = compileScientificEvaluator(expression, ["x", "y"]);
  if (!compiled.ok) {
    return compiled;
  }

  const grid: Array<Array<Graph3DPoint | null>> = [];
  let validPoints = 0;
  for (let row = 0; row < range.resolution; row += 1) {
    const yFraction = row / (range.resolution - 1);
    const y = range.yMin + (range.yMax - range.yMin) * yFraction;
    const points: Array<Graph3DPoint | null> = [];
    for (let column = 0; column < range.resolution; column += 1) {
      const xFraction = column / (range.resolution - 1);
      const x = range.xMin + (range.xMax - range.xMin) * xFraction;
      const result = compiled.value({ x, y });
      if (!result.ok) {
        if (result.code === "domain-error") {
          points.push(null);
          continue;
        }
        return result;
      }
      if (!Number.isFinite(result.value)) {
        points.push(null);
        continue;
      }
      points.push({ x, y, z: result.value });
      validPoints += 1;
    }
    grid.push(points);
  }
  if (validPoints === 0) {
    return failure("domain-error", "На заданном диапазоне нет допустимых действительных точек поверхности.");
  }

  return approximate(grid, [], [
    `Поверхность рассчитана численно на сетке ${range.resolution} × ${range.resolution}; недопустимые точки образуют отверстия.`,
  ]);
}
