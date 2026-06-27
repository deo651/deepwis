import type { AgentStep } from '@/types/project';

export const GENERATE_STEPS: { key: string; label: string }[] = [
  { key: 'understand', label: '理解需求' },
  { key: 'plan', label: '拆解功能' },
  { key: 'schema', label: '生成应用 Schema' },
  { key: 'validate', label: '校验与修复' },
  { key: 'launch', label: '启动预览' },
];

export const MODIFY_STEPS: { key: string; label: string }[] = [
  { key: 'understand', label: '解析修改指令' },
  { key: 'diff', label: '推演变更影响' },
  { key: 'patch', label: '更新 Schema' },
  { key: 'validate', label: '校验与修复' },
  { key: 'launch', label: '刷新预览' },
];

export function newStep(key: string, label: string): AgentStep {
  return { key, label, status: 'pending', logs: [] };
}

/** 简易延时，给 UI 留出感知 Agent 执行过程的时间 */
export function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}
