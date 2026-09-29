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

One static page in German, two legal pages, no framework and no build step. The text is the plan as it stands: five stages, the obelisk, how the whitelist works, what is in the pack. While the season runs, the page asks the [bot](https://github.com/kronwerke/bot) for the server state and the current community goal once a minute.

## The sky

The background is not a picture. `js/galaxy.js` simulates a spiral galaxy in WebGL2, following the density wave model:

- Every star moves on its own ellipse around the centre, and the ellipses are rotated a little more the further out they are. Where neighbouring ellipses crowd, the stars pile up, and those piles are the spiral arms. The stars keep moving through the arms, the arms stay.
- Stars further out move slower (a flat rotation curve), so the inner galaxy turns faster than the rim.
- Where a star is on its ellipse decides whether it is in an arm right now. Young hot stars and glowing hydrogen light up there; dust darkens the inner edge of each arm.
- Star colours come from black body temperatures: old and yellow in the bulge, a mix in the disk, a few hot blue ones.
- A few distant galaxies, a star field and a hydrogen and oxygen nebula sit behind it. Everything is drawn in HDR, then bloom, a filmic tone curve and a little grain.

It pauses when the tab is hidden, stands still with `prefers-reduced-motion`, and has a button in the footer to stop it. Without WebGL2 the page keeps a plain dark background. `?top` looks straight down on the disk.

## Design rules

The page should look like it was made for this server and nothing else.

- Type: Big Shoulders Display (condensed, industrial, fits "Werke") for headings and labels, Newsreader (a text serif) for reading. Self hosted from Fontsource, so no request goes to Google.
- Colour: warm ink instead of black, brass as the one accent, hydrogen red for the last stage and Season 1. No purple to blue gradients, no gradient text, no glass.
- Layout: left aligned with the galaxy on the right, a to scale timeline instead of cards, numbered steps instead of an icon grid, specific numbers instead of claims.

## Parts

| Part | What it does |
| --- | --- |
| `index.html` | The page |
| `css/site.css` | All styles |
| `js/galaxy.js` | The sky |
| `js/status.js` | Server state and the current goal from `api.kronwerke.com/api/status` |
| `impressum.html`, `datenschutz.html` | Legal pages; the bracketed parts are to be filled in before the site goes live |
| `tools/fonts.sh` | Fetches the fonts from npm into `fonts/`, pinned and checksummed |

## Quick look

```
sh tools/fonts.sh
python3 -m http.server 8000
```

Then open http://127.0.0.1:8000. CI builds the same folder and keeps it as the `site` artifact.

## Licence

Code MIT. The fonts are under the SIL Open Font Licence, see `fonts/`.

Made by [Elchi](https://github.com/Elchi-dev)
