const state = {
  view: null,
  capabilities: null,
  filters: {
    view: "all",
    course: "all",
    query: "",
  },
};

const metrics = document.querySelector("#metrics");
const intakeForm = document.querySelector("#intakeForm");
const intakeButton = document.querySelector("#intakeButton");
const intakeStatus = document.querySelector("#intakeStatus");
const focusList = document.querySelector("#focusList");
const commitmentsList = document.querySelector("#commitmentsList");
const alertsList = document.querySelector("#alertsList");
const nextUpList = document.querySelector("#nextUpList");
const todayBucket = document.querySelector("#todayBucket");
const tomorrowBucket = document.querySelector("#tomorrowBucket");
const weekBucket = document.querySelector("#weekBucket");
const runsList = document.querySelector("#runsList");
const taskBoard = document.querySelector("#taskBoard");
const taskBoardStatus = document.querySelector("#taskBoardStatus");
const viewFilters = document.querySelector("#viewFilters");
const courseFilter = document.querySelector("#courseFilter");
const searchInput = document.querySelector("#searchInput");
const draftsList = document.querySelector("#draftsList");
const briefBox = document.querySelector("#briefBox");
const statusLine = document.querySelector("#statusLine");
const refreshButton = document.querySelector("#refreshButton");
const syncButton = document.querySelector("#syncButton");
const taskCardTemplate = document.querySelector("#taskCardTemplate");

refreshButton.addEventListener("click", () => refreshView("Refreshing view..."));
syncButton.addEventListener("click", () => syncAristotle());
intakeForm.addEventListener("submit", submitIntake);
courseFilter.addEventListener("change", () => {
  state.filters.course = courseFilter.value;
  render();
});
searchInput.addEventListener("input", () => {
  state.filters.query = searchInput.value.trim().toLowerCase();
  render();
});

for (const button of viewFilters.querySelectorAll("button")) {
  button.addEventListener("click", () => {
    state.filters.view = button.dataset.view ?? "all";
    render();
  });
}

await refreshView("Loading Aristotle...");
window.setInterval(() => refreshView("Auto-refreshing Aristotle..."), 60000);

async function refreshView(message = "Refreshing Aristotle...") {
  setStatus(message);

  try {
    const response = await fetch("/api/view", {
      headers: {
        Accept: "application/json",
      },
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to load Aristotle.");
    }

    state.view = payload.view;
    state.capabilities = payload.capabilities;
    render();
    setStatus(buildStatusLine(payload.view, payload.capabilities));
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Failed to load Aristotle.");
  }
}

async function syncAristotle() {
  setStatus("Syncing Aristotle with Canvas...");
  syncButton.disabled = true;

  try {
    const response = await fetch("/api/sync", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({}),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? "Sync failed.");
    }

    state.view = payload.view;
    render();
    setStatus(payload.summary ?? "Aristotle synced.");
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Sync failed.");
  } finally {
    syncButton.disabled = false;
  }
}

async function submitIntake(event) {
  event.preventDefault();
  setIntakeStatus("Adding work to Aristotle...");
  intakeButton.disabled = true;

  const formData = new FormData(intakeForm);
  const payload = {
    course: formData.get("course"),
    title: formData.get("title"),
    summary: formData.get("summary"),
    deliverable: formData.get("deliverable"),
    dueAt: formData.get("dueAt"),
    effortHours: formData.get("effortHours"),
    sourceLink: formData.get("sourceLink"),
  };

  try {
    const response = await fetch("/api/intake", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(payload),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.error ?? "Failed to add work to Aristotle.");
    }

    state.view = result.view;
    render();
    intakeForm.reset();
    document.querySelector("#hoursInput").value = "1";
    setIntakeStatus(result.message ?? "Work added to Aristotle.");
    setStatus(result.summary ?? "Aristotle intake complete.");
  } catch (error) {
    setIntakeStatus(error instanceof Error ? error.message : "Failed to add work to Aristotle.");
  } finally {
    intakeButton.disabled = false;
  }
}

function render() {
  if (!state.view) {
    return;
  }

  renderMetrics(state.view.snapshot);
  renderTaskStack(focusList, state.view.focus, true);
  renderMiniList(commitmentsList, state.view.commitmentsToday, "No commitments today.");
  renderAlertList(alertsList, state.view.alerts, "No active alerts.");
  renderTaskStack(nextUpList, state.view.nextUp, false);
  renderMiniList(todayBucket, state.view.buckets.today, "Nothing else due today.");
  renderMiniList(tomorrowBucket, state.view.buckets.tomorrow, "Nothing queued for tomorrow.");
  renderMiniList(weekBucket, state.view.buckets.thisWeek, "The rest of the week is clear.");
  renderRuns(runsList, state.view.recentRuns);
  renderCourseFilter(state.view.courses);
  renderFilterPills();
  const filteredTasks = applyTaskFilters(state.view.tasks);
  renderTaskBoard(taskBoard, filteredTasks);
  renderTaskBoardStatus(filteredTasks.length, state.view.tasks.length);
  renderDrafts(draftsList, state.view.latestDrafts);
  briefBox.textContent = state.view.latestBrief?.body ?? "No saved brief yet.";
}

function renderMetrics(snapshot) {
  metrics.innerHTML = "";

  const cards = [
    ["Active tasks", snapshot.activeTasks],
    ["In progress", snapshot.inProgress],
    ["University", snapshot.universityTasks],
    ["Planning", snapshot.planningItems],
    ["Alerts", snapshot.alerts],
    ["Drafts", snapshot.drafts],
  ];

  for (const [label, value] of cards) {
    const article = document.createElement("article");
    article.className = "metric-card";
    article.innerHTML = `<p>${label}</p><strong>${value}</strong>`;
    metrics.append(article);
  }
}

function renderTaskStack(container, tasks, allowActions) {
  container.innerHTML = "";

  if (!tasks.length) {
    container.innerHTML = `<p class="empty-state">Nothing urgent right now.</p>`;
    return;
  }

  for (const task of tasks) {
    container.append(createTaskCard(task, allowActions));
  }
}

function renderTaskBoard(container, tasks) {
  container.innerHTML = "";

  if (!tasks.length) {
    container.innerHTML = `<p class="empty-state">No tasks match the current filter.</p>`;
    return;
  }

  for (const task of tasks) {
    container.append(createTaskCard(task, true));
  }
}

function renderCourseFilter(courses) {
  const previous = state.filters.course;
  courseFilter.innerHTML = "";

  const allOption = document.createElement("option");
  allOption.value = "all";
  allOption.textContent = "All courses";
  courseFilter.append(allOption);

  for (const course of courses) {
    const option = document.createElement("option");
    option.value = course;
    option.textContent = course;
    courseFilter.append(option);
  }

  if (courses.includes(previous) || previous === "all") {
    courseFilter.value = previous;
  } else {
    state.filters.course = "all";
    courseFilter.value = "all";
  }
}

function renderFilterPills() {
  for (const button of viewFilters.querySelectorAll("button")) {
    button.dataset.active = button.dataset.view === state.filters.view ? "true" : "false";
  }
}

function renderTaskBoardStatus(visibleCount, totalCount) {
  const labels = {
    all: "all active",
    university: "school",
    planning: "planning",
    today: "due today",
    overdue: "overdue",
    working: "working",
  };
  const viewLabel = labels[state.filters.view] ?? state.filters.view;
  const courseLabel = state.filters.course !== "all" ? ` in ${state.filters.course}` : "";
  const searchLabel =
    state.filters.query.length > 0 ? ` matching "${state.filters.query}"` : "";

  taskBoardStatus.textContent =
    `Showing ${visibleCount} of ${totalCount} ${viewLabel} task(s)` +
    `${courseLabel}${searchLabel}.`;
}

function createTaskCard(task, allowActions) {
  const fragment = taskCardTemplate.content.cloneNode(true);
  const card = fragment.querySelector(".task-card");
  const meta = fragment.querySelector(".task-meta");
  const title = fragment.querySelector("h3");
  const urgency = fragment.querySelector(".urgency-pill");
  const notes = fragment.querySelector(".task-notes");
  const rationale = fragment.querySelector(".task-rationale");
  const sourceList = fragment.querySelector(".source-list");
  const actions = fragment.querySelector(".task-actions");

  card.dataset.domain = task.domain;
  card.dataset.status = task.status;
  meta.textContent = buildTaskMeta(task);
  title.textContent = task.title;
  urgency.textContent = task.urgencyLabel;
  urgency.dataset.urgency = task.urgencyLabel.toLowerCase();
  notes.textContent = task.notes;

  const rationaleBits = [
    task.rationale,
    task.plannedFor ? `Planned for ${task.plannedFor}` : null,
  ].filter(Boolean);
  rationale.textContent = rationaleBits.join(" • ");
  rationale.hidden = rationaleBits.length === 0;

  sourceList.innerHTML = "";
  for (const source of task.sources.slice(0, 2)) {
    const anchor = document.createElement(source.link ? "a" : "span");
    anchor.className = "source-chip";
    anchor.textContent = source.title;
    if (source.link) {
      anchor.href = source.link;
      anchor.target = "_blank";
      anchor.rel = "noreferrer";
    }
    sourceList.append(anchor);
  }

  if (!allowActions) {
    actions.remove();
    return fragment;
  }

  for (const button of actions.querySelectorAll("button")) {
    if (button.dataset.status === task.status) {
      button.dataset.active = "true";
    }

    button.addEventListener("click", async () => {
      await updateTaskStatus(task.id, button.dataset.status);
    });
  }

  return fragment;
}

function buildTaskMeta(task) {
  const bits = [
    labelize(task.domain),
    labelize(task.status),
    task.courseLabel ?? null,
    task.dueLabel,
  ].filter(Boolean);

  return bits.join(" • ");
}

async function updateTaskStatus(taskId, status) {
  setStatus(`Updating task to ${labelize(status)}...`);

  try {
    const response = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({ status }),
    });
    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? "Failed to update task.");
    }

    state.view = payload.view;
    render();
    setStatus(`Task updated to ${labelize(status)}.`);
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Failed to update task.");
  }
}

function applyTaskFilters(tasks) {
  return tasks.filter((task) => {
    if (!matchesView(task)) {
      return false;
    }

    if (state.filters.course !== "all" && task.courseLabel !== state.filters.course) {
      return false;
    }

    if (state.filters.query.length > 0) {
      const haystack = [
        task.title,
        task.notes,
        task.courseLabel ?? "",
        ...task.sources.map((source) => source.title),
      ]
        .join(" ")
        .toLowerCase();

      if (!haystack.includes(state.filters.query)) {
        return false;
      }
    }

    return true;
  });
}

function matchesView(task) {
  switch (state.filters.view) {
    case "university":
      return task.domain === "university";
    case "planning":
      return task.domain === "planning";
    case "today":
      return task.urgencyLabel === "Due today";
    case "overdue":
      return task.urgencyLabel === "Overdue";
    case "working":
      return task.status === "in_progress";
    default:
      return true;
  }
}

function renderMiniList(container, items, emptyMessage) {
  container.innerHTML = "";

  if (!items.length) {
    container.innerHTML = `<p class="empty-state">${emptyMessage}</p>`;
    return;
  }

  for (const item of items) {
    const article = document.createElement("article");
    article.className = "mini-row";
    const title = document.createElement("p");
    title.textContent = item.title;
    const meta = document.createElement("span");
    meta.textContent = item.dueLabel;
    article.append(title, meta);
    container.append(article);
  }
}

function renderAlertList(container, alerts, emptyMessage) {
  container.innerHTML = "";

  if (!alerts.length) {
    container.innerHTML = `<p class="empty-state">${emptyMessage}</p>`;
    return;
  }

  for (const alert of alerts) {
    const article = document.createElement("article");
    article.className = "mini-row";
    article.dataset.severity = alert.severity;
    const message = document.createElement("p");
    message.textContent = alert.message;
    const meta = document.createElement("span");
    meta.textContent = labelize(alert.severity);
    article.append(message, meta);
    container.append(article);
  }
}

function renderDrafts(container, drafts) {
  container.innerHTML = "";

  if (!drafts.length) {
    container.innerHTML = `<p class="empty-state">No drafts yet.</p>`;
    return;
  }

  for (const draft of drafts) {
    const article = document.createElement("article");
    article.className = "mini-row";
    const title = document.createElement("p");
    title.textContent = draft.title;
    const meta = document.createElement("span");
    meta.textContent = `${labelize(draft.domain)} • ${labelize(draft.type)}`;
    article.append(title, meta);
    container.append(article);
  }
}

function renderRuns(container, runs) {
  container.innerHTML = "";

  if (!runs.length) {
    container.innerHTML = `<p class="empty-state">No recent runs yet.</p>`;
    return;
  }

  for (const run of runs) {
    const article = document.createElement("article");
    article.className = "mini-row";
    const title = document.createElement("p");
    title.textContent = `${run.agent}: ${run.summary}`;
    const meta = document.createElement("span");
    meta.textContent = new Intl.DateTimeFormat("en-US", {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(new Date(run.createdAt));
    article.append(title, meta);
    container.append(article);
  }
}

function setStatus(message) {
  statusLine.textContent = message;
}

function setIntakeStatus(message) {
  intakeStatus.textContent = message;
}

function buildStatusLine(view, capabilities) {
  const updatedAt = new Intl.DateTimeFormat("en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(new Date(view.generatedAt));
  const integrations = [
    capabilities?.canvas ? "Canvas" : null,
  ]
    .filter(Boolean)
    .join(" + ");

  if (!integrations) {
    return `Updated ${updatedAt}. Local Aristotle state only.`;
  }

  return `Updated ${updatedAt}. Connected to ${integrations}.`;
}

function labelize(value) {
  return String(value).replace(/_/g, " ");
}
