// ==================== LABEL ====================
function updateLabelPreview() {
  const assetNo = document.getElementById("label-asset-no").value.trim().toUpperCase() || "OFF000000";
  const canvas  = document.getElementById("label-canvas");
  const ctx     = canvas.getContext("2d");

  // Reset background
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, 600, 380);

  // Outer Border
  ctx.strokeStyle = "#123c69";
  ctx.lineWidth = 4;
  ctx.strokeRect(2, 2, 596, 376);

  // Header Background (Navy Blue)
  ctx.fillStyle = "#123c69";
  ctx.fillRect(4, 4, 592, 72);

  // Logo box (Gold Circle)
  ctx.beginPath();
  ctx.arc(44, 40, 24, 0, 2 * Math.PI);
  ctx.fillStyle = "#9f6b2f";
  ctx.fill();

  // Logo "V" inside Circle
  ctx.fillStyle = "#ffffff";
  ctx.font = '900 32px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText("V", 44, 40);

  // Header Title
  ctx.textAlign = "left";
  ctx.fillStyle = "#ffffff";
  ctx.font = 'bold 20px "Segoe UI", Arial, sans-serif';
  ctx.fillText("VESPIARIO THAILAND", 80, 34);

  ctx.fillStyle = "#c08a3d";
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.fillText("ASSET MANAGEMENT SYSTEM", 80, 56);

  // Property info on the right
  ctx.textAlign = "right";
  ctx.fillStyle = "#ffffff";
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.fillText("PROPERTY OF", 576, 34);

  ctx.fillStyle = "#cbd5e1";
  ctx.font = '600 10px "Segoe UI", Arial, sans-serif';
  ctx.fillText("VESPIARIO (THAILAND) CO., LTD.", 576, 54);

  // Gold Divider Bar
  ctx.fillStyle = "#9f6b2f";
  ctx.fillRect(4, 76, 592, 4);

  // Reset text baseline
  ctx.textBaseline = "alphabetic";

  // Body content division line (Thin light gray line)
  ctx.strokeStyle = "#e2e8f0";
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(350, 95);
  ctx.lineTo(350, 315);
  ctx.stroke();

  // Left Column: Asset Detail
  ctx.textAlign = "left";
  ctx.fillStyle = "#8a929d";
  ctx.font = 'bold 11px "Segoe UI", Arial, sans-serif';
  ctx.fillText("ASSET ID / CODE", 24, 116);

  ctx.fillStyle = "#123c69";
  ctx.font = '900 28px "Segoe UI", Arial, sans-serif';
  ctx.fillText(assetNo, 24, 148, 300);

  // Barcode placement
  const bcCanvas = document.createElement("canvas");
  try {
    JsBarcode(bcCanvas, assetNo, { format: "CODE128", width: 2, height: 75, displayValue: false, margin: 0 });
    const bcWidth = bcCanvas.width;
    const drawX = 24 + Math.max(0, (300 - bcWidth) / 2); // Center barcode in left column
    ctx.drawImage(bcCanvas, drawX, 165);
    
    ctx.font = "bold 15px monospace";
    ctx.fillStyle = "#1f2933";
    ctx.textAlign = "center";
    ctx.fillText(assetNo, drawX + bcWidth / 2, 165 + 75 + 20);
  } catch(e) {
    ctx.font = "bold 14px sans-serif";
    ctx.fillStyle = "#dc2626";
    ctx.fillText("Barcode render error", 24, 200);
  }

  // Right Column: QR Code
  try {
    const qr = new QRious({ value: assetNo, size: 165, level: "H" });
    ctx.drawImage(qr.canvas, 395, 105);
    
    ctx.font = "bold 10px 'Segoe UI', Arial, sans-serif";
    ctx.fillStyle = "#8a929d";
    ctx.textAlign = "center";
    ctx.fillText("SCAN TO VERIFY", 395 + 165 / 2, 292);
  } catch(e) {
    ctx.font = "bold 14px sans-serif";
    ctx.fillStyle = "#dc2626";
    ctx.textAlign = "center";
    ctx.fillText("QR render error", 395 + 165 / 2, 180);
  }

  // Footer area
  ctx.fillStyle = "#9f6b2f";
  ctx.fillRect(4, 326, 592, 4);

  ctx.fillStyle = "#f8fafc";
  ctx.fillRect(4, 330, 592, 46);

  ctx.fillStyle = "#123c69";
  ctx.font = 'bold 15px "Segoe UI", Arial, sans-serif';
  ctx.textAlign = "center";
  ctx.fillText("VESPIARIO THAILAND ASSET TAG", 300, 360);
  ctx.textAlign = "left";
}

function printLabel() {
  const canvas  = document.getElementById("label-canvas");
  const assetNo = document.getElementById("label-asset-no").value.trim() || "label";
  const link    = document.createElement("a");
  link.download = `LABEL_${assetNo}.png`;
  link.href     = canvas.toDataURL("image/png");
  link.click();
  alert(`✅ บันทึก Label แล้ว\nไฟล์: LABEL_${assetNo}.png`);
}

function printAssetLabel(assetNo) {
  document.getElementById("label-asset-no").value = assetNo;
  document.querySelectorAll(".page").forEach(p => p.classList.add("hidden"));
  document.getElementById("page-label").classList.remove("hidden");
  updateLabelPreview();
}

