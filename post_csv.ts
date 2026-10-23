import fs from "fs";
import csv from "csv-parser";
import axios from "axios";
import pLimit from "p-limit";

interface CsvRow {
  [key: string]: string;
}

interface PostResponse {
  success: boolean;
  // Add other response fields if needed
}

const limit = pLimit(10); // Limit to 10 concurrent requests
const csvFilePath = "./data/arxiv_data.csv";
const endpoint = "https://good-rag.threepointone.workers.dev/abstracts";

const requests: Promise<void>[] = [];

const processStream = new Promise<void>((resolve, reject) => {
  fs.createReadStream(csvFilePath)
    .pipe(csv())
    .on("data", (row: CsvRow) => {
      const text = row[Object.keys(row)[1]]; // Assuming the second column contains the text

      // Queue the request with concurrency limit
      const request = limit(async () => {
        try {
          const response = await axios.post<PostResponse>(endpoint, { text });
          console.log(`Successfully posted: ${text}`);
        } catch (error) {
          console.error(
            `Error posting data: ${
              error instanceof Error ? error.message : String(error)
            }`
          );
        }
      });

      requests.push(request);
    })
    .on("end", () => resolve())
    .on("error", (error) => reject(error));
});

async function main() {
  try {
    await processStream;
    await Promise.all(requests);
    console.log("All requests completed");
  } catch (error) {
    console.error(
      "Error processing requests:",
      error instanceof Error ? error.message : String(error)
    );
    process.exit(1);
  }
}

main();
