const { getGoogleTasksAuth } = require("../config/googletasks");

const TASKS_API_BASE_URL = "https://tasks.googleapis.com/tasks/v1";

function encodeTaskListId(taskListId) {
  return encodeURIComponent(taskListId);
}

async function listTaskLists() {
  const auth = await getGoogleTasksAuth();

  const response = await auth.request({
    url: `${TASKS_API_BASE_URL}/users/@me/lists`,
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

async function createTask({ title, notes, due }) {
  const auth = await getGoogleTasksAuth();
  const tasklist = await getTaskListId();

  const response = await auth.request({
    url: `${TASKS_API_BASE_URL}/lists/${encodeTaskListId(tasklist)}/tasks`,
    method: "POST",
    data: {
      title,
      notes,
      due,
    },
  });

  return response.data;
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
  listTaskLists,
};
