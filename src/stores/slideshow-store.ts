/**
 * The saved slideshow library, persisted in a world setting.
 *
 * World-scoped because slideshows are GM-authored content that outlives an
 * evening and every client has to be able to read one — and because only a GM
 * can write a world setting, which is exactly the permission this content
 * wants. The live show is a *separate* setting (see `PresentationStore`) so
 * ending a show does not rewrite the library, and editing the library does not
 * re-render the stage.
 */
import { MODULE_ID, SETTINGS } from "../constants.js";
import { normalizeSlideshow, type Slideshow } from "../models/slideshow.js";

export const SlideshowStore = {
  /** Called from `init`; settings cannot be registered later. */
  register(): void {
    game.settings.register(MODULE_ID, SETTINGS.slideshows, {
      scope: "world",
      config: false,
      type: Array,
      default: [],
    });
  },

  /** Every saved slideshow, most recently edited first. */
  list(): Slideshow[] {
    const raw = game.settings.get(MODULE_ID, SETTINGS.slideshows);
    const rows = Array.isArray(raw) ? (raw as AnyObject[]) : [];
    return rows.map(normalizeSlideshow).sort((a, b) => b.updatedAt - a.updatedAt);
  },

  get(id: string): Slideshow | null {
    return this.list().find((show) => show.id === id) ?? null;
  },

  /** Insert or replace by id, stamping `updatedAt`. */
  async save(show: Slideshow): Promise<void> {
    const shows = this.list().filter((other) => other.id !== show.id);
    shows.push({ ...show, updatedAt: Date.now() });
    await game.settings.set(MODULE_ID, SETTINGS.slideshows, shows);
  },

  async remove(id: string): Promise<void> {
    const shows = this.list().filter((show) => show.id !== id);
    await game.settings.set(MODULE_ID, SETTINGS.slideshows, shows);
  },
} as const;
