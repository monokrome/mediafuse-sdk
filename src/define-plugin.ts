import type {
  PluginType,
  PluginContext,
  PluginRegistrationCallback,
} from "./types.js";

export type RegistrationResult = Record<PluginType, boolean>;

export function definePlugin(
  types: PluginType[],
  callback: PluginRegistrationCallback,
): (ctx: PluginContext) => RegistrationResult {
  return (ctx) => {
    const result: RegistrationResult = { data: false, overlay: false };
    for (const type of types) {
      result[type] = ctx.register(type, callback);
    }
    return result;
  };
}
