-- =====================================================================
-- Automatic dish photos: where a photo came from and how to credit it.
--   upload    — uploaded by the restaurant (real food photo)
--   pexels    — Pexels licence (free commercial use), credited
--   wikimedia — Wikimedia Commons (CC BY / CC BY-SA / PD), credited
-- Auto photos are shown to customers as "representative image".
-- =====================================================================
alter table public.menu_items
  add column if not exists image_source text not null default 'upload',
  add column if not exists image_credit text,
  add column if not exists image_credit_url text;

do $$
begin
  if not exists (select 1 from pg_constraint where conname = 'menu_items_image_source_check') then
    alter table public.menu_items add constraint menu_items_image_source_check
      check (image_source in ('upload', 'pexels', 'wikimedia'));
  end if;
end $$;

-- Let the restaurant switch automatic photos off (Admin → Settings).
alter table public.restaurant_settings add column if not exists auto_dish_photos boolean not null default true;
