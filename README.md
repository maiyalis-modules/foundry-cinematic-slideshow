# Maiyalis: Cinematic Slideshow

GM-controlled cinematic slideshows for Foundry VTT v14. Build a sequence of
slides out of an image and some text, pick a layout and an entrance animation,
then drive it live while the whole table watches it full-screen.

System-agnostic — it touches no system data at all.

## Features

- **Build slideshows** — each slide is an image, an optional title, and body
  text, with a layout (text over image, side by side, image only, text only) and
  an entrance animation (fade, slide, zoom, Ken Burns drift).
- **Present to the table** — one full-screen stage on every connected client,
  driven by the GM.
- **GM controls, on the stage** — Back / Replay / Next / End, plus keyboard
  shortcuts: arrow keys or Space to move, `R` to replay the animation, `Esc` to
  end the show.
- **Save, edit, duplicate, delete** — the library lives in the world, so
  slideshows survive between sessions and follow the world, not the client.

Players never see a control: they see the slide.

## Usage

The **Slideshows** button at the top of the Journal sidebar (GM only) opens the
library. Preferences live under *Settings → Configure Settings → Cinematic
Slideshow*.

A small API is exposed for macros:

```js
const api = game.modules.get("foundry-cinematic-slideshow").api;
api.open();                       // the library window
api.present("The Siege");         // by name or by id
api.next(); api.previous();       // move
api.replay();                     // re-run the current slide's animation
api.end();                        // take the stage down
```

## Installation

**From manifest URL**

```
https://github.com/maiyalis-modules/foundry-cinematic-slideshow/releases/latest/download/module.json
```

**For local development**

Link this repo into your Foundry user data directory so the folder name matches
the module id. A **directory junction** works without elevation on Windows and
keeps the repo in place:

```powershell
New-Item -ItemType Junction `
  -Path "$env:LOCALAPPDATA\FoundryVTT\Data\modules\foundry-cinematic-slideshow" `
  -Target "d:\Foundry\foundry-cinematic-slideshow"
```

## Building

The module is written in **TypeScript** and compiled to `dist/module.js` (what
`module.json` loads). Node.js is not required on the host — the build runs in a
container:

```
docker compose run --rm build   # one-off type-check + build
docker compose up watch         # rebuild dist/module.js on every save
```

The first run installs dependencies into a named Docker volume (`node_modules`
can't be shared with the host because Vite ships platform-specific binaries).

### Hot reload

While a world is running, Foundry live-applies changes with **no page refresh** to:

- `styles/module.css`
- `templates/*.hbs`
- `lang/en.json`

**JavaScript is not hot-swapped.** After `watch` rebuilds `dist/module.js` from a
TypeScript change, **refresh the browser (F5)** to load it.

## Releasing

The tag is the source of truth for the version. Pushing a `v*` tag builds the
module, rewrites `version` / `download` / `manifest` in `module.json` from the
tag, and publishes `module.json` + `module.zip` as a GitHub release:

```
git tag v0.0.2 && git push origin v0.0.2
```

## Layout

```
foundry-cinematic-slideshow/
  module.json            # manifest (esmodules -> dist/module.js)
  src/                   # TypeScript source (compiled by Vite)
    module.ts            #   entry point (init / ready hooks, sidebar button, API)
    constants.ts         #   ids, settings keys, template paths
    settings.ts          #   game.settings registration
    models/              #   slideshow + presentation data shapes
    stores/              #   the saved slideshow library (a world setting)
    services/            #   driving the live show
    apps/                #   library, editors, settings window, the stage
    types/foundry.d.ts   #   minimal ambient Foundry type shim
  dist/module.js         # build output (git-ignored)
  styles/module.css      # stylesheet
  templates/             # Handlebars templates
  lang/en.json           # localization strings
  docker-compose.yml     # containerized build toolchain
```

## Localization

All user-facing strings live in [lang/en.json](lang/en.json) under the `FCS.`
prefix. Reference them with `game.i18n.localize()` in scripts or `{{localize}}`
in templates.
