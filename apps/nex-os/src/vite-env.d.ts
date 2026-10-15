/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />

interface ImportMetaEnv {
  readonly VITE_SUPABASE_URL?: string;
  readonly VITE_SUPABASE_ANON_KEY?: string;
  readonly VITE_SUPABASE_PUBLISHABLE_KEY?: string;
  /** @deprecated typo — usar VITE_SUPABASE_URL */
  readonly VITE_SUPBASE_URL?: string;
  readonly VITE_SUPBASE_ANON_KEY?: string;
  readonly VITE_SUPBASE_PUBLISHABLE_KEY?: string;
  readonly NEXT_PUBLIC_SUPABASE_URL?: string;
  readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
  readonly NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY?: string;
  /** '1' en la imagen del TV box: la UI exige el estado de nex-agent (falla cerrado). */
  readonly VITE_NEX_MDM?: string;
  /** URL https del panel (/admin) para el QR de vinculación del TV. */
  readonly VITE_NEX_ADMIN_URL?: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
