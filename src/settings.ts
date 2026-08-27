/**
 * Registers the module's settings with Foundry. Must be called during the `init`
 * hook (settings cannot be registered later).
 *
 * The two content settings — the slideshow library and the live show — register
 * themselves from their own stores (`SlideshowStore`, `PresentationStore`),
 * beside the code that reads and writes them. What is left here is the
 * preferences, all `config: false` and edited from `SlideshowConfig` instead of
 * Foundry's flat settings list, the same way the sibling modules organize theirs.
 *
 * No menu opens the library window: the Journal-sidebar button (see module.ts)
 * and `game.modules.get(MODULE_ID).api.open()` already cover that, and a
 * settings entry would be a third, redundant way in.
 */
import { SlideshowConfig } from "./apps/slideshow-config.js";
import { MENUS, MODULE_ID, SETTINGS } from "./constants.js";
import { ANIMATIONS } from "./models/slideshow.js";

export function registerSettings(): void {
  // Shows/hides the Journal-sidebar launch button (see module.ts).
  game.settings.register(MODULE_ID, SETTINGS.showJournalButton, {
    name: "FCS.Settings.ShowJournalButtonName",
    hint: "FCS.Settings.ShowJournalButtonHint",
    scope: "world",
    config: false,
    type: Boolean,
    default: true,
  });

  // What a newly added slide starts with. World-scoped rather than client: it
  // shapes content that everyone will watch, and only GMs author slides anyway.
  game.settings.register(MODULE_ID, SETTINGS.defaultAnimation, {
    name: "FCS.Settings.DefaultAnimationName",
    hint: "FCS.Settings.DefaultAnimationHint",
    scope: "world",
    config: false,
    type: String,
    choices: Object.fromEntries(
      Object.values(ANIMATIONS).map((animation) => [animation, `FCS.Animation.${animation}`]),
    ),
    default: ANIMATIONS.fade,
  });

  // The one button Foundry gives us in Configure Settings. `restricted: true`
  // keeps it GM-only, which matters because both settings above are
  // world-scoped and only a GM can write one.
  game.settings.registerMenu(MODULE_ID, MENUS.slideshowConfig, {
    name: "FCS.Settings.ConfigMenu.Name",
    label: "FCS.Settings.ConfigMenu.Label",
    hint: "FCS.Settings.ConfigMenu.Hint",
    icon: "fa-solid fa-sliders",
    type: SlideshowConfig,
    restricted: true,
  });
}
