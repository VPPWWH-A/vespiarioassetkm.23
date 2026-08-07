// ==========================================
// สร้างบัญชี Supabase Auth จากชีต "Approve all"
// ==========================================
//
// ใช้ Script Properties ชุดเดิม (SUPABASE_URL, SUPABASE_SERVICE_KEY)
// วางไฟล์นี้เป็น 10_CreateAuthUsers.gs ในโปรเจกต์ Apps Script เดียวกัน
//
// ลำดับ:
//   1. รัน previewAuthUsers  — ดูว่าจะสร้างอะไรบ้าง ยังไม่แตะ Supabase
//   2. รัน createAuthUsers   — สร้างจริง
//
// รันซ้ำได้ บัญชีที่มีอยู่แล้วจะถูกข้าม ไม่ทับรหัสเดิม

// true  = ใช้รหัสผ่านเดิมจากชีต ผู้ใช้ไม่ต้องจำรหัสใหม่
// false = สุ่มรหัสใหม่ให้ทุกคน แล้วพิมพ์ออกมาใน log ให้แอดมินแจกเอง
const REUSE_SHEET_PASSWORDS = true;

// ชื่อผู้ใช้ที่ไม่ใช่รูปอีเมล จะถูกเติมโดเมนนี้ต่อท้าย
const FALLBACK_EMAIL_DOMAIN = "vespiario.com";

// ผู้ใช้ที่ได้สิทธิ์แอดมิน (ใส่เป็นชื่อตามที่อยู่ในชีต)
const ADMIN_USERNAMES = ["vespaadmin"];

// Supabase บังคับรหัสผ่านอย่างน้อย 6 ตัว ถ้าของเดิมสั้นกว่าจะถูกเติมให้
const MIN_PASSWORD_LENGTH = 6;

function readApproveUsers_() {
  const sheet = SpreadsheetApp.openById(CONFIG.SPREADSHEET_ID).getSheetByName("Approve all");
  if (!sheet) throw new Error("ไม่เจอชีต Approve all");
  const data = sheet.getDataRange().getValues();
  const users = [];

  for (let i = 1; i < data.length; i++) {
    const username = String(data[i][0] || "").trim();
    if (!username) continue;
    const rawPass = String(data[i][1] || "").trim();

    const email = username.indexOf("@") !== -1
      ? username.toLowerCase()
      : (username.toLowerCase() + "@" + FALLBACK_EMAIL_DOMAIN);

    let password;
    if (REUSE_SHEET_PASSWORDS && rawPass) {
      password = rawPass.length >= MIN_PASSWORD_LENGTH ? rawPass : (rawPass + "km23");
    } else {
      password = randomPassword_();
    }

    users.push({
      username: username,
      email: email,
      password: password,
      isAdmin: ADMIN_USERNAMES.indexOf(username) !== -1,
      passwordChanged: REUSE_SHEET_PASSWORDS && rawPass && rawPass.length < MIN_PASSWORD_LENGTH
    });
  }
  return users;
}

function randomPassword_() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  let out = "";
  for (let i = 0; i < 12; i++) {
    out += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return out;
}

// ========== 1. ดูก่อนว่าจะสร้างอะไร (ไม่แตะ Supabase) ==========

function previewAuthUsers() {
  const users = readApproveUsers_();
  Logger.log("จะสร้างทั้งหมด %s บัญชี | ใช้รหัสเดิมจากชีต: %s", users.length, REUSE_SHEET_PASSWORDS);
  users.forEach(function (u, i) {
    Logger.log("%s. %s -> %s%s%s",
      i + 1,
      u.username,
      u.email,
      u.isAdmin ? "  [ADMIN]" : "",
      u.passwordChanged ? "  (รหัสเดิมสั้นเกิน ถูกเติม km23 ต่อท้าย)" : "");
  });
  Logger.log("ยังไม่ได้สร้างอะไร — ถ้าถูกต้องแล้วให้รัน createAuthUsers");
}

// ========== 2. สร้างจริง ==========

function createAuthUsers() {
  const cfg = supaConfig_();
  const users = readApproveUsers_();
  const endpoint = cfg.url + "/auth/v1/admin/users";

  let created = 0, skipped = 0, failed = 0;
  const newPasswords = [];

  users.forEach(function (u) {
    const res = UrlFetchApp.fetch(endpoint, {
      method: "post",
      contentType: "application/json",
      headers: { apikey: cfg.key, Authorization: "Bearer " + cfg.key },
      payload: JSON.stringify({
        email: u.email,
        password: u.password,
        email_confirm: true,
        app_metadata: { role: u.isAdmin ? "admin" : "staff", username: u.username }
      }),
      muteHttpExceptions: true
    });

    const code = res.getResponseCode();
    if (code >= 200 && code < 300) {
      created++;
      if (!REUSE_SHEET_PASSWORDS) newPasswords.push(u.email + "  " + u.password);
      Logger.log("สร้างแล้ว: %s%s", u.email, u.isAdmin ? " [ADMIN]" : "");
    } else if (res.getContentText().indexOf("already been registered") !== -1 || code === 422) {
      skipped++;
      Logger.log("มีอยู่แล้ว ข้าม: %s", u.email);
    } else {
      failed++;
      Logger.log("!! ล้มเหลว %s (%s): %s", u.email, code, res.getContentText().slice(0, 200));
    }
  });

  Logger.log("=== สร้าง %s | ข้าม %s | ล้มเหลว %s ===", created, skipped, failed);

  if (newPasswords.length) {
    Logger.log("--- รหัสผ่านใหม่ แจกให้ผู้ใช้แล้วลบ log นี้ทิ้ง ---");
    newPasswords.forEach(function (line) { Logger.log(line); });
  }
}

// ========== ตรวจผล ==========

function verifyAuthUsers() {
  const cfg = supaConfig_();
  const res = UrlFetchApp.fetch(cfg.url + "/auth/v1/admin/users?per_page=200", {
    method: "get",
    headers: { apikey: cfg.key, Authorization: "Bearer " + cfg.key },
    muteHttpExceptions: true
  });
  if (res.getResponseCode() >= 300) {
    Logger.log("อ่านรายชื่อไม่สำเร็จ: %s", res.getContentText().slice(0, 300));
    return;
  }
  const body = JSON.parse(res.getContentText());
  const list = body.users || [];
  Logger.log("บัญชีใน Supabase Auth: %s", list.length);
  list.forEach(function (u) {
    const role = (u.app_metadata && u.app_metadata.role) || "-";
    Logger.log("  %s  [%s]  ยืนยันอีเมลแล้ว: %s", u.email, role, !!u.email_confirmed_at);
  });
}
