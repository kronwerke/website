#!/usr/bin/env python3
"""Writes a fingerprint of each file's content into the addresses that point to it.

    python tools/stamp.py DIST

`css/site.css` becomes `css/site.css?v=3f9a01c2d4`. The server keeps an address with ?v=
in the browser for a year, because a changed file gets a new address. Without this every
release made every browser fetch every file again.

Stamped are the addresses in the stylesheets (url(...)) and then those in the pages
(href, src, srcset, data-src, data-skin, data-cape, poster), in that order, so a page's
fingerprint of a stylesheet covers the stamps inside it. For the addresses that scripts
build, <html> gets data-v (all pictures and data) and, on the quest book, data-qd and
data-qi (its data and its pictures).
"""
import hashlib
import os
import re
import sys

KINDS = (".css", ".js", ".webp", ".png", ".jpg", ".jpeg", ".gif", ".svg", ".woff2", ".ico", ".mp4", ".webm")


def mark(root, base, ref, cache, book=None):
    """ref with ?v=, when it is a plain relative address of a file in root. A file of the
    quest book gets the book's fingerprint (book: for its data, for its pictures), the one
    its script adds to the addresses it builds, so both name the same address."""
    if not ref or "?" in ref or "#" in ref or ":" in ref or ref.startswith("//"):
        return ref
    if not ref.lower().endswith(KINDS + (".json",)):
        return ref
    path = os.path.normpath(os.path.join(root, ref.lstrip("/")) if ref.startswith("/") else os.path.join(base, ref))
    if not path.startswith(root + os.sep) or not os.path.isfile(path):
        return ref
    if book and path.startswith(os.path.join(root, "qb") + os.sep):
        return ref + "?v=" + book[0 if path.endswith(".json") else 1]
    if path.endswith(".json"):
        return ref
    if path not in cache:
        with open(path, "rb") as f:
            cache[path] = hashlib.sha256(f.read()).hexdigest()[:10]
    return ref + "?v=" + cache[path]


def main(root):
    root = os.path.abspath(root)
    cache = {}
    sheets, pages = [], []
    for d, _, names in os.walk(root):
        for n in names:
            if n.endswith(".css"):
                sheets.append(os.path.join(d, n))
            elif n.endswith(".html"):
                pages.append(os.path.join(d, n))
    # addresses that scripts build cannot be stamped one by one: they get one fingerprint
    # for all pictures and data (data-v), and the quest book one for its data (data-qd) and
    # one for its pictures (data-qi), written on <html> for the scripts to read
    def tree(dirs, keep):
        h = hashlib.sha256()
        for top in dirs:
            for d, sub, names in os.walk(os.path.join(root, top)):
                sub.sort()
                for n in sorted(names):
                    if keep(n):
                        p = os.path.join(d, n)
                        with open(p, "rb") as f:
                            h.update(os.path.relpath(p, root).encode() + b"\0" + hashlib.sha256(f.read()).digest())
        return h.hexdigest()[:10]

    v = tree(["img", "data"], lambda n: True)
    qd = tree(["qb"], lambda n: n.endswith(".json"))
    qi = tree(["qb"], lambda n: not n.endswith(".json"))
    for p in pages:
        with open(p, encoding="utf-8") as f:
            text = f.read()
        attrs = ' data-v="%s"' % v
        if "js/questbook.js" in text:
            attrs += ' data-qd="%s" data-qi="%s"' % (qd, qi)
        text, n = re.subn(r"<html\b", "<html" + attrs, text, count=1)
        if not n:
            sys.exit("no <html> in " + p)
        with open(p, "w", encoding="utf-8") as f:
            f.write(text)

    count = 0
    for files, pattern in (
        (sheets, re.compile(r'url\(\s*(["\']?)([^"\')]+)\1\s*\)')),
        (pages, re.compile(r'\b(href|src|data-src|data-skin|data-cape|poster)="([^"]*)"')),
    ):
        for p in sorted(files):
            with open(p, encoding="utf-8") as f:
                text = f.read()
            base = os.path.dirname(p)

            def sub(m):
                nonlocal count
                new = mark(root, base, m.group(2), cache, (qd, qi))
                if new == m.group(2):
                    return m.group(0)
                count += 1
                return m.group(0).replace(m.group(2), new, 1)

            out = pattern.sub(sub, text)
            if files is pages:
                # srcset names several files, each followed by its width or density
                def srcset(m):
                    nonlocal count
                    parts = []
                    for part in m.group(1).split(","):
                        bits = part.split()
                        if bits:
                            new = mark(root, base, bits[0], cache, (qd, qi))
                            count += new != bits[0]
                            bits[0] = new
                        parts.append(" ".join(bits))
                    return 'srcset="' + ", ".join(parts) + '"'
                out = re.sub(r'\bsrcset="([^"]*)"', srcset, out)
            if out != text:
                with open(p, "w", encoding="utf-8") as f:
                    f.write(out)
    print("stamped %d addresses to %d files" % (count, len(cache)))
    if not count:
        sys.exit("nothing was stamped")


if __name__ == "__main__":
    main(sys.argv[1])
