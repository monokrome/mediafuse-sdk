import { describe, it, expect, vi } from "vitest";
import type {
  DefinePluginFn,
  PluginContext,
  PluginManifest,
  PluginHandle,
  PluginType,
} from "../src/index.js";

function createMockHandle(overrides: Partial<PluginHandle> = {}): PluginHandle {
  return {
    container: null,
    emit: null,
    states: () => ({}),
    config: () => ({}),
    ...overrides,
  };
}

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
    register: vi.fn((type: PluginType) =>
      acceptTypes.includes(type) ? createMockHandle() : null,
    ),
    manifest,
  };
}

/** Simulates what the host runtime does: provides definePlugin and calls the plugin export. */
function createHostDefinePlugin(ctx: PluginContext) {
  let capturedName: string | undefined;

  const definePlugin: DefinePluginFn = (name, setup) => {
    capturedName = name;
    setup(ctx);
  };

  return { definePlugin, getName: () => capturedName };
}

describe("plugin registration flow", () => {
  it("plugin receives definePlugin and can declare its name", () => {
    const ctx = createMockContext();
    const { definePlugin, getName } = createHostDefinePlugin(ctx);

    // Simulate a plugin module's default export
    const pluginExport = (define: DefinePluginFn) => {
      define("my-plugin", ({ register }) => {
        register("overlay", {});
      });
    };

    pluginExport(definePlugin);

    expect(getName()).toBe("my-plugin");
    expect(ctx.register).toHaveBeenCalledOnce();
  });

  it("setup receives register and manifest", () => {
    const ctx = createMockContext();
    const { definePlugin } = createHostDefinePlugin(ctx);

    const pluginExport = (define: DefinePluginFn) => {
      define("test", ({ register, manifest }) => {
        expect(typeof register).toBe("function");
        expect(manifest).toHaveProperty("v");
        expect(manifest).toHaveProperty("plugins");
      });
    };

    pluginExport(definePlugin);
  });

  it("register returns a handle on success", () => {
    const ctx = createMockContext();
    const { definePlugin } = createHostDefinePlugin(ctx);

    const pluginExport = (define: DefinePluginFn) => {
      define("test", ({ register }) => {
        const handle = register("overlay", { onMessage: () => {} });
        expect(handle).not.toBeNull();
        expect(handle).toHaveProperty("container");
        expect(handle).toHaveProperty("states");
        expect(handle).toHaveProperty("config");
      });
    };

    pluginExport(definePlugin);
  });

  it("register returns null on rejection", () => {
    const ctx = createMockContext([]);
    const { definePlugin } = createHostDefinePlugin(ctx);

    const pluginExport = (define: DefinePluginFn) => {
      define("test", ({ register }) => {
        const handle = register("overlay", {});
        expect(handle).toBeNull();
      });
    };

    pluginExport(definePlugin);
  });

  it("allows registering multiple types", () => {
    const ctx = createMockContext();
    const { definePlugin } = createHostDefinePlugin(ctx);

    const pluginExport = (define: DefinePluginFn) => {
      define("test", ({ register }) => {
        register("data", {});
        register("overlay", {});
      });
    };

    pluginExport(definePlugin);

    expect(ctx.register).toHaveBeenCalledTimes(2);
  });

  it("propagates errors thrown by setup", () => {
    const ctx = createMockContext();
    const { definePlugin } = createHostDefinePlugin(ctx);

    const pluginExport = (define: DefinePluginFn) => {
      define("test", () => {
        throw new Error("setup failed");
      });
    };

    expect(() => pluginExport(definePlugin)).toThrow("setup failed");
  });

  it("propagates errors thrown by register", () => {
    const ctx = createMockContext();
    ctx.register.mockImplementation(() => {
      throw new Error("registration rejected");
    });
    const { definePlugin } = createHostDefinePlugin(ctx);

    const pluginExport = (define: DefinePluginFn) => {
      define("test", ({ register }) => {
        register("overlay", {});
      });
    };

    expect(() => pluginExport(definePlugin)).toThrow("registration rejected");
  });

  it("onDestroy handler is provided in the handlers object", () => {
    const ctx = createMockContext();
    const { definePlugin } = createHostDefinePlugin(ctx);
    const destroy = vi.fn();

    const pluginExport = (define: DefinePluginFn) => {
      define("test", ({ register }) => {
        register("overlay", { onDestroy: destroy });
      });
    };

    pluginExport(definePlugin);

    // Verify the handler was passed through
    const handlers = ctx.register.mock.calls[0][1];
    expect(handlers.onDestroy).toBe(destroy);
  });
});
