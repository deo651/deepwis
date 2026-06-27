import type { AppSchema, FieldDef, FieldType, StatDef, StatKind } from '@/types/schema';
import type { GeneratedApp } from '@/types/schema';
import type { AgentProvider, AgentRunContext } from './provider';
import { GENERATE_STEPS, MODIFY_STEPS, newStep, sleep } from './steps';

export interface LLMConfig {
  /** 仅承载模型名用于 UI 展示，真正的 API key / endpoint 仅在服务器端持有 */
  model: string;
}

/**
 * 通过同源 `/api/llm/status` 探测服务器端是否配置了 LLM。
 *
 * 安全约束：
 * - `.env` 中的 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL 仅由 Vite plugin
 *   `atomforge-llm-proxy`（见 vite.config.ts）在 Node 进程内存中读取。
 * - 浏览器**永远不接触** Key；前端只能通过 POST `/api/llm/chat` 间接调用 LLM。
 * - 任何情况下都不要把 Key 写入 import.meta.env 或 bundle。
 */
export async function readLLMConfigFromServer(): Promise<LLMConfig | null> {
  try {
    const res = await fetch('/api/llm/status', { method: 'GET', cache: 'no-store' });
    if (!res.ok) return null;
    const data = (await res.json()) as { available?: boolean; model?: string };
    if (!data.available || !data.model) return null;
    return { model: data.model };
  } catch {
    return null;
  }
}

const SYSTEM_PROMPT_GENERATE = `You are AtomForge, a senior product engineer Agent that converts product
requirements into a strict JSON AppSchema. You MUST return ONLY a single JSON object.
NEVER include explanations, code fences, or markdown.

AppSchema TypeScript shape:
{
  "schemaVersion": 1,
  "id": "kebab",
  "name": "中文短词（如：每日习惯打卡）",
  "tagline": "中文一句话",
  "category": "todo" | "habit" | "expense" | "notes" | "bookmark" | "generic",
  "emoji": "单个 emoji，与品类匹配（habit→🌱, todo→✅, expense→💰, notes→📒, bookmark→🔖）",
  "theme": { "primary": "#hex", "mode": "light" | "dark" },  // 默认 "light"，除非用户明确要求深色
  "entity": {
    "key": "kebab-case 英文",
    "label": "中文短词",
    "pluralLabel": "中文短词",
    "completable": boolean (true 表示条目带"完成"开关或打卡概念),
    "streakable": boolean (true 表示按天打卡，需要连续天数统计),
    "amountField": "(可选) 用于汇总的字段 key（仅 expense 类）",
    "groupField": "(可选) 用于分组/筛选的字段 key",
    "fields": [
      {
        "key": "英文 kebab",
        "label": "中文",
        "type": "text" | "longtext" | "number" | "boolean" | "date" | "select" | "priority" | "url" | "tag",
        "required": boolean,
        "showInSummary": boolean,
        "options": ["..."] (仅 select / priority 需要; priority 推荐 ["P0","P1","P2","P3"]),
        "placeholder": "(可选)",
        "default": (可选)
      }
    ]
  },
  "stats": [
    {
      "key": "id",
      "kind": "count" | "completedCount" | "sum" | "streak" | "weeklyTrend" | "categoryPie",
      "label": "中文",
      "field": "(可选) 关联字段 key",
      "unit": "(可选) 单位"
    }
  ],
  "features": {
    "search": boolean,
    "filters": [{ "field": "字段 key", "label": "中文" }],
    "exportImport": boolean,
    "themeToggle": boolean,
    "groupByDate": boolean
  },
  "history": ["首版生成"]
}

强制规则：
1. 输出仅一个 JSON 对象，不允许任何 prose / markdown。
2. 所有 label、name、tagline 一律使用中文。
3. 优先级字段 type 必须使用 "priority"（不要用 "select"）。
4. filters 数组的每个元素仅允许 { field, label } 两个字段。
5. emoji 必须是单个表情字符。
6. fields 至少包含一个 "title" 字段（type=text, required=true, showInSummary=true）。
7. 与"打卡 / 习惯 / 连续天数"相关需求，entity.streakable=true 且 stats 应含 kind=streak 与 weeklyTrend。
8. 与"记账 / 金额 / 支出"相关需求，entity.amountField 应指向 number 字段，stats 应含 sum 与 categoryPie。`;

const SYSTEM_PROMPT_MODIFY = `You are AtomForge, modifying an existing AppSchema based on a user instruction.
Return ONLY the updated AppSchema JSON. Preserve existing ids, field keys, and entity.key whenever possible.
Use Chinese for all labels. NEVER include prose, code fences, or markdown.

强制规则（critically important）：
1. 仅输出一个 JSON 对象。
2. 修改必须真实体现在结构化字段上，不允许只追加 history 而结构未变。例如：
   - "增加趋势图 / 近 7 天趋势" → stats 必须包含一个 { kind: "weeklyTrend", label: "近 7 天趋势" }。
   - "增加分类占比 / 饼图" → stats 必须包含 { kind: "categoryPie", label: "分类占比", field: "<已有的分类字段 key>" }。
   - "增加优先级 / P0-P3" → entity.fields 必须新增 { key: "priority", label: "优先级", type: "priority", options: ["P0","P1","P2","P3"], showInSummary: true }。
   - "增加搜索" → features.search = true。
   - "增加按 X 筛选" → features.filters 中追加 { field: "<X 对应字段 key>", label: "<中文>" }，且 field 必须是 fields 中存在的 key。
   - "深色模式" → theme.mode = "dark"。
   - "浅色模式" → theme.mode = "light"。
   - "改成 XX 色" → theme.primary 改为对应 hex。
   - "重命名为 XX" → name = "XX"。
3. 优先级字段 type 必须使用 "priority"，不要用 "select"。
4. filters 数组每个元素只允许 { field, label } 两个 key。
5. 在 schema.history 末尾追加恰好一行中文，描述本次具体变更（结构上的）。
6. 不要删除既有字段 / 统计 / 数据，除非指令明确要求。`;

/** 单次 LLM 调用上限：60s（reasoning model 通常 5~20s，60s 足够留出余量） */
const LLM_TIMEOUT_MS = 60_000;

/**
 * 通过同源代理调用 LLM。
 *
 * - 前端只调 `/api/llm/chat`，由 vite.config.ts 中的 LLM proxy plugin 在 Node 进程内
 *   读取 `.env` 中的 LLM_BASE_URL / LLM_API_KEY / LLM_MODEL 并代为转发到真实 LLM 端点。
 * - 前端永远不接触 baseUrl / apiKey；这两个值不会出现在 dist bundle 中。
 */
async function callChatJSON(_cfg: LLMConfig, system: string, user: string): Promise<unknown> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), LLM_TIMEOUT_MS);
  let res: Response;
  try {
    res = await fetch('/api/llm/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ system, user }),
      signal: controller.signal,
    });
  } catch (e) {
    clearTimeout(timer);
    if ((e as Error).name === 'AbortError') {
      throw new Error(`LLM 调用超过 ${Math.round(LLM_TIMEOUT_MS / 1000)}s 超时`);
    }
    throw new Error(`LLM 网络错误：${(e as Error).message}`);
  }
  clearTimeout(timer);

  if (!res.ok) {
    let detail = '';
    try {
      const data = (await res.json()) as { error?: string };
      detail = data.error ?? '';
    } catch {
      detail = await res.text().catch(() => '');
    }
    throw new Error(`LLM HTTP ${res.status}${detail ? ': ' + detail.slice(0, 200) : ''}`);
  }
  const data = (await res.json()) as { content?: string; error?: string };
  if (data.error) throw new Error(data.error);
  const content = data.content ?? '';
  if (!content) throw new Error('LLM 返回空内容');
  try {
    return JSON.parse(content);
  } catch (_e) {
    // 兜底：尝试从首个 { 到最后一个 } 抢救
    const start = content.indexOf('{');
    const end = content.lastIndexOf('}');
    if (start !== -1 && end !== -1 && end > start) {
      return JSON.parse(content.slice(start, end + 1));
    }
    throw new Error('LLM 返回非合法 JSON');
  }
}

const VALID_FIELD_TYPES: ReadonlyArray<FieldType> = [
  'text', 'longtext', 'number', 'boolean', 'date', 'select', 'priority', 'url', 'tag',
];

const VALID_STAT_KINDS: ReadonlyArray<StatKind> = [
  'count', 'completedCount', 'sum', 'streak', 'weeklyTrend', 'categoryPie',
];

const DEFAULT_EMOJI: Record<string, string> = {
  habit: '🌱', todo: '✅', expense: '💰', notes: '📒', bookmark: '🔖', generic: '⚛️',
};

/**
 * 把 LLM 返回的 JSON 归一化为合法的 AppSchema。
 * 容忍：字段缺失 / 类型微偏差 / 多余字段 / 中文键名等。
 * 一旦发现核心结构无法修复（缺 entity / fields），抛错让上层回退。
 *
 * @internal 仅供测试与 LLMProvider 内部使用
 */
export function ensureSchema(raw: unknown): AppSchema {
  if (typeof raw !== 'object' || raw === null) {
    throw new Error('Schema 非对象');
  }
  const s = raw as Record<string, unknown>;

  // category
  const validCategories = ['todo', 'habit', 'expense', 'notes', 'bookmark', 'generic'] as const;
  const category = (validCategories as ReadonlyArray<string>).includes(s.category as string)
    ? (s.category as AppSchema['category'])
    : 'generic';

  // theme
  const themeRaw = (s.theme as Record<string, unknown>) ?? {};
  const theme = {
    primary: typeof themeRaw.primary === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(themeRaw.primary)
      ? themeRaw.primary
      : '#6366f1',
    mode: (themeRaw.mode === 'dark' ? 'dark' : 'light') as 'light' | 'dark',
  };

  // entity
  const entityRaw = s.entity as Record<string, unknown> | undefined;
  if (!entityRaw || typeof entityRaw !== 'object') throw new Error('Schema 缺少 entity');
  const fieldsRaw = entityRaw.fields;
  if (!Array.isArray(fieldsRaw) || fieldsRaw.length === 0) throw new Error('entity.fields 不能为空');

  const seenKeys = new Set<string>();
  const fields: FieldDef[] = [];
  for (const fRaw of fieldsRaw as Array<Record<string, unknown>>) {
    if (!fRaw || typeof fRaw !== 'object') continue;
    const key = typeof fRaw.key === 'string' && fRaw.key.trim() ? fRaw.key.trim() : '';
    const label = typeof fRaw.label === 'string' && fRaw.label.trim() ? fRaw.label.trim() : key;
    if (!key || !label) continue;
    if (seenKeys.has(key)) continue;
    seenKeys.add(key);

    let type = (fRaw.type as FieldType) ?? 'text';
    if (!VALID_FIELD_TYPES.includes(type)) type = 'text';

    let options = Array.isArray(fRaw.options)
      ? (fRaw.options as unknown[]).map(String).filter((x) => x.length > 0)
      : undefined;

    // 当 LLM 把"优先级"写成 select 时，尝试纠正回 priority
    if (
      type === 'select' &&
      (key.toLowerCase().includes('priority') || /优先级/.test(label)) &&
      options &&
      options.length > 0
    ) {
      type = 'priority';
    }
    // 当 type 是 priority 但没给 options，补一个标准值
    if (type === 'priority' && (!options || options.length === 0)) {
      options = ['P0', 'P1', 'P2', 'P3'];
    }

    fields.push({
      key,
      label,
      type,
      options,
      required: !!fRaw.required,
      showInSummary: fRaw.showInSummary === undefined ? type !== 'longtext' : !!fRaw.showInSummary,
      placeholder: typeof fRaw.placeholder === 'string' ? fRaw.placeholder : undefined,
      default: fRaw.default,
    });
  }

  // 必须至少有一个 title-ish 字段，否则补一个
  if (!fields.some((f) => f.required || ['title', 'name'].includes(f.key))) {
    fields[0] = { ...fields[0], required: true, showInSummary: true };
  }

  const entityKey = typeof entityRaw.key === 'string' && entityRaw.key.trim()
    ? entityRaw.key.trim()
    : (category === 'generic' ? 'item' : category);
  const entityLabel = typeof entityRaw.label === 'string' && entityRaw.label.trim()
    ? entityRaw.label.trim()
    : '条目';

  const entity: AppSchema['entity'] = {
    key: entityKey,
    label: entityLabel,
    pluralLabel: typeof entityRaw.pluralLabel === 'string' && entityRaw.pluralLabel.trim()
      ? entityRaw.pluralLabel.trim()
      : entityLabel,
    completable: !!entityRaw.completable,
    streakable: !!entityRaw.streakable,
    amountField: typeof entityRaw.amountField === 'string' ? entityRaw.amountField : undefined,
    groupField: typeof entityRaw.groupField === 'string' ? entityRaw.groupField : undefined,
    fields,
  };

  // 校正 amountField / groupField 指向真实字段
  if (entity.amountField && !fields.some((f) => f.key === entity.amountField)) {
    entity.amountField = fields.find((f) => f.type === 'number')?.key;
  }
  if (entity.groupField && !fields.some((f) => f.key === entity.groupField)) {
    entity.groupField = fields.find((f) => f.type === 'select' || f.type === 'tag')?.key;
  }

  // stats
  const statsRaw = Array.isArray(s.stats) ? (s.stats as Array<Record<string, unknown>>) : [];
  const stats: StatDef[] = [];
  for (const stRaw of statsRaw) {
    if (!stRaw || typeof stRaw !== 'object') continue;
    const kind = stRaw.kind as StatKind;
    if (!VALID_STAT_KINDS.includes(kind)) continue;
    const label = typeof stRaw.label === 'string' && stRaw.label.trim() ? stRaw.label.trim() : kind;
    const key = typeof stRaw.key === 'string' && stRaw.key.trim() ? stRaw.key.trim() : kind;
    stats.push({
      key,
      kind,
      label,
      field: typeof stRaw.field === 'string' ? stRaw.field : undefined,
      unit: typeof stRaw.unit === 'string' ? stRaw.unit : undefined,
    });
  }
  if (stats.length === 0) {
    stats.push({ key: 'count', kind: 'count', label: '总数' });
  }
  // streak 类需要 streakable
  if (stats.some((s) => s.kind === 'streak') && !entity.streakable) {
    entity.streakable = true;
    entity.completable = true;
  }

  // features
  const featRaw = (s.features as Record<string, unknown>) ?? {};
  const filtersRaw = Array.isArray(featRaw.filters) ? (featRaw.filters as Array<Record<string, unknown>>) : [];
  const filters = filtersRaw
    .map((f) => {
      const field = typeof f.field === 'string' ? f.field : undefined;
      const label = typeof f.label === 'string' ? f.label : field;
      if (!field) return null;
      if (!fields.some((x) => x.key === field)) return null; // 必须指向真实字段
      return { field, label: label ?? field };
    })
    .filter((x): x is { field: string; label: string } => x !== null);

  const features: AppSchema['features'] = {
    search: !!featRaw.search,
    filters,
    exportImport: featRaw.exportImport === undefined ? true : !!featRaw.exportImport,
    themeToggle: featRaw.themeToggle === undefined ? true : !!featRaw.themeToggle,
    groupByDate: !!featRaw.groupByDate,
  };

  // emoji 严格单字符 emoji（粗略）
  let emoji = typeof s.emoji === 'string' ? s.emoji.trim() : '';
  if (!emoji || emoji.length > 4) emoji = DEFAULT_EMOJI[category];

  const history = Array.isArray(s.history)
    ? (s.history as unknown[]).map(String).filter((x) => x.length > 0)
    : [];
  if (history.length === 0) history.push('LLM 生成');

  const name = typeof s.name === 'string' && s.name.trim() ? s.name.trim() : '我的应用';
  const tagline = typeof s.tagline === 'string' && s.tagline.trim() ? s.tagline.trim() : 'AI 生成的轻量级应用';
  const id = typeof s.id === 'string' && s.id.trim() ? s.id.trim() : `app_${Date.now().toString(36)}`;

  return {
    schemaVersion: 1,
    id,
    name,
    tagline,
    category,
    emoji,
    theme,
    entity,
    stats,
    features,
    history,
  };
}

/**
 * LLMProvider：可选启用。
 *
 * 步骤策略：
 * - 先让 UI 的"理解 / 拆解"步骤短暂跑过（给用户进度感）；
 * - 在 "schema" 步骤里 await 真实的 LLM；
 * - 完成后快速跑完"校验 / 启动"两步。
 * 这样即使 LLM 需要 5~10s，UI 也始终有可见的状态变化。
 */
export class LLMAgentProvider implements AgentProvider {
  readonly id = 'llm' as const;
  readonly label = 'LLMProvider · 真实模型';
  private readonly cfg: LLMConfig;

  constructor(cfg: LLMConfig) {
    this.cfg = cfg;
  }

  async generateApp(requirement: string, ctx: AgentRunContext): Promise<GeneratedApp> {
    let schema: AppSchema | null = null;
    for (const def of GENERATE_STEPS) {
      const step = newStep(def.key, def.label);
      step.status = 'running';
      ctx.onStepUpdate({ ...step });
      const start = Date.now();
      try {
        if (def.key === 'schema') {
          step.logs = [`调用 ${this.cfg.model}（response_format=json_object）...`];
          ctx.onStepUpdate({ ...step });
          const raw = await callChatJSON(this.cfg, SYSTEM_PROMPT_GENERATE, `用户需求：${requirement}`);
          schema = ensureSchema(raw);
          step.logs.push(
            `LLM 返回合法 Schema · 字段 ${schema.entity.fields.length} 个 · 统计 ${schema.stats.length} 项`,
          );
          step.status = 'done';
          step.durationMs = Date.now() - start;
          ctx.onStepUpdate({ ...step });
        } else if (def.key === 'validate') {
          step.logs = [
            '字段唯一性 ✓',
            schema && schema.features.filters
              ? `筛选指向 ${schema.features.filters.length} 个字段 ✓`
              : '筛选检查 ✓',
            'Schema 通过校验 ✓',
          ];
          await sleep(180);
          step.status = 'done';
          step.durationMs = Date.now() - start;
          ctx.onStepUpdate({ ...step });
        } else {
          await sleep(180);
          step.status = 'done';
          step.durationMs = Date.now() - start;
          ctx.onStepUpdate({ ...step });
        }
      } catch (e) {
        step.status = 'error';
        step.logs.push(`LLM 调用失败：${(e as Error).message}`);
        ctx.onStepUpdate({ ...step });
        throw e;
      }
    }
    if (!schema) throw new Error('LLM provider 未生成 schema');
    return { schema, notes: `LLM 生成完成。模型：${this.cfg.model}。可继续输入修改指令。` };
  }

  async modifyApp(current: GeneratedApp, instruction: string, ctx: AgentRunContext): Promise<GeneratedApp> {
    let schema: AppSchema | null = null;
    for (const def of MODIFY_STEPS) {
      const step = newStep(def.key, def.label);
      step.status = 'running';
      ctx.onStepUpdate({ ...step });
      const start = Date.now();
      try {
        if (def.key === 'patch') {
          const userMsg = `当前 schema (JSON):\n${JSON.stringify(current.schema)}\n\n修改指令：${instruction}`;
          step.logs = [`调用 ${this.cfg.model} 生成 patch...`];
          ctx.onStepUpdate({ ...step });
          const raw = await callChatJSON(this.cfg, SYSTEM_PROMPT_MODIFY, userMsg);
          schema = ensureSchema(raw);
          // 保留旧 id 与 entity.key 防止 record 数据搬家
          schema.id = current.schema.id;
          schema.entity.key = current.schema.entity.key;
          step.logs.push('LLM 返回合法 Schema');
          step.status = 'done';
          step.durationMs = Date.now() - start;
          ctx.onStepUpdate({ ...step });
        } else {
          await sleep(160);
          step.status = 'done';
          step.durationMs = Date.now() - start;
          ctx.onStepUpdate({ ...step });
        }
      } catch (e) {
        step.status = 'error';
        step.logs.push(`LLM 调用失败：${(e as Error).message}`);
        ctx.onStepUpdate({ ...step });
        throw e;
      }
    }
    if (!schema) throw new Error('LLM provider 未更新 schema');
    const summary = schema.history?.slice(-1)[0] ?? instruction;
    return { schema, notes: summary };
  }
}
