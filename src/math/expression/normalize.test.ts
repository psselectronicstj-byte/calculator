import { describe, expect, it } from "vitest";
import { normalizeExpression } from "./normalize";

describe("normalizeExpression", () => {
  it.each([
    ["2(3+4)", "2*(3+4)"],
    ["2pi", "2*pi"],
    ["2x", "2*x"],
    ["2sin(pi/2)", "2*sin(pi/2)"],
  ])("inserts safe implicit multiplication in %s", (input, expected) => {
    expect(normalizeExpression(input)).toMatchObject({
      ok: true,
      status: "exact",
      value: expected,
    });
  });

  it.each(["2 + )", "sin(", "2 3", "evil(1)", "process.exit()", "1;alert(1)"])(
    "rejects malformed or unsupported syntax %s",
    (input) => {
      expect(normalizeExpression(input)).toMatchObject({
        ok: false,
        code: "invalid-input",
      });
    },
  );

  it("reports an oversized expression as a resource limit", () => {
    expect(normalizeExpression("1+".repeat(260))).toMatchObject({
      ok: false,
      code: "resource-limit",
    });
  });
});
