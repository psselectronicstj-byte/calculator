import { describe, expect, it } from "vitest";
import { solveEquation, solveLinearSystem, solveRootsInInterval } from "./equation-service";

describe("solveEquation", () => {
  it("returns exact linear and quadratic roots", () => {
    expect(solveEquation("x+2=0", "x", "exact")).toMatchObject({
      ok: true,
      status: "exact",
      value: ["-2"],
    });
    expect(solveEquation("x^2-4=0", "x", "exact")).toMatchObject({
      ok: true,
      status: "exact",
      value: ["2", "-2"],
    });
  });

  it("returns a repeated root only once", () => {
    expect(solveEquation("x^2-2*x+1=0", "x", "exact")).toMatchObject({
      ok: true,
      value: ["1"],
    });
  });

  it("returns decimal approximations for irrational roots", () => {
    const result = solveEquation("x^2=2", "x", "decimal");

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("approximate");
      expect(result.value.map(Number).sort((a, b) => a - b)[0]).toBeCloseTo(-Math.sqrt(2), 8);
      expect(result.value.map(Number).sort((a, b) => a - b)[1]).toBeCloseTo(Math.sqrt(2), 8);
    }
  });

  it("distinguishes equations without real roots", () => {
    expect(solveEquation("x^2+1=0", "x", "exact")).toMatchObject({
      ok: false,
      code: "no-solution",
    });
  });

  it("classifies an identity equation as underdetermined", () => {
    expect(solveEquation("0=0", "x", "exact")).toMatchObject({
      ok: false,
      code: "underdetermined",
    });
  });

  it("does not present an incomplete trigonometric solution family as complete", () => {
    expect(solveEquation("sin(x)=0", "x", "exact")).toMatchObject({
      ok: false,
      code: "unsupported",
    });
    expect(solveEquation("cos(x)=1", "x", "exact")).toMatchObject({
      ok: false,
      code: "unsupported",
    });
  });

  it("rejects malformed equations", () => {
    expect(solveEquation("x=", "x", "exact")).toMatchObject({
      ok: false,
      code: "invalid-input",
    });
    expect(solveEquation("x=1=2", "x", "exact")).toMatchObject({
      ok: false,
      code: "invalid-input",
    });
  });
});

describe("solveLinearSystem", () => {
  it("solves a system with one unique solution", () => {
    const result = solveLinearSystem([[1, 1], [2, -1]], [3, 0]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]).toBeCloseTo(1);
      expect(result.value[1]).toBeCloseTo(2);
    }
  });

  it("uses a relative pivot tolerance for uniformly small coefficients", () => {
    const result = solveLinearSystem([[1e-20, 1e-20], [2e-20, -1e-20]], [3e-20, 0]);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value[0]).toBeCloseTo(1);
      expect(result.value[1]).toBeCloseTo(2);
    }
  });

  it("does not let a large right-hand side hide a valid pivot", () => {
    expect(solveLinearSystem([[1]], [1e13])).toMatchObject({
      ok: true,
      value: [1e13],
    });
  });

  it("solves systems whose rows have very different coefficient scales", () => {
    expect(solveLinearSystem([[1e13, 0], [0, 1]], [1e13, 1])).toMatchObject({
      ok: true,
      value: [1, 1],
    });
  });

  it("rejects systems larger than the supported dimension", () => {
    const coefficients = Array.from({ length: 21 }, (_, row) => (
      Array.from({ length: 21 }, (_, column) => row === column ? 1 : 0)
    ));

    expect(solveLinearSystem(coefficients, Array<number>(21).fill(1))).toMatchObject({
      ok: false,
      code: "resource-limit",
    });
  });

  it("classifies an inconsistent system", () => {
    expect(solveLinearSystem([[1, 1], [2, 2]], [2, 5])).toMatchObject({
      ok: false,
      code: "inconsistent",
    });
  });

  it("classifies an underdetermined system", () => {
    expect(solveLinearSystem([[1, 1]], [2])).toMatchObject({
      ok: false,
      code: "underdetermined",
    });
  });
});

describe("solveRootsInInterval", () => {
  it("returns residual-checked roots inside the interval with a finite-search note", () => {
    const result = solveRootsInInterval("x^2-2=0", "x", -2, 2);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.status).toBe("approximate");
      expect(result.value).toHaveLength(2);
      expect(result.value.every((root) => root >= -2 && root <= 2)).toBe(true);
      expect(result.value.map((root) => Math.abs(root * root - 2)).every((error) => error <= 1e-8)).toBe(true);
      expect(result.steps[0]?.expression).toBe("1024 подынтервала");
      expect(result.notes.join(" ")).toMatch(/1024|пропустить корни/i);
    }
  });

  it("rejects non-increasing intervals", () => {
    expect(solveRootsInInterval("x=0", "x", 1, 1)).toMatchObject({
      ok: false,
      code: "invalid-range",
    });
  });

  it("classifies an identity equation as having every interval point as a root", () => {
    expect(solveRootsInInterval("0=0", "x", -1, 1)).toMatchObject({
      ok: false,
      code: "underdetermined",
    });
  });
});
