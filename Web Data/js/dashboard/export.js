function exportExcel() {
  if (allAssets.length === 0) {
    alert("กรุณาโหลดข้อมูลก่อน");
    return;
  }

  const exportData = [];

  // Title Row
  exportData.push(["รายงานทรัพย์สิน (MASTER) - VESPA THAILAND CO., LTD."]);
  exportData.push(["วันที่ส่งออก:", new Date().toLocaleDateString("th-TH")]);
  exportData.push([]); // Empty row

  // Headers
  const hasApiHeaders = exportHeaders && exportHeaders.length > 0;
  const FIXED_HEADERS = ["รหัสทรัพย์สิน", "ชื่อทรัพย์สิน", "หมวดหมู่", "พื้นที่", "คลัง", "วันที่ได้มา", "สถานะ", "เช็คล่าสุด", "ผลการเช็ค"];
  const headers = hasApiHeaders ? exportHeaders : FIXED_HEADERS;
  exportData.push(headers);

  allAssets.forEach(row => {
    if (hasApiHeaders) {
      const newRow = row.map((cell, i) => {
        if (i === 5 || i === 7) return cell ? formatDate(cell) : "";
        if (i >= 8 && typeof cell === 'string') {
          if (cell.includes("Confirmed from Unregistered") || cell.includes("Unregistered")) return "สินค้านอกระบบ";
          if (cell === "Count" || cell === "Checked") return "ตรวจสอบแล้ว";
        }
        return cell !== undefined && cell !== null ? cell : "";
      });
      exportData.push(newRow);
    } else {
      let rawResult = String(row[8] || "").trim();
      let displayResult = rawResult;
      if (rawResult.includes("Confirmed from Unregistered") || rawResult.includes("Unregistered")) displayResult = "สินค้านอกระบบ";
      else if (rawResult === "Count" || rawResult === "Checked") displayResult = "ตรวจสอบแล้ว";

      exportData.push([
        row[0] || "", row[1] || "", row[2] || "", row[3] || "", row[4] || "",
        row[5] ? formatDate(row[5]) : "", row[6] || "Active",
        row[7] ? formatDateTime(row[7]) : "", displayResult
      ]);
    }
  });

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(exportData);

  ws["!cols"] = [
    { wch: 15 }, { wch: 45 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
    { wch: 15 }, { wch: 15 }, { wch: 22 }, { wch: 15 }
  ];
  if (hasApiHeaders && headers.length > 9) {
    for (let c = 9; c < headers.length; c++) ws["!cols"].push({ wch: 15 });
  }

  // Apply Styles to Master Sheet
  if (ws['!ref']) {
    const range = XLSX.utils.decode_range(ws['!ref']);
    for (let R = range.s.r; R <= range.e.r; ++R) {
      for (let C = range.s.c; C <= range.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
        if (!ws[cellRef]) ws[cellRef] = { t: "s", v: "" };

        ws[cellRef].s = {
          font: { name: "Tahoma", sz: 10 },
          alignment: { vertical: "center", wrapText: true }
        };

        if (R >= 3) {
          ws[cellRef].s.border = {
            top: { style: "thin", color: { auto: 1 } },
            bottom: { style: "thin", color: { auto: 1 } },
            left: { style: "thin", color: { auto: 1 } },
            right: { style: "thin", color: { auto: 1 } }
          };
        }

        if (R === 3) { // Header row
          ws[cellRef].s.fill = { fgColor: { rgb: "E2E8F0" } };
          ws[cellRef].s.font.bold = true;
          ws[cellRef].s.alignment.horizontal = "center";
        } else if (R === 0) { // Title row
          ws[cellRef].s.font.sz = 14;
          ws[cellRef].s.font.bold = true;
          ws[cellRef].s.alignment = { horizontal: "center", vertical: "center" };
        }
      }
    }
    ws["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: range.e.c } }];
  }

  XLSX.utils.book_append_sheet(wb, ws, "Assets_Master");

  // --- NEW Unregistered Asset Sheet ---
  const unregExportData = [];
  unregExportData.push(["รายงานทรัพย์สินใหม่ (ที่ยังไม่ได้ยืนยัน) - VESPA THAILAND CO., LTD."]);
  unregExportData.push(["วันที่ส่งออก:", new Date().toLocaleDateString("th-TH")]);
  unregExportData.push([]); // Empty row

  const FIXED_UNREG_HEADERS = ["Temp ID", "Asset Name", "Category", "Warehouse", "Area", "Remarks", "Date Added", "Image Link", "Status", "Active/Inactive"];
  unregExportData.push(FIXED_UNREG_HEADERS);

  if (allUnregAssets && allUnregAssets.length > 0) {
    allUnregAssets.forEach(row => {
      const newRow = [
        row[0] || "", // Temp ID
        row[1] || "", // Name
        row[2] || "", // Category
        row[3] || "", // Warehouse
        row[4] || "", // Area
        row[5] || "", // Remarks
        row[6] ? formatDateTime(row[6]) : "", // Date Added
        row[7] || "", // Image Link
        row[8] || "", // Status
        row[9] || ""  // Active/Inactive status
      ];
      unregExportData.push(newRow);
    });
  }

  const wsUnreg = XLSX.utils.aoa_to_sheet(unregExportData);
  wsUnreg["!cols"] = [
    { wch: 15 }, { wch: 40 }, { wch: 12 }, { wch: 15 }, { wch: 15 },
    { wch: 30 }, { wch: 22 }, { wch: 60 }, { wch: 12 }, { wch: 15 }
  ];

  // Apply Styles to Unregistered Sheet
  if (wsUnreg['!ref']) {
    const rangeUnreg = XLSX.utils.decode_range(wsUnreg['!ref']);
    for (let R = rangeUnreg.s.r; R <= rangeUnreg.e.r; ++R) {
      for (let C = rangeUnreg.s.c; C <= rangeUnreg.e.c; ++C) {
        const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
        if (!wsUnreg[cellRef]) wsUnreg[cellRef] = { t: "s", v: "" };

        wsUnreg[cellRef].s = {
          font: { name: "Tahoma", sz: 10 },
          alignment: { vertical: "center", wrapText: true }
        };

        if (R >= 3) {
          wsUnreg[cellRef].s.border = {
            top: { style: "thin", color: { auto: 1 } },
            bottom: { style: "thin", color: { auto: 1 } },
            left: { style: "thin", color: { auto: 1 } },
            right: { style: "thin", color: { auto: 1 } }
          };
        }

        if (R === 3) { // Header row
          wsUnreg[cellRef].s.fill = { fgColor: { rgb: "FEF3C7" } }; // Soft Amber fill
          wsUnreg[cellRef].s.font.bold = true;
          wsUnreg[cellRef].s.alignment.horizontal = "center";
        } else if (R === 0) { // Title row
          wsUnreg[cellRef].s.font.sz = 14;
          wsUnreg[cellRef].s.font.bold = true;
          wsUnreg[cellRef].s.alignment = { horizontal: "center", vertical: "center" };
        }
      }
    }
    wsUnreg["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: rangeUnreg.e.c } }];
  }

  XLSX.utils.book_append_sheet(wb, wsUnreg, "Unregistered_Assets");

  XLSX.writeFile(wb, `Vespa_Assets_Report_${new Date().toISOString().split('T')[0]}.xlsx`);
}

function getCountSheetMetaIndex(key) {
  const raw = countMeta && countMeta[key];
  if (raw === null || raw === undefined || raw === "") return -1;
  const index = Number(raw);
  return Number.isInteger(index) ? index : -1;
}

function isCountSheetCountedAt(row, index) {
  return Number.isInteger(index) && index >= 0 && index < row.length && isCountedValue(row[index]);
}

function getCountSheetState(row, roundNum) {
  const countIndex = typeof getReliableProfileCountIndex === "function" ? getReliableProfileCountIndex(Number(roundNum)) : -1;
  const count1Index = getCountSheetMetaIndex("count1Index");
  const count2Index = getCountSheetMetaIndex("count2Index");
  const legacyIndex = getCountSheetMetaIndex("legacyIndex");
  const checked = String(roundNum) === "2"
    ? isCountSheetCountedAt(row, count2Index >= 0 ? count2Index : countIndex)
    : isCountSheetCountedAt(row, count1Index >= 0 ? count1Index : countIndex) || isCountSheetCountedAt(row, legacyIndex);
  const hasEvidence = !!String(row[6] || "").trim() ||
    isCountSheetCountedAt(row, count1Index) ||
    isCountSheetCountedAt(row, count2Index) ||
    isCountSheetCountedAt(row, legacyIndex) ||
    isCountSheetCountedAt(row, countIndex);
  return { checked, hasEvidence };
}

function normalizeCountSheetWarehouse(row) {
  const rawWh = String((Array.isArray(row) ? row[4] : row) || "").trim();
  const rawArea = String((Array.isArray(row) ? row[3] : "") || "").trim();
  const whUpper = rawWh.toUpperCase();
  const areaUpper = rawArea.toUpperCase();
  const officeBAreas = [
    "OFFICE CENTER",
    "MEETING ROOM B1",
    "MEETING ROOM B2",
    "MEETING ROOM B3",
    "โซนรับประทานอาหาร",
    "LOCKER ROOM",
    "ห้องประชุม B1",
    "ห้องประชุม B2",
    "ห้องประชุม B3",
    "ห้องทำงาน WH.B"
  ];

  if (whUpper.includes("PDI")) return "PDIZONE";
  if (whUpper.includes("WHD") || whUpper.includes("HR")) return "WHD+HR";
  if (whUpper.includes("WH-A") || whUpper.includes("WAREHOUSE A") || whUpper.includes("WHA") || whUpper.includes("TRS")) {
    if (rawArea.includes("โซน PDI") || areaUpper.includes("PDI")) return "PDIZONE";
    return "WAREHOUSE A+TRS";
  }
  if (whUpper.includes("WH-B") || whUpper.includes("WAREHOUSE B") || whUpper.includes("WHB")) {
    const isOfficeB = rawArea.includes("ห้องทำงาน WH.B") ||
      areaUpper.includes("OFFICE B") ||
      areaUpper.includes("OFFICE WH.B") ||
      areaUpper.includes("OFFICE WH B") ||
      officeBAreas.includes(rawArea) ||
      officeBAreas.includes(areaUpper);
    return isOfficeB ? "OFFICE B" : "WAREHOUSE B";
  }
  if (whUpper.includes("OFFICE")) return "OFFICE A";
  if (whUpper.includes("KM23") || whUpper.includes("KM.23")) return "KM23";
  return "Diff";
}

function exportCountSheet(roundNum = 1) {
  try {
    if (!Array.isArray(allAssets) || allAssets.length === 0) {
      alert("กรุณาโหลดข้อมูลก่อน");
      return;
    }

    const roundLabel = String(roundNum) === "2" ? "Count 2" : "Count 1";
    const roundName = String(roundNum) === "2"
      ? (countMeta && countMeta.count2Name)
      : (countMeta && (countMeta.count1Name || countMeta.legacyName));
    const periodLabel = (countMeta && (countMeta.activeCountPeriodLabel || countMeta.activeCountPeriod)) || "Latest";
    const warehouseOrder = ["PDIZONE", "WAREHOUSE A+TRS", "WAREHOUSE B", "OFFICE A", "OFFICE B", "WHD+HR", "KM23", "Diff"];
    const warehouseGroups = {};

    allAssets.forEach(row => {
      const state = getCountSheetState(row, roundNum);
      const normalizedWarehouse = normalizeCountSheetWarehouse(row);
      const whGroup = state.hasEvidence ? normalizedWarehouse : "Diff";
      if (!warehouseGroups[whGroup]) warehouseGroups[whGroup] = [];
      warehouseGroups[whGroup].push({ row, checked: state.checked });
    });

    const wb = XLSX.utils.book_new();
    warehouseOrder
      .filter(whName => Array.isArray(warehouseGroups[whName]) && warehouseGroups[whName].length)
      .forEach(whName => {
        const groupRows = warehouseGroups[whName];
        groupRows.sort((a, b) => {
          const rowA = a.row;
          const rowB = b.row;
          const areaCompare = String(rowA[3] || "").localeCompare(String(rowB[3] || ""), "th");
          if (areaCompare !== 0) return areaCompare;
          const catCompare = String(rowA[2] || "").localeCompare(String(rowB[2] || ""), "th");
          if (catCompare !== 0) return catCompare;
          return String(rowA[0] || "").localeCompare(String(rowB[0] || ""), "th");
        });

        const checkedTotal = groupRows.filter(item => item.checked).length;
        const leftTotal = Math.max(0, groupRows.length - checkedTotal);
        const sheetData = [
          [`ใบตรวจนับทรัพย์สิน (${roundLabel}) - คลัง: ${whName}`],
          [`รอบที่แสดง: ${roundName || `${periodLabel} ${roundLabel}`} | Total ${groupRows.length} | Counted ${checkedTotal} | Left ${leftTotal}`],
          ["", "", "", "", "", "ทีม___________ : _________ / _________ / _________"],
          ["ลำดับ", "รหัสทรัพย์สิน", "ชื่อทรัพย์สิน / รายละเอียด", "พื้นที่ย่อย", "สถานะระบบ", "คลังคนที่ 1", "คลังคนที่ 2", "บัญชี", "ผลการตรวจนับ / หมายเหตุ"]
        ];

        groupRows.forEach((item, rIdx) => {
          const row = item.row;
          sheetData.push([
            rIdx + 1,
            row[0] || "",
            row[1] || "",
            row[3] || "",
            row[6] || "Active",
            "",
            "",
            "",
            item.checked ? "ตรวจแล้วในรอบที่เลือก" : ""
          ]);
        });

        const ws = XLSX.utils.aoa_to_sheet(sheetData);
        ws["!cols"] = [
          { wch: 6 },
          { wch: 14 },
          { wch: 38 },
          { wch: 18 },
          { wch: 12 },
          { wch: 12 },
          { wch: 12 },
          { wch: 12 },
          { wch: 24 }
        ];
        ws["!merges"] = [
          { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } },
          { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } },
          { s: { r: 2, c: 5 }, e: { r: 2, c: 8 } }
        ];

        try {
          if (ws["!ref"]) {
            const range = XLSX.utils.decode_range(ws["!ref"]);
            for (let R = range.s.r; R <= range.e.r; ++R) {
              for (let C = range.s.c; C <= range.e.c; ++C) {
                const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
                if (!ws[cellRef]) ws[cellRef] = { t: "s", v: "" };
                ws[cellRef].s = {
                  font: { name: "Tahoma", sz: R === 0 ? 12 : 9, bold: R <= 3 },
                  alignment: { vertical: "center", wrapText: true, horizontal: (C === 0 || C >= 5 || R <= 3) ? "center" : "left" },
                  border: R >= 3 ? {
                    top: { style: "thin", color: { rgb: "000000" } },
                    bottom: { style: "thin", color: { rgb: "000000" } },
                    left: { style: "thin", color: { rgb: "000000" } },
                    right: { style: "thin", color: { rgb: "000000" } }
                  } : undefined,
                  fill: R === 3 ? { fgColor: { rgb: "CCCCCC" } } : (R > 3 && R % 2 === 0 ? { fgColor: { rgb: "F2F2F2" } } : undefined)
                };
              }
            }
          }
        } catch (styleErr) {
          console.warn("Styling Excel failed, exporting unstyled version:", styleErr);
        }

        const safeSheetName = whName.replace(/\//g, "-").replace(/[:\\\?\*\[\]]/g, "").substring(0, 30);
        XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
      });

    XLSX.writeFile(wb, `Vespa_CountSheet_${roundLabel.replace(/\s+/g, "")}_${new Date().toISOString().split("T")[0]}.xlsx`);
  } catch (err) {
    alert("ไม่สามารถดาวน์โหลดได้เนื่องจาก: " + err.message);
    console.error(err);
  }
}

function exportUnregCountSheet() {
  try {
    if (!allUnregAssets || allUnregAssets.length === 0) {
      alert("ไม่มีข้อมูลสินค้านอกระบบ");
      return;
    }

    // 1. แยกกลุ่มข้อมูลทรัพย์สินนอกระบบตามคลังหลัก
    const warehouseGroups = {};
    allUnregAssets.forEach(row => {
      const rawWh = String(row[3] || "ไม่ระบุคลัง").trim().toUpperCase(); // คลังสินค้า unreg อยู่คอลัมน์ D (index 3)
      const rawArea = String(row[4] || "").trim(); // พื้นที่ย่อย unreg อยู่คอลัมน์ E (index 4)
      const rawAreaUpper = rawArea.toUpperCase();
      let whGroup = "Diff";
      if (rawWh.includes("PDI")) {
        whGroup = "PDIZONE";
      } else if (rawWh.includes("WHD") || rawWh.includes("HR")) {
        whGroup = "WHD+HR";
      } else if (rawWh.includes("WH-A") || rawWh.includes("WAREHOUSE A") || rawWh.includes("WHA") || rawWh.includes("TRS")) {
        if (rawArea.includes("โซน PDI") || rawAreaUpper.includes("PDI")) {
          whGroup = "PDIZONE";
        } else {
          whGroup = "WAREHOUSE A+TRS";
        }
      } else if (rawWh.includes("WH-B") || rawWh.includes("WAREHOUSE B") || rawWh.includes("WHB")) {
        const isOfficeB = rawArea.includes("ห้องทำงาน WH.B") || 
                          rawAreaUpper.includes("OFFICE B") || 
                          rawAreaUpper.includes("OFFICE WH.B") || 
                          rawAreaUpper.includes("OFFICE WH B") ||
                          ["OFFICE CENTER", "MEETING ROOM B1", "MEETING ROOM B2", "MEETING ROOM B3", "โซนรับประทานอาหาร", "LOCKER ROOM", "ห้องประชุม B1", "ห้องประชุม B2", "ห้องประชุม B3", "ห้องทำงาน WH.B"].includes(rawAreaUpper);
        if (isOfficeB) {
          whGroup = "OFFICE B";
        } else {
          whGroup = "WAREHOUSE B";
        }
      } else if (rawWh.includes("OFFICE")) {
        whGroup = "OFFICE A";
      }
      
      if (!warehouseGroups[whGroup]) warehouseGroups[whGroup] = [];
      warehouseGroups[whGroup].push(row);
    });

    const wb = XLSX.utils.book_new();

    // 2. สร้างชีตแยกตามคลัง
    Object.keys(warehouseGroups).forEach(whName => {
      const groupRows = warehouseGroups[whName];
      // เรียงตาม: พื้นที่ย่อย --> ชื่อทรัพย์สิน
      groupRows.sort((a, b) => {
        const areaA = String(a[4] || "");
        const areaB = String(b[4] || "");
        const areaCompare = areaA.localeCompare(areaB, "th");
        if (areaCompare !== 0) return areaCompare;

        const nameA = String(a[1] || "");
        const nameB = String(b[1] || "");
        return nameA.localeCompare(nameB, "th");
      });

      const sheetData = [];

      // หัวข้อเอกสาร
      sheetData.push([`ใบตรวจนับทรัพย์สินใหม่ (นอกระบบ) - คลัง: ${whName.toUpperCase()}`]);
      sheetData.push([`พิมพ์เมื่อวันที่: ${new Date().toLocaleDateString("th-TH")} | ผู้ตรวจสอบ: คลัง 2 คน, บัญชี 1 คน`]);
      // ข้อมูลทีมขวาบนของตาราง
      sheetData.push(["", "", "", "", "", `ทีม___________ : _________ / _________ / _________`]);

      // Headers ตารางการนับ
      const tableHeaders = [
        "ลำดับ",
        "Temp ID", 
        "ชื่อทรัพย์สิน / รายละเอียด", 
        "พื้นที่ย่อย", 
        "สถานะระบบ", 
        "คลังคนที่ 1", 
        "คลังคนที่ 2", 
        "บัญชี", 
        "ผลการตรวจนับ / หมายเหตุ"
      ];
      sheetData.push(tableHeaders);

      // เติมข้อมูลลงตาราง
      groupRows.forEach((row, rIdx) => {
        sheetData.push([
          rIdx + 1, // ลำดับ
          row[0] || "", // Temp ID
          row[1] || "", // ชื่อทรัพย์สิน
          row[4] || "", // พื้นที่ย่อย
          "นอกระบบ", // สถานะระบบ
          "", // คลังคนที่ 1 (ว่างไว้เขียนมือ)
          "", // คลังคนที่ 2 (ว่างไว้เขียนมือ)
          "", // บัญชี (ว่างไว้เขียนมือ)
          row[5] || "" // หมายเหตุ
        ]);
      });

      const ws = XLSX.utils.aoa_to_sheet(sheetData);

      // กำหนดความกว้างของคอลัมน์ให้อ่านง่ายเหมาะสำหรับพิมพ์ A4 ขาวดำ
      ws["!cols"] = [
        { wch: 6 },  // ลำดับ
        { wch: 14 }, // Temp ID
        { wch: 38 }, // รายละเอียดสินค้า
        { wch: 14 }, // พื้นที่ย่อย
        { wch: 11 }, // สถานะระบบ
        { wch: 12 }, // คลังคนที่ 1
        { wch: 12 }, // คลังคนที่ 2
        { wch: 12 }, // บัญชี
        { wch: 22 }  // หมายเหตุ
      ];

      // ตั้งความสูงของแถว (Row Heights) แบบกระชับ
      const wsRows = [];
      for (let i = 0; i < sheetData.length; i++) {
        if (i === 0) {
          wsRows.push({ hpt: 25 }); // หัวข้อหลัก
        } else if (i === 1) {
          wsRows.push({ hpt: 18 }); // พิมพ์เมื่อวันที่
        } else if (i === 2) {
          wsRows.push({ hpt: 10 }); // แถวว่าง
        } else if (i === 3) {
          wsRows.push({ hpt: 24 }); // Header ตาราง
        } else {
          wsRows.push({ hpt: 20 }); // แถวข้อมูลตาราง
        }
      }
      ws["!rows"] = wsRows;

      // ตกแต่งสไตล์แบบ Gray-scale คอนทราสต์สูง เหมาะสำหรับการพิมพ์ขาวดำ
      try {
        if (ws['!ref']) {
          const range = XLSX.utils.decode_range(ws['!ref']);
          const tableHeaderRow = 3;
          const lastDataRow = range.e.r;

          for (let R = range.s.r; R <= range.e.r; ++R) {
            for (let C = range.s.c; C <= range.e.c; ++C) {
              const cellRef = XLSX.utils.encode_cell({ c: C, r: R });
              if (!ws[cellRef]) ws[cellRef] = { t: "s", v: "" };

              // สไตล์ตัวอักษรพื้นฐาน
              ws[cellRef].s = {
                font: { name: "Tahoma", sz: 9 },
                alignment: { vertical: "center", wrapText: true }
              };

              // ตกแต่งเส้นตารางข้อมูล
              if (R >= tableHeaderRow && R <= lastDataRow) {
                ws[cellRef].s.border = {
                  top: { style: "thin", color: { rgb: "000000" } },
                  bottom: { style: "thin", color: { rgb: "000000" } },
                  left: { style: "thin", color: { rgb: "000000" } },
                  right: { style: "thin", color: { rgb: "000000" } }
                };
                
                // จัดช่องข้อมูลทั่วไปให้อยู่กลาง (ลำดับ, สถานะ, ตรวจมือ)
                if (C === 0 || C === 4 || (C >= 5 && C <= 7)) {
                  ws[cellRef].s.alignment.horizontal = "center";
                }

                // สลับสีแถวขาว-เทาอ่อน สำหรับพิมพ์ขาวดำ
                if (R > tableHeaderRow) {
                  if ((R - tableHeaderRow) % 2 === 0) {
                    ws[cellRef].s.fill = { fgColor: { rgb: "F2F2F2" } }; // พื้นเทาอ่อนอ่านง่าย เขียนทับได้ง่าย
                    ws[cellRef].s.font = { name: "Tahoma", sz: 9, color: { rgb: "000000" } }; // ตัวอักษรสีดำ
                  } else {
                    ws[cellRef].s.fill = { fgColor: { rgb: "FFFFFF" } }; // พื้นสีขาว
                    ws[cellRef].s.font = { name: "Tahoma", sz: 9, color: { rgb: "000000" } }; // ตัวอักษรสีดำ
                  }
                }
              }

              // ตกแต่งหัวตาราง (Header Row)
              if (R === tableHeaderRow) {
                ws[cellRef].s.fill = { fgColor: { rgb: "CCCCCC" } }; // เทากลางเพื่อตัดสีดำ
                ws[cellRef].s.font = { name: "Tahoma", sz: 9, bold: true, color: { rgb: "000000" } }; // ตัวอักษรดำเข้มคอนทราสต์สูง
                ws[cellRef].s.alignment.horizontal = "center";
              }
              
              // ตกแต่งชื่อหัวข้อหลักของชีต (Title Row)
              if (R === 0) {
                ws[cellRef].s.font = { name: "Tahoma", sz: 12, bold: true, color: { rgb: "000000" } };
                ws[cellRef].s.alignment = { horizontal: "left", vertical: "center" };
              }
              
              // ตกแต่งกล่องทีมขวาบนเหนือตาราง (Row index 2)
              if (R === 2) {
                if (C >= 5) {
                  ws[cellRef].s.font = { name: "Tahoma", sz: 10, bold: true, color: { rgb: "000000" } };
                  ws[cellRef].s.alignment = { horizontal: "right", vertical: "center" };
                }
              }
            }
          }
          
          // ผสานเซลล์สำหรับหัวข้อและข้อมูลทีมขวาบน
          ws["!merges"] = [
            { s: { r: 0, c: 0 }, e: { r: 0, c: 8 } }, // ชื่อคลัง
            { s: { r: 1, c: 0 }, e: { r: 1, c: 8 } }, // วันที่พิมพ์
            { s: { r: 2, c: 5 }, e: { r: 2, c: 8 } }  // ข้อมูลทีม
          ];
        }
      } catch(styleErr) {
        console.warn("Styling Excel failed, exporting unstyled version:", styleErr);
      }

      // ป้องกันชื่อชีตมีอักขระพิเศษที่ Excel ห้ามใช้
      const safeSheetName = whName.replace(/\//g, "-").replace(/[:\\\?\*\[\]]/g, "").substring(0, 30);
      XLSX.utils.book_append_sheet(wb, ws, safeSheetName);
    });

    XLSX.writeFile(wb, `Vespa_Print_UnregCountSheet_${new Date().toISOString().split('T')[0]}.xlsx`);
  } catch (err) {
    alert("❌ ไม่สามารถดาวน์โหลดได้เนื่องจาก: " + err.message);
    console.error(err);
  }
}
