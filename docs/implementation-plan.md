# AtomForge 实现计划

> 笔试挑战：在当前空仓库中，完成一个可运行、可部署、可演示的 Atoms-Demo。

## 1. MVP 定义

一个 AI App Builder 网页应用：

- 用户输入一句自然语言需求 → 系统通过可视化的 Agent 工作流（理解需求 / 拆解功能 / 生成 Schema / 校验 / 启动预览）生成一个真正可交互的小应用，并在右侧预览区直接体验。
- 用户可以继续输入自然语言修改指令（如"增加深色模式"、"加搜索"、"加趋势图"），每次修改生成一个新版本。
- 项目、版本、对话、应用数据均使用 IndexedDB 持久化，刷新不丢。
- 内置 3-5 个模板，30 秒内体验完整闭环。
- 支持版本 Diff、版本恢复、JSON 导出导入。
- DemoProvider 默认可用，无需 Key；可选接入 Azure OpenAI 兼容 LLM（通过 `.env`）。

## 2. 技术选型

- **构建**：Vite + React 18 + TypeScript
- **样式**：Tailwind CSS（深色优先，克制现代）
- **状态**：Zustand（轻量、可选 persist 中间件，但我们直接用 IndexedDB 主导）
- **持久化**：IndexedDB（通过 `idb` 库），对象库：`projects`、`versions`、`messages`、`appData`
- **图标**：lucide-react
- **图表**：recharts（趋势图、统计图）
- **JSON Diff**：`diff` 库（行级文本 diff，演示直观）
- **LLM**（可选）：通过 OpenAI 兼容 base_url（与 `gpt.py` 中 Azure 端点一致），从 `.env` 读取，`vite-env` 类型声明

## 3. 数据模型

### App Schema（统一 Renderer 渲染）

```ts
type FieldType = 'text' | 'number' | 'boolean' | 'date' | 'select' | 'priority';

interface FieldDef {
  key: string; label: string; type: FieldType;
  options?: string[]; required?: boolean; default?: any;
}

interface EntityDef {
  key: string; label: string; icon?: string;
  fields: FieldDef[];
  // 内置行为
  completable?: boolean; // 是否带"完成"概念（todo/habit）
  streakable?: boolean;  // 连续打卡天数
  amountField?: string;  // 用于汇总（expense）
}

interface StatDef {
  key: string;
  kind: 'count' | 'sum' | 'streak' | 'weeklyTrend' | 'categoryPie';
  label: string;
  entity: string;
  field?: string;
}

interface FeatureDef {
  search?: boolean;
  filter?: { field: string }[];
  dataExport?: boolean;
  darkMode?: boolean;
}

interface AppSchema {
  id: string;
  name: string;
  tagline: string;
  category: 'todo' | 'habit' | 'expense' | 'notes' | 'bookmark' | 'generic';
  theme: { primary: string; mode: 'light' | 'dark' };
  entity: EntityDef;       // MVP 单实体；扩展可改成 entities[]
  stats: StatDef[];
  features: FeatureDef;
}
```

### 持久化对象库

- `projects`：`{ id, name, requirement, currentVersionId, createdAt, updatedAt }`
- `versions`：`{ id, projectId, schema, instruction, parentId, createdAt }`
- `messages`：`{ id, projectId, role, content, kind: 'plan'|'log'|'user'|'assistant', steps?, createdAt }`
- `appData`：`{ projectId+entityKey -> records[] }`（生成应用的运行时数据）

## 4. Agent 工作流

```
理解需求 (250ms)
  → 拆解功能 (350ms)
  → 生成 Schema (600ms)
  → 校验与修复 (200ms)
  → 启动预览 (150ms)
```

每步在 UI 中作为一个 `AgentStep`，状态：`pending → running → done`，可展开看子日志和 token 化输出。

### DemoProvider 规则

`generateApp(requirement)`：
- 关键词分类：`习惯/打卡/habit` → habit；`待办/todo` → todo；`记账/账单/expense` → expense；`笔记/note` → notes；`书签/bookmark` → bookmark；否则 generic。
- 从分类模板派生 schema，并根据需求中的特征词附加 features（搜索、筛选、统计、深色等）。
- 名称从需求中提取或回退到分类默认名。

`modifyApp(schema, instruction)`：
- 指令模式匹配：
  - "深色"/"dark" → toggle theme mode
  - "搜索"/"search" → features.search = true
  - "筛选"/"分类"/"filter"/"category" → features.filter += 关联字段
  - "趋势"/"统计"/"chart"/"图" → stats 中加入 weeklyTrend / categoryPie
  - "优先级"/"priority" → entity.fields 加入 priority
  - "简洁"/"简短" → tagline 简化
  - 通用：在 schema.history 中追加说明
- 返回新 schema（不变性更新）。

### LLMProvider

- **服务端代理架构**（详见 §8.1 补记）：`.env` 中的 `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL` 仅由 `vite.config.ts` 中的 `atomforge-llm-proxy` plugin 在 Node 进程内读取。
- 前端通过同源 `/api/llm/chat` 调用，**绝不**接触 Key。
- 调用真实 LLM 走 `chat.completions`（非流式即可，控制简单），system prompt 严格要求返回 JSON Schema。
- 失败或缺配置 → 在 UI 显式提示"未配置/失败，已降级到 DemoProvider"，并自动回退。
- Key 绝不写入仓库或日志；`dist/assets/*.js` 中 Key 字符串经 grep 验证 0 命中。

## 5. UI 布局

```
┌──────────────────────────────────────────────────────────┐
│ Topbar  AtomForge · 项目名 · 版本 v3 · 保存中 · 导出/发布 │
├──────────┬───────────────────────┬───────────────────────┤
│ Sidebar  │  Agent Workspace       │  Preview / Code / Diff│
│ 项目列表  │  对话 + 执行轨迹       │  实时渲染子应用       │
│ 模板入口  │  输入框                │  Tab 切换             │
└──────────┴───────────────────────┴───────────────────────┘
```

- 空状态：Onboarding + 模板卡片
- 加载态：Agent 步骤 spinner / skeleton
- 错误态：Toast + Provider 降级横幅

## 6. 亮点能力（按优先级）

1. **版本历史 + Diff + 一键恢复**（必做）
2. **模板市场**（必做，5 个高质量模板）
3. **JSON 导出 / 导入**（轻量补充）
4. **LLMProvider 降级提示**（合规性体现）

## 7. 验证清单（Phase 4）

- [ ] `npm install` 成功
- [ ] `npm run dev` 在本地 5173 启动并能交互
- [ ] `npm run build` 通过
- [ ] 新建项目 → 输入需求 → 看到 Agent 5 步 → 预览可交互
- [ ] 子应用增删改查 + 刷新数据仍在
- [ ] 二次修改 → 新版本生成
- [ ] 切换历史版本 → 预览恢复
- [ ] Diff 视图正确
- [ ] DemoProvider 与 LLM 降级提示
- [ ] 模板一键创建

## 8. 实际落地与原计划的差异（补记于上线优化阶段）

> 原计划是 MVP 思路（Phase 1-4），实际上线阶段做了两处显著增强，保证 Demo "可上线可分享"：

### 8.1 LLM Key 路径：从 `VITE_LLM_*` 改为服务端代理

- **原计划**：`.env` 中放 `VITE_LLM_*`，由 `import.meta.env` 直接注入到前端。
- **实际问题**：`VITE_*` 变量在 `npm run build` 时会被 Vite 字面值 inline 到 `dist/assets/*.js`，等价于把 Key 暴露给任何能访问站点 JS 的访客。
- **改造**：在 `vite.config.ts` 中新增 `atomforge-llm-proxy` plugin：
  - `configureServer` + `configurePreviewServer` 钩子注册同源 `/api/llm/status`（探测可用性）与 `/api/llm/chat`（接收 `{system, user}` 转发到真实端点）。
  - 用 `loadEnv` 在 Node 进程内读 `.env` 中的 `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`（兼容旧 `VITE_LLM_*`）。
  - 用 `define` 强制 `import.meta.env.VITE_LLM_*` 为 `''`（双保险）。
- **前端变化**：`llmProvider.readLLMConfigFromEnv()` → `readLLMConfigFromServer()`（fetch `/api/llm/status`）；`callChatJSON` 改为 fetch `/api/llm/chat`，不再持有 baseUrl/apiKey。
- **验证**：`grep -F "<key>" dist/assets/*.js` 命中 0 行；`/api/llm/status` 响应仅含 `{available, model}`。

### 8.2 视觉：从浅色 paper-page 改为深色 AI Builder

- **原计划**：Tailwind 浅色 surface（`paper.page = #f6f7fb`）。
- **改造**：`paper.*` 重定义为深色色阶（`page = #0a0f1d` 等），`ink.*` 色阶反转（让 `text-ink-900` 在深色背景上自动变浅文字）；`AppRenderer` 中所有 `bg-ink-*` / `text-ink-*` 改为 Tailwind 内置 `slate.*` / `gray.*`，让生成子应用的 isLight ↔ isDark 切换不受 host 主题影响。
- **8 个 host 组件** 中的 `bg-white` 替换为 `bg-paper-card`；状态色 chip 从 `bg-emerald-50 text-emerald-700` 改为 `bg-emerald-500/10 text-emerald-300`，在深色背景下仍清晰。

### 8.3 部署：腾讯云 0.0.0.0:5173

- `npm run preview -- --host 0.0.0.0` 替代直接暴露 dev server，避免 HMR WebSocket 在反代 / 安全组下的不确定性。
- 本机 / 内网 / 服务器自身访问公网 IP 三种 curl 均验证 HTTP 200。
- 公网外部访问最终一跳由用户在腾讯云控制台开放安全组入站 TCP 5173 完成。
