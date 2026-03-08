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
  acceptTypes: PluginType[] = ["data", "overlay"],
): PluginContext & { register: ReturnType<typeof vi.fn> } {
  const manifest: PluginManifest = {
    v: 1,
    plugins: [],
    blocks: [],
    config: {},
  };

  return {
    register: vi.fn((type: PluginType) => acceptTypes.includes(type)),
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

  it("calls ctx.register once per type with the callback", () => {
    const callback: PluginRegistrationCallback = () => {};
    const plugin = definePlugin(["data", "overlay"], callback);
    const ctx = createMockContext();

    plugin(ctx);

    expect(ctx.register).toHaveBeenCalledTimes(2);
    expect(ctx.register).toHaveBeenCalledWith("data", callback);
    expect(ctx.register).toHaveBeenCalledWith("overlay", callback);
  });

  it("calls register once for a single type", () => {
    const callback: PluginRegistrationCallback = () => {};
    const plugin = definePlugin(["overlay"], callback);
    const ctx = createMockContext();

    plugin(ctx);

    expect(ctx.register).toHaveBeenCalledOnce();
    expect(ctx.register).toHaveBeenCalledWith("overlay", callback);
  });

  it("does not call register for an empty types array", () => {
    const plugin = definePlugin([], () => {});
    const ctx = createMockContext();

    plugin(ctx);

    expect(ctx.register).not.toHaveBeenCalled();
  });

  it("returns registration results for all requested types", () => {
    const plugin = definePlugin(["data", "overlay"], () => {});
    const ctx = createMockContext();

    const result = plugin(ctx);

    expect(result).toEqual({ data: true, overlay: true });
  });

  it("callback receives the plugin API when invoked by the host", () => {
    const receivedApi = vi.fn();
    const plugin = definePlugin(["data"], (api) => {
      receivedApi(api);
    });

    const ctx = createMockContext();
    ctx.register.mockImplementation(
      (_type: PluginType, cb: PluginRegistrationCallback) => {
        cb(createMockApi());
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
      (_type: PluginType, cb: PluginRegistrationCallback) => {
        capturedCleanup = cb(createMockApi());
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
      (_type: PluginType, cb: PluginRegistrationCallback) => {
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

  describe("type rejection", () => {
    it("returns false for rejected types, true for accepted", () => {
      const plugin = definePlugin(["data", "overlay"], () => {});
      const ctx = createMockContext(["data"]);

      const result = plugin(ctx);

      expect(result).toEqual({ data: true, overlay: false });
    });

    it("returns false for all types when fully rejected", () => {
      const plugin = definePlugin(["data", "overlay"], () => {});
      const ctx = createMockContext([]);

      const result = plugin(ctx);

      expect(result).toEqual({ data: false, overlay: false });
    });

    it("returns only overlay accepted when data is rejected", () => {
      const plugin = definePlugin(["data", "overlay"], () => {});
      const ctx = createMockContext(["overlay"]);

      const result = plugin(ctx);

      expect(result).toEqual({ data: false, overlay: true });
    });

    it("defaults unrequested types to false in the result", () => {
      const plugin = definePlugin(["data"], () => {});
      const ctx = createMockContext();

      const result = plugin(ctx);

      expect(result.data).toBe(true);
      expect(result.overlay).toBe(false);
    });

    it("still registers each type even if earlier types were rejected", () => {
      const callback: PluginRegistrationCallback = () => {};
      const plugin = definePlugin(["data", "overlay"], callback);
      const ctx = createMockContext(["overlay"]);

      plugin(ctx);

      expect(ctx.register).toHaveBeenCalledTimes(2);
      expect(ctx.register).toHaveBeenCalledWith("data", callback);
      expect(ctx.register).toHaveBeenCalledWith("overlay", callback);
    });
  });

  describe("error propagation", () => {
    it("propagates errors thrown by the callback", () => {
      const plugin = definePlugin(["overlay"], () => {
        throw new Error("plugin init failed");
      });

      const ctx = createMockContext();
      ctx.register.mockImplementation(
        (_type: PluginType, cb: PluginRegistrationCallback) => {
          cb(createMockApi());
          return true;
        },
      );

      expect(() => plugin(ctx)).toThrow("plugin init failed");
    });

    it("propagates errors thrown by the cleanup function", () => {
      const plugin = definePlugin(["data"], () => {
        return () => {
          throw new Error("cleanup failed");
        };
      });

      const ctx = createMockContext();
      let capturedCleanup: (() => void) | void;
      ctx.register.mockImplementation(
        (_type: PluginType, cb: PluginRegistrationCallback) => {
          capturedCleanup = cb(createMockApi());
          return true;
        },
      );

      plugin(ctx);
      expect(() => capturedCleanup!()).toThrow("cleanup failed");
    });

    it("propagates errors thrown by register itself", () => {
      const plugin = definePlugin(["overlay"], () => {});
      const ctx = createMockContext();
      ctx.register.mockImplementation(() => {
        throw new Error("registration rejected");
      });

      expect(() => plugin(ctx)).toThrow("registration rejected");
    });
  });
});
