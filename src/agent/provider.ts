import type { GeneratedApp } from '@/types/schema';
import type { AgentStep } from '@/types/project';

export interface AgentRunContext {
  /** 当前 agent 正在执行的步骤；Provider 通过该回调更新 UI */
  onStepUpdate(step: AgentStep): void;
  /** 返回 Provider 标识 */
  provider?: 'demo' | 'llm';
}

export interface AgentProvider {
  readonly id: 'demo' | 'llm';
  readonly label: string;
  generateApp(requirement: string, ctx: AgentRunContext): Promise<GeneratedApp>;
  modifyApp(
    current: GeneratedApp,
    instruction: string,
    ctx: AgentRunContext,
  ): Promise<GeneratedApp>;
}
