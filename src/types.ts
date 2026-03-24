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
  messageActioned: (durationMs: number | null) => void;
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

export interface BlockPosition {
  x?: number | string;
  y?: number | string;
  width?: number | string;
  height?: number | string;
  anchor?: {
    x?: "left" | "center" | "right";
    y?: "top" | "center" | "bottom";
  };
}

export interface BlockCondition {
  event?: string;
  duration?: number;
}

export type BlockConditionEntry = BlockCondition | string;

export interface BlockConditions {
  enter?: BlockConditionEntry[];
  exit?: BlockConditionEntry[];
}

export interface AnimationConfig {
  name: string;
  duration?: number;
}

export interface BlockAnimation {
  enter?: AnimationConfig;
  exit?: AnimationConfig;
}

export type BlockTypeRenderer<T = unknown> = (
  options: Record<string, unknown>,
  context: Record<string, unknown>,
) => T;

export interface BlockGroup {
  limit: number;
  direction?: "vertical" | "horizontal";
  gap?: number;
  order?: string[];
  evict?: string[];
}

export interface Block {
  id: string;
  type: string;
  position?: BlockPosition;
  options: Record<string, unknown>;
  conditions?: BlockConditions;
  animation?: BlockAnimation;
  group?: BlockGroup;
}

export interface PluginManifest {
  v: number;
  plugins: PluginEntry[];
  blocks: Block[];
  config: Record<string, unknown>;
}

export type RegisterFn = (
  type: PluginType,
  handlers: PluginHandlers,
  options?: RegisterOptions,
) => boolean;

export type RegisterBlockTypeFn = (
  subtype: string,
  renderer: BlockTypeRenderer,
) => void;

export type EventFieldType = "string" | "number" | "boolean";

export interface EventFieldSchema {
  type: EventFieldType;
  label?: string;
  required?: boolean;
  default?: string | number | boolean;
}

export interface EventSchema {
  label?: string;
  fields: Record<string, EventFieldSchema>;
}

export type RegisterEventFn = (
  event: string,
  schema: EventSchema,
) => void;

export type LoadType = "source" | "json" | "css" | "url";

export type LoadResult<T extends LoadType | undefined = undefined> =
  T extends "source" ? Record<string, unknown> :
  T extends "json" ? unknown :
  T extends "css" ? string :
  T extends "url" ? string :
  Record<string, unknown> | string | unknown;

export type LoadFn = <T extends LoadType | undefined = undefined>(
  specifier: string,
  type?: T,
) => Promise<LoadResult<T>>;

export interface PluginContext {
  register: RegisterFn;
  registerBlockType: RegisterBlockTypeFn;
  registerEvent: RegisterEventFn;
  manifest: PluginManifest;
  load: LoadFn;
}
