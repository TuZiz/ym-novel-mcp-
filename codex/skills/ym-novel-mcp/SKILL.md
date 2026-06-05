---
name: ym-novel-mcp
description: Manage long-form novel projects through the local ym-novel-mcp MCP server. Use when Codex needs to create or update novel projects, worldbuilding, characters, volumes, chapter outlines, chapters, foreshadowing, timelines, continuity checks, or next-chapter writing context by calling the ym-novel-mcp tools, resources, or prompts.
---

# YM Novel MCP

## Overview

Use the local `ym-novel-mcp` server as the source of truth for long-form novel work instead of keeping ad-hoc notes in chat. Prefer its tools whenever the task involves project state, canon continuity, chapter storage, or writing-context assembly.

## Quick Start

- Start with `list_projects` when the user may already have a project.
- Use `create_project` when there is no matching project yet.
- Pull only the state you need before editing or advising: project, recent chapters, relevant characters, relevant world items, open foreshadowings, or timeline.
- If the user asks for next-chapter help, prefer `plan_next_chapter`, `build_next_chapter_context`, or the `write-next-chapter` prompt before inventing a manual outline.
- If the MCP server is unavailable, ask the user to reload Codex MCP config or restart Codex instead of reimplementing persistence in plain files.

## Core Workflows

### Bootstrap a New Novel

1. Run `create_project`.
2. Add initial canon with `add_world_item` and `add_character`.
3. Create structure with `create_volume` and `create_chapter_outline`.
4. When the user is ready to draft, call `plan_next_chapter` or `build_next_chapter_context`.

### Ingest or Update a Chapter

1. Use `save_chapter` to persist finished chapter text.
2. Use `build_post_chapter_update_prompt` if an external AI should extract structured updates from the saved chapter.
3. Use `update_chapter_summary` if the summary needs tightening.
4. Add downstream state updates as needed:
   - `add_timeline_event`
   - `add_foreshadowing`
   - `resolve_foreshadowing`
   - `update_character_state`

### Review a Draft for Continuity

1. Pull context with `get_recent_chapters`, `search_chapters`, `search_characters`, or `search_world_items`.
2. Run `check_continuity`.
3. If the user wants a model-written review prompt, use `continuity-review`.

### Prepare the Next Chapter

1. Pull `get_current_volume` and `get_chapter_outline` when available.
2. Run `plan_next_chapter` for a structured candidate outline, or `build_next_chapter_context` when only context is needed.
3. If the user wants a direct writing prompt, use `write-next-chapter`.

### Backup or Move a Project

1. Use `export_project` to create a structured JSON snapshot.
2. Use `import_project` with default `new_project` mode to copy without touching existing projects.
3. Use `overwrite` only when the user explicitly wants to replace the imported project's existing ID.

## Tool Selection

- Project lifecycle: `create_project`, `get_project`, `list_projects`, `update_project`, `export_project`, `import_project`
- Worldbuilding: `add_world_item`, `search_world_items`, `get_world_context`
- Character state: `add_character`, `get_character`, `search_characters`, `update_character_state`
- Structure: `create_volume`, `get_current_volume`, `update_volume`, `create_chapter_outline`, `get_chapter_outline`, `list_chapter_outlines`, `update_chapter_outline`
- Chapters: `save_chapter`, `get_chapter`, `get_recent_chapters`, `search_chapters`, `update_chapter_summary`
- Foreshadowing: `add_foreshadowing`, `list_open_foreshadowings`, `resolve_foreshadowing`, `search_foreshadowings`
- Timeline: `add_timeline_event`, `get_timeline`, `search_timeline`
- Review and writing prep: `check_continuity`, `build_next_chapter_context`, `plan_next_chapter`, `build_post_chapter_update_prompt`

## Prompts and Resources

- Prompt arguments follow MCP's string argument convention. Pass values such as `chapterIndex` as strings like `"1"`; the server validates and coerces them.
- Use prompt `write-next-chapter` when the user wants a chapter-writing instruction package.
- Use prompt `summarize-chapter` when the user wants a summary prompt, not the final summary itself.
- Use prompt `extract-canon` when the user wants structured canon extraction guidance.
- Use prompt `continuity-review` when the user wants a model-facing review prompt after tool-based checking.
- Read `references/tool-flows.md` for the full tool/resource/prompt map and recommended call order.
