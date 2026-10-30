import { describe, expect, it } from "vitest";
import { matrixOperation, solveMatrixSystem } from "./matrix-service";
import type { Matrix, MatrixOperation } from "./matrix-types";

describe("matrixOperation", () => {
  it("adds compatible matrices", () => {
    expect(matrixOperation("add", [[1, 2], [3, 4]], [[5, 6], [7, 8]])).toMatchObject({
      ok: true,
      value: [[6, 8], [10, 12]],
    });
  });

  it("multiplies compatible matrices", () => {
    expect(matrixOperation("multiply", [[1, 2], [3, 4]], [[5, 6], [7, 8]])).toMatchObject({
      ok: true,
      value: [[19, 22], [43, 50]],
    });
  });

  it("transposes a rectangular matrix", () => {
    expect(matrixOperation("transpose", [[1, 2], [3, 4], [5, 6]])).toMatchObject({
      ok: true,
      value: [[1, 3, 5], [2, 4, 6]],
    });
  });

  it("calculates determinant and inverse for square matrices", () => {
    expect(matrixOperation("determinant", [[1, 2], [3, 4]])).toMatchObject({
      ok: true,
      value: -2,
    });
    const inverse = matrixOperation("inverse", [[1, 2], [3, 4]]);

    expect(inverse.ok).toBe(true);
    if (inverse.ok) {
      expect(inverse.value).toEqual([[-2, 1], [1.5, -0.5]]);
    }
  });

  it("does not classify a valid inverse as singular because rows have different scales", () => {
    const inverse = matrixOperation("inverse", [[1e13, 0], [0, 1]]);

    expect(inverse.ok).toBe(true);
    if (inverse.ok) {
      expect(inverse.value).toMatchObject([
        [expect.closeTo(1e-13), expect.closeTo(0)],
        [expect.closeTo(0), expect.closeTo(1)],
      ]);
    }
  });

  it("computes rank and supported real eigenpairs", () => {
    expect(matrixOperation("rank", [[1, 2], [2, 4]])).toMatchObject({
      ok: true,
      value: 1,
      status: "approximate",
      notes: [expect.stringContaining("1e-12")],
    });
    const eigen = matrixOperation("eigen", [[2, 0], [0, 3]]);

    expect(eigen.ok).toBe(true);
    if (eigen.ok) {
      expect(eigen.value).toMatchObject({ values: [2, 3], vectors: [[1, 0], [0, 1]] });
    }
  });

  const incompatibleCases: Array<[MatrixOperation, Matrix, Matrix]> = [
    ["add", [[1, 2]], [[1]]],
    ["multiply", [[1, 2]], [[1, 2]]],
  ];

  it.each(incompatibleCases)("rejects incompatible dimensions for %s", (operation, left, right) => {
    expect(matrixOperation(operation, left, right)).toMatchObject({
      ok: false,
      code: "invalid-shape",
    });
  });

  const invalidMatrices: Array<{ matrix: Matrix }> = [
    { matrix: [[]] },
    { matrix: [[1, 2], [3]] },
  ];

  it.each(invalidMatrices)("rejects empty or ragged matrices: %o", ({ matrix }) => {
    expect(matrixOperation("transpose", matrix)).toMatchObject({
      ok: false,
      code: "invalid-shape",
    });
  });

  it("rejects non-numeric and non-finite matrix entries", () => {
    expect(matrixOperation("transpose", [[1, "2"] as unknown as number[]])).toMatchObject({
      ok: false,
      code: "invalid-input",
    });
    expect(matrixOperation("transpose", [[1, Number.POSITIVE_INFINITY]])).toMatchObject({
      ok: false,
      code: "invalid-input",
    });
  });

  it("rejects matrix operations that overflow to non-finite results", () => {
    expect(matrixOperation("add", [[1e308]], [[1e308]])).toMatchObject({
      ok: false,
      code: "domain-error",
    });
    expect(matrixOperation("multiply", [[1e308]], [[1e308]])).toMatchObject({
      ok: false,
      code: "domain-error",
    });
  });

  it.each(["determinant", "inverse", "eigen"] as const)("requires a square matrix for %s", (operation) => {
    expect(matrixOperation(operation, [[1, 2, 3], [4, 5, 6]])).toMatchObject({
      ok: false,
      code: "invalid-shape",
    });
  });

  it("classifies a singular inverse explicitly", () => {
    expect(matrixOperation("inverse", [[1, 2], [2, 4]])).toMatchObject({
      ok: false,
      code: "singular",
    });
  });

  it("does not claim real eigenpairs when eigenvalues are complex", () => {
    expect(matrixOperation("eigen", [[0, -1], [1, 0]])).toMatchObject({
      ok: false,
      code: "unsupported",
    });
  });

  it("rejects basic operations larger than 20 by 20", () => {
    const oversized = Array.from({ length: 21 }, () => Array<number>(21).fill(0));

    expect(matrixOperation("transpose", oversized)).toMatchObject({
      ok: false,
      code: "resource-limit",
    });
  });

  it("rejects eigenproblems larger than 10 by 10", () => {
    const oversized = Array.from({ length: 11 }, (_, row) => (
      Array.from({ length: 11 }, (_, column) => row === column ? 1 : 0)
    ));

    expect(matrixOperation("eigen", oversized)).toMatchObject({
      ok: false,
      code: "resource-limit",
    });
  });
});

describe("solveMatrixSystem", () => {
  it("solves a compatible matrix system using the shared equation solver", () => {
    expect(solveMatrixSystem([[2, 1], [1, 3]], [5, 6])).toMatchObject({
      ok: true,
      value: [1.8, 1.4],
    });
  });

  it("reports inconsistent and underdetermined matrix systems", () => {
    expect(solveMatrixSystem([[1, 1], [2, 2]], [2, 5])).toMatchObject({
      ok: false,
      code: "inconsistent",
    });
    expect(solveMatrixSystem([[1, 1]], [2])).toMatchObject({
      ok: false,
      code: "underdetermined",
    });
  });

  it("rejects constants with the wrong shape or non-finite values", () => {
    expect(solveMatrixSystem([[1, 1], [2, 2]], [1])).toMatchObject({
      ok: false,
      code: "invalid-shape",
    });
    expect(solveMatrixSystem([[1]], [Number.NaN])).toMatchObject({
      ok: false,
      code: "invalid-input",
    });
  });
});
