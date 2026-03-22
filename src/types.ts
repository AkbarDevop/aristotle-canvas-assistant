export type Domain = "university";

export type TaskStatus = "todo" | "in_progress" | "done" | "blocked";
export type DraftType = "outline" | "brief" | "summary" | "message";
export type SyncTrigger = "demo" | "manual" | "sync" | "report";
export type AristotleEventType =
  | "intake.enqueued"
  | "intake.processed"
  | "intake.failed"
  | "aristotle.completed"
  | "sync.completed"
  | "task.updated";

export interface SourceRecord {
  id: string;
  domain: Domain;
  course: string;
  assignmentTitle: string;
  title: string;
  content: string;
  link?: string;
  externalKey?: string;
  capturedAt: string;
}

export interface Task {
  id: string;
  domain: Domain;
  course: string;
  assignmentTitle: string;
  title: string;
  notes: string;
  status: TaskStatus;
  priority: number;
  estimateHours: number;
  dueAt?: string;
  sourceIds: string[];
  externalKey?: string;
  createdAt: string;
  updatedAt: string;
}

export interface Draft {
  id: string;
  domain: Domain;
  course: string;
  assignmentTitle: string;
  type: DraftType;
  title: string;
  body: string;
  sourceIds: string[];
  createdAt: string;
}

export interface RunLog {
  id: string;
  step: string;
  summary: string;
  createdAt: string;
}

export interface AristotleEvent {
  id: string;
  type: AristotleEventType;
  actor: string;
  summary: string;
  createdAt: string;
  metadata?: Record<string, string>;
}

export interface AristotleState {
  sources: SourceRecord[];
  tasks: Task[];
  drafts: Draft[];
  runs: RunLog[];
  events: AristotleEvent[];
}

export interface AssignmentBrief {
  course: string;
  title: string;
  summary: string;
  deliverable: string;
  dueAt: string;
  effortHours: number;
  sourceLink?: string;
  externalKey?: string;
}

export interface AgentProfile {
  code: string;
  displayName: string;
  domain: Domain;
  mission: string;
  guardrails: string[];
}

export interface AgentResult {
  summary: string;
  tasks?: Task[];
  drafts?: Draft[];
}
