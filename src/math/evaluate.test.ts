import { describe, expect, it } from "vitest";
import { compileScientificEvaluator } from "./evaluate";

describe("compileScientificEvaluator", () => {
  it("reuses the validated expression tree for multiple finite bindings", () => {
    const compiled = compileScientificEvaluator("x^2+y", ["x", "y"]);

    expect(compiled.ok).toBe(true);
    if (compiled.ok) {
      expect(compiled.value({ x: 2, y: 3 })).toMatchObject({ ok: true, value: 7 });
      expect(compiled.value({ x: 4, y: 3 })).toMatchObject({ ok: true, value: 19 });
    }
  });

  it("rejects undeclared variables, missing bindings, and non-finite bindings", () => {
    expect(compileScientificEvaluator("x+z", ["x"])).toMatchObject({
      ok: false,
      code: "invalid-input",
    });

    const compiled = compileScientificEvaluator("x+y", ["x", "y"]);
    expect(compiled.ok && compiled.value({ x: 1 })).toMatchObject({
      ok: false,
      code: "invalid-input",
    });
    expect(compiled.ok && compiled.value({ x: 1, y: Number.NaN })).toMatchObject({
      ok: false,
      code: "invalid-input",
    });
  });

  it("never interprets malformed input as executable code", () => {
    expect(compileScientificEvaluator("x+process", ["x"])).toMatchObject({
      ok: false,
      code: "invalid-input",
    });
  });
});
