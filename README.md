# ym-novel-mcp

`ym-novel-mcp` 是一个本地运行的 TypeScript MCP Server，面向 500 万到 1000 万字单本长篇小说项目。它负责维护项目、人物、世界观、卷与章节大纲、正文、伏笔、时间线、连续性检查、导入导出和下一章写作上下文，不直接调用 OpenAI、Claude 或任何外部模型 API。

## 为什么适合超长篇

- SQLite 本地持久化，数据可控，长期维护成本低。
- 章节、世界观、人物、伏笔、时间线和规则分表存储，方便持续检索和更新。
- `build_next_chapter_context` 和 `plan_next_chapter` 可以稳定打包下一章上下文与候选大纲。
- `check_continuity` 先用本地规则做连续性预检，减少人设、地点、设定和伏笔断裂。
- `export_project` / `import_project` 支持整书结构化迁移，并在导入后重建 FTS 和重新计算字数。

## 技术栈

- Node.js 22+
- TypeScript strict mode
- `@modelcontextprotocol/sdk`
- SQLite + FTS5
- Zod v4
- pnpm
- Vitest
- ESLint + Prettier

## 安装与运行

```bash
pnpm install
pnpm build
pnpm test
pnpm lint
```

开发模式：

```bash
pnpm dev
```

构建后运行：

```bash
pnpm start
```

`pnpm build` 会把可执行入口输出到 `dist/`，`pnpm start` 默认启动 HTTP/Web 后台服务；需要 STDIO 兼容模式时使用 `pnpm start:stdio`。

Windows 静默 stdio 启动脚本：

```bat
start-ym-novel-mcp.cmd
```

默认数据库路径：

```env
YM_NOVEL_MCP_DB_PATH=./data/novel.db
```

## 可选 HTTP MCP 模式

默认入口是 Streamable HTTP MCP，适合云服务器或多电脑通过 IP / 域名访问：

```bash
pnpm build
pnpm start
```

Windows 脚本：

```bat
bin\ym-novel-mcp-http.cmd
```

根目录也提供双击入口：

```bat
start-ym-novel-mcp.cmd
```

Windows 启动脚本会在缺少 `node_modules` 或 TypeScript 编译器时自动执行 `pnpm install --frozen-lockfile`。如果云服务器访问 npm registry 超时，脚本会先增加重试并回退到 `https://registry.npmmirror.com`；也可以手动指定可访问镜像：

```bat
set YM_NOVEL_MCP_NPM_REGISTRY=https://registry.npmmirror.com
start-ym-novel-mcp.cmd
```

如果发布包需要完全避开服务器下载 npm 包，可以在本机先打一个自带依赖的 Windows 云端包：

```bash
pnpm release:windows:deps
```

脚本会生成 `release/ym-novel-mcp-windows-cloud-with-deps-<时间戳>.zip`，包内包含 `dist/`、`node_modules/` 和 `runtime/node.exe`。服务器解压后运行 `start-ym-novel-mcp.cmd`，启动脚本检测到这两个目录会跳过 `pnpm install` 和 `pnpm build`，并优先使用包内 Node runtime 直接启动 HTTP MCP 服务。

打包脚本会优先在发布目录里安装生产依赖，尽量减小 zip 体积；如果本机网络或 pnpm 缓存不可用，会自动回退为复制当前完整 `node_modules`。需要强制只使用本机缓存时，可以先设置：

```bat
set YM_NOVEL_MCP_RELEASE_OFFLINE=1
pnpm release:windows:deps
```

启动成功后窗口会显示 `HTTP MCP server is READY`，并打印 `Endpoint`、`Health`、`Admin`、`Database` 和 `Auth`。看到这组信息就说明服务已经监听成功。

HTTP 环境变量：

```env
YM_NOVEL_MCP_DB_PATH=/data/novel.db
YM_NOVEL_MCP_HTTP_HOST=0.0.0.0
YM_NOVEL_MCP_HTTP_PORT=52778
YM_NOVEL_MCP_TOKEN=change-this-token
```

MCP endpoint：

```text
http://SERVER_IP:52778/mcp
```

健康检查：

```text
http://SERVER_IP:52778/healthz
```

Web 后台管理平台：

```text
http://SERVER_IP:52778/admin
```

后台管理平台复用 HTTP token。设置了 `YM_NOVEL_MCP_TOKEN` 时，打开页面后在左侧 token 输入框填入同一个 token，后台 API 会用 `Authorization: Bearer <token>` 调用。

第一版后台定位为只读监控面板，支持：

- 查看服务状态、运行时长、进程 PID、Node 版本和内存占用。
- 查看数据库路径、数据库大小、最后修改时间和表计数。
- 查看项目列表、项目状态、目标字数和当前字数。
- 跨章节、人物、世界观、伏笔、时间线和 canon facts 做只读诊断搜索。
- 查看项目快照列表。
- 写入、创建项目、创建快照仍通过 MCP tools 完成，不在 Web 监控页操作。

安全默认值：

- `YM_NOVEL_MCP_HTTP_HOST` 默认是 `127.0.0.1`，只允许本机访问。
- 当 host 不是 `127.0.0.1` / `localhost` / `::1` 时，必须设置 `YM_NOVEL_MCP_TOKEN`。
- HTTP 客户端应发送 `Authorization: Bearer <token>`，也支持 `x-ym-novel-mcp-token`。
- 云端部署时建议把 `novel.db` 放到持久化磁盘，不要放容器临时目录。
- 不建议多台电脑共享同一个 SQLite 文件直接写；推荐只让云端 HTTP 服务持有数据库，其他客户端通过 `/mcp` 调用。

### 云服务器部署步骤

1. 在云服务器安装 Node.js 22+ 和 pnpm。
2. 克隆仓库并安装依赖：

```bash
git clone https://github.com/TuZiz/ym-novel-mcp-.git
cd ym-novel-mcp-
pnpm install --frozen-lockfile
pnpm build
```

3. 准备持久化目录，例如 `/data/ym-novel-mcp/novel.db`。
4. 设置环境变量：

```bash
export YM_NOVEL_MCP_DB_PATH=/data/ym-novel-mcp/novel.db
export YM_NOVEL_MCP_HTTP_HOST=0.0.0.0
export YM_NOVEL_MCP_HTTP_PORT=52778
export YM_NOVEL_MCP_TOKEN=change-this-token
```

5. 启动：

```bash
pnpm start
```

6. 放行云服务器防火墙和安全组里的 `52778` 端口。公网部署建议再套 HTTPS 反向代理。

## Tools

项目：

- `create_project`
- `get_project`
- `list_projects`
- `update_project`
- `export_project`
- `import_project`
- `create_project_snapshot`
- `list_project_snapshots`
- `get_project_snapshot`

世界观：

- `add_world_item`
- `search_world_items`
- `get_world_context`

人物：

- `add_character`
- `get_character`
- `search_characters`
- `update_character_state`
- `add_character_relationship`
- `update_character_relationship`

卷与大纲：

- `create_volume`
- `get_current_volume`
- `update_volume`
- `create_chapter_outline`
- `get_chapter_outline`
- `list_chapter_outlines`
- `update_chapter_outline`

章节：

- `save_chapter`
- `get_chapter`
- `get_recent_chapters`
- `search_chapters`
- `update_chapter_summary`

伏笔：

- `add_foreshadowing`
- `list_open_foreshadowings`
- `resolve_foreshadowing`
- `search_foreshadowings`

时间线：

- `add_timeline_event`
- `get_timeline`
- `search_timeline`

统一检索：

- `search_all`

审校与写作流水线：

- `check_continuity`
- `build_next_chapter_context`
- `plan_next_chapter`
- `build_post_chapter_update_prompt`
- `apply_post_chapter_update`

经验记忆：

- `record_experience`
- `search_experiences`
- `record_feedback`
- `promote_experience`
- `suppress_experience`
- `get_learning_context`
- `record_workflow_run`

更新类工具中，省略字段表示保持原值；文档中标为 nullable 的字段可以传 `null` 清空，例如 `update_project.genre`、`update_volume.goal`、`update_chapter_outline.endingHook` 和 `update_character_relationship.description`。

## 第二阶段新增 Tools

`export_project`

导出整个项目为结构化 JSON：

```json
{
  "project": {},
  "worldItems": [],
  "characters": [],
  "relationships": [],
  "volumes": [],
  "chapterOutlines": [],
  "chapters": [],
  "foreshadowings": [],
  "timelineEvents": [],
  "canonFacts": [],
  "writingRules": []
}
```

`import_project`

从 `export_project` 的 JSON 导入项目。默认 `mode` 是 `new_project`，会生成全新的项目和实体 ID，不破坏已有项目。`overwrite` 只覆盖导入数据里 `project.id` 对应的项目。导入后会重建章节和世界观 FTS 索引，并重新计算 `current_words`。

`plan_next_chapter`

基于当前卷纲、最近章节、未回收伏笔、人物状态、世界观规则和写作规则生成下一章候选大纲：

```json
{
  "outlineSuggestion": {
    "title": "",
    "goal": "",
    "conflict": "",
    "keyEvents": [],
    "requiredCharacters": [],
    "requiredForeshadowing": [],
    "endingHook": ""
  },
  "context": {},
  "instruction": ""
}
```

`build_post_chapter_update_prompt`

为指定章节生成中文整理提示词，内含 JSON Schema，供外部 AI 从章节正文中抽取章节摘要、人物状态变化、人物位置变化、新增伏笔、已回收伏笔、世界观事实、时间线事件和下一章钩子。

`build_next_chapter_context` 和 `plan_next_chapter` 会对返回上下文里的超长最近章节正文做有界压缩，保留开头与结尾，避免长篇项目在 MCP 响应中塞入过大的历史正文。需要完整正文时使用 `get_chapter` 或 `get_recent_chapters`。

## 第三阶段新增 Tools

`apply_post_chapter_update`

把 `build_post_chapter_update_prompt` 生成的整理提示词交给外部 AI 后，可将人工确认过的结构化 JSON 写回数据库。支持部分更新：

- 更新章节 `summary` / `hook`
- 按 `characterId` 或项目内角色名更新人物状态、战力、地点、关系摘要和出场章
- 新增世界观、伏笔、时间线事件和 canon facts
- 回收已有伏笔
- 找不到角色或伏笔时返回 warning，不会自动乱创建人物

`search_all`

跨表统一搜索章节、人物、世界观、伏笔、时间线和 canon facts。默认搜索全部类型，可用 `include` 限定范围：

```json
{
  "projectId": "project_xxx",
  "query": "古碑",
  "limit": 20,
  "include": ["chapters", "world_items", "canon_facts"]
}
```

返回结果统一包含 `type`、`id`、`title`、`snippet`、`score` 和 `metadata`，方便 AI 判断信息来源。章节和世界观优先走 FTS，其他类型使用本地 LIKE 检索。

`create_project_snapshot`

创建项目快照，内容为当前 `export_project` 的结构化 JSON，不覆盖旧快照：

```json
{
  "projectId": "project_xxx",
  "label": "第一卷收束前",
  "notes": "写完第 120 章后创建。"
}
```

配套工具：

- `list_project_snapshots`
- `get_project_snapshot`

## 越用越好用

第四阶段新增经验记忆层，不做模型训练，不调用外部 AI API，只在本地 SQLite 中记录用户确认过的方案、偏好、禁忌和工作流反馈。后续 `build_next_chapter_context` 会自动返回 `learningContext`，并把经验提示片段注入 `instruction`。

推荐用法：

- 用户发现某个方案好用 → `record_experience`
- 用户发现某个输出不好 → `record_feedback`
- 某条经验反复有效 → `promote_experience`
- 某条经验不再适用 → `suppress_experience`
- 写下一章前 → `build_next_chapter_context` 自动带出 `learningContext`

`record_experience` 示例：

```json
{
  "projectId": "project_xxx",
  "scope": "style",
  "type": "avoid_pattern",
  "title": "不要让主角突然圣母",
  "content": "主角可以善良，但不能在关键利益冲突中无理由放过反复害他的敌人。",
  "reason": "用户多次否定这种写法，会削弱爽感。",
  "tags": ["主角", "爽文", "人设"]
}
```

`get_learning_context` 返回：

```json
{
  "bestPractices": [],
  "avoidPatterns": [],
  "userPreferences": [],
  "styleRules": [],
  "workflowRules": [],
  "canonDecisions": [],
  "instruction": "以下是用户长期确认过的写作偏好和正确方案，请优先遵守：..."
}
```

已有工具增强：

- `build_next_chapter_context` 返回 `learningContext`，并提示优先遵守用户确认过的经验、避免已否定写法。
- `check_continuity` 会对草稿触犯 `avoid_pattern`、违背 `user_preference`、否定 `canon_decision` 的情况追加 warning。
- `plan_next_chapter` 在规划提示中要求参考 best practice、避开 avoid pattern、尊重偏好和 style rule。
- `apply_post_chapter_update` 成功后自动记录 `workflow_run`，但不会自动创建经验。

## Resources

- `novel://projects`
- `novel://project/{projectId}`
- `novel://project/{projectId}/characters`
- `novel://project/{projectId}/world`
- `novel://project/{projectId}/chapters`
- `novel://project/{projectId}/foreshadowings`
- `novel://project/{projectId}/timeline`
- `novel://project/{projectId}/rules`

## Prompts

- `write-next-chapter`
- `summarize-chapter`
- `extract-canon`
- `continuity-review`

Prompt 参数遵循 MCP 协议的字符串参数约定；例如 `chapterIndex` 可由客户端传入 `"1"`，服务端会校验并转换为正整数。

## MCP 端到端测试

`tests/mcp-tools.test.ts` 使用 MCP SDK 的 `Client` + `InMemoryTransport` 连接真实 `McpServer`，通过 `client.callTool` 覆盖工具输入输出路径，而不是直接调用 service。覆盖流程包括：

- `create_project`
- `add_world_item`
- `add_character`
- `create_volume`
- `create_chapter_outline`
- `save_chapter`
- `add_foreshadowing`
- `build_next_chapter_context`
- `check_continuity`
- `search_chapters`
- `export_project`
- `import_project`
- `plan_next_chapter`
- `build_post_chapter_update_prompt`
- `apply_post_chapter_update`
- `search_all`
- `create_project_snapshot`
- `list_project_snapshots`
- `get_project_snapshot`
- `record_experience`
- `search_experiences`
- `record_feedback`
- `promote_experience`
- `suppress_experience`
- `get_learning_context`
- `record_workflow_run`

`tests/stdio.test.ts` 会通过 MCP SDK 的 `StdioClientTransport` 启动 `src/index.ts`，验证真实 stdio 入口可以被 MCP 客户端连接并调用工具。

运行：

```bash
pnpm test
```

## GitHub Actions

CI 配置位于 `.github/workflows/ci.yml`，在 push 到 `main` / `master` 或打开 PR 时运行：

```bash
pnpm install --frozen-lockfile
pnpm build
pnpm test
pnpm lint
```

CI 使用 Node.js 22 和 pnpm 10。首次推送到 GitHub 后，可以在仓库 Actions 页面查看状态。

## 推荐 Codex 配置

仓库内提供模板：

```text
codex/ym-novel-mcp.config.toml
```

Windows 推荐使用 `cmd /d /c` 调用仓库脚本，并把数据库路径显式传入：

```toml
[mcp_servers.ym-novel-mcp]
type = "stdio"
command = "cmd"
args = ["/d", "/c", "C:/Users/32633/Desktop/fanqianmcp/bin/ym-novel-mcp-stdio.cmd"]
startup_timeout_sec = 120

[mcp_servers.ym-novel-mcp.env]
YM_NOVEL_MCP_DB_PATH = "C:/Users/32633/Desktop/fanqianmcp/data/novel.db"
```

如果路径包含空格，优先使用仓库内脚本路径并确保外层 MCP 客户端正确传参，不要在 JSON/TOML 中手写未转义的裸反斜杠。

## 推荐 Claude Code 配置

仓库已提供项目级 `.mcp.json`：

```json
{
  "mcpServers": {
    "ym-novel-mcp": {
      "type": "stdio",
      "command": "cmd",
      "args": [
        "/d",
        "/c",
        "${CLAUDE_PROJECT_DIR:-.}\\bin\\ym-novel-mcp-stdio.cmd"
      ],
      "env": {
        "YM_NOVEL_MCP_DB_PATH": "${CLAUDE_PROJECT_DIR:-.}\\data\\novel.db"
      }
    }
  }
}
```

可选安装 Codex + Claude Code 双版本 skill：

```powershell
powershell -ExecutionPolicy Bypass -File .\bin\install-agent-skills.ps1
```

## Skill 发布包

项目内提供可发布的通用 skill 包：

```text
skills/ym-novel-mcp
```

该目录可直接作为 Codex/Claude Code 兼容版本分发；`SKILL.md` 是通用入口，`agents/openai.yaml` 给 Codex UI 使用，`references/` 保存按需加载的工具流和客户端配置说明。

## 500 万到 1000 万字推荐流程

1. 用 `create_project` 建项目，设置题材、平台、目标字数和风格。
2. 用 `add_world_item` 记录不可违背的世界规则、地点、势力、战力体系和禁忌。
3. 用 `add_character` 与 `add_character_relationship` 维护人物状态、地点、能力和关系张力。
4. 用 `create_volume` 和 `create_chapter_outline` 先搭卷目标与近期章节骨架，不需要一次性规划全书。
5. 每章推荐流水线：`build_next_chapter_context` → 外部 AI 写正文 → `check_continuity` → `save_chapter` → `build_post_chapter_update_prompt` → 外部 AI 抽取结构化更新 → `apply_post_chapter_update` → `create_project_snapshot`。
6. 抽取结果写回前建议人工确认，尤其是人物战力、位置变化、伏笔回收和 canon facts。
7. 写下一章前先用 `build_next_chapter_context` 或 `plan_next_chapter` 获取上下文和候选大纲。
8. 需要找资料时优先用 `search_all` 统一检索，再按来源进入具体工具查看详情。
9. 定期用 `export_project` 或 `create_project_snapshot` 做结构化备份；迁移或复制项目时用 `import_project` 默认 `new_project` 模式。

## 数据库说明

核心表：

- `projects`
- `world_items`
- `characters`
- `character_relationships`
- `volumes`
- `chapter_outlines`
- `chapters`
- `foreshadowings`
- `timeline_events`
- `canon_facts`
- `writing_rules`
- `experience_records`
- `feedback_events`
- `workflow_runs`
- `project_snapshots`

全文检索：

- `chapters_fts`
- `world_items_fts`

启动时会确认 schema 对象存在；如果 FTS 行数和主表行数不一致，或章节、世界观主表内容与 FTS 内容发生漂移，会按项目重建 FTS 索引。

## 下一阶段建议

- 为经验记忆增加 FTS5 索引和更细的相似度评分，以便超大经验库仍能快速检索。
- 增加经验记忆的导出、导入和快照差异视图，方便迁移项目级偏好。
- 增加快照恢复和快照差异对比，便于超长篇长期回滚。
- 为 `apply_post_chapter_update` 增加更严格的外部 AI 输出 schema 示例和人工审核 checklist。
- 增强连续性规则库，继续细化时间跨度、战力等级层级和多地点移动成本。
- 增加更多统计工具，例如角色出场间隔、伏笔平均回收周期、卷内冲突推进密度。
