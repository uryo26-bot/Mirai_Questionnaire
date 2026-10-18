const path = require("path");
const { loadEnvFile } = require("../lib/env");
const { loadLiveDataset, formatLoadStats } = require("../lib/sheet-dataset");

loadEnvFile(path.join(__dirname, "..", ".env"));

async function main() {
  console.log(
    `tabs responses=${process.env.RESPONSES_SHEET_NAME} roster=${process.env.ROSTER_SHEET_NAME}`
  );
  const questionConfig = require("../config/questions.json");
  const metricConfig = require("../config/key-metrics.json");
  const dataset = await loadLiveDataset({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    responsesSheet: process.env.RESPONSES_SHEET_NAME,
    rosterSheet: process.env.ROSTER_SHEET_NAME,
    questionConfig,
    scaleMax: metricConfig.scale_max
  });
  console.log(formatLoadStats(dataset.stats));
}

main().catch((err) => {
  console.error(err.message);
  if (err.unmatchedRows && err.unmatchedRows.length) {
    console.error(`unmatched response rows: ${err.unmatchedRows.join(", ")}`);
  }
  process.exit(1);
});
