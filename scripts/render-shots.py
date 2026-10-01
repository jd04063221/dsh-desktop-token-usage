"""Takes the README screenshots from scripts/render-shots.mjs's output.

The element tree is built into real DOM here (no React, no live app) and shot
with the installed Chrome in both DSH themes. Usage:

    node scripts/render-shots.mjs assets/shots.json
    python scripts/render-shots.py assets/shots.json assets
"""
import json
import pathlib
import sys

from playwright.sync_api import sync_playwright

CHROME = r"C:\Program Files\Google\Chrome\Application\chrome.exe"
PANEL_WIDTH = 880
SIDEBAR_WIDTH = 256
SETTINGS_WIDTH = 560

SVG_ATTRS = {
    "strokeWidth": "stroke-width",
    "strokeLinecap": "stroke-linecap",
    "strokeDasharray": "stroke-dasharray",
    "strokeDashoffset": "stroke-dashoffset",
    "vectorEffect": "vector-effect",
    "pointerEvents": "pointer-events",
    "stepLength": "step-length",
    "fontSize": "font-size",
    "textAnchor": "text-anchor",
}
SVG_VERBATIM = {
    "viewBox", "preserveAspectRatio", "d", "transform", "stroke", "fill", "opacity",
    "cx", "cy", "r", "x", "y", "x1", "y1", "x2", "y2", "width", "height", "points",
}


def token_block(tokens):
    return "".join(k + ":" + v + ";" for k, v in tokens.items())


def build_html(payload):
    return """<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8">
<style>
:root{""" + token_block(payload["tokens"]["light"]) + """}
body[data-ds-dark-theme]{""" + token_block(payload["tokens"]["dark"]) + """}
html,body{margin:0;padding:0;background:var(--dsw-alias-bg-base);color:var(--dsw-alias-label-primary);
  font-family:"Segoe UI","Microsoft YaHei",system-ui,sans-serif}
/* nothing may shrink: the panel is the width a real central panel gives it */
#panel{width:""" + str(PANEL_WIDTH) + """px;flex:none}
#stack{display:flex;flex-direction:column;gap:20px;flex:none}
#sidebar{width:""" + str(SIDEBAR_WIDTH) + """px;padding:8px;box-sizing:border-box}
#settings{width:""" + str(SETTINGS_WIDTH) + """px}
#wrap{display:flex;gap:24px;align-items:flex-start;padding:0 24px 24px}
</style>
<style id="plugin">""" + payload["css"] + """</style>
</head><body>
<div id="wrap"><div id="panel"></div><div id="stack"><div id="sidebar"></div><div id="settings"></div></div></div>
<script>
const SVG_NS = "http://www.w3.org/2000/svg";
// createElement("svg") yields an HTMLUnknownElement, and a whole <svg> subtree
// built that way paints nothing — the namespace has to be explicit, which is
// what React DOM does for these same elements in the real app.
const SVG_TAGS = new Set(["svg","g","path","circle","ellipse","rect","line","polyline","polygon","text","tspan","defs","use","clipPath","mask","linearGradient","radialGradient","stop"]);
const SVG_ATTRS = """ + json.dumps(SVG_ATTRS) + """;
const SVG_VERBATIM = new Set(""" + json.dumps(sorted(SVG_VERBATIM)) + """);
const DATA = """ + json.dumps(payload["trees"]).replace("<", "\\u003c") + """;

function build(node) {
  if (node === null || node === undefined || typeof node === "boolean") return null;
  if (Array.isArray(node)) {
    const frag = document.createDocumentFragment();
    for (const child of node) { const built = build(child); if (built) frag.appendChild(built); }
    return frag;
  }
  if (typeof node === "string" || typeof node === "number") return document.createTextNode(String(node));
  const el = SVG_TAGS.has(node.tag) ? document.createElementNS(SVG_NS, node.tag) : document.createElement(node.tag);
  const isSvg = el.namespaceURI === SVG_NS;
  const late = {};
  for (const [key, value] of Object.entries(node.props || {})) {
    if (value === undefined || value === null || key === "children" || typeof value === "function") continue;
    if (key === "className") { el.setAttribute("class", value); continue; }
    // Form state is a DOM property, not an attribute — and a <select> only takes
    // its value once the options exist, so these are applied after the children.
    if (key === "value" || key === "checked" || key === "disabled") { late[key] = value; continue; }
    if (["type", "min", "max", "step", "placeholder", "for", "id", "name"].includes(key)) { el.setAttribute(key, value); continue; }
    if (key === "style") {
      for (const [prop, val] of Object.entries(value)) {
        if (val === undefined || val === null) continue;
        if (prop.startsWith("--")) el.style.setProperty(prop, val);
        else el.style[prop] = typeof val === "number" ? val + "px" : val;
      }
      continue;
    }
    if (key === "title" || key === "aria-label" || key.startsWith("data-")) { el.setAttribute(key, value); continue; }
    if (isSvg) {
      const attr = SVG_ATTRS[key] || (SVG_VERBATIM.has(key) ? key : null);
      if (attr) el.setAttribute(attr, value);
    }
  }
  const kids = build(node.children);
  if (kids) el.appendChild(kids);
  for (const [key, value] of Object.entries(late)) {
    if (key === "checked" || key === "disabled") el[key] = Boolean(value);
    else el.value = value;
  }
  return el;
}

document.getElementById("panel").appendChild(build(DATA.dashboard));
document.getElementById("sidebar").appendChild(build(DATA.sidebar));
document.getElementById("settings").appendChild(build(DATA.settings));
</script>
</body></html>"""


RESIZE_WIDTH = 1200

# The width each shot is published at, and for the two tall dashboard panels a
# palette size as well: a full-size 2x capture of the whole panel is a 500 KiB
# PNG, which is more than a README screenshot is worth. Everything not listed
# here is published at RESIZE_WIDTH.
SHOT_SIZES = {
    "screenshot-dashboard-light.png": (900, 192),
    "screenshot-dashboard-dark.png": (900, 192),
    "screenshot-sidebar-light.png": (384, None),
    "screenshot-sidebar-dark.png": (384, None),
    "screenshot-settings-light.png": (800, None),
    "screenshot-settings-dark.png": (800, None),
}


def shoot(page, out_dir, selector, name, handle_js=None):
    path = out_dir / name
    raw = out_dir / ("_" + name)
    if handle_js:
        element = page.evaluate_handle(handle_js).as_element()
        element.screenshot(path=str(raw))
    else:
        page.locator(selector).first.screenshot(path=str(raw))
    # README-sized: the 2x capture is downscaled, which also cuts the file a lot.
    from PIL import Image

    width, colors = SHOT_SIZES.get(name, (RESIZE_WIDTH, None))
    with Image.open(raw) as image:
        if image.width > width:
            height = round(image.height * width / image.width)
            image = image.resize((width, height), Image.LANCZOS)
        if colors is not None:
            image = image.convert("P", palette=Image.ADAPTIVE, colors=colors)
        image.save(path, optimize=True)
    raw.unlink()
    print("  ->", path.name, str(path.stat().st_size // 1024) + " KiB", path.stat().st_size and "")


def main():
    payload = json.loads(pathlib.Path(sys.argv[1]).read_text(encoding="utf8"))
    out_dir = pathlib.Path(sys.argv[2])
    out_dir.mkdir(parents=True, exist_ok=True)
    html = build_html(payload)

    with sync_playwright() as p:
        browser = p.chromium.launch(executable_path=CHROME, headless=True)
        for theme in ("light", "dark"):
            page = browser.new_page(viewport={"width": 1800, "height": 1600}, device_scale_factor=2)
            page.set_content(html, wait_until="load")
            if theme == "dark":
                # The shell's marker is what the plugin reads; the OS preference is
                # deliberately not emulated, so the shot proves which one wins.
                page.evaluate("document.body.setAttribute('data-ds-dark-theme','')")
            page.wait_for_timeout(400)
            # Guard: a namespace slip once produced a page whose <svg> subtrees
            # painted nothing — the bars were fine, the hit-rate curve and the
            # donut silently vanished. Fail loudly instead of shipping that.
            check = page.evaluate(
                """() => {
                  const path = document.querySelector('svg path');
                  const circle = document.querySelector('svg circle');
                  return {
                    paths: document.querySelectorAll('svg path').length,
                    circles: document.querySelectorAll('svg circle').length,
                    strokes: [...document.querySelectorAll('svg path')].map((el) => getComputedStyle(el).stroke),
                    circleStrokes: [...document.querySelectorAll('svg circle')].map((el) => getComputedStyle(el).stroke),
                  };
                }"""
            )
            # Halo + curve must both be there, and painted in different colours:
            # a page with only the halo would otherwise pass while the curve is gone.
            assert check["paths"] >= 2 and check["circles"] >= 1, "SVG geometry is missing: " + str(check)
            assert len(set(check["strokes"])) >= 2, "the curve is indistinguishable from its halo: " + str(check)
            assert "none" not in check["strokes"] + check["circleStrokes"], "something would be invisible: " + str(check)
            print(theme + ":", check["paths"], "paths,", check["circles"], "circles,", len(set(check["strokes"])), "stroke colours")
            shoot(page, out_dir, "#panel", "screenshot-dashboard-" + theme + ".png")
            shoot(page, out_dir, "#sidebar", "screenshot-sidebar-" + theme + ".png")
            shoot(page, out_dir, "#settings", "screenshot-settings-" + theme + ".png")
            shoot(page, out_dir, ".dtu-cards", "screenshot-cards-" + theme + ".png")
            shoot(page, out_dir, "", "screenshot-trend-" + theme + ".png",
                  handle_js="document.querySelector('.dtu-trend').closest('.dtu-section')")
            shoot(page, out_dir, "", "screenshot-heatmap-" + theme + ".png",
                  handle_js="document.querySelector('.dtu-heatRows').closest('.dtu-section')")
            page.close()
        browser.close()


if __name__ == "__main__":
    main()
