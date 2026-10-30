import { describe, expect, it } from "vitest";
import nerdamer from "nerdamer";
import { all, create } from "mathjs";

const math = create(all);

describe("candidate math package compatibility", () => {
  it("parses, evaluates, and normalizes implicit multiplication", () => {
    expect(nerdamer("2+3").evaluate().text()).toBe("5");
    expect(nerdamer("2x").text()).toBe("2*x");
    expect(math.evaluate("2 + 3")).toBe(5);
    expect(math.evaluate("2 * x", { x: 4 })).toBe(8);
  });

  it("simplifies, expands, factors, and solves polynomial expressions", () => {
    expect(nerdamer.simplify("sin(x)^2+cos(x)^2").text()).toBe("1");
    expect(nerdamer("(x+1)^2").expand().text({ sort: true })).toBe("x^2+2*x+1");
    expect(nerdamer.factor("x^2-1").text()).toContain("x");
    expect(nerdamer.solve("x^2-4", "x").text()).toContain("2");
    expect(nerdamer.solve("y=x+2", "x").text()).toContain("y");
  });

  it("provides symbolic derivatives and common antiderivatives", () => {
    expect(nerdamer.diff("x^3+sin(x)", "x").text()).toContain("3*x^2");
    expect(nerdamer.integrate("x^2", "x").text()).toContain("x^3");
  });

  it("leaves unsupported antiderivatives unevaluated for the app to report", () => {
    expect(nerdamer.integrate("sin(x^2)", "x").text()).toContain("integrate(");
  });

  it("supports numerical sampling and matrix primitives", () => {
    const midpointIntegral = (from: number, to: number, steps: number) => {
      const width = (to - from) / steps;
      return Array.from({ length: steps }, (_, index) => {
        const value = math.evaluate("x^2", { x: from + (index + 0.5) * width });
        return typeof value === "number" ? value : Number(value);
      }).reduce((sum, value) => sum + value, 0) * width;
    };

    expect(midpointIntegral(0, 1, 1000)).toBeCloseTo(1 / 3, 5);
    expect(math.det([[1, 2], [3, 4]])).toBe(-2);
    const inverse = math.inv([[1, 0], [0, 2]]);
    expect(inverse.map((row) => row.map((value) => Object.is(value, -0) ? 0 : value))).toEqual([
      [1, 0],
      [0, 0.5],
    ]);
    expect("rank" in math).toBe(false);
    const eigen = math.eigs([[1, 0], [0, 2]]);
    const eigenValues = Array.isArray(eigen.values)
      ? eigen.values
      : math.flatten(eigen.values).toArray();
    expect([...eigenValues].map(Number).sort()).toEqual([1, 2]);
    expect(eigen.eigenvectors.map(({ vector }) => vector)).toEqual([[1, 0], [0, 1]]);
  });
});
