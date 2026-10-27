/**
 * MentorsMD website -> Google Sheet
 *
 * Copies every Contact message, Waitlist signup and Mentor application
 * from the website into this Google Sheet, one tab per form.
 * Step-by-step setup: docs/google-sheet-setup.md in the MentorsMD code.
 *
 * In short:
 *  1. Paste this whole file into your Google Sheet: Extensions -> Apps Script.
 *  2. Change SECRET below to a long random phrase. Put the SAME phrase in
 *     Vercel as GOOGLE_SHEET_SECRET.
 *  3. Deploy -> New deployment -> type "Web app", Execute as "Me",
 *     Who has access "Anyone". Copy the Web app URL into Vercel as
 *     GOOGLE_SHEET_WEBHOOK_URL.
 *
 * The first time a form is sent, its tab is created with column headings,
 * plus Status, Assigned to and Notes columns for the team to fill in.
 * New fields added later on the website appear as new columns.
 */

var SECRET = "CHANGE-ME-to-the-same-long-phrase-you-put-in-Vercel";
var TEAM_COLUMNS = ["Status", "Assigned to", "Notes"];
var STATUSES = ["New", "Contacted", "In progress", "Done", "Not a fit"];

function doPost(e) {
  var data;
  try {
    data = JSON.parse(e.postData.contents);
  } catch (err) {
    return reply({ ok: false, error: "bad json" });
  }
  if (!data || data.secret !== SECRET) return reply({ ok: false, error: "unauthorized" });

  // One submission at a time, so two at once can't land on the same row.
  var lock = LockService.getScriptLock();
  lock.waitLock(20000);
  try {
    appendRow(String(data.tab || "Submissions").slice(0, 90), data.row || {});
  } finally {
    lock.releaseLock();
  }
  return reply({ ok: true });
}

function appendRow(tabName, row) {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  var sheet = ss.getSheetByName(tabName) || ss.insertSheet(tabName);
  var keys = Object.keys(row);
  var headers;

  if (sheet.getLastRow() === 0) {
    headers = ["Submitted at"].concat(keys).concat(TEAM_COLUMNS);
    sheet.appendRow(headers);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight("bold");
    var statusCol = headers.indexOf("Status") + 1;
    var rule = SpreadsheetApp.newDataValidation().requireValueInList(STATUSES, true).build();
    sheet.getRange(2, statusCol, 1000, 1).setDataValidation(rule);
  } else {
    headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
    // Any new fields become new columns (just before the team columns).
    keys.forEach(function (k) {
      if (headers.indexOf(k) === -1) {
        var at = headers.indexOf("Status");
        if (at === -1) at = headers.length;
        sheet.insertColumnBefore(at + 1);
        sheet.getRange(1, at + 1).setValue(k).setFontWeight("bold");
        headers.splice(at, 0, k);
      }
    });
  }

  var values = headers.map(function (h) {
    if (h === "Submitted at") return new Date();
    if (h === "Status") return "New";
    return row[h] !== undefined ? row[h] : "";
  });
  sheet.appendRow(values);
}

function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
