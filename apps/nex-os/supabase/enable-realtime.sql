-- NEX Music — Activar Realtime (seguro de ejecutar varias veces)
-- Si ves "already member of publication" = esa tabla YA está activa (está bien).

DO $$
DECLARE
  t text;
  tables text[] := ARRAY[
    'global_playlists',
    'playlist_votes',
    'playlist_reactions',
    'user_library'
  ];
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime') THEN
    CREATE PUBLICATION supabase_realtime;
  END IF;

  FOREACH t IN ARRAY tables
  LOOP
    IF NOT EXISTS (
      SELECT 1 FROM pg_publication_tables
      WHERE pubname = 'supabase_realtime'
        AND schemaname = 'public'
        AND tablename = t
    ) THEN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE public.%I', t);
      RAISE NOTICE 'Realtime activado: %', t;
    ELSE
      RAISE NOTICE 'Ya estaba activo: %', t;
    END IF;
  END LOOP;
END $$;

GRANT SELECT ON public.global_playlists TO supabase_realtime;
GRANT SELECT ON public.playlist_votes TO supabase_realtime;
GRANT SELECT ON public.playlist_reactions TO supabase_realtime;
GRANT SELECT ON public.user_library TO supabase_realtime;

-- Verificación: deben aparecer 4 tablas
SELECT tablename AS realtime_activo
FROM pg_publication_tables
WHERE pubname = 'supabase_realtime'
  AND schemaname = 'public'
ORDER BY tablename;
