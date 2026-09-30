```
 _  __                                 _        
| |/ /_ __ ___  _ ____      _____ _ __| | _____ 
| ' /| '__/ _ \| '_ \ \ /\ / / _ \ '__| |/ / _ \
| . \| | | (_) | | | \ V  V /  __/ |  |   <  __/
|_|\_\_|  \___/|_| |_|\_/\_/ \___|_|  |_|\_\___|
                                                
                        w e b s i t e
```

**The page of the Kronwerke server: what Season 2 is, how to get on it, and a live sky behind it.**

![status](https://img.shields.io/badge/status-early-orange)
![licence](https://img.shields.io/badge/licence-MIT-green)
[![made by](https://img.shields.io/badge/made%20by-Elchi-black)](https://github.com/Elchi-dev)

## Overview

Static pages in German, no framework. The start page is the plan as it stands: five stages, the obelisk, how the whitelist works, what is in the pack. Behind it are the stages in detail, every mod in the pack, an install guide per launcher, the usual questions and a status page. While the season runs, the pages ask the [bot](https://github.com/kronwerke/bot) for the server state and the community goals once a minute.

The only build step is the mod list: CI checks out [kronwerke/pack](https://github.com/kronwerke/pack) and `tools/modlist.py` turns its mod files into `data/mods.json` and small icons, so the list always matches the pack of that release.

## The sky

The background is not just a picture. `js/galaxy.js` simulates a spiral galaxy in WebGL2, following the density wave model:

- Every star moves on its own ellipse around the centre, and the ellipses are rotated a little more the further out they are. Where neighbouring ellipses crowd, the stars pile up, and those piles are the spiral arms. The stars keep moving through the arms, the arms stay.
- Stars further out move slower (a flat rotation curve), so the inner galaxy turns faster than the rim.
- Where a star is on its ellipse decides whether it is in an arm right now. Young hot stars and glowing hydrogen light up there; dust darkens the inner edge of each arm.
- Star colours come from black body temperatures: old and yellow in the bulge, a mix in the disk, a few hot blue ones.
- A few distant galaxies, a star field and a hydrogen and oxygen nebula sit behind it. Everything is drawn in HDR, then bloom, a filmic tone curve and a little grain.

How it stays fast:

- The first thing on screen is a still of the same scene (`img/sky/wide.webp` and `tall.webp`, about 70 and 90 KB), loaded after the page itself. `tools/render_sky.py` renders them from `galaxy.js` with `?poster`.
- The simulation starts after the load event, when the browser is idle. The 200 000 particles are built in a worker, the shaders compile in parallel where the browser can.
- Before it shows, it draws ten frames behind the still and waits for the GPU after each. If a frame costs too much it steps down (resolution, share of the stars, bloom, a 30 fps cap) or keeps the still. While running it keeps measuring and steps down further when needed.
- Haze, dust and the nebula are soft, so they are drawn at a half to a quarter of the resolution; the nebula only every other frame.
- It never starts with `prefers-reduced-motion`, data saver, less than 4 GB memory, fewer than 4 cores or software rendering: the still is the sky there.

It pauses when the tab is hidden and has a button in the footer to stop it. `?top` looks straight down on the disk, `?sky=0` to `?sky=3` fixes a quality step, `?sky=log` prints the measurements, `?sky=try` skips the device checks.

## Design rules

The page should look like it was made for this server and nothing else.

- Type: Big Shoulders Display (condensed, industrial, fits "Werke") for headings and labels, Newsreader (a text serif) for reading. Self hosted from Fontsource, so no request goes to Google.
- Colour: warm ink instead of black, brass as the one accent, hydrogen red for the last stage and Season 1. No purple to blue gradients, no gradient text, no glass.
- Layout: left aligned with the galaxy on the right, a to scale timeline instead of cards, numbered steps instead of an icon grid, specific numbers instead of claims.

## Parts

| Part | What it does |
| --- | --- |
| `index.html` | The start page |
| `stufen.html` | The five stages: what each opens, what stays locked, the goal and why its numbers are what they are |
| `mods.html`, `js/mods.js` | Every mod, searchable, by group, with links to Modrinth and CurseForge |
| `installieren.html`, `js/install.js` | Install guide for the Modrinth App, CurseForge and Prism; the download links follow the pack version the server runs |
| `faq.html` | The usual questions |
| `overlay.html`, `js/overlay.js` | The stream overlay for OBS: the active goal as a bar or a corner card, deposits as they come in, the stage that opens in the middle of the screen. Opened in a browser it explains how to set it up, over sample data |
| `status.html`, `js/statuspage.js` | Server state, who is online, every goal with both pillars |
| `css/site.css` | All styles |
| `js/galaxy.js` | The sky |
| `js/status.js` | Server state and the current goal on the start page, from `/api/status`, answered by the bot that also serves the page |
| `js/names.js` | German names for goals, pillars and items, and the planned amounts of stages not yet open |
| `js/mascot.js` | A mob from `img/mascots/` peeks in from the lower edge with a tip for the page. Closing it keeps it away for the visit |
| `impressum.html`, `datenschutz.html`, `discord-bot.html`, `en/` | Legal pages, in German and English |
| `tools/modlist.py` | Builds `data/mods.json` and `img/mods/` from a checkout of the pack, with the Modrinth API |
| `tools/render_sky.py` | Renders the stills of the sky from `js/galaxy.js` |
| `tools/fonts.sh` | Fetches the fonts from npm into `fonts/`, pinned and checksummed |

## Quick look

```
sh tools/fonts.sh
python3 tools/modlist.py ../pack .
python3 -m http.server 8000
```

Then open http://127.0.0.1:8000. CI builds the same folder and keeps it as the `site` artifact. A tag `v*` publishes it as `site.tar.gz` in a release; the [bot](https://github.com/kronwerke/bot) picks up every new release and serves it.

## Licence

Code MIT. The fonts are under the SIL Open Font Licence, see `fonts/`.

Made by [Elchi](https://github.com/Elchi-dev)
