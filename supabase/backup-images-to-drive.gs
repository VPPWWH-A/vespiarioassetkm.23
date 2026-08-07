// สำรองรูปจาก Supabase Storage -> Google Drive
// Supabase เป็นที่อยู่หลักของรูป ส่วน Google Drive เป็นสำเนาสำรองเท่านั้น
// วางไฟล์นี้ใน Apps Script เป็น 11_BackupImages.gs

const IMAGE_BACKUP_PAGE_SIZE = 500;

function imageBackupConfig_() {
  const props = PropertiesService.getScriptProperties();
  const url = props.getProperty("SUPABASE_URL");
  const key = props.getProperty("SUPABASE_SERVICE_KEY");
  if (!url || !key) throw new Error("ยังไม่ได้ตั้ง SUPABASE_URL หรือ SUPABASE_SERVICE_KEY ใน Script Properties");
  if (typeof CONFIG === "undefined" || !CONFIG.DRIVE_FOLDER_ID) throw new Error("ไม่พบ CONFIG.DRIVE_FOLDER_ID");
  return { url: url.replace(/\/+$/, ""), key: key, folderId: CONFIG.DRIVE_FOLDER_ID };
}

function imageBackupGetAssets_() {
  const cfg = imageBackupConfig_();
  const rows = [];
  for (let offset = 0; ; offset += IMAGE_BACKUP_PAGE_SIZE) {
    const endpoint = cfg.url + "/rest/v1/assets?select=asset_no,image_url&image_url=not.is.null&limit=" + IMAGE_BACKUP_PAGE_SIZE + "&offset=" + offset;
    const response = UrlFetchApp.fetch(endpoint, {
      method: "get",
      headers: { apikey: cfg.key, Authorization: "Bearer " + cfg.key },
      muteHttpExceptions: true
    });
    if (response.getResponseCode() >= 300) throw new Error("อ่านรายการรูปจาก Supabase ไม่สำเร็จ: " + response.getContentText().slice(0, 300));
    const page = JSON.parse(response.getContentText());
    rows.push.apply(rows, page);
    if (page.length < IMAGE_BACKUP_PAGE_SIZE) return rows;
  }
}

function imageBackupFileName_(assetNo, imageUrl) {
  const match = String(imageUrl || "").match(/\.(jpg|jpeg|png|webp)(?:\?|$)/i);
  const extension = match ? match[1].toLowerCase().replace("jpeg", "jpg") : "jpg";
  return String(assetNo || "unknown").replace(/[^A-Za-z0-9_-]/g, "_") + "." + extension;
}

function backupSupabaseImagesToDrive() {
  const cfg = imageBackupConfig_();
  const folder = DriveApp.getFolderById(cfg.folderId);
  const assets = imageBackupGetAssets_();
  let copied = 0, skipped = 0, failed = 0;
  assets.forEach(function (asset) {
    const imageUrl = String(asset.image_url || "").trim();
    if (!imageUrl || imageUrl.indexOf("supabase.co/storage/v1/object/") === -1) return;
    const name = imageBackupFileName_(asset.asset_no, imageUrl);
    if (folder.getFilesByName(name).hasNext()) { skipped++; return; }
    try {
      const response = UrlFetchApp.fetch(imageUrl, { muteHttpExceptions: true });
      if (response.getResponseCode() >= 300) throw new Error("HTTP " + response.getResponseCode());
      folder.createFile(response.getBlob().setName(name));
      copied++;
    } catch (error) {
      failed++;
      Logger.log("สำรองรูปไม่สำเร็จ %s: %s", asset.asset_no, error.message);
    }
  });
  const result = { copied: copied, skipped: skipped, failed: failed };
  Logger.log("=== สำรองรูป Supabase -> Google Drive: %s ===", JSON.stringify(result));
  return result;
}

function installDailyImageBackupTrigger() {
  ScriptApp.getProjectTriggers().forEach(function (trigger) {
    if (trigger.getHandlerFunction() === "backupSupabaseImagesToDrive") ScriptApp.deleteTrigger(trigger);
  });
  ScriptApp.newTrigger("backupSupabaseImagesToDrive").timeBased().everyDays(1).atHour(3).create();
  Logger.log("ติดตั้ง trigger สำรองรูปทุกวันเวลา 03:00-04:00 แล้ว");
}
