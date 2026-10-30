import { describe, expect, it } from "vitest";
import { runSymbolic } from "./symbolic";

describe("runSymbolic", () => {
  it("simplifies a polynomial expression", () => {
    expect(runSymbolic("x+x", "simplify")).toBe("2*x");
  });

  it("expands and factors polynomial expressions", () => {
    expect(runSymbolic("(x+1)^2", "expand")).toBe("x^2+2*x+1");
    expect(runSymbolic("x^2-1", "factor")).toMatch(/x/);
  });

  it("solves a normalized relation for a selected variable", () => {
    expect(runSymbolic("y-x-2", "solve-for", "x")).toContain("y-2");
  });
});
