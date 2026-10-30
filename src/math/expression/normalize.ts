import { failure, type MathOutcome } from "../../domain/math-outcome";
import { parseExpression } from "./parse";

export function normalizeExpression(input: string): MathOutcome<string> {
  const parsed = parseExpression(input, { allowVariables: true });
  if (!parsed.ok) {
    return parsed;
  }
  if (parsed.value.normalized.length === 0) {
    return failure("invalid-input", "Введите математическое выражение.");
  }
  return {
    ok: true,
    status: "exact",
    value: parsed.value.normalized,
    steps: [],
    notes: [],
  };
}
