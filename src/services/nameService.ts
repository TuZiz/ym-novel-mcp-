import type Database from "better-sqlite3";
import type {
  CharacterNameReview,
  GenerateCharacterNameInput,
  GenerateCharacterNameResult,
  NameBank,
  NameBankInput,
  ReplaceCharacterNameInput,
  ReviewCharacterNameInput,
} from "../types/novel.js";
import { assertFound } from "../utils/errors.js";
import { createId } from "../utils/ids.js";
import { mapNameBankRow } from "../utils/rows.js";
import { nowIso, serializeStringArray, uniqueStrings } from "../utils/text.js";
import { CharacterService } from "./characterService.js";
import { ProjectService } from "./projectService.js";

const defaultSurnames = [
  "陈",
  "李",
  "王",
  "张",
  "刘",
  "周",
  "赵",
  "黄",
  "吴",
  "徐",
  "孙",
  "胡",
  "朱",
  "高",
  "林",
  "何",
];

const realisticGivenNames = [
  "明",
  "磊",
  "涛",
  "静",
  "敏",
  "倩",
  "伟",
  "洁",
  "然",
  "宁",
  "悦",
  "航",
  "琳",
  "嘉",
  "欣",
  "远",
  "晴",
  "安",
];

const fantasyGivenNames = [
  "衡",
  "洲",
  "砚",
  "澜",
  "照",
  "微",
  "青",
  "行",
  "砚之",
  "照雪",
  "知白",
  "闻舟",
];

export const defaultBannedFullNames = [
  "叶辰",
  "林枫",
  "苏尘",
  "萧凡",
  "凌天",
  "楚天",
  "顾寒",
  "秦渊",
];

export const defaultBannedTokens = [
  "辰",
  "尘",
  "天",
  "凡",
  "夜",
  "渊",
  "霆",
  "宸",
  "玄",
  "帝",
];

export class NameService {
  constructor(
    private readonly db: Database.Database,
    private readonly projectService: ProjectService,
    private readonly characterService: CharacterService,
  ) {}

  upsertNameBank(input: NameBankInput): NameBank {
    if (input.projectId) {
      this.projectService.ensureProjectExists(input.projectId);
    }

    const now = nowIso();
    const existing = this.findNameBank(input);

    if (existing) {
      const surnamePool =
        input.surnamePool === undefined
          ? existing.surnamePool
          : uniqueStrings(input.surnamePool);
      const givenNamePool =
        input.givenNamePool === undefined
          ? existing.givenNamePool
          : uniqueStrings(input.givenNamePool);
      const bannedTokens =
        input.bannedTokens === undefined
          ? existing.bannedTokens
          : uniqueStrings(input.bannedTokens);
      const bannedFullNames =
        input.bannedFullNames === undefined
          ? existing.bannedFullNames
          : uniqueStrings(input.bannedFullNames);
      this.db
        .prepare(
          `UPDATE name_bank
          SET surname_pool = ?, given_name_pool = ?, banned_tokens = ?,
              banned_full_names = ?, style = ?, updated_at = ?
          WHERE id = ?`,
        )
        .run(
          serializeStringArray(surnamePool),
          serializeStringArray(givenNamePool),
          serializeStringArray(bannedTokens),
          serializeStringArray(bannedFullNames),
          input.style ?? existing.style,
          now,
          existing.id,
        );
      return this.getNameBank(existing.id);
    }

    const surnamePool = uniqueStrings(input.surnamePool ?? []);
    const givenNamePool = uniqueStrings(input.givenNamePool ?? []);
    const bannedTokens = uniqueStrings([
      ...defaultBannedTokens,
      ...(input.bannedTokens ?? []),
    ]);
    const bannedFullNames = uniqueStrings([
      ...defaultBannedFullNames,
      ...(input.bannedFullNames ?? []),
    ]);

    const id = createId("namebank");
    this.db
      .prepare(
        `INSERT INTO name_bank (
          id, project_id, era, region, surname_pool, given_name_pool, banned_tokens,
          banned_full_names, style, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.projectId ?? null,
        input.era ?? null,
        input.region ?? null,
        serializeStringArray(surnamePool),
        serializeStringArray(givenNamePool),
        serializeStringArray(bannedTokens),
        serializeStringArray(bannedFullNames),
        input.style ?? null,
        now,
        now,
      );

    return this.getNameBank(id);
  }

  generateCharacterName(
    input: GenerateCharacterNameInput,
  ): GenerateCharacterNameResult {
    if (input.projectId) {
      this.projectService.ensureProjectExists(input.projectId);
    }

    const count = Math.min(Math.max(input.count ?? 5, 1), 20);
    const bank = this.pickNameBank(input);
    const surnamePool = bank?.surnamePool.length
      ? bank.surnamePool
      : defaultSurnames;
    const givenNamePool = bank?.givenNamePool.length
      ? bank.givenNamePool
      : isFantasy(input.genre ?? input.style)
        ? fantasyGivenNames
        : realisticGivenNames;

    const names: string[] = [];
    const rejected: Array<{ name: string; reason: string }> = [];

    for (const surname of surnamePool) {
      for (const given of givenNamePool) {
        const name = `${surname}${given}`;
        const review = this.reviewCharacterName({
          projectId: input.projectId,
          name,
          genre: input.genre,
          style: input.style,
          suppressSuggestions: true,
        });
        if (review.ok) {
          names.push(name);
        } else {
          rejected.push({ name, reason: review.reason });
        }
        if (names.length >= count) {
          return { names, rejected };
        }
      }
    }

    return { names, rejected };
  }

  reviewCharacterName(input: ReviewCharacterNameInput): CharacterNameReview {
    if (input.projectId) {
      this.projectService.ensureProjectExists(input.projectId);
    }

    const bank = this.pickNameBank(input);
    const bannedTokens = uniqueStrings([
      ...defaultBannedTokens,
      ...(bank?.bannedTokens ?? []),
    ]);
    const bannedFullNames = uniqueStrings([
      ...defaultBannedFullNames,
      ...(bank?.bannedFullNames ?? []),
    ]);
    const bannedHits = [
      ...bannedFullNames.filter((item) => item === input.name),
      ...bannedTokens.filter((item) => input.name.includes(item)),
    ];
    const tropeScore = bannedHits.length * 35;
    const lengthScore = input.name.length < 2 || input.name.length > 4 ? 18 : 0;
    const fantasyPenalty =
      !isFantasy(input.genre ?? input.style) &&
      /[澜砚烬阙朔鸢]/u.test(input.name)
        ? 18
        : 0;
    const aiScore = Math.min(100, tropeScore + lengthScore + fantasyPenalty);
    const ok = aiScore < 35;
    const suggestions =
      ok || input.suppressSuggestions
        ? []
        : this.generateCharacterName({
            projectId: input.projectId,
            genre: input.genre,
            style: input.style,
            count: 3,
          }).names;

    return {
      ok,
      aiScore,
      reason: ok
        ? "姓名可用，未命中高频网文感禁用项。"
        : `姓名 AI 味偏高，命中：${bannedHits.join("、") || "长度或风格异常"}`,
      suggestions,
      bannedHits,
    };
  }

  replaceCharacterName(input: ReplaceCharacterNameInput) {
    const character = this.characterService.getCharacter(
      input.projectId,
      input.characterId,
    );
    const requestedName = input.newName?.trim();
    const generated =
      requestedName ||
      this.generateCharacterName({
        projectId: input.projectId,
        genre: input.genre,
        style: input.style,
        count: 1,
      }).names[0];

    if (!generated) {
      throw new Error("No usable replacement name generated.");
    }

    const review = this.reviewCharacterName({
      projectId: input.projectId,
      name: generated,
      genre: input.genre,
      style: input.style,
    });
    if (!review.ok) {
      throw new Error(`Replacement name rejected: ${review.reason}`);
    }

    const updated = this.characterService.applyCharacterBible({
      projectId: input.projectId,
      characterId: input.characterId,
      name: generated,
      aliases: uniqueStrings([character.name, ...character.aliases]),
    });

    return { character: updated, review };
  }

  listNameBanks(projectId?: string): NameBank[] {
    const rows = (
      projectId
        ? this.db
            .prepare(
              "SELECT * FROM name_bank WHERE project_id = ? ORDER BY updated_at DESC",
            )
            .all(projectId)
        : this.db
            .prepare("SELECT * FROM name_bank ORDER BY updated_at DESC")
            .all()
    ) as Record<string, unknown>[];

    return rows.map(mapNameBankRow);
  }

  private getNameBank(id: string): NameBank {
    const row = this.db
      .prepare("SELECT * FROM name_bank WHERE id = ?")
      .get(id) as Record<string, unknown> | undefined;
    return mapNameBankRow(assertFound(row, `Name bank ${id} not found.`));
  }

  private findNameBank(input: NameBankInput): NameBank | null {
    const exactRow = this.db
      .prepare(
        `SELECT * FROM name_bank
        WHERE COALESCE(project_id, '') = COALESCE(?, '')
          AND COALESCE(era, '') = COALESCE(?, '')
          AND COALESCE(region, '') = COALESCE(?, '')
          AND COALESCE(style, '') = COALESCE(?, '')
        LIMIT 1`,
      )
      .get(
        input.projectId ?? null,
        input.era ?? null,
        input.region ?? null,
        input.style ?? null,
      ) as Record<string, unknown> | undefined;

    if (exactRow) {
      return mapNameBankRow(exactRow);
    }

    const isStyleOnlyUpdate =
      input.style !== undefined &&
      input.surnamePool === undefined &&
      input.givenNamePool === undefined &&
      input.bannedTokens === undefined &&
      input.bannedFullNames === undefined;
    if (!isStyleOnlyUpdate) {
      return null;
    }

    const styleUpdateRow = this.db
      .prepare(
        `SELECT * FROM name_bank
        WHERE COALESCE(project_id, '') = COALESCE(?, '')
          AND COALESCE(era, '') = COALESCE(?, '')
          AND COALESCE(region, '') = COALESCE(?, '')
        ORDER BY updated_at DESC
        LIMIT 1`,
      )
      .get(
        input.projectId ?? null,
        input.era ?? null,
        input.region ?? null,
      ) as Record<string, unknown> | undefined;

    return styleUpdateRow ? mapNameBankRow(styleUpdateRow) : null;
  }

  private pickNameBank(input: {
    projectId?: string;
    era?: string;
    region?: string;
    style?: string;
  }): NameBank | null {
    const rows = this.listNameBanks(input.projectId);
    return (
      rows.find(
        (bank) =>
          (!input.era || bank.era === input.era) &&
          (!input.region || bank.region === input.region) &&
          (!input.style || bank.style === input.style),
      ) ??
      rows[0] ??
      null
    );
  }
}

function isFantasy(value?: string): boolean {
  return Boolean(value && /玄幻|仙侠|奇幻|fantasy/i.test(value));
}
