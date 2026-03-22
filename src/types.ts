export type Domain = "command" | "university" | "planning";

export type TaskStatus = "todo" | "in_progress" | "done" | "blocked";
export type DraftType = "outline" | "brief" | "summary" | "message";
export type AlertSeverity = "info" | "warning" | "critical";
export type BriefOrigin = "demo" | "manual" | "sync" | "scheduler" | "brief";
export type AlexandriaEventType =
  | "intake.enqueued"
  | "intake.processed"
  | "intake.failed"
  | "aristotle.completed"
  | "napoleon.completed"
  | "caesar.completed"
  | "sync.completed";

export interface SourceRecord {
  id: string;
  domain: Domain;
  title: string;
  content: string;
  link?: string;
  externalKey?: string;
  capturedAt: string;
}

export interface Task {
  id: string;
  domain: Domain;
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
  type: DraftType;
  title: string;
  body: string;
  sourceIds: string[];
  createdAt: string;
}

export interface Alert {
  id: string;
  severity: AlertSeverity;
  message: string;
  taskId?: string;
  createdAt: string;
}

export interface PlanItem {
  id: string;
  label: string;
  taskId: string;
  plannedFor: "today" | "this_week" | "later";
  rationale: string;
}

export interface RunLog {
  id: string;
  agent: string;
  summary: string;
  createdAt: string;
}

export interface AlexandriaEvent {
  id: string;
  type: AlexandriaEventType;
  actor: string;
  summary: string;
  createdAt: string;
  metadata?: Record<string, string>;
}

export interface StoredBrief {
  id: string;
  headline: string;
  body: string;
  createdAt: string;
  origin: BriefOrigin;
}

export interface AlexandriaState {
  sources: SourceRecord[];
  tasks: Task[];
  drafts: Draft[];
  alerts: Alert[];
  plan: PlanItem[];
  runs: RunLog[];
  events: AlexandriaEvent[];
  briefs: StoredBrief[];
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
  alerts?: Alert[];
  plan?: PlanItem[];
}

export interface DailyBrief {
  headline: string;
  topFocus: string[];
  risks: string[];
  notes: string[];
}
