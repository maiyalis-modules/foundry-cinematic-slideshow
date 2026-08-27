/**
 * Driving the live show. Every function here writes the `presentation` world
 * setting, which is what puts a slide on every client's screen — see
 * `models/presentation.ts` for why the show is state rather than a message, and
 * `module.ts` (`syncStage`) for the `updateSetting` hook that reacts to it.
 *
 * All of these are GM-only in practice: players cannot write a world setting, so
 * a stray call from a player client fails at Foundry's permission check rather
 * than silently half-working. `isPresenter()` is what the UI gates on.
 */
import { LOG_PREFIX, MODULE_ID, SETTINGS } from "../constants.js";
import type { Presentation } from "../models/presentation.js";
import type { Slide, Slideshow } from "../models/slideshow.js";

/** Whether this client may drive a show. */
export function isPresenter(): boolean {
  return game.user?.isGM === true;
}

export const PresentationStore = {
  /** Called from `init`; settings cannot be registered later. */
  register(): void {
    game.settings.register(MODULE_ID, SETTINGS.presentation, {
      scope: "world",
      config: false,
      type: Object,
      // An empty object rather than null: Foundry's Object-typed settings
      // round-trip that cleanly, and `current()` maps it back to null.
      default: {},
    });
  },
} as const;

/** The show on screen, or `null` when the stage is down. */
export function current(): Presentation | null {
  const raw = game.settings.get(MODULE_ID, SETTINGS.presentation) as AnyObject | null | undefined;
  if (!raw || !Array.isArray(raw["slides"]) || raw["slides"].length === 0) return null;
  return raw as unknown as Presentation;
}

/** The slide on screen, or `null`. Clamped, so a stale index reads as the end. */
export function currentSlide(show: Presentation | null = current()): Slide | null {
  if (!show) return null;
  const index = Math.max(0, Math.min(show.index, show.slides.length - 1));
  return show.slides[index] ?? null;
}

async function write(show: Presentation | null): Promise<void> {
  await game.settings.set(MODULE_ID, SETTINGS.presentation, show ?? {});
}

/**
 * Put a saved slideshow on screen from its first slide.
 *
 * The slides are copied, not referenced — see `models/presentation.ts`.
 */
export async function present(show: Slideshow): Promise<void> {
  if (show.slides.length === 0) {
    ui.notifications?.warn(game.i18n.localize("FCS.Notify.EmptyShow"));
    return;
  }
  console.log(`${LOG_PREFIX} Presenting "${show.name}" (${show.slides.length} slide(s)).`);
  await write({
    slideshowId: show.id,
    name: show.name,
    slides: show.slides.map((slide) => ({ ...slide })),
    index: 0,
    revision: 0,
  });
}

/**
 * Move `delta` slides. Stops at either end rather than wrapping — a show that
 * looped back to slide one because the GM pressed Next once too often would
 * read to the table as a mistake.
 *
 * `revision` is bumped even though the index changed, so stepping *back* onto a
 * slide replays its entrance instead of snapping.
 */
export async function step(delta: number): Promise<void> {
  const show = current();
  if (!show) return;
  const index = Math.max(0, Math.min(show.index + delta, show.slides.length - 1));
  if (index === show.index) return;
  await write({ ...show, index, revision: show.revision + 1 });
}

/** Re-run the current slide's entrance animation without changing slide. */
export async function replay(): Promise<void> {
  const show = current();
  if (!show) return;
  await write({ ...show, revision: show.revision + 1 });
}

/** Take the stage down for everyone. */
export async function end(): Promise<void> {
  if (!current()) return;
  await write(null);
}
