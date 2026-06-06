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
        location: z.string().optional()
      }
    },
    wrapToolHandler((args) => services.characterService.addCharacter(args), log("add_character"))
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
