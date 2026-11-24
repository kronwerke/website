# Logo sizes

Builds every size of the logo from the artist's two originals. The originals are not in
this repository: put them next to the scripts as `src/logo.png` (the whole picture) and
`src/text.png` (the lettering), then run from this folder:

```
python3 crown.py src/logo.png out        # cuts the ice crown out of the picture
python3 icons.py out                     # square icon candidates
python3 web.py ../..                     # img/brand, favicon, touch icon of this site
python3 game.py /path/to/core            # server list icon and lettering textures of the Core mod
```

The menu pictures of the pack come from `tools/menus/build.py --brand` in the pack repository.
