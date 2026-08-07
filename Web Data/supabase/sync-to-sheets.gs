// ==========================================
// ส่งข้อมูลจาก Supabase -> Google Sheets
// ==========================================
//
// วิธีติดตั้ง
// 1. เปิด Apps Script โปรเจกต์เดียวกับระบบเดิม
// 2. สร้างไฟล์ใหม่ชื่อ 10_SupabaseSync.gs แล้ววางไฟล์นี้
// 3. ตั้ง Script Properties:
//      SUPABASE_URL          = https://dbdgiggbwcjchkhgdxxx.supabase.co
//      SUPABASE_SERVICE_KEY  = service_role key จาก Supabase
// 4. ตรวจชื่อ Spreadsheet ID ใน CONFIG ให้ตรงกับไฟล์จริง
// 5. รัน syncSupabaseToSheets ครั้งแรกและอนุญาตสิทธิ์
// 6. ถ้าต้องการให้ทำงานทุกคืน ให้รัน installDailySyncTrigger หนึ่งครั้ง
//
// service_role key ข้าม RLS ได้ ต้องเก็บใน Script Properties เท่านั้น
// สคริปต์นี้เป็นการ sync ทางเดียว: Supabase -> Google Sheets

const SYNC_PAGE_SIZE = 500;
const SYNC_TIMEZONE = "Asia/Bangkok";

function syncConfig_() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty("SUPABASE_URL");
  const key = props.getProperty("SUPABASE_SERVICE_KEY");
  if (!url || !key) {
    throw new Error("ยังไม่ได้ตั้ง SUPABASE_URL หรือ SUPABASE_SERVICE_KEY ใน Script Properties");
  }
  if (typeof CONFIG === "undefined" || !CONFIG.SPREADSHEET_ID) {
    throw new Error("ไม่พบ CONFIG.SPREADSHEET_ID จากไฟล์ config.txt");
  }
  return { url: url.replace(/\/+$/, ""), key: key, spreadsheetId: CONFIG.SPREADSHEET_ID };
}

function syncGetPage_(path, offset) {
  const cfg = syncConfig_();
  const separator = path.indexOf("?") >= 0 ? "&" : "?";
  const endpoint = cfg.url + "/rest/v1/" + path + separator +
    "limit=" + SYNC_PAGE_SIZE + "&offset=" + offset;
  const response = UrlFetchApp.fetch(endpoint, {
    method: "get",
    headers: {
      apikey: cfg.key,
      Authorization: "Bearer " + cfg.key
    },
    muteHttpExceptions: true
  });
  const code = response.getResponseCode();
  if (code >= 300) {
    throw new Error("GET Supabase ล้มเหลว " + code + ": " + response.getContentText().slice(0, 500));
  }
  return JSON.parse(response.getContentText());
}

function syncGetAll_(path) {
  const rows = [];
  for (let offset = 0; ; offset += SYNC_PAGE_SIZE) {
    const page = syncGetPage_(path, offset);
    rows.push.apply(rows, page);
    if (page.length < SYNC_PAGE_SIZE) break;
  }
  return rows;
}

function syncDate_(value) {
  if (!value) return "";
  const date = new Date(value);
  return isNaN(date.getTime()) ? value : date;
}

function syncText_(value) {
  return value === null || value === undefined ? "" : value;
}

function clearAndWrite_(sheet, values) {
  const oldRows = Math.max(sheet.getLastRow(), 1);
  const oldCols = Math.max(sheet.getLastColumn(), values[0] ? values[0].length : 1);
  sheet.getRange(1, 1, oldRows, oldCols).clearContent();
  if (values.length && values[0].length) {
    sheet.getRange(1, 1, values.length, values[0].length).setValues(values);
  }
}

function sheetOrCreate_(ss, name) {
  return ss.getSheetByName(name) || ss.insertSheet(name);
}

// ========== ASSETS_MASTER ==========

function syncAssetsMaster_(ss) {
  const assets = syncGetAll_("assets_with_latest_count?select=asset_no,asset_name,category,area,warehouse,acquisition_date,status,last_scan,last_result,remark,image_url&order=asset_no");
  const rounds = syncGetAll_("count_rounds?select=id,period,round&order=period,round");
  const counts = syncGetAll_("counts?select=round_id,asset_no,result,counted_at");

  const roundById = {};
  const roundColumns = [];
  rounds.forEach(function (round) {
    roundById[String(round.id)] = round;
    roundColumns.push({
      key: String(round.id),
      name: "เช็ค " + syncThaiMonth_(round.period) + " Count " + round.round
    });
  });

  const countByAssetRound = {};
  counts.forEach(function (count) {
    countByAssetRound[String(count.asset_no) + "#" + String(count.round_id)] = count.result || "Count";
  });

  const headers = [
    "Asset No", "Asset Name", "Category", "Area", "Warehouse",
    "Acquisition Date", "Status", "Last Scan", "Last Result", "Remark", "Image URL"
  ];
  roundColumns.forEach(function (column) { headers.push(column.name); });

  const values = [headers];
  assets.forEach(function (asset) {
    const row = [
      syncText_(asset.asset_no), syncText_(asset.asset_name), syncText_(asset.category),
      syncText_(asset.area), syncText_(asset.warehouse), syncDate_(asset.acquisition_date),
      syncText_(asset.status), syncDate_(asset.last_scan), syncText_(asset.last_result),
      syncText_(asset.remark), syncText_(asset.image_url)
    ];
    roundColumns.forEach(function (column) {
      row.push(countByAssetRound[String(asset.asset_no) + "#" + column.key] || "");
    });
    values.push(row);
  });

  clearAndWrite_(sheetOrCreate_(ss, "ASSETS_MASTER"), values);
  Logger.log("ASSETS_MASTER: เขียน %s แถว, %s คอลัมน์", assets.length, headers.length);
  return assets.length;
}

function syncThaiMonth_(period) {
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const match = String(period || "").match(/^(\d{4})-(\d{2})$/);
  if (!match) return period;
  return months[Number(match[2]) - 1] + " " + match[1];
}

// ========== SCAN_LOGS ==========

function syncScanLogs_(ss) {
  const logs = syncGetAll_("scan_logs?select=created_at,req_id,asset_no,action,status,device,result,duration_ms&order=created_at");
  const values = [["Created At", "Request ID", "Asset No", "Action", "Status", "Device", "Result", "Duration (ms)"]];
  logs.forEach(function (log) {
    values.push([
      syncDate_(log.created_at), syncText_(log.req_id), syncText_(log.asset_no),
      syncText_(log.action), syncText_(log.status), syncText_(log.device),
      syncText_(log.result), log.duration_ms === null ? "" : Number(log.duration_ms)
    ]);
  });
  clearAndWrite_(sheetOrCreate_(ss, "SCAN_LOGS"), values);
  Logger.log("SCAN_LOGS: เขียน %s แถว", logs.length);
  return logs.length;
}

// ========== UNREGISTERED_ASSETS ==========

function syncUnregistered_(ss) {
  const rows = syncGetAll_("unregistered_assets?select=temp_id,asset_name,category,warehouse,area,remark,created_at,image_url,review_state,asset_status&order=created_at");
  const values = [["Temp ID", "Asset Name", "Category", "Warehouse", "Area", "Remark", "Created At", "Image URL", "Review State", "Asset Status"]];
  rows.forEach(function (row) {
    values.push([
      syncText_(row.temp_id), syncText_(row.asset_name), syncText_(row.category),
      syncText_(row.warehouse), syncText_(row.area), syncText_(row.remark),
      syncDate_(row.created_at), syncText_(row.image_url), syncText_(row.review_state),
      syncText_(row.asset_status)
    ]);
  });
  clearAndWrite_(sheetOrCreate_(ss, "UNREGISTERED_ASSETS"), values);
  Logger.log("UNREGISTERED_ASSETS: เขียน %s แถว", rows.length);
  return rows.length;
}

// ========== รันทั้งหมด ==========

function syncSupabaseToSheets() {
  const startedAt = Date.now();
  const cfg = syncConfig_();
  const ss = SpreadsheetApp.openById(cfg.spreadsheetId);
  Logger.log("=== เริ่ม sync Supabase -> Google Sheets ===");
  const result = {
    assets: syncAssetsMaster_(ss),
    scanLogs: syncScanLogs_(ss),
    unregistered: syncUnregistered_(ss)
  };
  SpreadsheetApp.flush();
  Logger.log("=== sync เสร็จใน %s วินาที: %s ===", Math.round((Date.now() - startedAt) / 1000), JSON.stringify(result));
  return result;
}

function installDailySyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "syncSupabaseToSheets") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
  ScriptApp.newTrigger("syncSupabaseToSheets")
    .timeBased()
    .everyDays(1)
    .atHour(2)
    .create();
  Logger.log("ติดตั้ง trigger รายวันเวลา 02:00-03:00 ตาม timezone ของโปรเจกต์แล้ว");
}
