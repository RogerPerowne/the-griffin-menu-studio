import type { GriffinApi } from '../shared/api';

declare global {
  interface Window {
    griffin?: GriffinApi;
  }
}

export {};
