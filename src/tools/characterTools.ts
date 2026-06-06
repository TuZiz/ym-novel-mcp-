import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AppServices } from "../types/app.js";
import { wrapToolHandler } from "./toolUtils.js";

export function registerCharacterTools(server: McpServer, services: AppServices): void {
  const log = (toolName: string) => ({ services, toolName });

  server.registerTool(
    "add_character",
    {
      description: "新增人物。",
      inputSchema: {
        projectId: z.string().min(1),
        name: z.string().min(1),
        aliases: z.array(z.string()).optional(),
        role: z.string().optional(),
        personality: z.string().optional(),
        motivation: z.string().optional(),
        ability: z.string().optional(),
        appearance: z.string().optional(),
        relationshipSummary: z.string().optional(),
        currentState: z.string().optional(),
        powerLevel: z.string().optional(),
        location: z.string().optional(),
        characterArc: z.string().optional(),
        weakness: z.string().optional(),
        secret: z.string().optional(),
        voice: z.string().optional(),
        speechHabits: z.string().optional(),
        moralCode: z.string().optional(),
        relationshipGoal: z.string().optional(),
        growthStage: z.string().optional(),
        firstScenePlan: z.string().optional()
      }
    },
    wrapToolHandler((args) => services.characterService.addCharacter(args), log("add_character"))
  );

  const characterBiblePatchSchema = z.object({
    characterId: z.string().optional(),
    name: z.string().optional(),
    aliases: z.array(z.string()).optional(),
    role: z.string().optional(),
    personality: z.string().optional(),
    motivation: z.string().optional(),
    ability: z.string().optional(),
    appearance: z.string().optional(),
    relationshipSummary: z.string().optional(),
    currentState: z.string().optional(),
    powerLevel: z.string().optional(),
    location: z.string().optional(),
    characterArc: z.string().optional(),
    weakness: z.string().optional(),
    secret: z.string().optional(),
    voice: z.string().optional(),
    speechHabits: z.string().optional(),
    moralCode: z.string().optional(),
    relationshipGoal: z.string().optional(),
    growthStage: z.string().optional(),
    firstScenePlan: z.string().optional()
  });

  server.registerTool(
    "generate_character_bibles_prompt",
    {
      description: "生成人物圣经提示词。",
      inputSchema: {
        projectId: z.string().min(1),
        characterIds: z.array(z.string()).optional()
      }
    },
    wrapToolHandler(
      ({ projectId, characterIds }) =>
        services.characterService.generateCharacterBiblesPrompt(projectId, characterIds),
      log("generate_character_bibles_prompt"),
    )
  );

  server.registerTool(
    "apply_character_bibles",
    {
      description: "批量写入或更新人物圣经。",
      inputSchema: {
        projectId: z.string().min(1),
        characters: z.array(characterBiblePatchSchema).min(1)
      }
    },
    wrapToolHandler(
      (args) => services.characterService.applyCharacterBibles(args),
      log("apply_character_bibles"),
    )
  );

  server.registerTool(
    "upsert_name_bank",
    {
      description: "写入或更新项目姓名库。",
      inputSchema: {
        projectId: z.string().optional(),
        era: z.string().optional(),
        region: z.string().optional(),
        surnamePool: z.array(z.string()).optional(),
        givenNamePool: z.array(z.string()).optional(),
        bannedTokens: z.array(z.string()).optional(),
        bannedFullNames: z.array(z.string()).optional(),
        style: z.string().optional()
      }
    },
    wrapToolHandler((args) => services.nameService.upsertNameBank(args), log("upsert_name_bank"))
  );

  server.registerTool(
    "generate_character_name",
    {
      description: "生成低 AI 味、题材匹配的人物姓名。",
      inputSchema: {
        projectId: z.string().optional(),
        genre: z.string().optional(),
        era: z.string().optional(),
        region: z.string().optional(),
        style: z.string().optional(),
        gender: z.string().optional(),
        count: z.number().int().positive().max(20).optional()
      }
    },
    wrapToolHandler(
      (args) => services.nameService.generateCharacterName(args),
      log("generate_character_name"),
    )
  );

  server.registerTool(
    "review_character_name",
    {
      description: "审查姓名 AI 味并返回 aiScore、reason、suggestions。",
      inputSchema: {
        projectId: z.string().optional(),
        name: z.string().min(1),
        genre: z.string().optional(),
        style: z.string().optional()
      }
    },
    wrapToolHandler(
      (args) => services.nameService.reviewCharacterName(args),
      log("review_character_name"),
    )
  );

  server.registerTool(
    "replace_character_name",
    {
      description: "替换角色姓名，并把旧名写入 aliases。",
      inputSchema: {
        projectId: z.string().min(1),
        characterId: z.string().min(1),
        name: z.string().min(1),
        newName: z.string().optional(),
        genre: z.string().optional(),
        style: z.string().optional()
      }
    },
    wrapToolHandler(
      (args) => services.nameService.replaceCharacterName(args),
      log("replace_character_name"),
    )
  );

  server.registerTool(
    "get_character",
    {
      description: "获取人物详情。",
      inputSchema: {
        projectId: z.string().min(1),
        characterId: z.string().min(1)
      }
    },
    wrapToolHandler(({ projectId, characterId }) =>
      services.characterService.getCharacter(projectId, characterId)
    )
  );

  server.registerTool(
    "search_characters",
    {
      description: "搜索人物。",
      inputSchema: {
        projectId: z.string().min(1),
        query: z.string(),
        limit: z.number().int().positive().max(50).optional()
      }
    },
    wrapToolHandler(({ projectId, query, limit }) =>
      services.characterService.searchCharacters(projectId, query, limit)
    )
  );

  server.registerTool(
    "update_character_state",
    {
      description: "更新人物状态。",
      inputSchema: {
        projectId: z.string().min(1),
        characterId: z.string().min(1),
        currentState: z.string().optional(),
        powerLevel: z.string().optional(),
        location: z.string().optional(),
        status: z.string().optional(),
        lastAppearanceChapter: z.number().int().positive().optional()
      }
    },
    wrapToolHandler(
      (args) => services.characterService.updateCharacterState(args),
      log("update_character_state"),
    )
  );

  server.registerTool(
    "add_character_relationship",
    {
      description: "添加人物关系。",
      inputSchema: {
        projectId: z.string().min(1),
        characterAId: z.string().min(1),
        characterBId: z.string().min(1),
        relationshipType: z.string().min(1),
        description: z.string().optional(),
        currentState: z.string().optional(),
        tensionLevel: z.number().int().min(0).max(10).optional(),
        updatedChapterId: z.string().optional()
      }
    },
    wrapToolHandler(
      (args) => services.characterService.addCharacterRelationship(args),
      log("add_character_relationship"),
    )
  );

  server.registerTool(
    "update_character_relationship",
    {
      description: "更新人物关系。",
      inputSchema: {
        projectId: z.string().min(1),
        relationshipId: z.string().min(1),
        relationshipType: z.string().optional(),
        description: z.string().nullable().optional(),
        currentState: z.string().nullable().optional(),
        tensionLevel: z.number().int().min(0).max(10).nullable().optional(),
        updatedChapterId: z.string().nullable().optional()
      }
    },
    wrapToolHandler(
      (args) => services.characterService.updateCharacterRelationship(args),
      log("update_character_relationship"),
    )
  );
}
