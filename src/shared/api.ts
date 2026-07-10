// The typed surface the preload bridge exposes to the renderer as `window.griffin`.
// Grows as IPC lands in later phases; kept in shared so renderer + preload agree.

export interface GriffinApi {
  /** True when running inside Electron (vs a plain browser preview). */
  readonly isDesktop: true;
  readonly platform: string;
}
