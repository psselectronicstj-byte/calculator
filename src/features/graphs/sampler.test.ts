import { describe, expect, it } from "vitest";
import { sample2D, type GraphRange } from "./sampler";

const range: GraphRange = { xMin: -1, xMax: 1, yMin: -4, yMax: 4 };

describe("sample2D", () => {
  it("samples linear and curved functions across the requested x range", () => {
    const line = sample2D("2x+1", range, 5);
    const curve = sample2D("x^2", range, 5);

    expect(line).toMatchObject({ ok: true, status: "approximate" });
    expect(curve).toMatchObject({ ok: true, status: "approximate" });
    if (line.ok && curve.ok) {
      expect(line.value.map((point) => point && [point.x, point.y])).toEqual([
        [-1, -1],
        [-0.5, 0],
        [0, 1],
        [0.5, 2],
        [1, 3],
      ]);
      expect(curve.value.map((point) => point?.y)).toEqual([1, 0.25, 0, 0.25, 1]);
    }
  });

  it("returns null path breaks for discontinuities and invalid domains", () => {
    const discontinuity = sample2D("1/x", range, 5);
    const invalidDomain = sample2D("sqrt(x)", range, 3);

    expect(discontinuity.ok && discontinuity.value[2]).toBeNull();
    expect(invalidDomain.ok && invalidDomain.value[0]).toBeNull();
  });

  it("turns non-finite samples into path breaks", () => {
    const result = sample2D("1/(x-x)", range, 4);

    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toHaveLength(4);
      expect(result.value.every((point) => point === null)).toBe(true);
    }
  });

  it.each([
    [{ ...range, xMin: 1, xMax: 1 }],
    [{ ...range, xMin: 2, xMax: -2 }],
    [{ ...range, yMin: 2, yMax: -2 }],
  ])("rejects invalid graph ranges: %o", (invalidRange) => {
    expect(sample2D("x", invalidRange as GraphRange, 10)).toMatchObject({
      ok: false,
      code: "invalid-range",
    });
  });

  it("allows at most 2000 samples and rejects larger requests", () => {
    const allowed = sample2D("x", range, 2000);

    expect(allowed.ok && allowed.value).toHaveLength(2000);
    expect(sample2D("x", range, 2001)).toMatchObject({
      ok: false,
      code: "resource-limit",
    });
  });

  it("rejects ranges that exceed the supported plotting span", () => {
    expect(sample2D("x", { ...range, xMin: -1_000_000, xMax: 1_000_000 }, 10)).toMatchObject({
      ok: false,
      code: "resource-limit",
    });
  });
});
