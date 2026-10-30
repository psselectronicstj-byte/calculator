import type { MathNode } from "mathjs";
import {
  approximate,
  exact,
  failure,
  type CalculationStep,
  type MathOutcome,
} from "../domain/math-outcome";
import { parseExpression } from "./expression/parse";

export type AngleMode = "radians" | "degrees";

type Evaluated = {
  value: number;
  exact: boolean;
};

class CalculationError extends Error {
  constructor(message: string, readonly code: "invalid-input" | "domain-error" = "domain-error") {
    super(message);
    this.name = "CalculationError";
  }
}

type NodeLike = MathNode & Record<string, unknown>;

function isNodeLike(node: MathNode): node is NodeLike {
  return typeof node === "object" && node !== null;
}

export function formatNumericResult(value: number): string {
  if (Object.is(value, -0)) {
    return "0";
  }
  if (Number.isSafeInteger(value)) {
    return String(value);
  }
  return String(Number(value.toPrecision(15)));
}

function formatExpression(expression: string): string {
  return expression.replace(/\s+/g, "");
}

function requireFinite(value: number): number {
  if (!Number.isFinite(value)) {
    throw new CalculationError("Результат не является конечным числом.");
  }
  return Object.is(value, -0) ? 0 : value;
}

function calculate(
  node: MathNode,
  angleMode: AngleMode,
  steps: CalculationStep[],
  variables: ReadonlyMap<string, number>,
): Evaluated {
  if (!isNodeLike(node)) {
    throw new CalculationError("Не удалось вычислить выражение.");
  }

  if (node.type === "ConstantNode" && typeof node.value === "number") {
    return { value: requireFinite(node.value), exact: Number.isSafeInteger(node.value) };
  }

  const name = symbolName(node);
  if (name) {
    if (name === "pi") {
      return { value: Math.PI, exact: false };
    }
    if (name === "e") {
      return { value: Math.E, exact: false };
    }
    const value = variables.get(name);
    if (value !== undefined) {
      return { value: requireFinite(value), exact: false };
    }
    throw new CalculationError(`Переменная ${name} не задана.`, "invalid-input");
  }

  if (node.type === "ParenthesisNode" && isMathNode(node.content)) {
    return calculate(node.content, angleMode, steps, variables);
  }

  if (node.type === "OperatorNode" && typeof node.op === "string" && Array.isArray(node.args)) {
    const args = node.args;
    const first = args[0];
    if (!isMathNode(first)) {
      throw new CalculationError("Некорректный операнд.");
    }
    const left = calculate(first, angleMode, steps, variables);
    let result: number;
    let isExact = false;

    if (args.length === 1 && node.op === "-") {
      result = -left.value;
      isExact = left.exact && Number.isSafeInteger(result);
    } else if (args.length === 1 && node.op === "+") {
      return left;
    } else if (args.length === 2) {
      const second = args[1];
      if (!isMathNode(second)) {
        throw new CalculationError("Некорректный операнд.");
      }
      const right = calculate(second, angleMode, steps, variables);
      switch (node.op) {
        case "+":
          result = left.value + right.value;
          isExact = left.exact && right.exact && Number.isSafeInteger(result);
          break;
        case "-":
          result = left.value - right.value;
          isExact = left.exact && right.exact && Number.isSafeInteger(result);
          break;
        case "*":
          result = left.value * right.value;
          isExact = left.exact && right.exact && Number.isSafeInteger(result);
          break;
        case "/":
          if (right.value === 0) {
            throw new CalculationError("На ноль делить нельзя.");
          }
          result = left.value / right.value;
          break;
        case "^":
          result = left.value ** right.value;
          isExact = left.exact && right.exact && Number.isSafeInteger(result);
          break;
        default:
          throw new CalculationError("Этот оператор не поддерживается.");
      }
    } else {
      throw new CalculationError("Некорректное количество операндов.");
    }

    result = requireFinite(result);
    steps.push({
      title: "Вычисление",
      expression: `${formatExpression(node.toString())} = ${formatNumericResult(result)}`,
      explanation: "Выполняем операцию над значениями предыдущего шага.",
    });
    return { value: result, exact: isExact };
  }

  const functionName = node.type === "FunctionNode" ? symbolName(node.fn) : null;
  if (functionName && Array.isArray(node.args) && node.args.length === 1) {
    const argumentNode = node.args[0];
    if (!isMathNode(argumentNode)) {
      throw new CalculationError("Некорректный аргумент функции.");
    }
    const argument = calculate(argumentNode, angleMode, steps, variables);
    const radians = angleMode === "degrees" ? argument.value * Math.PI / 180 : argument.value;
    let result: number;

    switch (functionName) {
      case "sin":
        result = Math.sin(radians);
        break;
      case "cos":
        result = Math.cos(radians);
        break;
      case "tan":
        if (Math.abs(Math.cos(radians)) < 1e-12) {
          throw new CalculationError("Тангенс не определён для этого угла.");
        }
        result = Math.tan(radians);
        break;
      case "sqrt":
        if (argument.value < 0) {
          throw new CalculationError("Корень из отрицательного числа не является действительным.");
        }
        result = Math.sqrt(argument.value);
        break;
      case "abs":
        result = Math.abs(argument.value);
        break;
      case "log":
        if (argument.value <= 0) {
          throw new CalculationError("Логарифм определён только для положительных чисел.");
        }
        result = Math.log10(argument.value);
        break;
      case "ln":
        if (argument.value <= 0) {
          throw new CalculationError("Натуральный логарифм определён только для положительных чисел.");
        }
        result = Math.log(argument.value);
        break;
      default:
        throw new CalculationError("Эта функция не поддерживается.");
    }

    result = requireFinite(result);
    steps.push({
      title: `Функция ${functionName}`,
      expression: `${formatExpression(node.toString())} = ${formatNumericResult(result)}`,
      explanation: angleMode === "degrees" && ["sin", "cos", "tan"].includes(functionName)
        ? "Вычисляем значение в градусах."
        : "Вычисляем значение функции.",
    });
    return { value: result, exact: false };
  }

  throw new CalculationError("Этот вид выражения не поддерживается.");
}

function isMathNode(value: unknown): value is MathNode {
  return typeof value === "object" && value !== null && "type" in value && "toString" in value;
}

function symbolName(value: unknown): string | null {
  if (isMathNode(value) && value.type === "SymbolNode" && "name" in value && typeof value.name === "string") {
    return value.name;
  }
  return null;
}

export function evaluateScientific(
  input: string,
  angleMode: AngleMode,
): MathOutcome<number> {
  const parsed = parseExpression(input, { allowVariables: false });
  if (!parsed.ok) {
    return parsed;
  }

  return evaluateParsedNode(parsed.value.node, angleMode, new Map());
}

export function evaluateScientificAt(
  input: string,
  variable: string,
  value: number,
): MathOutcome<number> {
  if (!/^[a-z]$/.test(variable) || variable === "e" || !Number.isFinite(value)) {
    return failure("invalid-input", "Укажите одну переменную и конечное числовое значение.");
  }
  const parsed = parseExpression(input, { allowVariables: true });
  if (!parsed.ok) {
    return parsed;
  }
  return evaluateParsedNode(parsed.value.node, "radians", new Map([[variable, value]]));
}

function evaluateParsedNode(
  node: MathNode,
  angleMode: AngleMode,
  variables: ReadonlyMap<string, number>,
): MathOutcome<number> {
  const steps: CalculationStep[] = [];
  try {
    const result = calculate(node, angleMode, steps, variables);
    return result.exact
      ? exact(result.value, steps)
      : approximate(result.value, steps);
  } catch (error) {
    if (error instanceof CalculationError) {
      return failure(error.code, error.message);
    }
    throw error;
  }
}
