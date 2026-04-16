export type Role = "user" | "assistant" | "tool" | "system";

export type ToolCall = {
  id: string;
  name: string;
  args: string;
  result?: string;
  charts?: string[];
  stdout?: string;
  error?: string;
  done?: boolean;
};

export type StepBadge = {
  id: string;
  name: string;
  finished?: boolean;
};

export type Message = {
  id: string;
  role: Role;
  content: string;
  toolCalls?: ToolCall[];
  steps?: StepBadge[];
  plan?: string;
  opener?: string;
  streaming?: boolean;
  reportPath?: string;
};

export type AguiEvent = {
  type: string;
  [key: string]: any;
};
