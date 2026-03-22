import type { AgentResult, Alert, DailyBrief, Draft, PlanItem, Task } from "../types.js";
import { formatDate, sortByUrgency } from "../utils.js";
import { CAESAR_PROFILE } from "./profiles.js";

export interface CaesarInput {
  tasks: Task[];
  plan: PlanItem[];
  drafts: Draft[];
  alerts: Alert[];
}

export interface CaesarOutput extends AgentResult {
  brief: DailyBrief;
}

export function runCaesar(input: CaesarInput): CaesarOutput {
  const urgentTasks = sortByUrgency(input.tasks.filter((task) => task.status !== "done")).slice(0, 3);
  const todayPlan = input.plan.filter((item) => item.plannedFor === "today");
  const nextDraft = input.drafts[0];

  const brief: DailyBrief = {
    headline: `Aristotle command brief: ${urgentTasks.length} focus item(s), ${input.alerts.length} active alert(s).`,
    topFocus: urgentTasks.map(
      (task) => `${task.title} (${formatDate(task.dueAt)}, ${task.estimateHours}h est.)`,
    ),
    risks: input.alerts.map((alert) => alert.message),
    notes: [
      ...todayPlan.map((item) => `${item.label}: ${item.rationale}`),
      nextDraft ? `Latest draft ready: ${nextDraft.title}` : "No draft generated yet.",
    ],
  };

  return {
    brief,
    summary: `${CAESAR_PROFILE.displayName} produced the daily command brief.`,
  };
}

export function renderBrief(brief: DailyBrief): string {
  const focus = brief.topFocus.length > 0 ? brief.topFocus.map((item) => `- ${item}`).join("\n") : "- No focus items.";
  const risks = brief.risks.length > 0 ? brief.risks.map((item) => `- ${item}`).join("\n") : "- No active risks.";
  const notes = brief.notes.length > 0 ? brief.notes.map((item) => `- ${item}`).join("\n") : "- No notes.";

  return [
    brief.headline,
    "",
    "Top focus",
    focus,
    "",
    "Risks",
    risks,
    "",
    "Notes",
    notes,
  ].join("\n");
}
