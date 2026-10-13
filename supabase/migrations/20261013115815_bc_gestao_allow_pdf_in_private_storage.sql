-- Hotfix: Fases 6B/6C geram PDFs no mesmo bucket privado criado na 6A.
-- Preserva privacidade, limite e tipos de imagem existentes; adiciona somente application/pdf.

update storage.buckets
set allowed_mime_types = (
  select array_agg(distinct mime order by mime)
  from unnest(
    coalesce(allowed_mime_types, '{}'::text[])
    || array['application/pdf']::text[]
  ) as mime
)
where id = 'bc-prontuario-private';
