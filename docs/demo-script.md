# AtomForge 演示脚本（2 ~ 3 分钟）

> 目标：通过一次连贯的 30 秒上手 + 120 秒迭代演示，让评审看到 AtomForge 的核心闭环（生成 / 交互 / 持久化 / 修改 / 版本）。

## 0 准备（10s）

- 终端：`npm install && npm run dev`（本地）或 `npm run build && npm run preview -- --host 0.0.0.0 --port 5173`（服务器），打开 `http://<host>:5173`
- 清理：必要时打开 DevTools → Application → IndexedDB → `atomforge` → 全部清空，进入首次体验状态
- （可选）启用真实 LLM：在 `.env` 配 `LLM_BASE_URL` / `LLM_API_KEY` / `LLM_MODEL`，**注意变量名不带 `VITE_` 前缀**——这是确保 Key 仅在服务器进程内、绝不进前端 bundle 的关键

---

## 1 模板一键生成（30s）

> "AtomForge 是一个 AI App Builder Demo，先从模板开始。"

- **动作**：左侧 Sidebar → 点击「极简任务清单」
- **看点**：
  - Sidebar 上方出现项目，自动选中
  - 中间 Workspace 立刻显示需求消息 + Agent 计划摘要
  - 右侧 Preview 渲染出可交互的任务清单：标题、优先级 chip、截止日期、完成 checkbox

> "整个流程都是真实的 — schema 已经生成，预览不是截图，是一个能用的应用。"

---

## 2 操作生成的应用（30s）

- **动作**：
  1. 点击右上「新建任务」→ 输入"准备演示"，优先级 P0，截止今天 → 保存
  2. 再加两条：「整理 README」P1、「跑通 build」P2
  3. 勾选第一条的 checkbox 标记完成
  4. 在搜索框里输入"演示"，筛选下拉选 P0
- **看点**：
  - 列表实时更新，统计卡片"已完成"从 0 跳到 1
  - 搜索 + 筛选叠加生效
  - 点击 Data 标签可看到原始 JSON records

---

## 3 自然语言修改（40s）

> "现在我想让它在视觉和能力上都升级一下。"

- **动作 1**：在底部输入框，点击快捷指令「加近 7 天完成趋势图」→ 发送
- **看点**：
  - Workspace 出现 Agent 5 步轨迹（每步带 spinner → ✓ + 耗时）
  - 完成后 Preview 自动刷新，新增"近 7 天趋势"柱状图，版本号从 v1/1 → v2/2
- **动作 2**：再输入「把界面改成深色模式」→ 发送
- **看点**：
  - Preview 主题切换为深色
  - 版本号 v3/3

> "每一次修改都是一个新版本，原始版本被完整保留，可以随时切回。"

---

## 4 版本管理 / Diff / 恢复（30s）

- **动作**：
  1. 点击 Topbar 旁的版本下拉，切换到 v1
  2. 看到右上角"查看历史"提示
  3. 切到 Diff 标签 → 看到红绿色 schema 差异
  4. 在版本列表中点击 v1 旁的「恢复」按钮
- **看点**：
  - 生成一个 v4，schema 内容等同 v1，但被作为新版本保留（可追溯）
  - 演示了"时间旅行"

---

## 5 持久化 / 导出 / 降级（20s）

- **动作**：
  1. 直接 **刷新浏览器** — 项目、版本、对话、数据全部仍在
  2. 点击右上「下载图标」导出 JSON
  3. 删除当前项目（左侧 hover 项目 → 垃圾桶）
  4. 点击「上传图标」选刚才导出的 JSON — 项目被恢复，名字带 "(导入)" 后缀

> "所有数据都在 IndexedDB 里，无需登录。"

- **(可选) LLM 降级演示**：
  - 临时在 `.env` 写错的 `LLM_API_KEY` 重启 → 勾上"使用真实 LLM" → 发指令
  - 看 Agent 调用 `/api/llm/chat` 失败后自动回退到 Demo，Toast 显示原因
  - 强调："服务端代理：`/api/llm/status` 只返回 `{available, model}`；`base_url` 与 `api_key` 从未到达浏览器；可在 DevTools Network 面板验证"

---

## 6 收尾（10s）

> "AtomForge 用一句话需求 + 通用 Schema Renderer，演示了 Atoms 风格的核心体验：
> 真实生成、真实交互、真实持久化、真实版本控制。
> 安全侧：LLM Key 走服务端代理，浏览器永不持有，公网部署也合规。
> 接下来可以加 HTTPS / 域名、加流式输出、加多实体支持，把它做成完整产品。"

---

## 常用快捷指令（演示备用）

| 指令 | 效果 |
| --- | --- |
| 增加深色模式 / 切换浅色模式 | theme.mode 切换 |
| 加上搜索 | features.search = true |
| 加上按分类筛选 | features.filters 注入 |
| 加近 7 天趋势图 | stats 增加 weeklyTrend |
| 加分类占比饼图 | stats 增加 categoryPie |
| 给每条加优先级 P0-P3 | 字段增加 priority |
| 加标签字段 | 字段增加 tag |
| 加备注 | 字段增加 longtext note |
| 改成蓝色主题 / 紫色 / 绿色 ... | theme.primary 切换 |
| 标题改简洁一点 | tagline 精简 |
| 重命名为「我的清单」 | name 替换 |
