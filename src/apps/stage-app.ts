/**
 * The stage: the full-viewport surface every client watches a show on.
 *
 * One app, both audiences. Players get the slide; the GM gets the slide plus a
 * control bar. **The GM's controls are on the stage, not behind it** — the stage
 * covers the viewport, so a separate presenter window would sit underneath it
 * and be unclickable, stranding a show with no way to advance or end it. The
 * sibling Narrative Tools module learned that the hard way with its card stage.
 *
 * Frameless and full-viewport: `window.frame` and `window.positioned` are both
 * off so Foundry never applies its own left/top/width/height, leaving the
 * `position: fixed; inset: 0` rule in module.css in full control.
 *
 * What is *not* here: any decision about whether to be on screen. `module.ts`
 * (`syncStage`) owns that, driven by the `presentation` world setting — this
 * class renders whatever it is handed.
 */
import { MODULE_ID, TEMPLATES } from "../constants.js";
import { ANIMATIONS } from "../models/slideshow.js";
import { current, currentSlide, end, isPresenter, replay, step } from "../services/presentation-service.js";

const { ApplicationV2, HandlebarsApplicationMixin } = foundry.applications.api;

export class StageApp extends HandlebarsApplicationMixin(ApplicationV2) {
  /** Bound once and kept, so the same reference can be removed on close. */
  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (!isPresenter() || !this.rendered) return;
    // Never steal a keystroke from a text field — the GM may be typing in chat
    // with the stage up.
    const target = event.target as HTMLElement | null;
    if (target?.closest?.("input, textarea, select, [contenteditable='true']")) return;

    switch (event.key) {
      case "ArrowRight":
      case "PageDown":
      case " ":
        event.preventDefault();
        void step(1);
        return;
      case "ArrowLeft":
      case "PageUp":
        event.preventDefault();
        void step(-1);
        return;
      case "r":
      case "R":
        event.preventDefault();
        void replay();
        return;
      case "Escape":
        event.preventDefault();
        void end();
        return;
    }
  };

  static DEFAULT_OPTIONS: AnyObject = {
    id: `${MODULE_ID}-stage`,
    tag: "section",
    classes: [MODULE_ID, "fcs-stage"],
    window: {
      frame: false,
      positioned: false,
      title: "FCS.Stage.Title",
    },
    position: {
      width: "auto",
      height: "auto",
    },
  };

  static PARTS = {
    main: { template: TEMPLATES.stage },
  };

  async _prepareContext(options: AnyObject): Promise<AnyObject> {
    const context = (await super._prepareContext?.(options)) ?? {};
    const show = current();
    const slide = currentSlide(show);
    if (!show || !slide) return { ...context, active: false };

    const index = Math.max(0, Math.min(show.index, show.slides.length - 1));
    return {
      ...context,
      active: true,
      name: show.name,
      image: slide.image,
      title: slide.title,
      // Split rather than passed whole: blank lines are how a GM writes a break
      // in slide text, and a single `{{text}}` would collapse them all. Each
      // paragraph goes through Handlebars' own escaping, so slide text stays
      // text — there is no innerHTML path into the stage.
      paragraphs: slide.text.split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean),
      hasText: Boolean(slide.title) || slide.text.trim().length > 0,
      layoutClass: `fcs-layout--${slide.layout}`,
      fitClass: `fcs-fit--${slide.fit}`,
      animationClass:
        slide.animation === ANIMATIONS.none ? "" : `fcs-anim--${slide.animation}`,
      isPresenter: isPresenter(),
      counter: game.i18n.format("FCS.Stage.Counter", {
        current: index + 1,
        total: show.slides.length,
      }),
      atStart: index === 0,
      atEnd: index === show.slides.length - 1,
    };
  }

  _onRender(context: AnyObject, options: AnyObject): void {
    super._onRender?.(context, options);
    const root = this.element as HTMLElement | undefined;
    if (!root) return;

    // The root element is a full-viewport overlay, so it must not sit over the
    // canvas swallowing clicks during the beat between a show ending and
    // `syncStage` closing this app. CSS hides it unless this class is present.
    root.classList.toggle("fcs-stage--active", context["active"] === true);

    this.restartAnimation(root);

    if (root.dataset["fcsBound"]) return;
    root.dataset["fcsBound"] = "1";

    document.addEventListener("keydown", this.onKeyDown);

    root.addEventListener("click", (event: Event) => {
      const el = (event.target as HTMLElement | null)?.closest?.("[data-fcs]") as HTMLElement | null;
      if (!el || !root.contains(el)) return;
      switch (el.dataset["fcs"]) {
        case "next":
          void step(1);
          return;
        case "previous":
          void step(-1);
          return;
        case "replay":
          void replay();
          return;
        case "end":
          void end();
          return;
      }
    });
  }

  /**
   * Re-run the entrance animation on this render.
   *
   * ApplicationV2 replaces a part's content in place, and a CSS animation on an
   * element the browser considers unchanged does not restart on its own — which
   * is what Replay asks for, and what stepping *back* onto an already-seen slide
   * needs too. Removing the class, forcing a reflow, and re-adding it is the
   * standard way to make the browser treat it as new.
   */
  private restartAnimation(root: HTMLElement): void {
    const slide = root.querySelector<HTMLElement>(".fcs-stage__slide");
    const animated = slide?.dataset["animation"];
    if (!slide || !animated) return;
    slide.classList.remove(animated);
    // Reading a layout property is what actually flushes the removal.
    void slide.offsetWidth;
    slide.classList.add(animated);
  }

  async close(options: AnyObject = {}): Promise<unknown> {
    document.removeEventListener("keydown", this.onKeyDown);
    const root = this.element as HTMLElement | undefined;
    // The listeners above are re-bound on the next render, and `_onRender`
    // gates on this flag — clear it or a re-shown stage is inert.
    if (root) delete root.dataset["fcsBound"];
    return super.close(options);
  }
}
