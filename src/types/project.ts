import type { AppSchema } from './schema';

export interface Project {
  id: string;
  name: string;
  requirement: string;
  currentVersionId: string;
  createdAt: number;
  updatedAt: number;
  emoji?: string;
}

export interface AppVersion {
  id: string;
  projectId: string;
  schema: AppSchema;
  /** 触发该版本的指令（首版为初始需求） */
  instruction: string;
  /** 上一版本 id（首版为 null） */
  parentId: string | null;
  createdAt: number;
  /** Agent 总结的变更说明（适合 UI 直接展示） */
  changeSummary: string;
}

export type AgentStepStatus = 'pending' | 'running' | 'done' | 'error';

export interface AgentStep {
  key: string;
  label: string;
  status: AgentStepStatus;
  durationMs?: number;
  /** 子日志，可展开看 */
  logs: string[];
}

export type MessageKind = 'user' | 'plan' | 'log' | 'assistant' | 'error';

export interface AgentMessage {
  id: string;
  projectId: string;
  role: 'user' | 'agent';
  kind: MessageKind;
  /** 主体内容 */
  content: string;
  /** 关联版本 id（如果该消息生成了一个版本） */
  versionId?: string;
  /** 当 kind === 'plan' 时，附带步骤 */
  steps?: AgentStep[];
  createdAt: number;
  /** 标注本次调用所使用的 provider */
  provider?: 'demo' | 'llm';
  /** 当本次调用尝试 LLM 但失败回退时，记录原因 */
  fallbackReason?: string;
}

/**
 * 子应用的运行数据。
 * 这是用户在生成应用中真实交互后的数据，必须持久化。
 */
export interface AppRecord {
  id: string;
  /** 任意字段：由 schema.entity.fields 描述 */
  [key: string]: unknown;
  createdAt: number;
  updatedAt: number;
  /** 当 entity.completable 时：completedDates: ['2026-06-27'] */
  completedDates?: string[];
  /** 当 entity.completable 但不是打卡：直接 done */
  done?: boolean;
}
