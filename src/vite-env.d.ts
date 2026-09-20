/// <reference types="vite/client" />

declare const __WORKSPACE_ROOT__: string

interface ImportMetaEnv {
  readonly VITE_POSTHOG_KEY?: string
  readonly VITE_POSTHOG_HOST?: string
  readonly VITE_POSTHOG_DEV?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
