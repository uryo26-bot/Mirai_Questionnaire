const fs = require("fs");
const path = require("path");
const express = require("express");
const { loadEnvFile } = require("./lib/env");
const { buildOverview } = require("./lib/overview");
const { buildStudentDetail } = require("./lib/student");
const { loadLiveDataset, formatLoadStats } = require("./lib/sheet-dataset");

loadEnvFile(path.join(__dirname, ".env"));

const app = express();
const port = Number(process.env.PORT) || 3000;
const dataSource = (process.env.DATA_SOURCE || "demo").trim().toLowerCase();
const publicDir = path.join(__dirname, "public");
const demoJsonPath = path.join(
  __dirname,
  "data",
  "demo",
  "demo_survey_responses.json"
);
const metricConfigPath = path.join(__dirname, "config", "key-metrics.json");
const alertRulesPath = path.join(__dirname, "config", "alert-rules.json");
const questionConfigPath = path.join(__dirname, "config", "questions.json");
const liveCacheMs = 60 * 1000;

app.use(express.static(publicDir));

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

let liveCache = { at: 0, data: null };

async function getDataset() {
  if (dataSource !== "live") {
    return readJsonFile(demoJsonPath);
  }
  const now = Date.now();
  if (liveCache.data && now - liveCache.at < liveCacheMs) {
    return liveCache.data;
  }
  const data = await loadLiveDataset({
    spreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
    keyFile: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    responsesSheet: process.env.RESPONSES_SHEET_NAME,
    rosterSheet: process.env.ROSTER_SHEET_NAME,
    questionConfig: readJsonFile(questionConfigPath),
    scaleMax: readJsonFile(metricConfigPath).scale_max
  });
  liveCache = { at: now, data };
  return data;
}

const sheetErrorCodes = new Set([
  "sheet_unavailable",
  "empty_roster",
  "roster_header",
  "roster_row",
  "duplicate_roster_name",
  "duplicate_roster_id",
  "empty_responses",
  "response_header",
  "response_timestamp",
  "no_matched_responses"
]);

function sendSheetError(res, err) {
  console.error(err.message);
  if (err.unmatchedRows && err.unmatchedRows.length) {
    console.error(`unmatched response rows: ${err.unmatchedRows.join(", ")}`);
  }
  res.status(500).json({ error: "sheet_unavailable" });
}

app.get("/api/demo", (req, res) => {
  if (dataSource === "live") {
    res.status(404).json({ error: "demo_data_unavailable" });
    return;
  }
  try {
    res.json(readJsonFile(demoJsonPath));
  } catch (err) {
    console.error("failed to read demo data");
    res.status(500).json({ error: "demo_data_unavailable" });
  }
});

app.get("/api/overview", async (req, res) => {
  try {
    const overview = buildOverview(await getDataset(), {
      metricConfig: readJsonFile(metricConfigPath),
      questionConfig: readJsonFile(questionConfigPath),
      rules: readJsonFile(alertRulesPath),
      month: req.query.month
    });
    res.json(overview);
  } catch (err) {
    if (err.code === "unknown_month") {
      res.status(400).json({ error: "unknown_month" });
      return;
    }
    if (sheetErrorCodes.has(err.code)) {
      sendSheetError(res, err);
      return;
    }
    console.error("failed to build overview");
    res.status(500).json({ error: "overview_unavailable" });
  }
});

app.get("/api/student", async (req, res) => {
  try {
    const detail = buildStudentDetail(await getDataset(), {
      metricConfig: readJsonFile(metricConfigPath),
      questionConfig: readJsonFile(questionConfigPath),
      rules: readJsonFile(alertRulesPath),
      studentId: req.query.student_id,
      month: req.query.month
    });
    res.json(detail);
  } catch (err) {
    if (err.code === "unknown_month") {
      res.status(400).json({ error: "unknown_month" });
      return;
    }
    if (err.code === "unknown_student") {
      res.status(404).json({ error: "unknown_student" });
      return;
    }
    if (sheetErrorCodes.has(err.code)) {
      sendSheetError(res, err);
      return;
    }
    console.error("failed to build student detail");
    res.status(500).json({ error: "student_unavailable" });
  }
});

const host = dataSource === "live" ? "127.0.0.1" : undefined;

app.listen(port, host, async () => {
  const shownHost = host || "localhost";
  console.log(`Server listening on http://${shownHost}:${port}`);
  if (dataSource !== "live") {
    return;
  }
  try {
    const data = await getDataset();
    console.log(formatLoadStats(data.stats));
  } catch (err) {
    console.error(err.message);
    if (err.unmatchedRows && err.unmatchedRows.length) {
      console.error(`unmatched response rows: ${err.unmatchedRows.join(", ")}`);
    }
    process.exit(1);
  }
});
