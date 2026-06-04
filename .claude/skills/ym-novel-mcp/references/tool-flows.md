# Tool Flows

## Resources

- `novel://projects`
- `novel://project/{projectId}`
- `novel://project/{projectId}/characters`
- `novel://project/{projectId}/world`
- `novel://project/{projectId}/chapters`
- `novel://project/{projectId}/foreshadowings`
- `novel://project/{projectId}/timeline`
- `novel://project/{projectId}/rules`

Use resources when the user wants current stored state and no mutation is needed.

## Prompts

- `write-next-chapter`
- `summarize-chapter`
- `extract-canon`
- `continuity-review`

Use prompts when the user wants a model-facing instruction package instead of a direct state mutation.

## Recommended Call Order

### New project

1. `list_projects`
2. `create_project`
3. `add_world_item`
4. `add_character`
5. `create_volume`
6. `create_chapter_outline`

### Continue an existing story

1. `list_projects` or `get_project`
2. `get_recent_chapters`
3. `list_open_foreshadowings`
4. `get_timeline`
5. `build_next_chapter_context`

### Save a finished chapter

1. `save_chapter`
2. `update_character_state`
3. `add_timeline_event`
4. `add_foreshadowing` or `resolve_foreshadowing`
5. `update_chapter_summary`

### Review a new draft

1. `search_chapters`
2. `search_characters`
3. `search_world_items`
4. `check_continuity`
5. `continuity-review`
