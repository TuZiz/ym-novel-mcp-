# 项目默认写作规则

本规则适用于每一个小说项目。项目级创作必须把 `ym-novel-mcp` 数据库视为唯一可信来源：先读 MCP，再生成，再检查，再写回 MCP。聊天上下文只能作为临时补充，不能替代项目数据库。

## 默认章节目标

- 默认目标字数：每章约 4000 中文字。
- 默认最低字数：每章不少于 3000 中文字。
- 如果项目配置了 `chapterWordTarget`、`minChapterWords`、`maxChapterWords`，以项目配置为准。
- 每章至少 4 个完整场景，必须包含承接、行动、阻力升级、人物变化和结尾钩子。
- 正文必须直接输出小说正文，不输出大纲、分析、解释、提示词、创作说明或 JSON。

## 章节写作流水线

写正文前必须调用 `build_next_chapter_context`，读取项目、当前卷、章节大纲、最近章节、人物状态、世界观、伏笔、时间线、canon facts、经验记忆和写作规则。

写正文后必须调用 `review_chapter_quality`，至少检查：

- 字数是否满足项目门禁。
- 场景数是否足够。
- 是否有具体冲突推进。
- 是否有结尾钩子。
- 是否有严重 AI 味表达。
- 是否用总结替代剧情。

如果质量不合格，必须调用 `expand_chapter_prompt` 生成扩写提示，并重写或扩写后重新检查。

质量合格后，默认必须调用 `save_chapter_with_quality_gate` 保存章节。普通 `save_chapter` 只用于用户明确要求临时草稿、跳过质量门禁、导入旧章节或测试数据。

保存后必须调用 `build_post_chapter_update_prompt` 整理章节新增信息，最后调用 `apply_post_chapter_update` 写回章节摘要、人物状态、世界观、伏笔、时间线和 canon facts。

## 质量门禁

- `save_chapter_with_quality_gate` 是默认保存方式。
- 低于 `minChapterWords` 的章节必须拦截；`too_short` 只能用 `allowShortReason` 绕过。
- `allowQualityOverrideReason` 不能绕过短章。
- 总结化比例过高、AI 味严重、缺少冲突推进或没有结尾钩子的章节必须提醒、重写或扩写。
- 不得在未调用 `review_chapter_quality` 的情况下声称章节已合格。
- 不得在未调用保存工具的情况下声称已保存到 MCP 项目。

## 人物维护

- 重要人物必须有欲望、弱点、秘密、行动逻辑、说话习惯、成长线和关系变化。
- 章节写作后，如果人物状态、战力、地点、关系或目标发生变化，必须通过 `apply_post_chapter_update` 或相应人物工具写回 MCP。
- 人物不得为了推进剧情突然降智、转性或忘记关键经历。
- 涉及人物生成或改名时，优先使用 `generate_character_bibles_prompt`、`apply_character_bibles`、`upsert_name_bank`、`generate_character_name`、`review_character_name`、`replace_character_name`。

## 伏笔维护

- 新线索、新秘密、新物品、新地点、新人物关系、未解释事件、反派动作和主角能力变化都必须作为伏笔、世界观事实、人物状态或 canon facts 写回 MCP。
- 未回收伏笔要持续推进；超期伏笔必须优先处理，或记录明确延后理由。
- 回收伏笔时必须调用后处理写回流程，不能只在正文中解决却不更新数据库。

## 时间线维护

- 每章结束后检查是否产生新的时间、地点、事件顺序、人物移动或战力变化。
- 新事件必须写入 timeline 或 canon facts。
- 不允许角色无解释瞬移，不允许时间跨度与上一章冲突。
- 多地点、多角色并行剧情必须维护清晰的先后顺序。

## 风格与节奏

- 长篇目标是 500 万到 1000 万字，不要过早完结。
- 每章必须承接上一章结尾，不能跳过关键危机。
- 每章必须有明确冲突、推进和钩子。
- 写作风格偏番茄小说：节奏快、爽点明确、情绪直接、钩子强。
- 禁止用设定说明、总结复盘或空泛心理描写替代具体场景。
