-- ==========================================
-- Asset KM.23 — schema สำหรับ Supabase
-- วางทั้งไฟล์นี้ใน SQL Editor แล้วกด Run
-- ==========================================
-- ลำดับคอลัมน์อ้างอิงจาก Script/UserServices.txt (handleAdd, handleUpload, handleScan)
-- และจากชีตจริงที่ตรวจเมื่อ 2026-08-06

-- ========== 1. ทะเบียนหลัก ==========
-- ตรงกับ ASSETS_MASTER คอลัมน์ A-K (L,M เป็นคอลัมน์นับ ย้ายไปตาราง counts)
create table if not exists assets (
  asset_no          text primary key,
  asset_name        text not null default '',
  category          text,
  area              text,
  warehouse         text,
  acquisition_date  date,
  status            text default 'ใช้งานอยู่',
  remark            text,
  image_url         text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create index if not exists assets_warehouse_idx on assets (warehouse);
create index if not exists assets_category_idx  on assets (category);

-- ========== 2. รอบการนับ ==========
-- แทนคอลัมน์ "เช็ค <เดือน> <ปี> Count <รอบ>" ที่งอกใหม่ทุกเดือนในชีต
create table if not exists count_rounds (
  id         bigserial primary key,
  period     text     not null,
  round      smallint not null check (round in (1, 2)),
  opened_at  timestamptz not null default now(),
  closed_at  timestamptz,
  unique (period, round)
);

comment on column count_rounds.period is 'รูปแบบ YYYY-MM เช่น 2026-06';

-- ========== 3. ผลการนับ ==========
-- 1 แถว = asset 1 ตัว ในรอบ 1 รอบ
create table if not exists counts (
  id         bigserial primary key,
  round_id   bigint not null references count_rounds(id) on delete cascade,
  asset_no   text   not null references assets(asset_no) on delete cascade,
  result     text   not null default 'Count',
  counted_at timestamptz not null default now(),
  counted_by text,
  device     text,
  image_url  text,
  unique (round_id, asset_no)
);

create index if not exists counts_asset_idx on counts (asset_no);
create index if not exists counts_round_idx on counts (round_id);

-- view assets_with_latest_count ทำ lateral join แล้ว order by counted_at desc limit 1 ต่อ asset 1 ตัว
-- index (asset_no) อย่างเดียวยังต้องเรียงผลทุกครั้ง ตัวนี้ให้อ่านแถวแรกได้เลย
create index if not exists counts_asset_counted_idx on counts (asset_no, counted_at desc);

comment on column counts.result is 'Count | Checked — ค่าที่ Apps Script ถือว่านับแล้ว';
comment on column counts.device is 'Mobile | Handheld';

-- ========== 4. log การสแกน ==========
-- ตรงกับ SCAN_LOGS: [now, reqId, assetNo, action, status, device, result, durationMs]
create table if not exists scan_logs (
  id          bigserial primary key,
  req_id      text,
  asset_no    text,
  action      text,
  status      text,
  device      text,
  result      text,
  duration_ms integer,
  created_at  timestamptz not null default now()
);

create index if not exists scan_logs_asset_idx   on scan_logs (asset_no);
create index if not exists scan_logs_created_idx on scan_logs (created_at desc);

-- ========== 5. ของที่ยังไม่มีในทะเบียน ==========
-- ตรงกับ UNREGISTERED_ASSETS: [tempId, assetName, category, warehouse, area, remarks, now, fileUrl, 'Pending', assetStatus]
-- ระวัง: ลำดับ warehouse มาก่อน area สลับกับ ASSETS_MASTER
create table if not exists unregistered_assets (
  id           bigserial primary key,
  temp_id      text not null,
  asset_name   text,
  category     text,
  warehouse    text,
  area         text,
  remark       text,
  image_url    text,
  asset_status text default 'ใช้งานอยู่',
  review_state text not null default 'pending' check (review_state in ('pending','approved','rejected')),
  created_at   timestamptz not null default now(),
  reviewed_by  text,
  reviewed_at  timestamptz
);

create index if not exists unreg_state_idx on unregistered_assets (review_state);

-- ========== 6. view แทนคอลัมน์ Last Scan / Last Result ==========
create or replace view assets_with_latest_count as
select
  a.*,
  c.counted_at as last_scan,
  c.result     as last_result
from assets a
left join lateral (
  select counted_at, result
  from counts
  where asset_no = a.asset_no
  order by counted_at desc
  limit 1
) c on true;

-- view ใน Postgres ทำงานด้วยสิทธิ์ "เจ้าของ view" โดยปริยาย = ข้าม RLS ของตารางข้างใต้
-- บรรทัดนี้บังคับให้ใช้สิทธิ์ของคนเรียกแทน ห้ามลบ
alter view assets_with_latest_count set (security_invoker = on);

-- ========== 6.1 สรุปเวลาที่ใช้ต่อ asset ==========
-- dashboard ต้องการแค่ผลรวม duration_ms ต่อ asset ไม่ได้ใช้ log รายแถว
-- ถ้าดึง scan_logs ทั้งตารางมาบวกใน JS payload จะโตตามจำนวนการสแกนไม่มีที่สิ้นสุด
-- group ใน SQL แล้วแถวจะคงที่ตามจำนวน asset แทน
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

alter view scan_duration_by_asset set (security_invoker = on);

create index if not exists scan_logs_duration_idx on scan_logs (asset_no, action)
  where duration_ms > 0;

-- ========== 7. อัปเดต updated_at อัตโนมัติ ==========
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

-- ถ้ารันซ้ำบน DB ที่มี trigger อยู่แล้ว ให้ drop ก่อนเอง
-- (ไม่ใส่ drop ไว้ในไฟล์ เพราะ SQL Editor จะขึ้นคำเตือน destructive)
create trigger assets_set_updated_at
  before update on assets
  for each row execute function set_updated_at();

-- ========== 8. RLS — ต้องเปิดก่อนใส่ข้อมูลจริง ==========
-- ตารางที่ไม่เปิด RLS = ใครถือ anon key ก็อ่านและเขียนได้
alter table assets              enable row level security;
alter table count_rounds        enable row level security;
alter table counts              enable row level security;
alter table scan_logs           enable row level security;
alter table unregistered_assets enable row level security;

-- ระยะทดสอบ: อ่านได้ทุกคน เขียนได้เฉพาะที่ login แล้ว
-- ตอนขึ้นใช้จริงค่อยรัดให้แคบลง (แยก role admin)
create policy assets_read   on assets for select using (true);
create policy rounds_read   on count_rounds for select using (true);
create policy counts_read   on counts for select using (true);
create policy logs_read     on scan_logs for select using (true);
create policy unreg_read    on unregistered_assets for select using (true);

-- ต้องมี insert ให้ครบทุกตารางที่หน้าเว็บเขียน ไม่ใช่แค่ update
-- รอบแรกลืม assets_insert ไป ทำให้ปุ่ม "เพิ่มทรัพย์สิน" พังทั้งที่ล็อกอินแล้ว
create policy counts_write  on counts for insert to authenticated with check (true);
create policy logs_write    on scan_logs for insert to authenticated with check (true);
create policy unreg_write   on unregistered_assets for insert to authenticated with check (true);
create policy assets_insert on assets for insert to authenticated with check (true);
create policy rounds_insert on count_rounds for insert to authenticated with check (true);
create policy assets_update on assets for update to authenticated using (true);
create policy unreg_update  on unregistered_assets for update to authenticated using (true);

-- ========== 9. Storage สำหรับรูปถ่ายตอนสแกน ==========
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('asset-images', 'asset-images', true, 5242880, array['image/jpeg','image/png','image/webp'])
on conflict (id) do nothing;

create policy "asset_images_read" on storage.objects
  for select using (bucket_id = 'asset-images');
create policy "asset_images_upload" on storage.objects
  for insert to authenticated with check (bucket_id = 'asset-images');
create policy "asset_images_update" on storage.objects
  for update to authenticated using (bucket_id = 'asset-images');
