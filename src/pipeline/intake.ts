import { mkdir, readFile, readdir, rename, writeFile } from "node:fs/promises";
import path from "node:path";

import { getArchiveDir, getFailedDir, getInboxDir } from "../config.js";
import type { AssignmentBrief } from "../types.js";
import { nowIso, slugify } from "../utils.js";

export interface PendingAssignment {
  fileName: string;
  filePath: string;
  assignment?: AssignmentBrief;
  errorMessage?: string;
}

export async function enqueueAssignment(dataDir: string, assignment: AssignmentBrief): Promise<string> {
  const inboxDir = getInboxDir(dataDir);
  await mkdir(inboxDir, { recursive: true });

  const stamp = nowIso().replace(/[:.]/g, "-");
  const fileName = `${stamp}-${slugify(`${assignment.course}-${assignment.title}`)}.json`;
  const filePath = path.join(inboxDir, fileName);

  await writeFile(filePath, JSON.stringify(assignment, null, 2));
  return filePath;
}

export async function readPendingAssignments(dataDir: string): Promise<PendingAssignment[]> {
  const inboxDir = getInboxDir(dataDir);
  await mkdir(inboxDir, { recursive: true });

  const fileNames = (await readdir(inboxDir)).filter((fileName) => fileName.endsWith(".json")).sort();
  const pending: PendingAssignment[] = [];

  for (const fileName of fileNames) {
    const filePath = path.join(inboxDir, fileName);
    try {
      const raw = JSON.parse(await readFile(filePath, "utf8")) as Partial<AssignmentBrief>;
      pending.push({
        fileName,
        filePath,
        assignment: parseAssignmentBrief(raw),
      });
    } catch (error) {
      const failedPending: PendingAssignment = {
        fileName,
        filePath,
      };
      failedPending.errorMessage =
        error instanceof Error ? error.message : "Unknown intake parsing failure.";
      pending.push(failedPending);
    }
  }

  return pending;
}

export async function archivePendingAssignment(dataDir: string, assignment: PendingAssignment): Promise<void> {
  const archiveDir = getArchiveDir(dataDir);
  await mkdir(archiveDir, { recursive: true });
  await rename(assignment.filePath, path.join(archiveDir, assignment.fileName));
}

export async function failPendingAssignment(
  dataDir: string,
  fileName: string,
  filePath: string,
): Promise<void> {
  const failedDir = getFailedDir(dataDir);
  await mkdir(failedDir, { recursive: true });
  await rename(filePath, path.join(failedDir, fileName));
}

export async function loadAssignmentFromFile(filePath: string): Promise<AssignmentBrief> {
  const raw = JSON.parse(await readFile(path.resolve(filePath), "utf8")) as Partial<AssignmentBrief>;
  return parseAssignmentBrief(raw);
}

export function parseAssignmentBrief(raw: Partial<AssignmentBrief>): AssignmentBrief {
  const course = requireField(raw.course, "course");
  const title = requireField(raw.title, "title");
  const summary = requireField(raw.summary, "summary");
  const deliverable = requireField(raw.deliverable, "deliverable");
  const dueAt = normalizeIsoDate(requireField(raw.dueAt, "dueAt"));
  const effortHours = normalizeHours(raw.effortHours);

  const assignment: AssignmentBrief = {
    course,
    title,
    summary,
    deliverable,
    dueAt,
    effortHours,
  };

  if (raw.sourceLink) {
    assignment.sourceLink = raw.sourceLink;
  }
  if (raw.externalKey) {
    assignment.externalKey = raw.externalKey;
  }

  return assignment;
}

function requireField(value: string | undefined, fieldName: string): string {
  if (!value || value.trim().length === 0) {
    throw new Error(`Missing required assignment field: ${fieldName}.`);
  }

  return value.trim();
}

function normalizeIsoDate(input: string): string {
  const trimmed = input.trim();
  const dateOnlyMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (dateOnlyMatch) {
    const [, yearRaw, monthRaw, dayRaw] = dateOnlyMatch;
    const localDate = new Date(
      Number(yearRaw),
      Number(monthRaw) - 1,
      Number(dayRaw),
      23,
      0,
      0,
      0,
    );
    return localDate.toISOString();
  }

  const dateTimeMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/);
  if (dateTimeMatch) {
    const [, yearRaw, monthRaw, dayRaw, hourRaw, minuteRaw] = dateTimeMatch;
    const localDate = new Date(
      Number(yearRaw),
      Number(monthRaw) - 1,
      Number(dayRaw),
      Number(hourRaw),
      Number(minuteRaw),
      0,
      0,
    );
    return localDate.toISOString();
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) {
    throw new Error("Expected `dueAt` to be a valid date, local datetime, or ISO timestamp.");
  }

  return parsed.toISOString();
}

function normalizeHours(input: number | undefined): number {
  if (typeof input !== "number" || Number.isNaN(input) || input <= 0) {
    throw new Error("Expected `effortHours` to be a positive number.");
  }

  return input;
}
