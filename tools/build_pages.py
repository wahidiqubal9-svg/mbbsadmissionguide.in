#!/usr/bin/env python3
"""Assemble content pages from tools/content/*.html into full site pages.

Each source file starts with a meta comment:
<!--meta {"path":"/abroad/russia/","title":"...","desc":"...","priority":"0.8","noindex":false}-->
Everything after that line is the page body, inserted at the PAGE CONTENT marker.

Shell (head, header, drawer, footer, floating chrome) is lifted from index.html so
every page stays byte-identical outside the body. Sitemap is regenerated from disk.
"""
import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
SHELL = (ROOT / "index.html").read_text(encoding="utf-8")
CONTENT = ROOT / "tools" / "content"
SITE = "https://mbbsadmissionguide.in"

HEAD_SPLIT = '<body data-page="home">'
CONTENT_MARK = "<!-- ═══ PAGE CONTENT ═══ -->"
FOOTER_MARK = "<!-- ═══ STATIC FOOTER ═══ -->"

head_part, rest = SHELL.split(HEAD_SPLIT, 1)
pre_body, after = rest.split(CONTENT_MARK, 1)
chrome_tail = FOOTER_MARK + after.split(FOOTER_MARK, 1)[1]

LEAD_BLOCK = """  <div class="lead-card reveal" id="lead">
    <h3 class="serif">Free counseling — talk to a doctor, not an agent</h3>
    <p>Honest eligibility check on WhatsApp or a call within 15 minutes.</p>
    <form id="leadFormEl" onsubmit="submitLead(event)">
      <input type="hidden" id="leadPath" value="{path}" />
      <div class="path-switch">
        <div class="path-opt{india_on}" onclick="setPath('india');document.getElementById('leadPath').value='india'" id="pathIndia">India</div>
        <div class="path-opt abroad-path{abroad_on}" onclick="setPath('abroad');document.getElementById('leadPath').value='abroad'" id="pathAbroad">Abroad</div>
      </div>
      <div class="form-row"><input type="text" class="input" id="leadName" placeholder="Full Name *" required /></div>
      <div class="form-row two"><input type="tel" class="input" id="leadPhone" placeholder="Mobile No. *" pattern="[0-9]{{10}}" maxlength="10" required /><select id="leadNeet" required><option value="">NEET Status</option><option>Qualified</option><option>Appearing 2026</option><option>Not Appeared</option></select></div>
      <div id="indiaFields"><div class="form-row two"><select id="indiaPath"><option value="">Prefer</option><option>Govt College</option><option>Private College</option><option>Deemed University</option><option>NRI Quota</option><option>Not Sure</option></select><select id="indiaScore"><option value="">NEET Score</option><option>Below 400</option><option>400 – 500</option><option>500 – 600</option><option>600 – 650</option><option>650+</option></select></div></div>
      <div id="abroadFields" style="display:none"><div class="form-row two"><select id="countrySelect"><option value="">Preferred Country</option><option>Bangladesh</option><option>Russia</option><option>Georgia</option><option>Kazakhstan</option><option>Uzbekistan</option><option>Philippines</option><option>Not Sure</option></select><select id="leadBudget"><option value="">Budget (₹/yr)</option><option>Under 3 Lakh</option><option>3 – 5 Lakh</option><option>5 – 8 Lakh</option><option>Above 8 Lakh</option></select></div></div>
      <button type="submit" class="btn-gold" id="leadSubmitBtn">Request Free Counseling</button>
      <div class="form-trust">Confidential · Handled by our doctors</div>
    </form>
  </div>
"""

CTA_BLOCK = """  <div class="cta-banner reveal">
    <h3>Talk to a <em>doctor-founder</em> before you decide.</h3>
    <p>We'll tell you the real numbers — including when a country is the wrong choice for your score.</p>
    <div class="btns"><a href="https://wa.me/918942954415?text=Hi%2C%20I%20want%20MBBS%20counseling" class="btn-wa">WhatsApp</a><a href="tel:+918942954415" class="btn-call">Call Now</a></div>
  </div>
"""


def build(src: Path) -> dict:
    raw = src.read_text(encoding="utf-8")
    m = re.match(r"<!--meta\s+(\{.*?\})\s*-->", raw, re.S)
    if not m:
        raise SystemExit(f"{src.name}: missing meta comment")
    meta = json.loads(m.group(1))
    body = raw[m.end():].lstrip("\n")

    path = meta["path"]
    assert path.startswith("/") and path.endswith("/"), path

    form_path = "abroad" if path.startswith("/abroad") else "india"
    lead = LEAD_BLOCK.format(
        path=form_path,
        india_on=" active" if form_path == "india" else "",
        abroad_on=" active" if form_path == "abroad" else "",
    )
    body = body.replace("{{LEAD}}", lead).replace("{{CTA}}", CTA_BLOCK)

    head = head_part
    head = re.sub(r"<title>.*?</title>", f"<title>{meta['title']}</title>", head, count=1, flags=re.S)
    head = re.sub(r'<meta name="description" content="[^"]*"', f'<meta name="description" content="{meta["desc"]}"', head, count=1)
    head = re.sub(r'<link rel="canonical" href="[^"]*"', f'<link rel="canonical" href="{SITE}{path}"', head, count=1)
    for prop, tag in (("og:title", "property"), ("og:description", "property"), ("og:url", "property"),
                      ("twitter:title", "name"), ("twitter:description", "name")):
        val = {"og:title": meta["title"], "twitter:title": meta["title"],
               "og:description": meta["desc"], "twitter:description": meta["desc"],
               "og:url": SITE + path}[prop]
        head = re.sub(rf'<meta {tag}="{prop}" content="[^"]*"', f'<meta {tag}="{prop}" content="{val}"', head, count=1)
    extra = ""
    if meta.get("noindex"):
        extra += '\n<meta name="robots" content="noindex,follow" />'
    if meta.get("schema"):
        extra += '\n<script type="application/ld+json">' + json.dumps(meta["schema"], separators=(",", ":")) + "</script>"
    head = head.replace("</head>", extra + "\n</head>")

    out_dir = ROOT / path.strip("/")
    out_dir.mkdir(parents=True, exist_ok=True)
    html = head + HEAD_SPLIT.replace('data-page="home"', f'data-page="{meta.get("page", "")}"') + pre_body + CONTENT_MARK + "\n" + body + "\n" + chrome_tail
    if form_path == "abroad":
        html = html.replace('<script src="/assets/js/site.js"></script>',
                            '<script src="/assets/js/site.js"></script>\n<script>setPath(\'abroad\');</script>')
    (out_dir / "index.html").write_text(html, encoding="utf-8")
    return meta


def sitemap():
    urls = []
    for f in sorted(ROOT.rglob("index.html")):
        rel = "/" + f.parent.relative_to(ROOT).as_posix().strip(".")
        rel = re.sub(r"/+", "/", rel)
        if rel != "/" and not rel.endswith("/"):
            rel += "/"
        text = f.read_text(encoding="utf-8")
        if 'name="robots" content="noindex' in text:
            continue
        urls.append((rel, f.stat().st_mtime))
    lines = ['<?xml version="1.0" encoding="UTF-8"?>', '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">']
    import datetime
    for rel, mtime in urls:
        stamp = datetime.datetime.utcfromtimestamp(mtime).strftime("%Y-%m-%d")
        pr = "1.0" if rel == "/" else "0.8" if rel.count("/") <= 2 else "0.6"
        lines += ["  <url>", f"    <loc>{SITE}{rel}</loc>", f"    <lastmod>{stamp}</lastmod>", f"    <priority>{pr}</priority>", "  </url>"]
    lines.append("</urlset>")
    (ROOT / "sitemap.xml").write_text("\n".join(lines) + "\n", encoding="utf-8")
    return len(urls)


if __name__ == "__main__":
    built = 0
    for src in sorted(CONTENT.glob("*.html")):
        meta = build(src)
        built += 1
        print("built", meta["path"])
    if "--sitemap" in sys.argv or built:
        print("sitemap urls:", sitemap())
