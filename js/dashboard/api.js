const API_URL = "https://script.google.com/macros/s/AKfycbzji7bEWa6sauFw1l21Su6GEDkYw7rAiBaiSzdnMuPHanmmW9atThQ0v9C8PsLvuYkxfw/exec";
const API_SECRET = "VESPA2025SECRET";

function apiUrl(params) {
  const url = new URL(API_URL); url.searchParams.set("key", API_SECRET);
  for (const [k, v] of Object.entries(params)) { url.searchParams.set(k, v); }
  return url.toString();
}

function fetchWithTimeout(url, options = {}, timeoutMs = 25000) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { ...options, signal: controller.signal })
    .then(res => { clearTimeout(timer); return res; })
    .catch(err => { clearTimeout(timer); throw err; });
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

async function loadDashboard() {
  const refreshBtn = document.getElementById("refresh-btn");
  if (!refreshBtn) return;
  refreshBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px; animation: spin 1s linear infinite; display: inline-block;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg> กำลังโหลด...`; refreshBtn.disabled = true;

  try {
    const [r1, r2] = await Promise.all([
      fetchWithTimeout(apiUrl({ action: "dashboard", fresh: "1", _: Date.now() }), {}, 15000).then(res => res.json()).catch(() => null),
      fetchWithTimeout(apiUrl({ action: "export", fresh: "1", _: Date.now() }), {}, 25000).then(res => res.json()).catch(() => null)
    ]);
    
    if(r1 && r1.summary) {
      const totalAssets = Number(r1.summary.totalAssets || 0);
      const checked = Number(r1.summary.checked || 0);
      const pending = Number(r1.summary.pending ?? Math.max(0, totalAssets - checked));
      document.getElementById("dash-total").textContent = totalAssets.toLocaleString();
      document.getElementById("dash-checked").textContent = checked.toLocaleString();
      document.getElementById("dash-pending-complete").textContent = pending.toLocaleString();
      let pct = Number(r1.summary.pct ?? (totalAssets > 0 ? Math.round((checked / totalAssets) * 100) : 0)) || 0;
      pct = Math.max(0, Math.min(100, pct));
      document.getElementById("dash-pct-complete").textContent = pct + "%";
      document.getElementById("dash-pct-pending-complete").textContent = (100 - pct) + "%";
      
      // Update circular progress svg offset
      const circle = document.getElementById("progress-circle");
      if (circle) {
        const circumference = 2 * Math.PI * 26; // 163.36
        const offset = circumference - (pct / 100) * circumference;
        circle.style.strokeDashoffset = offset;
      }
      const pendingCircle = document.getElementById("pending-circle");
      if (pendingCircle) {
        const circumference = 2 * Math.PI * 26;
        const pendingPct = Math.max(0, 100 - pct);
        pendingCircle.style.strokeDashoffset = circumference - (pendingPct / 100) * circumference;
      }
    }
    
    if(r2 && Array.isArray(r2.assets)) {
      allAssets = r2.assets; 
      allUnregAssets = Array.isArray(r2.unregAssets) ? r2.unregAssets : [];
      exportHeaders = Array.isArray(r2.headers) ? r2.headers : [];
      scanDurationByAsset = r2.scanDurationByAsset || {};
      unregAddedDurationByAsset = r2.unregAddedDurationByAsset || {};
      scanDurationTotalMs = Object.values(scanDurationByAsset).reduce((sum, item) => sum + Number((item && item.durationMs) || 0), 0);
      document.getElementById("dash-pillar-unreg").textContent = allUnregAssets.length.toLocaleString();
      document.getElementById("dash-total-duration").textContent = formatDurationHms(scanDurationTotalMs);
      document.getElementById("dash-unreg-duration").textContent = formatDurationHms(r2.unregAddedDurationTotalMs || 0);
      const lastSyncText = document.getElementById("last-sync-text");
      if (lastSyncText) {
        lastSyncText.textContent = "Synced " + new Date().toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
      }
      renderOverview();
      syncDashboardView();
      updateFilterTabCounts();
      filterTable();
    } else {
      throw new Error("ไม่สามารถอ่านข้อมูลจาก Server ได้");
    }
  } catch(e) { console.error(e); showToast("❌ " + (e.message || "ไม่สามารถเชื่อมต่อ Server หรือหมดเวลา"), "error"); }
  finally { refreshBtn.innerHTML = `<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><polyline points="23 4 23 10 17 10"></polyline><polyline points="1 20 1 14 7 14"></polyline><path d="M3.51 9a9 9 0 0 1 14.85-3.36L23 10M1 14l4.64 4.36A9 9 0 0 0 20.49 15"></path></svg> Auto refresh 2 นาที`; refreshBtn.disabled = false; }
}
