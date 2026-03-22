import type { AgentResult, AssignmentBrief, Draft, SourceRecord, Task } from "../types.js";
import { createId, nowIso } from "../utils.js";
import { ARISTOTLE_PROFILE } from "./profiles.js";

export interface AristotleOutput extends AgentResult {
  source: SourceRecord;
}

interface AristotleOptions {
  sourceId?: string;
}

type AssignmentWorkflow = "compact" | "medium" | "full";
type MediumAssignmentFlavor = "discussion" | "quiz";

export function runAristotle(input: AssignmentBrief, options: AristotleOptions = {}): AristotleOutput {
  const capturedAt = nowIso();
  const source: SourceRecord = {
    id: options.sourceId ?? createId("src"),
    domain: "university",
    course: input.course,
    assignmentTitle: input.title,
    title: `${input.course}: ${input.title}`,
    content: `${input.summary}\nDeliverable: ${input.deliverable}`,
    capturedAt,
  };

  if (input.sourceLink) {
    source.link = input.sourceLink;
  }
  if (input.externalKey) {
    source.externalKey = input.externalKey;
  }

  const tasks = buildAssignmentTasks(input, source.id, capturedAt);
  const draft = buildAssignmentDraft(input, source.id, capturedAt);
  const drafts = draft ? [draft] : [];

  return {
    source,
    summary: `${ARISTOTLE_PROFILE.displayName} captured ${input.title} and generated ${tasks.length} task(s)${drafts.length > 0 ? " plus a draft" : ""}.`,
    tasks,
    drafts,
  };
}

function buildAssignmentTasks(input: AssignmentBrief, sourceId: string, createdAt: string): Task[] {
  const workflow = classifyAssignmentWorkflow(input);
  const checkpoints = buildTaskCheckpoints(input.dueAt);

  if (workflow === "compact") {
    return [
      createTask({
        input,
        sourceId,
        createdAt,
        stepId: "complete",
        title: `Complete ${input.title}`,
        notes: `Show up prepared or finish the required check-in for ${input.course} before the deadline.`,
        priority: 5,
        estimateHours: Math.max(1, Math.round(input.effortHours)),
        dueAt: input.dueAt,
      }),
    ];
  }

  if (workflow === "medium") {
    const flavor = classifyMediumAssignmentFlavor(input);
    const prepHours = Math.max(1, Math.round(input.effortHours * 0.6));
    const completionHours = Math.max(1, Math.round(Math.max(1, input.effortHours - prepHours)));

    return [
      createTask({
        input,
        sourceId,
        createdAt,
        stepId: "prepare",
        title:
          flavor === "discussion"
            ? `Draft response for ${input.title}`
            : `Prepare for ${input.title}`,
        notes:
          flavor === "discussion"
            ? `Review the prompt and prepare the response you want to submit for ${input.course}.`
            : `Review the relevant material, notes, and practice problems before completing ${input.title}.`,
        priority: 5,
        estimateHours: prepHours,
        dueAt: checkpoints.outline,
      }),
      createTask({
        input,
        sourceId,
        createdAt,
        stepId: "complete",
        title:
          flavor === "discussion"
            ? `Submit ${input.title}`
            : `Complete ${input.title}`,
        notes:
          flavor === "discussion"
            ? `Finalize and submit ${input.title} for ${input.course}.`
            : `Complete ${input.title} and confirm submission if required.`,
        priority: 5,
        estimateHours: completionHours,
        dueAt: input.dueAt,
      }),
    ];
  }

  const primaryWorkHours = Math.max(1, Math.round(input.effortHours * 0.5));
  const polishHours = Math.max(1, Math.round(input.effortHours * 0.2));

  return [
    createTask({
      input,
      sourceId,
      createdAt,
      stepId: "scope",
      title: `Clarify scope for ${input.title}`,
      notes: `Review the prompt, rubric, and required references for ${input.course}.`,
      priority: 5,
      estimateHours: 1,
      dueAt: checkpoints.scope,
    }),
    createTask({
      input,
      sourceId,
      createdAt,
      stepId: "outline",
      title: `Build outline for ${input.title}`,
      notes: `Create the structure, thesis, sections, or solution plan before drafting the final deliverable.`,
      priority: 4,
      estimateHours: 1,
      dueAt: checkpoints.outline,
    }),
    createTask({
      input,
      sourceId,
      createdAt,
      stepId: "primary",
      title: `Complete primary work for ${input.title}`,
      notes: `Use focused work blocks to produce the main draft or problem set. Target ${primaryWorkHours} hours of deep work.`,
      priority: 5,
      estimateHours: primaryWorkHours,
      dueAt: checkpoints.primary,
    }),
    createTask({
      input,
      sourceId,
      createdAt,
      stepId: "final-review",
      title: `Final review and submission prep for ${input.title}`,
      notes: `Proofread, format, verify references, and prepare the final upload package.`,
      priority: 5,
      estimateHours: polishHours,
      dueAt: input.dueAt,
    }),
  ];
}

function buildTaskCheckpoints(dueAt: string): { scope: string; outline: string; primary: string } {
  const nowMs = Date.now();
  const dueMs = new Date(dueAt).getTime();

  if (Number.isNaN(dueMs) || dueMs <= nowMs) {
    return {
      scope: dueAt,
      outline: dueAt,
      primary: dueAt,
    };
  }

  const remainingMs = dueMs - nowMs;

  return {
    scope: checkpointIso(nowMs, remainingMs, 0.15, dueMs),
    outline: checkpointIso(nowMs, remainingMs, 0.35, dueMs),
    primary: checkpointIso(nowMs, remainingMs, 0.75, dueMs),
  };
}

function checkpointIso(nowMs: number, remainingMs: number, ratio: number, dueMs: number): string {
  const minimumLeadMs = 60 * 60 * 1000;
  const targetMs = Math.max(nowMs + minimumLeadMs, Math.floor(nowMs + remainingMs * ratio));
  return new Date(Math.min(targetMs, dueMs)).toISOString();
}

function buildAssignmentDraft(input: AssignmentBrief, sourceId: string, createdAt: string): Draft | undefined {
  const workflow = classifyAssignmentWorkflow(input);

  if (workflow === "compact") {
    return undefined;
  }

  if (workflow === "medium") {
    const body = [
      `Course: ${input.course}`,
      `Assignment: ${input.title}`,
      `Deliverable: ${input.deliverable}`,
      "",
      "Prep checklist",
      "1. Understand the prompt",
      `- ${input.summary}`,
      "2. Review the required material",
      "- notes, lecture slides, assigned readings, or practice questions",
      "3. Finish the deliverable",
      "- submit the discussion, quiz, or short response before the deadline",
    ].join("\n");

    return {
      id: createId("draft"),
      domain: "university",
      course: input.course,
      assignmentTitle: input.title,
      type: "outline",
      title: `Prep checklist for ${input.title}`,
      body,
      sourceIds: [sourceId],
      createdAt,
    };
  }

  const body = [
    `Course: ${input.course}`,
    `Assignment: ${input.title}`,
    `Deliverable: ${input.deliverable}`,
    "",
    "Working outline",
    "1. Goal",
    `- ${input.summary}`,
    "2. Inputs needed",
    "- rubric or prompt details",
    "- supporting sources or references",
    "- examples, data, or required files",
    "3. First execution pass",
    "- convert prompt into a structure",
    "- draft the core argument or solve the hard part first",
    "4. Final review",
    "- align with rubric",
    "- check formatting and submission requirements",
  ].join("\n");

  return {
    id: createId("draft"),
    domain: "university",
    course: input.course,
    assignmentTitle: input.title,
    type: "outline",
    title: `Outline for ${input.title}`,
    body,
    sourceIds: [sourceId],
    createdAt,
  };
}

function createTask({
  input,
  sourceId,
  createdAt,
  stepId,
  title,
  notes,
  priority,
  estimateHours,
  dueAt,
}: {
  input: AssignmentBrief;
  sourceId: string;
  createdAt: string;
  stepId: string;
  title: string;
  notes: string;
  priority: number;
  estimateHours: number;
  dueAt: string;
}): Task {
  const task: Task = {
    id: createId("task"),
    domain: "university",
    course: input.course,
    assignmentTitle: input.title,
    title,
    notes,
    status: "todo",
    priority,
    estimateHours,
    dueAt,
    sourceIds: [sourceId],
    createdAt,
    updatedAt: createdAt,
  };

  if (input.externalKey) {
    task.externalKey = `${input.externalKey}:${stepId}`;
  }

  return task;
}

function classifyAssignmentWorkflow(input: AssignmentBrief): AssignmentWorkflow {
  const normalized = normalizeAssignmentSignature(input);

  if (/(^|\b)(attendance|check[- ]?in|ica|in[- ]class|participation)(\b|$)/.test(normalized)) {
    return "compact";
  }

  if (/(^|\b)(quiz|discussion)(\b|$)/.test(normalized)) {
    return "medium";
  }

  return "full";
}

function classifyMediumAssignmentFlavor(input: AssignmentBrief): MediumAssignmentFlavor {
  const normalized = normalizeAssignmentSignature(input);
  return normalized.includes("discussion") ? "discussion" : "quiz";
}

function normalizeAssignmentSignature(input: AssignmentBrief): string {
  return `${input.title} ${input.deliverable}`.toLowerCase();
}
