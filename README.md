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

Windows 静默 stdio 启动脚本：

```bat
bin\ym-novel-mcp-stdio.cmd
```

默认数据库路径：

```env
YM_NOVEL_MCP_DB_PATH=./data/novel.db
```

## Tools

项目：

- `create_project`
- `get_project`
- `list_projects`
- `update_project`
- `export_project`
- `import_project`

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

审校与写作流水线：

- `check_continuity`
- `build_next_chapter_context`
- `plan_next_chapter`
- `build_post_chapter_update_prompt`

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
      "args": ["/d", "/c", "${CLAUDE_PROJECT_DIR:-.}\\bin\\ym-novel-mcp-stdio.cmd"],
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

## 500 万到 1000 万字推荐流程

1. 用 `create_project` 建项目，设置题材、平台、目标字数和风格。
2. 用 `add_world_item` 记录不可违背的世界规则、地点、势力、战力体系和禁忌。
3. 用 `add_character` 与 `add_character_relationship` 维护人物状态、地点、能力和关系张力。
4. 用 `create_volume` 和 `create_chapter_outline` 先搭卷目标与近期章节骨架，不需要一次性规划全书。
5. 每章写完后用 `save_chapter` 存正文，随后用 `build_post_chapter_update_prompt` 让外部 AI 抽取结构化更新。
6. 把抽取结果人工确认后写回人物、世界观、伏笔、时间线和摘要。
7. 写下一章前先用 `build_next_chapter_context` 或 `plan_next_chapter` 获取上下文和候选大纲。
8. 新草稿落库前用 `check_continuity` 做本地连续性预检。
9. 定期用 `export_project` 做结构化备份；迁移或复制项目时用 `import_project` 默认 `new_project` 模式。

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

全文检索：

- `chapters_fts`
- `world_items_fts`

启动时会确认 schema 对象存在；如果 FTS 行数和主表行数不一致，会按项目重建 FTS 索引。

## 下一阶段建议

- 增加“章节整理结果导入”工具，把 `build_post_chapter_update_prompt` 的 JSON 输出批量写回数据库。
- 增强连续性规则库，加入战力等级、角色位置跨度、时间线顺序和伏笔超期检查。
- 增加项目快照和差异对比，便于超长篇长期回滚。
- 增加跨表聚合搜索工具，统一搜索人物、世界观、章节、伏笔、时间线和 canon facts。
