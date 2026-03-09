import { describe, it, expect } from "vitest";
import * as sdk from "../src/index.js";

describe("public API surface", () => {
  it("exports no runtime values (types-only package)", () => {
    const exports = Object.keys(sdk);
    expect(exports).toEqual([]);
  });
});
