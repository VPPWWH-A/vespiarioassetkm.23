// ==========================================
// ค่าเชื่อมต่อ Supabase — ใช้ร่วมกันทั้ง index.html และ dashboard.html
// ==========================================
//
// publishable key ตัวนี้ตั้งใจให้เปิดเผยในเบราว์เซอร์ ไม่ใช่ความลับ
// ความปลอดภัยอยู่ที่ RLS ฝั่ง Postgres ไม่ใช่การซ่อน key
// (ตรวจแล้ว: เขียนด้วย key นี้โดยไม่ login ได้ 401 row-level security policy)
//
// ห้ามเอา service_role key มาไว้ในไฟล์นี้เด็ดขาด — ตัวนั้นข้าม RLS ทั้งหมด

const SUPABASE_URL = "https://dbdgiggbwcjchkhgdxxx.supabase.co";
const SUPABASE_KEY = "sb_publishable_QjjderhYeuDJrUgYFT3AIg_xv0TXBEw";

// ต้องผูกกับ window ตรงๆ — const ที่ประกาศใน classic script ไม่ไปโผล่บน window
// ทำให้ไฟล์อื่นเรียก window.supabaseClient ไม่เจอถ้าใช้แค่ const
window.supabaseClient = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);
