#!/usr/bin/env python3
"""Insert Open Graph + Twitter meta into every HTML page, derived from its own
title/description/canonical. Idempotent: skips pages that already have og:title."""
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
IMG = "https://mbbsadmissionguide.in/assets/img/og-default.png"
SITE = "mbbsadmissionguide.in"

for page in sorted(ROOT.rglob("*.html")):
    rel = page.relative_to(ROOT)
    if str(rel).startswith("tools/"):
        continue
    html = page.read_text(encoding="utf-8")
    if "property=\"og:title\"" in html:
        continue
    title = re.search(r"<title>(.*?)</title>", html, re.S)
    desc = re.search(r'<meta name="description" content="([^"]*)"', html)
    canon = re.search(r'<link rel="canonical" href="([^"]*)"', html)
    if not title:
        continue
    t = title.group(1).strip()
    d = desc.group(1) if desc else t
    url = canon.group(1) if canon else None
    if not url:
        path = "/" if str(rel) == "index.html" else "/" + rel.parent.as_posix() + "/"
        url = "https://" + SITE + path
    noindex = 'content="noindex' in html

    block = [
        '<meta property="og:type" content="website" />',
        '<meta property="og:site_name" content="MBBS Admission Guide" />',
        '<meta property="og:locale" content="en_IN" />',
        f'<meta property="og:title" content="{t}" />',
        f'<meta property="og:description" content="{d}" />',
        f'<meta property="og:url" content="{url}" />',
        f'<meta property="og:image" content="{IMG}" />',
        '<meta property="og:image:width" content="1200" />',
        '<meta property="og:image:height" content="630" />',
        '<meta property="og:image:alt" content="MBBS Admission Guide — counseling founded by doctors" />',
        '<meta name="twitter:card" content="summary_large_image" />',
        f'<meta name="twitter:title" content="{t}" />',
        f'<meta name="twitter:description" content="{d}" />',
        f'<meta name="twitter:image" content="{IMG}" />',
    ]
    if noindex:
        block.append('<meta name="robots" content="noindex,follow" />')
    html = html.replace("</head>", "\n".join(block) + "\n</head>", 1)
    page.write_text(html, encoding="utf-8")
    print("og ->", rel)
