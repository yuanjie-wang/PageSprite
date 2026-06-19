export interface Point {
  x: number;
  y: number;
}

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type AnnotationType = "pen" | "rect" | "arrow" | "text" | "highlight" | "rectangle" | "ellipse";

export interface Annotation {
  id: string;
  type: AnnotationType;
  points: Point[];
  boundingBox?: BoundingBox;
  color: string;
  text?: string;
  generatedCode?: string;
  createdAt: number;
  parentId?: string;
  promptWidth?: string;
  promptHeight?: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  code?: string;
  annotations?: Annotation[];
  timestamp: number;
}

export interface AISettings {
  endpoint: string;
  apiKey: string;
  model: string;
  systemPrompt: string;
  agentType: AgentType;
  agentCommand?: string;
  agentArgsTemplate?: string;
}

export type ToolType = "cursor" | "pan" | "pen" | "rect" | "arrow" | "text" | "highlight" | "rectangle" | "ellipse";

export type WorkspaceStatus = "empty" | "loading" | "ready" | "error";

export type SnapLine = {
  orientation: "v" | "h";
  pos: number;
};

export type AgentType = "streaming" | "opencode" | "claude" | "custom";
