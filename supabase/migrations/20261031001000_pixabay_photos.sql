-- Allow Pixabay (free API key, Pixabay Content License) as a photo source.
alter table public.menu_items drop constraint if exists menu_items_image_source_check;
alter table public.menu_items add constraint menu_items_image_source_check
  check (image_source in ('upload', 'pexels', 'wikimedia', 'pixabay'));
