const fs = require("fs");
const path = require("path");
const express = require("express");
const { buildOverview } = require("./lib/overview");
const { buildStudentDetail } = require("./lib/student");

const app = express();
const port = Number(process.env.PORT) || 3000;
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

app.use(express.static(publicDir));

function readJsonFile(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

app.get("/api/demo", (req, res) => {
  try {
    res.json(readJsonFile(demoJsonPath));
  } catch (err) {
    console.error("failed to read demo data");
    res.status(500).json({ error: "demo_data_unavailable" });
  }
});

app.get("/api/overview", (req, res) => {
  try {
    const overview = buildOverview(readJsonFile(demoJsonPath), {
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
    console.error("failed to build overview");
    res.status(500).json({ error: "overview_unavailable" });
  }
});

app.get("/api/student", (req, res) => {
  try {
    const detail = buildStudentDetail(readJsonFile(demoJsonPath), {
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
    console.error("failed to build student detail");
    res.status(500).json({ error: "student_unavailable" });
  }
});

app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
