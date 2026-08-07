// ==========================================
// ตัวย้ายข้อมูลครั้งเดียว: Google Sheets -> Supabase
// ==========================================
//
// วิธีใช้
// 1. เปิดโปรเจกต์ Apps Script เดิม (ตัวที่ผูกกับ Fixed asset Register)
// 2. สร้างไฟล์ใหม่ชื่อ 9_SupabaseImport.gs แล้ววางไฟล์นี้ทั้งหมด
// 3. Project Settings -> Script Properties เพิ่ม 2 ตัว
//      SUPABASE_URL          = https://dbdgiggbwcjchkhgdxxx.supabase.co
//      SUPABASE_SERVICE_KEY  = service_role key (เอาจาก Supabase -> Settings -> API Keys)
// 4. เลือกฟังก์ชัน runFullImport แล้วกด Run ครั้งแรกจะขอสิทธิ์ ให้กดอนุญาต
// 5. ดูผลใน Execution log
//
// service_role key ข้าม RLS ทั้งหมด — เก็บใน Script Properties เท่านั้น
// ห้ามวางลงในโค้ด ห้ามส่งให้ frontend เด็ดขาด
//
// สคริปต์นี้รันซ้ำได้ปลอดภัย (upsert) ยกเว้น importScanLogs ที่จะข้ามให้เองถ้ามีข้อมูลอยู่แล้ว

const IMPORT_BATCH_SIZE = 500;

const THAI_MONTHS = {
  "ม.ค.": "01", "ก.พ.": "02", "มี.ค.": "03", "เม.ย.": "04",
  "พ.ค.": "05", "มิ.ย.": "06", "ก.ค.": "07", "ส.ค.": "08",
  "ก.ย.": "09", "ต.ค.": "10", "พ.ย.": "11", "ธ.ค.": "12"
};

// ========== HTTP helper ==========

function supaConfig_() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty("SUPABASE_URL");
  const key = props.getProperty("SUPABASE_SERVICE_KEY");
  if (!url || !key) {
    throw new Error("ยังไม่ได้ตั้ง SUPABASE_URL หรือ SUPABASE_SERVICE_KEY ใน Script Properties");
  }
  return { url: url.replace(/\/+$/, ""), key: key };
}

function supaPost_(table, rows, onConflict) {
  if (!rows.length) return 0;
  const cfg = supaConfig_();
  let endpoint = cfg.url + "/rest/v1/" + table;
  if (onConflict) endpoint += "?on_conflict=" + encodeURIComponent(onConflict);

  const res = UrlFetchApp.fetch(endpoint, {
    method: "post",
    contentType: "application/json",
    headers: {
      apikey: cfg.key,
      Authorization: "Bearer " + cfg.key,
      Prefer: onConflict ? "resolution=merge-duplicates,return=minimal" : "return=minimal"
    },
    payload: JSON.stringify(rows),
    muteHttpExceptions: true
  });

  const code = res.getResponseCode();
  if (code >= 300) {
    throw new Error("POST " + table + " ล้มเหลว " + code + ": " + res.getContentText().slice(0, 500));
  }
  return rows.length;
}

function supaPostChunked_(table, rows, onConflict) {
  let done = 0;
  for (let i = 0; i < rows.length; i += IMPORT_BATCH_SIZE) {
    done += supaPost_(table, rows.slice(i, i + IMPORT_BATCH_SIZE), onConflict);
    Logger.log("  %s: %s/%s", table, done, rows.length);
  }
  return done;
}

function supaGet_(path) {
  const cfg = supaConfig_();
  const res = UrlFetchApp.fetch(cfg.url + "/rest/v1/" + path, {
    method: "get",
    headers: { apikey: cfg.key, Authorization: "Bearer " + cfg.key },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) {
    throw new Error("GET " + path + " ล้มเหลว: " + res.getContentText().slice(0, 300));
  }
  return JSON.parse(res.getContentText());
}

// ========== แปลงค่า ==========

function toIsoDate_(value) {
  if (!value) return null;
  if (value instanceof Date) return Utilities.formatDate(value, "Asia/Bangkok", "yyyy-MM-dd");
  const text = String(value).trim();
  if (!text) return null;
  const m = text.match(/^(\d{4})[\/\-](\d{1,2})[\/\-](\d{1,2})$/);
  if (m) return m[1] + "-" + ("0" + m[2]).slice(-2) + "-" + ("0" + m[3]).slice(-2);
  const parsed = new Date(text);
  return isNaN(parsed.getTime()) ? null : Utilities.formatDate(parsed, "Asia/Bangkok", "yyyy-MM-dd");
}

function toIsoTimestamp_(value) {
  if (!value) return null;
  const d = (value instanceof Date) ? value : new Date(String(value));
  return isNaN(d.getTime()) ? null : d.toISOString();
}

function cleanText_(value) {
  const text = String(value === null || value === undefined ? "" : value).trim();
  return text === "" ? null : text;
}

// แปลงชื่อคอลัมน์ "เช็ค มิ.ย. 2026 Count 1" -> { period: "2026-06", round: 1 }
// รองรับแบบเก่าที่ไม่มี " Count N" ให้ถือเป็นรอบ 1
function parseCountHeader_(header) {
  const text = String(header || "").trim();
  const m = text.match(/^เช็ค\s+(\S+)\s+(\d{4})(?:\s+Count\s+([12]))?$/);
  if (!m) return null;
  const month = THAI_MONTHS[m[1]];
  if (!month) return null;
  return { period: m[2] + "-" + month, round: m[3] ? Number(m[3]) : 1 };
}

function isCountedCell_(value) {
  const text = String(value || "").trim();
  return text === "Count" || text === "Checked";
}

// ========== 1. ASSETS_MASTER -> assets ==========

function importAssets() {
  const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName("ASSETS_MASTER");
  const data = sheet.getDataRange().getValues();
  const rows = [];
  const seen = {};
  const duplicates = [];

  for (let i = 1; i < data.length; i++) {
    const assetNo = String(data[i][0] || "").trim().toUpperCase();
    if (!assetNo) continue;
    if (seen[assetNo]) { duplicates.push(assetNo); continue; }
    seen[assetNo] = true;

    rows.push({
      asset_no: assetNo,
      asset_name: String(data[i][1] || "").trim(),
      category: cleanText_(data[i][2]),
      area: cleanText_(data[i][3]),
      warehouse: cleanText_(data[i][4]),
      acquisition_date: toIsoDate_(data[i][5]),
      status: cleanText_(data[i][6]),
      remark: cleanText_(data[i][9]),
      image_url: cleanText_(data[i][10])
    });
  }

  if (duplicates.length) {
    Logger.log("!! เจอ Asset No ซ้ำ %s ตัว ข้ามตัวที่ซ้ำ: %s", duplicates.length, duplicates.slice(0, 20).join(", "));
  }

  const n = supaPostChunked_("assets", rows, "asset_no");
  Logger.log("assets: ส่งแล้ว %s แถว", n);
  return n;
}

// ========== 2. คอลัมน์นับ -> count_rounds + counts ==========

function importCounts() {
  const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName("ASSETS_MASTER");
  const data = sheet.getDataRange().getValues();
  const headers = data[0] || [];

  const countCols = [];
  for (let c = 0; c < headers.length; c++) {
    const parsed = parseCountHeader_(headers[c]);
    if (parsed) countCols.push({ index: c, period: parsed.period, round: parsed.round, header: headers[c] });
  }

  if (!countCols.length) {
    Logger.log("counts: ไม่พบคอลัมน์การนับ");
    return 0;
  }
  countCols.forEach(function (c) {
    Logger.log("  พบคอลัมน์ '%s' -> period %s รอบ %s", c.header, c.period, c.round);
  });

  const roundPayload = countCols.map(function (c) {
    return { period: c.period, round: c.round };
  });
  supaPost_("count_rounds", roundPayload, "period,round");

  const existing = supaGet_("count_rounds?select=id,period,round");
  const roundId = {};
  existing.forEach(function (r) { roundId[r.period + "#" + r.round] = r.id; });

  const rows = [];
  for (let i = 1; i < data.length; i++) {
    const assetNo = String(data[i][0] || "").trim().toUpperCase();
    if (!assetNo) continue;
    const lastScan = toIsoTimestamp_(data[i][7]);

    countCols.forEach(function (c) {
      if (!isCountedCell_(data[i][c.index])) return;
      const id = roundId[c.period + "#" + c.round];
      if (!id) return;
      rows.push({
        round_id: id,
        asset_no: assetNo,
        result: String(data[i][c.index]).trim(),
        // ชีตไม่ได้เก็บเวลานับรายรอบ มีแต่ Last Scan รวม
        // ถ้าไม่มีให้ใช้วันที่ 1 ของเดือนนั้นแทน เพื่อไม่ให้ counted_at ว่าง
        counted_at: lastScan || (c.period + "-01T00:00:00+07:00"),
        device: null
      });
    });
  }

  const n = supaPostChunked_("counts", rows, "round_id,asset_no");
  Logger.log("counts: ส่งแล้ว %s แถว", n);
  return n;
}

// ========== 3. SCAN_LOGS -> scan_logs ==========

function importScanLogs() {
  const check = supaGet_("scan_logs?select=id&limit=1");
  if (check.length) {
    Logger.log("scan_logs: มีข้อมูลอยู่แล้ว ข้าม (ตารางนี้ไม่มี unique key รันซ้ำจะได้ข้อมูลซ้ำ)");
    return 0;
  }

  const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName("SCAN_LOGS");
  const data = sheet.getDataRange().getValues();
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    if (!data[i][0] && !data[i][2]) continue;
    rows.push({
      created_at: toIsoTimestamp_(data[i][0]),
      req_id: cleanText_(data[i][1]),
      asset_no: cleanText_(data[i][2]),
      action: cleanText_(data[i][3]),
      status: cleanText_(data[i][4]),
      device: cleanText_(data[i][5]),
      result: cleanText_(data[i][6]),
      duration_ms: Number(data[i][7]) || null
    });
  }

  const n = supaPostChunked_("scan_logs", rows, null);
  Logger.log("scan_logs: ส่งแล้ว %s แถว", n);
  return n;
}

// ========== 4. UNREGISTERED_ASSETS -> unregistered_assets ==========
// ระวังลำดับคอลัมน์: [tempId, assetName, category, warehouse, area, remarks, date, imageUrl, state, status]
// warehouse มาก่อน area สลับกับ ASSETS_MASTER

function importUnregistered() {
  const check = supaGet_("unregistered_assets?select=id&limit=1");
  if (check.length) {
    Logger.log("unregistered_assets: มีข้อมูลอยู่แล้ว ข้าม");
    return 0;
  }

  const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName("UNREGISTERED_ASSETS");
  const data = sheet.getDataRange().getValues();
  const rows = [];

  for (let i = 1; i < data.length; i++) {
    const tempId = String(data[i][0] || "").trim();
    if (!tempId) continue;
    const state = String(data[i][8] || "Pending").trim().toLowerCase();
    rows.push({
      temp_id: tempId,
      asset_name: cleanText_(data[i][1]),
      category: cleanText_(data[i][2]),
      warehouse: cleanText_(data[i][3]),
      area: cleanText_(data[i][4]),
      remark: cleanText_(data[i][5]),
      created_at: toIsoTimestamp_(data[i][6]),
      image_url: cleanText_(data[i][7]),
      review_state: (state === "approved" || state === "rejected") ? state : "pending",
      asset_status: cleanText_(data[i][9])
    });
  }

  const n = supaPostChunked_("unregistered_assets", rows, null);
  Logger.log("unregistered_assets: ส่งแล้ว %s แถว", n);
  return n;
}

// ========== รันทั้งหมด ==========

function runFullImport() {
  const startedAt = Date.now();
  Logger.log("=== เริ่มย้ายข้อมูลเข้า Supabase ===");
  importAssets();
  importCounts();
  importScanLogs();
  importUnregistered();
  Logger.log("=== เสร็จใน %s วินาที ===", Math.round((Date.now() - startedAt) / 1000));
  verifyImport();
}

// ========== ตรวจผลหลังย้าย ==========

function verifyImport() {
  const ss = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID);
  const sheetRows = function (name) {
    const s = ss.getSheetByName(name);
    return s ? Math.max(0, s.getLastRow() - 1) : 0;
  };

  const cfg = supaConfig_();
  const supaCount = function (table) {
    const res = UrlFetchApp.fetch(cfg.url + "/rest/v1/" + table + "?select=*", {
      method: "get",
      headers: {
        apikey: cfg.key,
        Authorization: "Bearer " + cfg.key,
        Range: "0-0",
        Prefer: "count=exact"
      },
      muteHttpExceptions: true
    });
    const range = res.getHeaders()["content-range"] || res.getHeaders()["Content-Range"] || "";
    return range.split("/")[1] || "?";
  };

  Logger.log("--- เทียบจำนวนแถว (ชีต -> Supabase) ---");
  Logger.log("ASSETS_MASTER        %s -> assets              %s", sheetRows("ASSETS_MASTER"), supaCount("assets"));
  Logger.log("SCAN_LOGS            %s -> scan_logs           %s", sheetRows("SCAN_LOGS"), supaCount("scan_logs"));
  Logger.log("UNREGISTERED_ASSETS  %s -> unregistered_assets %s", sheetRows("UNREGISTERED_ASSETS"), supaCount("unregistered_assets"));
  Logger.log("                          -> counts              %s", supaCount("counts"));
  Logger.log("หมายเหตุ: assets อาจน้อยกว่าชีตได้ถ้ามี Asset No ซ้ำ ดูคำเตือนด้านบน");
}
