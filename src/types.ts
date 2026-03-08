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

export interface PluginApi {
  on<E extends PluginEvent>(event: E, handler: (data: PluginEventMap[E]) => void): void;
  off<E extends PluginEvent>(event: E, handler: (data: PluginEventMap[E]) => void): void;
  container: HTMLDivElement | null;
  emit: (<E extends PluginEvent>(event: E, data: PluginEventMap[E]) => void) | null;
  states(): States;
  config(): Record<string, unknown>;
}

export type PluginRegistrationCallback = (api: PluginApi) => (() => void) | void;

export interface PluginEntry {
  src: string;
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
  callback: PluginRegistrationCallback,
) => boolean;

export interface PluginContext {
  register: RegisterFn;
  manifest: PluginManifest;
}
