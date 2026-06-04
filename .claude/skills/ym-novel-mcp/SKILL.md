---
name: ym-novel-mcp
description: Manage long-form novel projects through the local ym-novel-mcp MCP server. Use when Claude Code needs to create or update novel projects, worldbuilding, characters, volumes, chapter outlines, chapters, foreshadowing, timelines, continuity checks, or next-chapter writing context through the repo's shared MCP tools.
---

# YM Novel MCP

Use the local `ym-novel-mcp` server as the source of truth for long-form novel work instead of keeping project state only in chat.

## Start Here

- Run `list_projects` if the user may already have a novel project.
- Run `create_project` if the project does not exist yet.
- Pull only the context you need before advising or editing: recent chapters, characters, world items, open foreshadowings, timeline, or rules.
- Prefer `plan_next_chapter`, `build_next_chapter_context`, or prompt `write-next-chapter` when the user asks for next-chapter help.
- Prefer `check_continuity` before giving continuity advice from memory.

## Core Flows

### Bootstrap a novel

1. Call `create_project`.
2. Add initial canon with `add_world_item` and `add_character`.
3. Add structure with `create_volume` and `create_chapter_outline`.
4. Build drafting context with `plan_next_chapter` or `build_next_chapter_context`.

### Save story progress

1. Persist正文 with `save_chapter`.
2. Generate an extraction prompt with `build_post_chapter_update_prompt` when an external AI should summarize downstream updates.
3. Update summaries with `update_chapter_summary` when needed.
4. Update downstream state through:
   - `update_character_state`
   - `add_timeline_event`
   - `add_foreshadowing`
   - `resolve_foreshadowing`

### Review a draft

1. Pull support context through `get_recent_chapters`, `search_chapters`, `search_characters`, and `search_world_items`.
2. Run `check_continuity`.
3. Use prompt `continuity-review` only if the user wants a model-facing review prompt.

### Backup or move a project

1. Use `export_project` for a structured JSON snapshot.
2. Use `import_project` default `new_project` mode to copy without damaging existing projects.
3. Use `overwrite` only when the user explicitly asks to replace the imported project ID.

## Tool Groups

- Projects: `create_project`, `get_project`, `list_projects`, `update_project`, `export_project`, `import_project`
- Worldbuilding: `add_world_item`, `search_world_items`, `get_world_context`
- Characters: `add_character`, `get_character`, `search_characters`, `update_character_state`, `add_character_relationship`, `update_character_relationship`
- Structure: `create_volume`, `get_current_volume`, `update_volume`, `create_chapter_outline`, `get_chapter_outline`, `list_chapter_outlines`, `update_chapter_outline`
- Chapters: `save_chapter`, `get_chapter`, `get_recent_chapters`, `search_chapters`, `update_chapter_summary`
- Foreshadowing: `add_foreshadowing`, `list_open_foreshadowings`, `resolve_foreshadowing`, `search_foreshadowings`
- Timeline: `add_timeline_event`, `get_timeline`, `search_timeline`
- Review and writing prep: `check_continuity`, `build_next_chapter_context`, `plan_next_chapter`, `build_post_chapter_update_prompt`

## References

- Read `references/tool-flows.md` for the full tool, resource, and prompt map.
