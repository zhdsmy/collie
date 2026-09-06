/// <reference types="vite/client" />
/// <reference types="vite-plugin-pwa/client" />
/// <reference types="vitest/globals" />

// Build stamp baked in at build time (see vite.config.ts → BUILD_INFO).
declare const __BUILD_INFO__: {
  version: string;
  sha: string;
  time: string;
  id: string;
};

declare module "animal-island-ui/style" {
  // The package intentionally exports a stylesheet without a TypeScript module.
}
