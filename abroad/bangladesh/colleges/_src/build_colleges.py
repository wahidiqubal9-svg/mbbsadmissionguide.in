#!/usr/bin/env python3
import json, os, re

ROOT = os.path.dirname(os.path.abspath(__file__))
SRC = os.path.join(ROOT, "colleges.json")
OUT = os.path.join(ROOT, "..")            # .../abroad/bangladesh/colleges
BASE = os.path.normpath(os.path.join(ROOT, "..", "..", "index.html"))  # bangladesh page shell

BASE_URL = "https://mbbsadmissionguide.in"
WA = "https://wa.me/918942954415?text=Hi%2C%20I%20want%20MBBS%20in%20Bangladesh%20details"
RATE = 90

EXTRA_CSS = """
  .doc-chips.alt li{color:var(--muted);font-weight:500}
  .doc-chips.alt li span{background:rgba(255,111,0,.12);border-color:rgba(255,111,0,.35);color:var(--saffron)}
  .cost-line .value small{font-weight:500}
  .cost-line .value.note{font-family:'Manrope',sans-serif;font-size:12.5px;font-weight:500;color:var(--muted);text-align:right;max-width:64%;line-height:1.5}
  .section > .wrap > .lead-card{margin-left:0;margin-right:0}
"""


def usd(n):
    return "${:,}".format(n)


def lakh(n):
    return "{:.1f}".format(n / 100000.0).rstrip("0").rstrip(".")


def inr(n):
    return "\u2248\u20b9{} L".format(lakh(n * RATE))


def inr_full(n):
    return "\u2248\u20b9{:,.0f}".format(n * RATE) if n * RATE < 100000 else inr(n)


def li(text):
    return ('<li><span><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" '
            'stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg></span>'
            + text + "</li>")


def strip_tags(s):
    return re.sub(r"<[^>]+>", " ", s).replace("  ", " ").strip()


def chips_list(items):
    return '<ul class="doc-chips">' + "".join(li(x) for x in items) + "</ul>"


# ---------------------------------------------------------------- college page
def build_shell(main_html, title, desc, canonical, ld_json):
    s = open(BASE, encoding="utf-8").read()
    s = re.sub(r'<meta name="description" content="[^"]*" />', '<meta name="description" content="' + desc + '" />', s, count=1)
    s = re.sub(r"<title>.*?</title>", "<title>" + title + "</title>", s, count=1, flags=re.S)
    s = re.sub(r'<link rel="canonical" href="[^"]*" />', '<link rel="canonical" href="' + canonical + '" />', s, count=1)
    s = s.replace("</style>", EXTRA_CSS + "</style>", 1)
    a = s.index("<script type=\"application/ld+json\">")
    b = s.index("</script>", s.index("</script>", a) + 1) + len("</script>")
    s = s[:a] + '<script type="application/ld+json">\n' + ld_json + "\n</script>" + s[b:]
    c = s.index("  <main>\n")
    d = s.index("  </main>\n") + len("  </main>\n")
    s = s[:c] + "  <main>\n" + main_html + "  </main>\n" + s[d:]
    t = s.index("<!-- Page-specific JS: eligibility checker -->")
    return s[:t].rstrip() + "\n</body>\n</html>\n"


def crumbs(college=None):
    mid = '<a href="/abroad/bangladesh/">Bangladesh</a><span class="sep">\u203a</span>'
    if college:
        mid += '<a href="/abroad/bangladesh/colleges/">Colleges &amp; Fees</a><span class="sep">\u203a</span><span class="current">' + college + "</span>"
    else:
        mid += '<span class="current">Colleges &amp; Fees</span>'
    return ('<div class="crumb-bar"><nav class="crumb" aria-label="Breadcrumb"><a href="/">Home</a>'
            '<span class="sep">\u203a</span><a href="/abroad/">MBBS Abroad</a><span class="sep">\u203a</span>' + mid + "</nav></div>")


def hero(c):
    loc = " Located in " + c["location"] + "." if c["location"] else ""
    return ('<section class="hero hero-bd"><div class="hero-grid"><div class="hero-content">\n'
            '    <div class="bd-pill"><span class="flag-dot"></span>' + c["name"] + " · " + c["session"] + " Intake</div>\n"
            '    <h1>MBBS at <span class="bd-highlight">' + c["short"] + "</span> — official fees, " + c["session"] + ".</h1>\n"
            '    <p>' + c["feeIntro"] + loc + "</p>\n"
            '    <div class="hero-stats">'
            '<div class="stat"><b>' + usd(c["feeUsd"]) + "</b><span>5-Year Fee (USD)</span></div>"
            '<div class="stat"><b>' + inr(c["feeUsd"]) + "</b><span>Approx in INR</span></div>"
            '<div class="stat"><b>' + c["session"] + "</b><span>Intake Session</span></div></div>\n"
            "  </div></div></section>")


def cost_lines(rows):
    return "".join('<div class="cost-line"><span class="label">' + l + '</span><span class="value">' + v + "</span></div>\n" for l, v in rows)


def fee_overview(c):
    texty = {"Location", "Eligible students", "Hostel", "Food", "Internship"}
    rows = [
        ("Official 5-year course fee", usd(c["feeUsd"]) + ' <small>(' + inr(c["feeUsd"]) + ")</small>"),
        ("Intake session", c["session"]),
    ]
    if c["location"]:
        rows.append(("Location", c["location"]))
    if c["audience"] == "Women only":
        rows.append(("Eligible students", "Women only"))
    rows.append(("Hostel", c["hostel"]))
    rows.append(("Food", c["food"]))
    rows.append(("Internship", c["internship"].split(".")[0] + "."))
    line_rows = ""
    for l, v in rows:
        val = '<span class="value' + (' note' if l in texty else '') + '">' + v + "</span>"
        line_rows += '<div class="cost-line"><span class="label">' + l + "</span>" + val + "</div>\n"
    return ('<div class="cost-card reveal">\n      <h3 class="serif">Fee at a glance</h3>\n'
            + line_rows
            + '      <div class="cost-total"><span class="label">Official stated total (5 years)</span>'
              '<span class="value">' + usd(c["feeUsd"]) + "</span></div>\n    </div>")


def breakdown(c):
    if not c.get("breakdown"):
        return ""
    rows = cost_lines([(l, usd(v)) for l, v in c["breakdown"]])
    return ('<div class="cost-card reveal">\n      <h3 class="serif">Stated fee breakup</h3>\n'
            '<p style="margin:4px 0 10px;font-size:12.5px;color:var(--muted)">As printed in the official fee document for the '
            + c["session"] + " session</p>\n" + rows + "    </div>")


def payment(c):
    if not c.get("payment"):
        return ""
    body = "".join('<tr><td class="col-label">' + l + "</td><td>" + usd(v) + "</td><td>" + inr_full(v) + "</td></tr>" for l, v in c["payment"])
    return ('<div class="cost-card reveal">\n      <h3 class="serif">Payment schedule</h3>\n'
            '<div class="table-scroll"><table class="compare-table">'
            "<thead><tr><th>Payment stage</th><th>USD</th><th>Approx INR</th></tr></thead><tbody>"
            + body + "</tbody></table></div>\n"
            + ('<div class="note-dash">' + c["notes"] + "</div>" if c["notes"] else "")
            + "</div>")


def faq_section(c):
    items = [
        ("What is the full 5-year MBBS fee at " + c["name"] + "?",
         "As per the college's official fee document for the " + c["session"] + " session, the stated 5-year fee is "
         + usd(c["feeUsd"]) + " (" + inr(c["feeUsd"]) + "). Colleges define their totals differently, so always read the "
         "\u201cIncluded\u201d and \u201cNot included / extra\u201d lists above together with the total."),
    ]
    if c["payment"]:
        items.append(("Can I pay " + c["short"] + " in installments?",
                      "Yes. The official fee document shows a staged schedule (booking / admission followed by installments). "
                      "Confirm exact dates and any non-refundable clauses with the college before paying."))
    items += [
        ("Does the fee include hostel and food?",
         "Hostel: " + c["hostel"].lower() + " Food: " + c["food"].lower()),
        ("What about internship costs?",
         c["internship"]),
        ("Is " + c["name"] + " right for my NEET score and budget?",
         "That is what our doctor-founders help you decide. Share your NEET score, 12th PCB marks and budget and we will compare "
         + c["short"] + " with other NMC-approved colleges - free, with no obligation."),
    ]
    lis = "".join('<div class="faq-item"><div class="faq-q" onclick="toggleFaq(this)">' + q +
                  '<span class="chev"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round"><path d="M12 5v14M5 12h14"/></svg></span></div>'
                  '<div class="faq-a">' + a + "</div></div>" for q, a in items)
    return ('<section class="section" id="faq"><div class="wrap">\n'
            '    <div class="shead reveal"><div class="eyebrow">Questions</div><h2>Quick answers.</h2></div>\n'
            '    <div class="faq-list reveal">' + lis + "</div>\n  </div></section>")


def college_main(c):
    disclaimer = ('<div class="note-dash">Figures are as per the college\'s official fee document for the ' + c["session"] +
                  " session. Fees, inclusions and exclusions change — always verify the current official amount before paying.</div>")
    html = [crumbs(c["name"]), hero(c),
            '<section class="section" id="overview"><div class="wrap">' + fee_overview(c) + disclaimer + "</div></section>"]
    if c.get("breakdown"):
        html.append('<section class="section" id="breakdown"><div class="wrap">' + breakdown(c) + "</div></section>")
    if c.get("payment"):
        html.append('<section class="section" id="payment"><div class="wrap">' + payment(c) + "</div></section>")
    html.append('<section class="section" id="inclusions"><div class="wrap"><div class="card-grid bd">'
                '<div class="cost-card reveal"><h3 class="serif">Included in the fee</h3>' + chips_list(c["covers"]) + "</div>"
                '<div class="cost-card reveal"><h3 class="serif">Not included / extra</h3><ul class="doc-chips alt">'
                + "".join(li(x) for x in c["notCovered"]) + "</ul></div></div></div></section>")
    checks = ["NEET qualified (mandatory for Indian students)",
              "DG Health equivalence certificate — handled by our team",
              ("Women only" if c["audience"] == "Women only" else "Open to men and women")]
    html.append('<section class="section" id="admission"><div class="wrap"><div class="card-grid bd">'
                '<div class="cost-card reveal"><h3 class="serif">Internship &amp; after MBBS</h3>'
                '<p style="margin:0;font-size:13px;color:#3C4A5A;line-height:1.65">' + c["internship"] + "</p></div>"
                '<div class="cost-card reveal"><h3 class="serif">Admission checklist</h3>' + chips_list(checks) + "</div>"
                "</div></div></section>")
    html.append('<section class="section" id="lead-wrap"><div class="wrap">' + lead_form(c) + "</div></section>")
    html.append(faq_section(c))
    html.append('<div class="cta-banner reveal"><h3>Speak with a <em>doctor-founder</em> about ' + c["name"] + ".</h3>"
                '<p>Dr. Wahid &amp; Dr. Washim verify official fees and college recognition before you pay.</p>'
                '<div class="btns"><a href="' + WA + '" class="btn-wa">WhatsApp</a>'
                '<a href="tel:+918942954415" class="btn-call">Call Now</a></div></div>')
    return "\n\n".join(html) + "\n"


def lead_form(c):
    return ('<div class="lead-card reveal" id="lead">\n'
            '    <h3 class="serif">Get your ' + c["short"] + ' shortlist</h3>\n'
            '    <p>A doctor-founder will confirm the latest official fee and seat availability at <b>' + c["name"] +
            "</b>, then shortlist matching NMC-approved colleges.</p>\n"
            '    <form id="leadFormEl" onsubmit="submitLead(event)">\n'
            '      <input type="hidden" id="leadPath" value="abroad" />\n'
            '      <input type="hidden" id="countrySelect" value="Bangladesh" />\n'
            '      <input type="hidden" id="leadcollege" value="' + c["name"] + '" />\n'
            '      <div class="form-row"><input type="text" class="input" id="leadName" placeholder="Full Name *" required /></div>\n'
            '      <div class="form-row two"><input type="tel" class="input" id="leadPhone" placeholder="Mobile No. *" pattern="[0-9]{10}" maxlength="10" required /><select id="leadNeet" required><option value="">NEET Status</option><option>Qualified</option><option>Appearing 2026</option><option>Not Appeared</option></select></div>\n'
            '      <div class="form-row two"><select id="leadBudget" required><option value="">Budget (5-yr total)</option><option>Under \u20b930 Lakh</option><option>\u20b930 – 35 Lakh</option><option>\u20b935 – 40 Lakh</option><option>Above \u20b940 Lakh</option></select><select id="leadState"><option value="">Your State</option><option>West Bengal</option><option>Bihar</option><option>Jharkhand</option><option>Uttar Pradesh</option><option>Delhi NCR</option><option>Maharashtra</option><option>Other</option></select></div>\n'
            '      <button type="submit" class="btn-gold" id="leadSubmitBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>Get ' +
            c["short"] + ' Shortlist &amp; Fees</button>\n'
            '      <div class="form-trust"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Confidential · Handled by our doctors</div>\n'
            "    </form>\n  </div>")


def write_college(c):
    path = "/abroad/bangladesh/colleges/" + c["slug"] + "/"
    desc = ("MBBS fees at " + c["name"] + " (" + c["session"] + ") — official 5-year fee " + usd(c["feeUsd"]) + " (" + inr(c["feeUsd"]) +
            "), with what's included, what's extra, and the payment schedule. Vetted by doctors.")
    title = c["name"] + " MBBS Fees " + c["session"] + " | MBBS Admission Guide"
    ld = ('{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":['
          '{"@type":"ListItem","position":1,"name":"Home","item":"' + BASE_URL + '/"},'
          '{"@type":"ListItem","position":2,"name":"MBBS Abroad","item":"' + BASE_URL + '/abroad/"},'
          '{"@type":"ListItem","position":3,"name":"Bangladesh","item":"' + BASE_URL + '/abroad/bangladesh/"},'
          '{"@type":"ListItem","position":4,"name":"Colleges & Fees","item":"' + BASE_URL + '/abroad/bangladesh/colleges/"},'
          '{"@type":"ListItem","position":5,"name":"' + c["name"].replace('"', "'") + '","item":"' + BASE_URL + path + '"}]}\n'
          '</script>\n<script type="application/ld+json">\n'
          '{"@context":"https://schema.org","@type":"Course","name":"MBBS at ' + c["name"] + '","description":"' +
          strip_tags(c["feeIntro"]) + '","provider":{"@type":"CollegeOrUniversity","name":"' + c["name"] +
          '","url":"' + BASE_URL + path + '"}}')
    html = build_shell(college_main(c), title, desc, BASE_URL + path, ld)
    out = os.path.join(OUT, c["slug"], "index.html")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    open(out, "w", encoding="utf-8").write(html)
    print("wrote", out)


# ---------------------------------------------------------------- index page
def index_main(cols):
    n = len(cols)
    cards = []
    for rank, c in enumerate(sorted(cols, key=lambda x: x["feeUsd"]), 1):
        meta = [c["session"], c["audience"]]
        if c["location"]:
            meta.insert(0, c["location"])
        cards.append('<a class="uni" href="/abroad/bangladesh/colleges/' + c["slug"] + '/">'
                     '<div class="uni-logo">' + c["short"][:2] + "</div>"
                     '<div class="uni-info"><h4>#' + str(rank) + " · " + c["name"] + "</h4>"
                     '<div class="meta"><span>' + "</span><span>".join(meta) + "</span></div></div>"
                     '<div class="uni-price"><b>' + usd(c["feeUsd"]) + "</b><small>5-yr · " + inr(c["feeUsd"]) + "</small></div></a>")
    disclaimer = ("Ranking is by the official <b>stated total</b> for the 5-year course. Because colleges define their totals "
                  "differently (some include hostel or food, some exclude internship or registration), read each page's "
                  "\u201cIncluded\u201d and \u201cNot included / extra\u201d lists before comparing. Figures are as per each "
                  "college's official fee document for the stated session — always verify the current amount before paying.")
    return (crumbs() + "\n\n"
            '<section class="hero hero-bd"><div class="hero-grid"><div class="hero-content">'
            '<div class="bd-pill"><span class="flag-dot"></span>Bangladesh · 2026 Intake</div>'
            '<h1>Bangladesh MBBS <span class="bd-highlight">college fees</span> — official documents, one place.</h1>'
            '<p>Every page below is built from the college\u2019s own published fee document — with food, hostel, internship and '
            'installments shown honestly, and verified by doctors.</p></div></div></section>\n'
            '<section class="section" id="list"><div class="wrap">'
            '<div class="shead reveal"><div class="eyebrow">Official Fee Guides</div><h2>All colleges &amp; their 5-year fees.</h2>'
            '<p class="sub">' + str(n) + ' guide' + ("s" if n != 1 else "") + ' published — more added as official documents arrive.</p></div>'
            '<div class="uni-list reveal">' + "".join(cards) + "</div>"
            '<div class="note-dash">' + disclaimer + "</div></div></section>\n"
            '<section class="section" id="lead-wrap"><div class="wrap">' +
            index_lead() + "</div></section>\n"
            '<div class="cta-banner reveal"><h3>Still deciding? Compare on a <em>free doctor call</em>.</h3>'
            '<p>Share your NEET score and budget — get an honest country &amp; college match.</p>'
            '<div class="btns"><a href="' + WA + '" class="btn-wa">WhatsApp</a>'
            '<a href="tel:+918942954415" class="btn-call">Call Now</a></div></div>\n')


def index_lead():
    return ('<div class="lead-card reveal" id="lead">\n'
            '    <h3 class="serif">Compare colleges for my NEET score</h3>\n'
            '    <p>A doctor-founder will shortlist the best-value NMC-approved colleges for your score and budget.</p>\n'
            '    <form id="leadFormEl" onsubmit="submitLead(event)">\n'
            '      <input type="hidden" id="leadPath" value="abroad" />\n'
            '      <input type="hidden" id="countrySelect" value="Bangladesh" />\n'
            '      <div class="form-row"><input type="text" class="input" id="leadName" placeholder="Full Name *" required /></div>\n'
            '      <div class="form-row two"><input type="tel" class="input" id="leadPhone" placeholder="Mobile No. *" pattern="[0-9]{10}" maxlength="10" required /><select id="leadNeet" required><option value="">NEET Status</option><option>Qualified</option><option>Appearing 2026</option><option>Not Appeared</option></select></div>\n'
            '      <div class="form-row two"><select id="leadBudget" required><option value="">Budget (5-yr total)</option><option>Under \u20b930 Lakh</option><option>\u20b930 – 35 Lakh</option><option>\u20b935 – 40 Lakh</option><option>Above \u20b940 Lakh</option></select><select id="leadState"><option value="">Your State</option><option>West Bengal</option><option>Bihar</option><option>Jharkhand</option><option>Uttar Pradesh</option><option>Delhi NCR</option><option>Maharashtra</option><option>Other</option></select></div>\n'
            '      <button type="submit" class="btn-gold" id="leadSubmitBtn"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 2L11 13"/><path d="M22 2l-7 20-4-9-9-4 20-7z"/></svg>Get My College Shortlist</button>\n'
            '      <div class="form-trust"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/></svg>Confidential · Handled by our doctors</div>\n'
            "    </form>\n  </div>")


def write_index(cols):
    path = "/abroad/bangladesh/colleges/"
    title = "Bangladesh MBBS College Fees 2026 — Official Fee Guides | MBBS Admission Guide"
    desc = ("Official 5-year MBBS fees for Bangladesh medical colleges — stated totals in USD and INR, hostel, food, internship "
            "and payment schedules, from the colleges' own fee documents.")
    ld = ('{"@context":"https://schema.org","@type":"BreadcrumbList","itemListElement":['
          '{"@type":"ListItem","position":1,"name":"Home","item":"' + BASE_URL + '/"},'
          '{"@type":"ListItem","position":2,"name":"MBBS Abroad","item":"' + BASE_URL + '/abroad/"},'
          '{"@type":"ListItem","position":3,"name":"Bangladesh","item":"' + BASE_URL + '/abroad/bangladesh/"},'
          '{"@type":"ListItem","position":4,"name":"Colleges & Fees","item":"' + BASE_URL + path + '"}]}')
    html = build_shell(index_main(cols), title, desc, BASE_URL + path, ld)
    out = os.path.join(OUT, "index.html")
    open(out, "w", encoding="utf-8").write(html)
    print("wrote", out)


if __name__ == "__main__":
    colleges = json.load(open(SRC, encoding="utf-8"))
    for c in colleges:
        write_college(c)
    write_index(colleges)
    print("total:", len(colleges))
