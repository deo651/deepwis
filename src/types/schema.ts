/**
 * AtomForge 的应用 Schema 定义
 *
 * 设计原则：保持单实体单视图的简单结构，借助 features / stats 描述能力。
 * 通用 Renderer 据此渲染一个真正可交互的小应用。
 */

export type FieldType =
  | 'text'
  | 'longtext'
  | 'number'
  | 'boolean'
  | 'date'
  | 'select'
  | 'priority'
  | 'url'
  | 'tag';

export interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: string[];
  required?: boolean;
  placeholder?: string;
  default?: unknown;
  /** UI 中是否在卡片摘要中显示 */
  showInSummary?: boolean;
}

export interface EntityDef {
  key: string;
  label: string;
  pluralLabel: string;
  icon?: string;
  fields: FieldDef[];
  /** 是否带"完成 / 未完成"概念 */
  completable?: boolean;
  /** 是否计算连续达成天数 */
  streakable?: boolean;
  /** 用于 sum 统计的字段 */
  amountField?: string;
  /** 用于分组的字段 */
  groupField?: string;
}

export type StatKind =
  | 'count'
  | 'completedCount'
  | 'sum'
  | 'streak'
  | 'weeklyTrend'
  | 'categoryPie';

export interface StatDef {
  key: string;
  kind: StatKind;
  label: string;
  field?: string;
  unit?: string;
}

export interface FilterDef {
  field: string;
  label: string;
}

export interface FeatureDef {
  search?: boolean;
  filters?: FilterDef[];
  exportImport?: boolean;
  /** 应用内提供深色 / 浅色切换 */
  themeToggle?: boolean;
  /** 是否按日期分组卡片 */
  groupByDate?: boolean;
}

export interface AppTheme {
  /** 主色 (HEX) */
  primary: string;
  /** 应用预览的视觉模式 */
  mode: 'light' | 'dark';
}

export type AppCategory = 'todo' | 'habit' | 'expense' | 'notes' | 'bookmark' | 'generic';

export interface AppSchema {
  /** schema 自身的 id 与 schemaVersion，便于未来演进 */
  schemaVersion: 1;
  id: string;
  name: string;
  tagline: string;
  category: AppCategory;
  emoji: string;
  theme: AppTheme;
  entity: EntityDef;
  stats: StatDef[];
  features: FeatureDef;
  /** 修改历史摘要（追加，便于在 UI 中展示决策路径） */
  history: string[];
}

export interface GeneratedApp {
  schema: AppSchema;
  /** Agent 视为辅助的 README / 说明 */
  notes: string;
}
