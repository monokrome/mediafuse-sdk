import type { PluginContext } from "./types.js";

export type SetupFn = (ctx: PluginContext) => void;

export type DefinePluginFn = (
  name: string,
  setup: SetupFn,
) => void;
