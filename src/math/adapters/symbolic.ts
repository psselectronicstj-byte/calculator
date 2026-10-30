import nerdamer from "nerdamer";

export type SymbolicOperation = "simplify" | "expand" | "factor" | "solve-for";

function asExpression(value: ReturnType<typeof nerdamer>) {
  if (!nerdamer.classes.Expression.isExpression(value)) {
    throw new Error("Символьный движок вернул неподдерживаемый тип результата.");
  }
  return value;
}

export function solveSymbolically(expression: string, variable: string): string[] {
  const parsed = asExpression(nerdamer(expression));
  return parsed.solveFor(variable).elements.map((solution) => solution.simplify().text({ sort: true }));
}

export function runSymbolic(
  expression: string,
  operation: SymbolicOperation,
  variable?: string,
): string {
  if (operation === "solve-for") {
    if (!variable) {
      throw new Error("Для решения укажите переменную.");
    }
    return `{${solveSymbolically(expression, variable).join(", ")}}`;
  }

  const parsed = asExpression(nerdamer(expression));
  switch (operation) {
    case "simplify":
      return parsed.simplify().text({ sort: true });
    case "expand":
      return parsed.expand().text({ sort: true });
    case "factor":
      return parsed.factor().text({ sort: true });
  }
}
