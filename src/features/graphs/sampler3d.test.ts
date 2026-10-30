import { describe, expect, it } from "vitest";
import {
  DEFAULT_GRAPH3D_RESOLUTION,
  sample3D,
  type Graph3DRange,
} from "./sampler3d";

const range: Graph3DRange = {
  xMin: -1,
  xMax: 1,
  yMin: -1,
  yMax: 1,
  resolution: 3,
};

describe("sample3D", () => {
  it("samples a surface as rows of z=f(x,y) values", () => {
    const result = sample3D("x+y", range);

    expect(result).toMatchObject({ ok: true, status: "approximate" });
    if (result.ok) {
      expect(result.value).toHaveLength(3);
      expect(result.value[0]).toEqual([
        { x: -1, y: -1, z: -2 },
        { x: 0, y: -1, z: -1 },
        { x: 1, y: -1, z: 0 },
      ]);
      expect(result.value[1][1]).toEqual({ x: 0, y: 0, z: 0 });
    }
  });

  it("marks invalid-domain samples as holes in the surface", () => {
    const result = sample3D("sqrt(x)", range);

    expect(result.ok && result.value[0][0]).toBeNull();
    expect(result.ok && result.value[0][2]).toEqual({ x: 1, y: -1, z: 1 });
  });

  it("rejects a surface with no valid real-valued samples", () => {
    expect(sample3D("sqrt(-1)", range)).toMatchObject({
      ok: false,
      code: "domain-error",
    });
  });

  it.each([
    [{ ...range, xMin: 1, xMax: -1 }],
    [{ ...range, yMin: 2, yMax: 2 }],
    [{ ...range, xMin: Number.NaN }],
    [{ ...range, resolution: 1 }],
  ])("rejects invalid ranges or resolution: %o", (invalidRange) => {
    expect(sample3D("x+y", invalidRange as Graph3DRange)).toMatchObject({
      ok: false,
      code: "invalid-range",
    });
  });

  it("defaults the renderer to 64 samples per side", () => {
    expect(DEFAULT_GRAPH3D_RESOLUTION).toBe(64);
  });

  it("allows the maximum resolution and rejects a larger request", () => {
    const maximum = sample3D("0", { ...range, resolution: 128 });

    expect(maximum.ok && maximum.value).toHaveLength(128);
    expect(maximum.ok && maximum.value[127]).toHaveLength(128);
    expect(sample3D("0", { ...range, resolution: 129 })).toMatchObject({
      ok: false,
      code: "resource-limit",
    });
  });
});
