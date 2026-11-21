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
            code = """function embedded(path){
 const raw=document.getElementById(path).textContent;
 const bytes=Uint8Array.fromBase64?Uint8Array.fromBase64(raw):Uint8Array.from(atob(raw),c=>c.charCodeAt(0));
 return new Response(bytes);
}
""" + code.replace("await fetch(u)", "await embedded(u)").replace("await fetch(assetURL(u))","await embedded(u)")
        modules["@atlas/" + name] = data_uri("text/javascript", code.encode())
    add("app.js")
    html = (ROOT / "index.html").read_text(encoding="utf-8-sig")
    html = html.replace('<link rel="stylesheet" href="./style.css">',
                        "<style>" + (ROOT / "style.css").read_text(encoding="utf-8-sig") + "</style>")
    asset_tags = []
    for name in ("models/index.json","models/bones.bin","models/detail.json","models/detail.bin.gz"):
        content = base64.b64encode((ROOT / name).read_bytes()).decode("ascii")
        asset_tags.append('<script type="application/octet-stream" id="'+name+'">'+content+'</script>')
    html = html.replace('<script type="module" src="./app.js"></script>',
                        ''.join(asset_tags)+'<script type="importmap">'+json.dumps({"imports": modules})+'</script>\n'
                        '<script type="module">import "@atlas/app.js";</script>')
    for icon in ("wrist", "leg", "hip"):
        path = "art/" + icon + ".webp"
        html = html.replace('src="' + path + '"', 'src="' + data_uri("image/webp", (ROOT / path).read_bytes()) + '"')
    credits = ("Detailed surfaces: BodyParts3D, Copyright © 2008 Life Science Integrated Database Center. CC BY-SA 2.1 Japan. https://creativecommons.org/licenses/by-sa/2.1/jp/ Source: Kevin-Mattheus-Moerman/BodyParts3D, 2c83c698788cff57f6317bddcf712e7acfbea7d8. Native float32 mesh packing, shared rigid coordinate transform, and mapping of lesson landmarks.\n" + (ROOT / "models/provenance.json").read_text(encoding="utf8") + "\n" +
               (ROOT / "vendor/LICENSE-three.txt").read_text(encoding="utf8"))
    output.write_text(html.replace("</body>", "<!--\n"+credits.replace("--","—")+"\n-->\n</body>"), encoding="utf8")

if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    build(parser.parse_args().output)
