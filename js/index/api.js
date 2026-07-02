if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js')
      .then((registration) => {
        registration.update().catch(() => {});
        return navigator.serviceWorker.ready;
      })
      .then(updateInstallButtonVisibility)
      .catch(() => {});
  });
}

let deferredPwaInstallPrompt = null;

function isWebAppStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || window.navigator.standalone === true;
}

// แสดงปุ่มติดตั้งเสมอ (เว้นแต่ติดตั้งไปแล้ว) แล้วค่อยเลือกวิธี "ติดตั้งยังไง" ตอนกดปุ่ม
// เพราะการเดาว่าเบราว์เซอร์/เวอร์ชันไหน "รองรับ" ล่วงหน้าจาก UA เปราะบางและตกรุ่นง่าย
function updateInstallButtonVisibility() {
  const btn = document.getElementById("pwa-install-btn");
  if (!btn) return;
  btn.classList.toggle("hidden", isWebAppStandalone());
}

window.addEventListener("beforeinstallprompt", (event) => {
  event.preventDefault();
  deferredPwaInstallPrompt = event;
  updateInstallButtonVisibility();
});

window.addEventListener("appinstalled", () => {
  deferredPwaInstallPrompt = null;
  updateInstallButtonVisibility();
});

window.addEventListener("load", updateInstallButtonVisibility);

// ===== ตรวจจับ In-app Browser (LINE / Facebook / Instagram / TikTok / WeChat) =====
// เบราว์เซอร์ในแอปเหล่านี้มักบล็อกทั้งการติดตั้ง PWA และสิทธิ์กล้อง ต้องแนะนำให้เปิดผ่านเบราว์เซอร์หลักก่อน
function detectInAppBrowserName() {
  const ua = window.navigator.userAgent || "";
  if (/FBAN|FBAV/i.test(ua)) return "Facebook";
  if (/Instagram/i.test(ua)) return "Instagram";
  if (/Line\//i.test(ua)) return "LINE";
  if (/MicroMessenger/i.test(ua)) return "WeChat";
  if (/TikTok/i.test(ua)) return "TikTok";
  return null;
}

function detectPlatformInfo() {
  const ua = window.navigator.userAgent || "";
  const isIOS = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isAndroid = /android/i.test(ua);
  const isChromeIOS = /crios/i.test(ua);
  const isFirefoxIOS = /fxios/i.test(ua);
  const isSamsung = /samsungbrowser/i.test(ua);
  return { isIOS, isAndroid, isChromeIOS, isFirefoxIOS, isSamsung };
}

function getInstallGuideContent() {
  const inAppName = detectInAppBrowserName();
  if (inAppName) {
    return {
      subtitle: `\u0E01\u0E33\u0E25\u0E31\u0E07\u0E40\u0E1B\u0E34\u0E14\u0E1C\u0E48\u0E32\u0E19\u0E41\u0E2D\u0E1B ${inAppName}`,
      steps: [
        `\u0E41\u0E15\u0E30\u0E40\u0E21\u0E19\u0E39 "..." \u0E2B\u0E23\u0E37\u0E2D\u0E44\u0E2D\u0E04\u0E2D\u0E19\u0E21\u0E38\u0E21\u0E02\u0E27\u0E32\u0E1A\u0E19\u0E02\u0E2D\u0E07\u0E2B\u0E19\u0E49\u0E32\u0E08\u0E2D`,
        `\u0E40\u0E25\u0E37\u0E2D\u0E01 "\u0E40\u0E1B\u0E34\u0E14\u0E43\u0E19\u0E40\u0E1A\u0E23\u0E32\u0E27\u0E4C\u0E40\u0E0B\u0E2D\u0E23\u0E4C" \u0E2B\u0E23\u0E37\u0E2D "\u0E40\u0E1B\u0E34\u0E14\u0E14\u0E49\u0E27\u0E22 Chrome/Safari"`,
        `\u0E40\u0E21\u0E37\u0E48\u0E2D\u0E40\u0E1B\u0E34\u0E14\u0E1C\u0E48\u0E32\u0E19\u0E40\u0E1A\u0E23\u0E32\u0E27\u0E4C\u0E40\u0E0B\u0E2D\u0E23\u0E4C\u0E2B\u0E25\u0E31\u0E01\u0E41\u0E25\u0E49\u0E27 \u0E43\u0E2B\u0E49\u0E01\u0E25\u0E31\u0E1A\u0E21\u0E32\u0E01\u0E14\u0E1B\u0E38\u0E48\u0E21 "\u0E15\u0E34\u0E14\u0E15\u0E31\u0E49\u0E07\u0E41\u0E2D\u0E1B" \u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07`
      ]
    };
  }

  const p = detectPlatformInfo();
  if (p.isIOS) {
    if (p.isChromeIOS || p.isFirefoxIOS) {
      return {
        subtitle: "\u0E41\u0E19\u0E30\u0E19\u0E33\u0E43\u0E2B\u0E49\u0E40\u0E1B\u0E34\u0E14\u0E1C\u0E48\u0E32\u0E19 Safari \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E15\u0E34\u0E14\u0E15\u0E31\u0E49\u0E07\u0E41\u0E2D\u0E1B",
        steps: [
          `\u0E40\u0E1A\u0E23\u0E32\u0E27\u0E4C\u0E40\u0E0B\u0E2D\u0E23\u0E4C\u0E19\u0E35\u0E49\u0E15\u0E34\u0E14\u0E15\u0E31\u0E49\u0E07\u0E41\u0E2D\u0E1B\u0E42\u0E14\u0E22\u0E15\u0E23\u0E07\u0E44\u0E21\u0E48\u0E44\u0E14\u0E49\u0E1A\u0E19 iOS \u0E43\u0E2B\u0E49\u0E04\u0E31\u0E14\u0E25\u0E2D\u0E01\u0E25\u0E34\u0E07\u0E01\u0E4C\u0E41\u0E25\u0E49\u0E27\u0E40\u0E1B\u0E34\u0E14\u0E14\u0E49\u0E27\u0E22 Safari`,
          `\u0E41\u0E15\u0E30\u0E1B\u0E38\u0E48\u0E21\u0E41\u0E0A\u0E23\u0E4C\u0E17\u0E35\u0E48\u0E41\u0E16\u0E1A\u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E02\u0E2D\u0E07 Safari`,
          `\u0E40\u0E25\u0E37\u0E2D\u0E01 "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E44\u0E1B\u0E17\u0E35\u0E48\u0E2B\u0E19\u0E49\u0E32\u0E08\u0E2D\u0E42\u0E2E\u0E21" \u0E41\u0E25\u0E49\u0E27\u0E41\u0E15\u0E30 "\u0E40\u0E1E\u0E34\u0E48\u0E21"`
        ]
      };
    }
    return {
      subtitle: "\u0E15\u0E34\u0E14\u0E15\u0E31\u0E49\u0E07\u0E1C\u0E48\u0E32\u0E19 Safari (iOS / iPadOS)",
      steps: [
        `\u0E41\u0E15\u0E30\u0E1B\u0E38\u0E48\u0E21\u0E41\u0E0A\u0E23\u0E4C\u0E17\u0E35\u0E48\u0E41\u0E16\u0E1A\u0E14\u0E49\u0E32\u0E19\u0E25\u0E48\u0E32\u0E07\u0E02\u0E2D\u0E07 Safari \u0E1A\u0E19 iPad \u0E2D\u0E32\u0E08\u0E2D\u0E22\u0E39\u0E48\u0E41\u0E16\u0E1A\u0E14\u0E49\u0E32\u0E19\u0E1A\u0E19`,
        `\u0E40\u0E25\u0E37\u0E48\u0E2D\u0E19\u0E2B\u0E32\u0E41\u0E25\u0E30\u0E41\u0E15\u0E30 "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E44\u0E1B\u0E17\u0E35\u0E48\u0E2B\u0E19\u0E49\u0E32\u0E08\u0E2D\u0E42\u0E2E\u0E21"`,
        `\u0E41\u0E15\u0E30 "\u0E40\u0E1E\u0E34\u0E48\u0E21" \u0E17\u0E35\u0E48\u0E21\u0E38\u0E21\u0E02\u0E27\u0E32\u0E1A\u0E19\u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19`
      ]
    };
  }

  if (p.isAndroid) {
    return {
      subtitle: p.isSamsung ? "\u0E15\u0E34\u0E14\u0E15\u0E31\u0E49\u0E07\u0E1C\u0E48\u0E32\u0E19 Samsung Internet" : "\u0E15\u0E34\u0E14\u0E15\u0E31\u0E49\u0E07\u0E1C\u0E48\u0E32\u0E19 Chrome \u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E1A\u0E23\u0E32\u0E27\u0E4C\u0E40\u0E0B\u0E2D\u0E23\u0E4C Android",
      steps: [
        `\u0E41\u0E15\u0E30\u0E40\u0E21\u0E19\u0E39 "\u22EE" \u0E21\u0E38\u0E21\u0E02\u0E27\u0E32\u0E1A\u0E19\u0E02\u0E2D\u0E07\u0E40\u0E1A\u0E23\u0E32\u0E27\u0E4C\u0E40\u0E0B\u0E2D\u0E23\u0E4C`,
        `\u0E40\u0E25\u0E37\u0E2D\u0E01 "\u0E15\u0E34\u0E14\u0E15\u0E31\u0E49\u0E07\u0E41\u0E2D\u0E1B" \u0E2B\u0E23\u0E37\u0E2D "\u0E40\u0E1E\u0E34\u0E48\u0E21\u0E44\u0E1B\u0E22\u0E31\u0E07\u0E2B\u0E19\u0E49\u0E32\u0E08\u0E2D\u0E42\u0E2E\u0E21"`,
        `\u0E22\u0E37\u0E19\u0E22\u0E31\u0E19\u0E01\u0E32\u0E23\u0E15\u0E34\u0E14\u0E15\u0E31\u0E49\u0E07\u0E2D\u0E35\u0E01\u0E04\u0E23\u0E31\u0E49\u0E07\u0E43\u0E19\u0E2B\u0E19\u0E49\u0E32\u0E15\u0E48\u0E32\u0E07\u0E17\u0E35\u0E48\u0E02\u0E36\u0E49\u0E19\u0E21\u0E32`
      ]
    };
  }

  return {
    subtitle: "\u0E15\u0E34\u0E14\u0E15\u0E31\u0E49\u0E07\u0E1C\u0E48\u0E32\u0E19\u0E04\u0E2D\u0E21\u0E1E\u0E34\u0E27\u0E40\u0E15\u0E2D\u0E23\u0E4C",
    steps: [
      `\u0E21\u0E2D\u0E07\u0E2B\u0E32\u0E44\u0E2D\u0E04\u0E2D\u0E19\u0E15\u0E34\u0E14\u0E15\u0E31\u0E49\u0E07\u0E17\u0E35\u0E48\u0E14\u0E49\u0E32\u0E19\u0E02\u0E27\u0E32\u0E02\u0E2D\u0E07\u0E0A\u0E48\u0E2D\u0E07 URL \u0E43\u0E19 Chrome \u0E2B\u0E23\u0E37\u0E2D Edge`,
      `\u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E1B\u0E34\u0E14\u0E40\u0E21\u0E19\u0E39 "\u22EE" \u0E02\u0E2D\u0E07\u0E40\u0E1A\u0E23\u0E32\u0E27\u0E4C\u0E40\u0E0B\u0E2D\u0E23\u0E4C \u0E41\u0E25\u0E49\u0E27\u0E40\u0E25\u0E37\u0E2D\u0E01 "\u0E15\u0E34\u0E14\u0E15\u0E31\u0E49\u0E07..."`,
      `\u0E16\u0E49\u0E32\u0E43\u0E0A\u0E49 Safari \u0E2B\u0E23\u0E37\u0E2D Firefox \u0E1A\u0E19\u0E04\u0E2D\u0E21\u0E1E\u0E34\u0E27\u0E40\u0E15\u0E2D\u0E23\u0E4C \u0E41\u0E19\u0E30\u0E19\u0E33\u0E43\u0E2B\u0E49\u0E43\u0E0A\u0E49\u0E07\u0E32\u0E19\u0E1C\u0E48\u0E32\u0E19\u0E40\u0E27\u0E47\u0E1A\u0E15\u0E32\u0E21\u0E1B\u0E01\u0E15\u0E34 \u0E2B\u0E23\u0E37\u0E2D\u0E40\u0E1B\u0E25\u0E35\u0E48\u0E22\u0E19\u0E44\u0E1B\u0E43\u0E0A\u0E49 Chrome/Edge \u0E40\u0E1E\u0E37\u0E48\u0E2D\u0E15\u0E34\u0E14\u0E15\u0E31\u0E49\u0E07`
    ]
  };
}

function openInstallGuideModal() {
  const { subtitle, steps } = getInstallGuideContent();
  const subtitleEl = document.getElementById("install-guide-subtitle");
  const stepsEl = document.getElementById("install-guide-steps");
  if (subtitleEl) subtitleEl.textContent = subtitle;
  if (stepsEl) stepsEl.innerHTML = steps.map(step => `<li>${step}</li>`).join("");
  const modal = document.getElementById("modal-install-guide");
  if (modal) modal.classList.remove("hidden");
}

function closeInstallGuideModal() {
  const modal = document.getElementById("modal-install-guide");
  if (modal) modal.classList.add("hidden");
}

async function installWebApp() {
  if (isWebAppStandalone()) {
    alert("\u0E41\u0E2D\u0E1B\u0E16\u0E39\u0E01\u0E15\u0E34\u0E14\u0E15\u0E31\u0E49\u0E07\u0E44\u0E27\u0E49\u0E41\u0E25\u0E49\u0E27");
    updateInstallButtonVisibility();
    return;
  }

  // เบราว์เซอร์ที่รองรับ beforeinstallprompt (Chrome/Edge/Samsung Internet ที่ตรงเงื่อนไข) ใช้ native prompt ได้เลย
  if (deferredPwaInstallPrompt) {
    const promptEvent = deferredPwaInstallPrompt;
    deferredPwaInstallPrompt = null;
    promptEvent.prompt();
    try {
      await promptEvent.userChoice;
    } finally {
      updateInstallButtonVisibility();
    }
    return;
  }

  // ทุกกรณีอื่น (iOS ทุกเบราว์เซอร์, Firefox, Desktop Safari, in-app browser, หรือ native prompt ยังไม่ยิง)
  // ใช้ modal แนะนำขั้นตอนตามอุปกรณ์/เบราว์เซอร์ที่ตรวจพบแทน เพื่อให้ใช้ได้ทั้งรุ่นเก่าและใหม่
  openInstallGuideModal();
}

// ============================================================
// ============================================================
// ตั้งค่า URL เรียก Cloudflare Worker (proxy ที่ซ่อน secret key จริงไว้ฝั่ง server)
// ============================================================
// เว็บนี้เรียกผ่าน Cloudflare Worker proxy แทนการยิง Apps Script ตรงๆ
// secret key จริงถูกแปะโดย Worker ฝั่ง server เท่านั้น ไม่ฝังใน frontend อีกต่อไป
// (ดู cloudflare-worker/proxy.js สำหรับโค้ด proxy และวิธี deploy)
const API_URL = "https://asset-proxy.YOUR-SUBDOMAIN.workers.dev"; // TODO: แทนด้วย URL ของ Worker หลัง deploy

// ===== ฟังก์ชัน helper สร้าง URL เรียก Worker =====
function apiUrl(params) {
  const url = new URL(API_URL);
  const currentUser = getCurrentUser();
  if (currentUser) url.searchParams.set("user", currentUser);
  for (const [k, v] of Object.entries(params)) {
    url.searchParams.set(k, v);
  }
  return url.toString();
}

// ============================================================
// ===== ระบบ Login / Session (เก็บ session ไว้ในเครื่อง หมดอายุอัตโนมัติ) =====
// ============================================================
const AUTH_SESSION_KEY = "vespaAssetSession";
const SESSION_MAX_AGE_MS = 12 * 60 * 60 * 1000; // 12 ชั่วโมง

function getSession() {
  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw);
    if (!session || !session.user || !session.loginAt) return null;
    if (Date.now() - session.loginAt > SESSION_MAX_AGE_MS) {
      localStorage.removeItem(AUTH_SESSION_KEY);
      return null;
    }
    return session;
  } catch (e) {
    return null;
  }
}

function setSession(user) {
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify({ user, loginAt: Date.now() }));
}

function clearSession() {
  localStorage.removeItem(AUTH_SESSION_KEY);
}

function getCurrentUser() {
  const session = getSession();
  return session ? session.user : "";
}

// เรียก backend เพื่อตรวจสอบ user/pass กับชีต "Approve all"
async function loginUser(username, password) {
  const url = new URL(API_URL);
  url.searchParams.set("action", "login");
  url.searchParams.set("user", username);
  url.searchParams.set("pass", password);

  const res = await fetch(url.toString());
  const data = await res.json().catch(() => null);
  if (data && data.status === "success") {
    setSession(username);
    return { ok: true };
  }
  return { ok: false, message: (data && data.message) || "เข้าสู่ระบบไม่สำเร็จ" };
}

function logoutUser() {
  clearSession();
  window.location.reload();
}

const DEBUG_LOG_ENABLED = false;
const API_PERF_LOG_KEY = "__assetApiPerfLog";
const API_SLOW_MS = 2500;

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

function nowMs() {
  return typeof performance !== "undefined" && performance.now ? performance.now() : Date.now();
}

function readApiPerfLog() {
  try {
    return JSON.parse(sessionStorage.getItem(API_PERF_LOG_KEY) || "[]");
  } catch (_) {
    return [];
  }
}

function recordApiPerf(action, durationMs, meta = {}) {
  const entry = {
    action,
    durationMs: Math.round(durationMs),
    at: new Date().toISOString(),
    ...meta
  };

  try {
    const log = readApiPerfLog();
    log.push(entry);
    sessionStorage.setItem(API_PERF_LOG_KEY, JSON.stringify(log.slice(-80)));
  } catch (_) {
    // Telemetry must never block scanning.
  }

  if (entry.durationMs >= API_SLOW_MS) {
    console.warn("[API slow]", entry);
  } else {
    dbgLog("api.js:recordApiPerf", "api perf", entry, "PERF");
  }
}

async function timedFetch(action, url, options = {}, meta = {}) {
  const startedAt = nowMs();
  try {
    const response = await fetch(url, options);
    recordApiPerf(action, nowMs() - startedAt, {
      ok: response.ok,
      status: response.status,
      ...meta
    });
    return response;
  } catch (err) {
    recordApiPerf(action, nowMs() - startedAt, {
      ok: false,
      error: err?.name || err?.message || "fetch-error",
      ...meta
    });
    throw err;
  }
}

window.getApiPerfLog = readApiPerfLog;

function isAlreadyCounted(data) {
  if (data.isUnregistered) return false;
  const lr = String(data.lastResult || "").trim();
  return lr === "Count" || lr === "Checked";
}

/** Read-only server lookup: lookup API, or export search if GAS not updated yet. Never uses scan. */
async function fetchAssetLookup(cleanCode, { forceFresh = false } = {}) {
  // Fast path: the backend lookup endpoint returns one row instead of exporting the whole sheet.
  let lookupTimer = null;
  try {
    const controller = new AbortController();
    lookupTimer = setTimeout(() => controller.abort(), 8000);
    const lookupRes = await timedFetch("lookup", apiUrl({ action: "lookup", assetNo: cleanCode, ...(forceFresh ? { nocache: "1" } : {}) }), { signal: controller.signal }, { assetNo: cleanCode, forceFresh });
    const lookupData = await lookupRes.json().catch(() => null);
    clearTimeout(lookupTimer);
    lookupTimer = null;
    if (lookupData && lookupData.status === "success") {
      dbgLog('index.html:fetchAssetLookup', 'lookup ok', { cleanCode, found: !!lookupData.found, via: 'lookup' }, 'H1');
      return lookupData;
    }
    const message = String((lookupData && lookupData.message) || "").toLowerCase();
    const needsExportFallback = lookupData
      && lookupData.status === "error"
      && (message.includes("unknown get action") || message.includes("invalid action"));
    if (!needsExportFallback) {
      dbgLog('index.html:fetchAssetLookup', 'lookup failed', { cleanCode, message: lookupData && lookupData.message }, 'H1');
      return lookupData || { status: "error", message: "ไม่สามารถโหลดข้อมูลจากเซิร์ฟเวอร์ได้" };
    }
  } catch (e) {
    if (lookupTimer) clearTimeout(lookupTimer);
    dbgLog('index.html:fetchAssetLookup', 'lookup timeout', { cleanCode, error: e.message }, 'H1');
    return { status: "error", message: "หมดเวลาระหว่างค้นหา - ตรวจสอบเครือข่าย" };
  }
  
  // Legacy fallback only for old Apps Script deployments that do not have action=lookup yet.
  let exportTimer = null;
  try {
    dbgLog('index.html:fetchAssetLookup', 'export fallback', { cleanCode }, 'H1');
    const controller = new AbortController();
    exportTimer = setTimeout(() => controller.abort(), 10000);
    const expRes = await timedFetch("export", apiUrl({ action: "export", ...(forceFresh ? { nocache: "1" } : {}) }), { signal: controller.signal }, { fallbackFor: "lookup", assetNo: cleanCode, forceFresh });
    const exp = await expRes.json().catch(() => null);
    clearTimeout(exportTimer);
    exportTimer = null;
    
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
    if (exportTimer) clearTimeout(exportTimer);
    return { status: "error", message: "หมดเวลาระหว่างค้นหา - ตรวจสอบเครือข่าย" };
  }
}



async function fetchAssetLookupWithTimeout(cleanCode, timeoutMs = 15000) {
  return Promise.race([
    fetchAssetLookup(cleanCode, { forceFresh: false }),
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

async function fetchScanStatusWithTimeout(cleanCode, timeoutMs = 3000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await timedFetch("scanStatus", apiUrl({ action: "scanStatus", assetNo: cleanCode }), { signal: controller.signal }, { assetNo: cleanCode });
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
