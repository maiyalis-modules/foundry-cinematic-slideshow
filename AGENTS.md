# Maiyalis: Cinematic Slideshow — Agent guide

> This is the canonical instruction file for all coding agents. Update this
> file when shared guidance changes. `CLAUDE.md` imports it for Claude Code;
> Codex reads `AGENTS.md` directly. Do not duplicate shared instructions in
> agent-specific files.

A FoundryVTT **v14** module — package/module id **`foundry-cinematic-slideshow`**,
title "Maiyalis: Cinematic Slideshow". Written in TypeScript, compiled to
`dist/module.js` (what `module.json` loads). A GM builds a sequence of slides
(image + text + a layout + an entrance animation) and drives it live on a
full-screen stage the whole table watches.

**System-agnostic, and genuinely so** — nothing here reads system data, an actor,
or a token. Keep it that way: a system-specific feature belongs in one of the
sibling modules, not here.

## Build — read this first

**Node.js is NOT installed on the host, and Python isn't either.** The build runs
in Docker. Do not run `npm` / `node` / `tsc` / `vite` directly on the host — they
won't exist.

```
docker compose run --rm build     # one-off type-check + build (tsc --noEmit && vite build)
docker compose up watch           # rebuild dist/module.js on every save
```

- First run installs deps into a **named Docker volume**
  (`cinematic-slideshow-node-modules`), not the host — Vite ships
  platform-specific binaries that a Windows `node_modules` can't run in the Linux
  container. `package-lock.json` still persists to the host.
- The host `node_modules/` folder is an empty mount-point artifact; ignore it.
- **Never add a `restart:` policy** to `docker-compose.yml` (keep `restart: "no"`).
  These are manual, developer-invoked containers. Don't change Docker Desktop settings.
- To validate JSON without Node, use PowerShell: `Get-Content -Raw file.json | ConvertFrom-Json`.

### Hot reload

While a world runs, Foundry live-applies (no refresh): `styles/module.css`,
`templates/*.hbs`, `lang/*.json`. **JavaScript is not hot-swapped** — after `watch`
rebuilds `dist/module.js`, **press F5** in the browser.

## Layout

```
src/
  module.ts            entry point — Hooks.once("init"|"ready"), the Journal
                        sidebar button, syncStage(), and the public API at
                        game.modules.get(MODULE_ID).api
  constants.ts          MODULE_ID, MODULE_TITLE, LOG_PREFIX, SOCKET_EVENT,
                        SETTINGS, MENUS, TEMPLATES
  settings.ts           game.settings registration (preferences only — the two
                        content settings register from their own stores)
  models/
    slideshow.ts        Slideshow / Slide, plus LAYOUTS, ANIMATIONS, FITS and
                        the normalizers that make a hand-edited setting safe
    presentation.ts     the live show — see "The stage" below
  stores/
    slideshow-store.ts  the saved library (a world setting): list/get/save/remove
  services/
    presentation-service.ts  present / step / replay / end — every one a write
                        to the presentation world setting
  apps/
    config-window.ts         shared base for settings windows (delegated clicks)
    slideshow-config.ts      the settings window (preferences)
    slideshow-library-app.ts the GM way in: present / edit / duplicate / delete
    slideshow-editor-app.ts  one show: its name and its ordered slide list
    slide-editor-app.ts      one slide: image, text, layout, animation, fit
    stage-app.ts             the full-viewport stage every client watches
  types/foundry.d.ts     minimal ambient Foundry type shim
dist/module.js          build output (git-ignored)
module.json             manifest — esmodules -> dist/module.js
styles/ templates/ lang/   served from the repo root as-is
```

## Conventions

- **Module id matches the repo folder name** (`foundry-cinematic-slideshow`) —
  unlike the sibling Narrative Tools repo, where they diverged after a rename.
  Use it for the Foundry junction target and anywhere else the id is required.
- **Settings**: add a key to `SETTINGS` in `constants.ts`, then register it —
  preferences in `settings.ts`, content settings from the store that owns them
  (`SlideshowStore.register()`, `PresentationStore.register()`), all called
  during the `init` hook (settings cannot be registered later). Settings-menu
  windows (not flat controls) go in `MENUS`.
- **Templates**: add the path to `TEMPLATES` in `constants.ts` and point a part
  at it. `HandlebarsApplicationMixin` fetches and compiles a part template on
  first render, so there is no preload step to register it in. Every part must
  render **exactly one** root element.
- **Types**: there is no full Foundry type package — `src/types/foundry.d.ts` is
  a deliberately minimal shim. When you touch a new Foundry global, **add it to
  the shim** rather than reaching for `any` everywhere.
- **Localization**: every user-facing string lives in `lang/en.json` under the
  `FCS.` prefix — `game.i18n.localize("FCS.…")` in TS, `{{localize "FCS.…"}}` in
  templates. Do not hardcode display strings.
- **A layout or an animation is data, not a code path.** Both are values in
  `models/slideshow.ts` that become a CSS class on the stage (`fcs-layout--*`,
  `fcs-anim--*`). Adding one is an entry in the const object, a `FCS.Layout.*` /
  `FCS.Animation.*` string, and a rule in module.css — never a branch in
  `StageApp`.

## The stage

- **The show is state, not a message.** `Presentation` lives in the
  `presentation` **world setting**, and every client renders whatever is in it
  off the `updateSetting` hook (`syncStage()` in `module.ts`). A world setting
  reaches everyone, survives a reload, and catches up a player who joins
  mid-show — none of which a socket emit does. This is why `module.json`
  declares `"socket": false` and nothing emits: there is no player to GM traffic
  in this module at all. If that ever changes, turn `socket` on in the manifest
  *before* the first emit, or it will be silently dropped.
- **The presentation carries a snapshot of the slides**, not a reference into
  the library. A show on screen is something the table is already watching; the
  GM editing the saved copy mid-session must not reshuffle it under them. It
  also leaves the stage self-describing — it reads the library for nothing.
- **The GM controls are on the stage, not behind it.** The stage covers the
  viewport, so a separate presenter window would sit underneath it and be
  unclickable — a show with no way to advance or end is the worst failure here.
  `templates/stage.hbs` renders the control bar under `{{#if isPresenter}}`.
- **Take the stage down explicitly.** `end()` nulls the setting, and `syncStage`
  closes the app off that. Close it with `{ animate: false }`: Foundry default
  close collapses the element toward its last measured box, which for a
  `position: fixed; inset: 0` overlay with `positioned: false` reads as the
  slide visibly shrinking into a corner.
- **Animations restart by hand.** `revision` on the presentation is bumped by
  Replay *and* by every step, and `StageApp.restartAnimation()` strips the
  animation class, forces a reflow, and re-adds it. Without that, replaying does
  nothing visible and stepping back onto a slide snaps into place, because the
  browser sees an element it already animated.
- **`.fcs-stage--active` is set from `_onRender`**, and CSS hides the root
  without it. The root element is a full-viewport overlay; left visible with no
  slide it would swallow every click meant for the canvas.

## Editing model

- **The editor edits a draft copy.** `SlideshowEditorApp` clones the show in its
  constructor and mutates that; only Save writes through `SlideshowStore`. That
  is what makes Cancel mean something, and it keeps a half-built show out of a
  world setting every client is watching for changes.
- **The slide editor hands its result back through a callback**, not through
  `game.settings` — which is why it is a plain `ApplicationV2` rather than a
  `ConfigWindow` subclass. The `ConfigWindow` Save is specifically "write these
  named controls to these setting keys".
- **The library re-renders on `updateSetting`; the stage deliberately does not.**
  A second GM renaming a show should land in the open library window without
  reopening it — but must not touch a show already on screen (see the snapshot
  note above).

## Foundry gotchas

- **ApplicationV2 UI**: the built-in `actions` click dispatch has proven
  unreliable in this Foundry build. Prefer one delegated click listener attached
  in `_onRender` that reads a `data-fcs` attribute via `closest()`. Guard the
  binding with a `data-fcs-bound` flag on the root so re-renders do not stack
  listeners — and **clear that flag when the app closes** if the app can be
  re-shown (see `StageApp.close`), or the next render leaves it inert.
- **Handlebars**: no `{{else if}}` and no `eq` helper here — precompute booleans
  in `_prepareContext` (that is why every select context carries a `selected`
  flag per option) and use nested `{{#if}}`/`{{else}}`.
- **Module settings get exactly one flat category.** `SettingsConfig` extends
  `CategoryBrowser` and maps a namespace to a single category — there is no
  native sub-tab. Preferences therefore live in our own `ApplicationV2`
  (`apps/config-window.ts` is the shared base) and register `config: false`, or
  they would show up in both places.
- **World state**: only GMs can write world-scoped settings; all clients can
  read. That is the whole permission model here — `isPresenter()` gates the UI,
  and Foundry own check is the backstop.
- **Hand-edited JSON** (`lang/`): save **UTF-8 without a BOM**. The Foundry
  loader chokes on a BOM, and `Set-Content -Encoding utf8` in PowerShell adds
  one — use
  `[System.IO.File]::WriteAllText(path, text, (New-Object System.Text.UTF8Encoding($false)))`.
- **Line endings**: this repo is **LF end to end**, in the index and in the
  working tree, pinned by `.gitattributes` (`* text=auto eol=lf`). Keep it that
  way and write new files LF. `core.autocrlf` is true on this machine, which is
  how the sibling Utility Suite repo became a per-file mix of CRLF and LF —
  there, git normalizes on commit so `git diff` looks clean while the working
  tree is the damaged copy. The `.gitattributes` here is what stops that.
  Detect with
  `l=$(wc -l < f); c=$(tr -cd '\r' < f | wc -c)` — a count of 0 is LF.
  **Never use `cat -A` for this**: the Git Bash build here strips CR before
  printing and reports every file as LF.

## Dev environment

- A directory **junction** links this repo into Foundry:
  `%LOCALAPPDATA%\FoundryVTT\Data\modules\foundry-cinematic-slideshow` -> the
  repo root. Foundry serves the built `dist/module.js` and the root assets
  directly.
- **Releases are tag-driven.** `git tag v0.0.2 && git push origin v0.0.2` runs
  `.github/workflows/release.yml`, which builds, rewrites version / download /
  manifest in `module.json` from the tag, and publishes `module.json` +
  `module.zip`. The tag is the source of truth — do not hand-edit `version` in
  `module.json` or `package.json` expecting it to matter to a release.
- Sibling modules **Maiyalis: Target Helper** (`../daggerheart-target-helper`),
  **Maiyalis: Spotlight Helper** (`../daggerheart-spotlight-tracker`),
  **Maiyalis: Utility Suite** (`../foundry-utility-suite`), and **Maiyalis:
  Narrative Tools** (`../foundry-narrative-tools`) use the same Docker toolchain
  and are good references for patterns — ApplicationV2 windows, delegated-click
  dispatch, GM-authoritative world-setting sync, and full-viewport overlay apps
  are all worked out there. The Narrative Tools card stage is the closest
  relative to this module stage; read it before reworking overlay behaviour.
