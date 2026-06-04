import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import * as z from "zod/v4";
import type { AppServices } from "../types/app.js";
import { AppError } from "../utils/errors.js";

export function registerNovelPrompts(server: McpServer, services: AppServices): void {
  server.registerPrompt(
    "write-next-chapter",
    {
      description: "生成下一章写作提示词。",
      argsSchema: {
        projectId: z.string().min(1),
        chapterIndex: z.number().int().positive()
      }
    },
    async ({ projectId, chapterIndex }) => {
      const context = services.writingContextService.buildNextChapterContext({
        projectId,
        chapterIndex
      });

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                `${context.instruction}\n\n` +
                `请结合以下结构化上下文创作本章：\n${JSON.stringify(context, null, 2)}`
            }
          }
        ]
      };
    }
  );

  server.registerPrompt(
    "summarize-chapter",
    {
      description: "生成章节摘要提示词。",
      argsSchema: {
        projectId: z.string().min(1),
        chapterIndex: z.number().int().positive()
      }
    },
    async ({ projectId, chapterIndex }) => {
      const chapter = services.chapterService.getChapterByIndex(projectId, chapterIndex);
      if (!chapter) {
        throw new AppError(`Chapter ${chapterIndex} not found.`, "NOT_FOUND");
      }

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                "请为下面这一章生成 120-200 字中文摘要，要求保留关键冲突、推进结果和结尾钩子，不要写成点评。\n\n" +
                JSON.stringify(chapter, null, 2)
            }
          }
        ]
      };
    }
  );

  server.registerPrompt(
    "extract-canon",
    {
      description: "生成章节设定抽取提示词。",
      argsSchema: {
        projectId: z.string().min(1),
        chapterIndex: z.number().int().positive()
      }
    },
    async ({ projectId, chapterIndex }) => {
      const chapter = services.chapterService.getChapterByIndex(projectId, chapterIndex);
      if (!chapter) {
        throw new AppError(`Chapter ${chapterIndex} not found.`, "NOT_FOUND");
      }

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                "请从下面章节中抽取不可违背的设定事实，按人物状态、世界观事实、伏笔、时间线事件四类输出 JSON。\n\n" +
                JSON.stringify(chapter, null, 2)
            }
          }
        ]
      };
    }
  );

  server.registerPrompt(
    "continuity-review",
    {
      description: "生成连续性检查提示词。",
      argsSchema: {
        projectId: z.string().min(1),
        draftContent: z.string().min(1)
      }
    },
    async ({ projectId, draftContent }) => {
      const review = services.continuityService.checkContinuity({
        projectId,
        draftContent
      });
      const project = services.projectService.getProject(projectId);

      return {
        messages: [
          {
            role: "user",
            content: {
              type: "text",
              text:
                `请对《${project.name}》的新草稿做连续性审校。先参考系统预检结果，再补充你发现的潜在冲突。\n\n` +
                `预检结果：\n${JSON.stringify(review, null, 2)}\n\n草稿：\n${draftContent}`
            }
          }
        ]
      };
    }
  );
}
