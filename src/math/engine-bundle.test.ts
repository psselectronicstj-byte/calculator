import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { build } from "vite";

describe("production math package bundling", () => {
  it("embeds CAS, numerical, and rendering packages without external imports", async () => {
    const result = await build({
      configFile: false,
      logLevel: "silent",
      build: {
        write: false,
        minify: false,
        lib: {
          entry: resolve("src/math/test-fixtures/engine-bundle-entry.ts"),
          formats: ["es"],
        },
      },
    });
    const outputs = Array.isArray(result) ? result : "output" in result ? [result] : [];
    const chunks = outputs.flatMap(({ output }) => output).filter((entry) => entry.type === "chunk");

    expect(chunks.length).toBeGreaterThan(0);
    expect(chunks.flatMap(({ imports }) => imports)).toEqual([]);
  });
});
