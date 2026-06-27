# AtomForge — AI App Builder Demo

> 一句话需求 → Agent 工作流 → 真正可交互的小应用。
> 笔试挑战 "Atoms-Demo" 的可运行实现。

[![build](https://img.shields.io/badge/build-passing-22c55e)]() [![tests](https://img.shields.io/badge/tests-11%2F11-22c55e)]() [![stack](https://img.shields.io/badge/React-18-6366f1)]() [![stack](https://img.shields.io/badge/TypeScript-5-3178c6)]() [![stack](https://img.shields.io/badge/Vite-5-646cff)]()

## ✨ 项目介绍

AtomForge 是一个 AI 驱动的应用生成平台 Demo，用户用一句自然语言描述需求，Agent 通过可视化的 5 步工作流（**理解 → 拆解 → 生成 Schema → 校验 → 启动预览**）输出一个 **真正可交互** 的小应用，并支持后续多轮自然语言修改、版本管理、模板市场、JSON 导出导入。

- 体验目标：**30 秒内** 通过模板获得一个完整可玩的应用
- 关键约束：**不联网也能完整体验**（DemoProvider 全本地推理）
- 升级路径：**配置 `.env` 后接入真实 LLM**，自动降级保护

## 🧩 核心功能

| 维度 | 已实现 |
| --- | --- |
| **项目管理** | ✓ 创建 / 切换 / 删除 / 重命名；列表显示更新时间 |
| **Agent 工作流** | ✓ 5 步可视化（每步有状态、耗时、可展开日志） |
| **Schema 驱动生成** | ✓ 通用 `AppSchema` + Renderer，覆盖 5 类应用 |
| **可交互应用** | ✓ 增 / 删 / 改 / 完成 / 打卡 / 搜索 / 筛选 / 统计 |
| **二次修改** | ✓ 自然语言指令 → 新版本，14 类指令模式 |
| **版本管理** | ✓ 历史列表、切换、Diff、一键恢复（生成新版本可追溯） |
| **模板市场** | ✓ 5 个高质量预设：习惯、任务、记账、笔记、书签 |
| **持久化** | ✓ IndexedDB（projects / versions / messages / appData / meta），刷新不丢 |
| **导入导出** | ✓ 一键导出整个项目 JSON；导入会重新分配 ID 防冲突 |
| **LLM 接入** | ✓ Azure / OpenAI 兼容接口；缺配置或失败时自动回退 DemoProvider 并给出明确提示 |
| **空 / 加载 / 错误态** | ✓ 三态完备；失败时 Toast + Agent 报错消息 |
| **键盘交互** | ✓ ⌘+Enter 发送，Esc 关闭模态，下拉外点关闭 |
| **响应式** | ✓ 桌面端完整 3 栏；窄屏自适应 |
| **主题** | ✓ App 内深 / 浅切换；可由 Agent 指令直接切换 |

## 🏗️ 架构与技术选型

```
┌────────────────────────────────────────────────────────────────────┐
│  Topbar  (mode chip · LLM/Demo · GitHub)                            │
├──────────┬──────────────────────────────┬──────────────────────────┤
│ Sidebar  │  AgentWorkspace              │  PreviewPanel            │
│ 项目列表 │  · 消息流（用户 / Agent）    │  · Preview / Code /      │
│ 模板入口 │  · Agent 5 步执行轨迹        │    Diff / Data Tab       │
│ LLM 开关 │  · 快捷指令 + 输入框         │  · 版本切换 / 恢复       │
│          │                              │  · 导入 / 导出           │
└──────────┴──────────────────────────────┴──────────────────────────┘
              ↑                                       ↑
              └──────── Zustand store ────────────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │ AgentProvider (interface)│
                │   ├─ DemoProvider (本地) │
                │   └─ LLMProvider (可选)  │
                └──────────────────────────┘
                              │
                              ▼
                ┌──────────────────────────┐
                │ IndexedDB (idb)          │
                │  projects, versions,     │
                │  messages, appData, meta │
                └──────────────────────────┘
```

- **构建**：Vite + React 18 + TypeScript（严格模式）
- **样式**：Tailwind CSS（自定义 ink / atom 调色板）
- **状态**：Zustand（单一 store，async actions）
- **持久化**：IndexedDB via `idb`；jsdom 等无 IDB 环境自动降级 memory-store
- **图标**：lucide-react
- **图表**：recharts（趋势柱状图、分类饼图）
- **Diff**：`diff` 行级文本对比
- **测试**：Vitest（jsdom + globals）

### 关键文件

```
src/
├── App.tsx                    # 三栏布局
├── types/                     # AppSchema、Project、Version、AgentMessage 等类型
├── db/db.ts                   # IndexedDB 封装 + memory fallback
├── store/store.ts             # Zustand 主 store（≈400 行 actions）
├── agent/
│   ├── provider.ts            # AgentProvider 接口
│   ├── steps.ts               # 5 步定义
│   ├── demoProvider.ts        # 本地 NLU + Schema 生成 / 修改
│   ├── llmProvider.ts         # OpenAI / Azure 兼容
│   └── index.ts               # 入口（含降级逻辑）
├── renderer/
│   ├── AppRenderer.tsx        # 通用 Schema → 可交互 UI
│   ├── StatChart.tsx          # 趋势 / 饼图
│   └── utils.ts               # 统计、筛选、搜索
├── templates/templates.ts     # 5 个内置模板
├── components/
│   ├── Sidebar.tsx
│   ├── AgentWorkspace.tsx
│   ├── PreviewPanel.tsx
│   ├── DiffView.tsx
│   ├── CodePanel.tsx
│   ├── DataPanel.tsx
│   ├── Topbar.tsx
│   └── Toasts.tsx
├── utils/id.ts
└── index.css
```

## 🤖 Agent 工作流设计

### 抽象接口

```ts
interface AgentProvider {
  generateApp(requirement: string, ctx: AgentRunContext): Promise<GeneratedApp>;
  modifyApp(current: GeneratedApp, instruction: string, ctx: AgentRunContext): Promise<GeneratedApp>;
}
```

`AgentRunContext` 通过 `onStepUpdate(step)` 回调驱动前端的步骤可视化，状态从 `pending → running → done | error`，自带耗时与日志。

### DemoProvider — 默认可用（无需 Key）

- **NLU**：关键词规则识别 `category`（habit / todo / expense / notes / bookmark / generic）
- **特征探测**：搜索、筛选、图表、深色模式、优先级、标签、备注、金额、按日分组、导入导出
- **Schema 合成**：按 category 选模板字段 → 按特征叠加 fields / stats / features
- **修改指令**：14 类指令的鲁棒模式匹配（深色、主色、搜索、筛选、优先级、标签、备注、趋势、饼图、streak、tagline、重命名、导出导入、未识别意图）
- **任何情况下都能产出一个新版本**（即使指令无法识别，也会追加 history 记录意图）

### LLMProvider — 可选增强

- 从 `import.meta.env.VITE_LLM_*` 读取配置（`.env`，**不进 git**）
- 调用 `${baseUrl}/chat/completions`，`response_format: { type: 'json_object' }`
- 严格 System Prompt 限定输出为单个合法 JSON `AppSchema`
- 解析失败 / 网络错误 / 字段缺失 → 自动捕获并降级到 DemoProvider，UI 显示 `已回退：...` chip + Toast

> **安全**：API Key 仅在浏览器内存中使用，绝不写入仓库或日志。生产部署到公网时，建议改用一个**服务端代理**承担 Key（参见"扩展方向"）。

## ⚙️ 本地启动

```bash
# 1. 安装依赖（首次约 30s ~ 1min）
npm install

# 2. 开发模式
npm run dev          # http://localhost:5173

# 3. 单元 + 集成测试（11 个）
npm test

# 4. 类型检查
npm run typecheck

# 5. Lint
npm run lint

# 6. 生产构建
npm run build
npm run preview      # 预览生产构建
```

无需任何环境变量即可完整体验。

## 🔌 可选：接入真实 LLM（已验证：Azure OpenAI / gpt-5.5）

### 本地开发使用

```bash
cp .env.example .env
```

编辑 `.env`（OpenAI / Azure OpenAI v1 兼容端点均可）：

```bash
VITE_LLM_BASE_URL=https://your-endpoint.openai.azure.com/openai/v1
VITE_LLM_MODEL=gpt-5.5      # 或 gpt-4o-mini / gpt-4.1 / claude-opus 等
VITE_LLM_API_KEY=sk-...
```

重启 `npm run dev`，Sidebar 底部的"使用真实 LLM"开关将变为可用。

实测在 Azure OpenAI `gpt-5.5` 端点下：

- **生成场景** 4 个典型需求（习惯 / 任务 / 记账 / 书签）全 PASS，业务断言 100% 命中（streak、weeklyTrend、priority type、categoryPie、amount field 等）
- **修改场景** 连续 4 轮接力修改（深色 → 搜索 → 优先级 → 趋势图）全 PASS，且结构变更真实落到 schema 而非只追加 history
- **延迟** 单次调用约 5 ~ 11s（reasoning model），Agent 步骤会持续显示进度

调试脚本：`scripts/debug-llm.mjs`、`scripts/debug-llm-e2e.mjs`、`scripts/debug-llm-modify.mjs`（运行时通过 `node --env-file=.env` 读取 `.env`，不写入日志）。

### ⚠️ 关键安全须知

| 项 | 说明 |
| --- | --- |
| `.env` 是否上 git | ❌ 不上。已在 `.gitignore`，请二次确认 `git status` 中不出现 |
| `dist/` 中是否含 Key | ✅ 含。`VITE_*` 变量在 `npm run build` 时被打包进 JS bundle |
| `dist/` 是否上 git | ❌ 不上。已在 `.gitignore` |
| 直接把启用 Key 的 dist 部署到 Vercel/Netlify | ❌ 不行。任何访客都能从 JS 源码读出 Key |
| 公网部署 + 启用 LLM 的正确做法 | 用服务端代理（Cloudflare Workers / Vercel Functions），前端不持 Key |

**当前 demo 的合规部署策略**：

- 部署到公网时，**不要** 在部署平台配置 `VITE_LLM_*` 环境变量。让站点以 DemoProvider 默认模式运行（本身完整可演示）。
- 想现场演示 LLM 接入，请在本地 `npm run dev` 或 `npm run preview` 时启用 `.env`，并通过 IDE 录屏 / 共享屏幕的方式演示。
- 若 evaluator 必须在线试用 LLM 模式，再加服务端代理（已在「扩展方向」中列为最高优先级）。

## 💾 数据持久化

| 对象库 | 内容 |
| --- | --- |
| `projects` | 项目元信息（id、name、requirement、currentVersionId、时间戳） |
| `versions` | 每一版的完整 AppSchema、触发指令、变更总结、parentId |
| `messages` | Agent 对话记录（含步骤、provider、回退原因） |
| `appData` | 子应用真实运行数据（按 `projectId:entityKey` 分桶） |
| `meta` | 用户设置（lastProjectId、preferLLM） |

刷新页面后，所有数据自动恢复。jsdom 等无 IDB 环境会自动使用 in-memory store。

## ✅ 已完成 / ⏭️ 未完成

**已完成**

- 三栏 IDE 风格 Workspace + Topbar
- 5 类应用模板 + DemoProvider 通用生成
- 5 步 Agent 工作流，每步含状态 / 耗时 / 日志
- 14 类自然语言修改指令
- 版本切换 / Diff / 一键恢复（恢复时生成新版本，可追溯）
- IndexedDB 全量持久化（含子应用运行数据）
- JSON 导入 / 导出
- LLMProvider 可选启用 + 自动降级
- 错误态 / 加载态 / 空状态 / Toast 反馈
- 11 个测试（unit + integration），lint / typecheck / build 全绿

**未完成 / 取舍**

- 多实体（一个应用多个 entity）：当前 schema 限制单 entity，足够覆盖示例需求；扩展为多 entity 需 Renderer 增加 Tabs
- 在线分享链接：限于浏览器端存储，分享需要后端；提供了 JSON 导出作为替代
- 可编辑代码视图：当前 Code Tab 只读 + 复制；启用编辑需要 schema 校验 & 双向解析
- 服务端代理 LLM Key：当前 Demo 直接在前端调用 LLM（仅本地使用）；生产部署需要后端代理

## 🚀 后续可扩展方向（按优先级）

1. **服务端代理 LLM** — 用一个轻量 BFF（Cloudflare Workers / Vercel Functions）承载 API Key，前端只调代理
2. **流式输出** — 把 Agent 步骤的"日志"换成 LLM 真实 token 流，体验更接近 Atoms
3. **多实体 Schema** — 支持 1 个应用包含多个 entity 与跨实体引用（例如 项目→任务）
4. **代码视图编辑器** — Monaco + JSON Schema 校验，允许直接编辑底层 schema 触发预览刷新
5. **公开预览页面** — 输入 JSON 形成 readonly URL，可直接分享给同事
6. **失败自动修复** — 当 LLM 输出非合法 JSON，自动追加修复指令再次调用
7. **应用市场** — 把社区生成的应用作为模板分享

## 📸 截图位置

- `docs/screenshots/landing.png` （首次进入：Onboarding + 模板）
- `docs/screenshots/agent-running.png` （Agent 工作流执行中）
- `docs/screenshots/preview.png` （生成应用 + 数据交互）
- `docs/screenshots/diff.png` （版本 Diff）

> 由于本仓库初始为空，截图请在本地启动后自行采集；演示脚本见 `docs/demo-script.md`。

## 📦 部署建议

- **Vercel** / **Netlify** / **Cloudflare Pages**：直接将仓库 import，构建命令 `npm run build`，输出 `dist/`，零配置可上线
- 若需启用 LLM：在部署平台环境变量中配置 `VITE_LLM_BASE_URL` / `VITE_LLM_MODEL` / `VITE_LLM_API_KEY`（**注意：前端 Vite 暴露的变量会进 bundle，更安全的做法是加服务端代理**）

## 📜 License

仅用于笔试演示。
