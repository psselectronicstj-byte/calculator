import nerdamer from "nerdamer";

function toEngineExpression(expression: string): string {
  return expression
    .replace(/\bln\s*\(/g, "__NATURAL_LOG__(")
    .replace(/\blog\s*\(/g, "log10(")
    .replace(/__NATURAL_LOG__\(/g, "log(");
}

function fromEngineExpression(expression: string): string {
  return expression
    .replace(/\blog10\s*\(/g, "__BASE_TEN_LOG__(")
    .replace(/\blog\s*\(/g, "ln(")
    .replace(/__BASE_TEN_LOG__\(/g, "log(");
}

function asExpression(value: ReturnType<typeof nerdamer>) {
  if (!nerdamer.classes.Expression.isExpression(value)) {
    throw new Error("Символьный движок вернул неподдерживаемый тип результата.");
  }
  return value;
}

export function differentiateSymbolically(expression: string, variable: string): string {
  const parsed = asExpression(nerdamer(toEngineExpression(expression)));
  return fromEngineExpression(parsed.diff(variable).simplify().text({ sort: true }));
}

export function antidifferentiateSymbolically(expression: string, variable: string): string | null {
  const parsed = asExpression(nerdamer(toEngineExpression(expression)));
  const antiderivative = parsed.integrate(variable);
  if (antiderivative.hasIntegral()) {
    return null;
  }
  return fromEngineExpression(antiderivative.simplify().text({ sort: true }));
}

export function integrateDefiniteSymbolically(
  expression: string,
  variable: string,
  lower: number,
  upper: number,
): string | null {
  const parsed = asExpression(nerdamer(toEngineExpression(expression)));
  const antiderivative = parsed.integrate(variable);
  if (antiderivative.hasIntegral()) {
    return null;
  }
  const upperValue = antiderivative.subst(variable, upper);
  const lowerValue = antiderivative.subst(variable, lower);
  const result = upperValue.subtract(lowerValue).simplify();
  if (result.hasIntegral()) {
    return null;
  }
  return fromEngineExpression(result.text({ sort: true }));
}
