/**
 * Mosir Zagros - buyer inquiry intake
 * Deploy as a Google Apps Script web app after setting SPREADSHEET_ID.
 * Public endpoint: validate inputs and keep a honeypot field to reduce spam.
 */

const SPREADSHEET_ID = "PASTE_GOOGLE_SHEET_ID_HERE";
const SHEET_NAME = "Buyer Inquiries";

const HEADERS = [
  "Received At", "Language", "Full Name", "Company", "Country / City",
  "Phone / WhatsApp", "Required Quantity", "Packaging", "Destination",
  "Payment Terms", "Additional Details", "Status", "Follow-up Date",
  "Source", "Website Honeypot"
];

function setupSheet() {
  if (!SPREADSHEET_ID || SPREADSHEET_ID === "PASTE_GOOGLE_SHEET_ID_HERE") {
    throw new Error("ابتدا شناسه Google Sheet را در SPREADSHEET_ID قرار دهید.");
  }
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = ss.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, HEADERS.length).setValues([HEADERS]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.autoResizeColumns(1, HEADERS.length);
  }
  return "Sheet is ready";
}

function doPost(e) {
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return jsonResponse({ ok: false, error: "empty_request" });
    }

    const data = JSON.parse(e.postData.contents);
    // Bots often fill hidden website fields. Silently accept but do not store.
    if (String(data.website || "").trim() !== "") {
      return jsonResponse({ ok: true });
    }

    const required = ["name", "country", "phone", "quantity"];
    for (const key of required) {
      if (!String(data[key] || "").trim()) {
        return jsonResponse({ ok: false, error: "missing_" + key });
      }
    }

    const clean = key => String(data[key] || "").trim().slice(0, 1500);
    const phone = clean("phone");
    if (phone.length < 5 || phone.length > 40) {
      return jsonResponse({ ok: false, error: "invalid_phone" });
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(SHEET_NAME);
    if (!sheet) throw new Error("Run setupSheet() before deployment.");

    const lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      sheet.appendRow([
        new Date(),
        clean("language"),
        clean("name"),
        clean("company"),
        clean("country"),
        phone,
        clean("quantity"),
        clean("pack"),
        clean("destination"),
        clean("payment"),
        clean("details"),
        "New",
        "",
        clean("source") || "Website",
        ""
      ]);
    } finally {
      lock.releaseLock();
    }

    return jsonResponse({ ok: true });
  } catch (err) {
    return jsonResponse({ ok: false, error: "server_error" });
  }
}

function jsonResponse(value) {
  return ContentService
    .createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
