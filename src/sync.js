const fs = require("fs");
const path = require("path");
const dotenv = require("dotenv");
const { getLeetcodeProblems, solveDateFields } = require("./integrations/notionIntegration");
const { getGoogleTasksAuth } = require("./config/googletasks");
const { createTask, getTask, getTaskListId } = require("./integrations/googletasksIntegrations");

dotenv.config({ path: path.resolve(__dirname, "../.env") });

const SYNC_STATE_PATH = path.resolve(__dirname, "../sync_state.json");
const DEFAULT_SYNC_DAYS_AHEAD = 30;

function parseDateOnly(value) {
  if (!value) {
    return null;
  }

  const [year, month, day] = value.split("-").map(Number);

  if (!year || !month || !day) {
    return null;
  }

  return new Date(Date.UTC(year, month - 1, day));
}

function formatDateOnly(date) {
  return date.toISOString().slice(0, 10);
}

function toGoogleTasksDueDate(dateOnly) {
  return `${dateOnly}T00:00:00.000Z`;
}

function addDays(date, days) {
  const copy = new Date(date);
  copy.setUTCDate(copy.getUTCDate() + days);
  return copy;
}

function getTodayUtc() {
  const now = new Date();
  return new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));
}

function getSyncDaysAhead() {
  const configuredDays = Number(process.env.SYNC_DAYS_AHEAD);

  if (Number.isInteger(configuredDays) && configuredDays >= 0) {
    return configuredDays;
  }

  return DEFAULT_SYNC_DAYS_AHEAD;
}

function readSyncState() {
  if (!fs.existsSync(SYNC_STATE_PATH)) {
    return {
      createdTasks: {},
      completedTasks: {},
    };
  }

  const state = JSON.parse(fs.readFileSync(SYNC_STATE_PATH, "utf8"));

  return {
    createdTasks: state.createdTasks || {},
    completedTasks: state.completedTasks || {},
  };
}

function writeSyncState(state) {
  fs.writeFileSync(SYNC_STATE_PATH, `${JSON.stringify(state, null, 2)}\n`);
}

function buildTaskKey(problem, dateField, date) {
  return `${problem.problemNumber}|${dateField}|${date}`;
}

function buildTaskTitle(problem, dateField) {
  if (dateField === "Date Solved") {
    return `LeetCode ${problem.problemNumber}: ${problem.problemTitle}`;
  }

  return `Review LeetCode ${problem.problemNumber}: ${problem.problemTitle}`;
}

function buildTaskNotes(problem, dateField) {
  return [
    `Problem: ${problem.problemNumber} - ${problem.problemTitle}`,
    `Notion date field: ${dateField}`,
    "Created by Notion to Google Tasks sync.",
  ].join("\n");
}

function collectUpcomingTasks(problems, today, endDate) {
  const tasks = [];

  for (const problem of problems) {
    for (const dateField of solveDateFields) {
      const date = problem.dates[dateField];
      const parsedDate = parseDateOnly(date);

      if (!parsedDate || parsedDate < today || parsedDate > endDate) {
        continue;
      }

      tasks.push({
        key: buildTaskKey(problem, dateField, date),
        title: buildTaskTitle(problem, dateField),
        notes: buildTaskNotes(problem, dateField),
        due: toGoogleTasksDueDate(date),
        date,
        dateField,
        problem,
      });
    }
  }

  tasks.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));

  return tasks;
}

function collectCurrentTaskKeys(problems) {
  const keys = new Set();

  for (const problem of problems) {
    for (const dateField of solveDateFields) {
      const date = problem.dates[dateField];

      if (date) {
        keys.add(buildTaskKey(problem, dateField, date));
      }
    }
  }

  return keys;
}

function pruneStaleCreatedTasks(state, currentTaskKeys) {
  let removed = 0;

  for (const key of Object.keys(state.createdTasks)) {
    if (currentTaskKeys.has(key)) {
      continue;
    }

    delete state.createdTasks[key];
    removed += 1;
  }

  return removed;
}

async function syncNotionToGoogleTasks() {
  const today = getTodayUtc();
  const syncDaysAhead = getSyncDaysAhead();
  const endDate = addDays(today, syncDaysAhead);
  const taskListId = await getTaskListId();
  const googleTasksAuth = await getGoogleTasksAuth();
  const state = readSyncState();
  const problems = await getLeetcodeProblems();
  const upcomingTasks = collectUpcomingTasks(problems, today, endDate);
  const currentTaskKeys = collectCurrentTaskKeys(problems);
  const pruned = pruneStaleCreatedTasks(state, currentTaskKeys);

  if (pruned > 0) {
    writeSyncState(state);
  }
  const created = [];
  const recreated = [];
  const skipped = [];
  const skippedCompleted = [];
  const skippedPastMissing = [];

  for (const task of upcomingTasks) {
    console.log(`Syncing ${task.date}: ${task.title}`);

    if (state.completedTasks[task.key]) {
      skippedCompleted.push(task);
      continue;
    }

    const existingRecord = state.createdTasks[task.key];

    if (existingRecord) {
      const existingTask = await getTask({
        auth: googleTasksAuth,
        taskListId: existingRecord.taskListId || taskListId,
        taskId: existingRecord.taskId,
      });

      if (existingTask?.status === "completed") {
        state.completedTasks[task.key] = {
          ...existingRecord,
          completedAt: existingTask.completed || new Date().toISOString(),
        };
        writeSyncState(state);
        skippedCompleted.push(task);
        continue;
      }

      if (existingTask && !existingTask.deleted) {
        skipped.push(task);
        continue;
      }

      if (parseDateOnly(task.date) < today) {
        skippedPastMissing.push(task);
        continue;
      }
    }

    const createdTask = await createTask({
      auth: googleTasksAuth,
      taskListId,
      title: task.title,
      notes: task.notes,
      due: task.due,
    });

    state.createdTasks[task.key] = {
      taskId: createdTask.id,
      taskListId,
      title: task.title,
      due: task.due,
      createdAt: new Date().toISOString(),
    };

    writeSyncState(state);
    if (existingRecord) {
      recreated.push(task);
    } else {
      created.push(task);
    }
  }

  return {
    created,
    recreated,
    pruned,
    skipped,
    skippedCompleted,
    skippedPastMissing,
    totalCandidates: upcomingTasks.length,
    windowStart: formatDateOnly(today),
    windowEnd: formatDateOnly(endDate),
  };
}

if (require.main === module) {
  syncNotionToGoogleTasks()
    .then((result) => {
      console.log(`Sync window: ${result.windowStart} through ${result.windowEnd}`);
      console.log(`Candidates: ${result.totalCandidates}`);
      console.log(`Created: ${result.created.length}`);
      console.log(`Recreated deleted: ${result.recreated.length}`);
      console.log(`Pruned stale state: ${result.pruned}`);
      console.log(`Skipped existing: ${result.skipped.length}`);
      console.log(`Skipped completed: ${result.skippedCompleted.length}`);
      console.log(`Skipped past missing: ${result.skippedPastMissing.length}`);

      for (const task of result.created) {
        console.log(`Created ${task.date}: ${task.title}`);
      }

      for (const task of result.recreated) {
        console.log(`Recreated ${task.date}: ${task.title}`);
      }
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = {
  collectUpcomingTasks,
  syncNotionToGoogleTasks,
};
