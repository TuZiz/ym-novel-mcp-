import { existsSync, statSync } from "node:fs";
import type { IncomingMessage, ServerResponse } from "node:http";
import type Database from "better-sqlite3";
import type { AppConfig } from "./config/index.js";
import type { AppInstance } from "./server.js";

const startedAt = new Date().toISOString();

const monitoredTables = [
  "projects",
  "chapters",
  "characters",
  "world_items",
  "foreshadowings",
  "timeline_events",
  "canon_facts",
  "project_snapshots",
  "experience_records",
  "workflow_runs",
  "mcp_call_logs",
] as const;

export async function handleAdminRequest(
  req: IncomingMessage,
  res: ServerResponse,
  config: AppConfig,
  app: AppInstance,
): Promise<boolean> {
  const url = new URL(req.url ?? "/", `http://${req.headers.host ?? "local"}`);
  const pathname = trimTrailingSlash(url.pathname);

  if (pathname === "/admin") {
    if (req.method !== "GET") {
      writeJson(res, 405, { error: "Method not allowed" });
      return true;
    }
    writeHtml(res, renderAdminPage());
    return true;
  }

  if (!pathname.startsWith("/admin/api")) {
    return false;
  }

  if (!isAuthorized(req, config.httpToken)) {
    writeJson(res, 401, { error: "Unauthorized" });
    return true;
  }

  if (pathname === "/admin/api/status") {
    if (req.method !== "GET") {
      writeJson(res, 405, { error: "Method not allowed" });
      return true;
    }
    writeJson(res, 200, buildStatus(config, app));
    return true;
  }

  if (pathname === "/admin/api/writing-monitor") {
    if (req.method !== "GET") {
      writeJson(res, 405, { error: "Method not allowed" });
      return true;
    }
    const projectId = url.searchParams.get("projectId") ?? undefined;
    writeJson(res, 200, buildWritingMonitor(app, projectId));
    return true;
  }

  if (pathname === "/admin/api/projects") {
    if (req.method !== "GET") {
      writeJson(res, 405, { error: "Web admin is read-only." });
      return true;
    }
    writeJson(res, 200, {
      projects: app.services.projectService.listProjects(),
    });
    return true;
  }

  if (pathname === "/admin/api/search") {
    if (req.method !== "GET") {
      writeJson(res, 405, { error: "Method not allowed" });
      return true;
    }
    const projectId = getRequiredQuery(url, "projectId");
    const query = url.searchParams.get("q") ?? "";
    const limit = parseLimit(url.searchParams.get("limit"), 20);
    writeJson(
      res,
      200,
      app.services.searchService.searchAll({ projectId, query, limit }),
    );
    return true;
  }

  if (pathname === "/admin/api/snapshots") {
    if (req.method !== "GET") {
      writeJson(res, 405, { error: "Web admin is read-only." });
      return true;
    }
    const projectId = getRequiredQuery(url, "projectId");
    const limit = parseLimit(url.searchParams.get("limit"), 20);
    writeJson(res, 200, {
      snapshots: app.services.projectSnapshotService.listSnapshots({
        projectId,
        limit,
      }),
    });
    return true;
  }

  writeJson(res, 404, { error: "Not found" });
  return true;
}

function buildWritingMonitor(
  app: AppInstance,
  projectId?: string,
): Record<string, unknown> {
  const projects = app.services.projectService.listProjects();
  return {
    projectId: projectId ?? null,
    toolCalls: app.services.mcpCallLogService.listRecent(projectId, 50),
    recentWrites: getRecentWrites(app.database.db, projectId),
    pipelines: projects.map((project) =>
      buildProjectPipeline(app.database.db, project.id, project.name),
    ),
  };
}

function buildStatus(config: AppConfig, app: AppInstance): Record<string, unknown> {
  const projects = app.services.projectService.listProjects();
  const dbStats = getDatabaseStats(config.dbPath);
  const tableCounts = getTableCounts(app.database.db);
  const latestDataUpdatedAt = getLatestDataUpdatedAt(app.database.db);
  const memory = process.memoryUsage();

  return {
    ok: true,
    mode: "monitor",
    transport: "streamable-http",
    dbPath: config.dbPath,
    dbSizeBytes: dbStats.totalBytes,
    dbSize: formatBytes(dbStats.totalBytes),
    dbFiles: dbStats.files,
    dbModifiedAt: dbStats.modifiedAt,
    latestDataUpdatedAt,
    host: config.httpHost,
    port: config.httpPort,
    auth: config.httpToken ? "token" : "none",
    projectCount: projects.length,
    totalWords: projects.reduce((sum, project) => sum + project.currentWords, 0),
    tableCounts,
    warnings: buildMonitorWarnings(config, dbStats, tableCounts, latestDataUpdatedAt),
    recentActivity: getRecentActivity(app.database.db),
    process: {
      pid: process.pid,
      node: process.version,
      platform: process.platform,
      startedAt,
      uptimeSeconds: Math.round(process.uptime()),
      uptime: formatDuration(process.uptime()),
      memoryRss: formatBytes(memory.rss),
      memoryHeapUsed: formatBytes(memory.heapUsed),
    },
  };
}

function getDatabaseStats(dbPath: string): {
  totalBytes: number | null;
  files: Array<{ path: string; sizeBytes: number; size: string }>;
  modifiedAt: string | null;
} {
  if (dbPath === ":memory:" || !existsSync(dbPath)) {
    return { totalBytes: null, files: [], modifiedAt: null };
  }

  const paths = [dbPath, `${dbPath}-wal`, `${dbPath}-shm`];
  const files = paths
    .filter((path) => existsSync(path))
    .map((path) => {
      const stat = statSync(path);
      return {
        path,
        sizeBytes: stat.size,
        size: formatBytes(stat.size) ?? "0 B",
      };
    });
  const stat = statSync(dbPath);
  return {
    totalBytes: files.reduce((sum, file) => sum + file.sizeBytes, 0),
    files,
    modifiedAt: stat.mtime.toISOString(),
  };
}

function getTableCounts(db: Database.Database): Record<string, number> {
  return Object.fromEntries(
    monitoredTables.map((table) => {
      const row = db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get() as {
        count: number;
      };
      return [table, row.count];
    }),
  );
}

function getLatestDataUpdatedAt(db: Database.Database): string | null {
  const parts = monitoredTables
    .filter((table) => !["workflow_runs", "mcp_call_logs"].includes(table))
    .map((table) => `SELECT MAX(updated_at) AS value FROM ${table}`);
  const row = db
    .prepare(`SELECT MAX(value) AS value FROM (${parts.join(" UNION ALL ")})`)
    .get() as { value: string | null };

  return row.value;
}

function getRecentActivity(
  db: Database.Database,
): Array<{ type: string; title: string; at: string }> {
  const rows = db
    .prepare(
      `SELECT item_type AS type, title, at FROM (
        SELECT 'project' AS item_type, name AS title, updated_at AS at FROM projects
        UNION ALL
        SELECT 'chapter' AS item_type, title AS title, updated_at AS at FROM chapters
        UNION ALL
        SELECT 'snapshot' AS item_type, COALESCE(label, id) AS title, created_at AS at FROM project_snapshots
        UNION ALL
        SELECT 'workflow' AS item_type, workflow_type AS title, created_at AS at FROM workflow_runs
      )
      WHERE at IS NOT NULL
      ORDER BY at DESC
      LIMIT 12`,
    )
    .all() as Array<{ type: string; title: string; at: string }>;

  return rows;
}

function getRecentWrites(
  db: Database.Database,
  projectId?: string,
): Array<{
  type: string;
  id: string;
  projectId: string;
  title: string;
  content: string;
  at: string;
  meta: Record<string, unknown>;
}> {
  const rows = db
    .prepare(
      `SELECT * FROM (
        SELECT 'chapter' AS item_type, id, project_id, title,
          COALESCE(summary, substr(content, 1, 360)) AS content,
          updated_at AS at,
          chapter_index AS chapter_index,
          word_count AS word_count,
          NULL AS item_subtype,
          NULL AS importance
        FROM chapters
        UNION ALL
        SELECT 'character' AS item_type, id, project_id, name AS title,
          COALESCE(current_state, relationship_summary, role, '') AS content,
          updated_at AS at,
          NULL AS chapter_index,
          NULL AS word_count,
          status AS item_subtype,
          NULL AS importance
        FROM characters
        UNION ALL
        SELECT 'world_item' AS item_type, id, project_id, name AS title,
          substr(content, 1, 360) AS content,
          updated_at AS at,
          NULL AS chapter_index,
          NULL AS word_count,
          type AS item_subtype,
          importance AS importance
        FROM world_items
        UNION ALL
        SELECT 'foreshadowing' AS item_type, id, project_id, title,
          substr(description, 1, 360) AS content,
          updated_at AS at,
          expected_resolve_chapter AS chapter_index,
          NULL AS word_count,
          status AS item_subtype,
          importance AS importance
        FROM foreshadowings
        UNION ALL
        SELECT 'timeline' AS item_type, id, project_id, title,
          substr(description, 1, 360) AS content,
          updated_at AS at,
          event_order AS chapter_index,
          NULL AS word_count,
          location AS item_subtype,
          NULL AS importance
        FROM timeline_events
        UNION ALL
        SELECT 'canon_fact' AS item_type, id, project_id, fact_type AS title,
          substr(content, 1, 360) AS content,
          updated_at AS at,
          NULL AS chapter_index,
          NULL AS word_count,
          source_type AS item_subtype,
          importance AS importance
        FROM canon_facts
      )
      WHERE (? IS NULL OR project_id = ?)
      ORDER BY at DESC
      LIMIT 40`,
    )
    .all(projectId ?? null, projectId ?? null) as Record<string, unknown>[];

  return rows.map((row) => ({
    type: String(row.item_type),
    id: String(row.id),
    projectId: String(row.project_id),
    title: String(row.title),
    content: String(row.content ?? ""),
    at: String(row.at),
    meta: {
      chapterIndex: row.chapter_index === null ? null : Number(row.chapter_index),
      wordCount: row.word_count === null ? null : Number(row.word_count),
      subtype: (row.item_subtype as string | null) ?? null,
      importance: row.importance === null ? null : Number(row.importance),
    },
  }));
}

function buildProjectPipeline(
  db: Database.Database,
  projectId: string,
  projectName: string,
): Record<string, unknown> {
  const latestChapter = db
    .prepare(
      `SELECT id, chapter_index, title, word_count, updated_at
      FROM chapters
      WHERE project_id = ?
      ORDER BY chapter_index DESC
      LIMIT 1`,
    )
    .get(projectId) as
    | {
        id: string;
        chapter_index: number;
        title: string;
        word_count: number;
        updated_at: string;
      }
    | undefined;
  const openForeshadowing = db
    .prepare(
      "SELECT COUNT(*) AS count FROM foreshadowings WHERE project_id = ? AND status = 'open'",
    )
    .get(projectId) as { count: number };
  const steps = [
    "build_next_chapter_context",
    "check_continuity",
    "save_chapter",
    "build_post_chapter_update_prompt",
    "apply_post_chapter_update",
    "create_project_snapshot",
  ].map((toolName) => {
    const row = db
      .prepare(
        `SELECT tool_name, status, created_at, duration_ms
        FROM mcp_call_logs
        WHERE project_id = ? AND tool_name = ?
        ORDER BY created_at DESC
        LIMIT 1`,
      )
      .get(projectId, toolName) as
      | {
          tool_name: string;
          status: string;
          created_at: string;
          duration_ms: number;
        }
      | undefined;
    return {
      toolName,
      status: row?.status ?? "missing",
      at: row?.created_at ?? null,
      durationMs: row?.duration_ms ?? null,
    };
  });

  return {
    projectId,
    projectName,
    latestChapter: latestChapter
      ? {
          id: latestChapter.id,
          chapterIndex: latestChapter.chapter_index,
          title: latestChapter.title,
          wordCount: latestChapter.word_count,
          updatedAt: latestChapter.updated_at,
        }
      : null,
    openForeshadowingCount: openForeshadowing.count,
    steps,
  };
}

function buildMonitorWarnings(
  config: AppConfig,
  dbStats: ReturnType<typeof getDatabaseStats>,
  tableCounts: Record<string, number>,
  latestDataUpdatedAt: string | null,
): Array<{ severity: "low" | "medium" | "high"; message: string }> {
  const warnings: Array<{ severity: "low" | "medium" | "high"; message: string }> = [];

  if (config.dbPath === ":memory:") {
    warnings.push({
      severity: "high",
      message: "当前使用内存数据库，进程停止后数据会丢失。",
    });
  }

  if (/[\\/]temp[\\/]|[\\/]tmp[\\/]|AppData[\\/]Local[\\/]Temp/u.test(config.dbPath)) {
    warnings.push({
      severity: "high",
      message: "数据库位于临时目录，不适合云端长期运行。",
    });
  }

  if (config.httpHost !== "127.0.0.1" && !config.httpToken) {
    warnings.push({
      severity: "high",
      message: "HTTP 对外监听但没有 token，公网部署风险很高。",
    });
  }

  if (tableCounts.projects === 0) {
    warnings.push({
      severity: "low",
      message: "当前还没有项目数据，监控面板只能显示服务和数据库状态。",
    });
  }

  if ((tableCounts.projects ?? 0) > 0 && (tableCounts.project_snapshots ?? 0) === 0) {
    warnings.push({
      severity: "medium",
      message: "已有项目但没有快照，建议用 MCP tool create_project_snapshot 定期备份。",
    });
  }

  if (!latestDataUpdatedAt) {
    warnings.push({
      severity: "low",
      message: "尚未检测到业务数据更新时间。",
    });
  }

  if ((dbStats.totalBytes ?? 0) > 1024 * 1024 * 1024) {
    warnings.push({
      severity: "medium",
      message: "SQLite 数据文件已超过 1 GB，建议关注备份、压缩和迁移策略。",
    });
  }

  return warnings;
}

function renderAdminPage(): string {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>ym-novel-mcp Monitor</title>
  <style>
    :root {
      color-scheme: dark;
      --bg: #10110d;
      --panel: #191a15;
      --panel-2: #22241d;
      --line: #3a3d31;
      --text: #f2eedf;
      --muted: #aaa38f;
      --accent: #d7ff72;
      --accent-2: #6ec6ff;
      --danger: #ff8972;
      --ok: #90f2b6;
      font-family: "Segoe UI", "Microsoft YaHei", sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
    }
    button, input { font: inherit; }
    .shell {
      display: grid;
      grid-template-columns: 18rem minmax(0, 1fr);
      min-height: 100vh;
    }
    aside {
      border-right: 1px solid var(--line);
      padding: 1.35rem;
      background: #0d0e0b;
      position: sticky;
      top: 0;
      height: 100vh;
    }
    main { padding: 1.35rem; }
    h1, h2, h3, p { margin-top: 0; }
    h1 { font-size: 1.35rem; line-height: 1.1; }
    h2 { font-size: .98rem; color: var(--muted); font-weight: 700; }
    code { color: var(--accent); }
    .status-dot {
      display: inline-block;
      width: .62rem;
      height: .62rem;
      border-radius: 999px;
      margin-right: .45rem;
      background: var(--danger);
      box-shadow: 0 0 0 .2rem rgba(255, 137, 114, .12);
    }
    .status-dot.ok {
      background: var(--ok);
      box-shadow: 0 0 0 .2rem rgba(144, 242, 182, .12);
    }
    .stack { display: grid; gap: 1rem; }
    .grid {
      display: grid;
      grid-template-columns: repeat(12, 1fr);
      gap: 1rem;
    }
    .span-3 { grid-column: span 3; }
    .span-4 { grid-column: span 4; }
    .span-5 { grid-column: span 5; }
    .span-6 { grid-column: span 6; }
    .span-7 { grid-column: span 7; }
    .span-8 { grid-column: span 8; }
    .span-12 { grid-column: span 12; }
    section {
      background: var(--panel);
      border: 1px solid var(--line);
      border-radius: .5rem;
      padding: 1rem;
    }
    .metric {
      min-height: 7rem;
      display: flex;
      flex-direction: column;
      justify-content: space-between;
    }
    .metric strong { font-size: 1.85rem; letter-spacing: 0; }
    .muted { color: var(--muted); }
    .row {
      display: flex;
      gap: .55rem;
      align-items: center;
      flex-wrap: wrap;
    }
    input {
      width: 100%;
      color: var(--text);
      background: #0d0e0b;
      border: 1px solid var(--line);
      border-radius: .4rem;
      padding: .72rem .78rem;
      outline: none;
    }
    input:focus {
      border-color: var(--accent);
      box-shadow: 0 0 0 .15rem rgba(215, 255, 114, .14);
    }
    button {
      color: #10110d;
      background: var(--accent);
      border: 0;
      border-radius: .4rem;
      padding: .72rem .92rem;
      cursor: pointer;
      font-weight: 700;
      white-space: nowrap;
    }
    button.secondary {
      color: var(--text);
      background: var(--panel-2);
      border: 1px solid var(--line);
    }
    .list { display: grid; gap: .65rem; }
    .item {
      border: 1px solid var(--line);
      border-radius: .45rem;
      padding: .8rem;
      background: rgba(34, 36, 29, .72);
      cursor: pointer;
    }
    .item.active { border-color: var(--accent); }
    .item h3 { font-size: .98rem; margin-bottom: .35rem; }
    .pill {
      display: inline-flex;
      align-items: center;
      min-height: 1.5rem;
      padding: .2rem .48rem;
      border-radius: 999px;
      border: 1px solid var(--line);
      color: var(--muted);
      font-size: .78rem;
    }
    .kv {
      display: grid;
      grid-template-columns: 10rem minmax(0, 1fr);
      gap: .55rem .85rem;
      align-items: baseline;
      font-size: .9rem;
    }
    .kv span:nth-child(odd) { color: var(--muted); }
    pre {
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
      color: var(--muted);
      font-size: .82rem;
      line-height: 1.45;
    }
    .toolbar {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: .7rem;
      align-items: center;
    }
    .token-row {
      display: grid;
      grid-template-columns: minmax(0, 1fr) auto;
      gap: .55rem;
      margin-top: 1rem;
    }
    @media (max-width: 1100px) {
      .span-3, .span-4, .span-5, .span-6, .span-7, .span-8, .span-12 {
        grid-column: span 12;
      }
    }
    @media (max-width: 760px) {
      .shell { grid-template-columns: 1fr; }
      aside { position: static; height: auto; }
      .kv { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="shell">
    <aside>
      <h1>ym-novel-mcp Monitor</h1>
      <p class="muted"><span id="statusDot" class="status-dot"></span><span id="statusText">检查中</span></p>
      <div class="token-row">
        <input id="tokenInput" type="password" placeholder="HTTP token">
        <button id="saveToken" class="secondary" type="button">保存</button>
      </div>
      <div class="stack" style="margin-top:1rem;">
        <button id="refreshNow" type="button">刷新监控</button>
        <p class="muted">只读监控面板。写入、创建项目、创建快照请通过 MCP tools 完成。</p>
        <p class="muted">后台 <code>/admin</code><br>MCP <code>/mcp</code><br>健康 <code>/healthz</code></p>
      </div>
    </aside>
    <main class="stack">
      <div class="grid">
        <section class="metric span-3">
          <h2>服务状态</h2>
          <strong id="serviceState">-</strong>
          <span class="muted" id="uptimeText">运行时长 -</span>
        </section>
        <section class="metric span-3">
          <h2>项目数</h2>
          <strong id="projectCount">-</strong>
          <span class="muted">当前数据库项目</span>
        </section>
        <section class="metric span-3">
          <h2>总字数</h2>
          <strong id="totalWords">-</strong>
          <span class="muted">按项目 currentWords 统计</span>
        </section>
        <section class="metric span-3">
          <h2>数据库大小</h2>
          <strong id="dbSize">-</strong>
          <span class="muted" id="dbModifiedAt">更新时间 -</span>
        </section>
      </div>

      <div class="grid">
        <section class="span-5 stack">
          <h2>写作流水线</h2>
          <div id="pipelineList" class="list"></div>
        </section>
        <section class="span-7 stack">
          <h2>最近 MCP 调用</h2>
          <div id="toolCallList" class="list"></div>
        </section>
      </div>

      <div class="grid">
        <section class="span-12 stack">
          <h2>最近写入内容</h2>
          <div id="recentWrites" class="list"></div>
        </section>
      </div>

      <div class="grid">
        <section class="span-5 stack">
          <h2>监控告警</h2>
          <div id="warningsList" class="list"></div>
        </section>
        <section class="span-7 stack">
          <h2>最近活动</h2>
          <div id="recentActivity" class="list"></div>
        </section>
      </div>

      <div class="grid">
        <section class="span-5 stack">
          <div class="toolbar">
            <h2>项目进度</h2>
            <button id="reloadProjects" class="secondary" type="button">刷新</button>
          </div>
          <div id="projectList" class="list"></div>
        </section>

        <section class="span-7 stack">
          <h2>数据库表计数</h2>
          <div id="tableCounts" class="grid"></div>
        </section>
      </div>

      <div class="grid">
        <section class="span-5 stack">
          <h2>最近快照</h2>
          <div id="snapshotList" class="list"></div>
        </section>
        <section class="span-7 stack">
          <div class="toolbar">
            <h2>只读诊断搜索</h2>
            <button id="runSearch" type="button">搜索</button>
          </div>
          <input id="searchInput" placeholder="搜索章节、人物、世界观、伏笔、时间线、canon facts">
          <div id="searchResults" class="list"></div>
        </section>
      </div>

      <div class="grid">
        <section class="span-5 stack">
          <h2>连接信息</h2>
          <div class="kv">
            <span>认证</span><strong id="authMode">-</strong>
            <span>进程 PID</span><strong id="pid">-</strong>
            <span>Node</span><strong id="nodeVersion">-</strong>
            <span>内存 RSS</span><strong id="memoryRss">-</strong>
            <span>Heap Used</span><strong id="memoryHeap">-</strong>
            <span>最后数据更新</span><strong id="latestDataUpdatedAt">-</strong>
            <span>SQLite 文件</span><strong id="dbFiles">-</strong>
          </div>
        </section>
        <section class="span-7 stack">
          <h2>原始状态 JSON</h2>
          <pre id="statusJson">{}</pre>
        </section>
      </div>
    </main>
  </div>

  <script>
    const state = { projects: [], selectedProjectId: null };
    const $ = (id) => document.getElementById(id);
    const tokenKey = "ymNovelMcpAdminToken";

    $("tokenInput").value = localStorage.getItem(tokenKey) || "";
    $("saveToken").addEventListener("click", () => {
      localStorage.setItem(tokenKey, $("tokenInput").value.trim());
      refreshAll();
    });

    function headers() {
      const token = $("tokenInput").value.trim();
      return token ? { authorization: "Bearer " + token } : {};
    }

    async function api(path, options = {}) {
      const response = await fetch(path, { ...options, headers: { ...headers(), ...(options.headers || {}) } });
      const text = await response.text();
      const data = text ? JSON.parse(text) : {};
      if (!response.ok) throw new Error(data.error || response.statusText);
      return data;
    }

    async function loadStatus() {
      const data = await api("/admin/api/status");
      $("statusDot").classList.add("ok");
      $("statusText").textContent = "READY";
      $("serviceState").textContent = data.ok ? "READY" : "DOWN";
      $("projectCount").textContent = data.projectCount;
      $("totalWords").textContent = Number(data.totalWords || 0).toLocaleString();
      $("dbSize").textContent = data.dbSize || "-";
      $("dbModifiedAt").textContent = data.dbModifiedAt ? "更新时间 " + formatDate(data.dbModifiedAt) : "更新时间 -";
      $("uptimeText").textContent = "运行时长 " + (data.process?.uptime || "-");
      $("authMode").textContent = data.auth;
      $("pid").textContent = data.process?.pid || "-";
      $("nodeVersion").textContent = data.process?.node || "-";
      $("memoryRss").textContent = data.process?.memoryRss || "-";
      $("memoryHeap").textContent = data.process?.memoryHeapUsed || "-";
      $("latestDataUpdatedAt").textContent = data.latestDataUpdatedAt ? formatDate(data.latestDataUpdatedAt) : "-";
      $("dbFiles").textContent = (data.dbFiles || []).map((file) => file.size).join(" / ") || "-";
      $("statusJson").textContent = JSON.stringify(data, null, 2);
      renderTableCounts(data.tableCounts || {});
      renderWarnings(data.warnings || []);
      renderRecentActivity(data.recentActivity || []);
    }

    async function loadProjects() {
      const data = await api("/admin/api/projects");
      state.projects = data.projects || [];
      if (!state.selectedProjectId && state.projects[0]) state.selectedProjectId = state.projects[0].id;
      if (state.selectedProjectId && !state.projects.some((project) => project.id === state.selectedProjectId)) {
        state.selectedProjectId = state.projects[0]?.id || null;
      }
      renderProjects();
      await loadSnapshots();
      await loadWritingMonitor();
    }

    function renderProjects() {
      $("projectList").innerHTML = state.projects.map((project) => {
        const active = project.id === state.selectedProjectId ? " active" : "";
        const target = project.targetWords ? Number(project.targetWords).toLocaleString() + " 目标字" : "未设目标";
        return '<article class="item' + active + '" data-project="' + escapeHtml(project.id) + '">'
          + '<h3>' + escapeHtml(project.name) + '</h3>'
          + '<div class="row">'
          + '<span class="pill">' + escapeHtml(project.status) + '</span>'
          + '<span class="pill">' + Number(project.currentWords || 0).toLocaleString() + ' 字</span>'
          + '<span class="pill">' + escapeHtml(target) + '</span>'
          + (project.genre ? '<span class="pill">' + escapeHtml(project.genre) + '</span>' : '')
          + '</div></article>';
      }).join("") || '<p class="muted">暂无项目。请通过 MCP tools 创建项目。</p>';
      document.querySelectorAll("[data-project]").forEach((node) => {
        node.addEventListener("click", async () => {
          state.selectedProjectId = node.getAttribute("data-project");
          renderProjects();
          await loadSnapshots();
          await loadWritingMonitor();
        });
      });
    }

    async function loadWritingMonitor() {
      const projectPart = state.selectedProjectId
        ? "?projectId=" + encodeURIComponent(state.selectedProjectId)
        : "";
      const data = await api("/admin/api/writing-monitor" + projectPart);
      renderPipelines(data.pipelines || []);
      renderToolCalls(data.toolCalls || []);
      renderRecentWrites(data.recentWrites || []);
    }

    function renderPipelines(items) {
      $("pipelineList").innerHTML = items.map((item) => {
        const active = item.projectId === state.selectedProjectId ? " active" : "";
        const latest = item.latestChapter
          ? "最近章节：第 " + item.latestChapter.chapterIndex + " 章，" + item.latestChapter.wordCount + " 字"
          : "暂无章节";
        const steps = (item.steps || []).map((step) => {
          return '<span class="pill">' + escapeHtml(shortToolName(step.toolName)) + " " + escapeHtml(step.status) + '</span>';
        }).join("");
        return '<article class="item' + active + '"><h3>' + escapeHtml(item.projectName) + '</h3>'
          + '<p class="muted">' + escapeHtml(latest) + '</p>'
          + '<div class="row">' + steps + '</div>'
          + '<p class="muted">开放伏笔：' + Number(item.openForeshadowingCount || 0).toLocaleString() + '</p></article>';
      }).join("") || '<p class="muted">暂无项目流水线</p>';
    }

    function renderToolCalls(items) {
      $("toolCallList").innerHTML = items.map((item) => {
        return '<article class="item"><div class="row">'
          + '<span class="pill">' + escapeHtml(item.status) + '</span>'
          + '<span class="pill">' + Number(item.durationMs || 0).toLocaleString() + ' ms</span>'
          + '<span class="pill">' + escapeHtml(formatDate(item.createdAt)) + '</span>'
          + '</div><h3>' + escapeHtml(item.toolName) + '</h3>'
          + (item.contentPreview ? '<p class="muted">' + escapeHtml(item.contentPreview) + '</p>' : '')
          + (item.errorMessage ? '<p class="muted">' + escapeHtml(item.errorMessage) + '</p>' : '')
          + '</article>';
      }).join("") || '<p class="muted">暂无 MCP 调用记录。后续调用写作 tools 后会显示在这里。</p>';
    }

    function renderRecentWrites(items) {
      $("recentWrites").innerHTML = items.map((item) => {
        const meta = item.meta || {};
        return '<article class="item"><div class="row">'
          + '<span class="pill">' + escapeHtml(item.type) + '</span>'
          + '<span class="pill">' + escapeHtml(formatDate(item.at)) + '</span>'
          + (meta.chapterIndex ? '<span class="pill">章节/顺序 ' + escapeHtml(meta.chapterIndex) + '</span>' : '')
          + (meta.wordCount ? '<span class="pill">' + Number(meta.wordCount).toLocaleString() + ' 字</span>' : '')
          + '</div><h3>' + escapeHtml(item.title) + '</h3>'
          + '<p class="muted">' + escapeHtml(item.content || "") + '</p></article>';
      }).join("") || '<p class="muted">暂无写入内容。保存章节或 apply_post_chapter_update 后会显示。</p>';
    }

    function shortToolName(toolName) {
      return String(toolName)
        .replace("build_next_chapter_context", "Context")
        .replace("check_continuity", "Continuity")
        .replace("save_chapter", "Save")
        .replace("build_post_chapter_update_prompt", "Extract")
        .replace("apply_post_chapter_update", "Apply")
        .replace("create_project_snapshot", "Snapshot");
    }

    function renderTableCounts(counts) {
      $("tableCounts").innerHTML = Object.entries(counts).map(([name, count]) => {
        return '<article class="metric span-3"><h2>' + escapeHtml(name) + '</h2>'
          + '<strong>' + Number(count || 0).toLocaleString() + '</strong>'
          + '<span class="muted">rows</span></article>';
      }).join("");
    }

    function renderWarnings(warnings) {
      $("warningsList").innerHTML = warnings.map((warning) => {
        return '<article class="item"><div class="row">'
          + '<span class="pill">' + escapeHtml(warning.severity) + '</span>'
          + '</div><p class="muted">' + escapeHtml(warning.message) + '</p></article>';
      }).join("") || '<p class="muted">暂无告警</p>';
    }

    function renderRecentActivity(items) {
      $("recentActivity").innerHTML = items.map((item) => {
        return '<article class="item"><h3>' + escapeHtml(item.title) + '</h3>'
          + '<div class="row"><span class="pill">' + escapeHtml(item.type) + '</span>'
          + '<span class="pill">' + escapeHtml(formatDate(item.at)) + '</span></div></article>';
      }).join("") || '<p class="muted">暂无活动</p>';
    }

    async function runSearch() {
      const projectId = state.selectedProjectId;
      if (!projectId) {
        $("searchResults").innerHTML = '<p class="muted">请先选择项目</p>';
        return;
      }
      const query = encodeURIComponent($("searchInput").value.trim());
      const data = await api("/admin/api/search?projectId=" + encodeURIComponent(projectId) + "&q=" + query + "&limit=30");
      $("searchResults").innerHTML = (data.results || []).map((item) => {
        return '<article class="item"><h3>' + escapeHtml(item.title) + '</h3>'
          + '<div class="row"><span class="pill">' + escapeHtml(item.type) + '</span></div>'
          + '<p class="muted">' + escapeHtml(item.snippet || "") + '</p></article>';
      }).join("") || '<p class="muted">没有结果</p>';
    }

    async function loadSnapshots() {
      const projectId = state.selectedProjectId;
      if (!projectId) {
        $("snapshotList").innerHTML = '<p class="muted">请先选择项目</p>';
        return;
      }
      const data = await api("/admin/api/snapshots?projectId=" + encodeURIComponent(projectId) + "&limit=12");
      $("snapshotList").innerHTML = (data.snapshots || []).map((snapshot) => {
        return '<article class="item"><h3>' + escapeHtml(snapshot.label || snapshot.id) + '</h3>'
          + '<p class="muted">' + escapeHtml(formatDate(snapshot.createdAt)) + '</p>'
          + (snapshot.notes ? '<p class="muted">' + escapeHtml(snapshot.notes) + '</p>' : '')
          + '</article>';
      }).join("") || '<p class="muted">暂无快照。请通过 MCP tool create_project_snapshot 创建。</p>';
    }

    async function refreshAll() {
      try {
        await loadStatus();
        await loadProjects();
      } catch (error) {
        $("statusDot").classList.remove("ok");
        $("statusText").textContent = error.message;
        $("serviceState").textContent = "ERROR";
        $("statusJson").textContent = String(error.stack || error.message);
      }
    }

    function formatDate(value) {
      return new Date(value).toLocaleString();
    }

    function escapeHtml(value) {
      return String(value).replace(/[&<>"']/g, (char) => ({
        "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
      })[char]);
    }

    $("refreshNow").addEventListener("click", refreshAll);
    $("reloadProjects").addEventListener("click", refreshAll);
    $("runSearch").addEventListener("click", runSearch);
    $("searchInput").addEventListener("keydown", (event) => {
      if (event.key === "Enter") runSearch();
    });
    refreshAll();
    setInterval(refreshAll, 15000);
  </script>
</body>
</html>`;
}

function isAuthorized(
  req: IncomingMessage,
  token: string | undefined,
): boolean {
  if (!token) {
    return true;
  }
  const auth = getHeader(req, "authorization");
  const candidate = auth?.startsWith("Bearer ") ? auth.slice(7) : undefined;
  return candidate === token || getHeader(req, "x-ym-novel-mcp-token") === token;
}

function writeHtml(res: ServerResponse, html: string): void {
  res.writeHead(200, {
    "content-type": "text/html; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(html);
}

function writeJson(res: ServerResponse, statusCode: number, body: unknown): void {
  res.writeHead(statusCode, {
    "content-type": "application/json; charset=utf-8",
    "cache-control": "no-store",
  });
  res.end(JSON.stringify(body));
}

function trimTrailingSlash(pathname: string): string {
  return pathname.length > 1 ? pathname.replace(/\/$/u, "") : pathname;
}

function getHeader(req: IncomingMessage, name: string): string | undefined {
  const value = req.headers[name.toLowerCase()];
  return Array.isArray(value) ? value[0] : value;
}

function getRequiredQuery(url: URL, key: string): string {
  const value = url.searchParams.get(key);
  if (!value) {
    throw new Error(`${key} is required.`);
  }
  return value;
}

function parseLimit(value: string | null, fallback: number): number {
  if (!value) {
    return fallback;
  }
  const parsed = Number.parseInt(value, 10);
  return Number.isInteger(parsed) && parsed > 0 ? Math.min(parsed, 100) : fallback;
}

function formatBytes(value: number | null): string | null {
  if (value === null) {
    return null;
  }
  const units = ["B", "KB", "MB", "GB", "TB"];
  let amount = value;
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }
  return `${amount.toFixed(unitIndex === 0 ? 0 : 1)} ${units[unitIndex]}`;
}

function formatDuration(totalSeconds: number): string {
  const seconds = Math.max(0, Math.floor(totalSeconds));
  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const rest = seconds % 60;
  if (days > 0) {
    return `${days}d ${hours}h ${minutes}m`;
  }
  if (hours > 0) {
    return `${hours}h ${minutes}m ${rest}s`;
  }
  if (minutes > 0) {
    return `${minutes}m ${rest}s`;
  }
  return `${rest}s`;
}
