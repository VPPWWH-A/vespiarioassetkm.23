if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// ============================================================
// 🔴 ตั้งค่า URL และ Secret Key
// ============================================================
const API_URL    = "https://script.google.com/macros/s/AKfycbzji7bEWa6sauFw1l21Su6GEDkYw7rAiBaiSzdnMuPHanmmW9atThQ0v9C8PsLvuYkxfw/exec";
const API_SECRET = "VESPA2025SECRET"; // รหัสผ่านสำหรับเชื่อมต่อ Backend

// ===== ฟังก์ชัน helper สร้าง URL พร้อม secret key =====
function apiUrl(params) {
  const url = new URL(API_URL);
  url.searchParams.set("key", API_SECRET);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

const DEBUG_LOG_ENABLED = false;

function dbgLog(location, message, data, hypothesisId, runId) {
  if (!DEBUG_LOG_ENABLED) return;
  const entry = { sessionId: '730ebd', location, message, data, timestamp: Date.now(), hypothesisId, runId: runId || 'post-fix' };
  try {
    const k = '__debug_730ebd';
    const arr = JSON.parse(sessionStorage.getItem(k) || '[]');
    arr.push(entry);
    if (arr.length > 80) arr.shift();
    sessionStorage.setItem(k, JSON.stringify(arr));
  } catch (e) {}
}

function isAlreadyCounted(data) {
  if (data.isUnregistered) return false;
  const lr = String(data.lastResult || "").trim();
  return lr === "Count" || lr === "Checked";
}

/** Read-only server lookup: lookup API, or export search if GAS not updated yet. Never uses scan. */
async function fetchAssetLookup(cleanCode, { forceFresh = false } = {}) {
  // Try lookup endpoint with timeout
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const lookupRes = await fetch(apiUrl({ action: "lookup", assetNo: cleanCode, ...(forceFresh ? { nocache: "1" } : {}) }), { signal: controller.signal });
    const lookupData = await lookupRes.json().catch(() => null);
    clearTimeout(timer);
    if (lookupData && lookupData.status === "success") {
      dbgLog('index.html:fetchAssetLookup', 'lookup ok', { cleanCode, found: !!lookupData.found, via: 'lookup' }, 'H1');
      return lookupData;
    }
    const needsExportFallback = !lookupData
      || (lookupData.status === "error" && String(lookupData.message || "").toLowerCase().includes("invalid"));
    if (!needsExportFallback) {
      dbgLog('index.html:fetchAssetLookup', 'lookup failed', { cleanCode, message: lookupData && lookupData.message }, 'H1');
      return lookupData;
    }
  } catch (e) {
    // Lookup timed out or failed, fall through to export
    dbgLog('index.html:fetchAssetLookup', 'lookup timeout', { cleanCode, error: e.message }, 'H1');
  }
  
  // Fallback to export with timeout
  try {
    dbgLog('index.html:fetchAssetLookup', 'export fallback', { cleanCode }, 'H1');
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    const expRes = await fetch(apiUrl({ action: "export", ...(forceFresh ? { nocache: "1" } : {}) }), { signal: controller.signal });
    const exp = await expRes.json().catch(() => null);
    clearTimeout(timer);
    
    if (!exp || exp.status !== "ok" || !Array.isArray(exp.assets)) {
      return { status: "error", message: "ไม่สามารถโหลดข้อมูลจากเซิร์ฟเวอร์ได้" };
    }
    const row = exp.assets.find(r => String(r[0]).trim().toUpperCase() === cleanCode);
    if (!row) {
      const unregRow = (exp.unregAssets || []).find(r => String(r[0]).trim().toUpperCase() === cleanCode);
      if (unregRow) {
        return {
          status: "success", found: true, isUnregistered: true,
          assetNo: unregRow[0], assetName: unregRow[1], category: unregRow[2],
          warehouse: unregRow[3], area: unregRow[4],
          remark: unregRow[5] || "",
          dateAdded: unregRow[6] || "",
          imageUrl: unregRow[7] || "",
          unregStatus: unregRow[8] || "Pending",
          assetStatus: unregRow[9] || ""
        };
      }
      return { status: "success", found: false, assetNo: cleanCode };
    }
    const c1Idx = (exp.headers || []).indexOf(getCurrentCountColName("1"));
    const c2Idx = (exp.headers || []).indexOf(getCurrentCountColName("2"));
    return {
      status: "success", found: true, isUnregistered: false,
      assetNo: row[0], assetName: row[1], category: row[2],
      area: row[3], warehouse: row[4], acquisitionDate: row[5],
      assetStatus: row[6], lastScan: row[7], lastResult: row[8],
      remark: row[9] || "",
      imageUrl: row[10] || "",
      hasCount1: c1Idx !== -1 && (row[c1Idx] === "Count" || row[c1Idx] === "Checked"),
      hasCount2: c2Idx !== -1 && (row[c2Idx] === "Count" || row[c2Idx] === "Checked")
    };
  } catch (e) {
    return { status: "error", message: "❌ หมดเวลากระหว่างค้นหา - ตรวจสอบเครือข่าย" };
  }
}



async function fetchAssetLookupWithTimeout(cleanCode, timeoutMs = 15000) {
  return Promise.race([
    fetchAssetLookup(cleanCode, { forceFresh: true }),
    new Promise(resolve => setTimeout(() => resolve(null), timeoutMs))
  ]).catch(() => null);
}

async function refreshCurrentView() {
  // ล้างแคชข้อมูลในหน้าสแกน เพื่อให้บังคับดึงข้อมูลใหม่
  allAssets = [];
  allUnregAssets = [];
  setResult('');

  if (currentPage === "home") {
    alert("♻️ ล้างแคชและรีเฟรชระบบเรียบร้อยแล้ว");
  } else {
    showLoading("กำลังรีเฟรชระบบ...");
    setTimeout(() => setResult(''), 800);
  }

  if (currentPage === "scan" && html5QrCode && isScanning && !isProcessing) {
    try { await html5QrCode.resume(); } catch (e) {}
  }
  if (currentPage === "handheld") {
    const hhInput = document.getElementById("handheld-input");
    if (hhInput) {
      setHandheldDisplay(HANDHELD_PLACEHOLDER, true);
      hhInput.focus();
    }
  }
}

async function fetchScanStatusWithTimeout(cleanCode, timeoutMs = 10000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(apiUrl({ action: "scanStatus", assetNo: cleanCode }), { signal: controller.signal });
    const data = await res.json().catch(() => null);
    if (data && data.status === "success") return data;
    return null;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function showScanStatusNotice(assetNo, scanStatus) {
  closeHandheldScanPopup();
  const state = String(scanStatus.scanStatus || "").toLowerCase();
  const ref = scanStatus.requestId ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Ref: ${escHtml(scanStatus.requestId)}</div>` : "";
  const timeText = scanStatus.createdAt ? `<div style="font-size:12px;color:var(--text-muted);margin-top:4px;">${escHtml(formatDateTime(scanStatus.createdAt))}</div>` : "";
  const isPending = state === "received" || state === "processing";
  const isFailed = state === "failed";
  const title = isPending ? "ส่งข้อมูลแล้ว รอหลังบ้าน" : (isFailed ? "เคยส่งแล้วแต่ไม่สำเร็จ" : "รหัสนี้เคยนับแล้ว");
  const icon = isPending ? "⏳" : (isFailed ? "⚠️" : "✅");
  const cardClass = isFailed ? "warning" : "success";
  setResult(`
    <div class="result-card ${cardClass}">
      <div style="font-size:36px;margin-bottom:8px;">${icon}</div>
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">${escHtml(title)}</div>
      <div style="font-size:22px;font-weight:800;margin-top:4px;">${escHtml(assetNo)}</div>
      <div style="font-size:13px;color:var(--text-dim);margin-top:4px;">${escHtml(scanStatus.message || scanStatus.action || state)}</div>
      ${ref}
      ${timeText}
    </div>
  `);
}


function getCurrentBaseCountColName() {
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const d = new Date();
  return "เช็ค " + months[d.getMonth()] + " " + d.getFullYear();
}

function getCurrentCountColName(round = "1") {
  return getCurrentBaseCountColName() + " Count " + (String(round) === "2" ? "2" : "1");
}

let html5QrCode = null, isScanning = false, isProcessing = false;
let cachedCameraId = null;
let currentAssetNo = "", allAssets = [], exportHeaders = [];
let allUnregAssets = [], exportUnregHeaders = [];
let currentPage = "home";

