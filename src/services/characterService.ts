import type Database from "better-sqlite3";
import type {
  AddCharacterInput,
  ApplyCharacterBiblePatch,
  AddCharacterRelationshipInput,
  Character,
  CharacterRelationship,
  UpdateCharacterRelationshipInput,
  UpdateCharacterStateInput,
} from "../types/novel.js";
import { assertFound } from "../utils/errors.js";
import { createId } from "../utils/ids.js";
import { mapCharacterRelationshipRow, mapCharacterRow } from "../utils/rows.js";
import { patchValue } from "../utils/patch.js";
import { nowIso, serializeStringArray, uniqueStrings } from "../utils/text.js";
import { ProjectService } from "./projectService.js";

export class CharacterService {
  constructor(
    private readonly db: Database.Database,
    private readonly projectService: ProjectService,
  ) {}

  addCharacter(input: AddCharacterInput): Character {
    this.projectService.ensureProjectExists(input.projectId);

    const id = createId("character");
    const now = nowIso();
    const aliases = uniqueStrings(input.aliases ?? []);

    const transaction = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO characters (
            id, project_id, name, aliases, role, personality, motivation, ability, appearance,
            relationship_summary, current_state, power_level, location, character_arc, weakness,
            secret, voice, speech_habits, moral_code, relationship_goal, growth_stage,
            first_scene_plan, status,
            first_appearance_chapter, last_appearance_chapter, created_at, updated_at
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active', NULL, NULL, ?, ?)`,
        )
        .run(
          id,
          input.projectId,
          input.name,
          serializeStringArray(aliases),
          input.role ?? null,
          input.personality ?? null,
          input.motivation ?? null,
          input.ability ?? null,
          input.appearance ?? null,
          input.relationshipSummary ?? null,
          input.currentState ?? null,
          input.powerLevel ?? null,
          input.location ?? null,
          input.characterArc ?? null,
          input.weakness ?? null,
          input.secret ?? null,
          input.voice ?? null,
          input.speechHabits ?? null,
          input.moralCode ?? null,
          input.relationshipGoal ?? null,
          input.growthStage ?? null,
          input.firstScenePlan ?? null,
          now,
          now,
        );

      this.db
        .prepare(
          `INSERT INTO canon_facts (
            id, project_id, source_type, source_id, fact_type, content, confidence, importance, created_at, updated_at
          ) VALUES (?, ?, 'character', ?, 'character_profile', ?, 0.92, 4, ?, ?)`,
        )
        .run(
          createId("canon"),
          input.projectId,
          id,
          `${input.name}｜角色=${input.role ?? "未设定"}｜状态=${input.currentState ?? "未设定"}｜地点=${input.location ?? "未设定"}`,
          now,
          now,
        );
    });

    transaction();
    return this.getCharacter(input.projectId, id);
  }

  getCharacter(projectId: string, characterId: string): Character {
    this.projectService.ensureProjectExists(projectId);
    const row = this.db
      .prepare("SELECT * FROM characters WHERE project_id = ? AND id = ?")
      .get(projectId, characterId) as Record<string, unknown> | undefined;

    return mapCharacterRow(
      assertFound(row, `Character ${characterId} not found.`),
    );
  }

  listCharacters(projectId: string): Character[] {
    this.projectService.ensureProjectExists(projectId);
    const rows = this.db
      .prepare(
        "SELECT * FROM characters WHERE project_id = ? ORDER BY updated_at DESC",
      )
      .all(projectId) as Record<string, unknown>[];

    return rows.map(mapCharacterRow);
  }

  searchCharacters(projectId: string, query: string, limit = 8): Character[] {
    this.projectService.ensureProjectExists(projectId);

    if (!query.trim()) {
      return this.listCharacters(projectId).slice(0, limit);
    }

    const like = `%${query.trim()}%`;
    const rows = this.db
      .prepare(
        `SELECT * FROM characters
        WHERE project_id = ?
          AND (
            name LIKE ? OR aliases LIKE ? OR role LIKE ? OR personality LIKE ? OR
            motivation LIKE ? OR current_state LIKE ? OR power_level LIKE ? OR location LIKE ?
          )
        ORDER BY updated_at DESC
        LIMIT ?`,
      )
      .all(
        projectId,
        like,
        like,
        like,
        like,
        like,
        like,
        like,
        like,
        limit,
      ) as Record<string, unknown>[];

    return rows.map(mapCharacterRow);
  }

  updateCharacterState(input: UpdateCharacterStateInput): Character {
    const current = this.getCharacter(input.projectId, input.characterId);
    const updatedAt = nowIso();

    this.db
      .prepare(
        `UPDATE characters
        SET current_state = ?, power_level = ?, location = ?, status = ?, last_appearance_chapter = ?, updated_at = ?
        WHERE id = ? AND project_id = ?`,
      )
      .run(
        input.currentState ?? current.currentState,
        input.powerLevel ?? current.powerLevel,
        input.location ?? current.location,
        input.status ?? current.status,
        input.lastAppearanceChapter ?? current.lastAppearanceChapter,
        updatedAt,
        input.characterId,
        input.projectId,
      );

    return this.getCharacter(input.projectId, input.characterId);
  }

  applyCharacterBible(
    input: ApplyCharacterBiblePatch & { projectId: string },
  ): Character {
    if (input.characterId) {
      const current = this.getCharacter(input.projectId, input.characterId);
      const updatedAt = nowIso();

      this.db
        .prepare(
          `UPDATE characters
          SET name = ?, aliases = ?, role = ?, personality = ?, motivation = ?, ability = ?,
              appearance = ?, relationship_summary = ?, current_state = ?, power_level = ?,
              location = ?, character_arc = ?, weakness = ?, secret = ?, voice = ?,
              speech_habits = ?, moral_code = ?, relationship_goal = ?, growth_stage = ?,
              first_scene_plan = ?, updated_at = ?
          WHERE id = ? AND project_id = ?`,
        )
        .run(
          input.name ?? current.name,
          serializeStringArray(uniqueStrings(input.aliases ?? current.aliases)),
          input.role ?? current.role,
          input.personality ?? current.personality,
          input.motivation ?? current.motivation,
          input.ability ?? current.ability,
          input.appearance ?? current.appearance,
          input.relationshipSummary ?? current.relationshipSummary,
          input.currentState ?? current.currentState,
          input.powerLevel ?? current.powerLevel,
          input.location ?? current.location,
          input.characterArc ?? current.characterArc,
          input.weakness ?? current.weakness,
          input.secret ?? current.secret,
          input.voice ?? current.voice,
          input.speechHabits ?? current.speechHabits,
          input.moralCode ?? current.moralCode,
          input.relationshipGoal ?? current.relationshipGoal,
          input.growthStage ?? current.growthStage,
          input.firstScenePlan ?? current.firstScenePlan,
          updatedAt,
          input.characterId,
          input.projectId,
        );

      return this.getCharacter(input.projectId, input.characterId);
    }

    if (!input.name?.trim()) {
      throw new Error("name is required when creating a character bible.");
    }

    return this.addCharacter({
      ...input,
      name: input.name,
      projectId: input.projectId,
    });
  }

  applyCharacterBibles(input: {
    projectId: string;
    characters: ApplyCharacterBiblePatch[];
  }): Character[] {
    this.projectService.ensureProjectExists(input.projectId);
    const apply = this.db.transaction(() =>
      input.characters.map((character) =>
        this.applyCharacterBible({
          ...character,
          projectId: input.projectId,
        }),
      ),
    );

    return apply();
  }

  generateCharacterBiblesPrompt(projectId: string, characterIds?: string[]): string {
    const characters = characterIds?.length
      ? characterIds.map((id) => this.getCharacter(projectId, id))
      : this.listCharacters(projectId);

    return [
      "请为以下人物生成可直接写入本地 SQLite 的人物圣经 JSON。",
      "只输出 JSON，不要解释。每个人物必须包含 name，并尽量补齐 characterArc、weakness、secret、voice、speechHabits、moralCode、relationshipGoal、growthStage、firstScenePlan。",
      "人物弧光要能服务长篇连载：初始缺陷、阶段变化、关系压力、第一次登场场景都要具体，避免空泛标签。",
      JSON.stringify({ projectId, characters }, null, 2),
    ].join("\n\n");
  }

  addCharacterRelationship(
    input: AddCharacterRelationshipInput,
  ): CharacterRelationship {
    this.getCharacter(input.projectId, input.characterAId);
    this.getCharacter(input.projectId, input.characterBId);

    const id = createId("relationship");
    const now = nowIso();

    this.db
      .prepare(
        `INSERT INTO character_relationships (
          id, project_id, character_a_id, character_b_id, relationship_type, description,
          current_state, tension_level, updated_chapter_id, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.projectId,
        input.characterAId,
        input.characterBId,
        input.relationshipType,
        input.description ?? null,
        input.currentState ?? null,
        input.tensionLevel ?? null,
        input.updatedChapterId ?? null,
        now,
        now,
      );

    return this.getCharacterRelationship(input.projectId, id);
  }

  getCharacterRelationship(
    projectId: string,
    relationshipId: string,
  ): CharacterRelationship {
    this.projectService.ensureProjectExists(projectId);
    const row = this.db
      .prepare(
        "SELECT * FROM character_relationships WHERE project_id = ? AND id = ?",
      )
      .get(projectId, relationshipId) as Record<string, unknown> | undefined;

    return mapCharacterRelationshipRow(
      assertFound(row, `Relationship ${relationshipId} not found.`),
    );
  }

  updateCharacterRelationship(
    input: UpdateCharacterRelationshipInput,
  ): CharacterRelationship {
    const current = this.getCharacterRelationship(
      input.projectId,
      input.relationshipId,
    );
    const updatedAt = nowIso();

    this.db
      .prepare(
        `UPDATE character_relationships
        SET relationship_type = ?, description = ?, current_state = ?, tension_level = ?, updated_chapter_id = ?, updated_at = ?
        WHERE id = ? AND project_id = ?`,
      )
      .run(
        patchValue(input.relationshipType, current.relationshipType),
        patchValue(input.description, current.description),
        patchValue(input.currentState, current.currentState),
        patchValue(input.tensionLevel, current.tensionLevel),
        patchValue(input.updatedChapterId, current.updatedChapterId),
        updatedAt,
        input.relationshipId,
        input.projectId,
      );

    return this.getCharacterRelationship(input.projectId, input.relationshipId);
  }
}
