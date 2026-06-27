// 端到端：真实调 LLM 生成 4 种典型应用，并复用 ensureSchema 归一化。
// 通过 tsx 加载 TS 源；不依赖编译。运行：
//   node --env-file=.env --experimental-strip-types scripts/debug-llm-e2e.mjs
// （Node 22 支持 --experimental-strip-types；若不支持改用 npx tsx）

const baseUrl = process.env.VITE_LLM_BASE_URL?.replace(/\/$/, '');
const apiKey = process.env.VITE_LLM_API_KEY;
const model = process.env.VITE_LLM_MODEL;

if (!baseUrl || !apiKey || !model) {
  console.error('❌ 缺少环境变量');
  process.exit(1);
}

// 内联同步 ensureSchema 的关键归一化逻辑（避免 ESM/TS 互操作问题）
// 这是 src/agent/llmProvider.ts 的 JS 镜像，仅用于本地调试。
const VALID_FIELD_TYPES = ['text','longtext','number','boolean','date','select','priority','url','tag'];
const VALID_STAT_KINDS = ['count','completedCount','sum','streak','weeklyTrend','categoryPie'];
const DEFAULT_EMOJI = { habit: '🌱', todo: '✅', expense: '💰', notes: '📒', bookmark: '🔖', generic: '⚛️' };

function ensureSchema(raw) {
  if (typeof raw !== 'object' || raw === null) throw new Error('Schema 非对象');
  const s = raw;
  const validCats = ['todo','habit','expense','notes','bookmark','generic'];
  const category = validCats.includes(s.category) ? s.category : 'generic';
  const themeRaw = s.theme ?? {};
  const theme = {
    primary: typeof themeRaw.primary === 'string' && /^#[0-9a-fA-F]{3,8}$/.test(themeRaw.primary) ? themeRaw.primary : '#6366f1',
    mode: themeRaw.mode === 'light' ? 'light' : 'dark',
  };
  const entityRaw = s.entity;
  if (!entityRaw || typeof entityRaw !== 'object') throw new Error('缺 entity');
  const fieldsRaw = entityRaw.fields;
  if (!Array.isArray(fieldsRaw) || fieldsRaw.length === 0) throw new Error('entity.fields 空');
  const seen = new Set();
  const fields = [];
  for (const fRaw of fieldsRaw) {
    if (!fRaw || typeof fRaw !== 'object') continue;
    const key = typeof fRaw.key === 'string' && fRaw.key.trim() ? fRaw.key.trim() : '';
    const label = typeof fRaw.label === 'string' && fRaw.label.trim() ? fRaw.label.trim() : key;
    if (!key || !label || seen.has(key)) continue;
    seen.add(key);
    let type = fRaw.type ?? 'text';
    if (!VALID_FIELD_TYPES.includes(type)) type = 'text';
    let options = Array.isArray(fRaw.options) ? fRaw.options.map(String).filter(x => x.length > 0) : undefined;
    if (type === 'select' && (key.toLowerCase().includes('priority') || /优先级/.test(label)) && options?.length) {
      type = 'priority';
    }
    if (type === 'priority' && (!options || options.length === 0)) options = ['P0','P1','P2','P3'];
    fields.push({ key, label, type, options, required: !!fRaw.required, showInSummary: fRaw.showInSummary === undefined ? type !== 'longtext' : !!fRaw.showInSummary });
  }
  const entityKey = typeof entityRaw.key === 'string' && entityRaw.key.trim() ? entityRaw.key.trim() : (category === 'generic' ? 'item' : category);
  const entityLabel = typeof entityRaw.label === 'string' && entityRaw.label.trim() ? entityRaw.label.trim() : '条目';
  const entity = {
    key: entityKey, label: entityLabel,
    pluralLabel: typeof entityRaw.pluralLabel === 'string' && entityRaw.pluralLabel.trim() ? entityRaw.pluralLabel.trim() : entityLabel,
    completable: !!entityRaw.completable,
    streakable: !!entityRaw.streakable,
    amountField: typeof entityRaw.amountField === 'string' ? entityRaw.amountField : undefined,
    groupField: typeof entityRaw.groupField === 'string' ? entityRaw.groupField : undefined,
    fields,
  };
  if (entity.amountField && !fields.some(f => f.key === entity.amountField)) entity.amountField = fields.find(f => f.type === 'number')?.key;
  if (entity.groupField && !fields.some(f => f.key === entity.groupField)) entity.groupField = fields.find(f => f.type === 'select' || f.type === 'tag')?.key;

  const statsRaw = Array.isArray(s.stats) ? s.stats : [];
  const stats = [];
  for (const st of statsRaw) {
    if (!st || typeof st !== 'object') continue;
    if (!VALID_STAT_KINDS.includes(st.kind)) continue;
    stats.push({ key: st.key ?? st.kind, kind: st.kind, label: st.label ?? st.kind, field: st.field, unit: st.unit });
  }
  if (stats.length === 0) stats.push({ key: 'count', kind: 'count', label: '总数' });
  if (stats.some(s => s.kind === 'streak') && !entity.streakable) { entity.streakable = true; entity.completable = true; }

  const featRaw = s.features ?? {};
  const filtersRaw = Array.isArray(featRaw.filters) ? featRaw.filters : [];
  const filters = filtersRaw
    .map(f => {
      const field = typeof f.field === 'string' ? f.field : undefined;
      const label = typeof f.label === 'string' ? f.label : field;
      if (!field) return null;
      if (!fields.some(x => x.key === field)) return null;
      return { field, label: label ?? field };
    })
    .filter(Boolean);

  const features = {
    search: !!featRaw.search,
    filters,
    exportImport: featRaw.exportImport === undefined ? true : !!featRaw.exportImport,
    themeToggle: featRaw.themeToggle === undefined ? true : !!featRaw.themeToggle,
    groupByDate: !!featRaw.groupByDate,
  };

  let emoji = typeof s.emoji === 'string' ? s.emoji.trim() : '';
  if (!emoji || emoji.length > 4) emoji = DEFAULT_EMOJI[category];
  const history = Array.isArray(s.history) ? s.history.map(String).filter(x => x.length > 0) : [];
  if (history.length === 0) history.push('LLM 生成');

  return {
    schemaVersion: 1,
    id: typeof s.id === 'string' ? s.id : `app_${Date.now().toString(36)}`,
    name: typeof s.name === 'string' && s.name.trim() ? s.name.trim() : '我的应用',
    tagline: typeof s.tagline === 'string' && s.tagline.trim() ? s.tagline.trim() : 'AI 生成的轻量级应用',
    category, emoji, theme, entity, stats, features, history,
  };
}

const SYSTEM_PROMPT = `You are AtomForge, a senior product engineer Agent that converts product
requirements into a strict JSON AppSchema. Output ONLY a single JSON object, no markdown.

AppSchema (TypeScript shape):
{
  "schemaVersion": 1, "id": "kebab", "name": "中文短词", "tagline": "中文一句",
  "category": "todo"|"habit"|"expense"|"notes"|"bookmark"|"generic",
  "emoji": "单 emoji",
  "theme": { "primary": "#hex", "mode": "light"|"dark" },
  "entity": {
    "key": "英文 kebab", "label": "中文", "pluralLabel": "中文",
    "completable": boolean, "streakable": boolean,
    "amountField": "(可选) 字段 key", "groupField": "(可选) 字段 key",
    "fields": [
      { "key": "英文 kebab", "label": "中文",
        "type": "text"|"longtext"|"number"|"boolean"|"date"|"select"|"priority"|"url"|"tag",
        "required": boolean, "showInSummary": boolean, "options": [string]? }
    ]
  },
  "stats": [ { "key":"...", "kind":"count"|"completedCount"|"sum"|"streak"|"weeklyTrend"|"categoryPie", "label":"...", "field":"?", "unit":"?" } ],
  "features": { "search": boolean, "filters": [{"field": "字段 key", "label": "中文"}], "exportImport": boolean, "themeToggle": boolean, "groupByDate": boolean },
  "history": ["首版生成"]
}

强制规则：
1. 仅一个 JSON 对象。
2. label/name/tagline 全部中文。
3. 优先级字段 type 必须为 "priority"（不要用 "select"），推荐 options=["P0","P1","P2","P3"]。
4. filters 元素仅含 { field, label }，且 field 必须是 fields 中存在的 key。
5. emoji 单字符；habit→🌱 todo→✅ expense→💰 notes→📒 bookmark→🔖。
6. fields 至少一个 title (text, required, showInSummary)。
7. 打卡/连续天数需求：entity.streakable=true，stats 应含 streak 与 weeklyTrend。
8. 记账/金额需求：entity.amountField 指向 number 字段，stats 应含 sum 与 categoryPie。`;

async function call(reqText) {
  const url = baseUrl + '/chat/completions';
  const start = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, 'api-key': apiKey },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: `用户需求：${reqText}` },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  const elapsed = Date.now() - start;
  if (!res.ok) {
    const txt = await res.text();
    throw new Error(`HTTP ${res.status}: ${txt.slice(0, 200)}`);
  }
  const data = await res.json();
  const content = data.choices?.[0]?.message?.content;
  const usage = data.usage;
  return { content, usage, elapsed };
}

const cases = [
  '帮我生成一个每日习惯打卡应用，支持添加习惯、完成打卡、统计连续天数和近 7 天趋势。',
  '帮我做一个任务清单，支持搜索、优先级 P0-P3 和按优先级筛选。',
  '帮我做一个日常记账应用，支持金额、分类、本月支出与分类占比饼图。',
  '帮我做一个收藏夹应用，支持链接、标签、备注和按标签筛选。',
];

let allPass = true;
for (let i = 0; i < cases.length; i++) {
  const req = cases[i];
  console.log(`\n========== Case ${i + 1} ==========`);
  console.log(`需求：${req}`);
  try {
    const { content, usage, elapsed } = await call(req);
    console.log(`← ${elapsed}ms · prompt=${usage.prompt_tokens} completion=${usage.completion_tokens} reasoning=${usage.completion_tokens_details?.reasoning_tokens ?? 0}`);
    let parsed;
    try { parsed = JSON.parse(content); } catch (e) {
      console.error(`❌ 返回非 JSON：${content?.slice(0, 200)}`);
      allPass = false;
      continue;
    }
    const schema = ensureSchema(parsed);
    console.log(`✓ schema · name=「${schema.name}」 category=${schema.category} emoji=${schema.emoji}`);
    console.log(`  entity.key=${schema.entity.key} completable=${schema.entity.completable} streakable=${schema.entity.streakable}`);
    console.log(`  fields (${schema.entity.fields.length}):`);
    for (const f of schema.entity.fields) {
      console.log(`    - ${f.key} (${f.type}${f.required ? ', required' : ''}${f.options ? `, options=[${f.options.join(',')}]` : ''}): ${f.label}`);
    }
    console.log(`  stats (${schema.stats.length}): ${schema.stats.map(s => `${s.label}/${s.kind}`).join(', ')}`);
    console.log(`  features: search=${schema.features.search} filters=${(schema.features.filters ?? []).map(x => x.field).join('|') || '∅'} groupByDate=${schema.features.groupByDate}`);
    console.log(`  history: ${schema.history.join(' / ')}`);

    // 业务断言
    const assertions = [];
    if (i === 0) {
      assertions.push(['streakable', schema.entity.streakable === true]);
      assertions.push(['含 streak stat', schema.stats.some(s => s.kind === 'streak')]);
      assertions.push(['含 weeklyTrend stat', schema.stats.some(s => s.kind === 'weeklyTrend')]);
    } else if (i === 1) {
      const pf = schema.entity.fields.find(f => f.key === 'priority' || /priority/i.test(f.key));
      assertions.push(['含 priority 字段', !!pf]);
      assertions.push(['priority type=priority', pf?.type === 'priority']);
      assertions.push(['features.search=true', schema.features.search === true]);
      assertions.push(['filters 含 priority', (schema.features.filters ?? []).some(f => f.field === pf?.key)]);
    } else if (i === 2) {
      assertions.push(['含 number 字段（金额）', schema.entity.fields.some(f => f.type === 'number')]);
      assertions.push(['含 sum stat', schema.stats.some(s => s.kind === 'sum')]);
      assertions.push(['含 categoryPie stat', schema.stats.some(s => s.kind === 'categoryPie')]);
    } else if (i === 3) {
      assertions.push(['含 url 字段', schema.entity.fields.some(f => f.type === 'url')]);
      assertions.push(['含 tag 字段', schema.entity.fields.some(f => f.type === 'tag')]);
    }
    let caseOk = true;
    for (const [name, ok] of assertions) {
      console.log(`  ${ok ? '✓' : '✗'} ${name}`);
      if (!ok) caseOk = false;
    }
    if (!caseOk) allPass = false;
  } catch (e) {
    console.error(`❌ Case ${i + 1} 失败：${e.message}`);
    allPass = false;
  }
}

console.log('\n==========');
console.log(allPass ? '✓ 全部用例 PASS' : '✗ 有失败用例');
process.exit(allPass ? 0 : 1);
