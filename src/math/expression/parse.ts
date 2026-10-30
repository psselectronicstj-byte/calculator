import { parse as mathParse, type MathNode } from "mathjs";
import { failure, type MathOutcome } from "../../domain/math-outcome";

const functions = new Set(["sin", "cos", "tan", "log", "ln", "sqrt", "abs"]);
const constants = new Set(["pi", "e"]);
const operators = new Set(["+", "-", "*", "/", "^"]);
const maxExpressionLength = 512;
const maxTokens = 256;
const maxDepth = 64;

type Token =
  | { kind: "number"; text: string }
  | { kind: "identifier"; text: string }
  | { kind: "punctuation"; text: string };

export type ParsedExpression = {
  source: string;
  normalized: string;
  node: MathNode;
};

type ParseOptions = {
  allowVariables: boolean;
};

type NodeLike = MathNode & Record<string, unknown>;

function isNodeLike(node: MathNode): node is NodeLike {
  return typeof node === "object" && node !== null;
}

function tokenize(source: string): MathOutcome<Token[]> {
  if (source.length > maxExpressionLength) {
    return failure("resource-limit", "Выражение слишком длинное (максимум 512 символов).");
  }

  const tokens: Token[] = [];
  let index = 0;
  while (index < source.length) {
    const rest = source.slice(index);
    if (/^\s/.test(rest)) {
      index += rest.match(/^\s+/)![0].length;
      continue;
    }

    const number = rest.match(/^(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?/);
    if (number) {
      tokens.push({ kind: "number", text: number[0] });
      index += number[0].length;
    } else {
      const identifier = rest.match(/^[a-zA-Z][a-zA-Z0-9_]*/);
      if (identifier) {
        const text = identifier[0];
        if (text !== text.toLowerCase()) {
          return failure("invalid-input", "Используйте строчные латинские буквы для переменных и функций.");
        }
        tokens.push({ kind: "identifier", text });
        index += text.length;
      } else {
        const character = source[index];
        if (!"()+-*/^".includes(character)) {
          return failure("invalid-input", `Недопустимый символ: ${character}`);
        }
        tokens.push({ kind: "punctuation", text: character });
        index += 1;
      }
    }

    if (tokens.length > maxTokens) {
      return failure("resource-limit", "В выражении слишком много частей.");
    }
  }

  if (tokens.length === 0) {
    return failure("invalid-input", "Введите математическое выражение.");
  }
  return { ok: true, status: "exact", value: tokens, steps: [], notes: [] };
}

function validateNode(node: MathNode, allowVariables: boolean, depth = 0): string | null {
  if (depth > maxDepth) {
    return "Выражение слишком глубоко вложено.";
  }
  if (!isNodeLike(node)) {
    return "Не удалось прочитать выражение.";
  }

  if (node.type === "ConstantNode") {
    return typeof node.value === "number" ? null : "Разрешены только числовые значения.";
  }

  if (node.type === "SymbolNode") {
    const name = node.name;
    if (typeof name !== "string") {
      return "Некорректное имя переменной.";
    }
    if (constants.has(name)) {
      return null;
    }
    if (allowVariables && /^[a-z]$/.test(name)) {
      return null;
    }
    return `Неизвестное имя: ${name}`;
  }

  if (node.type === "ParenthesisNode") {
    const content = node.content;
    return isMathNode(content) ? validateNode(content, allowVariables, depth + 1) : "Некорректные скобки.";
  }

  if (node.type === "OperatorNode") {
    const op = node.op;
    const args = node.args;
    if (typeof op !== "string" || !operators.has(op) || !Array.isArray(args)) {
      return "Этот оператор не поддерживается.";
    }
    if ((args.length !== 1 && args.length !== 2) || (args.length === 1 && op !== "+" && op !== "-")) {
      return "Некорректное количество операндов.";
    }
    for (const child of args) {
      if (!isMathNode(child)) {
        return "Некорректный операнд.";
      }
      const error = validateNode(child, allowVariables, depth + 1);
      if (error) {
        return error;
      }
    }
    return null;
  }

  if (node.type === "FunctionNode") {
    const fn = node.fn;
    const args = node.args;
    const name = symbolName(fn);
    if (!name || !functions.has(name)) {
      return "Эта функция не поддерживается.";
    }
    if (!Array.isArray(args) || args.length !== 1 || !isMathNode(args[0])) {
      return "Функция должна принимать один аргумент.";
    }
    return validateNode(args[0], allowVariables, depth + 1);
  }

  return "Этот вид выражения не поддерживается.";
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

function startsValue(token: Token): boolean {
  return token.kind !== "punctuation" || token.text === "(";
}

function endsValue(token: Token): boolean {
  return token.kind === "number"
    || (token.kind === "identifier" && !functions.has(token.text))
    || token.text === ")";
}

function makeNormalized(tokens: Token[]): MathOutcome<string> {
  const output: string[] = [];
  for (let index = 0; index < tokens.length; index += 1) {
    const token = tokens[index];
    const previous = tokens[index - 1];
    if (previous && endsValue(previous) && startsValue(token)) {
      if (previous.kind === "number" && token.kind === "number") {
        return failure("invalid-input", "Разделённые пробелом числа нельзя считать одним выражением.");
      }
      if (!(previous.kind === "identifier" && functions.has(previous.text) && token.text === "(")) {
        output.push("*");
      }
    }
    output.push(token.text);
  }
  return { ok: true, status: "exact", value: output.join(""), steps: [], notes: [] };
}

export function parseExpression(
  input: string,
  options: ParseOptions,
): MathOutcome<ParsedExpression> {
  const tokenResult = tokenize(input);
  if (!tokenResult.ok) {
    return tokenResult;
  }

  const normalizedResult = makeNormalized(tokenResult.value);
  if (!normalizedResult.ok) {
    return normalizedResult;
  }

  for (let index = 0; index < tokenResult.value.length; index += 1) {
    const token = tokenResult.value[index];
    if (token.kind !== "identifier") {
      continue;
    }
    if (functions.has(token.text)) {
      if (tokenResult.value[index + 1]?.text !== "(") {
        return failure("invalid-input", `После функции ${token.text} нужны скобки.`);
      }
      continue;
    }
    if (!constants.has(token.text) && !(options.allowVariables && /^[a-z]$/.test(token.text))) {
      return failure("invalid-input", `Неизвестное имя: ${token.text}`);
    }
  }

  let node: MathNode;
  try {
    node = mathParse(normalizedResult.value);
  } catch (error) {
    if (error instanceof SyntaxError) {
      return failure("invalid-input", "Проверьте порядок чисел, знаков и скобок.");
    }
    throw error;
  }

  const validationError = validateNode(node, options.allowVariables);
  if (validationError) {
    return failure(
      validationError.startsWith("Выражение слишком") ? "resource-limit" : "invalid-input",
      validationError,
    );
  }

  return {
    ok: true,
    status: "exact",
    value: { source: input, normalized: normalizedResult.value, node },
    steps: [],
    notes: [],
  };
}
