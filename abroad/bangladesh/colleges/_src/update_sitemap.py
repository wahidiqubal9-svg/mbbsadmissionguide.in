#!/usr/bin/env python3
"""Regenerate sitemap.xml from the colleges.json dataset."""
import json, os

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "colleges.json")
SITEMAP = os.path.normpath(os.path.join(ROOT, "..", "..", "..", "..", "sitemap.xml"))
BASE = "https://mbbsadmissionguide.in"


def main():
    cols = json.load(open(SRC, encoding="utf-8"))
    urls = [
        ("/", "weekly", "1.0"),
        ("/abroad/", "weekly", "0.9"),
        ("/abroad/bangladesh/", "weekly", "0.9"),
        ("/abroad/bangladesh/colleges/", "weekly", "0.8"),
        ("/india/", "weekly", "0.9"),
    ]
    for c in sorted(cols, key=lambda x: x["feeUsd"]):
        urls.append(("/abroad/bangladesh/colleges/" + c["slug"] + "/", "monthly", "0.7"))
    lines = ['<?xml version="1.0" encoding="UTF-8"?>',
             '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    for u, f, p in urls:
        lines.append('  <url>\n    <loc>%s%s</loc>\n    <lastmod>2026-09-09</lastmod>\n    <changefreq>%s</changefreq>\n    <priority>%s</priority>\n  </url>' % (BASE, u, f, p))
    lines.append("</urlset>")
    open(SITEMAP, "w", encoding="utf-8").write("\n".join(lines) + "\n")
    print("sitemap.xml written with", len(urls), "urls")


if __name__ == "__main__":
    main()
