/**
 * The slideshow editor: a name and an ordered list of slides.
 *
 * Edits a **draft copy**, not the stored slideshow. Every add / remove / move /
 * per-slide edit mutates the draft and re-renders; only Save writes it back
 * through `SlideshowStore`. That is what makes Cancel mean something, and it
 * keeps a half-built show out of a world setting that every client is watching
 * for changes.
 */
import { MODULE_ID, SETTINGS, TEMPLATES } from "../constants.js";
import { emptySlide, type Animation, type Slideshow } from "../models/slideshow.js";
import { SlideshowStore } from "../stores/slideshow-store.js";
import { SlideEditorApp } from "./slide-editor-app.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class SlideshowEditorApp extends HandlebarsApplicationMixin(ApplicationV2) {
  private draft: Slideshow;
  private readonly onSaved: () => void;

  static DEFAULT_OPTIONS: AnyObject = {
    id: `${MODULE_ID}-slideshow-editor`,
    tag: "form",
    classes: [MODULE_ID, "fcs-config", "standard-form"],
    window: {
      title: "FCS.Editor.Title",
      icon: "fa-solid fa-photo-film",
      resizable: true,
    },
    position: {
      width: 620,
      height: 640,
    },
  };

  static PARTS = {
    main: { template: TEMPLATES.slideshowEditor },
    footer: { template: TEMPLATES.configFooter },
  };

  constructor(show: Slideshow, onSaved: () => void, options: AnyObject = {}) {
    super(options);
    // Deep-ish copy: the slide objects are replaced wholesale by the slide
    // editor, so copying the array and each slide is enough to keep the stored
    // show untouched until Save.
    this.draft = { ...show, slides: show.slides.map((slide) => ({ ...slide })) };
    this.onSaved = onSaved;
  }

  async _prepareContext(options: AnyObject): Promise<AnyObject> {
    const context = (await super._prepareContext?.(options)) ?? {};
    const last = this.draft.slides.length - 1;
    return {
      ...context,
      name: this.draft.name,
      slides: this.draft.slides.map((slide, index) => ({
        ...slide,
        number: index + 1,
        // Precomputed rather than compared in the template — no `eq` helper here.
        isFirst: index === 0,
        isLast: index === last,
        layoutLabel: `FCS.Layout.${slide.layout}`,
        animationLabel: `FCS.Animation.${slide.animation}`,
        summary: slide.title || slide.text.split("\n")[0] || "",
      })),
      empty: this.draft.slides.length === 0,
    };
  }

  _onRender(context: AnyObject, options: AnyObject): void {
    super._onRender?.(context, options);
    const root = this.element as HTMLElement | undefined;
    if (!root) return;

    // The name input is re-created by every render, so its value has to be
    // captured as it is typed rather than read at Save time.
    const nameInput = root.querySelector<HTMLInputElement>("input[name='name']");
    if (nameInput && !nameInput.dataset["fcsBound"]) {
      nameInput.dataset["fcsBound"] = "1";
      nameInput.addEventListener("input", () => {
        this.draft.name = nameInput.value;
      });
    }

    if (root.dataset["fcsBound"]) return;
    root.dataset["fcsBound"] = "1";

    root.addEventListener("submit", (event: Event) => event.preventDefault());

    root.addEventListener("click", (event: Event) => {
      const el = (event.target as HTMLElement | null)?.closest?.("[data-fcs]") as HTMLElement | null;
      if (!el || !root.contains(el)) return;
      const action = el.dataset["fcs"] ?? "";
      const id = el.dataset["slideId"] ?? "";
      switch (action) {
        case "save":
          void this.onSave();
          return;
        case "cancel":
          void this.close();
          return;
        case "add-slide":
          this.addSlide();
          return;
        case "edit-slide":
          this.editSlide(id);
          return;
        case "remove-slide":
          this.removeSlide(id);
          return;
        case "move-up":
          this.moveSlide(id, -1);
          return;
        case "move-down":
          this.moveSlide(id, 1);
          return;
      }
    });
  }

  private defaultAnimation(): Animation {
    return game.settings.get(MODULE_ID, SETTINGS.defaultAnimation) as Animation;
  }

  /**
   * Open a blank slide in its own editor.
   *
   * The slide is **not** put into the draft here — it is appended by the submit
   * callback below, so cancelling out of a new slide leaves no empty row behind.
   * Save & Add calls straight back into this method, which is the whole of the
   * "keep going" behaviour: the finished slide has already landed in the list.
   */
  private addSlide(): void {
    const total = this.draft.slides.length + 1;
    new SlideEditorApp(
      emptySlide(this.defaultAnimation()),
      true,
      game.i18n.format("FCS.Editor.SlideNumber", { number: total, total }),
      (edited, addAnother) => {
        this.draft.slides.push(edited);
        void this.render();
        if (addAnother) this.addSlide();
      },
    ).render(true);
  }

  private editSlide(id: string): void {
    const index = this.draft.slides.findIndex((slide) => slide.id === id);
    const slide = this.draft.slides[index];
    if (!slide) return;
    new SlideEditorApp(
      slide,
      false,
      game.i18n.format("FCS.Editor.SlideNumber", {
        number: index + 1,
        total: this.draft.slides.length,
      }),
      (edited) => {
        this.draft.slides[index] = edited;
        void this.render();
      },
    ).render(true);
  }

  private removeSlide(id: string): void {
    this.draft.slides = this.draft.slides.filter((slide) => slide.id !== id);
    void this.render();
  }

  private moveSlide(id: string, delta: number): void {
    const from = this.draft.slides.findIndex((slide) => slide.id === id);
    const to = from + delta;
    const slide = this.draft.slides[from];
    if (!slide || to < 0 || to >= this.draft.slides.length) return;
    this.draft.slides.splice(from, 1);
    this.draft.slides.splice(to, 0, slide);
    void this.render();
  }

  private async onSave(): Promise<void> {
    const name = this.draft.name.trim();
    if (!name) {
      ui.notifications?.warn(game.i18n.localize("FCS.Notify.NameRequired"));
      return;
    }
    await SlideshowStore.save({ ...this.draft, name });
    this.onSaved();
    await this.close();
  }
}
