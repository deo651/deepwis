import type { AppSchema } from '@/types/schema';

export interface Template {
  id: string;
  title: string;
  description: string;
  requirement: string;
  schema: AppSchema;
}

const HABIT_SCHEMA: AppSchema = {
  schemaVersion: 1,
  id: 'tmpl_habit',
  name: '每日习惯打卡',
  tagline: '坚持每天打卡，让微小的习惯累积成长',
  category: 'habit',
  emoji: '🌱',
  theme: { primary: '#22c55e', mode: 'light' },
  entity: {
    key: 'habit',
    label: '习惯',
    pluralLabel: '习惯',
    completable: true,
    streakable: true,
    fields: [
      { key: 'title', label: '习惯名称', type: 'text', required: true, showInSummary: true, placeholder: '例如：早起、阅读 30 分钟' },
      { key: 'goal', label: '每日目标', type: 'text', placeholder: '例如：30 分钟', showInSummary: true },
    ],
  },
  stats: [
    { key: 'count', kind: 'count', label: '习惯数量' },
    { key: 'streak', kind: 'streak', label: '最长连续打卡', unit: '天' },
    { key: 'trend', kind: 'weeklyTrend', label: '近 7 天完成趋势' },
  ],
  features: { search: false, filters: [], exportImport: true, themeToggle: true },
  history: ['模板初始化'],
};

const TODO_SCHEMA: AppSchema = {
  schemaVersion: 1,
  id: 'tmpl_todo',
  name: '极简任务清单',
  tagline: '把脑中的待办清空到一个安静的列表里',
  category: 'todo',
  emoji: '✅',
  theme: { primary: '#6366f1', mode: 'light' },
  entity: {
    key: 'task',
    label: '任务',
    pluralLabel: '任务',
    completable: true,
    fields: [
      { key: 'title', label: '任务标题', type: 'text', required: true, showInSummary: true, placeholder: '想做什么？' },
      { key: 'priority', label: '优先级', type: 'priority', default: 'P2', options: ['P0', 'P1', 'P2', 'P3'], showInSummary: true },
      { key: 'due', label: '截止日期', type: 'date', showInSummary: true },
    ],
  },
  stats: [
    { key: 'count', kind: 'count', label: '任务总数' },
    { key: 'done', kind: 'completedCount', label: '已完成' },
  ],
  features: { search: true, filters: [{ field: 'priority', label: '优先级' }], exportImport: true, themeToggle: true },
  history: ['模板初始化'],
};

const EXPENSE_SCHEMA: AppSchema = {
  schemaVersion: 1,
  id: 'tmpl_expense',
  name: '日常记账本',
  tagline: '记录每一笔花费，看清钱去了哪里',
  category: 'expense',
  emoji: '💰',
  theme: { primary: '#f59e0b', mode: 'light' },
  entity: {
    key: 'expense',
    label: '账单',
    pluralLabel: '账单',
    amountField: 'amount',
    groupField: 'category',
    fields: [
      { key: 'title', label: '名称', type: 'text', required: true, showInSummary: true, placeholder: '例如：午餐 / 打车' },
      { key: 'amount', label: '金额', type: 'number', required: true, showInSummary: true, placeholder: '0.00' },
      { key: 'category', label: '分类', type: 'select', options: ['餐饮', '交通', '娱乐', '购物', '住宿', '其他'], default: '餐饮', showInSummary: true },
      { key: 'date', label: '日期', type: 'date', required: true, showInSummary: true },
    ],
  },
  stats: [
    { key: 'sum', kind: 'sum', label: '本月支出', field: 'amount', unit: '¥' },
    { key: 'count', kind: 'count', label: '账单条目' },
    { key: 'pie', kind: 'categoryPie', label: '分类占比', field: 'category' },
  ],
  features: {
    search: true,
    filters: [{ field: 'category', label: '分类' }],
    exportImport: true,
    themeToggle: true,
    groupByDate: true,
  },
  history: ['模板初始化'],
};

const NOTES_SCHEMA: AppSchema = {
  schemaVersion: 1,
  id: 'tmpl_notes',
  name: '灵感笔记本',
  tagline: '随手记录想法和片段，随时可回顾',
  category: 'notes',
  emoji: '📒',
  theme: { primary: '#a855f7', mode: 'light' },
  entity: {
    key: 'note',
    label: '笔记',
    pluralLabel: '笔记',
    fields: [
      { key: 'title', label: '标题', type: 'text', required: true, showInSummary: true },
      { key: 'tag', label: '标签', type: 'tag', placeholder: '想法,工作,生活', showInSummary: true },
      { key: 'content', label: '内容', type: 'longtext', showInSummary: true, placeholder: '写下你的想法...' },
    ],
  },
  stats: [{ key: 'count', kind: 'count', label: '笔记总数' }],
  features: { search: true, filters: [{ field: 'tag', label: '标签' }], exportImport: true, themeToggle: true },
  history: ['模板初始化'],
};

const BOOKMARK_SCHEMA: AppSchema = {
  schemaVersion: 1,
  id: 'tmpl_bookmark',
  name: '我的收藏夹',
  tagline: '把值得回来的链接收好，按标签整理',
  category: 'bookmark',
  emoji: '🔖',
  theme: { primary: '#06b6d4', mode: 'light' },
  entity: {
    key: 'bookmark',
    label: '书签',
    pluralLabel: '书签',
    groupField: 'tag',
    fields: [
      { key: 'title', label: '标题', type: 'text', required: true, showInSummary: true },
      { key: 'url', label: '链接', type: 'url', required: true, showInSummary: true, placeholder: 'https://...' },
      { key: 'tag', label: '标签', type: 'tag', placeholder: '工具,设计,AI', showInSummary: true },
      { key: 'note', label: '备注', type: 'longtext', placeholder: '为什么收藏？' },
    ],
  },
  stats: [{ key: 'count', kind: 'count', label: '书签总数' }],
  features: { search: true, filters: [{ field: 'tag', label: '标签' }], exportImport: true, themeToggle: true },
  history: ['模板初始化'],
};

export const TEMPLATES: Template[] = [
  {
    id: 'tmpl_habit',
    title: '每日习惯打卡',
    description: '支持添加习惯、按天打卡、连续天数与近 7 天趋势统计。',
    requirement: '帮我生成一个每日习惯打卡应用，支持添加习惯、完成打卡、统计连续天数和本周趋势。',
    schema: HABIT_SCHEMA,
  },
  {
    id: 'tmpl_todo',
    title: '极简任务清单',
    description: '搜索、优先级、截止日期、完成状态，一应俱全。',
    requirement: '帮我生成一个任务清单应用，支持搜索、优先级、截止日期和完成状态。',
    schema: TODO_SCHEMA,
  },
  {
    id: 'tmpl_expense',
    title: '日常记账本',
    description: '分类汇总、月度合计、饼图占比，按日期分组浏览。',
    requirement: '帮我生成一个日常记账应用，支持金额、分类、本月支出与分类占比统计。',
    schema: EXPENSE_SCHEMA,
  },
  {
    id: 'tmpl_notes',
    title: '灵感笔记本',
    description: '标签筛选 + 全文搜索，把灵感按标签整理。',
    requirement: '帮我生成一个笔记应用，支持标签和搜索。',
    schema: NOTES_SCHEMA,
  },
  {
    id: 'tmpl_bookmark',
    title: '我的收藏夹',
    description: '收藏链接、加标签、加备注，按标签筛选浏览。',
    requirement: '帮我生成一个书签收藏应用，支持链接、标签、备注和按标签筛选。',
    schema: BOOKMARK_SCHEMA,
  },
];
