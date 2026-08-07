// ==========================================
// Sync Supabase -> Google Sheets ทุก 5 นาที (เฉพาะตอนข้อมูลเปลี่ยนจริง)
// ==========================================
//
// ต้องมี 10_SupabaseSync.gs (sync-to-sheets.gs) อยู่ในโปรเจกต์เดียวกันก่อน
// ไฟล์นี้เรียก syncSupabaseToSheets() ต่อ ไม่ได้เขียนชีตเอง
//
// วิธีติดตั้ง
// 1. สร้างไฟล์ใหม่ชื่อ 12_SyncEvery5Min.gs แล้ววางไฟล์นี้
// 2. รัน installFiveMinuteSyncTrigger หนึ่งครั้ง
// 3. ถ้าจะเลิกใช้ ให้รัน removeFiveMinuteSyncTrigger
//
// ทำไมไม่ใช้ Database Webhook ยิงตรง:
// Apps Script Web App ที่รับ webhook ต้องเปิดเป็น "Anyone" = endpoint สาธารณะ
// ต้องดูแล token เอง และการสแกนรัวจะยิงถี่จนชน quota ของ Sheets
// วิธีนี้ให้ผลเท่ากันในสายตาผู้ใช้ (ช้าสุด 5 นาที) โดยไม่ต้องเปิด endpoint ใหม่
//
// กันงานซ้อน: ถ้ารอบก่อนยังไม่จบ รอบใหม่จะข้ามไปเลย ไม่ต่อคิว

const SYNC_STATE_KEY = "SUPABASE_SYNC_FINGERPRINT";
const SYNC_LOCK_TIMEOUT_MS = 1000;

// ตารางที่เฝ้าดู กับคอลัมน์เวลาที่บอกว่าแถวถูกแตะล่าสุดเมื่อไหร่
// unregistered_assets ดู reviewed_at ด้วย เพราะการ approve ไม่ได้สร้างแถวใหม่
const SYNC_WATCH = [
  { table: "assets", columns: ["updated_at"] },
  { table: "counts", columns: ["counted_at"] },
  { table: "scan_logs", columns: ["created_at"] },
  { table: "unregistered_assets", columns: ["created_at", "reviewed_at"] }
];

// อ่านค่าล่าสุดของคอลัมน์เวลา 1 คอลัมน์ (แถวเดียว)
function syncLatestValue_(table, column) {
  const cfg = syncConfig_();
  const endpoint = cfg.url + "/rest/v1/" + table +
    "?select=" + column +
    "&" + column + "=not.is.null" +
    "&order=" + column + ".desc&limit=1";
  const response = UrlFetchApp.fetch(endpoint, {
    method: "get",
    headers: { apikey: cfg.key, Authorization: "Bearer " + cfg.key },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() >= 300) {
    throw new Error("อ่าน " + table + "." + column + " ล้มเหลว " +
      response.getResponseCode() + ": " + response.getContentText().slice(0, 300));
  }
  const rows = JSON.parse(response.getContentText());
  return rows.length ? String(rows[0][column] || "") : "";
}

// นับจำนวนแถวผ่าน Content-Range เพื่อให้จับ "การลบแถว" ได้ด้วย
// เวลาล่าสุดอย่างเดียวไม่พอ เพราะลบแถวเก่าแล้วเวลาล่าสุดไม่ขยับ
function syncRowCount_(table) {
  const cfg = syncConfig_();
  const response = UrlFetchApp.fetch(cfg.url + "/rest/v1/" + table + "?select=*&limit=1", {
    method: "get",
    headers: {
      apikey: cfg.key,
      Authorization: "Bearer " + cfg.key,
      Prefer: "count=exact",
      Range: "0-0"
    },
    muteHttpExceptions: true
  });
  if (response.getResponseCode() >= 300) {
    throw new Error("นับแถว " + table + " ล้มเหลว " + response.getResponseCode());
  }
  const range = response.getHeaders()["content-range"] || response.getHeaders()["Content-Range"] || "";
  const total = String(range).split("/")[1];
  return total || "?";
}

// ลายนิ้วมือของข้อมูลทั้งชุด เปลี่ยนเมื่อไหร่แปลว่ามีของใหม่ต้อง sync
function syncFingerprint_() {
  return SYNC_WATCH.map(function (watch) {
    const parts = watch.columns.map(function (column) {
      return syncLatestValue_(watch.table, column);
    });
    parts.push(syncRowCount_(watch.table));
    return watch.table + "=" + parts.join("|");
  }).join(";");
}

function syncSupabaseToSheetsIfChanged() {
  const lock = LockService.getScriptLock();
  if (!lock.tryLock(SYNC_LOCK_TIMEOUT_MS)) {
    Logger.log("รอบก่อนยังทำงานอยู่ ข้ามรอบนี้");
    return { skipped: "locked" };
  }

  try {
    const props = PropertiesService.getScriptProperties();
    const current = syncFingerprint_();
    const previous = props.getProperty(SYNC_STATE_KEY);

    if (previous === current) {
      Logger.log("ข้อมูลไม่เปลี่ยน ข้าม sync");
      return { skipped: "unchanged" };
    }

    const result = syncSupabaseToSheets();

    // เก็บลายนิ้วมือหลัง sync สำเร็จเท่านั้น
    // ถ้า sync พังแล้วเก็บไว้ก่อน รอบถัดไปจะนึกว่าไม่มีอะไรเปลี่ยนแล้วข้ามถาวร
    props.setProperty(SYNC_STATE_KEY, current);
    Logger.log("sync แล้ว: %s", JSON.stringify(result));
    return result;
  } finally {
    lock.releaseLock();
  }
}

function installFiveMinuteSyncTrigger() {
  removeFiveMinuteSyncTrigger();
  ScriptApp.newTrigger("syncSupabaseToSheetsIfChanged")
    .timeBased()
    .everyMinutes(5)
    .create();
  Logger.log("ติดตั้ง trigger ทุก 5 นาทีแล้ว");
}

function removeFiveMinuteSyncTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "syncSupabaseToSheetsIfChanged") {
      ScriptApp.deleteTrigger(trigger);
    }
  });
}

// บังคับให้รอบถัดไป sync แน่นอน ใช้ตอนแก้ชีตมือแล้วอยากดึงของจริงกลับมาทับ
function forceNextSync() {
  PropertiesService.getScriptProperties().deleteProperty(SYNC_STATE_KEY);
  Logger.log("ล้างลายนิ้วมือแล้ว รอบถัดไปจะ sync แน่นอน");
}
