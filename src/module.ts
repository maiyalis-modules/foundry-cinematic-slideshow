/**
 * Maiyalis: Cinematic Slideshow — module entry point.
 *
 * Wires the slideshow tools into FoundryVTT's lifecycle hooks. The content
 * model lives in `models/`, persistence in `stores/`, the live show in
 * `services/presentation-service.ts`, and the windows in `apps/`; this file only
 * bootstraps, keeps the stage in sync with shared state, and exposes a small
 * public API on the module.
 */
import { SlideshowLibraryApp } from "./apps/slideshow-library-app.js";
import { StageApp } from "./apps/stage-app.js";
import { LOG_PREFIX, MODULE_ID, SETTINGS } from "./constants.js";
import type { Presentation } from "./models/presentation.js";
import {
  PresentationStore,
  current,
  end,
  isPresenter,
  present,
  replay,
  step,
} from "./services/presentation-service.js";
import { registerSettings } from "./settings.js";
import { SlideshowStore } from "./stores/slideshow-store.js";

/** The shape of the public API exposed at `game.modules.get(MODULE_ID).api`. */
export interface CinematicSlideshowApi {
  /** Open the slideshow library (GM only). */
  open(): void;
  /** Put a saved slideshow on screen by id or by exact name. */
  present(idOrName: string): Promise<void>;
  next(): Promise<void>;
  previous(): Promise<void>;
  replay(): Promise<void>;
  end(): Promise<void>;
  /** The show on screen, or `null`. */
  current(): Presentation | null;
}

let library: SlideshowLibraryApp;
let stage: StageApp;

/**
 * Show the stage while a presentation is live and take it down when it ends —
 * for everyone, off the same `updateSetting` sync. Nothing running means nothing
 * to look at, and a stage left up with nothing driving it is the failure mode to
 * watch for, so `end()` nulling the setting is what closes it rather than any
 * per-client bookkeeping.
 */
function syncStage(): void {
  if (!stage) return;
  if (current()) {
    void stage.render(true);
    return;
  }
  if (!stage.rendered) return;
  // `{ animate: false }`: Foundry's default close forces the element to its last
  // measured box and runs a ~1s collapse toward it — fine for a normal window,
  // but this app is a `position: fixed; inset: 0` overlay with
  // `window.positioned: false`, so mid-collapse it visibly shrinks toward
  // whatever box Foundry last thought it had rather than just clearing.
  void stage.close({ animate: false });
}

function openLibrary(): void {
  if (!isPresenter()) {
    ui.notifications?.warn(game.i18n.localize("FCS.Notify.GMOnly"));
    return;
  }
  void library.render(true);
}

Hooks.once("init", () => {
  console.log(`${LOG_PREFIX} Initializing.`);
  SlideshowStore.register();
  PresentationStore.register();
  registerSettings();
  library = new SlideshowLibraryApp();
  stage = new StageApp();
});

Hooks.once("ready", () => {
  const api: CinematicSlideshowApi = {
    open: () => openLibrary(),
    present: async (idOrName: string) => {
      const show =
        SlideshowStore.get(idOrName) ??
        SlideshowStore.list().find((candidate) => candidate.name === idOrName) ??
        null;
      if (!show) {
        ui.notifications?.warn(game.i18n.format("FCS.Notify.NoSuchShow", { name: idOrName }));
        return;
      }
      await present(show);
    },
    next: () => step(1),
    previous: () => step(-1),
    replay: () => replay(),
    end: () => end(),
    current: () => current(),
  };

  const module = game.modules.get(MODULE_ID);
  if (module) module.api = api;

  // A player joining mid-show gets the stage immediately; the GM's comes up with
  // the world. This is the whole reason the show is a world setting rather than
  // a socket message — there is nothing to replay to a late arrival.
  syncStage();

  console.log(`${LOG_PREFIX} Ready. ${SlideshowStore.list().length} saved slideshow(s).`);
});

// Keep every client's stage in sync: when the GM writes the presentation
// setting, Foundry fires `updateSetting` on all clients.
Hooks.on("updateSetting", (setting: { key?: string } | undefined) => {
  if (setting?.key === `${MODULE_ID}.${SETTINGS.slideshows}`) {
    // The library is world state a second GM can change from another client —
    // a show appearing, renaming, or vanishing should land without reopening
    // the window. The stage deliberately does not react: it holds its own
    // snapshot of the slides (see `models/presentation.ts`).
    if (library?.rendered) void library.render();
    return;
  }
  if (setting?.key !== `${MODULE_ID}.${SETTINGS.presentation}`) return;
  // One call, not two: render(true) on an already-rendered app re-renders it,
  // so syncStage covers both putting the stage up and moving it to the new
  // slide. A second render here would restart the entrance animation twice.
  syncStage();
});

// Add the launch button to the Journal sidebar's header controls, unless
// disabled. GM-only: the library is a GM tool, and only a GM can write the
// world settings behind it.
Hooks.on("renderJournalDirectory", (_app: unknown, html: HTMLElement | JQuery) => {
  if (!game.user?.isGM) return;
  if (game.settings.get(MODULE_ID, SETTINGS.showJournalButton) === false) return;

  const root = html instanceof HTMLElement ? html : (html as JQuery)[0];
  if (!root || root.querySelector(`.${MODULE_ID}-launch-row`)) return;

  const row = document.createElement("div");
  row.className = `flexrow ${MODULE_ID}-launch-row`;

  const button = document.createElement("button");
  button.type = "button";
  button.className = `${MODULE_ID}-launch`;
  button.innerHTML = `<i class="fa-solid fa-photo-film"></i> ${game.i18n.localize("FCS.LaunchButton")}`;
  const tooltip = game.i18n.localize("FCS.LaunchTooltip");
  button.dataset["tooltip"] = tooltip;
  button.setAttribute("aria-label", tooltip);
  button.addEventListener("click", () => openLibrary());

  row.append(button);

  const header = root.querySelector(".directory-header") ?? root;
  header.prepend(row);
});
