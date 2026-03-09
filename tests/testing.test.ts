import { describe, it, expect, vi } from "vitest";
import { createTestHarness } from "../src/testing.js";
import type { DefinePluginFn } from "../src/define-plugin.js";

function makePlugin(name: string, type: "data" | "overlay", handlers = {}) {
  return (definePlugin: DefinePluginFn) =>
    definePlugin(name, ({ register }) => {
      register(type, handlers);
    });
}

describe("createTestHarness", () => {
  it("captures the plugin name", () => {
    const harness = createTestHarness(makePlugin("test-plugin", "overlay"));
    expect(harness.name).toBe("test-plugin");
  });

  it("captures the registered type", () => {
    const harness = createTestHarness(makePlugin("p", "overlay"));
    expect(harness.type).toBe("overlay");
  });

  it("reports registered as true when type matches", () => {
    const harness = createTestHarness(makePlugin("p", "overlay"), { type: "overlay" });
    expect(harness.registered).toBe(true);
  });

  it("reports registered as false when type is denied", () => {
    const harness = createTestHarness(makePlugin("p", "data"), { type: "overlay" });
    expect(harness.registered).toBe(false);
  });

  it("provides a container for overlay plugins", () => {
    const harness = createTestHarness(makePlugin("p", "overlay"), { type: "overlay" });
    expect(harness.container).not.toBeNull();
  });

  it("provides null container for data plugins", () => {
    const harness = createTestHarness(makePlugin("p", "data"), { type: "data" });
    expect(harness.container).toBeNull();
  });

  it("provides emit for data plugins", () => {
    const harness = createTestHarness(makePlugin("p", "data"), { type: "data" });
    expect(harness.emit).toBeTypeOf("function");
  });

  it("provides null emit for overlay plugins", () => {
    const harness = createTestHarness(makePlugin("p", "overlay"), { type: "overlay" });
    expect(harness.emit).toBeNull();
  });

  it("calls onCreate with config", () => {
    const onCreate = vi.fn();
    const harness = createTestHarness(
      makePlugin("p", "overlay", { onCreate }),
      { config: { color: "red" } },
    );
    expect(onCreate).toHaveBeenCalledOnce();
    expect(onCreate.mock.calls[0][0].config).toEqual(
      expect.objectContaining({ color: "red" }),
    );
    expect(harness.registered).toBe(true);
  });

  it("merges manifest config with plugin config", () => {
    const onCreate = vi.fn();
    createTestHarness(
      makePlugin("p", "overlay", { onCreate }),
      {
        manifest: { config: { global: true } },
        config: { local: true },
      },
    );
    const ctx = onCreate.mock.calls[0][0];
    expect(ctx.config.global).toBe(true);
    expect(ctx.config.local).toBe(true);
  });

  it("fires onMessage via message()", () => {
    const onMessage = vi.fn();
    const harness = createTestHarness(makePlugin("p", "overlay", { onMessage }));
    const msg = { type: "test", data: { x: 1 }, timestamp: 1, expiresAt: null };
    harness.message(msg);
    expect(onMessage).toHaveBeenCalledWith(msg);
  });

  it("fires onCommand via command()", () => {
    const onCommand = vi.fn();
    const harness = createTestHarness(makePlugin("p", "overlay", { onCommand }));
    harness.command({ name: "reload", data: null });
    expect(onCommand).toHaveBeenCalledWith({ name: "reload", data: null });
  });

  it("fires onTick via tick()", () => {
    const onTick = vi.fn();
    const harness = createTestHarness(makePlugin("p", "overlay", { onTick }));
    harness.tick(16);
    expect(onTick).toHaveBeenCalledWith(16);
  });

  it("fires onResize via resize()", () => {
    const onResize = vi.fn();
    const harness = createTestHarness(makePlugin("p", "overlay", { onResize }));
    harness.resize({ width: 1920, height: 1080 });
    expect(onResize).toHaveBeenCalledWith({ width: 1920, height: 1080 });
  });

  it("fires onDestroy via destroy()", () => {
    const onDestroy = vi.fn();
    const harness = createTestHarness(makePlugin("p", "overlay", { onDestroy }));
    harness.destroy();
    expect(onDestroy).toHaveBeenCalledOnce();
  });

  it("tracks emitted events from data plugins", () => {
    const plugin = (definePlugin: DefinePluginFn) =>
      definePlugin("emitter", ({ register }) => {
        register("data", {
          onCreate(ctx) {
            ctx.emit!("message", { type: "test", data: {}, timestamp: 1, expiresAt: null });
          },
        });
      });

    const harness = createTestHarness(plugin, { type: "data" });
    expect(harness.emitted).toHaveLength(1);
    expect(harness.emitted[0].event).toBe("message");
  });

  it("accepts module-style objects with default export", () => {
    const mod = {
      default: makePlugin("mod-plugin", "overlay"),
    };
    const harness = createTestHarness(mod);
    expect(harness.name).toBe("mod-plugin");
    expect(harness.registered).toBe(true);
  });

  it("does not throw when firing events with no handler", () => {
    const harness = createTestHarness(makePlugin("p", "overlay"));
    expect(() => harness.message(null)).not.toThrow();
    expect(() => harness.command({ name: "x", data: null })).not.toThrow();
    expect(() => harness.tick(16)).not.toThrow();
    expect(() => harness.resize({ width: 100, height: 100 })).not.toThrow();
    expect(() => harness.destroy()).not.toThrow();
  });
});
