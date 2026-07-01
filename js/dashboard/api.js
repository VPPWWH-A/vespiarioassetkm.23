const API_URL = "https://script.google.com/macros/s/AKfycbzji7bEWa6sauFw1l21Su6GEDkYw7rAiBaiSzdnMuPHanmmW9atThQ0v9C8PsLvuYkxfw/exec";
const API_SECRET = "VESPA2025SECRET";
const DASHBOARD_LAST_GOOD_KEY = "__assetDashboardLastGood";
let dashboardLoadInFlight = false;

function apiUrl(params) {
  const url = new URL(API_URL); url.searchParams.set("key", API_SECRET);
  for (const [k, v] of Object.entries(params)) {
    if (v === undefined || v === null || v === "") continue;
    url.searchParams.set(k, v);
  }
  return url.toString();
}

function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .then(res => { clearTimeout(timer); return res; })
    .catch(err => { clearTimeout(timer); throw err; });
}

async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 25000, label = "Request") {
  const res = await fetchWithTimeout(url, options, timeoutMs);
  const text = await res.text();
  if (!res.ok) {
    throw new Error(`${label} failed (${res.status}): ${text.slice(0, 160) || res.statusText}`);
  }
  try {
    return JSON.parse(text);
  } catch (err) {
    throw new Error(`${label} returned invalid JSON: ${text.slice(0, 160)}`);
  }
}

function setDashboardLoadError(message) {
  const safeMessage = escHtml(message || "Cannot load dashboard data.");
  const tableBody = document.getElementById("table-body");
  if (tableBody) {
    tableBody.innerHTML = `<div style="padding:40px; text-align:center; color:var(--danger); font-weight:700;">${safeMessage}</div>`;
  }
  const unregBody = document.getElementById("table-unreg-body");
  if (unregBody) {
    unregBody.innerHTML = `<div style="padding:40px; text-align:center; color:var(--danger); font-weight:700;">${safeMessage}</div>`;
  }
  const lastSyncText = document.getElementById("last-sync-text");
  if (lastSyncText) lastSyncText.textContent = "Sync failed";
}

function applyDashboardData(summaryResponse, exportResponse, options = {}) {
  dashboardSummary = summaryResponse && summaryResponse.summary ? summaryResponse.summary : null;
  const r1 = summaryResponse || {};
  const r2 = exportResponse || {};

  if (dashboardSummary) {
    const totalAssets = Number(dashboardSummary.totalAssets || 0);
    const checked = currentCountProfile === 2 ? Number(dashboardSummary.checked2 || 0) : Number(dashboardSummary.checked || 0);
    const pending = Math.max(0, totalAssets - checked);
    document.getElementById("dash-total").textContent = totalAssets.toLocaleString();
    document.getElementById("dash-checked").textContent = checked.toLocaleString();
    document.getElementById("dash-pending-complete").textContent = pending.toLocaleString();
    const pct = totalAssets > 0 ? Math.round((checked / totalAssets) * 100) : 0;
    document.getElementById("dash-pct-complete").textContent = pct + "%";
    document.getElementById("dash-pct-pending-complete").textContent = (100 - pct) + "%";
  }

  allAssets = Array.isArray(r2.assets) ? r2.assets : [];
  allUnregAssets = Array.isArray(r2.unregAssets) ? r2.unregAssets : [];
  exportHeaders = Array.isArray(r2.headers) ? r2.headers : [];
  countMeta = r2.countMeta || r1.countMeta || {};
  countPeriods = Array.isArray(r2.countPeriods) ? r2.countPeriods : (Array.isArray(r1.countPeriods) ? r1.countPeriods : (Array.isArray(countMeta.countPeriods) ? countMeta.countPeriods : []));
  if (countMeta && countMeta.activeCountPeriod) currentCountPeriod = countMeta.activeCountPeriod;
  if (typeof updateCountPeriodSelect === "function") updateCountPeriodSelect();
  warehouseOverviewRows = Array.isArray(r2.warehouseOverviewRows) ? r2.warehouseOverviewRows : [];
  scanDurationByAsset = r2.scanDurationByAsset || {};
  unregAddedDurationByAsset = r2.unregAddedDurationByAsset || {};
  scanDurationTotalMs = Object.values(scanDurationByAsset).reduce((sum, item) => sum + Number((item && item.durationMs) || 0), 0);

  document.getElementById("dash-pillar-unreg").textContent = allUnregAssets.length.toLocaleString();
  document.getElementById("dash-total-duration").textContent = formatDurationHms(scanDurationTotalMs);
  document.getElementById("dash-unreg-duration").textContent = formatDurationHms(r2.unregAddedDurationTotalMs || 0);

  const lastSyncText = document.getElementById("last-sync-text");
  if (lastSyncText) {
    const prefix = options.stale ? "Showing saved data from " : "Synced ";
    lastSyncText.textContent = prefix + new Date(options.generatedAt || Date.now()).toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
  }

  renderOverview({ preserveSummaryOnMissingCount: true });
  syncDashboardView();
  updateFilterTabCounts();
  filterTable();
}

function saveLastGoodDashboard(summaryResponse, exportResponse) {
  try {
    localStorage.setItem(DASHBOARD_LAST_GOOD_KEY, JSON.stringify({
      savedAt: Date.now(),
      summaryResponse,
      exportResponse
    }));
  } catch (e) {}
}

function restoreLastGoodDashboard() {
  try {
    const cached = JSON.parse(localStorage.getItem(DASHBOARD_LAST_GOOD_KEY) || "null");
    if (!cached || !cached.summaryResponse || !cached.exportResponse) return false;
    applyDashboardData(cached.summaryResponse, cached.exportResponse, { stale: true, generatedAt: cached.savedAt });
    return true;
  } catch (e) {
    return false;
  }
}

async function submitApproveLogin() {
  const user = document.getElementById("approve-user").value.trim();
  const pass = document.getElementById("approve-pass").value.trim();
  const err = document.getElementById("approve-login-error");
  if (!user || !pass) {
    err.textContent = "Please enter username and password.";
    err.style.display = "block";
    return;
  }

  const btn = document.getElementById("approve-login-submit");
  btn.disabled = true;
  btn.innerHTML = `<span class="spinner-sm"></span> Checking...`;
  try {
    const res = await fetchWithTimeout(apiUrl({ action: "approveLogin", user, pass }), {}, 15000);
    const d = await res.json().catch(() => null);
    if (!d || typeof d !== 'object' || d.status !== "success") {
      throw new Error(d ? d.message : "Sign in failed");
    }
    approveAuth = { user, pass };
    sessionStorage.setItem("approveAuth", JSON.stringify(approveAuth));
    closeApproveLogin();
    updateAuthUi();
    // Auto-switch to table view upon successful login
    setDashboardView('table');
  } catch (e) {
    err.textContent = (e.message || "Sign in failed").replace("❌ ", "");
    if (e.name === "AbortError") {
      err.textContent = "Request timed out. Check the network connection.";
    }
    err.style.display = "block";
  } finally {
    btn.disabled = false;
    btn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"></path><polyline points="10 17 15 12 10 7"></polyline><line x1="15" y1="12" x2="3" y2="12"></line></svg> Sign in`;
  }
}

async function confirmUnreg(id, btn) {
  if (!requireApproveLogin()) return;
  if(!confirm("Approve item " + id + " into the master asset list?")) return;
  
  let originalHtml = "";
  if (btn) {
    btn.disabled = true;
    originalHtml = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-sm" style="border-top-color:#ffffff; margin-right:4px;"></span> Approving...`;
  }
  try {
    const res = await fetchWithTimeout(apiUrl({ action: "confirmUnregSecure", tempId: id, user: approveAuth.user, pass: approveAuth.pass }), {}, 18000);
    const d = await res.json().catch(() => null);
    if(d && d.status === "success") { 
      alert("Approved successfully."); 
      loadDashboard(); 
    } else {
      alert("Approval failed: " + (d ? d.message : "Request failed"));
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    }
  } catch(e) { 
    alert("Connection error: " + e.message); 
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

async function confirmAllUnreg(btn) {
  if (!requireApproveLogin()) return;
  if(!confirm("Approve all pending items into the master asset list?")) return;
  
  let originalHtml = "";
  if (btn) {
    btn.disabled = true;
    originalHtml = btn.innerHTML;
    btn.innerHTML = `<span class="spinner-sm" style="border-top-color:#ffffff; margin-right:4px;"></span> Approving...`;
  }
  try {
    const res = await fetchWithTimeout(apiUrl({ action: "confirmAllUnreg", user: approveAuth.user, pass: approveAuth.pass }), {}, 25000);
    const d = await res.json().catch(() => null);
    if(d && d.status === "success") { 
      alert("Approved all items successfully. (" + d.addedCount + " items)"); 
      loadDashboard(); 
    } else {
      alert("Approval failed: " + (d ? d.message : "Request failed"));
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = originalHtml;
      }
    }
  } catch(e) { 
    alert("Action failed: " + e.message); 
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}

async function loadDashboard(options = {}) {
  const refreshBtn = document.getElementById("refresh-btn");
  if (!refreshBtn) return;
  if (dashboardLoadInFlight) return;
  const forceFresh = !!(options && options.forceFresh);
  const debugTiming = !!(options && options.debugTiming);
  const nowMs = () => (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  const loadStart = nowMs();
  dashboardLoadInFlight = true;
  refreshBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px; animation: spin 1s linear infinite; display: inline-block;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg> Loading...`;
  refreshBtn.disabled = true;

  try {
    const commonParams = { countPeriod: currentCountPeriod, countRound: currentCountProfile, _: Date.now() };
    if (forceFresh) commonParams.fresh = "1";
    const summaryStart = nowMs();
    const summaryRequest = fetchJsonWithTimeout(apiUrl({ action: "dashboard", ...commonParams }), {}, 20000, "Dashboard summary");
    const exportRequest = fetchJsonWithTimeout(apiUrl({ action: "export", ...commonParams, _: Date.now() + 1 }), {}, 60000, "Dashboard table");
    const [r1, r2] = await Promise.all([summaryRequest, exportRequest]);
    const networkEnd = nowMs();
    if (!r1 || !r1.summary) {
      throw new Error(r1 && r1.message ? r1.message : "Cannot read dashboard summary from server.");
    }
    if (!r2 || !Array.isArray(r2.assets)) {
      throw new Error(r2 && r2.message ? r2.message : "Cannot read dashboard table data from server.");
    }

    refreshBtn.innerHTML = `<span class="spinner-sm" style="margin-right:4px;"></span> Rendering...`;
    const renderStart = nowMs();
    applyDashboardData(r1, r2);
    saveLastGoodDashboard(r1, r2);
    if (debugTiming || window.DASHBOARD_DEBUG_TIMING) {
      const renderEnd = nowMs();
      console.debug("[dashboard] load timing", {
        forceFresh,
        networkMs: Math.round(networkEnd - summaryStart),
        renderMs: Math.round(renderEnd - renderStart),
        totalMs: Math.round(renderEnd - loadStart),
        assets: Array.isArray(r2.assets) ? r2.assets.length : 0,
        unregAssets: Array.isArray(r2.unregAssets) ? r2.unregAssets.length : 0
      });
    }
  } catch (e) {
    console.error(e);
    const message = e && e.name === "AbortError" ? "Dashboard request timed out. Please try again." : (e.message || "Cannot connect to server.");
    if (!restoreLastGoodDashboard()) setDashboardLoadError(message);
    showToast("Error: " + message, "error");
  } finally {
    refreshBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg> Auto refresh 2 min`;
    refreshBtn.disabled = false;
    dashboardLoadInFlight = false;
  }
}

async function startNewCountRound() {
  if (!requireApproveLogin()) return;
  const btn = document.querySelector(".count-round-btn");
  if (!confirm("เริ่มรอบนับใหม่ของเดือนปัจจุบัน? ระบบจะสร้างคอลัมน์ Count 1/2 ใหม่ถ้ายังไม่มี และจะไม่แก้ข้อมูลเดือนเก่า")) return;
  const originalHtml = btn ? btn.innerHTML : "";
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-sm" style="margin-right:4px;"></span> Creating...`;
  }
  try {
    const res = await fetchJsonWithTimeout(apiUrl({ action: "startNewCountRound", fresh: "1", _: Date.now() }), {}, 30000, "Start count round");
    if (!res || res.status !== "success") {
      throw new Error(res && res.message ? res.message : "Cannot start new count round.");
    }
    countMeta = res.countMeta || countMeta || {};
    countPeriods = Array.isArray(res.countPeriods) ? res.countPeriods : countPeriods;
    currentCountPeriod = "";
    try { localStorage.removeItem(DASHBOARD_LAST_GOOD_KEY); } catch (e) {}
    if (typeof updateCountPeriodSelect === "function") updateCountPeriodSelect();
    showToast(res.message || "New count round is ready.", "success");
    await loadDashboard({ forceFresh: true });
  } catch (e) {
    const message = e && e.name === "AbortError" ? "Start count round timed out." : (e.message || "Cannot start new count round.");
    showToast("Error: " + message, "error");
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = originalHtml;
    }
  }
}
