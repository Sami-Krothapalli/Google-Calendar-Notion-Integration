const { Client } = require("@notionhq/client");
const path = require("path");
const dotenv = require("dotenv");
dotenv.config({ path: path.resolve(__dirname, "../../.env") });

// Auth Notion Client
const notion = new Client({ auth: process.env.NOTION_TOKEN });

(async () => {
  const pageId = process.env.NOTION_PAGE_ID;

  // List of Blocks
  const children = await notion.blocks.children.list({
    block_id: pageId,
  });

  const db = children.results.find((block) => block.type === "child_database");

  const metadata = await notion.databases.retrieve({
    database_id: db.id,
  });

  const data_source_id = metadata.data_sources[0].id;

  const rows = await notion.dataSources.query({
    data_source_id: data_source_id,
  });

  // Delete When Done Testing
  for (const row of rows.results) {
    // const firstRow = rows.results[i];
    console.dir(row.properties["Solve Date 2"], { depth: null });
  }


})();