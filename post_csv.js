const fs = require("fs");
const csv = require("csv-parser");
const axios = require("axios");

const csvFilePath = "./data/arxiv_data.csv";
const endpoint = "https://good-rag.threepointone.workers.dev/abstracts";

fs.createReadStream(csvFilePath)
  .pipe(csv())
  .on("data", async (row) => {
    try {
      const text = row[Object.keys(row)[1]]; // Assuming the second column contains the text
      const response = await axios.post(endpoint, { text });
      console.log(`Successfully posted: ${text}`);
    } catch (error) {
      console.error(`Error posting data: ${error.message}`);
    }
  })
  .on("end", () => {
    console.log("CSV file successfully processed");
  });
