import { describe, expect, it } from "vitest";
import { evaluateScientific } from "./calculator-service";

describe("evaluateScientific", () => {
  it("evaluates arithmetic with justified intermediate steps", () => {
    const outcome = evaluateScientific("2*(3+4)", "radians");

    expect(outcome).toMatchObject({ ok: true, status: "exact", value: 14 });
    if (outcome.ok) {
      expect(outcome.steps).toHaveLength(2);
      expect(outcome.steps[0].expression).toContain("3+4 = 7");
      expect(outcome.steps[1].expression).toContain("2*(3+4) = 14");
    }
  });

  it("evaluates scientific functions in radians and degrees", () => {
    expect(evaluateScientific("sin(pi/2)", "radians")).toMatchObject({
      ok: true,
      status: "approximate",
      value: 1,
    });
    expect(evaluateScientific("sin(90)", "degrees")).toMatchObject({
      ok: true,
      status: "approximate",
      value: 1,
    });
    expect(evaluateScientific("log(100)+ln(e)", "radians")).toMatchObject({
      ok: true,
      value: 3,
    });
    expect(evaluateScientific("sqrt(9)+abs(-3)", "radians")).toMatchObject({
      ok: true,
      value: 6,
    });
  });

  const failureCases: Array<[string, string, ("radians" | "degrees")?]> = [
    ["1/0", "domain-error"],
    ["sqrt(-1)", "domain-error"],
    ["ln(-1)", "domain-error"],
    ["tan(90)", "domain-error", "degrees"],
    ["1e309", "domain-error"],
    ["x+1", "invalid-input"],
    ["unknown(2)", "invalid-input"],
    ["2+", "invalid-input"],
  ];

  it.each(failureCases)("returns an explicit failure for %s", (input, code, angleMode = "radians") => {
    expect(evaluateScientific(input, angleMode)).toMatchObject({ ok: false, code });
  });

  it("marks floating-point arithmetic as approximate", () => {
    expect(evaluateScientific("0.1+0.2", "radians")).toMatchObject({
      ok: true,
      status: "approximate",
      value: 0.30000000000000004,
    });
  });
});
