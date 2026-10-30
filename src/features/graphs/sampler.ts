import { approximate, failure, type MathOutcome } from "../../domain/math-outcome";
import { evaluateScientificAt } from "../../math/evaluate";
import type { GraphPoint, GraphRange } from "./graph-types";

const maximumSamples = 2000;
const maximumRangeSpan = 1_000_000;

export type { GraphRange } from "./graph-types";

export function sample2D(
  expression: string,
  range: GraphRange,
  width: number,
): MathOutcome<Array<GraphPoint | null>> {
  if (
    ![range.xMin, range.xMax, range.yMin, range.yMax].every(Number.isFinite)
    || range.xMin >= range.xMax
    || range.yMin >= range.yMax
  ) {
    return failure("invalid-range", "Задайте конечные возрастающие пределы для обеих осей.");
  }
  if (range.xMax - range.xMin > maximumRangeSpan || range.yMax - range.yMin > maximumRangeSpan) {
    return failure("resource-limit", `Диапазон оси не должен превышать ${maximumRangeSpan}.`);
  }
  if (!Number.isInteger(width) || width < 1) {
    return failure("invalid-range", "Ширина графика должна быть положительным целым числом.");
  }
  if (width > maximumSamples) {
    return failure("resource-limit", `Для одной функции разрешено не более ${maximumSamples} проб.`);
  }
  if (!expression.trim()) {
    return failure("invalid-input", "Введите выражение для построения графика.");
  }

  const points: Array<GraphPoint | null> = [];
  for (let index = 0; index < width; index += 1) {
    const fraction = width === 1 ? 0.5 : index / (width - 1);
    const x = range.xMin + (range.xMax - range.xMin) * fraction;
    const result = evaluateScientificAt(expression, "x", x);
    if (!result.ok) {
      if (result.code === "domain-error") {
        points.push(null);
        continue;
      }
      return result;
    }
    points.push(Number.isFinite(result.value) ? { x, y: result.value } : null);
  }

  return approximate(points, [], [
    "Точки графика рассчитаны численно; недопустимые и не конечные значения показаны разрывами.",
  ]);
}
