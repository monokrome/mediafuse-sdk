import { describe, it, expect } from "vitest";
import * as sdk from "../src/index.js";

describe("public API surface", () => {
  it("exports definePlugin as a function", () => {
    expect(typeof sdk.definePlugin).toBe("function");
  });

  it("only exports expected runtime values", () => {
    const exports = Object.keys(sdk);
    expect(exports).toEqual(["definePlugin"]);
  });
});
