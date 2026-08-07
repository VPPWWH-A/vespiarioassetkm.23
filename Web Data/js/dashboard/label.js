function drawLabelOnCanvas(canvas, assetNo) {
  canvas.width = 600;
  canvas.height = 420;
  const ctx = canvas.getContext("2d");
  
  // Clear and Draw background
  ctx.fillStyle = "#ffffff"; ctx.fillRect(0,0,600,420);
  
  // Border
  ctx.strokeStyle = "#000"; ctx.lineWidth = 4; ctx.strokeRect(10,10,580,400);
  
  // Header Title - Centered
  ctx.fillStyle = "#000"; 
  ctx.font = "bold 26px Arial"; 
  ctx.textAlign = "center";
  ctx.fillText("VESPIARIO (THAILAND) CO., LTD.", 300, 52);
  
  // Horizontal divider line
  ctx.strokeStyle = "#ddd"; ctx.lineWidth = 1;
  ctx.beginPath(); ctx.moveTo(25, 70); ctx.lineTo(575, 70); ctx.stroke();
  
  // Vertical divider line - extended to 355px
  ctx.beginPath(); ctx.moveTo(390, 85); ctx.lineTo(390, 355); ctx.stroke();
  
  // Get asset details
  let name = "";
  
  const master = allAssets.find(r => String(r[0]).trim().toUpperCase() === String(assetNo).trim().toUpperCase());
  if (master) {
    name = String(master[1] || "").trim();
  } else {
    const unreg = allUnregAssets.find(r => String(r[0]).trim().toUpperCase() === String(assetNo).trim().toUpperCase());
    if (unreg) {
      name = String(unreg[1] || "").trim();
    }
  }
  
  // Draw Metadata (Left Column)
  ctx.textAlign = "left";
  ctx.fillStyle = "#000"; 
  ctx.font = "bold 22px Arial"; 
  ctx.fillText("Asset No: " + assetNo, 35, 115);
  
  ctx.font = "18px Arial";
  const nameLabel = name || "-";
  const maxWidth = 340;
  const linesToDraw = [];
  let currentLine = "";
  
  // Hybrid word wrap: wraps by word (spaces) for English, falls back to characters for long blocks (Thai)
  const words = nameLabel.split(" ");
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const wordWidth = ctx.measureText(word).width;
    if (wordWidth > maxWidth) {
      if (currentLine) {
        linesToDraw.push(currentLine);
        currentLine = "";
      }
      let temp = "";
      for (let c = 0; c < word.length; c++) {
         const testTemp = temp + word[c];
         if (ctx.measureText(testTemp).width > maxWidth) {
           linesToDraw.push(temp);
           temp = word[c];
         } else {
           temp = testTemp;
         }
      }
      currentLine = temp;
    } else {
      const testLine = currentLine ? currentLine + " " + word : word;
      const testWidth = ctx.measureText(testLine).width;
      if (testWidth > maxWidth) {
        linesToDraw.push(currentLine);
        currentLine = word;
      } else {
        currentLine = testLine;
      }
    }
  }
  if (currentLine) linesToDraw.push(currentLine);
  
  // Draw up to 2 lines of wrapped text, truncating with ... if it exceeds 2 lines
  let y = 152;
  const lineHeight = 24;
  if (linesToDraw.length > 2) {
    ctx.fillText(linesToDraw[0], 35, y);
    let secondLine = linesToDraw[1];
    if (secondLine.length > 3) {
      secondLine = secondLine.substring(0, secondLine.length - 3) + "...";
    }
    ctx.fillText(secondLine, 35, y + lineHeight);
  } else {
    linesToDraw.forEach((lineText, index) => {
      ctx.fillText(lineText, 35, y + (index * lineHeight));
    });
  }
  
  // Dynamic positioning and height scaling for barcode to minimize empty space and maximize scan ease
  const isMultiLine = linesToDraw.length > 1;
  const barcodeY = isMultiLine ? 205 : 175;
  const barcodeHeight = isMultiLine ? 140 : 170; // Extended heights to fill empty bottom space
  
  // Barcode
  const bcCanvas = document.createElement("canvas");
  try {
    JsBarcode(bcCanvas, assetNo, { format: "CODE128", height: 90, displayValue: false, margin: 0 });
    ctx.drawImage(bcCanvas, 35, barcodeY, 330, barcodeHeight);
  } catch(e){}
  
  // QR Code (Right Column) - Centered in column with larger 190px size to maximize empty space utilization
  try {
    const qr = new QRious({ value: assetNo, size: 190, level: 'H' });
    ctx.drawImage(qr.canvas, 395, 110, 190, 190);
  } catch(e){}
  
  // Footer - Centered
  ctx.textAlign = "center";
  ctx.fillStyle = "#555";
  ctx.font = "italic 15px Arial"; 
  ctx.fillText("Property of Vespiario Thailand", 300, 385);
  
  // Restore default alignment for safety
  ctx.textAlign = "left";
}

function generateLabelDataUrl(assetNo) {
  const canvas = document.createElement("canvas");
  drawLabelOnCanvas(canvas, assetNo);
  return canvas.toDataURL();
}

function bulkPrintLabels() {
  const ids = currentPillar === 'count' ? selectedMasterAssets : selectedUnregAssets;
  if (ids.length === 0) {
    alert("Please select items to print first.");
    return;
  }
  
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    alert("Cannot open the print window. Please allow popups for this browser.");
    return;
  }
  
  let html = `
    <html>
    <head>
      <title>Print Assets Barcode Label</title>
      <style>
        @page {
          size: 50mm 35mm;
          margin: 0;
        }
        body {
          margin: 0;
          padding: 0;
          font-family: Arial, sans-serif;
          background: #fff;
          -webkit-print-color-adjust: exact;
        }
        .labels-grid {
          display: flex;
          flex-direction: column;
          align-items: center;
          padding: 0;
          margin: 0;
        }
        .label-card {
          width: 50mm;
          height: 35mm;
          box-sizing: border-box;
          text-align: center;
          page-break-inside: avoid;
          page-break-after: always;
          display: flex;
          justify-content: center;
          align-items: center;
          box-shadow: none;
        }
        .label-card:last-child {
          page-break-after: auto;
        }
        .label-card img {
          width: 50mm;
          height: 35mm;
          display: block;
        }
        @media print {
          body {
            padding: 0;
            margin: 0;
          }
          .labels-grid {
            padding: 0;
            gap: 0;
          }
          .label-card {
            margin: 0;
            border: none;
            width: 50mm;
            height: 35mm;
          }
          .label-card img {
            border: none;
            box-shadow: none;
            width: 50mm;
            height: 35mm;
          }
        }
      </style>
    </head>
    <body>
      <div class="labels-grid">
  `;
  
  ids.forEach(id => {
    const imgUrl = generateLabelDataUrl(id);
    html += `
      <div class="label-card">
        <img src="${imgUrl}">
      </div>
    `;
  });
  
  html += `
      </div>
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.print();
            window.close();
          }, 500);
        };
      </script>
    </body>
    </html>
  `;
  
  printWindow.document.write(html);
  printWindow.document.close();
}

function openLabelModal(assetNo) {
  selectedAssetNo = assetNo;
  document.getElementById("modal-label-preview").classList.remove("hidden");
  
  const canvas = document.getElementById("label-canvas");
  drawLabelOnCanvas(canvas, assetNo);
}

function downloadLabelPng() {
  const c = document.getElementById("label-canvas");
  const a = document.createElement("a");
  a.download = `LABEL_${selectedAssetNo}.png`; a.href = c.toDataURL(); a.click();
}

function closeLabelModal() { 
  document.getElementById("modal-label-preview").classList.add("hidden"); 
}

function printModalLabel() {
  closeAssetDetailModal();
  openLabelModal(currentModalAssetNo);
}
