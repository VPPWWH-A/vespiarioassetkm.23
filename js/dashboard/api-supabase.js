// ชั้นเชื่อม Dashboard เข้ากับ Supabase
// แปลงข้อมูลให้มีรูปแบบ array เดิม เพื่อให้ ui.js และ export.js ใช้ต่อได้
(function () {
  const db = window.supabaseClient;
  if (!db) throw new Error("ไม่พบ Supabase client");

  const PAGE_SIZE = 1000;

  // ยิงหน้าแรกพร้อมขอจำนวนแถวทั้งหมด แล้วดึงหน้าที่เหลือขนานกัน
  // แบบเดิมวนรอหน้าก่อนจบถึงยิงหน้าถัดไป ตารางใหญ่จึงเสีย round trip เรียงกันเปล่าๆ
  async function allRows(table, select, order) {
    function page(from, exact) {
      let query = db
        .from(table)
        .select(select, exact ? { count: "exact" } : undefined)
        .range(from, from + PAGE_SIZE - 1);
      if (order) query = query.order(order, { ascending: true });
      return query;
    }

    const first = await page(0, true);
    if (first.error) throw first.error;
    const rows = first.data || [];

    const total = Number(first.count);
    if (!total || total <= rows.length) return rows;

    const requests = [];
    for (let from = PAGE_SIZE; from < total; from += PAGE_SIZE) requests.push(page(from, false));

    const pages = await Promise.all(requests);
    pages.forEach(result => {
      if (result.error) throw result.error;
      rows.push.apply(rows, result.data || []);
    });
    return rows;
  }

  function periodLabel(period) {
    const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const match = String(period || "").match(/^(\d{4})-(\d{2})$/);
    return match ? months[Number(match[2]) - 1] + " " + match[1] : String(period || "");
  }

  function counted(value) {
    return value === "Count" || value === "Checked";
  }

  function makeModel(assets, rounds, counts, durations, unregistered) {
    rounds.sort((a, b) => String(a.period).localeCompare(String(b.period)) || Number(a.round) - Number(b.round));
    const columns = rounds.map(r => ({ id: String(r.id), period: r.period, round: Number(r.round), name: "เช็ค " + periodLabel(r.period) + " Count " + r.round }));
    const countMap = {};
    counts.forEach(c => { countMap[String(c.asset_no) + "#" + String(c.round_id)] = c.result || "Count"; });
    const headers = ["Asset No", "Asset Name", "Category", "Area", "Warehouse", "Acquisition Date", "Status", "Last Scan", "Last Result", "Remark", "Image URL"];
    columns.forEach(c => headers.push(c.name));
    const rows = assets.map(a => {
      const row = [a.asset_no || "", a.asset_name || "", a.category || "", a.area || "", a.warehouse || "", a.acquisition_date || "", a.status || "", a.last_scan || "", a.last_result || "", a.remark || "", a.image_url || ""];
      columns.forEach(c => row.push(countMap[String(a.asset_no) + "#" + c.id] || ""));
      return row;
    });

    const periods = [];
    const seen = {};
    columns.forEach(c => {
      if (seen[c.period]) return;
      seen[c.period] = true;
      periods.push({ key: c.period, label: periodLabel(c.period), isEmpty: false });
    });
    const requested = String(currentCountPeriod || "");
    const active = requested && periods.some(p => p.key === requested)
      ? requested
      : (periods.length ? periods[periods.length - 1].key : "");
    const activeCols = columns.filter(c => c.period === active);
    const count1 = activeCols.find(c => c.round === 1);
    const count2 = activeCols.find(c => c.round === 2);
    const countMeta = {
      activeCountPeriod: active,
      activeCountPeriodLabel: periodLabel(active),
      count1Name: count1 ? count1.name : "",
      count2Name: count2 ? count2.name : "",
      count1Index: count1 ? headers.indexOf(count1.name) : -1,
      count2Index: count2 ? headers.indexOf(count2.name) : -1,
      countPeriods: periods,
      isEmpty: !count1 && !count2
    };

    const checkedFor = index => index >= 0 ? rows.filter(r => counted(r[index])).length : 0;
    const checked = checkedFor(countMeta.count1Index);
    const checked2 = checkedFor(countMeta.count2Index);
    const totalAssets = rows.length;
    const checkedAny = rows.filter(r => counted(r[countMeta.count1Index]) || counted(r[countMeta.count2Index])).length;
    const checkedBoth = rows.filter(r => counted(r[countMeta.count1Index]) && counted(r[countMeta.count2Index])).length;
    const summary = { totalAssets, checked, checked2, checkedAny, checkedBoth, count2Only: Math.max(0, checked2 - checkedBoth), pending: totalAssets - checked, pending2: totalAssets - checked2, pendingAny: totalAssets - checkedAny, pendingComplete: totalAssets - checkedBoth, pct: totalAssets ? Math.round(checked * 100 / totalAssets) : 0, pct2: totalAssets ? Math.round(checked2 * 100 / totalAssets) : 0, pctComplete: totalAssets ? Math.round(checkedBoth * 100 / totalAssets) : 0, notFound: 0, added: 0, todayScans: 0, currentMonthName: countMeta.count1Name, currentMonthName2: countMeta.count2Name };

    const master = {};
    rows.forEach(r => { master[String(r[0]).toUpperCase()] = true; });
    // durations มาจาก view scan_duration_by_asset ที่ group ใน SQL แล้ว
    // 1 แถว = asset 1 ตัว ต่อ 1 ประเภทงาน ไม่ใช่ log รายครั้งเหมือนเดิม
    const scanDurationByAsset = {}, unregAddedDurationByAsset = {};
    let scanTotal = 0, unregTotal = 0;
    durations.forEach(row => {
      const ms = Number(row.duration_ms || 0), key = String(row.asset_key || "").toUpperCase();
      if (!ms || !key) return;
      const target = row.is_unreg_added ? unregAddedDurationByAsset : scanDurationByAsset;
      target[key] = target[key] || { durationMs: 0, createdAt: 0 };
      target[key].durationMs += ms;
      target[key].createdAt = Math.max(target[key].createdAt, row.last_created_at ? new Date(row.last_created_at).getTime() : 0);
      if (row.is_unreg_added) unregTotal += ms; else if (master[key]) scanTotal += ms;
    });

    const unregHeaders = ["Temp ID", "Asset Name", "Category", "Warehouse", "Area", "Remark", "Created At", "Image URL", "Review State", "Asset Status"];
    const unregRows = unregistered.map(u => [u.temp_id || "", u.asset_name || "", u.category || "", u.warehouse || "", u.area || "", u.remark || "", u.created_at || "", u.image_url || "", u.review_state || "", u.asset_status || ""]);
    return {
      summary, countMeta, countPeriods: periods, headers, assets: rows, total: rows.length,
      unregHeaders, unregAssets: unregRows, scanDurationByAsset, unregAddedDurationByAsset,
      scanDurationTotalMs: scanTotal, unregAddedDurationTotalMs: unregTotal
    };
  }

  async function loadModel() {
    const [assets, rounds, counts, durations, unregistered] = await Promise.all([
      allRows("assets_with_latest_count", "asset_no,asset_name,category,area,warehouse,acquisition_date,status,last_scan,last_result,remark,image_url", "asset_no"),
      allRows("count_rounds", "id,period,round", "period"),
      allRows("counts", "round_id,asset_no,result", "asset_no"),
      allRows("scan_duration_by_asset", "asset_key,is_unreg_added,duration_ms,last_created_at", "asset_key"),
      allRows("unregistered_assets", "temp_id,asset_name,category,warehouse,area,remark,created_at,image_url,review_state,asset_status", "created_at")
    ]);
    return makeModel(assets, rounds, counts, durations, unregistered);
  }

  window.loadDashboard = async function () {
    const button = document.getElementById("refresh-btn");
    if (button) button.disabled = true;
    try {
      const sessionResult = await db.auth.getSession();
      if (!sessionResult.data || !sessionResult.data.session) {
        setDashboardLoadError("กรุณาเข้าสู่ระบบก่อนดูข้อมูล Dashboard");
        return;
      }
      const model = await loadModel();
      applyDashboardData({ status: "ok", summary: model.summary, countMeta: model.countMeta, countPeriods: model.countPeriods }, model);
      saveLastGoodDashboard({ status: "ok", summary: model.summary, countMeta: model.countMeta, countPeriods: model.countPeriods }, model);
    } catch (error) {
      console.error("[dashboard/supabase]", error);
      if (!restoreLastGoodDashboard()) setDashboardLoadError(error.message || "โหลดข้อมูลไม่สำเร็จ");
      showToast("โหลดข้อมูลไม่สำเร็จ: " + (error.message || "Unknown error"), "error");
    } finally {
      if (button) button.disabled = false;
    }
  };

  window.submitApproveLogin = async function () {
    const user = document.getElementById("approve-user").value.trim();
    const pass = document.getElementById("approve-pass").value.trim();
    const err = document.getElementById("approve-login-error");
    const result = await db.auth.signInWithPassword({ email: (user.includes("@") ? user : user + "@vespiario.com").toLowerCase(), password: pass });
    if (result.error) { err.textContent = "ชื่อผู้ใช้หรือรหัสผ่านไม่ถูกต้อง"; err.style.display = "block"; return; }
    approveAuth = { user: user, pass: "supabase-session" };
    sessionStorage.setItem("approveAuth", JSON.stringify(approveAuth));
    closeApproveLogin(); updateAuthUi(); setDashboardView("table");
    await loadDashboard({ forceFresh: true });
  };

  window.startNewCountRound = async function () {
    if (!requireApproveLogin()) return;
    const period = new Date().getFullYear() + "-" + String(new Date().getMonth() + 1).padStart(2, "0");
    for (const round of [1, 2]) {
      const existing = await db.from("count_rounds").select("id").eq("period", period).eq("round", round).maybeSingle();
      if (!existing.data) await db.from("count_rounds").insert({ period, round });
    }
    showToast("สร้างรอบนับเดือนปัจจุบันแล้ว", "success");
    await loadDashboard();
  };

  window.confirmUnreg = async function (id, btn) {
    if (!requireApproveLogin() || !confirm("Approve item " + id + " into the master asset list?")) return;
    if (btn) btn.disabled = true;
    const found = await db.from("unregistered_assets").select("*").eq("temp_id", String(id)).maybeSingle();
    if (found.error || !found.data) { showToast("ไม่พบรายการ", "error"); return; }
    const u = found.data;
    const inserted = await db.from("assets").insert({ asset_no: u.temp_id, asset_name: u.asset_name || "", category: u.category, warehouse: u.warehouse, area: u.area, remark: u.remark, image_url: u.image_url, status: u.asset_status || "ใช้งานอยู่" });
    if (inserted.error && inserted.error.code !== "23505") { showToast(inserted.error.message, "error"); return; }
    await db.from("unregistered_assets").update({ review_state: "approved", reviewed_by: approveAuth.user, reviewed_at: new Date().toISOString() }).eq("temp_id", u.temp_id);
    showToast("อนุมัติเรียบร้อย", "success"); await loadDashboard();
  };

  window.confirmAllUnreg = async function (btn) {
    if (!requireApproveLogin() || !confirm("Approve all pending items into the master asset list?")) return;
    const result = await db.from("unregistered_assets").select("*").eq("review_state", "pending");
    let added = 0;
    for (const u of result.data || []) {
      const inserted = await db.from("assets").insert({ asset_no: u.temp_id, asset_name: u.asset_name || "", category: u.category, warehouse: u.warehouse, area: u.area, remark: u.remark, image_url: u.image_url, status: u.asset_status || "ใช้งานอยู่" });
      if (!inserted.error || inserted.error.code === "23505") { await db.from("unregistered_assets").update({ review_state: "approved", reviewed_by: approveAuth.user, reviewed_at: new Date().toISOString() }).eq("id", u.id); added++; }
    }
    showToast("อนุมัติแล้ว " + added + " รายการ", "success"); await loadDashboard();
  };
})();
