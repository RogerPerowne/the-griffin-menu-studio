import type { GriffinApi } from '../shared/api';

declare global {
  interface Window {
    griffin?: GriffinApi;
    griffinSplash?: {
      onStatus(handler: (label: string) => void): () => void;
      onHide(handler: () => void): () => void;
    };
  }
}

export {};
