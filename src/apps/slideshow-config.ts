/**
 * The module's settings window, opened from the one button Foundry gives us in
 * Configure Settings. Holds preferences only — the slideshows themselves live in
 * `SlideshowLibraryApp`, which opens from the Journal sidebar. A tool you reach
 * every session does not belong buried behind a checkbox you set once.
 */
import { MODULE_ID, SETTINGS, TEMPLATES } from "../constants.js";
import { ANIMATIONS } from "../models/slideshow.js";
import { ConfigWindow } from "./config-window.js";

export class SlideshowConfig extends ConfigWindow {
  static override DEFAULT_OPTIONS: AnyObject = {
    id: `${MODULE_ID}-config`,
    window: {
      title: "FCS.Config.Title",
      icon: "fa-solid fa-sliders",
    },
  };

  static PARTS = {
    main: { template: TEMPLATES.config },
    footer: { template: TEMPLATES.configFooter },
  };

  protected override settingKeys = [
    SETTINGS.showJournalButton,
    SETTINGS.defaultAnimation,
  ] as const;

  async _prepareContext(options: AnyObject): Promise<AnyObject> {
    const context = (await super._prepareContext?.(options)) ?? {};
    const selected = game.settings.get(MODULE_ID, SETTINGS.defaultAnimation);
    return {
      ...context,
      showJournalButton: ConfigWindow.flag(SETTINGS.showJournalButton),
      // Precomputed `selected` per option: Handlebars here has no `eq` helper
      // (see AGENTS.md), so a template cannot compare in the loop.
      animations: Object.values(ANIMATIONS).map((animation) => ({
        value: animation,
        label: `FCS.Animation.${animation}`,
        selected: animation === selected,
      })),
    };
  }
}
