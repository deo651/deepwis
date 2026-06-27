// 本地调试脚本：直接对 .env 里的 LLM endpoint 发出真实请求。
// 用 node --env-file=.env scripts/debug-llm.mjs <step>
// step: 1 = 最简单的 ping；2 = json_object 模式；3 = AtomForge schema 生成
//
// 不会把任何 key 写入日志，只打印响应内容。

const baseUrl = process.env.VITE_LLM_BASE_URL?.replace(/\/$/, '');
const apiKey = process.env.VITE_LLM_API_KEY;
const model = process.env.VITE_LLM_MODEL;

if (!baseUrl || !apiKey || !model) {
  console.error('❌ 缺少环境变量 VITE_LLM_BASE_URL / VITE_LLM_API_KEY / VITE_LLM_MODEL');
  process.exit(1);
}

const step = process.argv[2] ?? '1';

const url = baseUrl + '/chat/completions';
console.log(`→ POST ${url}`);
console.log(`→ model: ${model}`);
console.log(`→ step:  ${step}`);

const bodies = {
  '1': {
    model,
    messages: [{ role: 'user', content: '说"你好"' }],
  },
  '2': {
    model,
    messages: [
      { role: 'system', content: 'Return a JSON object with key "ok" set to true. ONLY JSON, no prose.' },
      { role: 'user', content: 'ping' },
    ],
    response_format: { type: 'json_object' },
  },
  '4': {
    model,
    messages: [
      { role: 'system', content: 'Return {"ok":true}. ONLY JSON.' },
      { role: 'user', content: 'ping' },
    ],
    response_format: { type: 'json_object' },
    temperature: 0.4,
  },
  '5': {
    model,
    messages: [
      { role: 'system', content: '修改 schema 后返回新 schema。ONLY JSON。' },
      {
        role: 'user',
        content: '当前 schema (JSON):\n' + JSON.stringify({
          schemaVersion: 1, id: 'x', name: '任务清单', tagline: '一句',
          category: 'todo', emoji: '✅',
          theme: { primary: '#6366f1', mode: 'dark' },
          entity: {
            key: 'task', label: '任务', pluralLabel: '任务', completable: true,
            fields: [
              { key: 'title', label: '任务标题', type: 'text', required: true, showInSummary: true },
              { key: 'due', label: '截止日期', type: 'date', showInSummary: true },
            ],
          },
          stats: [{ key: 'count', kind: 'count', label: '任务总数' }],
          features: { search: false, filters: [], exportImport: true, themeToggle: true },
          history: ['首版生成'],
        }) + '\n\n修改指令：增加优先级 P0-P3 字段、增加搜索和按优先级筛选。在 history 末尾追加一行变更摘要。',
      },
    ],
    response_format: { type: 'json_object' },
  },
  '3': {
    model,
    messages: [
      {
        role: 'system',
        content: `You are AtomForge. Convert the user requirement into a single JSON object matching this TypeScript type:

{
  "schemaVersion": 1,
  "id": "string",
  "name": "string (中文短词)",
  "tagline": "string (中文一句话)",
  "category": "todo" | "habit" | "expense" | "notes" | "bookmark" | "generic",
  "emoji": "single emoji",
  "theme": { "primary": "#hex", "mode": "light" | "dark" },
  "entity": {
    "key": "kebab-case",
    "label": "中文",
    "pluralLabel": "中文",
    "completable": boolean,
    "streakable": boolean,
    "fields": [
      { "key": "string", "label": "中文", "type": "text|longtext|number|boolean|date|select|priority|url|tag", "required": boolean, "showInSummary": boolean, "options": [string]? }
    ]
  },
  "stats": [ { "key": "string", "kind": "count|completedCount|sum|streak|weeklyTrend|categoryPie", "label": "中文", "field": "string?", "unit": "string?" } ],
  "features": { "search": boolean, "filters": [{ "field": "string", "label": "string" }], "exportImport": boolean, "themeToggle": boolean, "groupByDate": boolean? },
  "history": ["首版生成"]
}

ONLY output a single JSON object. NO prose, NO markdown fences. Use Chinese for all labels.`,
      },
      {
        role: 'user',
        content: '帮我生成一个每日习惯打卡应用，支持添加习惯、完成打卡、统计连续天数和近 7 天趋势。',
      },
    ],
    response_format: { type: 'json_object' },
  },
};

const body = bodies[step];
if (!body) {
  console.error('❌ 未知 step');
  process.exit(1);
}

const start = Date.now();
const res = await fetch(url, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${apiKey}`,
    'api-key': apiKey,
  },
  body: JSON.stringify(body),
});

const elapsed = Date.now() - start;
console.log(`← ${res.status} ${res.statusText} (${elapsed}ms)`);

const text = await res.text();
if (!res.ok) {
  console.error('❌ 错误响应：');
  console.error(text);
  process.exit(2);
}

let data;
try {
  data = JSON.parse(text);
} catch (e) {
  console.error('❌ 响应不是合法 JSON：');
  console.error(text.slice(0, 800));
  process.exit(3);
}

const content = data.choices?.[0]?.message?.content;
const finishReason = data.choices?.[0]?.finish_reason;
const usage = data.usage;

console.log('\n--- content ---');
console.log(content);
console.log('\n--- finish_reason ---');
console.log(finishReason);
console.log('\n--- usage ---');
console.log(usage);

if (step === '2' || step === '3') {
  try {
    const parsed = JSON.parse(content ?? '');
    console.log('\n--- parsed JSON keys ---');
    console.log(Object.keys(parsed));
  } catch (e) {
    console.error('\n⚠️  content 不是合法 JSON：', e.message);
  }
}
