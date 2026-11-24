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

def classic_contact_worker():
    # Chromium does not start module workers from a file:// document. Bundle the two
    # pinned MIT modules into a classic blob worker while retaining their lexical scopes.
    three = (ROOT / "vendor/three.module.js").read_text(encoding="utf-8-sig")
    bvh = (ROOT / "vendor/mesh-bvh.js").read_text(encoding="utf-8-sig")
    worker = (ROOT / "contact-worker.js").read_text(encoding="utf-8")
    imported = re.search(r"import\s*\{([^}]+)\}\s*from './three.module.js';", bvh)
    exported = re.search(r"export\s*\{([^}]+)\};?\s*$", three)
    if not imported or not exported:
        raise ValueError("Cannot bundle the pinned contact-worker dependencies")
    names = {n.strip() for n in imported[1].split(",")}
    bindings = {}
    for entry in exported[1].split(","):
        pair = entry.strip().split(" as ")
        if pair[-1] in names:
            bindings[pair[-1]] = pair[0]
    if set(bindings) != names:
        raise ValueError("Missing Three.js bindings in offline contact worker")
    fields = ",".join(k + ":" + v for k, v in bindings.items())
    core = "const THREE=(()=>{" + three[:exported.start()] + "\nreturn {" + fields + "};})();\n"
    bvh = bvh[:imported.start()] + "const {" + imported[1] + "}=THREE;" + bvh[imported.end():]
    bvh, count = re.subn(r"export\s*\{[^}]+\};?\s*$", "return {MeshBVH,CENTER};", bvh)
    if count != 1:
        raise ValueError("Missing BVH exports in offline contact worker")
    core += "const {MeshBVH,CENTER}=(()=>{" + bvh + "})();\nconst {BufferGeometry,BufferAttribute}=THREE;\n"
    worker = re.sub(r"import\s*\{[^}]+\}\s*from '[^']+';", "", worker)
    return (core + worker).replace("</script", "<\\/script")

def build(output):
    modules = {}
    def add(name):
        if "@atlas/" + name in modules:
            return
        code = (ROOT / name).read_text(encoding="utf-8-sig")
        def resolve(match):
            dep = posixpath.normpath(posixpath.join(posixpath.dirname(name), match[1].split('?')[0]))
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
    worker_code = classic_contact_worker()
    html = (ROOT / "index.html").read_text(encoding="utf-8-sig")
    html = re.sub(r'<link data-model-preload[^>]+>\n?', '', html)
    html = html.replace("</body>", '<script type="text/plain" id="contactWorkerSource">' + worker_code + '</script></body>')
    html = re.sub(r'<link rel="stylesheet" href="\./style\.css(?:\?[^"]+)?">',
                  lambda _: "<style>" + (ROOT / "style.css").read_text(encoding="utf-8-sig") + "</style>", html)
    asset_tags = []
    vhm=json.loads((ROOT / 'models/vhm/manifest.json').read_text(encoding='utf-8-sig'))
    detail_regions=json.loads((ROOT / 'models/detail-regions.json').read_text(encoding='utf-8-sig'))
    names=["models/index.json","models/bones.bin","models/detail.json","models/detail-regions.json","models/vhm/manifest.json"]
    names.extend("models/"+part["file"] for part in detail_regions.values())
    names.extend("models/vhm/"+entry["file"] for entry in vhm["entries"])
    extra=json.loads((ROOT/'models/extended/manifest.json').read_text(encoding='utf-8-sig'))
    names.extend(['models/extended/manifest.json','models/extended/canal.json'])
    names.extend(dict.fromkeys('models/extended/'+e['file'] for e in extra['entries']))
    names.extend('models/extended/'+e['face_confidence'] for e in extra['entries'] if e.get('face_confidence'))
    for name in names:
        content = base64.b64encode((ROOT / name).read_bytes()).decode("ascii")
        asset_tags.append('<script type="application/octet-stream" id="'+name+'">'+content+'</script>')
    html = re.sub(r'<script type="module" src="\./app\.js(?:\?[^"]+)?"></script>',
                  lambda _: ''.join(asset_tags)+'<script type="importmap">'+json.dumps({"imports": modules})+'</script>\n'
                  '<script type="module">import "@atlas/app.js";</script>', html)
    for icon in ("wrist", "leg", "hip"):
        path = "art/" + icon + ".webp"
        html = html.replace('src="' + path + '"', 'src="' + data_uri("image/webp", (ROOT / path).read_bytes()) + '"')
    additional="\n".join(s["credit"]+" · "+s["license"]+" · "+s["url"] for s in extra["sources"].values())+"\n"
    credits = (additional+vhm["credit"]+" · "+vhm["license"]+" · "+vhm["source_url"]+"\nDetailed surfaces: BodyParts3D, Copyright © 2008 Life Science Integrated Database Center. CC BY-SA 2.1 Japan. https://creativecommons.org/licenses/by-sa/2.1/jp/ Source: Kevin-Mattheus-Moerman/BodyParts3D, 2c83c698788cff57f6317bddcf712e7acfbea7d8. Native float32 mesh packing, shared rigid coordinate transform, and mapping of lesson landmarks.\n" + (ROOT / "models/provenance.json").read_text(encoding="utf8") + "\n" +
               (ROOT / "vendor/LICENSE-three.txt").read_text(encoding="utf8") + "\n" + (ROOT / "vendor/LICENSE-mesh-bvh.txt").read_text(encoding="utf8"))
    output.write_text(html.replace("</body>", "<!--\n"+credits.replace("--","—")+"\n-->\n</body>"), encoding="utf8")

if __name__ == "__main__":
    parser=argparse.ArgumentParser(description=__doc__)
    parser.add_argument("output", type=Path)
    build(parser.parse_args().output)
