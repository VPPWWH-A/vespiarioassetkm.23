-- ==========================================
-- ปรับความเร็ว Dashboard — รันครั้งเดียวใน Supabase SQL Editor
-- ==========================================
--
-- รันซ้ำได้ ไม่ทำลายข้อมูล ไม่แตะแถวใดๆ สร้างแค่ index กับ view
-- เนื้อหาเดียวกันนี้ถูกใส่ใน schema.sql แล้ว ไฟล์นี้ไว้อัปเดตฐานที่สร้างไปก่อนหน้า
--
-- ต้องรันก่อน deploy js/dashboard/api-supabase.js ตัวใหม่
-- เพราะหน้า dashboard จะเรียก view scan_duration_by_asset ที่ยังไม่มี

-- ========== 1. index ให้ lateral join ของ assets_with_latest_count ==========
-- view หา "ผลนับล่าสุด" ต่อ asset 1 ตัว ด้วย order by counted_at desc limit 1
-- index เดิมมีแค่ (asset_no) จึงต้องเรียงผลใหม่ทุกครั้ง
create index if not exists counts_asset_counted_idx on counts (asset_no, counted_at desc);

-- ========== 2. สรุปเวลาที่ใช้ต่อ asset ==========
-- เดิม dashboard ดึง scan_logs ทั้งตารางมาบวกใน JS
-- payload จึงโตตามจำนวนการสแกนไปเรื่อยๆ ทั้งที่ใช้แค่ผลรวม
create or replace view scan_duration_by_asset as
select
  upper(asset_no)                            as asset_key,
  (action = 'Added to Unregistered')         as is_unreg_added,
  sum(duration_ms)::bigint                   as duration_ms,
  max(created_at)                            as last_created_at
from scan_logs
where duration_ms is not null
  and duration_ms > 0
  and asset_no is not null
  and asset_no <> ''
group by 1, 2;

-- ต้องตั้งทุกครั้ง — view ใช้สิทธิ์เจ้าของโดยปริยาย = ข้าม RLS ของ scan_logs
alter view scan_duration_by_asset set (security_invoker = on);

create index if not exists scan_logs_duration_idx on scan_logs (asset_no, action)
  where duration_ms > 0;

-- ========== 3. ตรวจผล ==========
-- จำนวนแถวที่ dashboard ต้องโหลดควรลดลงจากจำนวน scan_logs ทั้งหมด
select
  (select count(*) from scan_logs)              as scan_logs_rows,
  (select count(*) from scan_duration_by_asset) as view_rows;
