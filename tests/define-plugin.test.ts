import { describe, it, expect, vi } from "vitest";
import { definePlugin } from "../src/define-plugin.js";
import type {
  PluginContext,
  PluginManifest,
  PluginApi,
  PluginType,
  PluginRegistrationCallback,
} from "../src/types.js";

function createMockContext(
  registerReturn = true,
): PluginContext & { register: ReturnType<typeof vi.fn> } {
  const manifest: PluginManifest = {
    v: 1,
    plugins: [],
    blocks: [],
    config: {},
  };

  return {
    register: vi.fn().mockReturnValue(registerReturn),
    manifest,
  };
}

function createMockApi(overrides: Partial<PluginApi> = {}): PluginApi {
  return {
    on: vi.fn(),
    off: vi.fn(),
    container: null,
    emit: null,
    states: () => ({}),
    config: () => ({}),
    ...overrides,
  };
}

describe("definePlugin", () => {
  it("returns a function", () => {
    const plugin = definePlugin(["overlay"], () => {});
    expect(typeof plugin).toBe("function");
  });

  it("calls ctx.register with the provided types and callback", () => {
    const callback: PluginRegistrationCallback = () => {};
    const types: PluginType[] = ["overlay"];
    const plugin = definePlugin(types, callback);
    const ctx = createMockContext();

    plugin(ctx);

    expect(ctx.register).toHaveBeenCalledOnce();
    expect(ctx.register).toHaveBeenCalledWith(types, callback);
  });

  it("passes multiple types through to register", () => {
    const callback: PluginRegistrationCallback = () => {};
    const types: PluginType[] = ["data", "overlay"];
    const plugin = definePlugin(types, callback);
    const ctx = createMockContext();

    plugin(ctx);

    expect(ctx.register).toHaveBeenCalledWith(types, callback);
  });

  it("passes an empty types array through to register", () => {
    const callback: PluginRegistrationCallback = () => {};
    const plugin = definePlugin([], callback);
    const ctx = createMockContext();

    plugin(ctx);

    expect(ctx.register).toHaveBeenCalledWith([], callback);
  });

  it("callback receives the plugin API when invoked by the host", () => {
    const receivedApi = vi.fn();
    const plugin = definePlugin(["data"], (api) => {
      receivedApi(api);
    });

    const ctx = createMockContext();
    ctx.register.mockImplementation(
      (_types: PluginType[], cb: PluginRegistrationCallback) => {
        const api = createMockApi();
        cb(api);
        return true;
      },
    );

    plugin(ctx);

    expect(receivedApi).toHaveBeenCalledOnce();
    expect(receivedApi.mock.calls[0][0]).toHaveProperty("on");
    expect(receivedApi.mock.calls[0][0]).toHaveProperty("off");
    expect(receivedApi.mock.calls[0][0]).toHaveProperty("states");
    expect(receivedApi.mock.calls[0][0]).toHaveProperty("config");
  });

  it("callback can return a cleanup function", () => {
    const cleanup = vi.fn();
    const plugin = definePlugin(["overlay"], () => cleanup);

    const ctx = createMockContext();
    let capturedCleanup: (() => void) | void;
    ctx.register.mockImplementation(
      (_types: PluginType[], cb: PluginRegistrationCallback) => {
        const api = createMockApi();
        capturedCleanup = cb(api);
        return true;
      },
    );

    plugin(ctx);

    expect(capturedCleanup!).toBe(cleanup);
    expect(cleanup).not.toHaveBeenCalled();

    capturedCleanup!();
    expect(cleanup).toHaveBeenCalledOnce();
  });

  it("callback can return void", () => {
    const plugin = definePlugin(["data"], () => {});

    const ctx = createMockContext();
    let capturedCleanup: (() => void) | void;
    ctx.register.mockImplementation(
      (_types: PluginType[], cb: PluginRegistrationCallback) => {
        capturedCleanup = cb(createMockApi());
        return true;
      },
    );

    plugin(ctx);

    expect(capturedCleanup!).toBeUndefined();
  });

  it("can be called multiple times with different contexts", () => {
    const callback: PluginRegistrationCallback = () => {};
    const plugin = definePlugin(["overlay"], callback);
    const ctx1 = createMockContext();
    const ctx2 = createMockContext();

    plugin(ctx1);
    plugin(ctx2);

    expect(ctx1.register).toHaveBeenCalledOnce();
    expect(ctx2.register).toHaveBeenCalledOnce();
  });
});
