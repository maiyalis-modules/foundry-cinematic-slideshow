/**
 * The live show: what every client is looking at right now.
 *
 * **This is state, not a message.** It lives in a world setting rather than
 * travelling over the socket because a slideshow is watched by the whole table:
 * a world setting reaches everyone, survives a reload, and catches up a player
 * who joins in the middle — none of which a targeted emit does. The same reason
 * the sibling Narrative Tools module keeps its card step on the session
 * document instead of emitting it.
 *
 * It also carries a **snapshot** of the slides rather than a reference into the
 * library. A show on screen is a thing the table is already watching; the GM
 * editing the saved copy mid-session must not reshuffle it under them, and the
 * stage stays self-describing — it needs the library for nothing.
 */
import type { Slide } from "./slideshow.js";

export interface Presentation {
  /** The saved slideshow this came from. Only used to label the stage. */
  slideshowId: string;
  name: string;
  /** Frozen at the moment Present was pressed — see the note above. */
  slides: Slide[];
  /** Index into the slides of the one on screen. */
  index: number;
  /**
   * Bumped by Replay, and by every move between slides.
   *
   * The stage keys its animation on index and revision together, so replaying
   * re-runs the entrance without changing which slide is up — and stepping back
   * to a slide the client has already shown animates again rather than snapping
   * into place because the DOM node happened to be reused.
   */
  revision: number;
}
