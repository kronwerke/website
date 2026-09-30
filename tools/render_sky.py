#!/usr/bin/env python3
"""Renders the stills of the sky (img/sky/wide.webp and tall.webp) from js/galaxy.js.

    python3 -m http.server 8777 &      (in the repository root)
    python3 tools/render_sky.py

Needs Playwright with Chromium and Pillow. Run it again whenever galaxy.js changes how
the scene looks, so the still and the live sky match when one fades into the other.
"""
import asyncio
import os

from PIL import Image
from playwright.async_api import async_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
URL = os.environ.get("SKY_URL", "http://127.0.0.1:8777/index.html?poster")
SIZES = {"wide": (1920, 1080), "tall": (1080, 1920)}


async def main():
    async with async_playwright() as p:
        browser = await p.chromium.launch(args=[
            "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
            "--ignore-gpu-blocklist", "--no-proxy-server"])
        for name, (w, h) in SIZES.items():
            page = await browser.new_page(viewport={"width": w, "height": h}, device_scale_factor=1)
            await page.goto(URL, wait_until="load")
            await page.wait_for_function("window.__skyReady === true", timeout=120000)
            png = os.path.join("/tmp", "sky-" + name + ".png")
            await page.locator("#sky").screenshot(path=png)
            out = os.path.join(ROOT, "img", "sky", name + ".webp")
            Image.open(png).convert("RGB").save(out, "WEBP", quality=80, method=6)
            print(name, os.path.getsize(out) // 1024, "KB")
        await browser.close()


asyncio.run(main())
