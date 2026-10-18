const fs = require("fs");
const { GoogleAuth } = require("google-auth-library");

const READ_SCOPE = "https://www.googleapis.com/auth/spreadsheets.readonly";

function coded(code, message) {
  const error = new Error(message);
  error.code = code;
  return error;
}

function sheetRange(sheetName, cells) {
  const escaped = String(sheetName).replace(/'/g, "''");
  return `'${escaped}'!${cells}`;
}

function sheetError(status) {
  if (status === 403) {
    return coded("sheet_unavailable", "the service account cannot read the spreadsheet");
  }
  if (status === 404) {
    return coded("sheet_unavailable", "the spreadsheet was not found");
  }
  if (status === 400) {
    return coded("sheet_unavailable", "a sheet tab name was not found");
  }
  return coded("sheet_unavailable", "spreadsheet read failed");
}

async function fetchSheetValues(spreadsheetId, range, keyFile) {
  if (!fs.existsSync(keyFile)) {
    throw coded("sheet_unavailable", "credentials file not found");
  }
  const auth = new GoogleAuth({
    keyFile,
    scopes: [READ_SCOPE]
  });
  const client = await auth.getClient();
  const url =
    "https://sheets.googleapis.com/v4/spreadsheets/" +
    encodeURIComponent(spreadsheetId) +
    "/values/" +
    encodeURIComponent(range) +
    "?valueRenderOption=UNFORMATTED_VALUE&dateTimeRenderOption=SERIAL_NUMBER";
  try {
    const res = await client.request({ url });
    return res.data.values || [];
  } catch (err) {
    throw sheetError(err.response && err.response.status);
  }
}

module.exports = {
  fetchSheetValues,
  sheetRange
};
