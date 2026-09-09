#!/usr/bin/env python3
"""Regenerate the 05-colleges section on the main Bangladesh page from colleges.json."""
import json, os

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "colleges.json")
PAGE = os.path.normpath(os.path.join(ROOT, "..", "..", "index.html"))


def initials(name):
    toks = [t for t in name.split()
            if not (t.lower().startswith("medical") or "college" in t.lower()
                    or t.lower() in ("of", "the", "&"))]
    if not toks:
        return name[:2].upper()
    return (toks[0][0] + toks[1][0]).upper() if len(toks) >= 2 else toks[0][:2].upper()


def main():
    cols = json.load(open(SRC, encoding="utf-8"))
    cards = []
    for c in sorted(cols, key=lambda x: x["feeUsd"]):
        meta = ("<span>" + c["location"] + "</span>" if c["location"] else "") + "<span>" + c["session"] + "</span>"
        cards.append('<a class="uni" href="/abroad/bangladesh/colleges/' + c["slug"] + '/">'
                     '<div class="uni-logo">' + initials(c["name"]) + '</div>'
                     '<div class="uni-info"><h4>' + c["name"] + '</h4><div class="meta">' + meta + '</div></div>'
                     '<div class="uni-price"><b>$' + format(c["feeUsd"], ",") + '</b><small>5-yr total</small></div></a>')
    note = str(len(cols)) + " fee guides published"
    new = ('  <!-- COLLEGE FEE GUIDES -->\n'
           '  <section class="section" id="colleges"><div class="wrap">\n'
            '    <div class="shead reveal"><div class="eyebrow">04 · Colleges &amp; Fees</div><h2>College fee guides — every fee checked, nothing hidden.</h2><p class="sub">Each guide shows a college\'s five-year fee with what\'s included, what\'s extra and the payment schedule.</p></div>\n'
           '    <div class="uni-list reveal">\n      ' + "\n      ".join(cards) + '\n    </div>\n'
           '    <a class="btn-gold" href="/abroad/bangladesh/colleges/" style="margin-top:18px;text-decoration:none">See all fee guides &amp; compare <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5l7 7-7 7"/></svg></a>\n'
           '  </div></section>\n\n')
    s = open(PAGE, encoding="utf-8").read()
    marker = "  <!-- TOP COLLEGES -->" if "  <!-- TOP COLLEGES -->" in s else "  <!-- COLLEGE FEE GUIDES -->"
    a = s.index(marker)
    b = s.index("  <!-- COST BREAKDOWN -->")
    open(PAGE, "w", encoding="utf-8").write(s[:a] + new + s[b:])
    print("bangladesh section updated:", note)


if __name__ == "__main__":
    main()
