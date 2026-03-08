import { describe, it, expect, expectTypeOf } from "vitest";
import type {
  StoredMessage,
  Track,
  States,
  PluginType,
  PluginEvent,
  PluginEventMap,
  PluginApi,
  PluginRegistrationCallback,
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

  it("PluginApi has on/off with typed event handlers", () => {
    expectTypeOf<PluginApi["on"]>().toBeFunction();
    expectTypeOf<PluginApi["off"]>().toBeFunction();
    expectTypeOf<PluginApi["states"]>().toBeFunction();
    expectTypeOf<PluginApi["config"]>().toBeFunction();
    expectTypeOf<PluginApi["container"]>().toEqualTypeOf<HTMLDivElement | null>();
  });

  it("PluginRegistrationCallback accepts PluginApi and optionally returns cleanup", () => {
    expectTypeOf<PluginRegistrationCallback>().toBeFunction();
    expectTypeOf<PluginRegistrationCallback>().parameters.toEqualTypeOf<
      [PluginApi]
    >();
    expectTypeOf<ReturnType<PluginRegistrationCallback>>().toEqualTypeOf<
      (() => void) | void
    >();
  });

  it("PluginEntry has src and optional allowTypes/config", () => {
    const entry: PluginEntry = { src: "http://example.com/plugin.js" };
    expect(entry.src).toBe("http://example.com/plugin.js");
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

  it("RegisterFn accepts types and callback, returns boolean", () => {
    expectTypeOf<RegisterFn>().toBeFunction();
    expectTypeOf<ReturnType<RegisterFn>>().toEqualTypeOf<boolean>();
  });

  it("PluginContext provides register and manifest", () => {
    expectTypeOf<PluginContext>().toHaveProperty("register");
    expectTypeOf<PluginContext>().toHaveProperty("manifest");
    expectTypeOf<PluginContext["register"]>().toEqualTypeOf<RegisterFn>();
    expectTypeOf<PluginContext["manifest"]>().toEqualTypeOf<PluginManifest>();
  });
});
