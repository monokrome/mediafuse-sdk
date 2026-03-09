import { describe, it, expect, expectTypeOf } from "vitest";
import type {
  StoredMessage,
  Track,
  States,
  PluginType,
  PluginEvent,
  PluginEventMap,
  PluginHandlers,
  PluginHandle,
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
      | "nowPlaying"
      | "stateChange"
      | "command"
      | "resize"
      | "tick"
      | "config"
    >();
  });

  it("StoredMessage has the expected shape", () => {
    const msg: StoredMessage = {
      title: "test",
      subtitle: "sub",
      type: null,
      timestamp: Date.now(),
      expiresAt: null,
    };
    expect(msg.title).toBe("test");
    expectTypeOf(msg.type).toEqualTypeOf<string | null>();
    expectTypeOf(msg.expiresAt).toEqualTypeOf<number | null>();
  });

  it("Track has artist, title, and album", () => {
    const track: Track = { artist: "a", title: "t", album: "al" };
    expect(track.artist).toBe("a");
    expectTypeOf<Track>().toHaveProperty("artist");
    expectTypeOf<Track>().toHaveProperty("title");
    expectTypeOf<Track>().toHaveProperty("album");
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
    expectTypeOf<PluginEventMap["nowPlaying"]>().toEqualTypeOf<Track | null>();
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

  it("PluginHandle provides container, emit, states, and config", () => {
    expectTypeOf<PluginHandle>().toHaveProperty("container");
    expectTypeOf<PluginHandle>().toHaveProperty("emit");
    expectTypeOf<PluginHandle>().toHaveProperty("states");
    expectTypeOf<PluginHandle>().toHaveProperty("config");
    expectTypeOf<PluginHandle["container"]>().toEqualTypeOf<HTMLDivElement | null>();
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

  it("RegisterFn accepts a single type and handlers, returns handle or null", () => {
    expectTypeOf<RegisterFn>().toBeFunction();
    expectTypeOf<RegisterFn>().parameters.toEqualTypeOf<
      [PluginType, PluginHandlers]
    >();
    expectTypeOf<ReturnType<RegisterFn>>().toEqualTypeOf<PluginHandle | null>();
  });

  it("PluginContext provides register and manifest", () => {
    expectTypeOf<PluginContext>().toHaveProperty("register");
    expectTypeOf<PluginContext>().toHaveProperty("manifest");
    expectTypeOf<PluginContext["register"]>().toEqualTypeOf<RegisterFn>();
    expectTypeOf<PluginContext["manifest"]>().toEqualTypeOf<PluginManifest>();
  });
});
