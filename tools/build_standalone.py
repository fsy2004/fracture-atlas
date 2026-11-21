"""Create a double-clickable HTML edition using the exact vendored modules and meshes."""
import argparse
import base64
import json
import posixpath
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]

def data_uri(content_type, data):
    return "data:" + content_type + ";base64," + base64.b64encode(data).decode("ascii")

def build(output):
    modules = {}
    def add(name):
        if "@atlas/" + name in modules:
            return
        code = (ROOT / name).read_text(encoding="utf-8-sig")
        def resolve(match):
            dep = posixpath.normpath(posixpath.join(posixpath.dirname(name), match[1]))
            add(dep)
            return 'from "@atlas/' + dep + '"'
        code = re.sub(r"""from\s+['"](\.[^'"]+)['"]""", resolve, code)
        if name == "app.js":
            assets = {p: data_uri(kind, (ROOT / p).read_bytes()) for p, kind in
                      [("models/index.json", "application/json"), ("models/bones.bin", "application/octet-stream")]}
            code = "const localAssets=" + json.dumps(assets) + ";\n" + code.replace("await fetch(u)", "await fetch(localAssets[u])")
        modules["@atlas/" + name] = data_uri("text/javascript", code.encode())
    add("app.js")
    html = (ROOT / "index.html").read_text(encoding="utf-8-sig")
    html = html.replace('<link rel="stylesheet" href="./style.css">',
                        "<style>" + (ROOT / "style.css").read_text(encoding="utf-8-sig") + "</style>")
    html = html.replace('<script type="module" src="./app.js"></script>',
                        '<script type="importmap">'+json.dumps({"imports": modules})+'</script>\n'
                        '<script type="module">import "@atlas/app.js";</script>')
    credits = ((ROOT / "models/provenance.json").read_text(encoding="utf8") + "\n" +
               (ROOT / "vendor/LICENSE-three.txt").read_text(encoding="utf8"))
    output.write_text(html.replace("</body>", "<!--\n"+credits.replace("--","—")+"\n-->\n</body>"), encoding="utf8")

if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    build(parser.parse_args().output)
