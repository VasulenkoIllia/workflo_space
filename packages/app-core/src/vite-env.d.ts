// Vite injects import.meta.env at build time in the consuming SPA. This package is
// only ever bundled by Vite (portal/workspace), so declare the minimal surface here
// without depending on vite. NOT exported through index.ts — internal ambient types.
interface ImportMetaEnv {
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
