const { getGoogleTasksAuth } = require("../config/googletasks");

const TASKS_API_BASE_URL = "https://tasks.googleapis.com/tasks/v1";
const REQUEST_TIMEOUT_MS = 10000;

function encodeTaskListId(taskListId) {
  return encodeURIComponent(taskListId);
}

async function listTaskLists({ auth } = {}) {
  const client = auth || await getGoogleTasksAuth();

  const response = await client.request({
    url: `${TASKS_API_BASE_URL}/users/@me/lists`,
    timeout: REQUEST_TIMEOUT_MS,
    params: {
      maxResults: 10,
    },
  });

  return response.data.items || [];
}

async function getTaskListId() {
  if (process.env.GOOGLE_TASK_LIST_ID && process.env.GOOGLE_TASK_LIST_ID !== "@default") {
    return process.env.GOOGLE_TASK_LIST_ID;
  }

  return "@default";
}

async function createTask({ auth, title, notes, due, taskListId }) {
  const client = auth || await getGoogleTasksAuth();
  const tasklist = taskListId || await getTaskListId();

  const response = await client.request({
    url: `${TASKS_API_BASE_URL}/lists/${encodeTaskListId(tasklist)}/tasks`,
    method: "POST",
    timeout: REQUEST_TIMEOUT_MS,
    data: {
      title,
      notes,
      due,
    },
  });

  return response.data;
}

async function getTask({ auth, taskListId, taskId }) {
  const client = auth || await getGoogleTasksAuth();
  const tasklist = taskListId || await getTaskListId();

  try {
    const response = await client.request({
      url: `${TASKS_API_BASE_URL}/lists/${encodeTaskListId(tasklist)}/tasks/${encodeURIComponent(taskId)}`,
      timeout: REQUEST_TIMEOUT_MS,
    });

    return response.data;
  } catch (error) {
    if (error.response?.status === 404) {
      return null;
    }

    throw error;
  }
}

if (require.main === module) {
  listTaskLists()
    .then((taskLists) => {
      if (!taskLists.length) {
        console.log("No task lists found.");
        return;
      }

      console.log("Task lists:");
      for (const taskList of taskLists) {
        console.log(`${taskList.title} (${taskList.id})`);
      }
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = {
  createTask,
  getTask,
  getTaskListId,
  listTaskLists,
};
