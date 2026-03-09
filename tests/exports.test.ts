import { describe, it, expect } from "vitest";
import * as sdk from "../src/index.js";
import * as testing from "../src/testing.js";

describe("public API surface", () => {
  it("exports no runtime values from main entry (types-only)", () => {
    const exports = Object.keys(sdk);
    expect(exports).toEqual([]);
  });

  it("exports createTestHarness from testing entry", () => {
    expect(testing.createTestHarness).toBeTypeOf("function");
  });
});
