# 笔试提交说明 — AtomForge

> 直接附在 Atoms Demo 笔试结果回收文档末尾使用。所有"完成 / 未完成"按当前 main 分支实际代码填写，验证结果均为真实命令输出，未做美化。

## 一、基本信息

| 项 | 内容 |
| --- | --- |
| **Demo 名称** | **AtomForge** — AI App Builder Demo（一句话 → 可交互应用） |
| **在线访问链接** | `http://<SERVER_PUBLIC_IP>:5173`<br>（服务部署在腾讯云 Linux 实例上，监听 `0.0.0.0:5173`） |
| **公网访问真实状态** | **服务器侧已就绪**：本机 / 内网 / 服务器自身指向公网 IP 的 curl 均返回 HTTP 200，HTML 含深色主题标记 `class="dark"`。<br>**仍需用户在腾讯云控制台 → 安全组开放入站 TCP 5173** 才能从外部公网访问。这一步无法在本机替代。 |
| **GitHub 源码链接** | https://github.com/deo651/deepwis （main 分支） |
| **本地启动** | `npm install && npm run dev`，打开 `http://localhost:5173` |
| **腾讯云启动** | `npm run build && nohup npm run preview -- --host 0.0.0.0 --port 5173 --strictPort > /tmp/deepwis-app.log 2>&1 &` |
| **LLM 启用方式** | 服务器 `.env` 配置 `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`（OpenAI / Azure OpenAI v1 兼容端点）。**Key 仅由 Node 进程持有**，浏览器通过同源 `/api/llm/chat` 代理调用，bundle 中绝不出现 Key 字符串。 |

> 公网 IP 与端口、所需安全组规则、Conda / Node 环境、`.env` 用法等运行细节，详见仓库根目录 `README.md` 的"☁️ 在腾讯云 / 任意 Linux 服务器上运行"章节。

## 二、实现思路

AtomForge 把"用一句话生成一个真正可交互的小应用"的核心体验解构成三层：

1. **Agent 层** — 抽象出 `AgentProvider` 接口：本地推理的 `DemoProvider`（默认可用、无需 Key）和 OpenAI / Azure 兼容的 `LLMProvider`（可选）。两者都按统一的 5 步可视化工作流输出（理解 → 拆解 → 生成 Schema → 校验 → 启动预览），UI 用回调驱动步进，每步带状态、耗时、可展开日志。
2. **Schema 层** — 设计一套通用的 `AppSchema`（实体 + 字段 + 统计 + 特征 + 主题）。任何小应用都用同一份 Schema 描述，做到"一种结构，多种形态"。
3. **Renderer 层** — 一个通用 React 渲染器读取 Schema，渲染出真正可增删改查、可搜索筛选、可统计可视化的子应用，并将运行时数据写入 IndexedDB。

**二次修改流程**：自然语言 → Schema patch → 追加为新版本 → Renderer 热更新。版本之间用 `diff` 库做行级文本对比，提供 Diff 视图与一键恢复（恢复也产生新版本，可继续追溯）。

**视觉层**：本次优化把整体主界面统一为深色 AI Builder Workspace 风格（主背景 `#0a0f1d` + 多层辉光），同时**保留生成子应用自己的浅 / 深主题切换能力**——host UI 用 `paper.* / ink.*` token，子应用 `AppRenderer` 改用 Tailwind 内置 `slate.*` / `gray.*`，二者解耦互不污染。

## 三、关键取舍

| 取舍点 | 选择 | 原因 |
| --- | --- | --- |
| 单实体 vs 多实体 Schema | **单实体** | MVP 已覆盖习惯 / 任务 / 记账 / 笔记 / 书签 5 类需求；多实体会让 Renderer 复杂度翻倍，性价比低 |
| 规则 vs LLM | **DemoProvider 优先 + 可选 LLM** | 保证 demo 无 Key 也可玩；LLM 接入作为加分项，并自动降级 |
| 持久化方式 | **IndexedDB** | 无需后端、容量足够、结构化查询友好；jsdom 自动降级 in-memory 便于测试 |
| 版本恢复策略 | **追加新版本（不覆盖历史）** | 真正的 time travel：旧版本始终可回看 |
| API Key 来源 | **服务器 `.env` + Vite plugin 代理** | Key 仅在 Node 进程内存，浏览器只调同源 `/api/llm/chat`；公网部署也可安全启用 LLM（详见下文"关键安全设计"） |
| 状态管理 | **Zustand** | 单一 store，actions 直写 async，避免 Redux 样板 |
| 视觉主题 | **host 深色一致 + 子应用保留浅/深切换** | 满足"非亮色背景"的部署要求，同时不破坏 Schema 的 `theme.mode` 语义 |
| 部署形态 | **`vite preview` 基于 dist/ 暴露 5173** | 静态产物稳定、不带 HMR WebSocket 暴露问题；同时复用 Vite plugin 的 `configurePreviewServer` 钩子承载 `/api/llm/*` 代理 |

### 🔐 关键安全设计：LLM Key 永不进前端 bundle

```
浏览器              vite (Node 进程)            真实 LLM 端点
   │  POST            │  从 .env 读 LLM_API_KEY    │
   │  /api/llm/chat   │  从 .env 读 LLM_BASE_URL   │
   ├─────────────────▶│──── Bearer + body ────────▶│
   │                  │◀──── choices[0].content ───│
   │◀─── content ─────│                            │
```

实现：`vite.config.ts` 中的 `llmProxyPlugin` 用 `configureServer` + `configurePreviewServer` 注册同源 `/api/llm/status`（探测可用性，仅返回 `{available, model}`）与 `/api/llm/chat`（接收 `{system, user}` 后代为转发）。前端 `llmProvider.ts` 只调这两个端点，**完全不持有 baseUrl / apiKey**。

经验证：`dist/assets/*.js` 中 `LLM_API_KEY` / `LLM_BASE_URL` / `VITE_LLM` 字符串均**0 命中**。

## 四、当前完成程度

### ✅ 已完成

**核心闭环（必做项）**

- [x] 项目创建 / 列表 / 切换 / 删除 / 重命名
- [x] Agent 5 步执行轨迹（状态 / 耗时 / 可展开日志）
- [x] 通用 Schema → 可交互应用渲染
- [x] **真实交互**：子应用 CRUD、搜索、筛选、勾选完成、习惯打卡、统计卡片、趋势图、饼图
- [x] **数据持久化**：IndexedDB 5 个对象库（projects / versions / messages / appData / meta），刷新不丢
- [x] **基本使用流程**：模板一键创建 → Agent 5 步可视化 → 实时预览 → 子应用交互 → 持久化
- [x] 自然语言二次修改（14 类指令模式）→ 新版本
- [x] 模板市场（5 个高质量预设）

**延展能力（"至少一个"已超额）**

- [x] **版本时间旅行**：历史列表、切换、Diff 视图、一键恢复（恢复生成新版本可追溯）
- [x] **JSON 导入 / 导出**：项目级完整备份；导入重新分配 ID 防冲突
- [x] **LLM 可选接入** + **自动降级**：缺配置 / 失败时回退到 DemoProvider 并显式提示原因
- [x] **多 Tab 预览**：Preview / Code（JSON Schema） / Diff / Data（原始 records）

**视觉与部署**

- [x] 整体改为非亮色背景（`#0a0f1d` + 紫 / 青 / 玫红多层辉光）
- [x] 子应用预览能力未被破坏（仍可 isLight ↔ isDark 切换）
- [x] `vite preview` 监听 `0.0.0.0:5173`，本机 / 内网均验证 HTTP 200
- [x] **服务端 LLM 代理**：Vite plugin `atomforge-llm-proxy` 注册 `/api/llm/status` 与 `/api/llm/chat`；`.env` 中的 Key 仅在 Node 进程内存，bundle 0 命中

**工程质量**

- [x] TypeScript 严格模式，全部代码类型化
- [x] ESLint `--max-warnings 0` 通过
- [x] **25 个测试**（agent / store / renderer / llmProvider）全绿
- [x] `npm run build` 无错误
- [x] `.env`、`prompt.md`、`state.json`、`.md`（需求文档）、`CLAUDE.md`、`.env.real-backup` 均在 `.gitignore`，不会进 Git
- [x] 通用密钥扫描（`sk-…` / `AIza…` / `AKIA…`）对 dist/ 与 git 跟踪文件均 0 命中

### ⏭️ 未完成 / 部分完成

- [ ] **外部公网访问**：需要用户在腾讯云控制台开放入站 TCP 5173 才能从外部访问。服务器侧（应用 / 端口绑定 / 系统防火墙 / Vite preview / LLM 代理）均已就绪。
- [ ] **多实体 Schema**：当前每个生成应用仅支持 1 个 entity（足以覆盖示例需求）。
- [ ] **可编辑代码视图**：Code Tab 只读 + 复制，未支持直接修改 JSON 触发预览。
- [ ] **TLS / 域名**：当前仍是 `IP:5173` 直连 HTTP；笔试评审接受，但若长期分享建议加 Caddy/Nginx + HTTPS。
- [ ] **流式输出**：当前 LLM 是非流式调用，UI 仅显示 5 步状态；未做 token-by-token 流。
- [ ] **JS chunk 体积优化**：单个 chunk ~636 kB（gzip 186 kB），可后续 code-split。
- [ ] **可访问性 / 国际化**：未做 ARIA、键盘焦点环、英文文案。

## 五、扩展计划（按 ROI 排序 P0 / P1 / P2）

> 排序依据：① 暴露给评审 / 真实用户的可见价值 ② 解锁后续能力的杠杆 ③ 工作量 ④ 风险。

### P0（最高优先级）

1. **公网入口 TLS + 域名 + 反向代理（半天）**
   *原因*：当前用 `IP:5173` 直连只适合临时评审；接入 Caddy / Nginx + 域名 + HTTPS 后，可以稳定分享给招聘方而不用每次修改安全组。是"对外可交付"的硬指标。

2. **LLM 流式输出（半天）**
   *原因*：把 Agent 步骤的"日志条"换成 LLM token 流，体验上立刻接近 Atoms。服务端代理已经具备，把 `/api/llm/chat` 升级成 SSE 即可，前端用 EventSource 接收。

### P1（次优先级）

3. **多实体 Schema + 跨实体引用（1 天）**
   *原因*：Renderer 加 Tabs 后，可以表达"项目 → 任务"、"账本 → 账单 + 分类"等更复杂应用，把单实体 Demo 升级为通用 builder。

4. **失败自动修复（半天）**
   *原因*：LLM 返回非合法 JSON 时，自动追加修复 prompt 再次调用，提升 LLM 模式下的"成功率体感"，减少手动重发。

5. **代码视图编辑器（半天）**
   *原因*：Monaco + JSON Schema 校验，允许直接改 schema 触发预览刷新。对深度玩家有价值。

### P2（可延后）

6. **公开分享 readonly URL（1 天，需后端）**
   *原因*：输入 JSON → 短链预览，方便横向传播 Demo。但只有产品阶段才需要，笔试场景占用过多预算。

7. **Playwright 端到端测试（1 天）**
   *原因*：覆盖核心 5 个用户路径，把"演示稳定性"沉淀进 CI；当前 25 个单元 + 集成测试已经足够支撑功能正确性。

8. **可访问性 / 国际化（1 天）**
   *原因*：ARIA、焦点环、英文切换。是合规与国际化必备，但当前评审场景不是关键。

## 六、自检结果（真实输出）

> 执行环境：腾讯云 Linux + Conda 环境 `deepwis`（Python 3.10.0）+ Node v22.22.0 + npm 10.9.4。所有命令均在仓库根目录 `/root/deepwis` 下运行。

```text
npm run typecheck    ✓  tsc -b --noEmit 无错误
npm run lint         ✓  eslint --max-warnings 0 通过
npm test             ✓  4 test files / 25 tests passed
                        - agent/llmProvider.test.ts (14 tests)
                        - agent/demoProvider.test.ts (6 tests)
                        - store/store.test.ts (2 tests)
                        - renderer/utils.test.ts (3 tests)
npm run build        ✓  vite build, 2408 modules, ~6.9s
                        dist/index.html             0.64 kB │ gzip 0.44 kB
                        dist/assets/index-*.css    28.25 kB │ gzip 5.57 kB
                        dist/assets/index-*.js    636.38 kB │ gzip 185.79 kB
```

### Smoke / 部署验证（本机）

```text
nohup npm run preview -- --host 0.0.0.0 --port 5173 --strictPort  ✓ 启动成功
ss -ltnp | grep :5173       ✓ LISTEN 0.0.0.0:5173 node
curl -I http://127.0.0.1:5173/                       ✓ HTTP 200
curl -I http://<内网 IP>:5173/                        ✓ HTTP 200
curl  http://127.0.0.1:5173/api/llm/status           ✓ {"available":true,"model":"<name>"}
curl -X POST http://127.0.0.1:5173/api/llm/chat      ✓ HTTP 400 + {"error":"body 非合法 JSON"} (参数校验)

HTML 抽样：
  <html lang="zh-CN" class="dark">
  <meta name="theme-color" content="#0a0f1d" />
  <body class="bg-paper-page text-ink-900">
```

### Key 防泄露扫描（真实命令输出）

```text
grep -F "$LLM_API_KEY"  dist/assets/*.js   ✓ 0 命中
grep -F "$LLM_BASE_URL" dist/assets/*.js   ✓ 0 命中
grep -F "$LLM_MODEL"    dist/assets/*.js   ✓ 0 命中
grep -E "VITE_LLM[A-Z_]*"        dist/*.js  ✓ 0 命中
grep -E "sk-[A-Za-z0-9_-]{16,}"  dist/*.js  ✓ 0 命中
```

### 系统侧防火墙（只读检查，未修改）

```text
firewalld         inactive
ufw               inactive 或未安装
iptables INPUT    default ACCEPT；存在 YJ-FIREWALL-INPUT 自定义链，
                  内容均为针对已知恶意 IP 的 REJECT 黑名单（默认 ACCEPT），
                  不影响放行 5173 给一般公网用户
```

### 外部公网访问

**未在本机做出"已通过外部公网访问"的判定**——因为这必须从腾讯云之外的网络发起请求才有意义。当前结论：

- **应用层 / 端口绑定层 / 系统防火墙层** 均已就绪
- **腾讯云安全组层** 需要用户在控制台放行入站 TCP 5173（来源建议先配自己的公网 IP/32）

放行后，公网访问入口：`http://<SERVER_PUBLIC_IP>:5173`。

## 七、人工验证清单（演示脚本见 `docs/demo-script.md`）

1. 新建项目 → 输入需求 → 看到 Agent 5 步 → 预览可交互 ✓
2. 子应用增删改查 + 刷新页面数据仍在（IndexedDB）✓
3. 二次修改 → 新版本生成 ✓
4. 切换历史版本 → 预览恢复 ✓
5. Diff 视图正确（红绿高亮在深色主题下仍清晰）✓
6. DemoProvider 默认运行；服务器 `.env` 配置 `LLM_*` 后可切换 LLM；LLM 失败自动回退 ✓
7. 主界面深色一致；子应用浅 / 深主题切换仍可用 ✓
8. LLM 代理：`/api/llm/status` 仅返回 `{available, model}`；`base_url`、`api_key` **绝不**出现在响应或前端 bundle 中 ✓
