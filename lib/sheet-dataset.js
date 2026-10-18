const { fetchSheetValues, sheetRange } = require("./google-sheet");

function coded(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function questionKeys(questionConfig) {
  const scores = [];
  const texts = [];
  for (const group of questionConfig.groups) {
    for (const question of group.questions) {
      scores.push(question.key);
    }
    for (const field of group.text_fields || []) {
      texts.push(field.key);
    }
  }
  return { scores, texts };
}

function headerIndex(headerRow) {
  const index = new Map();
  headerRow.forEach((cell, i) => {
    const key = String(cell ?? "").replace(/^\uFEFF/, "").trim();
    if (key && !index.has(key)) {
      index.set(key, i);
    }
  });
  return index;
}

function cell(row, index, key) {
  if (!index.has(key)) {
    return "";
  }
  const value = row[index.get(key)];
  if (value === undefined || value === null) {
    return "";
  }
  return value;
}

function isBlankRow(row) {
  return row.every((value) => value === "" || value === null || value === undefined);
}

function parseId(value) {
  if (typeof value === "number" && Number.isInteger(value) && value > 0) {
    return value;
  }
  if (typeof value === "string" && /^[1-9]\d*$/.test(value.trim())) {
    return Number(value.trim());
  }
  return null;
}

function parseScore(value, scaleMax) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const text = typeof value === "number" ? String(value) : String(value).trim();
  if (!/^\d+(\.0+)?$/.test(text)) {
    return null;
  }
  const n = Number(text);
  if (!Number.isInteger(n) || n < 1 || n > scaleMax) {
    return null;
  }
  return n;
}

function parseText(value) {
  if (value === "" || value === null || value === undefined) {
    return null;
  }
  const text = String(value).trim();
  return text === "" ? null : text;
}

function timestampMillis(value) {
  if (typeof value === "number" && Number.isFinite(value)) {
    return Date.UTC(1899, 11, 30) + value * 86400000;
  }
  if (typeof value !== "string") {
    return null;
  }
  const match = value.trim().match(
    /^(\d{4})[\/\-.](\d{1,2})[\/\-.](\d{1,2})(?:[ T](\d{1,2}):(\d{2})(?::(\d{2}))?)?/
  );
  if (!match) {
    return null;
  }
  const [, year, month, day, hour = "0", minute = "0", second = "0"] = match;
  return Date.UTC(
    Number(year),
    Number(month) - 1,
    Number(day),
    Number(hour),
    Number(minute),
    Number(second)
  );
}

function formatTimestamp(ms) {
  const date = new Date(ms);
  const pad = (n) => String(n).padStart(2, "0");
  return (
    `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}` +
    `T${pad(date.getUTCHours())}:${pad(date.getUTCMinutes())}:${pad(date.getUTCSeconds())}`
  );
}

function yearMonthFromMillis(ms) {
  const date = new Date(ms);
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  return `${date.getUTCFullYear()}-${month}`;
}

function buildRoster(values) {
  if (!values.length) {
    throw coded("empty_roster", "roster sheet is empty");
  }
  const index = headerIndex(values[0]);
  for (const key of ["student_id", "student_name", "grade"]) {
    if (!index.has(key)) {
      throw coded("roster_header", `roster sheet is missing ${key}`);
    }
  }

  const byName = new Map();
  const nameRows = new Map();
  const idRows = new Map();
  let rosterCount = 0;

  for (let i = 1; i < values.length; i++) {
    const row = values[i] || [];
    if (isBlankRow(row)) {
      continue;
    }
    const sheetRow = i + 1;
    const name = String(cell(row, index, "student_name")).trim();
    const id = parseId(cell(row, index, "student_id"));
    const grade = parseText(cell(row, index, "grade"));
    if (!name || id === null) {
      throw coded("roster_row", `roster row ${sheetRow} is incomplete`);
    }
    if (!nameRows.has(name)) {
      nameRows.set(name, []);
    }
    nameRows.get(name).push(sheetRow);
    if (!idRows.has(id)) {
      idRows.set(id, []);
    }
    idRows.get(id).push(sheetRow);
    byName.set(name, {
      student_id: id,
      student_name: name,
      grade
    });
    rosterCount += 1;
  }

  const duplicateNameRows = [];
  for (const rows of nameRows.values()) {
    if (rows.length > 1) {
      duplicateNameRows.push(...rows);
    }
  }
  if (duplicateNameRows.length) {
    throw coded(
      "duplicate_roster_name",
      `duplicate roster names at rows ${duplicateNameRows.join(", ")}`
    );
  }

  const duplicateIdRows = [];
  for (const rows of idRows.values()) {
    if (rows.length > 1) {
      duplicateIdRows.push(...rows);
    }
  }
  if (duplicateIdRows.length) {
    throw coded(
      "duplicate_roster_id",
      `duplicate student_id at rows ${duplicateIdRows.join(", ")}`
    );
  }

  return { byName, rosterCount };
}

function buildDatasetFromValues({ responseValues, rosterValues, questionConfig, scaleMax }) {
  const roster = buildRoster(rosterValues);
  const { scores, texts } = questionKeys(questionConfig);
  if (!responseValues.length) {
    throw coded("empty_responses", "response sheet is empty");
  }
  const index = headerIndex(responseValues[0]);
  if (!index.has("timestamp") || !index.has("student_name")) {
    throw coded("response_header", "response sheet is missing timestamp or student_name");
  }
  const missingHeaders = ["grade", ...scores, ...texts].filter((key) => !index.has(key));
  const unmatchedRows = [];
  const candidates = [];
  let responseCount = 0;

  for (let i = 1; i < responseValues.length; i++) {
    const row = responseValues[i] || [];
    if (isBlankRow(row)) {
      continue;
    }
    responseCount += 1;
    const sheetRow = i + 1;
    const name = String(cell(row, index, "student_name")).trim();
    const person = roster.byName.get(name);
    if (!person) {
      unmatchedRows.push(sheetRow);
      continue;
    }
    const ms = timestampMillis(cell(row, index, "timestamp"));
    if (ms === null) {
      throw coded("response_timestamp", `response row ${sheetRow} has no timestamp`);
    }
    const record = {
      timestamp: formatTimestamp(ms),
      student_name: person.student_name,
      student_id: person.student_id,
      grade: parseText(cell(row, index, "grade")) || person.grade,
      year_month: yearMonthFromMillis(ms),
      _ms: ms,
      _sheetRow: sheetRow
    };
    for (const key of scores) {
      record[key] = parseScore(cell(row, index, key), scaleMax);
    }
    for (const key of texts) {
      record[key] = parseText(cell(row, index, key));
    }
    candidates.push(record);
  }

  const best = new Map();
  let droppedDuplicates = 0;
  for (const record of candidates) {
    const key = `${record.student_id}:${record.year_month}`;
    const current = best.get(key);
    if (
      !current ||
      record._ms > current._ms ||
      (record._ms === current._ms && record._sheetRow > current._sheetRow)
    ) {
      if (current) {
        droppedDuplicates += 1;
      }
      best.set(key, record);
    } else {
      droppedDuplicates += 1;
    }
  }

  const responses = Array.from(best.values()).map((record) => {
    const copy = { ...record };
    delete copy._ms;
    delete copy._sheetRow;
    return copy;
  });
  if (!responses.length) {
    const error = coded("no_matched_responses", "no response rows matched the roster");
    error.unmatchedRows = unmatchedRows;
    throw error;
  }

  const months = Array.from(new Set(responses.map((row) => row.year_month))).sort();
  return {
    months,
    responses,
    stats: {
      rosterCount: roster.rosterCount,
      responseCount,
      matchedCount: candidates.length,
      keptCount: responses.length,
      unmatchedCount: unmatchedRows.length,
      unmatchedRows,
      droppedDuplicates,
      missingHeaders,
      months
    }
  };
}

function requireLiveConfig(options) {
  const missing = [];
  if (!options.spreadsheetId) {
    missing.push("GOOGLE_SHEETS_SPREADSHEET_ID");
  }
  if (!options.keyFile) {
    missing.push("GOOGLE_APPLICATION_CREDENTIALS");
  }
  if (!options.responsesSheet) {
    missing.push("RESPONSES_SHEET_NAME");
  }
  if (!options.rosterSheet) {
    missing.push("ROSTER_SHEET_NAME");
  }
  if (missing.length) {
    throw coded("sheet_unavailable", `missing ${missing.join(", ")}`);
  }
}

async function loadLiveDataset(options) {
  requireLiveConfig(options);
  const read = options.fetchValues || fetchSheetValues;
  const [responseValues, rosterValues] = await Promise.all([
    read(options.spreadsheetId, sheetRange(options.responsesSheet, "A:AZ"), options.keyFile),
    read(options.spreadsheetId, sheetRange(options.rosterSheet, "A:Z"), options.keyFile)
  ]);
  return buildDatasetFromValues({
    responseValues,
    rosterValues,
    questionConfig: options.questionConfig,
    scaleMax: options.scaleMax
  });
}

function formatLoadStats(stats) {
  const lines = [
    `roster=${stats.rosterCount} responses=${stats.responseCount} matched=${stats.matchedCount} kept=${stats.keptCount} unmatched=${stats.unmatchedCount} months=${stats.months.join(",")}`
  ];
  if (stats.droppedDuplicates) {
    lines.push(`older responses in the same month: ${stats.droppedDuplicates}`);
  }
  if (stats.unmatchedRows.length) {
    lines.push(`unmatched response rows: ${stats.unmatchedRows.join(", ")}`);
  }
  if (stats.missingHeaders.length) {
    lines.push(`missing headers: ${stats.missingHeaders.join(", ")}`);
  }
  return lines.join("\n");
}

module.exports = {
  buildDatasetFromValues,
  loadLiveDataset,
  formatLoadStats,
  timestampMillis
};
