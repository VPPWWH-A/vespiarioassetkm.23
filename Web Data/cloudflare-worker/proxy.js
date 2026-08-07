// ==========================================
// Cloudflare Worker: Proxy สำหรับซ่อน API secret ของ Apps Script backend
// ==========================================
//
// หน้าที่: รับ request จากหน้าเว็บ (index.html / dashboard.html) แล้วแปะ secret key
// จริงก่อนส่งต่อไปที่ Google Apps Script — เบราว์เซอร์ไม่เห็น secret key เลย
// (secret เก็บไว้เป็น environment variable/secret ฝั่ง Cloudflare เท่านั้น)
//
// ต้องตั้งค่า secret 2 ตัวใน Cloudflare Worker settings ก่อน deploy:
//   BACKEND_URL - Apps Script exec URL ปัจจุบัน (เช่น https://script.google.com/macros/s/XXXX/exec)
//   BACKEND_KEY - secret key จริงที่ backend เช็ค (ต้องตรงกับ CONFIG.SECRET_KEY ใน Script/config.txt)
//
// แก้ ALLOWED_ORIGIN ด้านล่างให้ตรงกับ origin จริงของเว็บที่ deploy อยู่

const ALLOWED_ORIGIN = "https://vppwwh-a.github.io";

function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Vary": "Origin"
  };
}

function errorResponse(message, status) {
  return new Response(JSON.stringify({ status: "error", message: message }), {
    status: status || 500,
    headers: { "Content-Type": "application/json", ...corsHeaders() }
  });
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders() });
    }

    const backendUrl = env.BACKEND_URL;
    const backendKey = env.BACKEND_KEY;
    if (!backendUrl || !backendKey) {
      return errorResponse("Proxy misconfigured: missing BACKEND_URL/BACKEND_KEY", 500);
    }

    try {
      if (request.method === "GET") {
        const incomingUrl = new URL(request.url);
        const target = new URL(backendUrl);
        for (const [k, v] of incomingUrl.searchParams) {
          if (k === "key") continue; // ไม่สนใจ key ที่ client ส่งมา ใช้ของจริงจาก env แทนเสมอ
          target.searchParams.set(k, v);
        }
        target.searchParams.set("key", backendKey);

        const upstream = await fetch(target.toString(), { method: "GET" });
        const body = await upstream.text();
        return new Response(body, {
          status: upstream.status,
          headers: {
            "Content-Type": upstream.headers.get("Content-Type") || "application/json",
            ...corsHeaders()
          }
        });
      }

      if (request.method === "POST") {
        const incomingText = await request.text();
        let data;
        try {
          data = JSON.parse(incomingText);
        } catch (parseErr) {
          data = {};
        }
        data.key = backendKey;

        const upstream = await fetch(backendUrl, {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=utf-8" },
          body: JSON.stringify(data)
        });
        const body = await upstream.text();
        return new Response(body, {
          status: upstream.status,
          headers: {
            "Content-Type": upstream.headers.get("Content-Type") || "application/json",
            ...corsHeaders()
          }
        });
      }

      return errorResponse("Method not allowed", 405);
    } catch (err) {
      return errorResponse("Proxy error: " + (err && err.message ? err.message : String(err)), 500);
    }
  }
};
