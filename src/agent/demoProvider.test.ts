import { describe, expect, it } from 'vitest';
import { DemoAgentProvider } from './demoProvider';
import type { AgentStep } from '@/types/project';

function collectCtx() {
  const steps: AgentStep[] = [];
  return {
    steps,
    onStepUpdate(step: AgentStep) {
      const idx = steps.findIndex((s) => s.key === step.key);
      if (idx >= 0) steps[idx] = step;
      else steps.push(step);
    },
  };
}

describe('DemoAgentProvider', () => {
  const provider = new DemoAgentProvider();

  it('生成习惯打卡应用', async () => {
    const ctx = collectCtx();
    const out = await provider.generateApp(
      '帮我生成一个每日习惯打卡应用，支持添加习惯、完成打卡、统计连续天数',
      ctx,
    );
    expect(out.schema.category).toBe('habit');
    expect(out.schema.entity.streakable).toBe(true);
    expect(out.schema.entity.completable).toBe(true);
    expect(out.schema.stats.some((s) => s.kind === 'streak')).toBe(true);
    expect(ctx.steps.length).toBeGreaterThanOrEqual(5);
    expect(ctx.steps.every((s) => s.status === 'done')).toBe(true);
  });

  it('生成记账应用并包含金额字段', async () => {
    const ctx = collectCtx();
    const out = await provider.generateApp('帮我做一个记账应用，统计本月支出和分类占比', ctx);
    expect(out.schema.category).toBe('expense');
    expect(out.schema.entity.fields.find((f) => f.key === 'amount')).toBeTruthy();
    expect(out.schema.stats.some((s) => s.kind === 'sum')).toBe(true);
    expect(out.schema.stats.some((s) => s.kind === 'categoryPie')).toBe(true);
  });

  it('修改指令：增加深色模式', async () => {
    const ctx = collectCtx();
    const initial = await provider.generateApp('帮我生成一个任务清单', ctx);
    initial.schema.theme.mode = 'light';
    const ctx2 = collectCtx();
    const updated = await provider.modifyApp(initial, '把界面改成深色模式', ctx2);
    expect(updated.schema.theme.mode).toBe('dark');
    expect(updated.schema.history.length).toBeGreaterThan(initial.schema.history.length);
  });

  it('修改指令：增加优先级字段', async () => {
    const ctx = collectCtx();
    const initial = await provider.generateApp('帮我生成一个任务清单', ctx);
    const ctx2 = collectCtx();
    const updated = await provider.modifyApp(initial, '给每条任务加上优先级 P0-P3', ctx2);
    expect(updated.schema.entity.fields.find((f) => f.key === 'priority')).toBeTruthy();
  });

  it('修改指令：增加本周趋势图', async () => {
    const ctx = collectCtx();
    const initial = await provider.generateApp('帮我生成一个习惯打卡', ctx);
    initial.schema.stats = initial.schema.stats.filter((s) => s.kind !== 'weeklyTrend');
    const ctx2 = collectCtx();
    const updated = await provider.modifyApp(initial, '加上近 7 天趋势图', ctx2);
    expect(updated.schema.stats.some((s) => s.kind === 'weeklyTrend')).toBe(true);
  });

  it('修改指令：未识别意图仍返回新版本并记录原文', async () => {
    const ctx = collectCtx();
    const initial = await provider.generateApp('做一个任务清单', ctx);
    const ctx2 = collectCtx();
    const updated = await provider.modifyApp(initial, '我想想再说', ctx2);
    expect(updated.schema.history.length).toBe(initial.schema.history.length + 1);
  });
});
