import type Database from "better-sqlite3";
import type {
  CreateProjectSnapshotInput,
  ListProjectSnapshotsInput,
  ProjectSnapshot,
  ProjectSnapshotSummary,
} from "../types/novel.js";
import { assertFound } from "../utils/errors.js";
import { createId } from "../utils/ids.js";
import {
  mapProjectSnapshotRow,
  mapProjectSnapshotSummaryRow,
} from "../utils/rows.js";
import { nowIso } from "../utils/text.js";
import { ProjectService } from "./projectService.js";
import { ProjectTransferService } from "./projectTransferService.js";

export class ProjectSnapshotService {
  constructor(
    private readonly db: Database.Database,
    private readonly projectService: ProjectService,
    private readonly projectTransferService: ProjectTransferService,
  ) {}

  createSnapshot(input: CreateProjectSnapshotInput): ProjectSnapshotSummary {
    this.projectService.ensureProjectExists(input.projectId);

    const id = createId("snapshot");
    const now = nowIso();
    const exported = this.projectTransferService.exportProject(input.projectId);

    this.db
      .prepare(
        `INSERT INTO project_snapshots (
          id, project_id, label, notes, content, created_at, updated_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        id,
        input.projectId,
        input.label ?? null,
        input.notes ?? null,
        JSON.stringify(exported),
        now,
        now,
      );

    return this.getSnapshotSummary(id);
  }

  listSnapshots(input: ListProjectSnapshotsInput): ProjectSnapshotSummary[] {
    this.projectService.ensureProjectExists(input.projectId);
    const rows = this.db
      .prepare(
        `SELECT id, project_id, label, notes, created_at, updated_at
        FROM project_snapshots
        WHERE project_id = ?
        ORDER BY created_at DESC
        LIMIT ?`,
      )
      .all(input.projectId, input.limit ?? 20) as Record<string, unknown>[];

    return rows.map(mapProjectSnapshotSummaryRow);
  }

  getSnapshot(snapshotId: string): ProjectSnapshot {
    const row = this.db
      .prepare("SELECT * FROM project_snapshots WHERE id = ?")
      .get(snapshotId) as Record<string, unknown> | undefined;

    return mapProjectSnapshotRow(
      assertFound(row, `Project snapshot ${snapshotId} not found.`),
    );
  }

  private getSnapshotSummary(snapshotId: string): ProjectSnapshotSummary {
    const row = this.db
      .prepare(
        `SELECT id, project_id, label, notes, created_at, updated_at
        FROM project_snapshots
        WHERE id = ?`,
      )
      .get(snapshotId) as Record<string, unknown> | undefined;

    return mapProjectSnapshotSummaryRow(
      assertFound(row, `Project snapshot ${snapshotId} not found.`),
    );
  }
}
