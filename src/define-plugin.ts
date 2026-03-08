import type {
  PluginType,
  PluginApi,
  PluginContext,
  PluginRegistrationCallback,
} from "./types.js";

export function definePlugin(
  types: PluginType[],
  callback: PluginRegistrationCallback,
): (ctx: PluginContext) => void {
  return (ctx) => {
    ctx.register(types, callback);
  };
}
