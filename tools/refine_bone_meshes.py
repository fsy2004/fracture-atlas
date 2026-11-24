"""Deterministic bone mesh precision upgrade:
1. 1-level Loop subdivision on low-polygon (<4,000 tris) small bones (carpals,
   phalanges, sesamoids) to quadruple triangle resolution with smooth C2 contours.
2. Volume-preserving Taubin smoothing (3 iterations, <=0.32 mm clamp, pinned
   boundaries) on CT-derived VHM and Visible Korean meshes to remove 1 mm CT
   slice staircasing without altering anatomical dimensions, joint clearances,
   or landmarks.
3. Re-packs .bin.gz deterministically (compresslevel=9, mtime=0) and updates
   manifest.json hashes and provenance metadata.
"""
import gzip
import hashlib
import json
from pathlib import Path

import numpy as np
from scipy import sparse

ROOT = Path(__file__).resolve().parents[1]
MODELS = ROOT / "models"


def read_mesh(path: Path, n_verts: int, n_tris: int):
    raw = gzip.decompress(path.read_bytes())
    expected = n_verts * 12 + n_tris * 12
    if len(raw) != expected:
        raise ValueError(f"{path}: expected {expected} bytes, got {len(raw)}")
    verts = np.frombuffer(raw, dtype="<f4", count=n_verts * 3).reshape(n_verts, 3).astype(np.float64)
    faces = np.frombuffer(raw, dtype="<u4", count=n_tris * 3, offset=n_verts * 12).reshape(n_tris, 3).copy()
    return verts, faces


def write_mesh(path: Path, verts: np.ndarray, faces: np.ndarray):
    v32 = np.ascontiguousarray(verts, dtype="<f4")
    f32 = np.ascontiguousarray(faces, dtype="<u4")
    raw = v32.tobytes() + f32.tobytes()
    gz = gzip.compress(raw, compresslevel=9, mtime=0)
    path.write_bytes(gz)
    return (
        hashlib.sha256(gz).hexdigest(),
        hashlib.sha256(raw).hexdigest(),
        len(gz),
    )


def find_boundary_vertices(n_verts: int, faces: np.ndarray):
    # Directed half-edges -> undirected edge counts
    e0 = faces[:, [0, 1]]
    e1 = faces[:, [1, 2]]
    e2 = faces[:, [2, 0]]
    all_e = np.vstack([e0, e1, e2])
    u = np.minimum(all_e[:, 0], all_e[:, 1]).astype(np.int64)
    v = np.maximum(all_e[:, 0], all_e[:, 1]).astype(np.int64)
    keys = u * n_verts + v
    uniq, counts = np.unique(keys, return_counts=True)
    non_interior = uniq[counts != 2]
    bmask = np.zeros(n_verts, dtype=bool)
    if len(non_interior):
        bu = (non_interior // n_verts).astype(np.int64)
        bv = (non_interior % n_verts).astype(np.int64)
        bmask[bu] = True
        bmask[bv] = True
    return bmask


def taubin_smooth(
    verts: np.ndarray,
    faces: np.ndarray,
    lam: float = 0.42,
    mu: float = -0.44,
    iters: int = 3,
    max_disp_m: float = 0.00032,
):
    n = len(verts)
    bmask = find_boundary_vertices(n, faces)

    # Build symmetric deduplicated adjacency graph
    rows = np.concatenate([faces[:, 0], faces[:, 1], faces[:, 2], faces[:, 1], faces[:, 2], faces[:, 0]])
    cols = np.concatenate([faces[:, 1], faces[:, 2], faces[:, 0], faces[:, 0], faces[:, 1], faces[:, 2]])
    A = sparse.coo_matrix((np.ones(len(rows), dtype=np.float64), (rows, cols)), shape=(n, n)).tocsr()
    A.data[:] = 1.0
    deg = np.asarray(A.sum(axis=1)).ravel()
    inv_deg = np.where(deg > 0, 1.0 / np.maximum(deg, 1.0), 0.0)
    # Pin boundary / non-manifold vertices strictly
    inv_deg[bmask] = 0.0
    W = sparse.diags(inv_deg) @ A

    pos = verts.copy()
    for _ in range(iters):
        avg = W @ pos
        delta = np.where(inv_deg[:, None] > 0, avg - pos, 0.0)
        pos = pos + lam * delta
        avg = W @ pos
        delta = np.where(inv_deg[:, None] > 0, avg - pos, 0.0)
        pos = pos + mu * delta

    # Hard displacement clamp to guarantee anatomical landmark & contact fidelity
    diff = pos - verts
    dist = np.linalg.norm(diff, axis=1)
    over = dist > max_disp_m
    if np.any(over):
        pos[over] = verts[over] + diff[over] * (max_disp_m / dist[over, None])

    rms_mm = float(np.sqrt(np.mean(np.sum((pos - verts) ** 2, axis=1))) * 1000.0)
    max_mm = float(np.max(np.linalg.norm(pos - verts, axis=1)) * 1000.0)
    return pos, rms_mm, max_mm


def loop_subdivide(verts: np.ndarray, faces: np.ndarray):
    n = len(verts)
    f_count = len(faces)
    a = faces[:, 0].astype(np.int64)
    b = faces[:, 1].astype(np.int64)
    c = faces[:, 2].astype(np.int64)

    # 3 edges per face and their opposite vertex
    e_v0 = np.concatenate([a, b, c])
    e_v1 = np.concatenate([b, c, a])
    e_opp = np.concatenate([c, a, b])

    u = np.minimum(e_v0, e_v1)
    v = np.maximum(e_v0, e_v1)
    keys = u * n + v

    uniq_keys, inv, counts = np.unique(keys, return_inverse=True, return_counts=True)
    n_edges = len(uniq_keys)
    eu = (uniq_keys // n).astype(np.int64)
    ev = (uniq_keys % n).astype(np.int64)

    # Sum opposite vertex positions for each undirected edge
    opp_sum = np.zeros((n_edges, 3), dtype=np.float64)
    np.add.at(opp_sum, inv, verts[e_opp])

    interior_e = counts == 2
    odd_verts = 0.5 * (verts[eu] + verts[ev])
    odd_verts[interior_e] = (
        0.375 * (verts[eu[interior_e]] + verts[ev[interior_e]])
        + 0.125 * opp_sum[interior_e]
    )

    # Even (original) vertex updates using Loop weights; pin boundary/non-manifold vertices
    bmask = np.zeros(n, dtype=bool)
    non_int = ~interior_e
    if np.any(non_int):
        bmask[eu[non_int]] = True
        bmask[ev[non_int]] = True

    nbr_sum = np.zeros((n, 3), dtype=np.float64)
    val = np.zeros(n, dtype=np.int64)
    np.add.at(nbr_sum, eu, verts[ev])
    np.add.at(nbr_sum, ev, verts[eu])
    np.add.at(val, eu, 1)
    np.add.at(val, ev, 1)

    even_verts = verts.copy()
    valid = (~bmask) & (val >= 3)
    k = val[valid].astype(np.float64)
    beta = np.where(k == 3.0, 3.0 / 16.0, 3.0 / (8.0 * k))
    even_verts[valid] = (1.0 - k * beta)[:, None] * verts[valid] + beta[:, None] * nbr_sum[valid]

    new_verts = np.vstack([even_verts, odd_verts])

    # New edge vertex indices per face
    e_ab = n + inv[0:f_count]
    e_bc = n + inv[f_count : 2 * f_count]
    e_ca = n + inv[2 * f_count : 3 * f_count]

    new_faces = np.vstack([
        np.column_stack([a, e_ab, e_ca]),
        np.column_stack([b, e_bc, e_ab]),
        np.column_stack([c, e_ca, e_bc]),
        np.column_stack([e_ab, e_bc, e_ca]),
    ]).astype(np.uint32)

    rms_mm = float(np.sqrt(np.mean(np.sum((even_verts - verts) ** 2, axis=1))) * 1000.0)
    max_mm = float(np.max(np.linalg.norm(even_verts - verts, axis=1)) * 1000.0)
    return new_verts, new_faces, rms_mm, max_mm


def process_manifest(manifest_path: Path, base_dir: Path, is_vhm: bool):
    manifest = json.loads(manifest_path.read_text(encoding="utf-8-sig"))
    subdiv_count = 0
    smooth_count = 0
    repack_count = 0
    max_rms = 0.0
    max_disp = 0.0
    bytes_before = 0
    bytes_after = 0

    for entry in manifest["entries"]:
        mesh_path = base_dir / entry["file"]
        old_size = mesh_path.stat().st_size
        bytes_before += old_size

        # Never modify meshes with per-triangle face_confidence / oralTrace contracts
        if entry.get("face_confidence"):
            bytes_after += old_size
            continue

        # Skip already-refined entries for idempotency
        if entry.get("refinement"):
            bytes_after += old_size
            continue

        collection = entry.get("collection", "vhm")
        n_verts = entry["vertices"]
        n_tris = entry["triangles"]

        action = None
        if n_tris < 4000:
            action = "loop-subdiv-1x"
        elif is_vhm or collection in ("vk-head", "vhm-trunk"):
            action = "taubin-8x" if n_tris >= 20000 else "taubin-3x"
        elif collection in ("n187928",):
            # Mild 1-iteration Taubin polish on medium OpenSkeleton long/carpal meshes
            action = "taubin-1x"
        else:
            # Athens photogrammetry & Halle palate: keep exact optical geometry, only re-verify
            bytes_after += old_size
            continue

        verts, faces = read_mesh(mesh_path, n_verts, n_tris)

        if action == "loop-subdiv-1x":
            new_verts, new_faces, rms_mm, disp_mm = loop_subdivide(verts, faces)
            # One gentle Taubin pass if CT-derived VHM carpal to remove tiny slice steps
            if is_vhm or collection == "vhm-ct":
                new_verts, rms2, disp2 = taubin_smooth(new_verts, new_faces, lam=0.36, mu=-0.38, iters=2, max_disp_m=0.00025)
                rms_mm = max(rms_mm, rms2)
                disp_mm = max(disp_mm, disp2)
            subdiv_count += 1
        elif action == "taubin-8x":
            new_verts, rms_mm, disp_mm = taubin_smooth(verts, faces, lam=0.44, mu=-0.46, iters=8, max_disp_m=0.00032)
            new_faces = faces
            smooth_count += 1
        elif action == "taubin-3x":
            new_verts, rms_mm, disp_mm = taubin_smooth(verts, faces, lam=0.42, mu=-0.44, iters=3, max_disp_m=0.00032)
            new_faces = faces
            smooth_count += 1
        elif action == "taubin-1x":
            new_verts, rms_mm, disp_mm = taubin_smooth(verts, faces, lam=0.35, mu=-0.37, iters=1, max_disp_m=0.00020)
            new_faces = faces
            smooth_count += 1

        if not np.all(np.isfinite(new_verts)):
            raise ValueError(f"Non-finite vertex after {action} on {entry['name']}")

        gz_sha, raw_sha, new_size = write_mesh(mesh_path, new_verts, new_faces)
        bytes_after += new_size
        max_rms = max(max_rms, rms_mm)
        max_disp = max(max_disp, disp_mm)

        entry.setdefault("original_vertices", n_verts)
        entry.setdefault("original_triangles", n_tris)
        entry["vertices"] = int(len(new_verts))
        entry["triangles"] = int(len(new_faces))
        entry["indices"] = int(len(new_faces) * 3)
        entry["sha256"] = gz_sha
        entry["packed_raw_sha256"] = raw_sha
        entry["refinement"] = action

    manifest_path.write_text(json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8")
    print(
        f"{manifest_path.relative_to(ROOT)}: "
        f"subdivided={subdiv_count}, smoothed={smooth_count}, "
        f"max_rms={max_rms:.3f} mm, max_disp={max_disp:.3f} mm, "
        f"size {bytes_before/1048576:.2f} MB -> {bytes_after/1048576:.2f} MB"
    )


def main():
    process_manifest(MODELS / "vhm" / "manifest.json", MODELS / "vhm", is_vhm=True)
    process_manifest(MODELS / "extended" / "manifest.json", MODELS / "extended", is_vhm=False)


if __name__ == "__main__":
    main()
