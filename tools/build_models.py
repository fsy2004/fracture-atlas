"""Repack the pinned male BodyParts3D atlas. Uses only Python's standard library."""
import gzip
import hashlib
import json
import struct
from pathlib import Path
from urllib.request import urlopen

ROOT = Path(__file__).resolve().parents[1]
REF = "e8b9ad1c17e67a25e94406100e3fb5c296c24f7a"
SOURCE = f"https://raw.githubusercontent.com/JICio/tcm-3d/{REF}/public/models"


def read_remote(name):
    with urlopen(f"{SOURCE}/{name}", timeout=120) as response:
        return response.read()


def main():
    atlas = json.loads(read_remote("atlas.json"))
    selected = [p for p in atlas["parts"]
                if p["system"] == "skeletal" and p["chunk"] >= 11
                and not any(word in p["name"].lower() for word in
                            ("gingiva", "ligament", "membrane", "disk", "cartilage", "tooth"))]
    buffers = {i: gzip.decompress(read_remote(f"body-{i}.bin.gz"))
               for i in sorted({p["chunk"] for p in selected})}
    packed = bytearray()
    manifest = []
    for part in selected:
        data = buffers[part["chunk"]]
        n, m = part["vertexCount"], part["indexCount"]
        manifest.append(dict(name=part["name"], id=part["conceptId"], mesh=part["id"],
                             vertices=n, indices=m, offset=len(packed)))
        pos = part["positions"]
        packed.extend(data[pos:pos + n * 12])
        faces = struct.unpack_from(f"<{m}I", data, part["indices"])
        if max(faces) >= n:
            raise ValueError(f"Invalid index for {part['id']}")
        packed.extend(struct.pack(f"<{m}H", *faces))
        packed.extend(bytes(-len(packed) % 4))
    out = ROOT / "models"
    expected = json.loads((out / "provenance.json").read_text(encoding="utf8"))["sha256"]
    if hashlib.sha256(packed).hexdigest() != expected:
        raise ValueError("Result differs from the published geometry")
    (out / "bones.bin").write_bytes(packed)
    (out / "index.json").write_text(json.dumps(manifest, indent=1), encoding="utf8")


if __name__ == "__main__":
    main()
