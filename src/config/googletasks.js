const path = require("path");
const { authenticate } = require("@google-cloud/local-auth");

const SCOPES = ["https://www.googleapis.com/auth/tasks"];
const CREDENTIALS_PATH = path.resolve(__dirname, "../../credentials.json");

async function getGoogleTasksAuth() {
  return authenticate({
    scopes: SCOPES,
    keyfilePath: CREDENTIALS_PATH,
  });
}

module.exports = {
  getGoogleTasksAuth,
};
