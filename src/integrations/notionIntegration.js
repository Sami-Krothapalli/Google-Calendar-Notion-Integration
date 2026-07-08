const { notion } = require("../config/Notion");

const solveDateFields = [
  "Date Solved",
  "Solve Date 1",
  "Solve Date 2",
  "Solve Date 3",
  "Solve Date 4",
];

function getTitle(property) {
  return property.title[0]?.plain_text || null;
}

function getDate(property) {
  if (!property) {
    return null;
  }

  if (property.type === "date") {
    return property.date?.start || null;
  }

  if (property.type === "formula" && property.formula.type === "date") {
    return property.formula.date?.start || null;
  }

  return null;
}

async function getLeetcodeProblems() {
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

  const problems = [];

  for (const row of rows.results) {
    const problemNumber = row.properties.Problem.number;
    const problemTitle = getTitle(row.properties["Problem Title"]);
    const dates = {};

    for (const field of solveDateFields) {
      dates[field] = getDate(row.properties[field]);
    }

    if (!problemNumber || !problemTitle || !dates["Date Solved"]) {
      continue;
    }

    problems.push({
      problemNumber,
      problemTitle,
      dates,
    });
  }

  return problems;
}

if (require.main === module) {
  getLeetcodeProblems()
    .then((problems) => {
      console.dir(problems, { depth: null });
    })
    .catch((error) => {
      console.error(error);
      process.exit(1);
    });
}

module.exports = {
  getLeetcodeProblems,
};
