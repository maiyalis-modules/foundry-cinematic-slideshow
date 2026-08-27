/**
 * The per-slide editor: one popup for one slide's image, text, layout and
 * animation. Opened from a row in `SlideshowEditorApp` — keeping a slide's
 * fields in their own dialog is what lets the parent list stay a compact,
 * reorderable strip of thumbnails.
 *
 * Not a `ConfigWindow` subclass: that base's Save writes to `game.settings`,
 * which does not fit an editor whose result belongs to its caller. This hands
 * the edited slide back through a plain constructor callback instead, the same
 * way the sibling module's option editor does.
 */
import { MODULE_ID, TEMPLATES } from "../constants.js";
import { ANIMATIONS, FITS, LAYOUTS, type Animation, type Fit, type Layout, type Slide } from "../models/slideshow.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

/** `<file-picker>` is a custom form-associated element, not a plain `<input>`. */
interface FilePickerElement extends HTMLElement {
  value: string;
}

/**
 * What the caller is handed back.
 *
 * `addAnother` is Save & Add: the slide is finished, and the GM wants a blank
 * one straight after it. Deciding what "another slide" means belongs to the
 * parent, which owns the list — this window only reports which button was
 * pressed.
 */
export type SlideSubmit = (slide: Slide, addAnother: boolean) => void;

export class SlideEditorApp extends HandlebarsApplicationMixin(ApplicationV2) {
  private readonly slide: Slide;
  private readonly isNew: boolean;
  private readonly onSubmit: SlideSubmit;
  private readonly position: string;

  // No `id` here: it is set per instance in the constructor. Save & Add closes
  // this window and opens the next one immediately, and two ApplicationV2s
  // sharing an id while one is still tearing down is a race worth not having.
  static DEFAULT_OPTIONS: AnyObject = {
    tag: "form",
    classes: [MODULE_ID, "fcs-config", "standard-form"],
    window: {
      title: "FCS.SlideEditor.Title",
      icon: "fa-solid fa-image",
      resizable: true,
    },
    position: {
      width: 520,
      height: "auto",
    },
  };

  static PARTS = {
    main: { template: TEMPLATES.slideEditor },
    footer: { template: TEMPLATES.configFooter },
  };

  /**
   * `isNew` drives Save & Add — it is only offered while adding, because
   * "save this and start another" is meaningless when you opened an existing
   * slide to fix a typo in it.
   *
   * `position` is the human slide number, for the window's subtitle line.
   */
  constructor(
    slide: Slide,
    isNew: boolean,
    position: string,
    onSubmit: SlideSubmit,
    options: AnyObject = {},
  ) {
    super({ id: `${MODULE_ID}-slide-editor-${slide.id}`, ...options });
    this.slide = slide;
    this.isNew = isNew;
    this.position = position;
    this.onSubmit = onSubmit;
  }

  async _prepareContext(options: AnyObject): Promise<AnyObject> {
    const context = (await super._prepareContext?.(options)) ?? {};
    return {
      ...context,
      ...this.slide,
      position: this.position,
      // Read by the shared config footer, which renders Save & Add only when a
      // window asks for it. The context prepared here reaches every part.
      canSaveAndAdd: this.isNew,
      // `selected` precomputed per option — Handlebars here has no `eq` helper.
      layouts: Object.values(LAYOUTS).map((layout) => ({
        value: layout,
        label: `FCS.Layout.${layout}`,
        selected: layout === this.slide.layout,
      })),
      animations: Object.values(ANIMATIONS).map((animation) => ({
        value: animation,
        label: `FCS.Animation.${animation}`,
        selected: animation === this.slide.animation,
      })),
      fits: Object.values(FITS).map((fit) => ({
        value: fit,
        label: `FCS.Fit.${fit}`,
        selected: fit === this.slide.fit,
      })),
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
      switch (el.dataset["fcs"]) {
        case "save":
          void this.onSave(false);
          return;
        case "save-and-add":
          void this.onSave(true);
          return;
        case "cancel":
          void this.close();
          return;
      }
    });
  }

  /**
   * Read the controls back and hand the slide to the caller.
   *
   * The window closes either way, including on Save & Add: the parent responds
   * by opening a fresh editor, so a GM adding six slides in a row gets six
   * windows in sequence rather than one that quietly changes what it is
   * pointing at.
   */
  private async onSave(addAnother: boolean): Promise<void> {
    const root = this.element as HTMLElement | undefined;
    if (!root) return;

    const value = (selector: string): string =>
      root.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector)
        ?.value ?? "";

    const edited: Slide = {
      ...this.slide,
      image: root.querySelector<FilePickerElement>("file-picker[name='image']")?.value ?? "",
      title: value("input[name='title']"),
      text: value("textarea[name='text']"),
      layout: value("select[name='layout']") as Layout,
      animation: value("select[name='animation']") as Animation,
      fit: value("select[name='fit']") as Fit,
    };

    // Close first: the callback may open the next editor, and this one should be
    // gone by then rather than fighting it for the same screen position.
    await this.close();
    this.onSubmit(edited, addAnother);
  }
}
