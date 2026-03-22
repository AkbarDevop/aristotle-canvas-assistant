import { randomUUID } from "node:crypto";

export function createId(prefix: string): string {
  return `${prefix}_${randomUUID().slice(0, 8)}`;
}

export function nowIso(): string {
  return new Date().toISOString();
}

export function shiftDays(isoDate: string, days: number): string {
  const value = new Date(isoDate);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString();
}

export function daysUntil(isoDate: string, from = new Date()): number {
  const target = new Date(isoDate);
  const distanceMs = target.getTime() - from.getTime();
  return Math.ceil(distanceMs / (1000 * 60 * 60 * 24));
}

export function sortByUrgency<T extends { dueAt?: string; priority: number }>(
  items: T[],
): T[] {
  return [...items].sort((left, right) => {
    const leftDue = left.dueAt ? new Date(left.dueAt).getTime() : Number.MAX_SAFE_INTEGER;
    const rightDue = right.dueAt ? new Date(right.dueAt).getTime() : Number.MAX_SAFE_INTEGER;

    if (leftDue !== rightDue) {
      return leftDue - rightDue;
    }

    return right.priority - left.priority;
  });
}

export function formatDate(isoDate?: string): string {
  if (!isoDate) {
    return "No due date";
  }

  return new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(isoDate));
}

export function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64);
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
