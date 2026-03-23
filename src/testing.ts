import type {
  PluginType,
  PluginEvent,
  PluginEventMap,
  PluginHandlers,
  PluginManifest,
  CreateContext,
  RegisterOptions,
} from "./types.js";
import type { DefinePluginFn } from "./define-plugin.js";

export interface EmittedEvent<E extends PluginEvent = PluginEvent> {
  event: E;
  data: PluginEventMap[E];
}

export interface TestHarnessOptions {
  type?: PluginType;
  config?: Record<string, unknown>;
  manifest?: Partial<PluginManifest>;
}

export interface TestHarness {
  name: string;
  type: PluginType;
  registered: boolean;
  handlers: PluginHandlers;
  container: HTMLDivElement | null;
  emitted: EmittedEvent[];
  emit: CreateContext["emit"];
  message: (msg: PluginEventMap["message"]) => void;
  command: (cmd: PluginEventMap["command"]) => void;
  tick: (dt: number) => void;
  resize: (size: PluginEventMap["resize"]) => void;
  config: (manifest: PluginManifest) => void;
  destroy: () => void;
}

function defaultManifest(overrides?: Partial<PluginManifest>): PluginManifest {
  return {
    v: 1,
    plugins: [],
    blocks: [],
    config: {},
    ...overrides,
  };
}

export function createTestHarness(
  plugin: { default: (define: DefinePluginFn) => void } | ((define: DefinePluginFn) => void),
  options: TestHarnessOptions = {},
): TestHarness {
  const allowedType = options.type ?? "overlay";
  const manifest = defaultManifest(options.manifest);
  const pluginConfig = { ...manifest.config, ...options.config };

  let capturedName = "";
  let capturedType: PluginType | null = null;
  let capturedHandlers: PluginHandlers = {};
  let didRegister = false;

  const emitted: EmittedEvent[] = [];
  const container =
    allowedType === "overlay"
      ? (createMockDiv() as unknown as HTMLDivElement)
      : null;

  const emitFn =
    allowedType === "data"
      ? <E extends PluginEvent>(event: E, data: PluginEventMap[E]) => {
          emitted.push({ event, data } as EmittedEvent);
        }
      : null;

  const register = (type: PluginType, handlers: PluginHandlers, _options?: RegisterOptions): boolean => {
    if (type !== allowedType) return false;

    capturedType = type;
    capturedHandlers = handlers;
    didRegister = true;

    if (handlers.onCreate) {
      handlers.onCreate({
        container,
        config: pluginConfig,
        emit: emitFn,
        messageActioned: () => {},
        environment: allowedType === "dashboard" ? "dashboard" : "overlay",
        dev: true,
      });
    }

    return true;
  };

  const definePlugin: DefinePluginFn = (name, setup) => {
    capturedName = name;
    setup({ register, registerBlockType: () => {}, registerEvent: () => {}, manifest, load: () => Promise.reject(new Error("load() not available in tests")) });
  };

  const pluginFn = typeof plugin === "function" ? plugin : plugin.default;
  pluginFn(definePlugin);

  const fire = <E extends PluginEvent>(event: E, data: PluginEventMap[E]) => {
    const key = `on${event.charAt(0).toUpperCase()}${event.slice(1)}` as keyof PluginHandlers;
    const handler = capturedHandlers[key] as
      | ((data: PluginEventMap[E]) => void)
      | undefined;
    if (handler) handler(data);
  };

  return {
    get name() { return capturedName; },
    get type() { return capturedType ?? allowedType; },
    get registered() { return didRegister; },
    get handlers() { return capturedHandlers; },
    container,
    emitted,
    emit: emitFn,
    message: (msg) => fire("message", msg),
    command: (cmd) => fire("command", cmd),
    tick: (dt) => fire("tick", dt),
    resize: (size) => fire("resize", size),
    config: (m) => fire("config", m),
    destroy: () => capturedHandlers.onDestroy?.(),
  };
}

function createMockDiv(): Record<string, unknown> {
  const children: unknown[] = [];
  return {
    tagName: "DIV",
    style: { cssText: "" },
    children,
    childNodes: children,
    appendChild(child: unknown) { children.push(child); return child; },
    removeChild(child: unknown) {
      const i = children.indexOf(child);
      if (i >= 0) children.splice(i, 1);
      return child;
    },
    remove() {},
    innerHTML: "",
    textContent: "",
    querySelector() { return null; },
    querySelectorAll() { return []; },
    addEventListener() {},
    removeEventListener() {},
    setAttribute() {},
    getAttribute() { return null; },
    classList: {
      add() {},
      remove() {},
      toggle() {},
      contains() { return false; },
    },
  };
}

export type { PluginType, PluginEvent, PluginEventMap, PluginHandlers, PluginManifest, CreateContext };
