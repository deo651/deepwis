import { describe, expect, it } from 'vitest';
import { ensureSchema } from './llmProvider';

// 这些是基于真实 LLM (gpt-5.5) 返回的样例，覆盖了实际看到过的偏差。
// 不依赖网络，只测试 ensureSchema 的归一化逻辑。

describe('ensureSchema', () => {
  it('接受完整合法的 schema', () => {
    const raw = {
      schemaVersion: 1,
      id: 'x',
      name: '习惯打卡',
      tagline: '记录习惯',
      category: 'habit',
      emoji: '🌱',
      theme: { primary: '#22c55e', mode: 'dark' },
      entity: {
        key: 'habit',
        label: '习惯',
        pluralLabel: '习惯',
        completable: true,
        streakable: true,
        fields: [
          { key: 'title', label: '习惯名称', type: 'text', required: true, showInSummary: true },
        ],
      },
      stats: [{ key: 'streak', kind: 'streak', label: '连续天数', unit: '天' }],
      features: { search: true, filters: [], exportImport: true, themeToggle: true },
      history: ['首版生成'],
    };
    const s = ensureSchema(raw);
    expect(s.category).toBe('habit');
    expect(s.entity.streakable).toBe(true);
    expect(s.stats[0].kind).toBe('streak');
  });

  it('把"优先级"的 select 自动纠正为 priority 类型', () => {
    const raw = {
      schemaVersion: 1,
      name: '任务',
      category: 'todo',
      entity: {
        key: 'task',
        label: '任务',
        pluralLabel: '任务',
        completable: true,
        fields: [
          { key: 'title', label: '任务', type: 'text', required: true },
          { key: 'priority', label: '优先级', type: 'select', options: ['P0', 'P1', 'P2', 'P3'] },
        ],
      },
      stats: [{ key: 'count', kind: 'count', label: '总数' }],
      features: {},
    };
    const s = ensureSchema(raw);
    const pf = s.entity.fields.find((f) => f.key === 'priority')!;
    expect(pf.type).toBe('priority');
    expect(pf.options).toEqual(['P0', 'P1', 'P2', 'P3']);
  });

  it('priority 字段缺 options 时补默认值', () => {
    const raw = {
      name: '任务',
      category: 'todo',
      entity: {
        key: 'task',
        label: '任务',
        pluralLabel: '任务',
        fields: [
          { key: 'title', label: '任务', type: 'text', required: true },
          { key: 'priority', label: '优先级', type: 'priority' },
        ],
      },
      stats: [],
      features: {},
    };
    const s = ensureSchema(raw);
    const pf = s.entity.fields.find((f) => f.key === 'priority')!;
    expect(pf.options).toEqual(['P0', 'P1', 'P2', 'P3']);
  });

  it('忽略 filters 中多余字段；剔除指向不存在字段的 filter', () => {
    const raw = {
      name: '任务',
      category: 'todo',
      entity: {
        key: 'task',
        label: '任务',
        pluralLabel: '任务',
        fields: [
          { key: 'title', label: '任务', type: 'text', required: true },
          { key: 'priority', label: '优先级', type: 'priority', options: ['P0', 'P1'] },
        ],
      },
      stats: [],
      features: {
        filters: [
          { field: 'priority', label: '优先级', type: 'select', options: ['P0', 'P1'] },
          { field: 'nonexistent', label: '不存在' },
        ],
      },
    };
    const s = ensureSchema(raw);
    expect(s.features.filters).toEqual([{ field: 'priority', label: '优先级' }]);
  });

  it('schemaVersion 缺失 / 非数字时归一化为 1', () => {
    const s = ensureSchema({
      name: '随手',
      category: 'notes',
      entity: {
        key: 'note',
        label: '笔记',
        pluralLabel: '笔记',
        fields: [{ key: 'title', label: '标题', type: 'text', required: true }],
      },
      stats: [],
      features: {},
    });
    expect(s.schemaVersion).toBe(1);
  });

  it('未知 category 归为 generic 并补 emoji', () => {
    const s = ensureSchema({
      name: '其他',
      category: 'foobar',
      entity: {
        key: 'x',
        label: '条目',
        pluralLabel: '条目',
        fields: [{ key: 'title', label: '标题', type: 'text' }],
      },
      stats: [],
      features: {},
    });
    expect(s.category).toBe('generic');
    expect(s.emoji).toBe('⚛️');
  });

  it('非法字段 type 退回 text，并去除重复 key', () => {
    const s = ensureSchema({
      name: 'X',
      category: 'generic',
      entity: {
        key: 'x',
        label: 'X',
        pluralLabel: 'X',
        fields: [
          { key: 'title', label: '标题', type: 'fancy' as unknown as string, required: true },
          { key: 'title', label: '重复', type: 'text' },
          { key: 'note', label: '备注', type: 'longtext' },
        ],
      },
      stats: [],
      features: {},
    });
    expect(s.entity.fields).toHaveLength(2);
    expect(s.entity.fields[0].type).toBe('text');
  });

  it('streak 类 stat 自动开启 streakable + completable', () => {
    const s = ensureSchema({
      name: 'X',
      category: 'habit',
      entity: {
        key: 'h',
        label: '习惯',
        pluralLabel: '习惯',
        completable: false,
        streakable: false,
        fields: [{ key: 'title', label: '名称', type: 'text', required: true }],
      },
      stats: [{ key: 's', kind: 'streak', label: '连续' }],
      features: {},
    });
    expect(s.entity.streakable).toBe(true);
    expect(s.entity.completable).toBe(true);
  });

  it('校正 amountField 指向不存在字段时回退到 number 字段', () => {
    const s = ensureSchema({
      name: '记账',
      category: 'expense',
      entity: {
        key: 'e',
        label: '账单',
        pluralLabel: '账单',
        amountField: 'wrong',
        fields: [
          { key: 'title', label: '名称', type: 'text', required: true },
          { key: 'price', label: '金额', type: 'number' },
        ],
      },
      stats: [],
      features: {},
    });
    expect(s.entity.amountField).toBe('price');
  });

  it('非法 theme.primary 回退默认色', () => {
    const s = ensureSchema({
      name: 'X',
      category: 'generic',
      theme: { primary: 'red', mode: 'dark' },
      entity: {
        key: 'x',
        label: 'X',
        pluralLabel: 'X',
        fields: [{ key: 'title', label: 'T', type: 'text', required: true }],
      },
      stats: [],
      features: {},
    });
    expect(s.theme.primary).toMatch(/^#[0-9a-fA-F]{3,8}$/);
  });

  it('完全缺 entity 时抛错', () => {
    expect(() => ensureSchema({ name: 'X', category: 'generic' })).toThrow();
  });

  it('entity.fields 空时抛错', () => {
    expect(() =>
      ensureSchema({
        name: 'X',
        category: 'generic',
        entity: { key: 'x', label: 'X', pluralLabel: 'X', fields: [] },
      }),
    ).toThrow();
  });

  it('theme.mode 缺省时默认为 light（默认浅色）', () => {
    const s = ensureSchema({
      name: 'X',
      category: 'generic',
      theme: { primary: '#6366f1' },
      entity: {
        key: 'x',
        label: 'X',
        pluralLabel: 'X',
        fields: [{ key: 'title', label: 'T', type: 'text', required: true }],
      },
      stats: [],
      features: {},
    });
    expect(s.theme.mode).toBe('light');
  });

  it('theme.mode = "dark" 时仍然保留为 dark', () => {
    const s = ensureSchema({
      name: 'X',
      category: 'generic',
      theme: { primary: '#6366f1', mode: 'dark' },
      entity: {
        key: 'x',
        label: 'X',
        pluralLabel: 'X',
        fields: [{ key: 'title', label: 'T', type: 'text', required: true }],
      },
      stats: [],
      features: {},
    });
    expect(s.theme.mode).toBe('dark');
  });
});
