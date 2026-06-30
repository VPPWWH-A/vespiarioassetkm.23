// ==================== NAVIGATION ====================
function showPage(page) {
  currentPage = page;
  localStorage.setItem("lastActivePage", page); // บันทึกหน้าล่าสุด

  if (page === "home") {
    closeScanConfirmModal();
    try { stopScanner(); } catch (e) {}
  }

  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.getElementById("page-" + page).classList.remove("hidden");
  
  document.querySelectorAll(".bottom-nav button").forEach(b => b.classList.remove("active"));
  const navBtn = document.getElementById("nav-" + page);
  if (navBtn) navBtn.classList.add("active");
  if (page === "label") updateLabelPreview();
  if (page === "handheld") {
    setTimeout(() => {
      const hhInput = document.getElementById("handheld-input");
      if (hhInput) hhInput.focus();
    }, 100);
  }
}

// ==================== ADD FORM ====================
function showAddForm(assetNo) {
  openManualAddModal(assetNo, "unregistered");
}

async function submitAdd() {
  const assetName  = document.getElementById("input-name").value.trim();
  const category   = document.getElementById("input-category").value;
  const area       = document.getElementById("input-area").value.trim();
  const warehouse  = document.getElementById("input-warehouse").value;
  const acquisitionDate = document.getElementById("input-date").value;
  const status     = document.getElementById("input-status").value;

  if (!assetName) {
    alert("❌ กรุณากรอกชื่อทรัพย์สิน / โมเดล");
    document.getElementById("input-name").focus();
    return;
  }

  if (!category || !area || !warehouse) {
    alert("กรุณากรอกข้อมูลที่จำเป็น");
    return;
  }

  const saveBtn = document.querySelector("#page-add .btn-success");
  if (saveBtn) { saveBtn.disabled = true; saveBtn.innerHTML = '<span class="spinner-sm" style="margin-right:6px;"></span>กำลังบันทึก...'; }

  const savedNo = currentAssetNo;
  await yieldToUI();

  // Reset form
  document.getElementById("input-name").value      = "";
  document.getElementById("input-category").value  = "";
  document.getElementById("input-warehouse").value = "";
  if (document.getElementById("input-station-field")) {
    document.getElementById("input-station-field").classList.add("hidden");
    document.getElementById("input-station").innerHTML = '<option value="">เลือกแผนก</option>';
  }
  document.getElementById("input-area").innerHTML  = '<option value="">โปรดเลือกโซนหลักก่อน</option>';
  if (saveBtn) { saveBtn.disabled = false; saveBtn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> บันทึก'; }
  showPage("home");

  setResult(`<div class="result-card success"><div style="font-size:36px;margin-bottom:8px;">⏳</div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">กำลังบันทึก</div><div style="font-size:22px;font-weight:800;margin-top:4px;">${escHtml(savedNo)}</div><div style="font-size:13px;color:var(--text-dim);margin-top:4px;">กำลังส่งข้อมูลไปยัง Google Sheet...</div></div>`);

  try {
    const controller = new AbortController();
    const timeout    = setTimeout(() => controller.abort(), 15000);
    const response   = await fetch(apiUrl({ action: "add", assetNo: savedNo, assetName, category, area, warehouse, acquisitionDate, status }), { signal: controller.signal });
    clearTimeout(timeout);
    const data = await response.json().catch(() => null);

    if (!data) {
      setResult(`<div class="result-card error"><div style="font-size:36px;margin-bottom:8px;">❌</div><div style="font-size:14px;color:var(--text-dim);">บันทึกไม่สำเร็จ — ข้อมูลที่ได้รับไม่ถูกต้อง</div></div>`);
    } else if (data.status === "success") {
      setResult(`<div class="result-card success"><div style="font-size:36px;margin-bottom:8px;">✅</div><div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">บันทึกสำเร็จแล้ว</div><div style="font-size:22px;font-weight:800;margin-top:4px;">${escHtml(savedNo)}</div><div style="font-size:13px;color:var(--text-dim);margin-top:4px;">${escHtml(assetName)}</div></div>`);
    } else if (data.message && data.message.includes("already exists")) {
      // ✅ รองรับกรณี duplicate จาก GAS
      setResult(`<div class="result-card warning"><div style="font-size:36px;margin-bottom:8px;">⚠️</div><div style="font-size:14px;color:var(--text-dim);">รหัส ${escHtml(savedNo)} มีอยู่ในระบบแล้ว</div></div>`);
    } else {
      setResult(`<div class="result-card error"><div style="font-size:36px;margin-bottom:8px;">❌</div><div style="font-size:14px;color:var(--text-dim);">บันทึกไม่สำเร็จ — ${escHtml(data.message || "กรุณาลองใหม่")}</div></div>`);
    }
  } catch(err) {
    setResult(`<div class="result-card error"><div style="font-size:36px;margin-bottom:8px;">⚠️</div><div style="font-size:14px;color:var(--text-dim);">เชื่อมต่อช้า — ข้อมูลอาจยังบันทึกอยู่ กรุณาตรวจสอบใน Google Sheet</div></div>`);
  }
}

// ==================== FORMAT & DETAIL MODALS ====================
function formatDate(dateVal) {
  if (!dateVal) return "-";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleDateString("th-TH", { year: "numeric", month: "short", day: "numeric" });
}

function formatDateTime(dateVal) {
  if (!dateVal) return "-";
  const d = new Date(dateVal);
  if (isNaN(d.getTime())) return String(dateVal);
  return d.toLocaleString("th-TH", { year: "2-digit", month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}

function getStatusBadge(status) {
  const s = String(status).toLowerCase();
  if (s.includes("active"))      return '<span class="status-badge ok">ใช้งาน</span>';
  if (s.includes("inactive"))    return '<span class="status-badge bad">ไม่ใช้งาน</span>';
  if (s.includes("maintenance")) return '<span class="status-badge warn">ซ่อมบำรุง</span>';
  if (s.includes("check"))       return '<span class="status-badge ok">ตรวจสอบแล้ว</span>';
  if (s.includes("count"))       return '<span class="status-badge ok">นับแล้ว (Count)</span>';
  return `<span class="status-badge info">${escHtml(status || "-")}</span>`;
}

function getDirectDriveImageHtml(link) {
  if (!link) return "";
  const match = link.match(/\/d\/([a-zA-Z0-9_-]+)/);
  if (match && match[1]) {
    const fileId = match[1];
    const thumbUrl = `https://drive.google.com/thumbnail?id=${fileId}&sz=w800`;
    return `
      <div style="margin-top: 8px; text-align: center;">
        <a href="${link}" target="_blank" style="display:block;">
          <img src="${thumbUrl}" alt="Attached Image" style="max-width: 100%; border-radius: 8px; border: 1px solid var(--border); box-shadow: 0 4px 12px rgba(0,0,0,0.1); max-height: 250px; object-fit: contain; background: #f3f4f6;">
        </a>
        <div style="margin-top: 12px;">
          <a href="${link}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:8px 16px;background:var(--bg);color:var(--primary);border:1px solid var(--primary);border-radius:6px;text-decoration:none;font-weight:600;font-size:12px;transition:0.2s;">🔗 เปิดดูรูปภาพเต็มๆ ใน Google Drive</a>
        </div>
      </div>
    `;
  }
  // Fallback
  return `<a href="${link}" target="_blank" style="display:inline-flex;align-items:center;gap:6px;padding:10px 20px;background:var(--primary);color:white;border-radius:8px;text-decoration:none;font-weight:700;font-size:13px;width:100%;justify-content:center;box-shadow:0 4px 12px rgba(37,99,235,0.2);">📸 ดูรูปภาพแนบสติ๊กเกอร์เสียหาย</a>`;
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
  let imageLink = row ? (row[10] || "") : "";  // Column K: Image Link

  // Legacy fallback: Extract image from Result (old data)
  if (!imageLink && lastResultText.includes("(Image: ")) {
    const imgMatch = lastResultText.match(/\(Image:\s*(https?:\/\/[^\)]+)\)/);
    if (imgMatch) {
      imageLink = imgMatch[1];
      lastResultText = lastResultText.replace(/\(Image:\s*https?:\/\/[^\)]+\)/, "").trim();
    }
  }

  // Legacy fallback: Extract image from Remark (old data)
  if (!imageLink && remarkText.includes("(Image: ")) {
    const imgMatch = remarkText.match(/\(Image:\s*(https?:\/\/[^\)]+)\)/);
    if (imgMatch) {
      imageLink = imgMatch[1];
      remarkText = remarkText.replace(/\(Image:\s*https?:\/\/[^\)]+\)/, "").trim();
    }
  }
  
  // Legacy fallback: Extract remark from Result ("Confirmed from Unregistered: <remark>")
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

  document.getElementById("modal-overlay").classList.remove("hidden");
  document.body.style.overflow = "hidden";
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
  document.getElementById("modal-status").innerHTML          = `<span class="status-badge warn">นอกระบบ</span>`;
  document.getElementById("modal-last-scan").textContent     = formatDateTime(row[6]);
  document.getElementById("modal-last-result").textContent   = "Unregistered Asset";

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

  document.getElementById("modal-overlay").classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeModal() {
  document.getElementById("modal-overlay").classList.add("hidden");
  document.body.style.overflow = "";
}

function printModalLabel() {
  closeModal();
  printAssetLabel(currentModalAssetNo);
}

let manualImageBase64 = null;
let manualImageCompressToken = 0;
let manualAddMode = "choice";

function ensureManualNameEditable() {
  const nameInput = document.getElementById("manual-name");
  if (!nameInput) return null;
  nameInput.disabled = false;
  nameInput.readOnly = false;
  return nameInput;
}

function setManualAddMode(mode) {
  manualAddMode = ["lookup", "unknown-damaged", "damaged", "unregistered"].includes(mode) ? mode : "choice";
  const isChoice = manualAddMode === "choice";
  const isLookup = manualAddMode === "lookup";
  const isUnknownDamaged = manualAddMode === "unknown-damaged";
  const isDamaged = manualAddMode === "damaged";
  const isUnregistered = manualAddMode === "unregistered";

  const choiceActions = document.getElementById("manual-choice-actions");
  const damagedBtn = document.getElementById("manual-mode-damaged");
  const unregBtn = document.getElementById("manual-mode-unregistered");
  const modeTabs = document.querySelector("#modal-manual-add .manual-mode-tabs");
  const assetField = document.getElementById("manual-asset-no-field");
  const assetLabel = document.getElementById("manual-asset-no-label");
  const nameField = document.getElementById("manual-name-field");
  const nameInput = ensureManualNameEditable();
  const categoryField = document.getElementById("manual-category-field");
  const locGroupField = document.getElementById("manual-loc-group-field");
  const areaField = document.getElementById("manual-area-field");
  const statusField = document.getElementById("manual-status-field");
  const uploadField = document.getElementById("manual-upload-field");
  const note = document.getElementById("manual-mode-note");
  const subtitle = document.getElementById("manual-modal-subtitle");
  const submitBtn = document.getElementById("btn-manual-submit");
  const cancelBtn = submitBtn ? submitBtn.nextElementSibling : null;

  if (modeTabs) modeTabs.classList.add("hidden");
  if (choiceActions) choiceActions.classList.toggle("hidden", !isChoice);
  if (damagedBtn) damagedBtn.classList.toggle("active", isDamaged);
  if (unregBtn) unregBtn.classList.toggle("active", isUnregistered);
  if (assetField) assetField.classList.toggle("hidden", isUnknownDamaged || isChoice);
  if (assetLabel) assetLabel.innerHTML = (isDamaged || isLookup) ? 'รหัสทรัพย์สิน <span class="req">*</span>' : 'รหัสทรัพย์สิน';
  if (nameField) nameField.classList.toggle("hidden", isChoice || isLookup || isUnregistered);
  if (categoryField) categoryField.classList.toggle("hidden", isChoice || isLookup);
  if (locGroupField) locGroupField.classList.toggle("hidden", isChoice || isLookup);
  if (areaField) areaField.classList.toggle("hidden", isChoice || isLookup);
  if (statusField) statusField.classList.toggle("hidden", isChoice || isLookup || isUnknownDamaged);
  if (uploadField) uploadField.classList.toggle("hidden", isChoice || isLookup);
  if (categoryField) categoryField.style.display = (isChoice || isLookup || isUnknownDamaged) ? "none" : "";
  if (locGroupField) locGroupField.style.display = (isChoice || isLookup) ? "none" : "";
  if (areaField) areaField.style.display = (isChoice || isLookup) ? "none" : "";
  if (statusField) statusField.style.display = (isChoice || isLookup || isUnknownDamaged) ? "none" : "";
  if (uploadField) uploadField.style.display = (isChoice || isLookup) ? "none" : "block";
  if (nameInput && isUnknownDamaged) nameInput.value = "บาร์โค้ดเสียหาย ไม่ทราบรหัส";

  if (note) {
    note.textContent = isChoice
      ? "เลือกประเภทปัญหาบาร์โค้ดก่อน เพื่อเปิดชุดข้อมูลที่ต้องกรอกให้ถูกต้อง"
      : isLookup
      ? "กรอกรหัสเพื่อค้นหาสินค้าในระบบก่อน หากไม่พบ ระบบจะพาไปบันทึกสินค้านอกระบบ"
      : isUnknownDamaged
      ? "ใช้เมื่อบาร์โค้ดเสียหายจนไม่ทราบรหัส ให้เลือกตำแหน่งและถ่ายรูปเพื่อรอตรวจสอบจับคู่ภายหลัง"
      : isDamaged
      ? "ใช้เมื่อทรัพย์สินมีอยู่ในระบบ แต่บาร์โค้ด/ป้ายเสียหาย ให้กรอกรหัสเพื่อค้นหาและบันทึกการตรวจนับ"
      : "ใช้เมื่อเป็นสินค้านอกระบบจริง จะใส่รหัสทรัพย์สินหรือเว้นว่างก็ได้ หากเว้นว่างระบบจะสร้างรหัสชั่วคราว TEMP ให้อัตโนมัติ";
  }

  // 🔥 [UI Improvement] Dynamic Modal Header Title & Icon based on Action
  const modalHeader = document.querySelector("#modal-manual-add .modal-header");
  if (modalHeader) {
    const titleEl = modalHeader.querySelector(".modal-title");
    const iconContainer = modalHeader.querySelector(".modal-icon");
    if (titleEl) {
      if (isUnregistered) {
        titleEl.textContent = "บันทึกทรัพย์สินนอกระบบ (NEW ITEM)";
      } else if (isUnknownDamaged) {
        titleEl.textContent = "บาร์โค้ดเสียหาย - ไม่ทราบรหัส";
      } else {
        titleEl.textContent = "บันทึกสินค้าบาร์โค้ดเสียหาย";
      }
    }
    if (iconContainer) {
      if (isUnregistered) {
        iconContainer.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--danger);"><path d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"></path></svg>`;
      } else {
        iconContainer.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--warning);"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"></path><circle cx="12" cy="13" r="4"></circle></svg>`;
      }
    }
  }

  if (subtitle) {
    subtitle.textContent = isChoice 
      ? "เลือกประเภทปัญหา" 
      : isLookup 
      ? "ค้นหาจากรหัสเดิมและบันทึกการตรวจนับ" 
      : isUnregistered 
      ? "เพิ่มรายการสินค้าใหม่นอกระบบไปยังฐานข้อมูล" 
      : "ถ่ายรูปและบันทึกเป็นรายการรอตรวจสอบ";
  }
  if (submitBtn) {
    submitBtn.classList.toggle("hidden", isChoice);
    submitBtn.style.display = isChoice ? "none" : "inline-flex";
    submitBtn.disabled = false;
    submitBtn.innerHTML = isLookup
      ? '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><circle cx="11" cy="11" r="8"></circle><path d="M21 21l-4.35-4.35"></path></svg> ค้นหาสินค้าในระบบ'
      : '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"></path><polyline points="17 21 17 13 7 13 7 21"></polyline><polyline points="7 3 7 8 15 8"></polyline></svg> บันทึกและอัปโหลด';
  }
  if (cancelBtn) {
    cancelBtn.classList.toggle("btn-full", isChoice);
    cancelBtn.style.width = isChoice ? "100%" : "";
  }
}

function openInspectSearchModal() {
  document.getElementById("inspect-search-input").value = "";
  document.getElementById("inspect-search-loading").style.display = "none";
  document.getElementById("inspect-search-error").style.display = "none";
  document.getElementById("modal-inspect-search").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  
  // Auto focus input
  setTimeout(() => {
    document.getElementById("inspect-search-input").focus();
  }, 150);
}

function closeInspectSearchModal() {
  document.getElementById("modal-inspect-search").classList.add("hidden");
  document.body.style.overflow = "";
}

async function performInspectSearch() {
  const assetNoInput = document.getElementById("inspect-search-input").value.trim().toUpperCase();
  if (!assetNoInput) {
    showInspectError("กรุณากรอกรหัสทรัพย์สิน");
    return;
  }
  
  showInspectLoading(true);
  
  try {
    // Query lookup API to get live data (and images)
    const lookupData = await fetchAssetLookupWithTimeout(assetNoInput, 15000);
    
    showInspectLoading(false);
    
    if (lookupData && lookupData.status === "success" && lookupData.found) {
      if (lookupData.isUnregistered) {
        // Cache the lookup results into allUnregAssets so viewUnregAssetDetail can read them
        const unregRowData = [
          lookupData.assetNo,
          lookupData.assetName || "-",
          lookupData.category || "-",
          lookupData.warehouse || "-",
          lookupData.area || "-",
          lookupData.remark || "",
          lookupData.dateAdded || lookupData.lastScan || new Date().toISOString(),
          lookupData.imageUrl || "",
          lookupData.unregStatus || "Pending",
          lookupData.assetStatus || ""
        ];
        const existsIndex = allUnregAssets.findIndex(r => String(r[0]).trim().toUpperCase() === lookupData.assetNo.toUpperCase());
        if (existsIndex > -1) {
          allUnregAssets[existsIndex] = unregRowData;
        } else {
          allUnregAssets.push(unregRowData);
        }
        closeInspectSearchModal();
        viewUnregAssetDetail(lookupData.assetNo);
      } else {
        // Cache the lookup results into allAssets so viewAssetDetail can read them
        const rowData = [
          lookupData.assetNo,
          lookupData.assetName || "-",
          lookupData.category || "-",
          lookupData.area || "-",
          lookupData.warehouse || "-",
          lookupData.acquisitionDate || "",
          lookupData.assetStatus || "",
          lookupData.lastScan || "",
          lookupData.lastResult || "",
          lookupData.remark || "",
          lookupData.imageUrl || ""
        ];
        const existsIndex = allAssets.findIndex(r => String(r[0]).trim().toUpperCase() === lookupData.assetNo.toUpperCase());
        if (existsIndex > -1) {
          allAssets[existsIndex] = rowData;
        } else {
          allAssets.push(rowData);
        }
        closeInspectSearchModal();
        viewAssetDetail(lookupData.assetNo);
      }
    } else {
      showInspectError("ไม่พบรหัสทรัพย์สินนี้ในระบบ");
    }
  } catch (err) {
    showInspectLoading(false);
    showInspectError("การเชื่อมต่อล้มเหลว หรือรหัสผิดพลาด");
    console.error("Inspect Search Error:", err);
  }
}

function showInspectLoading(show) {
  document.getElementById("inspect-search-loading").style.display = show ? "block" : "none";
  document.getElementById("inspect-search-error").style.display = "none";
}

function showInspectError(msg) {
  const errDiv = document.getElementById("inspect-search-error");
  errDiv.textContent = msg;
  errDiv.style.display = "block";
}

function openManualAddModal(prefillAssetNo = "", mode = "choice") {
  document.getElementById("modal-manual-add").classList.remove("hidden");
  document.body.style.overflow = "hidden";
  document.getElementById("manual-asset-no").value = typeof prefillAssetNo === "string" ? prefillAssetNo.trim() : "";
  setManualAddMode(mode);
  setTimeout(() => {
    const focusEl = mode === "choice" ? document.querySelector("#manual-choice-actions button") : document.getElementById("manual-asset-no");
    if (focusEl) focusEl.focus();
  }, 50);
}

function closeManualAddModal() {
  document.getElementById("modal-manual-add").classList.add("hidden");
  document.body.style.overflow = "";
  document.getElementById("manual-asset-no").value = "";
  const nameInput = ensureManualNameEditable();
  if (nameInput) nameInput.value = "";
  document.getElementById("manual-category").value = "";
  document.getElementById("manual-loc-group").value = "";
  if (document.getElementById("manual-station-field")) {
    document.getElementById("manual-station-field").classList.add("hidden");
    document.getElementById("manual-station").innerHTML = '<option value="">เลือกแผนก</option>';
  }
  document.getElementById("manual-area").innerHTML = '<option value="">โปรดเลือกโซนหลักก่อน</option>';
  document.getElementById("manual-status").value = "ใช้งานอยู่";
  document.getElementById("manual-image").value = "";
  manualImageCompressToken++;
  manualImageBase64 = null;
  document.getElementById("manual-preview-container").classList.add("hidden");
  document.getElementById("manual-upload-placeholder").classList.remove("hidden");
  const btn = document.getElementById("btn-manual-submit");
  if (btn) btn.disabled = false;
  setManualAddMode("choice");
}

function previewManualImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  const token = ++manualImageCompressToken;
  const btn = document.getElementById("btn-manual-submit");
  if (btn) {
    btn.disabled = true;
    btn.textContent = "กำลังเตรียมรูป...";
  }
  const previewUrl = URL.createObjectURL(file);
  const preview = document.getElementById("manual-image-preview");
  preview.onload = () => URL.revokeObjectURL(previewUrl);
  preview.src = previewUrl;
  document.getElementById("manual-upload-placeholder").classList.add("hidden");
  document.getElementById("manual-preview-container").classList.remove("hidden");
  compressImageToBase64(file)
    .then(base64 => {
      if (token !== manualImageCompressToken) return;
      manualImageBase64 = base64;
      if (btn) {
        btn.disabled = false;
        setManualAddMode(manualAddMode);
      }
    })
    .catch(() => {
      if (token !== manualImageCompressToken) return;
      manualImageBase64 = null;
      if (btn) {
        btn.disabled = false;
        setManualAddMode(manualAddMode);
      }
      alert("ไม่สามารถเตรียมรูปภาพได้ กรุณาถ่ายใหม่อีกครั้ง");
    });
}

async function submitManualAdd() {
  const isLookupMode = manualAddMode === "lookup";
  const isUnknownDamagedMode = manualAddMode === "unknown-damaged";
  const isDamagedMode = manualAddMode === "damaged";
  const assetNo = String(document.getElementById("manual-asset-no").value || "").trim().toUpperCase();
  const assetNameInput = String(document.getElementById("manual-name").value || "").trim();
  const assetName = isDamagedMode ? assetNameInput : (isUnknownDamagedMode ? "บาร์โค้ดเสียหาย ไม่ทราบรหัส" : "สินค้านอกระบบ");
  const category = isUnknownDamagedMode ? "UNKNOWN" : document.getElementById("manual-category").value;
  const group = document.getElementById("manual-loc-group").value;
  const zone = document.getElementById("manual-area").value;
  const status = document.getElementById("manual-status").value;
  const remarks = isUnknownDamagedMode ? "บาร์โค้ดเสียหาย ไม่ทราบรหัส - รอตรวจสอบจับคู่ทรัพย์สินเดิม" : "";
  const btn = document.getElementById("btn-manual-submit");

  if (isLookupMode) {
    if (!assetNo) {
      alert("❌ กรุณากรอกรหัสทรัพย์สินเพื่อค้นหา");
      document.getElementById("manual-asset-no").focus();
      return;
    }
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-sm" style="margin-right:6px;"></span>กำลังค้นหา...';
    try {
      const lookupData = await fetchAssetLookupWithTimeout(assetNo, 15000);
      btn.disabled = false;
      setManualAddMode("lookup");
      if (lookupData && lookupData.status === "success" && lookupData.found && !lookupData.isUnregistered) {
        closeManualAddModal();
        lookupData.isBarcodeDamagedFlow = true;
        showStockCountModal(lookupData);
        return;
      }
      if (lookupData && lookupData.status === "success" && lookupData.found && lookupData.isUnregistered) {
        closeManualAddModal();
        showUnregExistsModal(lookupData);
        return;
      }
      setManualAddMode("unregistered");
      document.getElementById("manual-asset-no").value = assetNo;
      document.getElementById("manual-category").focus();
      return;
    } catch (error) {
      btn.disabled = false;
      setManualAddMode("lookup");
      alert("❌ ค้นหาไม่สำเร็จ: " + (error.message || error.toString()));
      return;
    }
  }

  if (isDamagedMode && !assetNo) {
    alert("❌ กรุณากรอกรหัสทรัพย์สินสำหรับโหมดบาร์โค้ดเสียหาย");
    document.getElementById("manual-asset-no").focus();
    return;
  }
  if (isDamagedMode && !assetNameInput) {
    alert("❌ กรุณากรอกชื่อหรือโมเดลสินค้า");
    document.getElementById("manual-name").focus();
    return;
  }
  if (!isDamagedMode && !isUnknownDamagedMode && !category) {
    alert("❌ กรุณาเลือกหมวดหมู่");
    return;
  }
  if (!group || !zone) {
    alert("❌ กรุณาเลือกคลังและโซน");
    return;
  }
  if (!manualImageBase64) {
    alert("❌ กรุณาถ่าย/อัปโหลดรูปภาพก่อนบันทึก");
    return;
  }

  let masterAsset = null;
  if (isDamagedMode) {
    try {
      const lookupData = await fetchAssetLookupWithTimeout(assetNo, 15000);
      if (lookupData && lookupData.status === "success" && lookupData.found) masterAsset = lookupData;
    } catch (e) {}
    if (!masterAsset || masterAsset.isUnregistered) {
      if (masterAsset && masterAsset.isUnregistered) {
        closeManualAddModal();
        showUnregExistsModal(masterAsset);
        return;
      }
      alert("❌ ไม่พบรหัสนี้ในระบบหลัก กรุณาตรวจสอบรหัส หรือใช้โหมดสินค้านอกระบบหากเป็นสินค้าใหม่จริง");
      document.getElementById("manual-asset-no").focus();
      return;
    }
  }

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-sm" style="margin-right:6px;"></span>กำลังบันทึก...';

  const payload = isDamagedMode
    ? {
        key: API_SECRET,
        action: "uploadScanImage",
        assetNo,
        assetName: masterAsset.assetName || assetName,
        warehouse: masterAsset.warehouse || group,
        area: masterAsset.area || zone,
        status,
        countRound: getSelectedCountRound(),
        image: manualImageBase64,
        isScan: true,
        isUnregistered: false,
        remarks: "บาร์โค้ดเสียหาย แต่ยังเห็นรหัส"
      }
    : {
        key: API_SECRET,
        action: "upload",
        image: manualImageBase64,
        assetNo,
        assetName,
        category,
        warehouse: group,
        area: zone,
        status,
        remarks
      };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      body: JSON.stringify(payload),
      headers: { "Content-Type": "text/plain;charset=utf-8" }
    });
    const data = await response.json().catch(() => null);
    if (isDamagedMode && data && data.status === "success") {
      closeManualAddModal();
      showSuccess({
        assetNo,
        assetName: masterAsset.assetName || assetName,
        category: masterAsset.category || "",
        warehouse: masterAsset.warehouse || group,
        area: masterAsset.area || zone,
        lastScan: data.timestamp || "",
        lastResult: "Count",
        isUnregistered: false
      });
      return;
    }
    if (!isDamagedMode && data && data.status === "exists" && data.isUnregistered === false) {
      closeManualAddModal();
      alert("Asset already exists in master list: " + (data.assetNo || assetNo));
      showSuccess({
        assetNo: data.assetNo || assetNo,
        assetName: data.assetName || assetName,
        category: data.category || category,
        warehouse: data.warehouse || group,
        area: data.area || zone,
        isUnregistered: false
      });
      return;
    }
    if (!isDamagedMode && data && (data.status === "success" || data.status === "exists")) {
      closeManualAddModal();
      showUnregExistsModal({
        assetNo: data.assetNo || assetNo || "TEMP",
        assetName: data.assetName || assetName,
        category: data.category || category,
        warehouse: data.warehouse || group,
        area: data.area || zone,
        remark: data.remark || remarks,
        imageUrl: data.imageUrl || "",
        isUnregistered: true
      });
      return;
    }
    alert("❌ บันทึกไม่สำเร็จ: " + (data ? data.message : "ไม่มีข้อความตอบกลับ"));
    btn.disabled = false;
    setManualAddMode(manualAddMode);
  } catch (error) {
    alert("❌ เกิดข้อผิดพลาดในการเชื่อมต่อ: " + error.toString());
    btn.disabled = false;
    setManualAddMode(manualAddMode);
  }
}

// ==================== LOCATION DROPDOWN LOGIC ====================
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

const LOCATION_DATA = {
  "WHD": ["โซน WHD Overflow", "โซน WHD Selective"],
  "Office": ["ห้องประชุม A1", "ห้องประชุม A2", "ห้องผู้บริหาร A3", "ห้องผู้บริหาร A4", "ห้องผู้บริหาร A5", "ห้องผู้บริหาร A6","Center room","ห้องอาหาร"],
  "HR": ["ห้องบุคคล"]
};

function updateGroupZones(groupSelectId, stationFieldId, stationSelectId, zoneSelectId) {
  const group = document.getElementById(groupSelectId).value;
  const stationField = document.getElementById(stationFieldId);
  const stationSelect = document.getElementById(stationSelectId);
  const zoneSelect = document.getElementById(zoneSelectId);
  
  const defaultZoneText = zoneSelectId.startsWith("scan-update") ? "ไม่เปลี่ยน" : "เลือกพื้นที่ย่อย";
  const defaultStationText = "เลือกแผนก";
  
  stationSelect.innerHTML = `<option value="">${defaultStationText}</option>`;
  zoneSelect.innerHTML = `<option value="">${defaultZoneText}</option>`;
  
  if (group === "Warehouse A" || group === "Warehouse B") {
    stationField.classList.remove("hidden");
    zoneSelect.innerHTML = `<option value="">โปรดเลือกแผนกก่อน</option>`;
    
    const stations = group === "Warehouse A" ? WAREHOUSE_A_STATIONS : WAREHOUSE_B_STATIONS;
    Object.keys(stations).forEach(station => {
      const opt = document.createElement('option');
      opt.value = station;
      opt.textContent = station;
      stationSelect.appendChild(opt);
    });
  } else {
    stationField.classList.add("hidden");
    stationSelect.value = "";
    
    if (LOCATION_DATA[group]) {
      LOCATION_DATA[group].forEach(zone => {
        const opt = document.createElement('option');
        opt.value = zone;
        opt.textContent = zone;
        zoneSelect.appendChild(opt);
      });
    } else {
      const emptyText = groupSelectId.startsWith("scan-update") ? "ไม่เปลี่ยน" : "โปรดเลือกโซนหลักก่อน";
      zoneSelect.innerHTML = `<option value="">${emptyText}</option>`;
    }
  }
}

function updateStationZones(stationSelectId, zoneSelectId) {
  const station = document.getElementById(stationSelectId).value;
  const zoneSelect = document.getElementById(zoneSelectId);
  const defaultZoneText = zoneSelectId.startsWith("scan-update") ? "ไม่เปลี่ยน" : "เลือกพื้นที่ย่อย";
  zoneSelect.innerHTML = `<option value="">${defaultZoneText}</option>`;
  
  let groupSelectId = "";
  if (stationSelectId === "manual-station") groupSelectId = "manual-loc-group";
  else if (stationSelectId === "input-station") groupSelectId = "input-warehouse";
  else if (stationSelectId === "scan-update-station") groupSelectId = "scan-update-warehouse";
  
  const group = groupSelectId ? document.getElementById(groupSelectId).value : "";
  const stations = group === "Warehouse A" ? WAREHOUSE_A_STATIONS : (group === "Warehouse B" ? WAREHOUSE_B_STATIONS : null);
  
  if (station && stations && stations[station]) {
    stations[station].forEach(zone => {
      const opt = document.createElement('option');
      opt.value = zone;
      opt.textContent = zone;
      zoneSelect.appendChild(opt);
    });
  } else {
    const emptyText = zoneSelectId.startsWith("scan-update") ? "โปรดเลือกแผนกก่อน" : "โปรดเลือกแผนกก่อน";
    zoneSelect.innerHTML = `<option value="">${emptyText}</option>`;
  }
}

function updateManualZones() {
  updateGroupZones('manual-loc-group', 'manual-station-field', 'manual-station', 'manual-area');
}

function updateManualStationZones() {
  updateStationZones('manual-station', 'manual-area');
}

function updateAddZones() {
  updateGroupZones('input-warehouse', 'input-station-field', 'input-station', 'input-area');
}

function updateAddStationZones() {
  updateStationZones('input-station', 'input-area');
}

function updateScanZones() {
  updateGroupZones('scan-update-warehouse', 'scan-update-station-field', 'scan-update-station', 'scan-update-area');
}

function updateScanStationZones() {
  updateStationZones('scan-update-station', 'scan-update-area');
}

