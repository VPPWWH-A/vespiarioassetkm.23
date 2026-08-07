-- ==========================================
-- เปิดสิทธิ์ลบไฟล์ในถัง asset-images — รันครั้งเดียวใน Supabase SQL Editor
-- ==========================================
--
-- ตอนตั้งถังไว้แต่แรกมี policy แค่ INSERT / SELECT / UPDATE
-- พอ index เริ่มลบรูปเก่าหลังถ่ายทับ คำสั่ง remove() จะถูก RLS ปฏิเสธเงียบๆ
-- ผลคือรูปกำพร้าสะสมต่อไปทั้งที่โค้ดสั่งลบแล้ว
--
-- ต้องรันก่อน deploy js/index/api-supabase.js ตัวใหม่

create policy asset_images_delete
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'asset-images');

-- ตรวจผล ควรเห็นครบ 4 แถว: DELETE, INSERT, SELECT, UPDATE
select policyname, cmd
from pg_policies
where schemaname = 'storage' and tablename = 'objects'
order by cmd;
