// ==================== SCANNER ====================
function setResult(html) {
  const r1 = document.getElementById("result");
  const r2 = document.getElementById("result-handheld");
  if (r1) r1.innerHTML = html;
  if (r2) r2.innerHTML = html;
}
function showLoading(msg) {
  setResult("");
}

function showError(msg) {
  closeHandheldScanPopup();
  setResult(`
    <div class="result-card error">
      <div style="font-size:36px;margin-bottom:8px;">X</div>
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">ผิดพลาด</div>
      <div style="font-size:14px;color:var(--text-dim);margin-top:4px;">${escHtml(msg || "เกิดข้อผิดพลาด")}</div>
    </div>`);
}

// Escape HTML from scanned values before rendering.
function escHtml(str) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function yieldToUI() {
  return new Promise(resolve => {
    if (window.requestAnimationFrame) {
      requestAnimationFrame(() => setTimeout(resolve, 0));
    } else {
      setTimeout(resolve, 0);
    }
  });
}

let pendingScanData = null;

function showStockCountModal(data) {
  closeHandheldScanPopup();
  if (data && data.isUnregistered) {
    showUnregExistsModal(data);
    return;
  }
  pendingScanData = data;
  let statusText = "พบข้อมูลทรัพย์สิน - รอยืนยันการนับ";
  let badgeHtml = `<span style="display:inline-flex;align-items:center;gap:4px;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;margin-top:10px;text-transform:uppercase;background:#dbeafe;color:var(--primary);">รอยืนยันการนับ</span>`;
  const hasRealPhoto = !!(data.imageUrl || data.fileUrl || data.photoUrl || data.image);
  const isDamagedLabel = String(data.assetStatus || data.status || "").includes("ชำรุดเสียหาย") && hasRealPhoto;

  if (isAlreadyCounted(data)) {
    statusText = "พบข้อมูลทรัพย์สิน (นับแล้วในรอบนี้)";
    badgeHtml = `<span style="display:inline-flex;align-items:center;gap:4px;padding:6px 14px;border-radius:999px;font-size:11px;font-weight:700;margin-top:10px;text-transform:uppercase;background:#dcfce7;color:var(--success);">นับแล้ว (Count)</span>`;
  }

  setResult(`
    <div class="result-card success">
      <div style="font-size:36px;margin-bottom:8px;">OK</div>
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">${statusText}</div>
      <div style="font-size:22px;font-weight:800;margin-top:4px;">${escHtml(data.assetNo)}</div>
      ${badgeHtml}
    </div>`);

  document.getElementById("scan-confirm-assetno").textContent = data.assetNo;
  document.getElementById("scan-confirm-name").textContent = data.assetName || "-";
  document.getElementById("scan-confirm-cat").textContent = data.category || "-";
  document.getElementById("scan-confirm-area").textContent = data.area || "-";
  document.getElementById("scan-confirm-wh").textContent = data.warehouse || "-";

  document.getElementById("scan-update-warehouse").value = "";
  if (document.getElementById("scan-update-station-field")) {
    document.getElementById("scan-update-station-field").classList.add("hidden");
    document.getElementById("scan-update-station").innerHTML = '<option value="">เลือกแผนก</option>';
  }
  document.getElementById("scan-update-area").innerHTML = '<option value="">ไม่เปลี่ยน</option>';
  document.getElementById("scan-update-status").value = "";
  const c1Name = getCurrentCountColName("1");
  const c2Name = getCurrentCountColName("2");
  const c1Idx = exportHeaders.indexOf(c1Name);
  const c2Idx = exportHeaders.indexOf(c2Name);
  
  const localAsset = allAssets.find(row => String(row[0]).trim().toUpperCase() === String(data.assetNo).trim().toUpperCase());
  const localVal1 = localAsset && c1Idx !== -1 ? String(localAsset[c1Idx] || "").trim() : "";
  const localVal2 = localAsset && c2Idx !== -1 ? String(localAsset[c2Idx] || "").trim() : "";
  const hasCount1 = (data.hasCount1 !== undefined) ? data.hasCount1 : (localVal1 === "Count" || localVal1 === "Checked");
  const hasCount2 = (data.hasCount2 !== undefined) ? data.hasCount2 : (localVal2 === "Count" || localVal2 === "Checked");

  const roundSelect = document.getElementById("scan-count-round");
  const opt1 = roundSelect.querySelector('option[value="1"]');
  const opt2 = roundSelect.querySelector('option[value="2"]');

  opt1.disabled = false;
  opt2.disabled = false;

  // Enforce count round selection based on current count state.
  if (!hasCount1 && !hasCount2) {
    // First pass only.
    opt2.disabled = true;
    roundSelect.value = "1";
  } else if (hasCount1 && !hasCount2) {
    // Second pass after Count 1 is done.
    opt1.disabled = true;
    roundSelect.value = "2";
  } else if (hasCount1 && hasCount2) {
    // Both passes are complete.
    opt1.disabled = true;
    opt2.disabled = true;
    roundSelect.value = "1";
  } else {
    // Fallback state.
    opt1.disabled = false;
    opt2.disabled = false;
    roundSelect.value = "1";
  }

  document.getElementById("scan-update-image").value = "";
  document.getElementById("scan-img-preview-container").classList.add("hidden");
  document.getElementById("scan-img-placeholder").style.display = "";
  
  const btn = document.getElementById("btn-scan-confirm");
  if (hasCount1 && hasCount2) {
    btn.disabled = true;
    btn.innerHTML = 'นับครบทุกรอบแล้ว';
  } else {
    btn.disabled = false;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><polyline points="20 6 9 17 4 12"></polyline></svg> ยืนยันนับสต๊อก';
  }

  const confirmModal = document.getElementById("modal-scan-confirm");
  if (currentPage === "handheld") {
    confirmModal.classList.add("handheld-layout");
  } else {
    confirmModal.classList.remove("handheld-layout");
  }
  confirmModal.classList.remove("hidden");
}

function showSuccess(data) {
  return showStockCountModal(data);
}

function closeScanConfirmModal() {
  document.getElementById("modal-scan-confirm").classList.add("hidden");
  if (currentPage === "handheld") {
    setTimeout(() => {
      const hhInput = document.getElementById("handheld-input");
      if (hhInput) hhInput.focus();
    }, 100);
  } else if (currentPage === "scan" && html5QrCode && isScanning) {
    setTimeout(() => {
      try { html5QrCode.resume(); } catch(e) {}
    }, 150);
  }
}

function resumeScannerAfterAction() {
  isProcessing = false;
  if (currentPage === "scan" && html5QrCode && isScanning) {
    setTimeout(() => {
      try { html5QrCode.resume(); } catch(e) {}
    }, 150);
  }
}

function showUnregExistsModal(data) {
  closeHandheldScanPopup();
  document.getElementById("unreg-exists-assetno").textContent = data.assetNo || "-";
  document.getElementById("unreg-exists-name").textContent = data.assetName || "-";
  document.getElementById("unreg-exists-cat").textContent = data.category || "-";
  document.getElementById("unreg-exists-wh").textContent = (data.warehouse || "-") + " / " + (data.area || "-");
  document.getElementById("unreg-exists-remark").textContent = data.remark || "-";
  
  document.getElementById("modal-unreg-exists").classList.remove("hidden");
}

function closeUnregExistsModal() {
  document.getElementById("modal-unreg-exists").classList.add("hidden");
  if (currentPage === "handheld") {
    setTimeout(() => {
      const hhInput = document.getElementById("handheld-input");
      if (hhInput) {
        setHandheldDisplay(HANDHELD_PLACEHOLDER, true);
        hhInput.focus();
      }
    }, 100);
  } else if (currentPage === "scan") {
    if (html5QrCode && isScanning) {
      setTimeout(() => {
        try { html5QrCode.resume(); } catch(e){}
      }, 500);
    }
  }
}

function closeIosFastScanModal(startScan = false) {
  document.getElementById("modal-ios-fastscan").classList.add("hidden");
  localStorage.setItem('iosFastScanTipShown', 'true');
  if (startScan) {
    startScanner();
  }
}

async function applyCameraFocus() {
  const videoEl = document.querySelector("#reader video");
  if (!videoEl || !videoEl.srcObject) return;
  const tracks = videoEl.srcObject.getVideoTracks();
  if (!tracks.length) return;
  const track = tracks[0];
  if (typeof track.getCapabilities !== "function" || typeof track.applyConstraints !== "function") return;

  const capabilities = track.getCapabilities();
  const advanced = [];

  if (capabilities.focusMode && Array.isArray(capabilities.focusMode) && capabilities.focusMode.includes("continuous")) {
    advanced.push({ focusMode: "continuous" });
  }
  if (capabilities.exposureMode && Array.isArray(capabilities.exposureMode) && capabilities.exposureMode.includes("continuous")) {
    advanced.push({ exposureMode: "continuous" });
  }
  if (capabilities.whiteBalanceMode && Array.isArray(capabilities.whiteBalanceMode) && capabilities.whiteBalanceMode.includes("continuous")) {
    advanced.push({ whiteBalanceMode: "continuous" });
  }
  if (capabilities.zoom && typeof capabilities.zoom.min === "number") {
    const zoomValue = Math.min(capabilities.zoom.max || 2, Math.max(capabilities.zoom.min || 1, 1.2));
    advanced.push({ zoom: zoomValue });
  }

  // Force add torch constraint to try enabling the flash
  const advancedWithTorch = [...advanced, { torch: true }];

  try {
    // Try with torch first
    await track.applyConstraints({ advanced: advancedWithTorch });
  } catch (torchErr) {
    console.warn("Failed to apply constraints with torch, trying without torch...", torchErr);
    // Fallback to applying constraints without torch
    if (advanced.length) {
      try {
        await track.applyConstraints({ advanced });
      } catch (err) {
        console.warn("Camera focus constraints not applied", err);
      }
    }
  }
}

async function compressImageToBase64(file, maxSizeMB = 0.18) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement("canvas");
        const ctx = canvas.getContext("2d");
        let width = img.width;
        let height = img.height;
        
        // Resize once to keep compression predictable.
        const maxDim = 720;
        if (width > maxDim || height > maxDim) {
          const ratio = Math.min(maxDim / width, maxDim / height);
          width = Math.round(width * ratio);
          height = Math.round(height * ratio);
        }
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(img, 0, 0, width, height);
        
        // Binary search quality with a small fixed limit.
        let quality = 0.6;
        let base64String = canvas.toDataURL("image/jpeg", quality);
        let sizeMB = (base64String.length * 0.75) / (1024 * 1024);
        
        let minQuality = 0.1;
        let maxQuality = 0.6;
        let iterations = 0;
        const maxIterations = 3;
        
        while (sizeMB > maxSizeMB && iterations < maxIterations && quality > minQuality) {
          iterations++;
          if (sizeMB > maxSizeMB) {
            maxQuality = quality;
            quality = (minQuality + quality) / 2;
          } else {
            break;
          }
          base64String = canvas.toDataURL("image/jpeg", quality);
          sizeMB = (base64String.length * 0.75) / (1024 * 1024);
        }
        
        // If it is still too large, reduce dimensions once.
        if (sizeMB > maxSizeMB) {
          const newWidth = Math.round(width * 0.75);
          const newHeight = Math.round(height * 0.75);
          canvas.width = newWidth;
          canvas.height = newHeight;
          ctx.drawImage(img, 0, 0, newWidth, newHeight);
          base64String = canvas.toDataURL("image/jpeg", 0.5);
        }
        
        resolve(base64String.split(",")[1]);
      };
      img.onerror = reject;
      img.src = event.target.result;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function previewScanImage(event) {
  const file = event.target.files[0];
  if (!file) return;
  const previewUrl = URL.createObjectURL(file);
  const preview = document.getElementById("scan-img-preview");
  preview.onload = () => URL.revokeObjectURL(previewUrl);
  preview.src = previewUrl;
  document.getElementById("scan-img-preview-container").classList.remove("hidden");
  document.getElementById("scan-img-placeholder").style.display = "none";
}

/* ==================== BACKGROUND UPLOAD QUEUE ==================== */
const bgUploadQueue = [];
let isBgUploading = false;

function addBgUpload(payload) {
  bgUploadQueue.push(payload);
  renderBgUploadQueue();
  if (!isBgUploading) processBgUploadQueue();
}

async function processBgUploadQueue() {
  if (bgUploadQueue.length === 0) {
    isBgUploading = false;
    renderBgUploadQueue();
    return;
  }
  isBgUploading = true;
  renderBgUploadQueue();

  const payload = bgUploadQueue[0];
  let timerId = null;
  try {
    const controller = new AbortController();
    timerId = setTimeout(() => controller.abort(), 30000);
    await timedFetch("uploadScanImage", API_URL, {
      method: "POST",
      body: JSON.stringify(payload),
      signal: controller.signal
    }, { requestId: payload.requestId, assetNo: payload.assetNo, deferred: true });
  } catch(e) {
    console.warn("Background upload error", e);
  } finally {
    if (timerId) clearTimeout(timerId);
  }
  bgUploadQueue.shift();
  processBgUploadQueue();
}

function renderBgUploadQueue() {
  let ui = document.getElementById("bg-upload-ui");
  if (!ui) {
    ui = document.createElement("div");
    ui.id = "bg-upload-ui";
    ui.style.cssText = "position:fixed; bottom:75px; left:50%; transform:translateX(-50%); background:var(--primary); color:white; padding:8px 16px; border-radius:10px; font-size:12px; font-weight:bold; box-shadow:none; z-index:9999; display:none; pointer-events:none; transition:none;";
    document.body.appendChild(ui);
  }

  if (bgUploadQueue.length > 0) {
    ui.innerHTML = `<span class="spinner-sm" style="border-width:2px; width:12px; height:12px; margin-right:6px; border-top-color:#fff;"></span>กำลังบันทึกและอัปโหลดรูป (${bgUploadQueue.length} รายการ)`;
    ui.style.background = "var(--primary)";
    ui.style.display = "flex";
  } else {
    ui.innerHTML = `✓ อัปโหลดรูปเสร็จสิ้น`;
    ui.style.background = "var(--success)";
    setTimeout(() => {
      if (bgUploadQueue.length === 0) ui.style.display = "none";
    }, 2500);
  }
}

window.addEventListener("beforeunload", function (e) {
  if (bgUploadQueue.length > 0) {
    e.preventDefault();
    e.returnValue = "ยังมีรูปกำลังอัปโหลดอยู่เบื้องหลัง คุณแน่ใจหรือไม่ว่าจะออกจากหน้านี้?";
    return e.returnValue;
  }
});

async function uploadScanImageInBackground(file, meta) {
  if (!file || !meta || !meta.requestId || !meta.assetNo) return;
  try {
    const base64 = await compressImageToBase64(file);
    addBgUpload({
      key: API_SECRET,
      user: getCurrentUser(),
      action: "uploadScanImage",
      requestId: meta.requestId,
      assetNo: meta.assetNo,
      assetName: meta.assetName || "",
      image: base64
    });
  } catch (e) {
    console.warn("Background image upload error", e.message);
  }
}

async function confirmScanCount() {
  if (!pendingScanData) return;
  const requestId = "REQ-" + Date.now().toString(36).toUpperCase() + "-" + Math.random().toString(36).slice(2, 6).toUpperCase();
  // #region agent log
  dbgLog('index.html:confirmScanCount:entry', 'confirm scan', { assetNo: pendingScanData.assetNo, isUnregistered: !!pendingScanData.isUnregistered }, 'H1-H4');
  // #endregion
  const btn = document.getElementById("btn-scan-confirm");
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-sm" style="margin-right:6px;"></span>กำลังบันทึก...';

  const newWarehouse = document.getElementById("scan-update-warehouse").value;
  const newArea = document.getElementById("scan-update-area").value;
  const newStatus = document.getElementById("scan-update-status").value;
  const countRound = document.getElementById("scan-count-round").value || "1";
  const fileInput = document.getElementById("scan-update-image");
  const hasImage = fileInput.files && fileInput.files[0];
  const imageFile = hasImage ? fileInput.files[0] : null;
  const hasLocationUpdate = newWarehouse || newArea || newStatus;

  if (newWarehouse === "Warehouse A" || newWarehouse === "Warehouse B") {
    const station = document.getElementById("scan-update-station").value;
    if (!station || !newArea || newArea === "โปรดเลือกแผนกก่อน" || newArea === "ไม่เปลี่ยน") {
      alert("กรุณาเลือกแผนกและพื้นที่ย่อยสำหรับ " + newWarehouse);
      btn.disabled = false;
      btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><polyline points="20 6 9 17 4 12"></polyline></svg> ยืนยันนับสต็อก';
      return;
    }
  }

  try {
    await yieldToUI();

    // Single POST request for count mark, location update, and deferred image upload marker.
    const payload = {
      key: API_SECRET,
      user: getCurrentUser(),
      action: "updateAsset",
      requestId: requestId,
      clientSentAt: new Date().toISOString(),
      assetNo: pendingScanData.assetNo,
      assetName: pendingScanData.assetName || "",
      isScan: true,
      isUnregistered: pendingScanData.isUnregistered === true,
      warehouse: newWarehouse,
      area: newArea,
      status: newStatus,
      countRound: countRound,
      image: "",
      hasDeferredImage: !!imageFile,
      remarks: pendingScanData.isBarcodeDamagedFlow ? "บาร์โค้ดเสียหาย แต่ยังเห็นรหัส" : ""
    };

    const controller = new AbortController();
    let timerId = null;
    let uploadRes = null;
    try {
      timerId = setTimeout(() => controller.abort(), 18000);
      uploadRes = await timedFetch("updateAsset", API_URL, {
        method: "POST",
        body: JSON.stringify(payload),
        signal: controller.signal
      }, { requestId, assetNo: pendingScanData.assetNo, hasDeferredImage: !!imageFile });
    } catch (e) {
      if (e.name === "AbortError") throw new Error("หมดเวลาในการบันทึก - ตรวจสอบเครือข่าย");
      throw e;
    } finally {
      if (timerId) clearTimeout(timerId);
    }
    
    const uploadData = await uploadRes.json().catch(() => null);
    // #region agent log
    dbgLog('index.html:confirmScanCount:response', 'updateAsset response', { assetNo: pendingScanData.assetNo, status: uploadData && uploadData.status, message: uploadData && uploadData.message }, 'H1-H4');
    // #endregion
    if (!uploadData || uploadData.status === "error") {
      throw new Error(uploadData ? uploadData.message : "การตอบกลับไม่ถูกต้อง");
    }

    const imageUrl = uploadData.imageUrl || "";
    const responseRequestId = uploadData.requestId || requestId;
    const durationText = uploadData.durationMs ? ` (${Math.round(uploadData.durationMs / 1000)}s)` : "";

    // Update local data so UI reflects changes immediately
    if (pendingScanData.isUnregistered) {
      // Keep local cache updated after confirming an unregistered item.
      const newRow = [
        pendingScanData.assetNo,
        pendingScanData.assetName,
        pendingScanData.category || "",
        newArea || pendingScanData.area || "",
        newWarehouse || pendingScanData.warehouse || "",
        new Date().toISOString(),
        newStatus || "ใช้งานอยู่",
        new Date().toISOString(),
        "Unregistered",
        "",
        imageUrl
      ];
      allAssets.push(newRow);
      
      // Remove from allUnregAssets locally or mark as confirmed
      const unregIdx = allUnregAssets.findIndex(row => String(row[0]).trim().toUpperCase() === String(pendingScanData.assetNo).trim().toUpperCase());
      if (unregIdx > -1) {
        allUnregAssets[unregIdx][8] = "Confirmed";
      }
    } else {
      const assetIdx = allAssets.findIndex(row => String(row[0]).trim().toUpperCase() === String(pendingScanData.assetNo).trim().toUpperCase());
      // #region agent log
      dbgLog('index.html:confirmScanCount:localUpdate', 'local cache update', { assetNo: pendingScanData.assetNo, assetIdx }, 'H4');
      // #endregion
      if (assetIdx > -1) {
        allAssets[assetIdx][7] = new Date().toISOString();
        allAssets[assetIdx][8] = "Count";
        const roundColName = getCurrentCountColName(countRound);
        let roundColIndex = exportHeaders.indexOf(roundColName);
        if (roundColIndex === -1) {
          roundColIndex = exportHeaders.length;
          exportHeaders.push(roundColName);
        }
        while (allAssets[assetIdx].length <= roundColIndex) allAssets[assetIdx].push("");
        allAssets[assetIdx][roundColIndex] = "Count";
        if (newStatus) allAssets[assetIdx][6] = newStatus;
        if (newArea) allAssets[assetIdx][3] = newArea;
        if (newWarehouse) allAssets[assetIdx][4] = newWarehouse;
        if (imageUrl) allAssets[assetIdx][10] = imageUrl;
        if (pendingScanData.isBarcodeDamagedFlow) {
          allAssets[assetIdx][9] = "บาร์โค้ดเสียหาย แต่ยังเห็นรหัส";
        }
      }
    }

    closeScanConfirmModal();
    resumeScannerAfterAction();
    if (imageFile) {
      uploadScanImageInBackground(imageFile, {
        requestId: responseRequestId,
        assetNo: pendingScanData.assetNo,
        assetName: pendingScanData.assetName || ""
      });
    }
    setResult(`
      <div class="result-card success">
        <div style="font-size:36px;margin-bottom:8px;">✓</div>
        <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">นับสต็อกสำเร็จ</div>
        <div style="font-size:22px;font-weight:800;margin-top:4px;">${escHtml(pendingScanData.assetNo)}</div>
        <div style="font-size:14px;color:var(--text-dim);margin-top:4px;">${escHtml(pendingScanData.assetName)}</div>
        <div style="font-size:12px;color:var(--text-muted);margin-top:4px;">Ref: ${escHtml(responseRequestId)}${escHtml(durationText)}</div>
        <div style="font-size:12px;color:var(--success);margin-top:4px;">Count ${escHtml(countRound)}</div>
        ${hasLocationUpdate ? '<div style="font-size:12px;color:var(--primary);margin-top:6px;">อัปเดตตำแหน่งแล้ว</div>' : ''}
        ${imageFile ? '<div style="font-size:12px;color:var(--primary);margin-top:4px;">กำลังอัปโหลดรูปต่อในคิวเบื้องหลัง</div>' : ''}
      </div>`);
  } catch (err) {
    alert("เกิดข้อผิดพลาด: " + (err.message || "ไม่สามารถบันทึกได้"));
    btn.disabled = false;
    btn.innerHTML = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="margin-right:4px;"><polyline points="20 6 9 17 4 12"></polyline></svg> ยืนยันนับสต็อก';
    resumeScannerAfterAction();
  }
}

function showNotFound(assetNo) {
  closeHandheldScanPopup();
  const safeNo = escHtml(assetNo);
  const rawNo = String(assetNo).trim().toUpperCase();
  dbgLog('index.html:showNotFound', 'asset not found', { raw: rawNo, escaped: safeNo }, 'H3');
  setResult(`
    <div class="result-card warning">
      <div style="font-size:36px;margin-bottom:8px;">!</div>
      <div style="font-size:11px;color:var(--text-muted);text-transform:uppercase;">ไม่พบข้อมูลในระบบ (NEW ITEM)</div>
      <div style="font-size:22px;font-weight:800;margin-top:4px;color:var(--warning);">${safeNo}</div>
      <div style="font-size:14px;color:var(--text-dim);margin-top:4px;">รหัสนี้ยังไม่มีในระบบ (Over from system)</div>
      <button class="btn btn-gold" id="btn-notfound-add" style="margin-top:10px;width:auto;padding:10px 20px;font-size:12px;">ถ่ายรูปและเพิ่มข้อมูล</button>
    </div>`);
  const addBtn = document.getElementById("btn-notfound-add");
  if (addBtn) addBtn.onclick = () => showAddForm(rawNo);

  setTimeout(() => { showAddForm(rawNo); }, 500);
}

function decodeThaiKeyboard(str) {
  const th = "ๅ/-ภถุึคตจขชๆไำพะัีรนยบลฃฟหกดเ้่าสวงผปแอิืทมใฝ+๑๒๓๔ู฿๕๖๗๘๙๐\"ฎฑธํ๊ณฯญฐ,ฤฆฏโฌ็๋ษศซ.()ฉฮฺ์?ฒฬฦ";
  const en = "1234567890-=qwertyuiop[]\\asdfghjkl;'zxcvbnm,./!@#$%^&*()_+QWERTYUIOP{}|ASDFGHJKL:\"ZXCVBNM<>?";
  let result = "";
  for(let i=0; i<str.length; i++) {
    let char = str[i];
    let idx = th.indexOf(char);
    result += (idx !== -1) ? en[idx] : char;
  }
  return result;
}

async function onScanSuccess(decodedText, isHandheld = false) {
  if (isProcessing) return;
  isProcessing = true;
  
  // Convert Thai-keyboard input back to English asset codes.
  let cleanCode = decodeThaiKeyboard(String(decodedText)).trim().toUpperCase();
  
  if (html5QrCode && isScanning) { try { await html5QrCode.pause(true); } catch(e){} }
  
  // Instant local search first for scanner performance.
  const localMatch = allAssets.find(row => String(row[0]).trim().toUpperCase() === cleanCode);
  const unregMatch = allUnregAssets ? allUnregAssets.find(row => String(row[0]).trim().toUpperCase() === cleanCode) : null;

  if (localMatch || unregMatch) {
    // Show local data instantly!
    if (localMatch) {
      const data = {
        assetNo: localMatch[0],
        assetName: localMatch[1],
        category: localMatch[2],
        area: localMatch[3],
        warehouse: localMatch[4],
        acquisitionDate: localMatch[5],
        assetStatus: localMatch[6],
        lastResult: localMatch[8],
        lastScan: localMatch[7],
        isUnregistered: false
      };
      showSuccess(data);
    } else {
      const data = {
        assetNo: unregMatch[0],
        assetName: unregMatch[1],
        category: unregMatch[2],
        warehouse: unregMatch[3],
        area: unregMatch[4],
        remark: unregMatch[5]
      };
      showUnregExistsModal(data);
    }

    // Resume scanner quickly for smooth workflow
    setTimeout(async () => {
      isProcessing = false;
      if (html5QrCode && isScanning && !isHandheld) { try { await html5QrCode.resume(); } catch(e){} }
    }, isHandheld ? 50 : 800);

    // Run network check in the background (NON-BLOCKING) to check for updates or scanned status
    (async () => {
      try {
        const scanStatus = await fetchScanStatusWithTimeout(cleanCode, 4000);
        if (scanStatus && scanStatus.found) {
          const state = String(scanStatus.scanStatus || "").toLowerCase();
          if (state === "received" || state === "processing") {
            showScanStatusNotice(cleanCode, scanStatus);
            return;
          }
        }
        
        const liveLookup = await fetchAssetLookupWithTimeout(cleanCode, 5000);
        if (liveLookup && liveLookup.status === "success" && liveLookup.found) {
          const liveLastResult = liveLookup.lastResult;
          const liveLastScan = liveLookup.lastScan;
          if (localMatch) {
            localMatch[8] = liveLastResult;
            localMatch[7] = liveLastScan;
            const currentSuccessAsset = document.getElementById("success-asset-no");
            if (currentSuccessAsset && currentSuccessAsset.textContent === cleanCode) {
              const resField = document.getElementById("success-last-result");
              const scanField = document.getElementById("success-last-scan");
              if (resField) resField.textContent = liveLastResult === "Count" ? "ตรวจสอบแล้ว" : liveLastResult;
              if (scanField) scanField.textContent = formatDateTime(liveLastScan);
            }
          }
        }
      } catch (bgErr) {
        console.warn("Background lookup failed", bgErr);
      }
    })();

  } else {
    // Fallback read-only lookup when not found in local cache.
    setResult("");
    try {
      const scanStatusPromise = fetchScanStatusWithTimeout(cleanCode, isHandheld ? 1800 : 2500);
      const lookupPromise = fetchAssetLookup(cleanCode);
      const data = await lookupPromise;
      if (data && data.status === "success" && data.found) {
        if (data.isUnregistered) {
          showUnregExistsModal({
            assetNo: data.assetNo,
            assetName: data.assetName,
            category: data.category,
            warehouse: data.warehouse,
            area: data.area,
            remark: data.remark || ""
          });
        } else {
          const newAssetRow = [
            data.assetNo,
            data.assetName,
            data.category,
            data.area,
            data.warehouse,
            data.acquisitionDate,
            data.assetStatus,
            data.lastScan || "",
            data.lastResult || ""
          ];
          allAssets.push(newAssetRow);
          showSuccess({
            assetNo: data.assetNo,
            assetName: data.assetName,
            category: data.category,
            area: data.area,
            warehouse: data.warehouse,
            acquisitionDate: data.acquisitionDate,
            assetStatus: data.assetStatus,
            lastResult: data.lastResult,
            lastScan: data.lastScan,
            hasCount1: data.hasCount1,
            hasCount2: data.hasCount2
          });
        }
} else if (data && data.status === "error") {
        showError(data.message || "ไม่สามารถตรวจสอบกับเซิร์ฟเวอร์ได้");
      } else {
        const lateScanStatus = await Promise.race([
          scanStatusPromise,
          new Promise(resolve => setTimeout(() => resolve(null), isHandheld ? 350 : 600))
        ]);
        if (lateScanStatus && lateScanStatus.found) {
          const state = String(lateScanStatus.scanStatus || "").toLowerCase();
          if (state === "received" || state === "processing") {
            showScanStatusNotice(cleanCode, lateScanStatus);
            return;
          }
        }
        showNotFound(cleanCode);
      }
    } catch (err) {
      showNotFound(cleanCode);
    } finally {
      setTimeout(async () => {
        isProcessing = false;
        if (html5QrCode && isScanning) { try { await html5QrCode.resume(); } catch(e){} }
      }, 800);
    }
  }
}
const HANDHELD_PLACEHOLDER = "ยิงสแกนบาร์โค้ดที่นี่";
let handheldBuffer = "";
let lastHandheldTime = 0;
let handheldInputTimer = null;

function setHandheldDisplay(value, isPlaceholder = false) {
  const input = document.getElementById("handheld-input");
  if (!input) return;
  input.value = isPlaceholder ? "" : String(value || "");
  input.placeholder = isPlaceholder ? value : HANDHELD_PLACEHOLDER;
}

function playHandheldBeep() {
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gainNode.gain.value = 0.08;
    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);
    oscillator.start();
    setTimeout(() => {
      oscillator.stop();
      audioContext.close();
    }, 90);
  } catch (e) {}
}

function triggerPhotoScan() {
  const input = document.getElementById("scan-via-photo");
  if (input) input.click();
}

async function handlePhotoScan(event) {
  const file = event && event.target && event.target.files ? event.target.files[0] : null;
  if (!file) return;
  let tempHtml5QrCode = null;
  let needToClearTemp = false;
  try {
    showLoading("กำลังอ่านบาร์โค้ดจากรูปภาพ...");
    tempHtml5QrCode = new Html5Qrcode("reader");
    needToClearTemp = true;
    const decodedText = await tempHtml5QrCode.scanFile(file, true);
    await onScanSuccess(decodedText);
  } catch (err) {
    alert("ไม่สามารถถอดรหัสจากรูปภาพนี้ได้ กรุณาถ่ายให้ชัดและให้บาร์โค้ดอยู่ในกรอบภาพ");
    setResult("");
  } finally {
    if (needToClearTemp && tempHtml5QrCode) {
      try { await tempHtml5QrCode.clear(); } catch (e) {}
    }
    if (event && event.target) event.target.value = "";
  }
}

function getPreferredBackCamera(cameras) {
  if (!Array.isArray(cameras) || cameras.length === 0) return null;
  const backCamera = cameras.find(camera => /back|rear|environment/i.test(camera.label || ""));
  if (backCamera) return backCamera;

  // Mobile browsers often list the front camera first when labels are unavailable.
  return cameras[cameras.length - 1];
}

function getScannerConfig(withAspectRatio) {
  const config = { fps: 10, qrbox: { width: 250, height: 250 } };
  if (withAspectRatio) config.aspectRatio = 1.7777778;
  return config;
}

// html5-qrcode บางเวอร์ชัน reject ด้วย string ธรรมดา ไม่ใช่ Error object เสมอไป
// ถ้าไม่ดึงข้อความจริงออกมา ผู้ใช้จะเห็นแต่ข้อความ error กว้างๆ ที่ไม่ช่วยวินิจฉัยปัญหา
function extractCameraErrorMessage(err) {
  if (!err) return "ไม่สามารถเปิดกล้องได้";
  if (typeof err === "string") return err;
  if (err.message) return err.message;
  if (err.name) return err.name;
  try {
    const text = JSON.stringify(err);
    if (text && text !== "{}") return text;
  } catch (e) {}
  return "ไม่สามารถเปิดกล้องได้";
}

async function startScanner() {
  const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1);
  const isNativeSupported = ("BarcodeDetector" in window);

  if (isIOS && !isNativeSupported && !localStorage.getItem("iosFastScanTipShown")) {
    document.getElementById("modal-ios-fastscan").classList.remove("hidden");
    return;
  }

  if (isScanning) return;
  try {
    html5QrCode = html5QrCode || new Html5Qrcode("reader");
    const onDecoded = decodedText => onScanSuccess(decodedText);
    const onScanError = () => {};
    cachedCameraId = null;

    // ไล่ลองจาก config ที่ดีที่สุดไปจนถึงแบบหลวมที่สุด เพราะกล้อง/เบราว์เซอร์บางรุ่น (โดยเฉพาะรุ่นเก่า)
    // ปฏิเสธ constraint บางตัว เช่น aspectRatio แบบ hard-fail แม้ permission จะอนุญาตแล้วก็ตาม
    const attempts = [
      { label: "environment + aspectRatio", target: { facingMode: { ideal: "environment" } }, config: getScannerConfig(true) },
      { label: "environment (no aspectRatio)", target: { facingMode: { ideal: "environment" } }, config: getScannerConfig(false) }
    ];

    let lastErr = null;
    for (const attempt of attempts) {
      try {
        await html5QrCode.start(attempt.target, attempt.config, onDecoded, onScanError);
        lastErr = null;
        break;
      } catch (err) {
        lastErr = err;
        console.warn("Camera start failed (" + attempt.label + ")", err);
      }
    }

    if (lastErr) {
      // สุดท้ายลองระบุกล้องเจาะจงด้วย deviceId แบบไม่มี aspectRatio
      try {
        const cameras = await Html5Qrcode.getCameras();
        if (!cameras || cameras.length === 0) throw new Error("ไม่พบกล้องในอุปกรณ์นี้");
        const preferredCamera = getPreferredBackCamera(cameras);
        cachedCameraId = preferredCamera ? preferredCamera.id : cameras[0].id;
        await html5QrCode.start(cachedCameraId, getScannerConfig(false), onDecoded, onScanError);
        lastErr = null;
      } catch (err) {
        console.warn("Camera start failed (deviceId fallback)", err);
        throw err;
      }
    }

    isScanning = true;
    const startBtn = document.getElementById("btn-start");
    const stopBtn = document.getElementById("btn-stop");
    if (startBtn) startBtn.classList.add("hidden");
    if (stopBtn) stopBtn.classList.remove("hidden");

    // สำรองไว้กรณีเบราว์เซอร์เก่าไม่รองรับ CSS :has() (ปกติ #reader:has(video) จะซ่อน placeholder ให้เอง)
    const placeholder = document.querySelector("#reader .scanner-placeholder");
    if (placeholder) placeholder.classList.add("hidden");

    try { await applyCameraFocus(); } catch (focusErr) { console.warn("applyCameraFocus failed", focusErr); }
  } catch (err) {
    showError(extractCameraErrorMessage(err));
    await stopScanner();
  }
}

// html5-qrcode's clear() ล้าง innerHTML ของ #reader ทั้งหมด (รวม placeholder/มุมกรอบที่เป็น static HTML เดิม)
// ต้องสร้างกลับเข้าไปใหม่ ไม่งั้นกล่องสแกนจะว่างเปล่าถาวรหลังปิด/สแกนไม่สำเร็จครั้งแรก
function resetReaderPlaceholder() {
  const reader = document.getElementById("reader");
  if (!reader || reader.querySelector(".scanner-placeholder")) return;
  reader.innerHTML = `
        <div class="scanner-placeholder">
          <div class="big-icon">📷</div>
          <p>แตะ "เปิดกล้อง" เพื่อสแกน</p>
        </div>
        <div class="corner tl"></div><div class="corner tr"></div>
        <div class="corner bl"></div><div class="corner br"></div>`;
}

async function stopScanner() {
  if (!html5QrCode) {
    isScanning = false;
    resetReaderPlaceholder();
    return;
  }
  try {
    if (isScanning) await html5QrCode.stop();
    await html5QrCode.clear();
  } catch (e) {
    console.warn("stopScanner failed", e);
  } finally {
    html5QrCode = null;
    isScanning = false;
    isProcessing = false;
    resetReaderPlaceholder();
    const startBtn = document.getElementById("btn-start");
    const stopBtn = document.getElementById("btn-stop");
    if (startBtn) startBtn.classList.remove("hidden");
    if (stopBtn) stopBtn.classList.add("hidden");
  }
}
function showHandheldAccepted(cleanCode) {
  const resultBox = document.getElementById("result-handheld");
  if (!resultBox) return;

  resultBox.innerHTML = `
    <div class="result-card warning">
      <div style="font-size:18px;font-weight:800;">รับรหัสแล้ว</div>
      <div style="margin-top:6px;font-size:24px;font-weight:900;color:var(--primary);word-break:break-word;">
        ${escHtml(cleanCode)}
      </div>
      <div style="margin-top:6px;font-size:13px;color:var(--text-muted);font-weight:600;">
        กำลังตรวจสอบข้อมูล...
      </div>
    </div>
  `;
}

function showHandheldScanPopup(cleanCode) {
  const popup = document.getElementById("handheld-scan-popup");
  const codeEl = document.getElementById("handheld-scan-popup-code");
  if (!popup || !codeEl) return;

  codeEl.textContent = cleanCode;
  popup.classList.remove("hidden");
}

function closeHandheldScanPopup() {
  const popup = document.getElementById("handheld-scan-popup");
  if (popup) {
    popup.classList.add("hidden");
  }
}

function hideHandheldKeyboard() {
  const handheldInput = document.getElementById("handheld-input");
  if (handheldInput) handheldInput.blur();

  const activeEl = document.activeElement;
  if (activeEl && ["INPUT", "TEXTAREA", "SELECT"].includes(activeEl.tagName)) {
    activeEl.blur();
  }
}

function hasOpenIndexPopup() {
  return !!document.querySelector(".modal-overlay:not(.hidden), .handheld-scan-popup:not(.hidden)");
}

function focusHandheldInputWhenReady() {
  if (currentPage !== "handheld" || hasOpenIndexPopup()) return;

  setTimeout(() => {
    if (currentPage !== "handheld" || hasOpenIndexPopup()) return;
    const hhInput = document.getElementById("handheld-input");
    if (hhInput) {
      setHandheldDisplay(HANDHELD_PLACEHOLDER, true);
      hhInput.focus();
    }
  }, 120);
}

function flashHandheldInput(sourceInput) {
  if (!sourceInput) return;

  sourceInput.style.borderColor = "var(--success)";
  sourceInput.style.boxShadow = "0 0 0 4px rgba(5, 150, 105, 0.14), inset 0 2px 4px rgba(0,0,0,0.05)";

  setTimeout(() => {
    sourceInput.style.borderColor = "var(--primary)";
    sourceInput.style.boxShadow = "inset 0 2px 4px rgba(0,0,0,0.05)";
  }, 350);
}

async function submitHandheldCode(code, sourceInput) {
  const cleanCode = String(code || "").trim();
  if (!cleanCode || cleanCode.length < 3) return;

  if (currentPage !== "handheld") {
    showPage("handheld");
  }

  hideHandheldKeyboard();
  showHandheldAccepted(cleanCode);
  showHandheldScanPopup(cleanCode);
  flashHandheldInput(sourceInput);
  playHandheldBeep();

  try {
    await onScanSuccess(cleanCode, true);
  } finally {
    handheldBuffer = "";

    if (sourceInput) {
      sourceInput.value = "";
    }

    focusHandheldInputWhenReady();
  }
}

document.addEventListener("keydown", function(e) {
  // Do not intercept typing inside form controls.
  if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
    return;
  }

  const currentTime = Date.now();
  if (currentTime - lastHandheldTime > 300) {
    handheldBuffer = "";
  }
  
  lastHandheldTime = currentTime;

  const isEnter = (e.key === "Enter" || e.keyCode === 13);
  
  if (isEnter) {
    if (handheldBuffer.length > 0) {
      e.preventDefault();
      submitHandheldCode(handheldBuffer, document.getElementById("handheld-input"));
    }
  } else if (e.key && e.key.length === 1) {
    handheldBuffer += e.key;
    setHandheldDisplay(handheldBuffer, false);

    if (handheldInputTimer) {
      clearTimeout(handheldInputTimer);
    }

    handheldInputTimer = setTimeout(() => {
      submitHandheldCode(handheldBuffer, document.getElementById("handheld-input"));
      handheldInputTimer = null;
    }, 250);
  }
});

// Dedicated listener for the handheld scanner input.
const handheldInput = document.getElementById('handheld-input');

handheldInput.addEventListener('keydown', function(e) {
  if (e.key === "Enter" || e.keyCode === 13 || e.key === "Tab" || e.keyCode === 9) {
    e.preventDefault();
    if (handheldInputTimer) {
      clearTimeout(handheldInputTimer);
      handheldInputTimer = null;
    }
    submitHandheldCode(this.value || handheldBuffer, this);
  }
});

handheldInput.addEventListener('input', function() {
  handheldBuffer = this.value;

  if (handheldInputTimer) {
    clearTimeout(handheldInputTimer);
  }

  handheldInputTimer = setTimeout(() => {
    submitHandheldCode(this.value, this);
    handheldInputTimer = null;
  }, 250);
});

setHandheldDisplay(HANDHELD_PLACEHOLDER, true);

// ==================== AUTH / LOGIN GATE ====================
function applyLoginUI() {
  const overlay = document.getElementById("login-overlay");
  const chip = document.getElementById("current-user-chip");
  const nameEl = document.getElementById("current-user-name");
  const user = getCurrentUser();

  if (user) {
    if (overlay) overlay.classList.add("hidden");
    if (chip) chip.classList.remove("hidden");
    if (nameEl) nameEl.textContent = user;
  } else {
    if (overlay) overlay.classList.remove("hidden");
    if (chip) chip.classList.add("hidden");
  }
}

async function handleLoginSubmit(event) {
  event.preventDefault();
  const usernameEl = document.getElementById("login-username");
  const passwordEl = document.getElementById("login-password");
  const errorEl = document.getElementById("login-error");
  const btn = document.getElementById("login-submit-btn");
  const username = (usernameEl.value || "").trim();
  const password = passwordEl.value || "";

  errorEl.classList.add("hidden");
  if (!username || !password) {
    errorEl.textContent = "กรุณากรอก Username และ Password";
    errorEl.classList.remove("hidden");
    return false;
  }

  btn.disabled = true;
  const originalLabel = btn.textContent;
  btn.textContent = "กำลังตรวจสอบ...";

  try {
    const result = await loginUser(username, password);
    if (result.ok) {
      passwordEl.value = "";
      applyLoginUI();
    } else {
      errorEl.textContent = result.message;
      errorEl.classList.remove("hidden");
    }
  } catch (e) {
    errorEl.textContent = "เชื่อมต่อ Backend ไม่สำเร็จ กรุณาลองใหม่อีกครั้ง";
    errorEl.classList.remove("hidden");
  } finally {
    btn.disabled = false;
    btn.textContent = originalLabel;
  }
  return false;
}

function confirmLogout() {
  if (confirm("ต้องการออกจากระบบหรือไม่?")) {
    logoutUser();
  }
}

applyLoginUI();

