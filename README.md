# AtomForge — AI App Builder Demo

> 一句话需求 → Agent 工作流 → 真正可交互的小应用。
> 笔试挑战 "Atoms-Demo" 的可运行实现，深色 Agent Workspace 风格 UI。

[![build](https://img.shields.io/badge/build-passing-22c55e)]() [![tests](https://img.shields.io/badge/tests-25%2F25-22c55e)]() [![stack](https://img.shields.io/badge/React-18-6366f1)]() [![stack](https://img.shields.io/badge/TypeScript-5-3178c6)]() [![stack](https://img.shields.io/badge/Vite-5-646cff)]()

## ✨ 项目简介

AtomForge 是一个 AI 驱动的应用生成平台 Demo：用户用一句自然语言描述需求，Agent 通过可视化的 5 步工作流（**理解 → 拆解 → 生成 Schema → 校验 → 启动预览**）输出一个 **真正可交互** 的小应用，并支持后续多轮自然语言修改、版本管理、数据持久化、JSON 导出导入。

- 体验目标：**30 秒内** 通过模板获得一个完整可玩的应用
- 关键约束：**不联网也能完整体验**（DemoProvider 全本地推理）
- 升级路径：**配置 `.env` 后接入真实 LLM**，并在失败时自动降级
- 视觉风格：**深色 AI Builder Workspace**，主背景 `#0a0f1d` + 多层辉光

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
| **主题** | ✓ 主界面深色一致；生成的子应用仍可深 / 浅切换（由 Agent 指令或子应用内部按钮） |

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
- **样式**：Tailwind CSS（自定义 `paper.*` 深色 surface + 反转 `ink.*` 文字阶 + `atom.*` 强调色）
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
├── store/store.ts             # Zustand 主 store（≈400 行 actions，bootstrap 异步检测 LLM）
├── agent/
│   ├── provider.ts            # AgentProvider 接口
│   ├── steps.ts               # 5 步定义
│   ├── demoProvider.ts        # 本地 NLU + Schema 生成 / 修改
│   ├── llmProvider.ts         # 通过同源 /api/llm/chat 代理调用 LLM，浏览器永不持 Key
│   └── index.ts               # 入口（含异步可用性检测与降级逻辑）
├── renderer/
│   ├── AppRenderer.tsx        # 通用 Schema → 可交互 UI（用 slate-* 自管子主题）
│   ├── StatChart.tsx          # 趋势 / 饼图
│   └── utils.ts               # 统计、筛选、搜索
├── templates/templates.ts     # 5 个内置模板
├── components/                # Sidebar / Topbar / AgentWorkspace / PreviewPanel / DiffView / CodePanel / DataPanel / Toasts
├── utils/id.ts
└── index.css                  # 全局深色背景 + 自定义组件类（.panel/.glass/.btn-*/.chip/.input-base）

vite.config.ts                 # 含 atomforge-llm-proxy plugin：注册 /api/llm/status + /api/llm/chat
                               # Node 进程读 .env 中的 LLM_*，浏览器只调代理
```

## ⚙️ 本地开发

```bash
# 1. 安装依赖
npm install

# 2. 开发模式（HMR）
npm run dev          # http://localhost:5173

# 3. 单元 + 集成测试
npm test             # 当前 25 个测试

# 4. 类型检查
npm run typecheck

# 5. Lint
npm run lint         # --max-warnings 0

# 6. 生产构建
npm run build        # 输出 dist/

# 7. 预览生产构建
npm run preview      # http://localhost:5173（preview 默认端口）
```

无需任何环境变量即可完整体验。

## ☁️ 在云服务器 / 任意 Linux 主机上运行（公网可访问）

> 本仓库已经在云服务器 Linux 实例上验证。下列步骤适用于任何 Linux + Node 22 的环境。

### 1. 准备环境

```bash
# 推荐 Conda 隔离 Python（如有需要），项目本身只需 Node
conda activate deepwis        # 项目 Python 环境名（可选）

# Node ≥ 18，本仓库已用 Node 22 验证
node -v && npm -v
```

### 2. 构建并启动

```bash
cd /root/deepwis
npm install
npm run build

# 推荐生产部署方式：基于 dist/ 静态产物的 vite preview
# 必须指定 --host 0.0.0.0，否则只监听 127.0.0.1，外部不可达
nohup npm run preview -- --host 0.0.0.0 --port 5173 --strictPort \
  > /tmp/deepwis-app.log 2>&1 &
echo $!     # 记录 PID，后续 kill 用

# 本机健康检查
curl -I http://127.0.0.1:5173/      # 期望 HTTP 200
curl -I http://$(hostname -I | awk '{print $1}'):5173/    # 内网 IP 也应返回 200
```

### 3. 公网访问

服务器侧确认 OK 后，公网入口格式：

```text
http://<SERVER_PUBLIC_IP>:5173
```

需要在 **云厂商控制台 → 安全组 → 入站规则** 放行：

| 字段 | 值 |
| --- | --- |
| 协议端口 | **TCP : 5173** |
| 来源 | 推荐 **你自己的公网 IP/32**；仅作 Demo 公开评审时可临时填 `0.0.0.0/0` |
| 策略 | 允许 |
| 备注 | AtomForge Demo |

未开放时表现为：浏览器超时 / 连接拒绝 / 空白。这一步**只能在云厂商控制台完成**，本机无法替代。

### 4. 系统侧检查（只读，无需修改）

```bash
ss -ltnp | grep :5173                 # 期望 0.0.0.0:5173 监听
systemctl is-active firewalld         # 期望 inactive（默认）
ufw status                            # 期望 inactive
sudo iptables -S INPUT | head         # 默认 ACCEPT，安全软件链通常只对恶意 IP 列表生效
```

### 5. 也可改为 dev 模式（不推荐做生产入口）

```bash
nohup npm run dev -- --host 0.0.0.0 --port 5173 > /tmp/deepwis-dev.log 2>&1 &
```

dev 模式带 HMR，但会暴露源码、对 WebSocket 在某些反代/NAT 不友好；演示请优先用 preview。

## 🔌 可选：接入真实 LLM（已验证：Azure OpenAI / OpenAI 兼容）

### 配置

```bash
cp .env.example .env
```

编辑 `.env`（OpenAI / Azure OpenAI v1 兼容端点均可）。变量名 **不再带 `VITE_` 前缀**，确保它绝不会被 Vite 注入到前端 bundle：

```bash
LLM_BASE_URL=https://your-endpoint.openai.azure.com/openai/v1
LLM_MODEL=gpt-4o-mini      # 或 gpt-4.1 / gpt-5.x 等
LLM_API_KEY=sk-...
```

> 旧的 `VITE_LLM_*` 变量名仍向后兼容读取，但**强烈建议迁移到 `LLM_*`**。

重启 `npm run dev` 或 `npm run preview`，Sidebar 底部的"使用真实 LLM"开关会变为可用。

### 🔐 关键安全设计

| 项 | 当前实现 |
| --- | --- |
| `.env` 是否上 git | ❌ 不上。已在 `.gitignore` |
| `dist/` 中是否含 Key | ❌ **不含**。Vite plugin `atomforge-llm-proxy` 在 Node 进程内读取 `.env`，浏览器只能调同源 `/api/llm/chat`，bundle 中不存在 Key 字符串（grep 验证 0 命中） |
| 浏览器是否能拿到 Key | ❌ **不能**。`/api/llm/status` 只返回 `{available, model}`，base_url 与 api_key 永不出现在响应中 |
| `dist/` 是否上 git | ❌ 不上。已在 `.gitignore` |
| 公网部署 + 启用 LLM | ✅ 安全：保持 `vite preview --host 0.0.0.0` 运行，由代理转发即可 |

**架构原理**：

```
浏览器               vite preview (Node)              真实 LLM 端点
   │                       │                              │
   │  POST /api/llm/chat   │                              │
   ├──────────────────────▶│  从 .env 读 LLM_API_KEY        │
   │  { system, user }     │  从 .env 读 LLM_BASE_URL        │
   │                       │────POST + Bearer ─────────────▶
   │                       │                              │
   │                       │◀──── { choices: [...] } ──────│
   │◀────{ content } ──────│                              │
```

`vite.config.ts` 中的 `llmProxyPlugin` 同时在 `dev` 和 `preview` 两种模式下注册代理，源码可自查。

## 💾 数据持久化

| 对象库 | 内容 |
| --- | --- |
| `projects` | 项目元信息（id、name、requirement、currentVersionId、时间戳） |
| `versions` | 每一版的完整 AppSchema、触发指令、变更总结、parentId |
| `messages` | Agent 对话记录（含步骤、provider、回退原因） |
| `appData` | 子应用真实运行数据（按 `projectId:entityKey` 分桶） |
| `meta` | 用户设置（lastProjectId、preferLLM） |

刷新页面后，所有数据自动恢复。jsdom 等无 IDB 环境会自动使用 in-memory store。

## ✅ 已知限制

- **单实体 Schema**：当前每个生成应用只含 1 个 entity（足以覆盖 5 类示例）。扩展为多 entity 需 Renderer 增加 Tabs。
- **可编辑代码视图**：Code Tab 目前只读 + 复制；启用直接编辑需要 schema 校验 & 双向解析。
- **公网启用 LLM**：本仓库已通过 Vite 服务端代理实现"Key 仅在服务器 `.env`，浏览器永不持有"，公网部署可以安全启用 LLM。但若把 `dist/` 单独丢到 Vercel/Netlify 这种纯静态托管（不会执行 `vite preview`），代理不存在，前端会自动只跑 DemoProvider。
- **依赖项 chunk 体积**：单个 JS chunk ~636 kB（gzip 186 kB），可后续做 code-splitting。

## 🔐 安全注意事项

- 绝不提交 API Key、Token、Cookie、私钥
- `.env`、`.env.local` 等不进 Git；保留 `.env.example` 仅含变量名
- `prompt.md`、`state.json`、`.md`（笔试需求文档）均在 `.gitignore` 中
- 在云厂商安全组规则中**优先**限制来源为你自己的公网 IP/32，不要默认使用 `0.0.0.0/0`

## 📦 部署建议

- **云服务器 / 自建 Linux + Nginx**：`npm run build` → 把 `dist/` 交给 Nginx 静态托管，**LLM 模式需要保留 `vite preview` 或自建 Node 服务承担 `/api/llm/*` 代理**；如果只暴露 dist，前端会自动走 DemoProvider。
- **Vercel** / **Netlify** / **Cloudflare Pages**：直接 import 仓库，构建命令 `npm run build`，输出 `dist/`。这些纯静态托管不会执行 `vite preview`，因此 `/api/llm/*` 代理不可用，**站点会以 DemoProvider 默认模式运行**（完整可演示，无任何 Key 风险）。
- 想在公网启用 LLM：保留 `vite preview --host 0.0.0.0 --port 5173`，或迁移到 Cloudflare Workers / Vercel Serverless Functions 自建 `/api/llm/chat` 代理，Key 仍只放在服务器侧 `.env`。

## 📜 License

仅用于笔试演示。
