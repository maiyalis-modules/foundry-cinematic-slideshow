/** Shared, immutable identifiers for the module. */

export const MODULE_ID = "foundry-cinematic-slideshow" as const;
export const MODULE_TITLE = "Maiyalis: Cinematic Slideshow" as const;

/** Prefix used for all console logging so output is easy to filter. */
export const LOG_PREFIX = `${MODULE_TITLE} |` as const;

/**
 * Socket channel name, kept for symmetry with the sibling modules — but nothing
 * emits on it yet and `module.json` declares `"socket": false`. Every message
 * this module needs runs GM → table, which the world-setting sync already
 * delivers (see `services/presentation-service.ts`). Flip `socket` on in
 * `module.json` before the first `game.socket.emit`, or it will be dropped.
 */
export const SOCKET_EVENT = `module.${MODULE_ID}` as const;

/** Setting keys, kept in one place to avoid typos across the codebase. */
export const SETTINGS = {
  /** The saved slideshow library (GM-authored, outlives a session). */
  slideshows: "slideshows",
  /** The show currently on screen, or `null`. See `models/presentation.ts`. */
  presentation: "presentation",
  /** Whether to show the launch button in the Journal sidebar. */
  showJournalButton: "showJournalButton",
  /** Animation a newly added slide starts with. */
  defaultAnimation: "defaultAnimation",
} as const;

/**
 * Settings-menu keys (buttons that open a window instead of a flat control).
 * Foundry gives a module exactly one flat settings category, so preferences
 * live in our own window — see `apps/config-window.ts`.
 */
export const MENUS = {
  /** Opens the Cinematic Slideshow settings window. */
  slideshowConfig: "slideshowConfigMenu",
} as const;

/** Foundry template paths (served from the module root at runtime). */
export const TEMPLATES = {
  /** The saved-slideshow library: new / edit / delete / present. */
  library: `modules/${MODULE_ID}/templates/slideshow-library.hbs`,
  /** One slideshow's editor — its name and its ordered slide list. */
  slideshowEditor: `modules/${MODULE_ID}/templates/slideshow-editor.hbs`,
  /** The per-slide popup opened from a row in the slideshow editor. */
  slideEditor: `modules/${MODULE_ID}/templates/slide-editor.hbs`,
  /** The full-screen stage every client watches a show on. */
  stage: `modules/${MODULE_ID}/templates/stage.hbs`,
  /** Body of the settings window. */
  config: `modules/${MODULE_ID}/templates/slideshow-config.hbs`,
  /** Save/Cancel bar, shared by the settings and editor windows. */
  configFooter: `modules/${MODULE_ID}/templates/config-footer.hbs`,
} as const;
