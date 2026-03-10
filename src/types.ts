export interface StoredMessage<T = Record<string, unknown>> {
  type: string | null;
  data: T;
  timestamp: number;
  durationMs: number | null;
}

export type MessageOf<T> = StoredMessage<T> & { type: string };

export type PluginType = "data" | "overlay" | "dashboard";

export type PluginEnvironment = "overlay" | "dashboard";

export type PluginEventMap = {
  message: StoredMessage | null;
  command: { name: string; data: unknown };
  resize: { width: number; height: number };
  tick: number;
  config: PluginManifest;
};

export type PluginEvent = keyof PluginEventMap;

export interface CreateContext {
  container: HTMLDivElement | null;
  config: Record<string, unknown>;
  emit: (<E extends PluginEvent>(event: E, data: PluginEventMap[E]) => void) | null;
  environment: PluginEnvironment;
  dev: boolean;
}

export type PluginHandlers = {
  [E in PluginEvent as `on${Capitalize<E>}`]?: (data: PluginEventMap[E]) => void;
} & {
  onCreate?: (ctx: CreateContext) => void;
  onDestroy?: () => void;
};

export interface RegisterOptions {
  environment?: PluginEnvironment;
  dev?: boolean;
}

export interface PluginEntry {
  src: string;
  name?: string;
  allowTypes?: PluginType[];
  config?: Record<string, unknown>;
}

export interface PluginManifest {
  v: number;
  plugins: PluginEntry[];
  blocks: unknown[];
  config: Record<string, unknown>;
}

export type RegisterFn = (
  type: PluginType,
  handlers: PluginHandlers,
  options?: RegisterOptions,
) => boolean;

export interface PluginContext {
  register: RegisterFn;
  manifest: PluginManifest;
}
