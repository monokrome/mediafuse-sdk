import { describe, it, expect, expectTypeOf } from "vitest";
import type {
  StoredMessage,
  MessageOf,
  States,
  PluginType,
  PluginEvent,
  PluginEventMap,
  PluginHandlers,
  CreateContext,
  PluginEntry,
  PluginManifest,
  RegisterFn,
  PluginContext,
} from "../src/types.js";

describe("type contracts", () => {
  it("PluginType is a union of 'data' and 'overlay'", () => {
    expectTypeOf<PluginType>().toEqualTypeOf<"data" | "overlay">();
  });

  it("PluginEvent covers all event map keys", () => {
    expectTypeOf<PluginEvent>().toEqualTypeOf<
      | "message"
      | "stateChange"
      | "command"
      | "resize"
      | "tick"
      | "config"
    >();
  });

  it("StoredMessage has the expected shape with generic data", () => {
    const msg: StoredMessage = {
      type: null,
      data: { title: "test" },
      timestamp: Date.now(),
      expiresAt: null,
    };
    expect(msg.data.title).toBe("test");
    expectTypeOf(msg.type).toEqualTypeOf<string | null>();
    expectTypeOf(msg.data).toEqualTypeOf<Record<string, unknown>>();
    expectTypeOf(msg.expiresAt).toEqualTypeOf<number | null>();
  });

  it("StoredMessage generic narrows data type", () => {
    type MusicData = { artist: string; title: string };
    const msg: StoredMessage<MusicData> = {
      type: "music",
      data: { artist: "a", title: "t" },
      timestamp: Date.now(),
      expiresAt: null,
    };
    expectTypeOf(msg.data).toEqualTypeOf<MusicData>();
    expectTypeOf(msg.data.artist).toEqualTypeOf<string>();
  });

  it("MessageOf narrows data and requires type", () => {
    type MusicData = { artist: string; title: string };
    type MusicMsg = MessageOf<MusicData>;
    expectTypeOf<MusicMsg["type"]>().toEqualTypeOf<string>();
    expectTypeOf<MusicMsg["data"]>().toEqualTypeOf<MusicData>();
  });

  it("States is a nested record", () => {
    const states: States = { section: { key: "value" } };
    expect(states.section.key).toBe("value");
    expectTypeOf<States>().toEqualTypeOf<
      Record<string, Record<string, unknown>>
    >();
  });

  it("PluginEventMap maps events to correct payload types", () => {
    expectTypeOf<PluginEventMap["message"]>().toEqualTypeOf<StoredMessage | null>();
    expectTypeOf<PluginEventMap["stateChange"]>().toEqualTypeOf<States>();
    expectTypeOf<PluginEventMap["command"]>().toEqualTypeOf<{
      name: string;
      data: unknown;
    }>();
    expectTypeOf<PluginEventMap["resize"]>().toEqualTypeOf<{
      width: number;
      height: number;
    }>();
    expectTypeOf<PluginEventMap["tick"]>().toEqualTypeOf<number>();
    expectTypeOf<PluginEventMap["config"]>().toEqualTypeOf<PluginManifest>();
  });

  it("PluginHandlers uses onEventName convention", () => {
    const handlers: PluginHandlers = {
      onMessage: () => {},
      onTick: () => {},
      onDestroy: () => {},
    };
    expect(handlers.onMessage).toBeDefined();
    expect(handlers.onTick).toBeDefined();
    expect(handlers.onDestroy).toBeDefined();
  });

  it("CreateContext provides container, config, states, and emit", () => {
    expectTypeOf<CreateContext>().toHaveProperty("container");
    expectTypeOf<CreateContext>().toHaveProperty("config");
    expectTypeOf<CreateContext>().toHaveProperty("states");
    expectTypeOf<CreateContext>().toHaveProperty("emit");
    expectTypeOf<CreateContext["container"]>().toEqualTypeOf<HTMLDivElement | null>();
  });

  it("PluginEntry has src and optional name/allowTypes/config", () => {
    const entry: PluginEntry = { src: "http://example.com/plugin.js" };
    expect(entry.src).toBe("http://example.com/plugin.js");
    expectTypeOf<PluginEntry["name"]>().toEqualTypeOf<string | undefined>();
    expectTypeOf<PluginEntry["allowTypes"]>().toEqualTypeOf<
      PluginType[] | undefined
    >();
    expectTypeOf<PluginEntry["config"]>().toEqualTypeOf<
      Record<string, unknown> | undefined
    >();
  });

  it("PluginManifest has version, plugins, blocks, and config", () => {
    const manifest: PluginManifest = {
      v: 1,
      plugins: [{ src: "test.js" }],
      blocks: [],
      config: { theme: "dark" },
    };
    expect(manifest.v).toBe(1);
    expect(manifest.plugins).toHaveLength(1);
  });

  it("RegisterFn accepts a single type and handlers, returns boolean", () => {
    expectTypeOf<RegisterFn>().toBeFunction();
    expectTypeOf<RegisterFn>().parameters.toEqualTypeOf<
      [PluginType, PluginHandlers]
    >();
    expectTypeOf<ReturnType<RegisterFn>>().toEqualTypeOf<boolean>();
  });

  it("PluginContext provides register and manifest", () => {
    expectTypeOf<PluginContext>().toHaveProperty("register");
    expectTypeOf<PluginContext>().toHaveProperty("manifest");
    expectTypeOf<PluginContext["register"]>().toEqualTypeOf<RegisterFn>();
    expectTypeOf<PluginContext["manifest"]>().toEqualTypeOf<PluginManifest>();
  });
});
