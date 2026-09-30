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

- Type: one family, Schibsted Grotesk, from 400 for text to 900 for the name. Self hosted from Fontsource, so no request goes to Google. A metric matched fallback keeps the layout still while it loads.
- Colour: night indigo instead of black, and a colour for each of the five stages (moss, brass, steel blue, starlight violet, chaos red). Stage colours only ever mark stages, the pillar colours (brass for tech, teal for magic, grey for stone) only ever mark pillars. No gradients on text, no glass.
- Motion answers the visitor. Hover and press move things; nothing fades in on its own except the stage bars, which grow once when scrolled to. The five mobs of the stages have a small idle life and a habit each when hovered (the villager nods, the blaze flares, the allay zips, the enderman teleports, the wither shakes). On touch screens a tap does the same. With `prefers-reduced-motion` everything stands still.
- Mobs stand where they mean something: each stage has its mob, the install guide has one per launcher that comments on the current step, an inner page has one that fits its topic. Nothing pops up at random.
- Layout: left aligned with the galaxy on the right, a to scale timeline instead of cards, numbered steps only where something is a sequence, specific numbers instead of claims. Long pages have a rail on the left that follows the reading position.
- Before the season the page says so everywhere: the header pill shows the start, the status page shows the planned goals, the install guide ends with "ab Mitte Januar".

## Parts

| Part | What it does |
| --- | --- |
| `index.html` | The start page: the name over the galaxy, where the season stands, the idea, the five stages to scale, the steps until the start, the pack, three doors |
| `stufen.html`, `js/stufen.js` | The five stages: what each opens, what stays locked, the goal and why its numbers are what they are, a finder that says in which stage a mod gets something new |
| `herkunft.html`, `js/herkunft.js` | The nine origins and seven roles of the pack, with every power and its downside, and three questions that point at one |
| `mods.html`, `js/mods.js` | Every mod, searchable, by group and by stage, with links to Modrinth and CurseForge and five fields that show in which stages it has something to open |
| `js/modstages.js` | Which stage every mod's items belong to, built from `tools/stages` of the pack (see `tools/modstages.py`) |
| `installieren.html`, `js/install.js` | Install guide for the Modrinth App, CurseForge and Prism as a checklist that stays ticked in the browser, a mob that comments on the current step, a memory helper; the download links follow the pack version the server runs |
| `streamer.html` | What streamers get, the five events, the overlay with a live preview, what is expected, how to apply |
| `partner.html` | Where a partner fits and where not, and how to get in touch |
| `faq.html`, `js/faq.js` | The usual questions in three groups, searchable, each with its own address |
| `overlay.html`, `js/overlay.js` | The stream overlay for OBS: the active goal as a bar or a corner card, deposits as they come in, the stage that opens in the middle of the screen, all in the colour of the running stage. Opened in a browser it explains how to set it up, over sample data |
| `status.html`, `js/statuspage.js` | Server state, who is online, every goal with its pillars; before the season the planned goals |
| `css/site.css` | All styles |
| `js/site.js` | What every page shares: the header pill, copy buttons, the countdown, the rail, the pointer parallax of the still, the mobs on touch |
| `js/galaxy.js` | The sky |
| `js/status.js` | Server state and the current goal on the start page, from `/api/status`, answered by the bot that also serves the page |
| `js/names.js` | German names for goals, pillars and items, the planned amounts, and the number format |
| `impressum.html`, `datenschutz.html`, `discord-bot.html`, `en/` | Legal pages, in German and English |
| `tools/modlist.py` | Builds `data/mods.json` and `img/mods/` from a checkout of the pack, with the Modrinth API |
| `tools/modstages.py` | Builds `js/modstages.js` from the pack's stage files and the mod jars of a server |
| `tools/render_sky.py` | Renders the stills of the sky from `js/galaxy.js` |
| `tools/fonts.sh` | Fetches the font from npm into `fonts/`, pinned and checksummed |

## Quick look

```
sh tools/fonts.sh
python3 tools/modlist.py ../pack .
python3 -m http.server 8000
```

Then open http://127.0.0.1:8000. CI builds the same folder and keeps it as the `site` artifact. A tag `v*` publishes it as `site.tar.gz` in a release; the [bot](https://github.com/kronwerke/bot) picks up every new release and serves it.

## Licence

Code MIT. The font is under the SIL Open Font Licence, see `fonts/`. The item icons on the origins page are drawn from the textures of the mods they stand for.

Made by [Elchi](https://github.com/Elchi-dev)
