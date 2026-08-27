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

export class SlideEditorApp extends HandlebarsApplicationMixin(ApplicationV2) {
  private readonly slide: Slide;
  private readonly onSubmit: (slide: Slide) => void;
  private readonly position: string;

  static DEFAULT_OPTIONS: AnyObject = {
    id: `${MODULE_ID}-slide-editor`,
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

  /** `position` is the human slide number, for the window's subtitle line. */
  constructor(
    slide: Slide,
    position: string,
    onSubmit: (slide: Slide) => void,
    options: AnyObject = {},
  ) {
    super(options);
    this.slide = slide;
    this.position = position;
    this.onSubmit = onSubmit;
  }

  async _prepareContext(options: AnyObject): Promise<AnyObject> {
    const context = (await super._prepareContext?.(options)) ?? {};
    return {
      ...context,
      ...this.slide,
      position: this.position,
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
      if (el.dataset["fcs"] === "save") void this.onSave();
      else if (el.dataset["fcs"] === "cancel") void this.close();
    });
  }

  private async onSave(): Promise<void> {
    const root = this.element as HTMLElement | undefined;
    if (!root) return;

    const value = (selector: string): string =>
      root.querySelector<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>(selector)
        ?.value ?? "";

    this.onSubmit({
      ...this.slide,
      image: root.querySelector<FilePickerElement>("file-picker[name='image']")?.value ?? "",
      title: value("input[name='title']"),
      text: value("textarea[name='text']"),
      layout: value("select[name='layout']") as Layout,
      animation: value("select[name='animation']") as Animation,
      fit: value("select[name='fit']") as Fit,
    });
    await this.close();
  }
}
