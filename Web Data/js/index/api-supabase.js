// ==========================================
// ชั้นเชื่อมต่อ Supabase — เขียนทับเฉพาะจุดที่ยิงไป Apps Script
// ==========================================
//
// ไฟล์นี้ต้องโหลด "ต่อจาก" js/index/api.js และ "ก่อน" js/index/app.js
// วิธีทำงาน: เขียนทับ timedFetch() ซึ่งเป็นทางผ่านของทุก request ในหน้านี้
// แล้วดักเฉพาะ action ที่ย้ายมา Supabase แล้ว ที่เหลือปล่อยให้วิ่งไป Apps Script ตามเดิม
//
// ถ้าจะย้อนกลับไปใช้ระบบเก่าทั้งหมด: ลบ <script> ที่โหลดไฟล์นี้ออกจาก index.html บรรทัดเดียว
//
// รอบที่ 1 ดักไว้แล้ว: lookup, scanStatus, updateAsset (บันทึกผลนับ), login
// รอบที่ 2 ยังไม่ดัก: add, upload, uploadScanImage — ยังวิ่งไป Apps Script

(function () {
  "use strict";

  const EMAIL_DOMAIN = "vespiario.com";
  const db = window.supabaseClient;
  if (!db) {
    console.error("[supabase] ไม่พบ supabaseClient — ตรวจว่าโหลด js/supabase-config.js แล้วหรือยัง");
    return;
  }

  // ===== แคชผู้ใช้ปัจจุบันแบบ synchronous =====
  // โค้ดเดิมเรียก getCurrentUser() แบบไม่ async จึงรอ session จาก Supabase ไม่ได้
  // ตอนโหลดหน้าเลยอ่าน session ที่ Supabase เก็บไว้ใน localStorage ตรงๆ ก่อนหนึ่งรอบ
  let currentUserCache = "";

  function usernameFromUser(user) {
    if (!user) return "";
    const meta = user.app_metadata || {};
    if (meta.username) return meta.username;
    return String(user.email || "").split("@")[0];
  }

  function primeUserCacheFromStorage() {
    try {
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || key.indexOf("-auth-token") === -1) continue;
        const raw = JSON.parse(localStorage.getItem(key));
        const user = raw && (raw.user || (raw.currentSession && raw.currentSession.user));
        if (user) {
          currentUserCache = usernameFromUser(user);
          return;
        }
      }
    } catch (e) {
      // อ่านไม่ได้ก็ปล่อย เดี๋ยว onAuthStateChange เติมให้เอง
    }
  }
  primeUserCacheFromStorage();

  db.auth.getSession().then(function (res) {
    const user = res && res.data && res.data.session && res.data.session.user;
    currentUserCache = usernameFromUser(user);
  });

  db.auth.onAuthStateChange(function (_event, session) {
    currentUserCache = usernameFromUser(session && session.user);
  });

  // ===== ระบบ login =====

  window.getCurrentUser = function () {
    return currentUserCache;
  };

  window.getSession = function () {
    return currentUserCache ? { user: currentUserCache, loginAt: Date.now() } : null;
  };

  window.setSession = function () {};
  window.clearSession = function () {};

  window.loginUser = async function (username, password) {
    const name = String(username || "").trim();
    const email = (name.includes("@") ? name : name + "@" + EMAIL_DOMAIN).toLowerCase();

    const { data, error } = await db.auth.signInWithPassword({ email, password });
    if (error) {
      return { ok: false, message: "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง" };
    }
    currentUserCache = usernameFromUser(data.user);
    return { ok: true };
  };

  window.logoutUser = async function () {
    await db.auth.signOut();
    currentUserCache = "";
    window.location.reload();
  };

  window.isSupabaseAdmin = function () {
    try {
      const raw = localStorage.getItem("sb-user-role");
      return raw === "admin";
    } catch (e) {
      return false;
    }
  };

  // ===== ตัวช่วย =====

  function currentPeriod() {
    const d = new Date();
    return d.getFullYear() + "-" + ("0" + (d.getMonth() + 1)).slice(-2);
  }

  function normalizeRound(value) {
    return String(value || "1").trim() === "2" ? 2 : 1;
  }

  // แปลงแถวจาก Supabase ให้มีหน้าตาเหมือนที่ Apps Script เคยตอบ
  // เพื่อให้ app.js / ui.js ใช้งานต่อได้โดยไม่ต้องแก้
  async function buildMasterResponse(row) {
    const period = currentPeriod();

    const { data: rounds } = await db
      .from("count_rounds")
      .select("id, round")
      .eq("period", period);

    const roundIds = (rounds || []).map(function (r) { return r.id; });
    let hasCount1 = false, hasCount2 = false;

    if (roundIds.length) {
      const { data: counts } = await db
        .from("counts")
        .select("round_id")
        .eq("asset_no", row.asset_no)
        .in("round_id", roundIds);

      (counts || []).forEach(function (c) {
        const match = (rounds || []).find(function (r) { return r.id === c.round_id; });
        if (!match) return;
        if (match.round === 1) hasCount1 = true;
        if (match.round === 2) hasCount2 = true;
      });
    }

    return {
      status: "success",
      found: true,
      isUnregistered: false,
      assetNo: row.asset_no,
      assetName: row.asset_name || "",
      category: row.category || "",
      area: row.area || "",
      warehouse: row.warehouse || "",
      acquisitionDate: row.acquisition_date || "",
      assetStatus: row.status || "",
      lastScan: row.last_scan || "",
      lastResult: row.last_result || "",
      remark: row.remark || "",
      imageUrl: row.image_url || "",
      hasCount1: hasCount1,
      hasCount2: hasCount2,
      currentMonthName: "รอบ " + period + " ครั้งที่ 1",
      currentMonthName2: "รอบ " + period + " ครั้งที่ 2"
    };
  }

  function buildUnregResponse(row) {
    return {
      status: "success",
      found: true,
      isUnregistered: true,
      assetNo: row.temp_id,
      tempId: row.temp_id,
      assetName: row.asset_name || "",
      category: row.category || "",
      warehouse: row.warehouse || "",
      area: row.area || "",
      remark: row.remark || "",
      dateAdded: row.created_at || "",
      imageUrl: row.image_url || "",
      unregStatus: row.review_state === "pending" ? "Pending" : row.review_state,
      assetStatus: row.asset_status || ""
    };
  }

  // ===== action: lookup =====

  async function handleLookup(assetNo) {
    const code = String(assetNo || "").trim().toUpperCase();
    if (!code) return { status: "error", message: "ไม่ได้ระบุรหัสทรัพย์สิน" };

    const { data: master, error } = await db
      .from("assets_with_latest_count")
      .select("*")
      .eq("asset_no", code)
      .maybeSingle();

    if (error) return { status: "error", message: error.message };
    if (master) return await buildMasterResponse(master);

    const { data: unreg } = await db
      .from("unregistered_assets")
      .select("*")
      .eq("temp_id", code)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (unreg) return buildUnregResponse(unreg);

    return { status: "success", found: false, assetNo: code, message: "ไม่พบทรัพย์สินนี้ในระบบ" };
  }

  // ===== action: updateAsset (บันทึกผลนับ + อัปเดตตำแหน่ง) =====

  async function ensureCountRound(round) {
    const period = currentPeriod();

    const { data: existing } = await db
      .from("count_rounds")
      .select("id")
      .eq("period", period)
      .eq("round", round)
      .maybeSingle();

    if (existing) return existing.id;

    const { data: created, error } = await db
      .from("count_rounds")
      .insert({ period: period, round: round })
      .select("id")
      .single();

    // ถ้าชนกับอีกเครื่องที่สร้างพร้อมกัน ให้อ่านซ้ำแทนการ error
    if (error) {
      const { data: retry } = await db
        .from("count_rounds")
        .select("id")
        .eq("period", period)
        .eq("round", round)
        .maybeSingle();
      if (retry) return retry.id;
      throw new Error("สร้างรอบนับไม่สำเร็จ: " + error.message);
    }
    return created.id;
  }

  async function handleUpdateAsset(payload) {
    const startedAt = Date.now();
    const assetNo = String(payload.assetNo || "").trim().toUpperCase();
    const user = window.getCurrentUser();

    if (!user) {
      return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนบันทึก" };
    }
    if (!assetNo) {
      return { status: "error", message: "ไม่ได้ระบุรหัสทรัพย์สิน" };
    }

    const round = normalizeRound(payload.countRound);

    // 1. อัปเดตตำแหน่ง/สถานะ ถ้ามีการเลือกมา (ค่าว่างหรือ "ไม่เปลี่ยน" = ไม่แตะ)
    const patch = {};
    const skip = ["", "ไม่เปลี่ยน", "โปรดเลือกแผนกก่อน"];
    if (payload.warehouse && !skip.includes(payload.warehouse)) patch.warehouse = payload.warehouse;
    if (payload.area && !skip.includes(payload.area)) patch.area = payload.area;
    if (payload.status && !skip.includes(payload.status)) patch.status = payload.status;
    if (payload.remarks) patch.remark = payload.remarks;

    if (!payload.isUnregistered && Object.keys(patch).length) {
      const { error } = await db.from("assets").update(patch).eq("asset_no", assetNo);
      if (error) return { status: "error", message: "อัปเดตข้อมูลไม่สำเร็จ: " + error.message };
    }

    // 2. บันทึกผลนับ — เฉพาะของที่อยู่ในทะเบียนหลัก
    //    ของนอกระบบยังไม่มีแถวใน assets จึงอ้างอิงไม่ได้ ต้องรอ approve ก่อน
    let alreadyCounted = false;
    if (payload.isScan && !payload.isUnregistered) {
      const roundId = await ensureCountRound(round);

      const { error } = await db.from("counts").insert({
        round_id: roundId,
        asset_no: assetNo,
        result: "Count",
        counted_by: user,
        device: "Mobile"
      });

      if (error) {
        // 23505 = ชนกับ unique(round_id, asset_no) แปลว่ารอบนี้นับไปแล้ว ไม่ใช่ความผิดพลาด
        if (error.code === "23505") {
          alreadyCounted = true;
        } else {
          return { status: "error", message: "บันทึกผลนับไม่สำเร็จ: " + error.message };
        }
      }
    }

    // 3. เขียน log — ล้มเหลวตรงนี้ไม่ควรทำให้การนับเสีย
    await db.from("scan_logs").insert({
      req_id: payload.requestId || null,
      asset_no: assetNo,
      action: payload.isScan ? "Count (Fast)" : "Update",
      status: "done",
      device: "Mobile",
      result: alreadyCounted ? "นับซ้ำ ข้ามการบันทึก" : "Updated",
      duration_ms: Date.now() - startedAt
    });

    return {
      status: "success",
      assetNo: assetNo,
      requestId: payload.requestId || "",
      alreadyCounted: alreadyCounted,
      imageUrl: "",
      timestamp: new Date().toISOString(),
      durationMs: Date.now() - startedAt,
      message: alreadyCounted ? "รอบนี้เคยนับไปแล้ว" : "บันทึกเรียบร้อย"
    };
  }

  // ===== รูปภาพ: อัปขึ้น Supabase Storage แทน Google Drive =====

  // base64 ที่ compressImageToBase64() ส่งมาถูกตัดส่วน "data:image/jpeg;base64," ออกแล้ว
  function base64ToBlob(base64, mime) {
    const binary = atob(base64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return new Blob([bytes], { type: mime || "image/jpeg" });
  }

  // ตารางใน dashboard แสดงรูปแค่ 44px แต่เดิมโหลดไฟล์เต็ม ~85KB ทุกแถว
  // จึงอัปตัวย่อไว้อีกไฟล์ ชื่อเดียวกันต่อท้ายด้วย THUMB_SUFFIX
  // ฝั่ง dashboard เดาชื่อนี้เอาเอง ไม่ต้องเพิ่มคอลัมน์ใน assets
  const THUMB_SUFFIX = "_thumb";
  const THUMB_MAX_DIM = 160;
  const THUMB_QUALITY = 0.5;

  function makeThumbBase64(base64) {
    return new Promise(resolve => {
      const img = new Image();
      // ตัวย่อพังไม่ควรทำให้การอัปรูปทั้งใบล้มเหลว คืน "" แล้วปล่อยผ่าน
      img.onerror = () => resolve("");
      img.onload = () => {
        try {
          const ratio = Math.min(1, THUMB_MAX_DIM / Math.max(img.width, img.height));
          const canvas = document.createElement("canvas");
          canvas.width = Math.max(1, Math.round(img.width * ratio));
          canvas.height = Math.max(1, Math.round(img.height * ratio));
          canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL("image/jpeg", THUMB_QUALITY).split(",")[1] || "");
        } catch (error) {
          resolve("");
        }
      };
      img.src = "data:image/jpeg;base64," + base64;
    });
  }

  async function uploadImage(base64, assetNo) {
    if (!base64) return "";
    const basePath = String(assetNo || "unknown").replace(/[^A-Za-z0-9_-]/g, "_") +
                     "/" + Date.now();
    const path = basePath + ".jpg";

    const { error } = await db.storage
      .from("asset-images")
      .upload(path, base64ToBlob(base64), { contentType: "image/jpeg", upsert: false });

    if (error) throw new Error("อัปโหลดรูปไม่สำเร็จ: " + error.message);

    // ตัวย่ออัปหลังตัวเต็มสำเร็จแล้ว และไม่ throw
    // ถ้าไม่มีไฟล์นี้ dashboard จะ fallback ไปใช้ตัวเต็มเองอยู่แล้ว
    try {
      const thumb = await makeThumbBase64(base64);
      if (thumb) {
        await db.storage
          .from("asset-images")
          .upload(basePath + THUMB_SUFFIX + ".jpg", base64ToBlob(thumb),
                  { contentType: "image/jpeg", upsert: false });
      }
    } catch (error) {
      console.warn("[supabase] อัปรูปย่อไม่สำเร็จ ใช้รูปเต็มแทน:", error.message);
    }

    return db.storage.from("asset-images").getPublicUrl(path).data.publicUrl;
  }

  // แปลง public URL กลับเป็น path ในถัง เพื่อสั่งลบได้
  // รูปเก่าที่เป็นลิงก์ Google Drive จะได้ "" และถูกข้ามไป ไม่ไปยุ่งกับของเดิม
  function storagePathFromUrl(url) {
    const match = String(url || "").match(/\/storage\/v1\/object\/public\/asset-images\/(.+)$/);
    return match ? decodeURIComponent(match[1].split("?")[0]) : "";
  }

  // ลบรูปชุดเก่าทิ้งหลังอัปตัวใหม่สำเร็จ ไม่ให้ไฟล์กำพร้าสะสมในถัง
  // สำเนายังอยู่ใน Google Drive เพราะ backupSupabaseImagesToDrive() เก็บทุกเวอร์ชัน
  // ลบไม่สำเร็จก็แค่เหลือขยะ ไม่ควรทำให้การสแกนพัง จึงไม่ throw
  async function removeStoredImage(oldUrl) {
    const path = storagePathFromUrl(oldUrl);
    if (!path) return;
    try {
      const { error } = await db.storage
        .from("asset-images")
        .remove([path, path.replace(/\.(jpe?g)$/i, THUMB_SUFFIX + ".$1")]);
      if (error) console.warn("[supabase] ลบรูปเก่าไม่สำเร็จ:", error.message);
    } catch (error) {
      console.warn("[supabase] ลบรูปเก่าไม่สำเร็จ:", error.message);
    }
  }

  // ===== action: add (เพิ่มทรัพย์สินเข้าทะเบียนหลัก) =====

  async function handleAdd(params) {
    const assetNo = String(params.get("assetNo") || "").trim().toUpperCase();
    const user = window.getCurrentUser();

    if (!user) return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนใช้งาน" };
    if (!assetNo) return { status: "error", message: "ไม่ได้ระบุรหัสทรัพย์สิน" };

    const { data: existing } = await db
      .from("assets").select("asset_no").eq("asset_no", assetNo).maybeSingle();

    if (existing) {
      return {
        status: "exists",
        assetNo: assetNo,
        message: "Asset already exists in master list"
      };
    }

    const acquisitionDate = String(params.get("acquisitionDate") || "").trim();

    const { error } = await db.from("assets").insert({
      asset_no: assetNo,
      asset_name: String(params.get("assetName") || "").trim(),
      category: params.get("category") || null,
      area: params.get("area") || null,
      warehouse: params.get("warehouse") || null,
      acquisition_date: acquisitionDate || null,
      status: params.get("status") || "ใช้งานอยู่"
    });

    if (error) return { status: "error", message: "บันทึกไม่สำเร็จ: " + error.message };

    await db.from("scan_logs").insert({
      req_id: "ADD-" + Date.now(),
      asset_no: assetNo,
      action: "Added via Mobile",
      status: "done",
      device: "Mobile",
      result: "Added to master"
    });

    return { status: "success", assetNo: assetNo, message: "Asset added successfully" };
  }

  // ===== action: upload (ของนอกระบบ รอ approve) =====

  async function handleUpload(payload) {
    const user = window.getCurrentUser();
    if (!user) return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนใช้งาน" };

    const reqAssetNo = String(payload.assetNo || "").trim().toUpperCase();
    const tempId = reqAssetNo || ("TEMP-" + String(Date.now()).slice(-6));

    // ถ้ามีในทะเบียนหลักอยู่แล้ว ต้องบอกให้ผู้ใช้รู้ ไม่ใช่สร้างของนอกระบบซ้ำ
    const { data: master } = await db
      .from("assets_with_latest_count").select("*").eq("asset_no", tempId).maybeSingle();

    if (master) {
      const res = await buildMasterResponse(master);
      res.status = "exists";
      res.message = "Asset already exists in master list";
      return res;
    }

    const { data: unreg } = await db
      .from("unregistered_assets").select("*").eq("temp_id", tempId)
      .order("created_at", { ascending: false }).limit(1).maybeSingle();

    if (unreg) {
      const res = buildUnregResponse(unreg);
      res.status = "exists";
      res.message = "Asset already exists in unregistered list";
      return res;
    }

    const imageUrl = await uploadImage(payload.image, tempId);

    const row = {
      temp_id: tempId,
      asset_name: String(payload.assetName || "สินค้านอกระบบ").trim(),
      category: payload.category || null,
      warehouse: payload.warehouse || null,
      area: payload.area || null,
      remark: payload.remarks || null,
      image_url: imageUrl || null,
      asset_status: payload.status || "ใช้งานอยู่",
      review_state: "pending"
    };

    const { error } = await db.from("unregistered_assets").insert(row);
    if (error) return { status: "error", message: "บันทึกไม่สำเร็จ: " + error.message };

    await db.from("scan_logs").insert({
      req_id: "UNREG-" + Date.now(),
      asset_no: tempId,
      action: "Added to Unregistered",
      status: "done",
      device: "Mobile",
      result: "Pending approval"
    });

    return {
      status: "success",
      assetNo: tempId,
      tempId: tempId,
      assetName: row.asset_name,
      category: row.category || "",
      warehouse: row.warehouse || "",
      area: row.area || "",
      remark: row.remark || "",
      imageUrl: imageUrl,
      isUnregistered: true,
      message: "Saved successfully"
    };
  }

  // ===== action: uploadScanImage =====
  // ใช้ 2 กรณี: อัปรูปเบื้องหลังหลังนับเสร็จ และโหมด "บาร์โค้ดเสียหาย" ที่นับพร้อมส่งรูปในครั้งเดียว

  async function handleUploadScanImage(payload) {
    const user = window.getCurrentUser();
    if (!user) return { status: "error", message: "กรุณาเข้าสู่ระบบก่อนใช้งาน" };

    const assetNo = String(payload.assetNo || "").trim().toUpperCase();
    if (!assetNo) return { status: "error", message: "ไม่ได้ระบุรหัสทรัพย์สิน" };

    // อ่านรูปเดิมไว้ก่อน เพื่อลบทิ้งหลังตัวใหม่ขึ้นเรียบร้อยแล้ว
    const { data: current } = await db
      .from("assets").select("image_url").eq("asset_no", assetNo).maybeSingle();

    const imageUrl = await uploadImage(payload.image, assetNo);

    if (imageUrl) {
      await db.from("assets").update({ image_url: imageUrl }).eq("asset_no", assetNo);
      // ลบหลัง update สำเร็จเท่านั้น ถ้าลบก่อนแล้ว update พังจะเหลือแถวชี้ไปไฟล์ที่ไม่มีอยู่
      if (current && current.image_url && current.image_url !== imageUrl) {
        await removeStoredImage(current.image_url);
      }
    }

    // โหมดบาร์โค้ดเสียหาย: ต้องบันทึกผลนับด้วย ใช้ตัวเดียวกับ updateAsset เพื่อไม่ให้ logic แยกกัน
    let countResult = null;
    if (payload.isScan) {
      countResult = await handleUpdateAsset({
        assetNo: assetNo,
        assetName: payload.assetName,
        isScan: true,
        isUnregistered: !!payload.isUnregistered,
        warehouse: payload.warehouse,
        area: payload.area,
        status: payload.status,
        countRound: payload.countRound,
        remarks: payload.remarks,
        requestId: payload.requestId
      });
      if (countResult.status === "error") return countResult;
    }

    await db.from("scan_logs").insert({
      req_id: payload.requestId || ("IMG-" + Date.now()),
      asset_no: assetNo,
      action: "Upload Image",
      status: "done",
      device: "Mobile",
      result: imageUrl ? "Image uploaded" : "No image"
    });

    return {
      status: "success",
      assetNo: assetNo,
      imageUrl: imageUrl,
      alreadyCounted: countResult ? countResult.alreadyCounted : false,
      timestamp: new Date().toISOString(),
      message: "บันทึกเรียบร้อย"
    };
  }

  // ===== ตัวส่งต่อ: เขียนทับ timedFetch =====

  const originalTimedFetch = window.timedFetch;

  function fakeResponse(body) {
    return {
      ok: true,
      status: 200,
      json: async function () { return body; },
      text: async function () { return JSON.stringify(body); }
    };
  }

  window.timedFetch = async function (action, url, options, meta) {
    options = options || {};
    const isPost = String(options.method || "GET").toUpperCase() === "POST";

    try {
      if (isPost) {
        const payload = JSON.parse(options.body || "{}");
        if (payload.action === "updateAsset") {
          return fakeResponse(await handleUpdateAsset(payload));
        }
        if (payload.action === "uploadScanImage") {
          return fakeResponse(await handleUploadScanImage(payload));
        }
        if (payload.action === "upload" || !payload.action) {
          return fakeResponse(await handleUpload(payload));
        }
      } else {
        const params = new URL(url).searchParams;
        const act = params.get("action");

        if (act === "lookup") {
          return fakeResponse(await handleLookup(params.get("assetNo")));
        }
        if (act === "add") {
          return fakeResponse(await handleAdd(params));
        }
        // Supabase เขียนเสร็จตอบทันที ไม่มีคิวหลังบ้านให้ตามสถานะ
        // ตอบ found:false ให้ผู้เรียกข้ามการแจ้งเตือน "รอหลังบ้าน" ไปเลย
        if (act === "scanStatus") {
          return fakeResponse({ status: "success", found: false });
        }
      }
    } catch (err) {
      console.error("[supabase] " + action + " ล้มเหลว", err);
      return fakeResponse({ status: "error", message: err.message || "เกิดข้อผิดพลาด" });
    }

    // ไม่มี action ไหนของหน้านี้เหลือให้ Apps Script แล้ว
    // แต่คงทางออกนี้ไว้เผื่อมีโค้ดเก่าเรียก action ที่ยังไม่ได้ย้าย
    console.warn("[supabase] action นี้ยังไม่ได้ย้าย ส่งต่อไป Apps Script:", action, url);
    return originalTimedFetch(action, url, options, meta);
  };

  console.log("[supabase] เชื่อมต่อแล้ว — ดักครบทุก action ของหน้า index");
})();
