# ym-novel-mcp

`ym-novel-mcp` 是一个本地运行的 TypeScript MCP Server，专门服务于超长篇小说创作管理。它负责维护项目、人物、世界观、卷与章节大纲、正文、伏笔、时间线、连续性检查和下一章写作上下文，不直接调用外部模型 API。

## 为什么适合 500 万到 1000 万字长篇

- 数据持久化在 SQLite，本地可跑，长期维护成本低。
- 章节、世界观、伏笔、时间线拆成独立表，便于持续检索和更新。
- 提供 `build_next_chapter_context`，把最近剧情、关键角色、世界设定和未回收伏笔打包成稳定上下文。
- 提供 `check_continuity`，先用规则和数据库做第一轮连续性拦截，减少人设崩坏和设定冲突。
- 所有 MCP 工具都有 Zod 参数校验，输出统一为 JSON 结构。

## 技术栈

- TypeScript
- Node.js 22+
- `@modelcontextprotocol/sdk` 1.29.0
- SQLite + FTS5
- Zod v4
- pnpm
- Vitest
- tsx
- ESLint + Prettier

## 安装

```bash
pnpm install
```

## 运行

开发模式：

```bash
pnpm dev
```

Windows 一键启动：

```bat
start-ym-novel-mcp.cmd
```

Codex 静默 stdio 启动脚本：

```bat
bin\ym-novel-mcp-stdio.cmd
```

安装 Codex + Claude Code 双版本 skill：

```powershell
powershell -ExecutionPolicy Bypass -File .\bin\install-agent-skills.ps1
```

构建：

```bash
pnpm build
```

测试：

```bash
pnpm test
```

Lint：

```bash
pnpm lint
```

默认数据库位置由 `.env` 控制：

```env
YM_NOVEL_MCP_DB_PATH=./data/novel.db
```

## MCP 客户端配置示例

仓库内也提供了一份可复用模板：

`codex/ym-novel-mcp.config.toml`

注意：这个 Codex 模板里的 `REPLACE_WITH_REPO_PATH` 需要替换成你自己的仓库绝对路径。

开发态直接用 `pnpm dev`：

```json
{
  "mcpServers": {
    "ym-novel-mcp": {
      "command": "pnpm",
      "args": ["dev"],
      "cwd": "C:/Users/32633/Desktop/fanqianmcp"
    }
  }
}
```

构建后用产物启动：

```json
{
  "mcpServers": {
    "ym-novel-mcp": {
      "command": "node",
      "args": ["C:/Users/32633/Desktop/fanqianmcp/dist/src/index.js"]
    }
  }
}
```

## Tools

项目：

- `create_project`
- `get_project`
- `list_projects`
- `update_project`

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

审校与写作：

- `check_continuity`
- `build_next_chapter_context`

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

## Windows + Codex Skill

- Windows 双击启动脚本：`start-ym-novel-mcp.cmd`
- Codex MCP 静默启动脚本：`bin/ym-novel-mcp-stdio.cmd`
- Codex MCP 配置模板：`codex/ym-novel-mcp.config.toml`
- 本机已安装 skill：`C:/Users/32633/.codex/skills/ym-novel-mcp`
- 仓库内可分发 Codex skill：`codex/skills/ym-novel-mcp`

这个 skill 会在你显式提到 `$ym-novel-mcp`，或任务明显是在管理小说项目、角色、世界观、章节、伏笔、时间线、连续性检查、下一章上下文时触发。它会优先引导 Codex 使用本地 `ym-novel-mcp` 的 tools/resources/prompts，而不是在聊天里临时记笔记。

## Claude Code 版本

- 项目级 MCP 配置：`.mcp.json`
- 项目级 skill：`.claude/skills/ym-novel-mcp`
- 可选个人安装脚本：`bin/install-agent-skills.ps1`

Claude Code 克隆仓库后，可以直接在项目内读取 `.mcp.json` 和 `.claude/skills/ym-novel-mcp`。`.mcp.json` 使用了官方推荐的 `${CLAUDE_PROJECT_DIR:-.}` 默认值写法，因此仓库路径变化后仍能定位到 `bin/ym-novel-mcp-stdio.cmd` 和 `data/novel.db`。如果你希望装成个人技能，也可以运行安装脚本，把 skill 同步到 `~/.claude/skills/ym-novel-mcp`。

## 双版本 Skill 结构

- Codex：`codex/skills/ym-novel-mcp`
- Claude Code：`.claude/skills/ym-novel-mcp`
- 统一安装脚本：`bin/install-agent-skills.ps1`

两边的 skill 都围绕同一套本地 MCP 工具流：先查项目，再拉最近章节/角色/世界观/伏笔/时间线，最后做连续性检查或构建下一章上下文。

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

迁移：

- 通过 `src/db/migrations.ts` 管理
- 当前 schema 版本为 `1`

## 开发命令

```bash
pnpm dev
pnpm build
pnpm typecheck
pnpm lint
pnpm test
```

## 测试覆盖

当前测试覆盖了这些关键流程：

- 创建项目并初始化默认写作规则
- 添加人物
- 添加世界观
- 保存章节并回写字数
- 搜索章节
- 获取最近章节
- 添加与回收伏笔
- 构建下一章写作上下文
- 连续性检查返回 warnings

## 后续路线图

- 增加更细的 canon fact 自动抽取与更新策略
- 增加跨表聚合搜索工具
- 增加更强的连续性规则库
- 增加可选 PostgreSQL / 向量库后端
- 增加 Web 管理后台
- 增加导入导出与数据快照能力
