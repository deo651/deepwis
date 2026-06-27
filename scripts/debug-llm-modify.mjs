// 端到端：测试 LLM 在 modify 路径下能否正确响应自然语言修改指令。
// 用法：node --env-file=.env scripts/debug-llm-modify.mjs

const baseUrl = process.env.VITE_LLM_BASE_URL?.replace(/\/$/, '');
const apiKey = process.env.VITE_LLM_API_KEY;
const model = process.env.VITE_LLM_MODEL;

const SYSTEM = `You are AtomForge, modifying an existing AppSchema based on a user instruction.
Return ONLY the updated AppSchema JSON. Preserve existing ids, field keys, and entity.key whenever possible.
Use Chinese for all labels. NEVER include prose, code fences, or markdown.

强制规则（critically important）：
1. 仅输出一个 JSON 对象。
2. 修改必须真实体现在结构化字段上，不允许只追加 history 而结构未变。例如：
   - "增加趋势图 / 近 7 天趋势" → stats 必须包含一个 { kind: "weeklyTrend", label: "近 7 天趋势" }。
   - "增加分类占比 / 饼图" → stats 必须包含 { kind: "categoryPie", label: "分类占比", field: "<已有的分类字段 key>" }。
   - "增加优先级 / P0-P3" → entity.fields 新增 { key:"priority", label:"优先级", type:"priority", options:["P0","P1","P2","P3"], showInSummary:true }。
   - "增加搜索" → features.search = true。
   - "增加按 X 筛选" → features.filters 中追加 { field:"<X 对应字段 key>", label:"<中文>" }，且 field 必须是 fields 中存在的 key。
   - "深色模式" → theme.mode = "dark"。
   - "浅色模式" → theme.mode = "light"。
3. 优先级字段 type 必须使用 "priority"。
4. filters 数组每项仅含 { field, label }。
5. 在 schema.history 末尾追加恰好一行中文，描述本次具体变更。
6. 不要删除既有字段 / 统计，除非指令明确要求。`;

const baseSchema = {
  schemaVersion: 1,
  id: 'fixed-id',
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
      { key: 'title', label: '任务标题', type: 'text', required: true, showInSummary: true },
      { key: 'due', label: '截止日期', type: 'date', showInSummary: true },
    ],
  },
  stats: [{ key: 'count', kind: 'count', label: '任务总数' }],
  features: { search: false, filters: [], exportImport: true, themeToggle: true },
  history: ['首版生成'],
};

async function modify(prevSchema, instruction) {
  const url = baseUrl + '/chat/completions';
  const start = Date.now();
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${apiKey}`, 'api-key': apiKey },
    body: JSON.stringify({
      model,
      messages: [
        { role: 'system', content: SYSTEM },
        { role: 'user', content: `当前 schema (JSON):\n${JSON.stringify(prevSchema)}\n\n修改指令：${instruction}` },
      ],
      response_format: { type: 'json_object' },
    }),
  });
  const elapsed = Date.now() - start;
  if (!res.ok) throw new Error(`HTTP ${res.status}: ${(await res.text()).slice(0,200)}`);
  const data = await res.json();
  return { schema: JSON.parse(data.choices[0].message.content), elapsed, usage: data.usage };
}

const instructions = [
  ['增加深色模式',                 (s) => s.theme.mode === 'dark'],
  ['加上搜索框',                   (s) => s.features.search === true],
  ['为每条任务增加优先级 P0-P3 字段',
                                   (s) => {
                                     const pf = s.entity.fields.find(f => f.key === 'priority' || /priority/i.test(f.key));
                                     return !!pf && (pf.type === 'priority' || pf.type === 'select');
                                   }],
  ['加近 7 天完成趋势图',          (s) => s.stats.some(x => x.kind === 'weeklyTrend')],
];

let cur = baseSchema;
let allOk = true;
for (let i = 0; i < instructions.length; i++) {
  const [instr, check] = instructions[i];
  console.log(`\n--- Modify ${i+1}: ${instr} ---`);
  try {
    const { schema, elapsed, usage } = await modify(cur, instr);
    console.log(`← ${elapsed}ms · completion=${usage.completion_tokens}`);
    console.log(`  name=${schema.name} mode=${schema.theme?.mode} search=${schema.features?.search}`);
    console.log(`  fields=${schema.entity.fields.map(f => `${f.key}:${f.type}`).join(', ')}`);
    console.log(`  stats=${schema.stats.map(s => s.kind).join(', ')}`);
    console.log(`  history=${JSON.stringify(schema.history)}`);
    const ok = check(schema);
    console.log(`  ${ok ? '✓' : '✗'} 断言`);
    if (!ok) {
      allOk = false;
      console.log('  完整 stats:', JSON.stringify(schema.stats));
    }
    // 检查 id / entity.key 是否保持
    if (schema.id !== cur.id) console.log(`  ⚠ id 被改动: ${cur.id} → ${schema.id}`);
    if (schema.entity?.key !== cur.entity.key) console.log(`  ⚠ entity.key 被改动: ${cur.entity.key} → ${schema.entity?.key}`);
    // 检查 history 是否追加
    if ((schema.history?.length ?? 0) <= (cur.history?.length ?? 0)) {
      console.log(`  ⚠ history 未追加`);
    }
    cur = schema; // 接力到下一次修改
  } catch (e) {
    console.error(`✗ 失败：${e.message}`);
    allOk = false;
  }
}

console.log('\n=========');
console.log(allOk ? '✓ ALL MODIFY PASS' : '✗ MODIFY HAS FAILURES');
process.exit(allOk ? 0 : 1);
