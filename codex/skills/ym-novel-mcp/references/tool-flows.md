# Tool Flows

## Resource Map

- `novel://projects`
- `novel://project/{projectId}`
- `novel://project/{projectId}/characters`
- `novel://project/{projectId}/world`
- `novel://project/{projectId}/chapters`
- `novel://project/{projectId}/foreshadowings`
- `novel://project/{projectId}/timeline`
- `novel://project/{projectId}/rules`

Use resources when the user wants current project state in a readable snapshot and no mutation is needed.

## Prompt Map

- `write-next-chapter`
- `summarize-chapter`
- `extract-canon`
- `continuity-review`

Use prompts when the user needs a model-facing instruction package, not when the user is asking to mutate stored state directly.
Prompt arguments follow MCP's string argument convention. Pass `chapterIndex` as a string like `"1"`; the server validates and coerces it.

## Recommended Call Order

### New Project

1. `list_projects`
2. `create_project`
3. `add_world_item`
4. `add_character`
5. `create_volume`
6. `create_chapter_outline`

### Continue an Existing Story

1. `list_projects` or `get_project`
2. `search_all` when the user asks about a broad term across chapters, characters, world, timeline, foreshadowings, and canon
3. `get_recent_chapters`
4. `list_open_foreshadowings`
5. `get_timeline`
6. `plan_next_chapter` or `build_next_chapter_context`

### Save a Finished Chapter

1. `save_chapter`
2. `build_post_chapter_update_prompt` when an external AI should extract updates
3. `apply_post_chapter_update` after the structured extraction is confirmed
4. `update_chapter_summary` if the stored summary needs a second pass
5. `create_project_snapshot` after important chapter/state milestones
6. Use manual tools such as `update_character_state`, `add_timeline_event`, `add_foreshadowing`, or `resolve_foreshadowing` only for targeted corrections outside the extraction flow

### Review a New Draft

1. `search_all`
2. `search_chapters`, `search_characters`, or `search_world_items` for focused follow-up
3. `check_continuity`
4. `continuity-review` if the user wants an LLM review prompt

### Backup or Import

1. `create_project_snapshot`
2. `list_project_snapshots`
3. `get_project_snapshot`
4. `export_project`
5. `import_project` with default `new_project` mode for safe copies
6. `import_project` with `overwrite` only after explicit confirmation
