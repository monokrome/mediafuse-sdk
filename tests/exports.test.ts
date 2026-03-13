import { describe, it, expect } from "vitest";
import * as sdk from "../src/index.js";
import * as testing from "../src/testing.js";

describe("public API surface", () => {
  it("exports createLoader from main entry", () => {
    expect(sdk.createLoader).toBeTypeOf("function");
  });

  it("exports createTestHarness from testing entry", () => {
    expect(testing.createTestHarness).toBeTypeOf("function");
  });
});
