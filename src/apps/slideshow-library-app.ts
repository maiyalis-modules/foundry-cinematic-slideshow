/**
 * The slideshow library — the GM's way in. Lists every saved show with the four
 * things you do to one: Present, Edit, Duplicate, Delete.
 *
 * Opens from the Journal-sidebar button (and the module API), not from
 * Configure Settings: this is the tool you reach for every session, and burying
 * it behind the settings page would put it three clicks away from the table.
 */
import { MODULE_ID, SETTINGS, TEMPLATES } from "../constants.js";
import { emptySlideshow, type Animation, type Slideshow } from "../models/slideshow.js";
import { present } from "../services/presentation-service.js";
import { SlideshowStore } from "../stores/slideshow-store.js";
import { SlideshowEditorApp } from "./slideshow-editor-app.js";

const { ApplicationV2, DialogV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SlideshowLibraryApp extends HandlebarsApplicationMixin(ApplicationV2) {
  static DEFAULT_OPTIONS: AnyObject = {
    id: `${MODULE_ID}-library`,
    tag: "form",
    classes: [MODULE_ID, "fcs-config", "standard-form"],
    window: {
      title: "FCS.Library.Title",
      icon: "fa-solid fa-photo-film",
      resizable: true,
    },
    position: {
      width: 560,
      height: 520,
    },
  };

  static PARTS = {
    main: { template: TEMPLATES.library },
  };

  async _prepareContext(options: AnyObject): Promise<AnyObject> {
    const context = (await super._prepareContext?.(options)) ?? {};
    const shows = SlideshowStore.list();
    return {
      ...context,
      shows: shows.map((show) => ({
        id: show.id,
        name: show.name,
        count: game.i18n.format("FCS.Library.SlideCount", { count: show.slides.length }),
        // The first slide with an image stands in for the whole show — a
        // text-only opener is common and would otherwise leave a blank tile.
        thumbnail: show.slides.find((slide) => slide.image)?.image ?? "",
      })),
      empty: shows.length === 0,
    };
  }

  _onRender(context: AnyObject, options: AnyObject): void {
    super._onRender?.(context, options);
    const root = this.element as HTMLElement | undefined;
    if (!root || root.dataset["fcsBound"]) return;
    root.dataset["fcsBound"] = "1";

    root.addEventListener("submit", (event: Event) => event.preventDefault());

    root.addEventListener("click", (event: Event) => {
      const el = (event.target as HTMLElement | null)?.closest?.("[data-fcs]") as HTMLElement | null;
      if (!el || !root.contains(el)) return;
      const action = el.dataset["fcs"] ?? "";
      const id = el.dataset["showId"] ?? "";
      switch (action) {
        case "new":
          this.createShow();
          return;
        case "edit":
          this.editShow(id);
          return;
        case "duplicate":
          void this.duplicateShow(id);
          return;
        case "delete":
          void this.deleteShow(id);
          return;
        case "present":
          void this.presentShow(id);
          return;
      }
    });
  }

  private defaultAnimation(): Animation {
    return game.settings.get(MODULE_ID, SETTINGS.defaultAnimation) as Animation;
  }

  private openEditor(show: Slideshow): void {
    new SlideshowEditorApp(show, () => void this.render()).render(true);
  }

  private createShow(): void {
    // Not saved yet — an abandoned editor should leave no trace in the library.
    this.openEditor(
      emptySlideshow(game.i18n.localize("FCS.Library.NewName"), this.defaultAnimation()),
    );
  }

  private editShow(id: string): void {
    const show = SlideshowStore.get(id);
    if (!show) return;
    this.openEditor(show);
  }

  private async duplicateShow(id: string): Promise<void> {
    const show = SlideshowStore.get(id);
    if (!show) return;
    // New ids all the way down: two shows sharing a slide id would confuse the
    // editor's find-by-id, and a copy is a separate thing from its original.
    await SlideshowStore.save({
      ...show,
      id: foundry.utils.randomID(),
      name: game.i18n.format("FCS.Library.CopyName", { name: show.name }),
      slides: show.slides.map((slide) => ({ ...slide, id: foundry.utils.randomID() })),
    });
    void this.render();
  }

  private async deleteShow(id: string): Promise<void> {
    const show = SlideshowStore.get(id);
    if (!show) return;
    const confirmed = await DialogV2.confirm({
      window: { title: game.i18n.localize("FCS.Library.DeleteTitle") },
      content: `<p>${game.i18n.format("FCS.Library.DeleteConfirm", { name: show.name })}</p>`,
      modal: true,
    });
    if (!confirmed) return;
    await SlideshowStore.remove(id);
    void this.render();
  }

  private async presentShow(id: string): Promise<void> {
    const show = SlideshowStore.get(id);
    if (!show) return;
    await present(show);
    // Out of the way: the stage covers the viewport, and the GM's controls are
    // on it (see `StageApp`), so leaving this window open only hides it behind.
    await this.close();
  }
}
