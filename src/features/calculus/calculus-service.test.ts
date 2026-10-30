import { describe, expect, it } from "vitest";
import {
  antidifferentiate,
  differentiate,
  integrateDefinite,
} from "./calculus-service";

describe("differentiate", () => {
  it("differentiates polynomial and trigonometric expressions", () => {
    const result = differentiate("x^3+sin(x)", "x");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("3*x^2");
      expect(result.value).toContain("cos(x)");
      expect(result.status).toBe("exact");
    }
  });

  it("differentiates exponential and natural logarithmic forms", () => {
    expect(differentiate("e^x", "x")).toMatchObject({ ok: true, value: "e^x" });
    expect(differentiate("ln(x)", "x")).toMatchObject({ ok: true, value: "x^-1" });
  });

  it("preserves the calculator's base-ten meaning of log", () => {
    const result = differentiate("log(x)", "x");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toContain("ln(10)");
    }
  });
});

describe("antidifferentiate", () => {
  it("returns common symbolic antiderivatives", () => {
    expect(antidifferentiate("x^2", "x")).toMatchObject({
      ok: true,
      status: "exact",
      value: expect.stringContaining("x^3"),
    });
  });

  it("reports an unevaluated antiderivative as unsupported", () => {
    expect(antidifferentiate("sin(x^2)", "x")).toMatchObject({
      ok: false,
      code: "unsupported",
    });
  });
});

describe("integrateDefinite", () => {
  it("evaluates a supported definite integral symbolically", () => {
    expect(integrateDefinite("x^2", "x", 0, 1)).toMatchObject({
      ok: true,
      status: "exact",
      value: "1/3",
    });
  });

  it("uses adaptive numerical integration when no symbolic antiderivative is available", () => {
    const result = integrateDefinite("sin(x^2)", "x", 0, 1);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("approximate");
      expect(typeof result.value).toBe("number");
      if (typeof result.value === "number") {
        expect(result.value).toBeCloseTo(0.3102683017, 8);
      }
      expect(result.notes.join(" ")).toMatch(/Simpson/i);
      expect(result.notes.join(" ")).toContain("1e-8");
    }
  });

  it("supports reversed and equal bounds", () => {
    expect(integrateDefinite("x^2", "x", 1, 0)).toMatchObject({
      ok: true,
      status: "exact",
      value: "-1/3",
    });
    expect(integrateDefinite("x^2", "x", 2, 2)).toMatchObject({
      ok: true,
      status: "exact",
      value: "0",
    });
  });

  it("rejects invalid bounds and real-domain violations", () => {
    expect(integrateDefinite("x", "x", 0, Number.POSITIVE_INFINITY)).toMatchObject({
      ok: false,
      code: "invalid-range",
    });
    expect(integrateDefinite("sqrt(-x)", "x", 0, 1)).toMatchObject({
      ok: false,
      code: "domain-error",
    });
  });

  it("does not return a symbolic value across an interior denominator singularity", () => {
    expect(integrateDefinite("1/(x-0.125)", "x", 0, 1)).toMatchObject({
      ok: false,
      code: "domain-error",
    });
  });

  it("does not claim a symbolic definite integral across a tangent pole", () => {
    expect(integrateDefinite("tan(x)", "x", 1, 2)).toMatchObject({
      ok: false,
      code: "resource-limit",
      message: expect.stringContaining("4096"),
    });
  });
});
