import { mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type {
  ExportWorkspaceFilesInput,
  ExportWorkspaceFilesResult,
} from "../types/novel.js";
import { ProjectBibleService } from "./projectBibleService.js";
import { ProjectTransferService } from "./projectTransferService.js";

export class WorkspaceExportService {
  constructor(
    private readonly projectTransferService: ProjectTransferService,
    private readonly projectBibleService: ProjectBibleService,
  ) {}

  exportWorkspaceFiles(
    input: ExportWorkspaceFilesInput,
  ): ExportWorkspaceFilesResult {
    const data = this.projectTransferService.exportProject(input.projectId);
    const bible = this.projectBibleService.getProjectBible(input.projectId);
    const rootDir = resolve(
      input.outputDir ?? join(process.cwd(), "exports", data.project.id),
    );
    const files: string[] = [];

    for (const dir of [
      "bible",
      "characters",
      "world",
      "outlines",
      "chapters",
      "reports",
    ]) {
      mkdirSync(join(rootDir, dir), { recursive: true });
    }

    write(files, rootDir, "bible/project-bible.md", markdownRecord("项目圣经", bible ?? data.project));
    write(files, rootDir, "bible/style-guide.md", buildStyleGuide(data));

    for (const character of data.characters) {
      write(
        files,
        rootDir,
        `characters/${safeFileName(character.name)}.md`,
        markdownRecord(character.name, character),
      );
    }

    for (const item of data.worldItems) {
      write(
        files,
        rootDir,
        `world/${safeFileName(`${item.type}-${item.name}`)}.md`,
        markdownRecord(item.name, item),
      );
    }

    for (const outline of data.chapterOutlines) {
      write(
        files,
        rootDir,
        `outlines/${pad(outline.chapterIndex)}-${safeFileName(outline.title)}.md`,
        markdownRecord(outline.title, outline),
      );
    }

    for (const chapter of data.chapters) {
      write(
        files,
        rootDir,
        `chapters/${pad(chapter.chapterIndex)}-${safeFileName(chapter.title)}.md`,
        [`# ${chapter.title}`, "", `- 字数: ${chapter.wordCount}`, `- 钩子: ${chapter.hook ?? ""}`, "", chapter.content].join("\n"),
      );
    }

    write(
      files,
      rootDir,
      "reports/project-export.json",
      `${JSON.stringify({ ...data, projectBible: bible }, null, 2)}\n`,
    );
    write(files, rootDir, "reports/continuity-index.md", buildReport(data));

    return { rootDir, files };
  }
}

function write(files: string[], rootDir: string, relativePath: string, content: string): void {
  const absolutePath = join(rootDir, relativePath);
  writeFileSync(absolutePath, content, "utf8");
  files.push(absolutePath);
}

function markdownRecord(title: string, value: unknown): string {
  return [`# ${title}`, "", "```json", JSON.stringify(value, null, 2), "```", ""].join("\n");
}

function buildStyleGuide(data: ReturnType<ProjectTransferService["exportProject"]>): string {
  return [
    `# ${data.project.name} 风格指南`,
    "",
    `- 题材: ${data.project.genre ?? ""}`,
    `- 平台: ${data.project.platform ?? ""}`,
    `- 风格: ${data.project.style ?? ""}`,
    `- 单章目标: ${data.project.chapterWordTarget ?? ""}`,
    `- 单章最低: ${data.project.minChapterWords ?? ""}`,
    `- 单章最高: ${data.project.maxChapterWords ?? ""}`,
    "",
    "## 写作规则",
    ...data.writingRules.map((rule) => `- ${rule.content}`),
    "",
  ].join("\n");
}

function buildReport(data: ReturnType<ProjectTransferService["exportProject"]>): string {
  return [
    `# ${data.project.name} 工程报告`,
    "",
    `- 人物: ${data.characters.length}`,
    `- 世界观条目: ${data.worldItems.length}`,
    `- 大纲: ${data.chapterOutlines.length}`,
    `- 章节: ${data.chapters.length}`,
    `- 伏笔: ${data.foreshadowings.length}`,
    `- 时间线事件: ${data.timelineEvents.length}`,
    "",
    "## 开放伏笔",
    ...data.foreshadowings
      .filter((item) => item.status === "open")
      .map((item) => `- ${item.title}: ${item.description}`),
    "",
  ].join("\n");
}

function safeFileName(value: string): string {
  const sanitized = value.replace(/[<>:"/\\|?*\u0000-\u001F]/gu, "_").trim();
  return sanitized || "untitled";
}

function pad(value: number): string {
  return String(value).padStart(4, "0");
}
