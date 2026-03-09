export interface StoredMessage {
  title: string;
  subtitle: string;
  type: string | null;
  timestamp: number;
  expiresAt: number | null;
}

export interface Track {
  artist: string;
  title: string;
  album: string;
}

export type States = Record<string, Record<string, unknown>>;

export type PluginType = "data" | "overlay";

export type PluginEventMap = {
  message: StoredMessage | null;
  nowPlaying: Track | null;
  stateChange: States;
  command: { name: string; data: unknown };
  resize: { width: number; height: number };
  tick: number;
  config: PluginManifest;
};

export type PluginEvent = keyof PluginEventMap;

export interface CreateContext {
  container: HTMLDivElement | null;
  config: Record<string, unknown>;
  states: States;
  emit: (<E extends PluginEvent>(event: E, data: PluginEventMap[E]) => void) | null;
}

export type PluginHandlers = {
  [E in PluginEvent as `on${Capitalize<E>}`]?: (data: PluginEventMap[E]) => void;
} & {
  onCreate?: (ctx: CreateContext) => void;
  onDestroy?: () => void;
};

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
) => boolean;

export interface PluginContext {
  register: RegisterFn;
  manifest: PluginManifest;
}
