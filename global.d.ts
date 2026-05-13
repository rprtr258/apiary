// Type declarations for Electron preload bridge.

interface Versions {
  node: () => string;
  chrome: () => string;
  electron: () => string;
}

interface Api {
  getData: () => Promise<unknown>;
}

declare global {
  interface Window {
    versions: Versions;
    api: Api;
  }
}

export {};
