const { Client} = require("@notionhq/client");
const dotenv = require("dotenv");
dotenv.config();

const notion = new Client({ auth: process.env.NOTION_TOKEN });

(async () => {
  const blockId = process.env.NOTION_PAGE_ID; 
  const children = await notion.blocks.children.list({
    block_id: blockId,
  });

  const childDatabase = children.results.find((block) => block.type === "child_database");
  
  const database = await notion.databases.retrieve({
    database_id: childDatabase.id,
  });

  const fetchData = database.data_sources[0].id;

  const dataSource = await notion.dataSources.retrieve({
    data_source_id: fetchData,
  });
  
//   Object.entries(dataSource.properties).forEach(([propertyName, propertyValue]) => {
//     console.log(`${propertyName}: ${propertyValue.content}`);
//     console.dir(firstRow.properties, { depth: null })
//     });

const rows = await notion.dataSources.query({
    data_source_id: fetchData,  
});


const firstRow = rows.results[0];
console.dir(firstRow.properties["Solve Date 1"], { depth: null });

// console.log(dataSource.properties);
})();