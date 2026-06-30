let allAssets = [], allUnregAssets = [], exportHeaders = [], scanDurationByAsset = {}, unregAddedDurationByAsset = {};
let selectedMasterAssets = [], selectedUnregAssets = [];
let currentMasterPage = 1, currentUnregPage = 1;
const PAGE_SIZE = 50;
let scanDurationTotalMs = 0;
let currentPillar = 'count', currentTab = 'all', currentWarehouse = 'all', currentSubFilter = 'all', currentCountProfile = 1, currentDashboardView = 'overview', selectedAssetNo = "";
let approveAuth = JSON.parse(sessionStorage.getItem("approveAuth") || "null");
let currentModalAssetNo = "";
let latestWarehouseOverviewRows = [];
let latestTypeOverviewRows = [];

function openCountSheetModal() {
  document.getElementById("modal-countsheet-select").classList.remove("hidden");
}
function closeCountSheetModal() {
  document.getElementById("modal-countsheet-select").classList.add("hidden");
}
function triggerExportCountSheet(roundNum) {
  closeCountSheetModal();
  if (roundNum === 'unreg') {
    exportUnregCountSheet();
  } else {
    exportCountSheet(roundNum);
  }
}

function highlightMatch(text, query) {
  if (!text) return "-";
  if (!query) return escHtml(text);
  const textStr = String(text);
  const index = textStr.toUpperCase().indexOf(query);
  if (index === -1) return escHtml(textStr);
  
  const originalPart = textStr.substring(index, index + query.length);
  const left = escHtml(textStr.substring(0, index));
  const right = escHtml(textStr.substring(index + query.length));
  return `${left}<mark class="search-highlight">${escHtml(originalPart)}</mark>${right}`;
}

function updateFilterTabCounts() {
  if (!allAssets || !Array.isArray(allAssets)) return;
  
  // Calculate category counts
  const catCounts = { all: allAssets.length, off: 0, com: 0, tol: 0, vpot: 0, veh: 0 };
  // Calculate warehouse counts
  const whCounts = { all: allAssets.length, wha: 0, whb: 0, whd: 0, office: 0, hr: 0 };
  
  allAssets.forEach(r => {
    if (!r) return;
    const cat = String(r[2] || "").trim().toLowerCase();
    const wh = String(r[4] || "").trim().toLowerCase();
    
    if (cat.includes("off")) catCounts.off++;
    if (cat.includes("com")) catCounts.com++;
    if (cat.includes("tol")) catCounts.tol++;
    if (cat.includes("vpot")) catCounts.vpot++;
    if (cat.includes("veh")) catCounts.veh++;
    
    if (wh.includes("wh-a") || wh.includes("warehouse a") || wh.includes("wha") || wh === 'a') whCounts.wha++;
    else if (wh.includes("wh-b") || wh.includes("warehouse b") || wh.includes("whb") || wh === 'b') whCounts.whb++;
    else if (wh.includes("whd") || wh.includes("warehouse d") || wh.includes("wh-d")) whCounts.whd++;
    else if (wh.includes("office")) whCounts.office++;
    else if (wh.includes("hr")) whCounts.hr++;
  });
  
  updateTabBtnText("tab-btn-cat-all", `All items (${catCounts.all})`);
  updateTabBtnText("tab-btn-cat-off", `Office (${catCounts.off})`);
  updateTabBtnText("tab-btn-cat-com", `Computer (${catCounts.com})`);
  updateTabBtnText("tab-btn-cat-tol", `Tools (${catCounts.tol})`);
  updateTabBtnText("tab-btn-cat-vpot", `VPOT (${catCounts.vpot})`);
  updateTabBtnText("tab-btn-cat-veh", `Vehicle (${catCounts.veh})`);
  
  updateTabBtnText("tab-btn-wh-all", `All warehouses (${whCounts.all})`);
  updateTabBtnText("tab-btn-wh-wha", `WH-A (${whCounts.wha})`);
  updateTabBtnText("tab-btn-wh-whb", `WH-B (${whCounts.whb})`);
  updateTabBtnText("tab-btn-wh-whd", `WHD (${whCounts.whd})`);
  updateTabBtnText("tab-btn-wh-office", `OFFICE (${whCounts.office})`);
  updateTabBtnText("tab-btn-wh-hr", `HR (${whCounts.hr})`);
}

function updateTabBtnText(id, text) {
  const el = document.getElementById(id);
  if (el) {
    const svg = el.querySelector("svg");
    if (svg) {
      el.innerHTML = "";
      el.appendChild(svg);
      el.appendChild(document.createTextNode(" " + text));
    } else {
      el.textContent = text;
    }
  }
}

function showToast(message, type = "error") {
  const container = document.getElementById("toast-container");
  if (!container) return;
  const toast = document.createElement("div");
  toast.style.background = type === "success" ? "var(--success)" : "var(--danger)";
  toast.style.color = "#ffffff";
  toast.style.padding = "12px 20px";
  toast.style.borderRadius = "var(--radius-sm)";
  toast.style.fontSize = "13px";
  toast.style.fontWeight = "700";
  toast.style.boxShadow = "var(--shadow)";
  toast.style.display = "flex";
  toast.style.alignItems = "center";
  toast.style.gap = "8px";
  toast.style.pointerEvents = "auto";
  toast.style.transition = "all 0.3s ease";
  toast.style.opacity = "0";
  toast.style.transform = "translateY(20px)";
  
  toast.innerHTML = `<span>${message}</span>`;
  container.appendChild(toast);
  
  setTimeout(() => {
    toast.style.opacity = "1";
    toast.style.transform = "translateY(0)";
  }, 50);
  
  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = "translateY(-10px)";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function isApproveLoggedIn() {
  return !!(approveAuth && approveAuth.user && approveAuth.pass);
}

function updateAuthUi() {
  const loggedIn = isApproveLoggedIn();
  const authStatus = document.getElementById("auth-status");
  if (authStatus) {
    authStatus.innerHTML = loggedIn ? `Approved by <strong>${approveAuth.user}</strong>` : "Not signed in";
  }
  const loginBtn = document.getElementById("auth-login-btn");
  if (loginBtn) loginBtn.classList.toggle("hidden", loggedIn);
  const logoutBtn = document.getElementById("auth-logout-btn");
  if (logoutBtn) logoutBtn.classList.toggle("hidden", !loggedIn);
  document.querySelectorAll(".approve-action").forEach(btn => {
    btn.classList.toggle("locked-action", !loggedIn);
    btn.title = loggedIn ? "Approve item" : "Sign in before approval";
  });
}

function openApproveLogin() {
  document.getElementById("approve-login-error").style.display = "none";
  document.getElementById("modal-approve-login").classList.remove("hidden");
  setTimeout(() => {
    const userField = document.getElementById("approve-user");
    if (userField) userField.focus();
  }, 50);
}

function closeApproveLogin() {
  document.getElementById("modal-approve-login").classList.add("hidden");
}

function logoutApprove() {
  approveAuth = null;
  sessionStorage.removeItem("approveAuth");
  updateAuthUi();
  setDashboardView('overview');
}

function requireApproveLogin() {
  if (isApproveLoggedIn()) return true;
  openApproveLogin();
  return false;
}

function setPillar(p) {
  currentPillar = p;
  document.getElementById("pillar-count").classList.toggle("active", p === 'count');
  document.getElementById("pillar-unreg").classList.toggle("active", p === 'unreg');
  clearAllSelections();
  syncDashboardView();
  filterTable();
}

function setCountProfile(profile) {
  currentCountProfile = profile === 2 ? 2 : 1;
  document.getElementById("count-profile-1").classList.toggle("active", currentCountProfile === 1);
  document.getElementById("count-profile-2").classList.toggle("active", currentCountProfile === 2);
  renderOverview();
}

function setDashboardView(view) {
  if (view === 'table' && !isApproveLoggedIn()) {
    openApproveLogin();
    return;
  }
  currentDashboardView = view === 'table' ? 'table' : 'overview';
  document.getElementById("view-overview").classList.toggle("active", currentDashboardView === 'overview');
  document.getElementById("view-table").classList.toggle("active", currentDashboardView === 'table');
  syncDashboardView();
}

function syncDashboardView() {
  const isCount = currentPillar === 'count';
  const isTable = currentDashboardView === 'table';
  const isPresenting = document.body.classList.contains("in-presentation");
  document.body.classList.toggle("overview-fit", (isCount && !isTable) || isPresenting);
  
  document.getElementById("summary-count").classList.toggle("hidden", !isCount || isTable);
  document.getElementById("summary-unreg").classList.toggle("hidden", isCount || isTable);
  
  document.getElementById("table-tools-container").classList.toggle("hidden", !isTable);
  document.getElementById("overview-panels").classList.toggle("hidden", !isCount || isTable);
  document.getElementById("overview-panels-unreg").classList.toggle("hidden", isCount || isTable);
  document.getElementById("filter-tab-container").classList.toggle("hidden", !isCount || !isTable);
  document.getElementById("table-master-container").classList.toggle("hidden", !isCount || !isTable);
  document.getElementById("table-unreg-container").classList.toggle("hidden", currentPillar !== 'unreg' || !isTable);
}

function enterPresentation() {
  currentPillar = 'count';
  currentDashboardView = 'overview';
  document.body.classList.add("in-presentation");
  syncDashboardView();
  const target = document.documentElement;
  if (target.requestFullscreen) target.requestFullscreen().catch(() => {});
}

function exitPresentation() {
  document.body.classList.remove("in-presentation");
  if (document.fullscreenElement && document.exitFullscreen) document.exitFullscreen().catch(() => {});
  syncDashboardView();
}

document.addEventListener("fullscreenchange", () => {
  if (!document.fullscreenElement && document.body.classList.contains("in-presentation")) {
    document.body.classList.remove("in-presentation");
    syncDashboardView();
  }
});

document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && document.body.classList.contains("in-presentation")) exitPresentation();
});

function setTab(t, el) {
  el.parentElement.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  el.classList.add("active"); currentTab = t; filterTable();
}

const WAREHOUSE_A_STATIONS = {
  "SCW": ["A01", "A02", "A03", "A04", "A05", "A06", "Center SCW", "Dock 01 - 10"],
  "SPW": ["Center SPW"],
  "PDI Station": ["PDI-01", "PDI-02", "PDI-03", "PDI-04", "PDI-05", "PDI-06", "PDI-07", "PDI-08", "PDI-09", "PDI-10"],
  "RPP Station": ["RPP-01", "RPP-02", "RPP-03", "RPP-04", "RPP-05", "RPP-06", "RPP-07", "RPP-08", "RPP-09", "RPP-10", "RPP-11", "RPP-12"],
  "QCD Station": ["Center QCD", "QCD-01", "QCD-02", "QCD-03", "QCD-04", "QCD-05"],
  "PWT": ["Office : PWT", "PWT-01", "PWT-02", "PWT-03", "PWT-04"]
};

const WAREHOUSE_B_STATIONS = {
  "OFFICE": ["Office Center", "meeting Room B1", "meeting Room B2", "meeting Room B3", "โซนรับประทานอาหาร", "Locker room", "Cool room"],
  "INBOUND": ["Inbound Control", "Selective 09-16", "Selective B17 - B24 และ B31"],
  "INVENTORY": ["Inventory Control", "Long span", "Pre-load 1"],
  "OUTBOUND": ["OUB Control", "Packing Sparpart", "Packing E-COM", "พื้นที่เก็บเศษกระดาษ", "MHE Area , Overflow", "Selective B25 - B29"],
  "DOCK": ["Dock-01", "Dock-02", "Dock-03", "Dock-04", "Dock-05", "Dock-06", "Dock-07", "Dock-08", "Dock-09", "Dock-10"],
  "HELMET": ["มุมหน้าห้องน้ำ", "มุมหน้าด้านซ้าย", "มุมหน้าด้านขวา", "มุมหลังสุดด้านซ้าย", "มุมหลังสุด้านขวา"],
  "VAS": ["Vas Control", "Vas Station"]
};

const WAREHOUSE_A_OLD_LOCS = ["โซน A01-A03", "โซน A04-A06", "โซน OB-1-12 WH.A", "โซน PDI", "โซน SPW", "ห้องทำงาน TRS"];
const WAREHOUSE_B_OLD_LOCS = ["Longspan E-F-G", "Selective B01-B16", "Selective B19-B31", "โซน Helmet", "ห้องทำงาน WH.B", "ห้องประชุม B1", "ห้องประชุม B2", "ห้องประชุม B3", "โซน OB-1-11 WH.B","โซน INV", "Cool Room"];

function setWarehouse(w, el) {
  el.parentElement.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  el.classList.add("active"); 
  currentWarehouse = w; 
  currentSubFilter = 'all';
  
  const subFilterRow = document.getElementById("sub-filter-row");
  const subFilterContainer = document.getElementById("sub-filter-container");
  
  if (w.toUpperCase() === 'WH-A' || w.toUpperCase() === 'WH-B') {
    subFilterRow.classList.remove("hidden");
    subFilterContainer.innerHTML = '';
    
    // Create 'All' button
    const btnAll = document.createElement("button");
    btnAll.className = "tab-btn active";
    btnAll.textContent = "ทั้งหมด";
    btnAll.onclick = function() { setSubFilter('all', this); };
    subFilterContainer.appendChild(btnAll);
    
    // Add Stations (New)
    const stations = w.toUpperCase() === 'WH-A' ? WAREHOUSE_A_STATIONS : WAREHOUSE_B_STATIONS;
    Object.keys(stations).forEach(station => {
      const btn = document.createElement("button");
      btn.className = "tab-btn";
      btn.textContent = station;
      btn.onclick = function() { setSubFilter(station, this); };
      subFilterContainer.appendChild(btn);
    });
    
    // Add Old Locations
    const oldLocs = w.toUpperCase() === 'WH-A' ? WAREHOUSE_A_OLD_LOCS : WAREHOUSE_B_OLD_LOCS;
    oldLocs.forEach(loc => {
      const btn = document.createElement("button");
      btn.className = "tab-btn";
      btn.textContent = loc;
      btn.onclick = function() { setSubFilter(loc, this); };
      subFilterContainer.appendChild(btn);
    });
  } else {
    subFilterRow.classList.add("hidden");
    subFilterContainer.innerHTML = '';
  }
  
  filterTable();
}

function setSubFilter(sub, el) {
  el.parentElement.querySelectorAll(".tab-btn").forEach(b => b.classList.remove("active"));
  el.classList.add("active");
  currentSubFilter = sub;
  filterTable();
}

function normalizeHeaderText(value) {
  return String(value || "").trim().toLowerCase().replace(/\s+/g, " ");
}

function getProfileCountIndex(profile) {
  if (!Array.isArray(exportHeaders) || exportHeaders.length === 0) return -1;
  const now = new Date();
  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const month = months[now.getMonth()];
  const year = now.getFullYear();
  const wanted = normalizeHeaderText(`เช็ค ${month} ${year} Count ${profile}`);
  let idx = exportHeaders.findIndex(h => normalizeHeaderText(h) === wanted);
  if (idx >= 0) return idx;
  if (profile === 1) {
    const legacy = normalizeHeaderText(`เช็ค ${month} ${year}`);
    idx = exportHeaders.findIndex(h => normalizeHeaderText(h) === legacy);
  }
  return idx;
}

function isCountedValue(value) {
  const text = String(value == null ? "" : value).trim();
  if (!text) return false;
  const lower = text.toLowerCase();
  return !["0", "false", "no", "n", "-", "pending"].includes(lower);
}

function normalizeGroupName(value, fallback) {
  const text = String(value || "").trim();
  return text || fallback;
}

function buildBreakdown(rows, groupIndex, countIndex) {
  const map = new Map();
  rows.forEach(row => {
    const name = normalizeGroupName(row[groupIndex], "ไม่ระบุ");
    const item = map.get(name) || { name, total: 0, checked: 0, pending: 0 };
    item.total += 1;
    if (countIndex >= 0 && isCountedValue(row[countIndex])) item.checked += 1;
    map.set(name, item);
  });
  return Array.from(map.values())
    .map(item => ({ ...item, pending: Math.max(0, item.total - item.checked) }))
    .sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name, "th"));
}

function renderBreakdown(containerId, rows) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = '<div style="color:var(--text-muted);font-weight:700;">ไม่มีข้อมูล</div>';
    return;
  }
  const max = Math.max(...rows.map(item => item.pending), 1);
  el.innerHTML = rows.slice(0, 12).map(item => {
    const width = Math.round((item.pending / max) * 100);
    return `
      <div class="breakdown-row">
        <div class="breakdown-name" title="${escHtml(item.name)}">${escHtml(item.name)}</div>
        <div class="breakdown-value">${item.pending.toLocaleString()}</div>
        <div class="breakdown-bar"><div class="breakdown-fill" style="width:${width}%"></div></div>
      </div>`;
  }).join("");
}

function buildPriorityBreakdown(warehouseRows, zoneRows) {
  return [
    ...warehouseRows.slice(0, 6).map(item => ({ ...item, name: `คลัง: ${item.name}` })),
    ...zoneRows.slice(0, 6).map(item => ({ ...item, name: `โซน: ${item.name}` }))
  ].sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name, "th")).slice(0, 10);
}

function buildWarehouseZoneOverview(rows, countIndex) {
  const warehouseOrder = ["Warehouse A", "Warehouse B", "OFFICE", "WHD", "HR", "Diff"];
  const normalizeWarehouseDisplay = (value) => {
    const text = String(value || "").trim();
    const lower = text.toLowerCase();
    if (["warehouse a", "wh-a", "wha", "wh a"].includes(lower)) return "Warehouse A";
    if (["warehouse b", "wh-b", "whb", "wh b"].includes(lower)) return "Warehouse B";
    if (lower === "office") return "OFFICE";
    if (lower === "whd") return "WHD";
    if (lower === "hr") return "HR";
    return "Diff";
  };
  const warehouses = new Map();
  rows.forEach(row => {
    const warehouseName = normalizeWarehouseDisplay(row[4]);
    const rawWarehouseName = normalizeGroupName(row[4], "ไม่ระบุคลัง");
    const zoneName = normalizeGroupName(row[3], "ไม่ระบุโซน");
    const counted = countIndex >= 0 && isCountedValue(row[countIndex]);
    const warehouse = warehouses.get(warehouseName) || { name: warehouseName, total: 0, checked: 0, zones: new Map(), sources: new Map() };
    const zone = warehouse.zones.get(zoneName) || { name: zoneName, total: 0, checked: 0 };
    const source = warehouse.sources.get(rawWarehouseName) || { name: rawWarehouseName, total: 0, checked: 0 };
    warehouse.total += 1;
    zone.total += 1;
    source.total += 1;
    if (counted) {
      warehouse.checked += 1;
      zone.checked += 1;
      source.checked += 1;
    }
    warehouse.zones.set(zoneName, zone);
    warehouse.sources.set(rawWarehouseName, source);
    warehouses.set(warehouseName, warehouse);
  });
  return Array.from(warehouses.values())
    .map(warehouse => ({
      ...warehouse,
      pending: Math.max(0, warehouse.total - warehouse.checked),
      sources: Array.from(warehouse.sources.values())
        .map(source => ({ ...source, pending: Math.max(0, source.total - source.checked) }))
        .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "th")),
      zones: Array.from(warehouse.zones.values())
        .map(zone => ({ ...zone, pending: Math.max(0, zone.total - zone.checked) }))
        .sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name, "th"))
    }))
    .sort((a, b) => warehouseOrder.indexOf(a.name) - warehouseOrder.indexOf(b.name));
}

function renderWarehouseZoneOverview(containerId, rows) {
  const el = document.getElementById(containerId);
  if (!el) return;
  latestWarehouseOverviewRows = rows;
  if (!rows.length) {
    el.innerHTML = '<div class="empty-state">No data</div>';
    return;
  }
  el.innerHTML = rows.map((warehouse, index) => {
    const pct = warehouse.total > 0 ? Math.round((warehouse.checked / warehouse.total) * 100) : 0;
    const isDiff = warehouse.name === "Diff";
    return `
      <div class="overview-list-card warehouse-card" onclick="openWarehouseOverviewModal(${index})">
        <div class="overview-list-main">
          <div>
            <div class="overview-list-title">${escHtml(warehouse.name)}</div>
            <div class="overview-list-subtitle">${isDiff ? "Needs warehouse/zone grouping" : "Click for zone details"}</div>
          </div>
          <div class="overview-list-metrics">
            <div class="metric-pill"><span>Total</span><strong>${warehouse.total.toLocaleString()}</strong></div>
            <div class="metric-pill success"><span>Counted</span><strong>${warehouse.checked.toLocaleString()}</strong></div>
            <div class="metric-pill danger"><span>Left</span><strong>${warehouse.pending.toLocaleString()}</strong></div>
          </div>
        </div>
        <div class="overview-progress-row">
          <div class="overview-progress"><div class="overview-progress-fill" style="width:${pct}%"></div></div>
          <div class="overview-percent">${pct}%</div>
        </div>
      </div>`;
  }).join("");
}

function renderOverviewModalRow(item) {
  const pct = Number.isFinite(item.pct) ? item.pct : (item.total > 0 ? Math.round((item.checked / item.total) * 100) : 0);
  return `
    <div class="overview-modal-row">
      <div class="overview-modal-top">
        <div>
          <div class="overview-modal-title" title="${escHtml(item.title)}">${escHtml(item.title)}</div>
          <div class="overview-modal-subtitle">${escHtml(item.subtitle || "Details")}</div>
        </div>
        <div class="overview-list-metrics">
          <div class="metric-pill success"><span>Counted</span><strong>${item.checked.toLocaleString()}</strong></div>
          <div class="metric-pill"><span>Total</span><strong>${item.total.toLocaleString()}</strong></div>
          <div class="metric-pill danger"><span>Left</span><strong>${item.pending.toLocaleString()}</strong></div>
        </div>
      </div>
      <div class="overview-progress-row">
        <div class="overview-progress"><div class="overview-progress-fill" style="width:${pct}%"></div></div>
        <div class="overview-percent">${pct}%</div>
      </div>
    </div>`;
}

function openWarehouseOverviewModal(index) {
  const warehouse = latestWarehouseOverviewRows[index];
  if (!warehouse) return;
  const title = document.getElementById("warehouse-modal-title");
  const summary = document.getElementById("warehouse-modal-summary");
  const body = document.getElementById("warehouse-modal-body");
  if (!title || !summary || !body) return;
  title.textContent = warehouse.name;
  summary.textContent = `Total ${warehouse.total.toLocaleString()} | Counted ${warehouse.checked.toLocaleString()} | Left ${warehouse.pending.toLocaleString()}`;
  const sourceHtml = warehouse.name === "Diff" ? `
    <div class="modal-section-title">Diff source</div>
    ${warehouse.sources.map(source => renderOverviewModalRow({
      title: source.name,
      subtitle: "Original warehouse value",
      checked: source.checked,
      total: source.total,
      pending: source.pending
    })).join("")}` : "";
  body.innerHTML = sourceHtml || warehouse.zones.map(zone => renderOverviewModalRow({
    title: zone.name,
    subtitle: "Zone detail",
    checked: zone.checked,
    total: zone.total,
    pending: zone.pending
  })).join("");
  document.getElementById("modal-warehouse-overview").classList.remove("hidden");
}

function closeWarehouseOverviewModal() {
  document.getElementById("modal-warehouse-overview").classList.add("hidden");
}

function renderTypeOverview(containerId, rows) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const typeLabels = {
    OFF: "Office / office equipment",
    COM: "Computer / IT equipment",
    TOL: "Tools / workshop equipment",
    VPOT: "VPOT equipment",
    VEH: "Vehicle",
    UNKNOWN: "Unknown type"
  };
  const items = rows.map(item => ({
    ...item,
    code: String(item.name || "UNKNOWN").trim().toUpperCase() || "UNKNOWN",
    displayName: typeLabels[String(item.name || "UNKNOWN").trim().toUpperCase() || "UNKNOWN"] || item.name || "Unknown type",
    pct: item.total > 0 ? Math.round((item.checked / item.total) * 100) : 0
  })).sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "th"));
  latestTypeOverviewRows = items;
  if (!items.length) {
    el.innerHTML = '<div class="empty-state">No data</div>';
    return;
  }
  el.innerHTML = items.map((item, index) => {
    const pending = Math.max(0, item.total - item.checked);
    return `
      <div class="overview-list-card type-row" onclick="openTypeOverviewModal(${index})" style="cursor:pointer;">
        <div class="overview-list-main">
          <div class="type-title">
            <div class="type-code cat-tag ${escHtml(item.code.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}">${escHtml(item.code)}</div>
            <div>
              <div class="overview-list-title" title="${escHtml(item.displayName)}">${escHtml(item.displayName)}</div>
              <div class="overview-list-subtitle">Click for warehouse and zone remaining list</div>
            </div>
          </div>
          <div class="overview-list-metrics">
            <div class="metric-pill success"><span>Counted</span><strong>${item.checked.toLocaleString()}</strong></div>
            <div class="metric-pill"><span>Total</span><strong>${item.total.toLocaleString()}</strong></div>
            <div class="metric-pill danger"><span>Left</span><strong>${pending.toLocaleString()}</strong></div>
          </div>
        </div>
        <div class="overview-progress-row">
          <div class="overview-progress"><div class="overview-progress-fill" style="width:${item.pct}%"></div></div>
          <div class="overview-percent">${item.pct}%</div>
        </div>
      </div>`;
  }).join("");
}

function buildTypePendingBreakdown(typeCode) {
  const countIndex = getProfileCountIndex(currentCountProfile);
  const map = new Map();
  allAssets.forEach(row => {
    const code = String(row[2] || "UNKNOWN").trim().toUpperCase() || "UNKNOWN";
    if (code !== typeCode) return;
    if (countIndex >= 0 && isCountedValue(row[countIndex])) return;
    const warehouse = normalizeGroupName(row[4], "Unknown warehouse");
    const zone = normalizeGroupName(row[3], "Unknown zone");
    const key = `${warehouse} | ${zone}`;
    const item = map.get(key) || { warehouse, zone, pending: 0 };
    item.pending += 1;
    map.set(key, item);
  });
  return Array.from(map.values()).sort((a, b) => b.pending - a.pending || a.warehouse.localeCompare(b.warehouse, "th") || a.zone.localeCompare(b.zone, "th"));
}

function openTypeOverviewModal(index) {
  const item = latestTypeOverviewRows[index];
  if (!item) return;
  const title = document.getElementById("type-modal-title");
  const summary = document.getElementById("type-modal-summary");
  const body = document.getElementById("type-modal-body");
  if (!title || !summary || !body) return;
  title.textContent = `${item.code} - ${item.displayName || item.name || "Unknown type"}`;
  summary.textContent = `Counted ${item.checked.toLocaleString()} / Total ${item.total.toLocaleString()} | Left ${(item.total - item.checked).toLocaleString()}`;
  const rows = buildTypePendingBreakdown(item.code);
  body.innerHTML = rows.length ? rows.map(row => `
    <div class="overview-modal-row compact">
      <div class="overview-modal-top">
        <div>
          <div class="overview-modal-title" title="${escHtml(row.warehouse)}">${escHtml(row.warehouse)}</div>
          <div class="overview-modal-subtitle" title="${escHtml(row.zone)}">${escHtml(row.zone)}</div>
        </div>
        <div class="metric-pill danger"><span>Left</span><strong>${row.pending.toLocaleString()}</strong></div>
      </div>
    </div>`).join("") : '<div class="empty-state success">No remaining items for this type</div>';
  document.getElementById("modal-type-overview").classList.remove("hidden");
}

function closeTypeOverviewModal() {
  document.getElementById("modal-type-overview").classList.add("hidden");
}

function buildUnregWarehouseZoneOverview(unregRows) {
  const warehouseOrder = ["Warehouse A", "Warehouse B", "OFFICE", "WHD", "HR", "Diff"];
  const normalizeWarehouseDisplay = (value) => {
    const text = String(value || "").trim();
    const lower = text.toLowerCase();
    if (["warehouse a", "wh-a", "wha", "wh a"].includes(lower)) return "Warehouse A";
    if (["warehouse b", "wh-b", "whb", "wh b"].includes(lower)) return "Warehouse B";
    if (lower === "office") return "OFFICE";
    if (lower === "whd") return "WHD";
    if (lower === "hr") return "HR";
    return "Diff";
  };
  const warehouses = new Map();
  unregRows.forEach(row => {
    const warehouseName = normalizeWarehouseDisplay(row[3]);
    const zoneName = normalizeGroupName(row[4], "Unknown zone");
    const warehouse = warehouses.get(warehouseName) || { name: warehouseName, total: 0, checked: 0, zones: new Map(), sources: new Map() };
    const zone = warehouse.zones.get(zoneName) || { name: zoneName, total: 0, checked: 0 };
    warehouse.total += 1;
    zone.total += 1;
    warehouse.zones.set(zoneName, zone);
    warehouses.set(warehouseName, warehouse);
  });
  return Array.from(warehouses.values())
    .map(warehouse => ({
      ...warehouse,
      pending: warehouse.total,
      zones: Array.from(warehouse.zones.values())
        .map(zone => ({ ...zone, pending: zone.total }))
        .sort((a, b) => b.pending - a.pending || a.name.localeCompare(b.name, "th"))
    }))
    .sort((a, b) => warehouseOrder.indexOf(a.name) - warehouseOrder.indexOf(b.name));
}

function renderUnregWarehouseZoneOverview(containerId, rows) {
  const el = document.getElementById(containerId);
  if (!el) return;
  if (!rows.length) {
    el.innerHTML = '<div style="color:var(--text-muted);font-weight:700;">No unregistered warehouse data</div>';
    return;
  }
  el.innerHTML = rows.map((warehouse) => `
    <div class="warehouse-card" style="cursor:default;">
      <div class="warehouse-head" style="grid-template-columns: 1fr auto;">
        <div class="warehouse-name">${escHtml(warehouse.name)}</div>
        <div class="warehouse-pending" style="color:var(--danger);font-weight:800;">Pending ${warehouse.total.toLocaleString()} items</div>
      </div>
      <div class="zone-list" style="margin-top:8px; display:grid; gap:4px;">
        ${warehouse.zones.map(zone => `
          <div style="display:flex; justify-content:space-between; font-size:12px; color:var(--text-dim); background:rgba(0,0,0,0.02); padding:4px 8px; border-radius:6px;">
            <span>📍 ${escHtml(zone.name)}</span>
            <span style="font-weight:bold; color:var(--danger);">${zone.total.toLocaleString()} items</span>
          </div>
        `).join("")}
      </div>
    </div>`).join("");
}

function buildUnregTypeBreakdown(unregRows) {
  const map = new Map();
  unregRows.forEach(row => {
    const name = normalizeGroupName(row[2], "Unknown");
    const item = map.get(name) || { name, total: 0 };
    item.total += 1;
    map.set(name, item);
  });
  return Array.from(map.values())
    .sort((a, b) => b.total - a.total || a.name.localeCompare(b.name, "th"));
}

function renderUnregTypeOverview(containerId, rows) {
  const el = document.getElementById(containerId);
  if (!el) return;
  const typeLabels = {
    OFF: "Office / office equipment",
    COM: "Computer / IT equipment",
    TOL: "Tools / workshop equipment",
    VPOT: "VPOT equipment",
    VEH: "Vehicle",
    UNKNOWN: "Unknown type"
  };
  if (!rows.length) {
    el.innerHTML = '<div style="color:var(--text-muted);font-weight:700;">No data</div>';
    return;
  }
  const max = Math.max(...rows.map(r => r.total), 1);
  el.innerHTML = rows.map((item) => {
    const code = String(item.name || "UNKNOWN").trim().toUpperCase() || "UNKNOWN";
    const width = Math.round((item.total / max) * 100);
    const label = typeLabels[code] || item.name;
    return `
      <div class="type-row" style="cursor:default;">
        <div class="type-meta">
          <div class="type-title">
            <div class="type-code cat-tag ${escHtml(code.toLowerCase().replace(/[^a-z0-9_-]/g, ""))}">${escHtml(code)}</div>
            <div class="type-name" title="${escHtml(label)}">${escHtml(label)}</div>
          </div>
        </div>
        <div class="type-count" style="color:var(--danger); border-color:rgba(220,38,38,0.12); background:rgba(220,38,38,0.02);">${item.total.toLocaleString()} items</div>
        <div class="breakdown-bar" style="grid-column: 1/-1; height:6px; margin-top:4px;"><div class="breakdown-fill" style="width:${width}%; background:linear-gradient(90deg, var(--danger), var(--warning));"></div></div>
      </div>`;
  }).join("");
}

function renderOverview() {
  if (!Array.isArray(allAssets)) return;
  const countIndex = getProfileCountIndex(currentCountProfile);
  const totalAssets = allAssets.length;
  const checked = countIndex >= 0 ? allAssets.filter(row => isCountedValue(row[countIndex])).length : 0;
  const pending = Math.max(0, totalAssets - checked);
  const pct = totalAssets > 0 ? Math.round((checked / totalAssets) * 100) : 0;
  document.getElementById("dash-total").textContent = totalAssets.toLocaleString();
  document.getElementById("dash-checked").textContent = checked.toLocaleString();
  document.getElementById("dash-pending-complete").textContent = pending.toLocaleString();
  document.getElementById("dash-month-label").textContent = `รายการที่ตรวจสอบแล้ว (${currentCountProfile === 1 ? "Count 1" : "Count 2"})`;
  document.getElementById("dash-pct-complete").textContent = pct + "%";
  document.getElementById("dash-pct-pending-complete").textContent = (100 - pct) + "%";
  const circumference = 2 * Math.PI * 26;
  const circle = document.getElementById("progress-circle");
  if (circle) circle.style.strokeDashoffset = circumference - (pct / 100) * circumference;
  const pendingCircle = document.getElementById("pending-circle");
  if (pendingCircle) pendingCircle.style.strokeDashoffset = circumference - ((100 - pct) / 100) * circumference;
  renderWarehouseZoneOverview("warehouse-zone-overview", buildWarehouseZoneOverview(allAssets, countIndex));
  renderTypeOverview("type-overview", buildBreakdown(allAssets, 2, countIndex));
  
  if (Array.isArray(allUnregAssets)) {
    renderUnregWarehouseZoneOverview("unreg-warehouse-zone-overview", buildUnregWarehouseZoneOverview(allUnregAssets));
    renderUnregTypeOverview("unreg-type-overview", buildUnregTypeBreakdown(allUnregAssets));
  }
}

function parseSafeDate(raw) {
  if (!raw) return null;
  if (raw instanceof Date) return raw;
  let d = new Date(raw);
  if (!isNaN(d.getTime())) return d;
  const str = String(raw).trim();
  const match = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})(?:\s+(\d{1,2}):(\d{1,2})(?::(\d{1,2}))?)?$/);
  if (match) {
    const day = parseInt(match[1], 10);
    const month = parseInt(match[2], 10) - 1;
    let year = parseInt(match[3], 10);
    if (year > 2400) year -= 543;
    const hour = match[4] ? parseInt(match[4], 10) : 0;
    const minute = match[5] ? parseInt(match[5], 10) : 0;
    const second = match[6] ? parseInt(match[6], 10) : 0;
    d = new Date(year, month, day, hour, minute, second);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function filterTable(resetPage = true) {
  if (!allAssets || !Array.isArray(allAssets)) return;
  if (!allUnregAssets || !Array.isArray(allUnregAssets)) return;

  if (resetPage === true || (resetPage && typeof resetPage === 'object')) {
    currentMasterPage = 1;
    currentUnregPage = 1;
  }
  
  const searchTxt = document.getElementById("search-input").value.toUpperCase();
  const dateFrom = document.getElementById("date-from").value;
  const dateTo = document.getElementById("date-to").value;
  
  const fromTime = dateFrom ? new Date(dateFrom).setHours(0,0,0,0) : null;
  const toTime = dateTo ? new Date(dateTo).setHours(23,59,59,999) : null;

  const showDamagedOnly = document.getElementById("filter-damaged").checked;

  if (currentPillar === 'count') {
    let filtered = allAssets.slice();
    
    if(currentTab !== 'all') {
      filtered = filtered.filter(r => r && String(r[2]).toLowerCase().includes(currentTab));
    }
    if(currentWarehouse !== 'all') {
      filtered = filtered.filter(r => {
        if (!r || !r[4]) return false;
        const rw = String(r[4]).toLowerCase().trim();
        const fw = currentWarehouse.toLowerCase().trim();
        
        let matchWarehouse = false;
        if (fw === 'wh-a') {
          matchWarehouse = rw.includes('wh-a') || rw.includes('warehouse a') || rw.includes('wha') || rw === 'a';
        } else if (fw === 'wh-b') {
          matchWarehouse = rw.includes('wh-b') || rw.includes('warehouse b') || rw.includes('whb') || rw === 'b';
        } else if (fw === 'whd') {
          matchWarehouse = rw.includes('whd') || rw.includes('warehouse d') || rw.includes('wh-d');
        } else {
          matchWarehouse = rw.includes(fw);
        }
        
        if (!matchWarehouse) return false;
        
        if (currentSubFilter !== 'all') {
          const area = String(r[3] || "").trim();
          if (fw === 'wh-a') {
            if (WAREHOUSE_A_STATIONS[currentSubFilter]) {
              return WAREHOUSE_A_STATIONS[currentSubFilter].includes(area);
            } else {
              return area === currentSubFilter;
            }
          } else if (fw === 'wh-b') {
            if (WAREHOUSE_B_STATIONS[currentSubFilter]) {
              return WAREHOUSE_B_STATIONS[currentSubFilter].includes(area);
            } else {
              return area === currentSubFilter;
            }
          }
        }
        return true;
      });
    }
    if(searchTxt) {
      filtered = filtered.filter(r => r && (String(r[0]).toUpperCase().includes(searchTxt) || String(r[1]).toUpperCase().includes(searchTxt)));
    }
    if(fromTime || toTime) {
      filtered = filtered.filter(r => {
        if(!r || !r[7]) return false;
        const parsed = parseSafeDate(r[7]);
        if (!parsed) return false;
        const d = parsed.getTime();
        if(fromTime && d < fromTime) return false;
        if(toTime && d > toTime) return false;
        return true;
      });
    }
    if (showDamagedOnly) {
      filtered = filtered.filter(r => {
        let lastResultText = r[8] || "";
        let remarkText = r[9] || "";
        return [String(r[1]), String(r[2]), lastResultText, remarkText, String(r[6] || "")].join(" ").includes("บาร์โค้ดเสียหาย") || String(r[2]).toUpperCase() === "UNKNOWN";
      });
    }

    renderMasterTable(filtered);
  } else {
    let filteredUnreg = allUnregAssets.slice();
    if(searchTxt) {
      filteredUnreg = filteredUnreg.filter(r => r && (String(r[0]).toUpperCase().includes(searchTxt) || String(r[1]).toUpperCase().includes(searchTxt) || String(r[5]).toUpperCase().includes(searchTxt)));
    }
    if(fromTime || toTime) {
      filteredUnreg = filteredUnreg.filter(r => {
        if(!r || !r[6]) return false;
        const parsed = parseSafeDate(r[6]);
        if (!parsed) return false;
        const d = parsed.getTime();
        if(fromTime && d < fromTime) return false;
        if(toTime && d > toTime) return false;
        return true;
      });
    }
    if (showDamagedOnly) {
      filteredUnreg = filteredUnreg.filter(r => {
        const assetName = String(r[1] || "").trim();
        const category = String(r[2] || "").trim();
        const remarks = String(r[5] || "").trim();
        const status = String(r[9] || "").trim();
        return [assetName, category, remarks, status].join(" ").includes("บาร์โค้ดเสียหาย") || category.toUpperCase() === "UNKNOWN";
      });
    }
    renderUnregTable(filteredUnreg);
  }
  updateBulkActionsBar();
}

function getRowImageHtml(imageLink) {
  if (!imageLink) return `<div class="row-thumb-placeholder">📷</div>`;
  const safeLink = String(imageLink || "").trim();
  const match = safeLink.match(/(?:id=|\/d\/)([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    const fileId = match[1];
    const thumbUrl = `https://lh3.googleusercontent.com/d/${fileId}=s150`;
    return `<img class="row-thumb" src="${thumbUrl}" alt="Thumbnail" onclick='event.stopPropagation(); window.open(${JSON.stringify(safeLink)}, "_blank")'>`;
  }
  return `<div class="row-thumb-placeholder" style="color:var(--primary); cursor:pointer;" onclick='event.stopPropagation(); window.open(${JSON.stringify(safeLink)}, "_blank")'>🔗</div>`;
}

function formatDurationHms(ms) {
  const totalSeconds = Math.max(0, Math.floor(Number(ms || 0) / 1000));
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return [hours, minutes, seconds].map(n => String(n).padStart(2, "0")).join(":");
}

function getAssetDurationMs(assetNo) {
  const key = String(assetNo || "").trim().toUpperCase();
  return Number((scanDurationByAsset[key] && scanDurationByAsset[key].durationMs) || 0);
}

function getUnregDurationMs(tempId) {
  const key = String(tempId || "").trim().toUpperCase();
  return Number((unregAddedDurationByAsset[key] && unregAddedDurationByAsset[key].durationMs) || 0);
}

function renderMasterTable(data) {
  const tbody = document.getElementById("table-body");
  
  const sorted = [...data].sort((a, b) => {
    const da = a[7] ? new Date(a[7]).getTime() : 0;
    const db = b[7] ? new Date(b[7]).getTime() : 0;
    return db - da;
  });

  const paginationEl = document.getElementById("master-pagination");

  if(sorted.length === 0) { 
    tbody.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);">No data</div>'; 
    if (paginationEl) paginationEl.innerHTML = "";
    return; 
  }

  const totalItems = sorted.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
  if (currentMasterPage > totalPages) currentMasterPage = totalPages;
  if (currentMasterPage < 1) currentMasterPage = 1;
  
  const startIndex = (currentMasterPage - 1) * PAGE_SIZE;
  const pageData = sorted.slice(startIndex, startIndex + PAGE_SIZE);

  if (paginationEl) {
    paginationEl.innerHTML = `
      <div>Showing ${startIndex + 1} - ${Math.min(startIndex + PAGE_SIZE, totalItems)} of ${totalItems} items</div>
      <div style="display: flex; gap: 8px;">
        <button class="control-btn" onclick="changeMasterPage(-1)" ${currentMasterPage === 1 ? "disabled" : ""} style="padding: 6px 12px; margin: 0;">Prev</button>
        <span style="display: flex; align-items: center; padding: 0 10px; font-weight: 700;">Page ${currentMasterPage} / ${totalPages}</span>
        <button class="control-btn" onclick="changeMasterPage(1)" ${currentMasterPage === totalPages ? "disabled" : ""} style="padding: 6px 12px; margin: 0;">Next</button>
      </div>
    `;
  }

  const searchTxt = document.getElementById("search-input").value.toUpperCase();

  tbody.innerHTML = pageData.map(r => {
    const checkDateStr = formatDateTime(r[7]);
    const acqDate = formatDate(r[5]);
    
    const assetNo = String(r[0] || "").trim();
    const assetNoHtml = highlightMatch(assetNo, searchTxt);
    const assetNoJs = JSON.stringify(assetNo);
    const assetName = r[1] || "-";
    const assetNameHtml = highlightMatch(assetName, searchTxt);
    const area = r[3] || "-";
    const areaHtml = highlightMatch(area, searchTxt);
    const warehouse = escHtml(r[4] || "-");
    const status = escHtml(r[6] || "Active");
    
    let statusBadge = status;
    if (status === "Active" || status === "ใช้งานอยู่") {
      statusBadge = `<span style="display:inline-flex; align-items:center; padding:4px 10px; border-radius:99px; font-size:11px; font-weight:700; background:#dcfce7; color:#15803d; border: 1px solid #bbf7d0;">Active</span>`;
    } else if (status === "Inactive" || status === "ไม่ได้ใช้งาน") {
      statusBadge = `<span style="display:inline-flex; align-items:center; padding:4px 10px; border-radius:99px; font-size:11px; font-weight:700; background:#fee2e2; color:#b91c1c; border: 1px solid #fecaca;">Inactive</span>`;
    }
    
    const lastResult = escHtml(r[8] || "-");
    const category = String(r[2] || "").trim();
    const categoryHtml = escHtml(category || "-");
    const cat = category.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const catClass = `cat-tag ${cat}`;
    
    let imageLink = r[10] || "";
    let lastResultText = r[8] || "";
    let remarkText = r[9] || "";
    
    const urlRegex = /(https?:\/\/(?:drive|docs)\.google\.com\/[^\s\)]+)/;
    if (!imageLink && lastResultText.match(urlRegex)) {
      imageLink = lastResultText.match(urlRegex)[1];
    }
    if (!imageLink && remarkText.match(urlRegex)) {
      imageLink = remarkText.match(urlRegex)[1];
    }

    const imageHtml = getRowImageHtml(imageLink);
    const durationText = formatDurationHms(getAssetDurationMs(assetNo));
    
    const isStickerDamaged = [String(r[1]), String(r[2]), lastResultText, remarkText, String(r[6] || "")].join(" ").includes("บาร์โค้ดเสียหาย") || String(r[2]).toUpperCase() === "UNKNOWN";
    const stickerBadge = isStickerDamaged
      ? '<span class="table-blink-badge">Damaged barcode</span>'
      : "";

    return `
      <div class="table-row">
        <div><input type="checkbox" class="table-checkbox master-checkbox" data-id="${assetNo}" onchange="toggleMasterSelect(this)" ${selectedMasterAssets.includes(assetNo) ? 'checked' : ''}></div>
        <div style="font-weight:600; color:var(--primary); font-size:12px;">${checkDateStr}</div>
        <div style="font-weight:bold; letter-spacing:0.5px;">${assetNoHtml}</div>
        <div>${imageHtml}</div>
        <div style="line-height:1.3; text-align:left; word-break: break-all; overflow-wrap: break-word;">
          <div style="font-weight:600; color:var(--text);">${assetNameHtml}</div>
          ${stickerBadge}
          <div style="font-size:11px; color:var(--text-dim); margin-top:2px;">${areaHtml}</div>
        </div>
        <div style="font-size:12px;">${acqDate}</div>
        <div>${statusBadge}</div>
        <div style="font-size:11px; color:var(--text-dim);">${lastResult}</div>
        <div style="font-size:11px; font-weight:700; color:var(--primary);">${durationText}</div>
        <div style="display:flex; gap:6px; justify-content:center;">
          <button class="row-btn pdf" onclick='openLabelModal(${assetNoJs})'><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg> Print</button>
          <button class="row-btn detail" onclick='viewAssetDetail(${assetNoJs})'><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg> Info</button>
        </div>
      </div>
    `;
  }).join('');
}

function renderUnregTable(data) {
  const tbody = document.getElementById("table-unreg-body");
  const paginationEl = document.getElementById("unreg-pagination");

  if (!Array.isArray(data) || data.length === 0) { 
    tbody.innerHTML = '<div style="padding:40px; text-align:center; color:var(--text-muted);">No data</div>'; 
    if (paginationEl) paginationEl.innerHTML = "";
    return; 
  }
  const sorted = [...data].sort((a,b) => {
    const da = a && a[6] ? new Date(a[6]).getTime() : 0;
    const db = b && b[6] ? new Date(b[6]).getTime() : 0;
    return db - da;
  });

  const totalItems = sorted.length;
  const totalPages = Math.ceil(totalItems / PAGE_SIZE) || 1;
  if (currentUnregPage > totalPages) currentUnregPage = totalPages;
  if (currentUnregPage < 1) currentUnregPage = 1;
  
  const startIndex = (currentUnregPage - 1) * PAGE_SIZE;
  const pageData = sorted.slice(startIndex, startIndex + PAGE_SIZE);

  if (paginationEl) {
    paginationEl.innerHTML = `
      <div>Showing ${startIndex + 1} - ${Math.min(startIndex + PAGE_SIZE, totalItems)} of ${totalItems} items</div>
      <div style="display: flex; gap: 8px;">
        <button class="control-btn" onclick="changeUnregPage(-1)" ${currentUnregPage === 1 ? "disabled" : ""} style="padding: 6px 12px; margin: 0;">Prev</button>
        <span style="display: flex; align-items: center; padding: 0 10px; font-weight: 700;">Page ${currentUnregPage} / ${totalPages}</span>
        <button class="control-btn" onclick="changeUnregPage(1)" ${currentUnregPage === totalPages ? "disabled" : ""} style="padding: 6px 12px; margin: 0;">Next</button>
      </div>
    `;
  }

  const searchTxt = document.getElementById("search-input").value.toUpperCase();

  tbody.innerHTML = pageData.map(r => {
    const tempId = String(r[0] || "").trim();
    const tempIdHtml = highlightMatch(tempId, searchTxt);
    const tempIdJs = JSON.stringify(tempId);
    const assetName = String(r[1] || "").trim();
    const category = String(r[2] || "").trim();
    const warehouse = String(r[3] || "").trim();
    const area = String(r[4] || "").trim();
    const remarks = String(r[5] || "").trim();
    const status = String(r[9] || "").trim();
    const isStickerDamaged = [assetName, category, remarks, status].join(" ").includes("บาร์โค้ดเสียหาย") || category.toUpperCase() === "UNKNOWN";
    const stickerBadge = isStickerDamaged
      ? '<span class="table-blink-badge">Damaged barcode</span>'
      : "";
    
    const cat = category.toLowerCase().replace(/[^a-z0-9_-]/g, "");
    const catClass = `cat-tag ${cat}`;
    const assetNameHtml = assetName ? highlightMatch(assetName, searchTxt) : '<span style="color:var(--danger);">No asset name / model</span>';
    const categoryHtml = escHtml(category || "-");
    const areaHtml = highlightMatch(area, searchTxt);
    const warehouseHtml = escHtml(warehouse || "-");
    const remarksHtml = highlightMatch(remarks, searchTxt);
    
    const imageLink = r[7] || "";
    const imageHtml = getRowImageHtml(imageLink);
    const durationText = formatDurationHms(getUnregDurationMs(tempId));

    return `
      <div class="table-row unreg">
        <div><input type="checkbox" class="table-checkbox unreg-checkbox" data-id="${tempId}" onchange="toggleUnregSelect(this)" ${selectedUnregAssets.includes(tempId) ? 'checked' : ''}></div>
        <div>${r[6] ? new Date(r[6]).toLocaleString('th-TH') : '-'}</div>
        <div style="font-weight:bold; letter-spacing:0.5px;">${tempIdHtml}</div>
        <div><span class="${catClass}">${categoryHtml}</span></div>
        <div>${imageHtml}</div>
        <div style="line-height:1.3; text-align:left; word-break: break-all; overflow-wrap: break-word;">
          <div style="font-weight:700; color:var(--text);">${assetNameHtml}</div>
          ${stickerBadge}
          <div style="font-size:11px; color:var(--text-dim); margin-top:3px;">${areaHtml}</div>
        </div>
        <div>${warehouseHtml}</div>
        <div style="color:var(--danger); font-size:11px; text-align:left;">${remarksHtml}</div>
        <div style="font-size:11px; font-weight:700; color:var(--warning);">${durationText}</div>
        <div style="display:flex; gap:4px; justify-content:center;">
          <button class="row-btn detail" onclick='viewUnregAssetDetail(${tempIdJs})'><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line></svg> Info</button>
          <button class="row-btn approve-action" onclick='confirmUnreg(${tempIdJs}, this)'><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg> Approve</button>
        </div>
      </div>
    `;
  }).join('');
}

function selectAllDamaged() {
  if (currentPillar === 'count') {
    allAssets.forEach(r => {
      let lastResultText = r[8] || "";
      let remarkText = r[9] || "";
      const isDamaged = [String(r[1]), String(r[2]), lastResultText, remarkText, String(r[6] || "")].join(" ").includes("บาร์โค้ดเสียหาย") || String(r[2]).toUpperCase() === "UNKNOWN";
      if (isDamaged) {
        const id = String(r[0] || "").trim();
        if (!selectedMasterAssets.includes(id)) {
          selectedMasterAssets.push(id);
        }
      }
    });
  } else {
    allUnregAssets.forEach(r => {
      const assetName = String(r[1] || "").trim();
      const category = String(r[2] || "").trim();
      const remarks = String(r[5] || "").trim();
      const status = String(r[9] || "").trim();
      const isDamaged = [assetName, category, remarks, status].join(" ").includes("บาร์โค้ดเสียหาย") || category.toUpperCase() === "UNKNOWN";
      if (isDamaged) {
        const id = String(r[0] || "").trim();
        if (!selectedUnregAssets.includes(id)) {
          selectedUnregAssets.push(id);
        }
      }
    });
  }
  
  document.querySelectorAll('.master-checkbox').forEach(c => {
    const id = c.getAttribute('data-id');
    if (selectedMasterAssets.includes(id)) c.checked = true;
  });
  document.querySelectorAll('.unreg-checkbox').forEach(c => {
    const id = c.getAttribute('data-id');
    if (selectedUnregAssets.includes(id)) c.checked = true;
  });
  
  updateBulkActionsBar();
}

function toggleMasterSelect(chk) {
  const id = chk.getAttribute('data-id');
  if (chk.checked) {
    if (!selectedMasterAssets.includes(id)) selectedMasterAssets.push(id);
  } else {
    selectedMasterAssets = selectedMasterAssets.filter(x => x !== id);
  }
  updateBulkActionsBar();
}

function toggleUnregSelect(chk) {
  const id = chk.getAttribute('data-id');
  if (chk.checked) {
    if (!selectedUnregAssets.includes(id)) selectedUnregAssets.push(id);
  } else {
    selectedUnregAssets = selectedUnregAssets.filter(x => x !== id);
  }
  updateBulkActionsBar();
}

function toggleSelectAllMaster(chk) {
  const checkboxes = document.querySelectorAll('.master-checkbox');
  checkboxes.forEach(c => {
    c.checked = chk.checked;
    const id = c.getAttribute('data-id');
    if (chk.checked) {
      if (!selectedMasterAssets.includes(id)) selectedMasterAssets.push(id);
    } else {
      selectedMasterAssets = selectedMasterAssets.filter(x => x !== id);
    }
  });
  updateBulkActionsBar();
}

function toggleSelectAllUnreg(chk) {
  const checkboxes = document.querySelectorAll('.unreg-checkbox');
  checkboxes.forEach(c => {
    c.checked = chk.checked;
    const id = c.getAttribute('data-id');
    if (chk.checked) {
      if (!selectedUnregAssets.includes(id)) selectedUnregAssets.push(id);
    } else {
      selectedUnregAssets = selectedUnregAssets.filter(x => x !== id);
    }
  });
  updateBulkActionsBar();
}

function updateBulkActionsBar() {
  const bar = document.getElementById("bulk-actions-bar");
  const countSpan = document.getElementById("selected-count");
  if (!bar || !countSpan) return;
  
  const count = currentPillar === 'count' ? selectedMasterAssets.length : selectedUnregAssets.length;
  countSpan.textContent = count;
  
  if (count > 0) {
    bar.classList.remove("hidden");
  } else {
    bar.classList.add("hidden");
  }
  
  if (currentPillar === 'count') {
    const allBox = document.getElementById("select-all-master");
    if (allBox) {
      const activeCheckboxes = document.querySelectorAll('.master-checkbox');
      allBox.checked = activeCheckboxes.length > 0 && Array.from(activeCheckboxes).every(c => c.checked);
    }
  } else {
    const allBox = document.getElementById("select-all-unreg");
    if (allBox) {
      const activeCheckboxes = document.querySelectorAll('.unreg-checkbox');
      allBox.checked = activeCheckboxes.length > 0 && Array.from(activeCheckboxes).every(c => c.checked);
    }
  }
}

function clearAllSelections() {
  selectedMasterAssets = [];
  selectedUnregAssets = [];
  document.querySelectorAll('.master-checkbox, .unreg-checkbox').forEach(c => c.checked = false);
  const allMaster = document.getElementById("select-all-master");
  if (allMaster) allMaster.checked = false;
  const allUnreg = document.getElementById("select-all-unreg");
  if (allUnreg) allUnreg.checked = false;
  updateBulkActionsBar();
}

function changeMasterPage(dir) {
  currentMasterPage += dir;
  filterTable(false);
}

function changeUnregPage(dir) {
  currentUnregPage += dir;
  filterTable(false);
}

function getDirectDriveImageHtml(link) {
  if (!link) return "";
  const match = link.match(/(?:id=|\/d\/)([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    const fileId = match[1];
    const thumbUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=800`;
    return `
      <div style="margin-top: 8px; text-align: center;">
        <a href="${link}" target="_blank" style="display:block;">
          <img src="${thumbUrl}" alt="Attached Image" style="max-width: 100%; border-radius: 8px; border: 1px solid var(--border); box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-height: 250px; object-fit: contain; background: #f3f4f6;">
        </a>
        <div style="margin-top: 12px;">
          <a href="${link}" target="_blank" class="btn btn-secondary" style="display:inline-flex;font-size:12px;padding:6px 12px;">Open full image in Google Drive</a>
        </div>
      </div>
    `;
  }
  return `<a href="${link}" target="_blank" class="btn btn-primary" style="width:100%;">View attached damaged barcode image</a>`;
}

function formatDateTime(raw) {
  if (!raw) return "-";
  const d = parseSafeDate(raw);
  if (!d) return String(raw);
  return d.toLocaleString('th-TH', { day:'numeric', month:'short', year:'2-digit', hour:'2-digit', minute:'2-digit' });
}

function formatDate(raw) {
  if (!raw) return "-";
  const d = parseSafeDate(raw);
  if (!d) return "-";
  return d.toLocaleDateString('th-TH');
}

function escHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getStatusBadge(status) {
  const s = String(status || "").trim();
  if (s === "ใช้งานอยู่" || s === "Active") return `<span class="status-badge ok" style="background:#dcfce7;color:#15803d;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;">Active</span>`;
  if (s === "ไม่ได้ใช้งาน" || s === "Inactive") return `<span class="status-badge warn" style="background:#fee2e2;color:#b91c1c;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;">Inactive</span>`;
  if (s === "ชำรุดเสียหาย" || s === "Damaged") return `<span class="status-badge error" style="background:#fef3c7;color:#b45309;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;">Damaged</span>`;
  return `<span class="status-badge" style="background:#f1f5f9;color:#475569;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;">${s}</span>`;
}

function viewAssetDetail(assetNo) {
  const row = allAssets.find(r => String(r[0]).trim().toUpperCase() === String(assetNo).trim().toUpperCase());
  currentModalAssetNo = assetNo;

  document.getElementById("modal-asset-no").textContent     = assetNo;
  document.getElementById("modal-name").textContent          = row ? (row[1] || "-") : "-";
  document.getElementById("modal-category").innerHTML        = row ? `<span class="cat-tag">${escHtml(row[2] || "-")}</span>` : "-";
  document.getElementById("modal-area").textContent          = row ? (row[3] || "-") : "-";
  document.getElementById("modal-warehouse").textContent     = row ? (row[4] || "-") : "-";
  let lastResultText = row ? (row[8] || "-") : "-";
  let remarkText = row ? (row[9] || "") : "";
  let imageLink = row ? (row[10] || "") : "";

  const urlRegex = /(https?:\/\/(?:drive|docs)\.google\.com\/[^\s\)]+)/;
  if (!imageLink && lastResultText.match(urlRegex)) {
    imageLink = lastResultText.match(urlRegex)[1];
    lastResultText = lastResultText.replace(/\(Image:\s*https?:\/\/[^\)]+\)/, "").replace(urlRegex, "").trim();
  }

  if (!imageLink && remarkText.match(urlRegex)) {
    imageLink = remarkText.match(urlRegex)[1];
    remarkText = remarkText.replace(/\(Image:\s*https?:\/\/[^\)]+\)/, "").replace(urlRegex, "").trim();
  }
  
  if (lastResultText.startsWith("Confirmed from Unregistered: ")) {
    const extractedRemark = lastResultText.replace("Confirmed from Unregistered:", "").trim();
    if (extractedRemark && !remarkText) {
      remarkText = extractedRemark;
    }
  }

  lastResultText = String(lastResultText).trim();
  if (lastResultText.includes("Confirmed from Unregistered") || lastResultText.includes("Unregistered")) {
    lastResultText = "สินค้านอกระบบ";
  } else if (lastResultText === "Count" || lastResultText === "Checked") {
    lastResultText = "ตรวจสอบแล้ว";
  }

  document.getElementById("modal-acq-date").textContent      = row ? formatDate(row[5])     : "-";
  document.getElementById("modal-status").innerHTML          = row ? getStatusBadge(row[6] || "Active") : "-";
  document.getElementById("modal-last-scan").textContent     = row ? formatDateTime(row[7]) : "-";
  document.getElementById("modal-last-result").textContent   = lastResultText;
  document.getElementById("modal-save-duration").textContent = formatDurationHms(getAssetDurationMs(assetNo));

  if (remarkText) {
    document.getElementById("modal-remark-container").style.display = "block";
    document.getElementById("modal-remark").textContent = remarkText;
  } else {
    document.getElementById("modal-remark-container").style.display = "none";
  }

  if (imageLink) {
    document.getElementById("modal-image-container").style.display = "block";
    document.getElementById("modal-image").innerHTML = getDirectDriveImageHtml(imageLink);
  } else {
    document.getElementById("modal-image-container").style.display = "none";
  }

  document.getElementById("modal-asset-detail").classList.remove("hidden");
}

function viewUnregAssetDetail(tempId) {
  const row = allUnregAssets.find(r => String(r[0]).trim().toUpperCase() === String(tempId).trim().toUpperCase());
  if (!row) return;

  currentModalAssetNo = tempId;

  document.getElementById("modal-asset-no").textContent     = tempId;
  document.getElementById("modal-name").textContent          = row[1] || "-";
  document.getElementById("modal-category").innerHTML        = `<span class="cat-tag" style="background:#fef3c7;color:#b45309;">${escHtml(row[2] || "-")}</span>`;
  document.getElementById("modal-area").textContent          = row[4] || "-";
  document.getElementById("modal-warehouse").textContent     = row[3] || "-";
  document.getElementById("modal-acq-date").textContent      = formatDateTime(row[6]); 
  document.getElementById("modal-status").innerHTML          = `<span class="status-badge warn" style="background:#fef3c7;color:#b45309;padding:4px 8px;border-radius:6px;font-size:11px;font-weight:700;">นอกระบบ</span>`;
  document.getElementById("modal-last-scan").textContent     = formatDateTime(row[6]);
  document.getElementById("modal-last-result").textContent   = "Unregistered Asset";
  document.getElementById("modal-save-duration").textContent = formatDurationHms(getUnregDurationMs(tempId));

  let remarkText = row[5] || "";
  let imageLink = row[7] || "";

  if (remarkText) {
    document.getElementById("modal-remark-container").style.display = "block";
    document.getElementById("modal-remark").textContent = remarkText;
  } else {
    document.getElementById("modal-remark-container").style.display = "none";
  }

  if (imageLink) {
    document.getElementById("modal-image-container").style.display = "block";
    document.getElementById("modal-image").innerHTML = getDirectDriveImageHtml(imageLink);
  } else {
    document.getElementById("modal-image-container").style.display = "none";
  }

  document.getElementById("modal-asset-detail").classList.remove("hidden");
}

function closeAssetDetailModal() {
  document.getElementById("modal-asset-detail").classList.add("hidden");
}
