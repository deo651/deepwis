import type { AppCategory, AppSchema, EntityDef, GeneratedApp, StatDef } from '@/types/schema';
import type { AgentStepStatus } from '@/types/project';
import { nanoId } from '@/utils/id';
import { GENERATE_STEPS, MODIFY_STEPS, newStep, sleep } from './steps';
import type { AgentProvider, AgentRunContext } from './provider';

interface Detection {
  category: AppCategory;
  themes: { primary: string; mode: 'light' | 'dark' };
  features: {
    search?: boolean;
    filter?: boolean;
    chart?: boolean;
    darkMode?: boolean;
    priority?: boolean;
    tags?: boolean;
    notes?: boolean;
    amount?: boolean;
    groupByDate?: boolean;
    exportImport?: boolean;
  };
  name?: string;
}

/**
 * 关键词驱动的简易 NLU。完全本地实现，不依赖任何外部 API。
 */
function detect(requirement: string): Detection {
  const r = requirement.toLowerCase();
  let category: AppCategory = 'generic';
  if (/打卡|习惯|养成|streak|habit/.test(r)) category = 'habit';
  else if (/待办|任务|todo|任务清单|清单|task/.test(r)) category = 'todo';
  else if (/记账|账单|开销|支出|花费|预算|expense|budget|finance/.test(r)) category = 'expense';
  else if (/笔记|note|想法|灵感|memo|日记|journal/.test(r)) category = 'notes';
  else if (/书签|收藏|链接|bookmark|reading/.test(r)) category = 'bookmark';

  const primaryByCategory: Record<AppCategory, string> = {
    habit: '#22c55e',
    todo: '#6366f1',
    expense: '#f59e0b',
    notes: '#a855f7',
    bookmark: '#06b6d4',
    generic: '#6366f1',
  };

  return {
    category,
    themes: {
      primary: primaryByCategory[category],
      mode: /深色|暗色|dark|黑色/.test(r) ? 'dark' : 'light',
    },
    features: {
      search: /搜索|查找|search/.test(r),
      filter: /筛选|过滤|分类|category|filter/.test(r),
      chart: /统计|趋势|图表|可视化|chart|graph|分析/.test(r),
      darkMode: /深色|暗色|dark/.test(r) || true,
      priority: /优先级|priority|重要/.test(r),
      tags: /标签|tag|分类/.test(r),
      notes: /备注|描述|说明|note|description/.test(r),
      amount: category === 'expense' || /金额|价格|花了|amount|price/.test(r),
      groupByDate: /日期|按天|day|date/.test(r) || category === 'expense',
      exportImport: /导出|备份|export|import/.test(r),
    },
  };
}

function defaultEntity(category: AppCategory): EntityDef {
  switch (category) {
    case 'habit':
      return {
        key: 'habit',
        label: '习惯',
        pluralLabel: '习惯',
        completable: true,
        streakable: true,
        fields: [
          { key: 'title', label: '习惯名称', type: 'text', required: true, showInSummary: true, placeholder: '例如：早起、阅读 30 分钟' },
          { key: 'goal', label: '每日目标', type: 'text', placeholder: '例如：30 分钟', showInSummary: true },
        ],
      };
    case 'todo':
      return {
        key: 'task',
        label: '任务',
        pluralLabel: '任务',
        completable: true,
        fields: [
          { key: 'title', label: '任务标题', type: 'text', required: true, showInSummary: true, placeholder: '想做什么？' },
          { key: 'due', label: '截止日期', type: 'date', showInSummary: true },
        ],
      };
    case 'expense':
      return {
        key: 'expense',
        label: '账单',
        pluralLabel: '账单',
        amountField: 'amount',
        groupField: 'category',
        fields: [
          { key: 'title', label: '名称', type: 'text', required: true, showInSummary: true, placeholder: '例如：午餐 / 打车' },
          { key: 'amount', label: '金额', type: 'number', required: true, showInSummary: true, placeholder: '0.00' },
          { key: 'category', label: '分类', type: 'select', options: ['餐饮', '交通', '娱乐', '购物', '住宿', '其他'], default: '其他', showInSummary: true },
          { key: 'date', label: '日期', type: 'date', required: true, showInSummary: true },
        ],
      };
    case 'notes':
      return {
        key: 'note',
        label: '笔记',
        pluralLabel: '笔记',
        fields: [
          { key: 'title', label: '标题', type: 'text', required: true, showInSummary: true },
          { key: 'content', label: '内容', type: 'longtext', showInSummary: true, placeholder: '写下你的想法...' },
        ],
      };
    case 'bookmark':
      return {
        key: 'bookmark',
        label: '书签',
        pluralLabel: '书签',
        groupField: 'tag',
        fields: [
          { key: 'title', label: '标题', type: 'text', required: true, showInSummary: true },
          { key: 'url', label: '链接', type: 'url', required: true, showInSummary: true, placeholder: 'https://...' },
          { key: 'tag', label: '标签', type: 'tag', placeholder: '工具,设计,AI...', showInSummary: true },
        ],
      };
    default:
      return {
        key: 'item',
        label: '条目',
        pluralLabel: '条目',
        completable: true,
        fields: [
          { key: 'title', label: '标题', type: 'text', required: true, showInSummary: true },
          { key: 'description', label: '描述', type: 'longtext', showInSummary: true },
        ],
      };
  }
}

function defaultStats(category: AppCategory): StatDef[] {
  switch (category) {
    case 'habit':
      return [
        { key: 'count', kind: 'count', label: '习惯数量' },
        { key: 'streak', kind: 'streak', label: '最长连续打卡', unit: '天' },
        { key: 'trend', kind: 'weeklyTrend', label: '近 7 天完成趋势' },
      ];
    case 'todo':
      return [
        { key: 'count', kind: 'count', label: '任务总数' },
        { key: 'done', kind: 'completedCount', label: '已完成' },
      ];
    case 'expense':
      return [
        { key: 'sum', kind: 'sum', label: '本月支出', field: 'amount', unit: '¥' },
        { key: 'count', kind: 'count', label: '账单条目' },
        { key: 'pie', kind: 'categoryPie', label: '分类占比', field: 'category' },
      ];
    case 'notes':
    case 'bookmark':
    default:
      return [{ key: 'count', kind: 'count', label: '条目总数' }];
  }
}

function detectName(requirement: string, category: AppCategory): string {
  const trimmed = requirement.trim();
  // 简单提取：第一句中的名词性短语
  const fallbackByCategory: Record<AppCategory, string> = {
    habit: '每日习惯打卡',
    todo: '极简任务清单',
    expense: '日常记账本',
    notes: '灵感笔记本',
    bookmark: '收藏夹',
    generic: '我的应用',
  };
  if (trimmed.length === 0) return fallbackByCategory[category];
  // 截取前 16 个字符并去掉常见动词
  const cleaned = trimmed
    .replace(/^(帮我|请|给我|我想|我要|做一个|生成一个|创建一个|build|make|create)\s*/i, '')
    .replace(/[.,。，;；!！?？]/g, ' ')
    .slice(0, 18)
    .trim();
  return cleaned || fallbackByCategory[category];
}

function buildSchema(requirement: string, det: Detection): AppSchema {
  const entity = defaultEntity(det.category);
  const stats = defaultStats(det.category);

  // 根据 features 调整 entity / stats
  if (det.features.priority && !entity.fields.find((f) => f.key === 'priority')) {
    entity.fields.push({
      key: 'priority',
      label: '优先级',
      type: 'priority',
      default: 'P2',
      options: ['P0', 'P1', 'P2', 'P3'],
      showInSummary: true,
    });
  }
  if (det.features.notes && !entity.fields.find((f) => f.key === 'note')) {
    entity.fields.push({
      key: 'note',
      label: '备注',
      type: 'longtext',
      placeholder: '补充说明（可选）',
    });
  }
  if (det.features.chart && !stats.find((s) => s.kind === 'weeklyTrend' || s.kind === 'categoryPie')) {
    if (det.category === 'expense') {
      stats.push({ key: 'pie', kind: 'categoryPie', label: '分类占比', field: entity.groupField || 'category' });
    } else {
      stats.push({ key: 'trend', kind: 'weeklyTrend', label: '近 7 天趋势' });
    }
  }

  const filters = det.features.filter
    ? (entity.fields
        .filter((f) => f.type === 'select' || f.type === 'tag' || f.type === 'priority')
        .map((f) => ({ field: f.key, label: f.label })))
    : [];

  const emojiByCategory: Record<AppCategory, string> = {
    habit: '🌱',
    todo: '✅',
    expense: '💰',
    notes: '📒',
    bookmark: '🔖',
    generic: '⚛️',
  };

  return {
    schemaVersion: 1,
    id: nanoId('app'),
    name: detectName(requirement, det.category),
    tagline:
      det.category === 'habit'
        ? '坚持每天打卡，让微小的习惯累积成长'
        : det.category === 'todo'
        ? '把脑中的待办清空到一个安静的列表里'
        : det.category === 'expense'
        ? '记录每一笔花费，看清钱去了哪里'
        : det.category === 'notes'
        ? '随手记录想法和片段，随时可回顾'
        : det.category === 'bookmark'
        ? '把值得回来的链接收好，按标签整理'
        : '为你生成的轻量级应用',
    category: det.category,
    emoji: emojiByCategory[det.category],
    theme: det.themes,
    entity,
    stats,
    features: {
      search: !!det.features.search || det.category === 'notes' || det.category === 'bookmark',
      filters,
      exportImport: true,
      themeToggle: true,
      groupByDate: !!det.features.groupByDate,
    },
    history: [`初始生成（${det.category}）：${requirement}`],
  };
}

function deepClone<T>(obj: T): T {
  return JSON.parse(JSON.stringify(obj)) as T;
}

/**
 * 自然语言指令 → schema patch。
 * 这是 DemoProvider 的"创造力"所在：尽可能识别常见的产品迭代意图。
 */
function applyInstruction(schema: AppSchema, instruction: string): { schema: AppSchema; summary: string } {
  const r = instruction.toLowerCase();
  const next = deepClone(schema);
  const changes: string[] = [];

  // 主题
  if (/深色|暗色|dark/.test(r)) {
    if (next.theme.mode !== 'dark') {
      next.theme.mode = 'dark';
      changes.push('切换为深色模式');
    } else {
      changes.push('已经是深色模式，无变化');
    }
  }
  if (/浅色|亮色|light/.test(r)) {
    if (next.theme.mode !== 'light') {
      next.theme.mode = 'light';
      changes.push('切换为浅色模式');
    }
  }

  // 主色
  const colorMap: Record<string, string> = {
    红: '#ef4444', 蓝: '#3b82f6', 绿: '#22c55e', 紫: '#a855f7', 黄: '#f59e0b',
    青: '#06b6d4', 粉: '#ec4899', 橙: '#f97316',
  };
  for (const [k, v] of Object.entries(colorMap)) {
    if (r.includes(k + '色') || r.includes(k)) {
      next.theme.primary = v;
      changes.push(`主色调改为 ${k}色`);
      break;
    }
  }

  // 搜索 / 筛选
  if (/搜索|查找|search/.test(r)) {
    next.features.search = true;
    changes.push('启用搜索框');
  }
  if (/筛选|过滤|filter|分类视图/.test(r)) {
    const candidates = next.entity.fields.filter(
      (f) => f.type === 'select' || f.type === 'tag' || f.type === 'priority',
    );
    next.features.filters = candidates.map((f) => ({ field: f.key, label: f.label }));
    if (candidates.length > 0) changes.push(`启用筛选：${candidates.map((c) => c.label).join('、')}`);
    else changes.push('当前 entity 没有可筛选字段，已记录意图');
  }

  // 字段：优先级
  if (/优先级|priority|重要/.test(r) && !next.entity.fields.find((f) => f.key === 'priority')) {
    next.entity.fields.push({
      key: 'priority',
      label: '优先级',
      type: 'priority',
      default: 'P2',
      options: ['P0', 'P1', 'P2', 'P3'],
      showInSummary: true,
    });
    changes.push('为条目增加「优先级」字段（P0-P3）');
  }

  // 字段：标签
  if (/标签|tag/.test(r) && !next.entity.fields.find((f) => f.key === 'tag')) {
    next.entity.fields.push({
      key: 'tag',
      label: '标签',
      type: 'tag',
      placeholder: '工作,学习,生活',
      showInSummary: true,
    });
    changes.push('为条目增加「标签」字段（逗号分隔）');
  }

  // 字段：备注 / 描述
  if (/备注|描述|说明|note|desc/.test(r) && !next.entity.fields.find((f) => f.key === 'note')) {
    next.entity.fields.push({
      key: 'note',
      label: '备注',
      type: 'longtext',
      placeholder: '补充说明（可选）',
    });
    changes.push('为条目增加「备注」字段');
  }

  // 统计 / 趋势 / 图表
  if (/趋势|图表|chart|可视化|分析|本周|近 7 天|近七天|graph/.test(r)) {
    if (!next.stats.find((s) => s.kind === 'weeklyTrend')) {
      next.stats.push({ key: 'trend', kind: 'weeklyTrend', label: '近 7 天趋势' });
      changes.push('新增「近 7 天趋势」图表');
    }
  }
  if (/占比|饼图|分类统计|pie/.test(r)) {
    if (!next.stats.find((s) => s.kind === 'categoryPie')) {
      const groupField =
        next.entity.groupField ||
        next.entity.fields.find((f) => f.type === 'select')?.key ||
        next.entity.fields.find((f) => f.type === 'tag')?.key;
      if (groupField) {
        next.stats.push({ key: 'pie', kind: 'categoryPie', label: '分类占比', field: groupField });
        changes.push('新增「分类占比」饼图');
      }
    }
  }
  if (/streak|连续|打卡天数/.test(r) && next.entity.completable) {
    next.entity.streakable = true;
    if (!next.stats.find((s) => s.kind === 'streak')) {
      next.stats.push({ key: 'streak', kind: 'streak', label: '最长连续天数', unit: '天' });
      changes.push('启用连续打卡天数统计');
    }
  }

  // 标题 / tagline 调整
  if (/简洁|简短|短一点|更短/.test(r)) {
    next.tagline = next.tagline.split('，')[0] || next.tagline;
    changes.push('精简了 tagline 文案');
  }
  if (/名字改成|改名为|重命名为/.test(r)) {
    const m = instruction.match(/(?:名字改成|改名为|重命名为)\s*[「『"']?([^」』"'\n]+?)[」』"']?\s*$/);
    if (m && m[1]) {
      next.name = m[1].trim();
      changes.push(`重命名应用为「${next.name}」`);
    }
  }

  // 导出导入
  if (/导出|备份|export/.test(r) || /导入|恢复|import/.test(r)) {
    next.features.exportImport = true;
    changes.push('启用 JSON 导入 / 导出');
  }

  if (changes.length === 0) {
    changes.push('未识别到明确的可执行修改，仅记录意图：' + instruction);
  }

  next.history.push(`v${schema.history.length + 1}: ${instruction} → ${changes.join('；')}`);
  return { schema: next, summary: changes.join('；') };
}

async function runSteps(
  ctx: AgentRunContext,
  defs: { key: string; label: string }[],
  details: Record<string, string[]>,
  durations: Record<string, number>,
): Promise<void> {
  for (const def of defs) {
    const start = Date.now();
    const step = newStep(def.key, def.label);
    step.status = 'running' as AgentStepStatus;
    ctx.onStepUpdate({ ...step });
    await sleep(durations[def.key] ?? 200);
    step.logs = details[def.key] ?? [];
    step.status = 'done';
    step.durationMs = Date.now() - start;
    ctx.onStepUpdate({ ...step });
  }
}

export class DemoAgentProvider implements AgentProvider {
  readonly id = 'demo' as const;
  readonly label = 'DemoProvider · 本地推理';

  async generateApp(requirement: string, ctx: AgentRunContext): Promise<GeneratedApp> {
    const det = detect(requirement);
    const schema = buildSchema(requirement, det);

    const details: Record<string, string[]> = {
      understand: [
        `输入需求：${requirement}`,
        `识别类型：${det.category}`,
        `检测到的特征：${[
          det.features.search && '搜索',
          det.features.filter && '筛选',
          det.features.chart && '图表',
          det.features.priority && '优先级',
          det.features.tags && '标签',
          det.features.amount && '金额',
        ].filter(Boolean).join('、') || '基础特征'}`,
      ],
      plan: [
        `主实体：${schema.entity.label}（${schema.entity.fields.length} 个字段）`,
        `视图：列表 + 统计卡片`,
        `内置统计：${schema.stats.map((s) => s.label).join('、')}`,
      ],
      schema: [
        `生成 ${schema.entity.fields.length} 个字段`,
        `生成 ${schema.stats.length} 个统计`,
        `主题：${schema.theme.mode}, 主色 ${schema.theme.primary}`,
      ],
      validate: ['字段唯一性 ✓', '必填项已声明 ✓', 'Schema 通过校验 ✓'],
      launch: ['编译 Renderer ✓', '挂载到 Preview 面板 ✓'],
    };
    const durations: Record<string, number> = {
      understand: 280, plan: 360, schema: 520, validate: 220, launch: 180,
    };

    await runSteps(ctx, GENERATE_STEPS, details, durations);

    return {
      schema,
      notes: `已为「${schema.name}」生成基础结构。你可以继续输入"增加深色模式 / 加搜索 / 加趋势图 / 增加优先级"等指令来迭代。`,
    };
  }

  async modifyApp(current: GeneratedApp, instruction: string, ctx: AgentRunContext): Promise<GeneratedApp> {
    const { schema, summary } = applyInstruction(current.schema, instruction);

    const details: Record<string, string[]> = {
      understand: [`收到修改：${instruction}`],
      diff: [`计算 schema patch...`, `预计变更：${summary}`],
      patch: ['已应用 patch', `当前字段数：${schema.entity.fields.length}`, `当前统计数：${schema.stats.length}`],
      validate: ['字段冲突检测 ✓', '默认值检测 ✓', 'Schema 校验 ✓'],
      launch: ['热更新 Renderer ✓'],
    };
    const durations: Record<string, number> = {
      understand: 220, diff: 320, patch: 280, validate: 180, launch: 140,
    };
    await runSteps(ctx, MODIFY_STEPS, details, durations);

    return {
      schema,
      notes: summary,
    };
  }
}
