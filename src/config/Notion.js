const { Client } = require("@notionhq/client");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Auth Notion Client
const notion = new Client({ auth: process.env.NOTION_TOKEN });

module.exports = {
  notion,
};
