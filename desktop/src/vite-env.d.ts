/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_DEFAULT_SERVER_ORIGIN?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
