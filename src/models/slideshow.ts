/**
 * The saved content: a slideshow is a name and an ordered list of slides, and a
 * slide is an image, some text, and two presentation choices (how it is laid
 * out, how it arrives).
 *
 * Deliberately plain data — a slideshow is JSON in a world setting, never a
 * class. Everything that renders one (`apps/stage-app.ts`) reads these fields
 * and nothing else, so a new layout or animation is a value here plus a CSS
 * rule, not a code path.
 */

/** How the image and text share a slide. */
export const LAYOUTS = {
  /** Image fills the stage; no text. */
  imageOnly: "imageOnly",
  /** Text alone, centred — a title card or an epigraph. */
  textOnly: "textOnly",
  /** Image fills the stage, text floats over it in a translucent band. */
  overlay: "overlay",
  /** Image on the left half, text on the right. */
  imageLeft: "imageLeft",
  /** Image on the right half, text on the left. */
  imageRight: "imageRight",
  /** Image on top, text beneath it. */
  imageTop: "imageTop",
} as const;

export type Layout = (typeof LAYOUTS)[keyof typeof LAYOUTS];

/** How a slide arrives when it becomes the current one. */
export const ANIMATIONS = {
  none: "none",
  fade: "fade",
  slideLeft: "slideLeft",
  slideUp: "slideUp",
  zoom: "zoom",
  /** A slow drift-and-scale across the image for as long as the slide is up. */
  kenBurns: "kenBurns",
} as const;

export type Animation = (typeof ANIMATIONS)[keyof typeof ANIMATIONS];

/** How the image fills its box. `cover` crops, `contain` letterboxes. */
export const FITS = {
  cover: "cover",
  contain: "contain",
} as const;

export type Fit = (typeof FITS)[keyof typeof FITS];

export interface Slide {
  id: string;
  /** Path to the image, as the file picker returns it. May be empty (text-only). */
  image: string;
  /** Optional heading, shown above the body text. */
  title: string;
  /** Body text. Newlines are preserved; HTML is escaped, never rendered. */
  text: string;
  layout: Layout;
  animation: Animation;
  fit: Fit;
}

export interface Slideshow {
  id: string;
  name: string;
  slides: Slide[];
  /** Epoch ms of the last save — the library lists most-recently-edited first. */
  updatedAt: number;
}

/** A blank slide, ready for the editor. */
export function emptySlide(animation: Animation = ANIMATIONS.fade): Slide {
  return {
    id: foundry.utils.randomID(),
    image: "",
    title: "",
    text: "",
    layout: LAYOUTS.overlay,
    animation,
    fit: FITS.cover,
  };
}

/** A blank slideshow with one blank slide, ready for the editor. */
export function emptySlideshow(name: string, animation?: Animation): Slideshow {
  return {
    id: foundry.utils.randomID(),
    name,
    slides: [emptySlide(animation)],
    updatedAt: Date.now(),
  };
}

/**
 * Coerce whatever came out of the world setting into a `Slideshow`.
 *
 * The setting is `Array`-typed and hand-editable, and a show saved by an older
 * build can be missing fields a newer one reads. Filling defaults here means
 * every consumer can treat the shape as guaranteed.
 */
export function normalizeSlideshow(raw: AnyObject): Slideshow {
  const slides = Array.isArray(raw["slides"]) ? (raw["slides"] as AnyObject[]) : [];
  return {
    id: typeof raw["id"] === "string" ? raw["id"] : foundry.utils.randomID(),
    name: typeof raw["name"] === "string" ? raw["name"] : "",
    slides: slides.map((slide) => normalizeSlide(slide)),
    updatedAt: typeof raw["updatedAt"] === "number" ? raw["updatedAt"] : 0,
  };
}

function normalizeSlide(raw: AnyObject): Slide {
  const layouts = Object.values(LAYOUTS) as string[];
  const animations = Object.values(ANIMATIONS) as string[];
  const fits = Object.values(FITS) as string[];
  return {
    id: typeof raw["id"] === "string" ? raw["id"] : foundry.utils.randomID(),
    image: typeof raw["image"] === "string" ? raw["image"] : "",
    title: typeof raw["title"] === "string" ? raw["title"] : "",
    text: typeof raw["text"] === "string" ? raw["text"] : "",
    layout: layouts.includes(raw["layout"]) ? (raw["layout"] as Layout) : LAYOUTS.overlay,
    animation: animations.includes(raw["animation"])
      ? (raw["animation"] as Animation)
      : ANIMATIONS.fade,
    fit: fits.includes(raw["fit"]) ? (raw["fit"] as Fit) : FITS.cover,
  };
}
