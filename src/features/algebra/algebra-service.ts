import type { MathNode } from "mathjs";
import { exact, failure, type MathOutcome } from "../../domain/math-outcome";
import { parseExpression } from "../../math/expression/parse";
import { normalizeExpression } from "../../math/expression/normalize";
import { runSymbolic, type SymbolicOperation } from "../../math/adapters/symbolic";

const constants = new Set(["pi", "e"]);
const functions = new Set(["sin", "cos", "tan", "log", "ln", "sqrt", "abs"]);

type NodeLike = MathNode & Record<string, unknown>;

function isNodeLike(node: MathNode): node is NodeLike {
  return typeof node === "object" && node !== null;
}

function isMathNode(value: unknown): value is MathNode {
  return typeof value === "object" && value !== null && "type" in value && "forEach" in value;
}

function normalizeInput(input: string, operation: SymbolicOperation): MathOutcome<string> {
  if (operation !== "solve-for" || !input.includes("=")) {
    return normalizeExpression(input);
  }
  const sides = input.split("=");
  if (sides.length !== 2) {
    return failure("invalid-input", "Уравнение должно содержать один знак равенства.");
  }
  const left = normalizeExpression(sides[0]);
  if (!left.ok) {
    return left;
  }
  const right = normalizeExpression(sides[1]);
  if (!right.ok) {
    return right;
  }
  return exact(`(${left.value})-(${right.value})`);
}

function hasVariableSymbol(node: MathNode): boolean {
  if (isNodeLike(node) && node.type === "SymbolNode" && typeof node.name === "string") {
    const name = node.name;
    return !constants.has(name) && !functions.has(name);
  }
  let containsVariable = false;
  node.forEach((child) => {
    if (!containsVariable && hasVariableSymbol(child)) {
      containsVariable = true;
    }
  });
  return containsVariable;
}

function hasVariableDenominator(node: MathNode): boolean {
  if (isNodeLike(node) && node.type === "OperatorNode" && node.op === "/" && Array.isArray(node.args)) {
    const denominator = node.args[1];
    if (isMathNode(denominator) && hasVariableSymbol(denominator)) {
      return true;
    }
  }
  let found = false;
  node.forEach((child) => {
    if (!found && hasVariableDenominator(child)) {
      found = true;
    }
  });
  return found;
}

function messageOf(error: unknown): string {
  return error instanceof Error ? error.message : "Не удалось выполнить символьное преобразование.";
}

export function transformExpression(
  input: string,
  operation: SymbolicOperation,
  variable?: string,
): MathOutcome<string> {
  if (operation === "solve-for" && (!variable || !/^[a-z]$/.test(variable) || variable === "e")) {
    return failure("invalid-input", "Укажите одну переменную для решения.");
  }

  const normalized = normalizeInput(input, operation);
  if (!normalized.ok) {
    return normalized;
  }
  const parsed = parseExpression(normalized.value, { allowVariables: true });
  if (!parsed.ok) {
    return parsed;
  }

  try {
    const result = runSymbolic(normalized.value, operation, variable);
    if (operation === "solve-for" && result === "{}") {
      return failure("no-solution", "Для этой переменной решений не найдено.");
    }
    const notes = ["Символьный движок не предоставляет проверяемую последовательность шагов для этой операции."];
    if (hasVariableDenominator(parsed.value.node)) {
      notes.push("Преобразование может изменить область определения исходного выражения; проверьте нули знаменателя.");
    }
    return exact(result, [], notes);
  } catch (error) {
    return failure("unsupported", `Символьное преобразование не поддерживается: ${messageOf(error)}`);
  }
}
