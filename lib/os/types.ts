export type LifecycleState = 'CREATED' | 'PLANNING' | 'RUNNING' | 'PAUSED' | 'COMPLETED' | 'CANCELLED' | 'FAILED';

export type BusinessState = 'WAITING_USER' | 'WAITING_MODEL' | 'WAITING_TOOL' | 'WAITING_AGENT' | 'WAITING_REVIEW' | 'WAITING_PAYMENT' | 'NONE';

export type CapabilityKind =
  | "text"
  | "image"
  | "video"
  | "vision"
  | "audio"
  | "code"
  | "ui"
  | "data"
  | "browser"
  | "workflow";

export interface RuntimeContext {
  userId?: string;
  teamId?: string;
  canvasId?: string;
  conversationId?: string;
  selectedModelIds?: Record<string, string>;
  variables?: Record<string, any>;
  permissions?: string[];
  // Existing compatibility:
  brandName?: string;
  videoRatio?: '16:9' | '9:16' | '1:1';
  resolution?: '1080p' | '4K';
  sandboxEnabled?: boolean;
  maxRetries?: number;
  safetyFilterLevel?: 'Low' | 'Medium' | 'High';
  modelProvider?: string;
  config?: any;
  previousOutputs?: Record<string, any>;
  onProgress?: (progressMsg: string) => void;
  aspectRatio?: string;
  duration?: string;
  imageUrl?: string;
  videoOptions?: any;
}

export interface Intent {
  id: string;
  rawText: string;
  source: string; // e.g. "chat" | "canvas" | "api" | "workflow" | "system"
  createdAt?: number;
  context?: RuntimeContext;
  // compatibility:
  standardizedIntent?: string;
  timestamp?: number;
}

export interface Goal {
  id: string;
  intentId: string;
  title?: string;
  rationale?: string;
  status?: "created" | "planning" | "running" | "completed" | "failed" | "cancelled" | string;
  taskIds?: string[];
  createdAt?: number;
  updatedAt?: number;
  // compatibility:
  name?: string;
  lifecycle?: LifecycleState;
  businessState?: BusinessState;
  dependencies?: string[];
  timestamp?: number;
}

export interface RuntimeTask {
  id: string;
  goalId: string;
  type: CapabilityKind | "script" | "general" | string;
  title?: string;
  prompt?: string;
  input?: any;
  output?: any;
  status?: "pending" | "running" | "completed" | "failed" | "skipped" | string;
  dependsOn?: string[];
  skillId?: string;
  agentId?: string;
  modelId?: string;
  pluginId?: string;
  error?: string;
  createdAt?: number;
  updatedAt?: number;
  // compatibility:
  name?: string;
  lifecycle?: LifecycleState;
  businessState?: BusinessState;
  assignedActorId?: string;
  timestamp?: number;
}

export type Task = RuntimeTask; // Keep Task as alias to maintain compatibility!

export interface RuntimeArtifact {
  id: string;
  taskId?: string;
  goalId?: string;
  canvasId?: string;
  type: "text" | "image" | "video" | "audio" | "code" | "ui" | "file" | "json" | "plugin-ui";
  title?: string;
  content?: any;
  url?: string;
  metadata?: Record<string, any>;
  createdAt?: number;
  // compatibility:
  status?: string;
  imageUrl?: string;
  videoUrl?: string;
  ossUrl?: string;
  prompt?: string;
  revisedPrompt?: string;
  error?: string;
  config?: any;
  timestamp?: number;
}

export type CanvasArtifact = RuntimeArtifact; // keep compatibility

export interface SkillDefinition {
  id: string;
  name: string;
  description: string;
  icon?: string;
  category: CapabilityKind | "all" | string;
  instruction?: string;
  inputSchema?: any;
  outputSchema?: any;
  acceptedUploadTypes?: Array<"text" | "image" | "video" | "audio" | "file" | string>;
  capabilityIds?: string[];
  defaultModelKind?: CapabilityKind;
  execute?: (input: any, context: RuntimeContext) => Promise<any>;
  metadata?: Record<string, any>;
  // compatibility:
  isSystem?: boolean;
  isInstalled?: boolean;
  isPublic?: boolean;
  customOptions?: any;
  enableUpload?: boolean;
  uploadType?: string;
  promptLabel?: string;
  promptPlaceholder?: string;
}

export interface PluginDefinition {
  id: string;
  name: string;
  version: string;
  description: string;
  icon?: string;
  category?: string;
  enabled: boolean;
  permissions?: string[];
  contributes?: {
    skills?: SkillDefinition[];
    agents?: AgentDefinition[];
    capabilities?: CapabilityDefinition[];
    uiPanels?: PluginUIPanelDefinition[];
    models?: ModelProviderDefinition[];
  };
  runtime?: {
    entry?: string;
    sandbox?: "iframe" | "worker" | "server" | "none";
  };
  metadata?: Record<string, any>;
}

export interface AgentDefinition {
  id: string;
  name: string;
  role: string;
  description?: string;
  icon?: string;
  systemInstruction?: string;
  capabilityKinds?: CapabilityKind[];
  skillIds?: string[];
  modelPreferences?: Partial<Record<CapabilityKind, string>>;
  execute: (task: RuntimeTask, context: RuntimeContext) => Promise<any>;
  // compatibility
  capabilities?: string[];
  skills?: string[];
  modelPreference?: string;
}

export interface CapabilityDefinition {
  id: string;
  name: string;
  kind: CapabilityKind;
  description?: string;
  provider?: string;
  execute: (input: any, context: RuntimeContext) => Promise<any>;
}

export type Capability = CapabilityDefinition; // Compatibility with Capability bus and other imports

export interface ModelProviderDefinition {
  id: string;
  name: string;
  provider: string;
  protocol: "google" | "openai" | "claude" | "custom" | string;
  capabilityKinds?: CapabilityKind[];
  endpoint?: string;
  model?: string;
  apiKeyRef?: string;
  config?: Record<string, any>;
  call: (inputOrMethod: any, contextOrArgs?: any, config?: any) => Promise<any>;
  stream?: (inputOrMethod: any, contextOrArgs?: any, config?: any) => any;
  healthCheck?: () => Promise<boolean>;
  // compatibility:
  capabilities?: {
    text?: boolean;
    image?: boolean;
    video?: boolean;
    vision?: boolean;
    embedding?: boolean;
    tools?: boolean;
  };
}

export type ModelProvider = ModelProviderDefinition; // keep compatibility

export interface PluginUIPanelDefinition {
  id: string;
  name: string;
  mount: "canvas" | "sidebar" | "modal" | "inspector";
  component?: any;
  code?: string;
}

export interface CapabilityResult {
  success: boolean;
  output: any;
  providerUsed: string;
  attempts: number;
  error?: string;
}
