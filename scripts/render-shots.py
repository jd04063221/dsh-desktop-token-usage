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
#panel{width:""" + str(PANEL_WIDTH) + """px}
#sidebar{width:""" + str(SIDEBAR_WIDTH) + """px;padding:8px;box-sizing:border-box}
#wrap{display:flex;gap:24px;align-items:flex-start;padding:0 24px 24px}
</style>
<style id="plugin">""" + payload["css"] + """</style>
</head><body>
<div id="wrap"><div id="panel"></div><div id="sidebar"></div></div>
<script>
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
  const el = document.createElement(node.tag);
  const isSvg = el instanceof SVGElement;
  for (const [key, value] of Object.entries(node.props || {})) {
    if (value === undefined || value === null || key === "children" || typeof value === "function") continue;
    if (key === "className") { el.setAttribute("class", value); continue; }
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
  return el;
}

document.getElementById("panel").appendChild(build(DATA.dashboard));
document.getElementById("sidebar").appendChild(build(DATA.sidebar));
</script>
</body></html>"""


RESIZE_WIDTH = 1200


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

    with Image.open(raw) as image:
        if image.width > RESIZE_WIDTH:
            height = round(image.height * RESIZE_WIDTH / image.width)
            image = image.resize((RESIZE_WIDTH, height), Image.LANCZOS)
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
            page = browser.new_page(viewport={"width": 1400, "height": 1600}, device_scale_factor=2)
            page.set_content(html, wait_until="load")
            if theme == "dark":
                page.emulate_media(color_scheme="dark")
                page.evaluate("document.body.setAttribute('data-ds-dark-theme','')")
            page.wait_for_timeout(400)
            print(theme + ":")
            shoot(page, out_dir, "#panel", "screenshot-dashboard-" + theme + ".png")
            shoot(page, out_dir, "#sidebar", "screenshot-sidebar-" + theme + ".png")
            shoot(page, out_dir, ".dtu-cards", "screenshot-cards-" + theme + ".png")
            shoot(page, out_dir, "", "screenshot-trend-" + theme + ".png",
                  handle_js="document.querySelector('.dtu-trend').closest('.dtu-section')")
            shoot(page, out_dir, "", "screenshot-heatmap-" + theme + ".png",
                  handle_js="document.querySelector('.dtu-heatRows').closest('.dtu-section')")
            page.close()
        browser.close()


if __name__ == "__main__":
    main()
