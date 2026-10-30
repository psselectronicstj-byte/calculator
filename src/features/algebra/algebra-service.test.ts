import { describe, expect, it } from "vitest";
import { transformExpression } from "./algebra-service";

describe("transformExpression", () => {
  it("normalizes input and simplifies supported expressions", () => {
    expect(transformExpression("2x+3x", "simplify")).toMatchObject({
      ok: true,
      status: "exact",
      value: "5*x",
    });
  });

  it("returns an explicit result for each supported transformation", () => {
    expect(transformExpression("(x+1)^2", "expand")).toMatchObject({
      ok: true,
      value: "x^2+2*x+1",
    });
    expect(transformExpression("x^2-1", "factor")).toMatchObject({ ok: true });
    expect(transformExpression("y=x+2", "solve-for", "x")).toMatchObject({
      ok: true,
      value: expect.stringContaining("y-2"),
    });
  });

  it("warns when cancellation may change the original domain", () => {
    const result = transformExpression("(x^2-1)/(x-1)", "simplify");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("x+1");
      expect(result.notes.join(" ")).toMatch(/област[ьи] определ/i);
    }
  });

  it("rejects malformed or unsupported expressions", () => {
    expect(transformExpression("x+alert()", "simplify")).toMatchObject({
      ok: false,
      code: "invalid-input",
    });
    expect(transformExpression("x+1", "solve-for")).toMatchObject({
      ok: false,
      code: "invalid-input",
    });
  });
});
