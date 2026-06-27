import { describe, expect, it } from 'vitest';
import { computeStat, filterAndSearchRecords } from './utils';
import type { AppSchema } from '@/types/schema';
import type { AppRecord } from '@/types/project';

const habitSchema: AppSchema = {
  schemaVersion: 1,
  id: 't',
  name: 'h',
  tagline: '',
  category: 'habit',
  emoji: '🌱',
  theme: { primary: '#22c55e', mode: 'dark' },
  entity: {
    key: 'habit',
    label: '习惯',
    pluralLabel: '习惯',
    completable: true,
    streakable: true,
    fields: [{ key: 'title', label: '名称', type: 'text', required: true }],
  },
  stats: [],
  features: {},
  history: [],
};

describe('computeStat', () => {
  it('streak 计算最长连续天数', () => {
    const records: AppRecord[] = [
      {
        id: 'r1',
        title: '阅读',
        completedDates: ['2026-06-25', '2026-06-26', '2026-06-27'],
        createdAt: 0,
        updatedAt: 0,
      },
    ];
    const r = computeStat({ key: 's', kind: 'streak', label: 'streak' }, records, habitSchema);
    expect(r.value).toBe('3');
  });

  it('count 统计条数', () => {
    const records: AppRecord[] = [
      { id: 'r1', title: 'a', createdAt: 0, updatedAt: 0 },
      { id: 'r2', title: 'b', createdAt: 0, updatedAt: 0 },
    ];
    const r = computeStat({ key: 's', kind: 'count', label: '总数' }, records, habitSchema);
    expect(r.value).toBe('2');
  });
});

describe('filterAndSearchRecords', () => {
  it('搜索按字段子串匹配', () => {
    const records: AppRecord[] = [
      { id: 'r1', title: '早起阅读', createdAt: 0, updatedAt: 0 },
      { id: 'r2', title: '运动', createdAt: 0, updatedAt: 0 },
    ];
    const r = filterAndSearchRecords(records, habitSchema, '阅读', {});
    expect(r).toHaveLength(1);
    expect(r[0].id).toBe('r1');
  });
});
