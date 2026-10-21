const assert = require("assert");
const questionConfig = require("../config/questions.json");
const { buildDatasetFromValues, timestampMillis } = require("../lib/sheet-dataset");

function scoreKeys() {
  return questionConfig.groups.flatMap((group) => group.questions.map((question) => question.key));
}

function textKeys() {
  return questionConfig.groups.flatMap((group) => (group.text_fields || []).map((field) => field.key));
}

function responseHeader() {
  return ["timestamp", "student_name", "grade", ...scoreKeys(), ...textKeys()];
}

function blankScores() {
  return scoreKeys().map(() => "");
}

function serial(year, month, day, hour, minute) {
  const ms = Date.UTC(year, month - 1, day, hour, minute, 0);
  return (ms - Date.UTC(1899, 11, 30)) / 86400000;
}

function roster() {
  return [
    ["student_id", "student_name", "grade"],
    [1, "テスト太郎", "中学１年"],
    [2, "テスト花", "小学６年"]
  ];
}

function run(name, fn) {
  try {
    fn();
    console.log(`ok ${name}`);
  } catch (err) {
    console.error(`failed ${name}`);
    console.error(err.message);
    process.exitCode = 1;
  }
}

run("joins a trimmed name and keeps a blank score null", () => {
  const scores = blankScores();
  scores[0] = "4";
  const dataset = buildDatasetFromValues({
    rosterValues: roster(),
    responseValues: [
      responseHeader(),
      [serial(2026, 9, 15, 18, 0), " テスト太郎 ", "中学１年", ...scores, "30～60分くらい", "", "英語"]
    ],
    questionConfig,
    scaleMax: 5
  });
  assert.strictEqual(dataset.responses.length, 1);
  const row = dataset.responses[0];
  assert.strictEqual(row.student_id, 1);
  assert.strictEqual(row.student_name, "テスト太郎");
  assert.strictEqual(row.grade, "中学１年");
  assert.strictEqual(row.year_month, "2026-09");
  assert.strictEqual(row.juku_satisfaction, 4);
  assert.strictEqual(row.juku_security, null);
  assert.strictEqual(row.study_daily_mitutes, "30～60分くらい");
  assert.strictEqual(row.study_concerns, null);
  assert.deepStrictEqual(dataset.months, ["2026-09"]);
  assert.strictEqual(dataset.stats.unmatchedCount, 0);
});

run("drops an unmatched response and reports its row number", () => {
  const dataset = buildDatasetFromValues({
    rosterValues: roster(),
    responseValues: [
      responseHeader(),
      [serial(2026, 9, 15, 18, 0), "テスト太郎", "中学１年", ...blankScores(), "", "", ""],
      [serial(2026, 9, 15, 18, 5), "名簿にいない", "中学１年", ...blankScores(), "", "", ""]
    ],
    questionConfig,
    scaleMax: 5
  });
  assert.strictEqual(dataset.responses.length, 1);
  assert.deepStrictEqual(dataset.stats.unmatchedRows, [3]);
});

run("keeps the later response in the same month", () => {
  const early = blankScores();
  early[0] = 2;
  const later = blankScores();
  later[0] = 5;
  const dataset = buildDatasetFromValues({
    rosterValues: roster(),
    responseValues: [
      responseHeader(),
      [serial(2026, 9, 1, 9, 0), "テスト太郎", "中学１年", ...early, "", "", ""],
      [serial(2026, 9, 20, 9, 0), "テスト太郎", "中学１年", ...later, "", "", ""]
    ],
    questionConfig,
    scaleMax: 5
  });
  assert.strictEqual(dataset.responses.length, 1);
  assert.strictEqual(dataset.responses[0].juku_satisfaction, 5);
  assert.strictEqual(dataset.stats.droppedDuplicates, 1);
});

run("rejects a duplicated roster name without including the name", () => {
  assert.throws(
    () => buildDatasetFromValues({
      rosterValues: [
        ["student_id", "student_name", "grade"],
        [1, "テスト太郎", "中学１年"],
        [2, "テスト太郎", "中学２年"]
      ],
      responseValues: [responseHeader()],
      questionConfig,
      scaleMax: 5
    }),
    (err) => {
      assert.strictEqual(err.code, "duplicate_roster_name");
      assert.match(err.message, /rows 2, 3/);
      assert.strictEqual(err.message.includes("テスト太郎"), false);
      return true;
    }
  );
});

run("reads a text timestamp", () => {
  const ms = timestampMillis("2026/08/12 19:20:00");
  const dataset = buildDatasetFromValues({
    rosterValues: roster(),
    responseValues: [
      responseHeader(),
      ["2026/08/12 19:20:00", "テスト花", "小学６年", ...blankScores(), "", "", ""]
    ],
    questionConfig,
    scaleMax: 5
  });
  assert.ok(ms);
  assert.strictEqual(dataset.responses[0].year_month, "2026-08");
  assert.strictEqual(dataset.responses[0].student_id, 2);
});

if (process.exitCode) {
  process.exit(process.exitCode);
}
console.log("all sheet dataset checks passed");
