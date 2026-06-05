---
name: ym-novel-mcp
description: Manage long-form novel projects through the local ym-novel-mcp MCP server. Use when an agent needs to create, inspect, update, search, checkpoint, or review a novel project using ym-novel-mcp tools, resources, or prompts in Codex, Claude Code, or another MCP-capable coding agent.
---

# YM Novel MCP

Use the local `ym-novel-mcp` server as the source of truth for long-form novel work. Prefer MCP tools over chat-only notes whenever the task touches project state, canon, chapters, character continuity, worldbuilding, foreshadowing, timeline events, snapshots, or writing context.

## Quick Start

- Start with `list_projects` when the user may already have a project.
- Use `create_project` only when there is no matching project.
- Pull the smallest useful context before advising: `search_all`, recent chapters, relevant characters, world items, open foreshadowings, timeline, canon facts, or rules.
- For next-chapter work, prefer `build_next_chapter_context`, `plan_next_chapter`, or prompt `write-next-chapter`.
- For draft review, run `check_continuity` before relying on memory.
- If the MCP server is unavailable, help the user verify the local stdio command and client config instead of recreating persistence in files.

## Core Workflows

### Bootstrap a Novel

1. Call `create_project`.
2. Add initial canon with `add_world_item` and `add_character`.
3. Add structure with `create_volume` and `create_chapter_outline`.
4. Build drafting context with `plan_next_chapter` or `build_next_chapter_context`.

### Continue a Long Story

1. Call `list_projects` or `get_project`.
2. Use `search_all` for broad lookup across chapters, characters, world items, foreshadowings, timeline, and canon facts.
3. Pull recent state with `get_recent_chapters`, `list_open_foreshadowings`, and `get_timeline` as needed.
4. Build the next writing package with `build_next_chapter_context` or `plan_next_chapter`.

### Save Finished Chapter Progress

1. Persist the final chapter text with `save_chapter`.
2. Generate an extraction prompt with `build_post_chapter_update_prompt` when an external AI should summarize downstream state updates.
3. Apply the confirmed structured extraction with `apply_post_chapter_update`.
4. Use `update_chapter_summary` only for a targeted second pass.
5. Create rollback points with `create_project_snapshot` after important chapter/state milestones.

### Review a Draft

1. Pull support context with `search_all` and focused searches only when needed.
2. Run `check_continuity`.
3. Use prompt `continuity-review` only when the user wants a model-facing review prompt.

### Backup, Snapshot, or Move a Project

1. Use `create_project_snapshot` for an in-project rollback point.
2. Use `list_project_snapshots` and `get_project_snapshot` to inspect saved snapshots.
3. Use `export_project` for portable JSON export.
4. Use `import_project` with default `new_project` mode for safe copies.
5. Use `overwrite` only after explicit user confirmation.

## Tool Groups

- Projects: `create_project`, `get_project`, `list_projects`, `update_project`, `export_project`, `import_project`, `create_project_snapshot`, `list_project_snapshots`, `get_project_snapshot`
- Cross-source search: `search_all`
- Worldbuilding: `add_world_item`, `search_world_items`, `get_world_context`
- Characters: `add_character`, `get_character`, `search_characters`, `update_character_state`, `add_character_relationship`, `update_character_relationship`
- Structure: `create_volume`, `get_current_volume`, `update_volume`, `create_chapter_outline`, `get_chapter_outline`, `list_chapter_outlines`, `update_chapter_outline`
- Chapters: `save_chapter`, `get_chapter`, `get_recent_chapters`, `search_chapters`, `update_chapter_summary`
- Foreshadowing: `add_foreshadowing`, `list_open_foreshadowings`, `resolve_foreshadowing`, `search_foreshadowings`
- Timeline: `add_timeline_event`, `get_timeline`, `search_timeline`
- Review and writing prep: `check_continuity`, `build_next_chapter_context`, `plan_next_chapter`, `build_post_chapter_update_prompt`, `apply_post_chapter_update`

## Prompts and Resources

- Prompt arguments follow MCP's string argument convention. Pass numeric values such as `chapterIndex` as strings like `"1"` when calling prompts.
- Use prompt `write-next-chapter` for a chapter-writing instruction package.
- Use prompt `summarize-chapter` for a model-facing chapter summary prompt.
- Use prompt `extract-canon` for structured canon extraction guidance.
- Use prompt `continuity-review` after tool-based continuity checking.
- Read `references/tool-flows.md` for detailed call order and resource URI mapping.
- Read `references/client-setup.md` when the server is not visible to Codex, Claude Code, or another MCP client.
