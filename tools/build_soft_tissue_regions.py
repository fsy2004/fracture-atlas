"""Build 11-zone soft-tissue assets from pinned Z-Anatomy male sources.

Retains native Draco mesh geometry without decimation, removes origin/insertion sticker patches
(.ol/.or/.el/.er), bursae, and enveloping fasciae from the muscular layer, extracts true 3D
origin/insertion bounds centres from those attachment patches into manifest metadata, and partitions
the original Draco buffers without re-encoding.
"""
import argparse
from tempfile import TemporaryDirectory
from copy import deepcopy
from hashlib import sha256
import itertools
import json
from pathlib import Path
import re
import struct
import subprocess

LAYERS = {
    'bones': 'skeletal_male.glb',
    'muscles': 'muscular_male.glb',
    'vessels': 'cardiovascular_male.glb',
    'nerves': 'nervous_male.glb',
}
ZONES = ('shoulder-arm', 'elbow-forearm', 'wrist-hand', 'hip-thigh', 'knee-leg', 'ankle-foot')
AXIAL_ZONES = ('face', 'neck', 'chest', 'back', 'pelvis')
TRIANGLE_LIMIT = 180_000
AXIAL_SELECTION_SHA256 = '55c154d68e910768075a7ce4298d8f81928a5eacce1b5b8c2bbd5eb4f0cf354b'
ROOT = Path(__file__).resolve().parents[1]

ATTACHMENT_RE = re.compile(r'^(.+?)\.([oe])(\d*)([lr])$')
JUNK_MUSCLE_RE = re.compile(
    r'\b(bursa|bursae|fascia|retinaculum|sheath|aponeurosis|septum|ligament|'
    r'tendinous arch|membrane|annular part|cruciform part|vincula|'
    r'mesotendineum|chiasm|iliopectineal arch|synovial)\b',
    re.I,
)
EXCLUDE_NON_LIMB_RE = re.compile(
    r'heart|coronary|infra-orbital|supra-orbital|supratrochlear|maxillary|meningeal|'
    r'gracile (fasciculus|lobule)|supramarginal|suprarenal|median sacral|sternohyoid|'
    r'sternothyroid|serratus posterior|scalenus|pudendal|genitofemoral|iliolumbar|'
    r'internal iliac|common iliac|brachiocephalic|subclavian nerve|intercostal|diaphragm|'
    r'oblique.*abdom|rectus abdom|transversus|erector|multifid|longissim|iliocostal|'
    r'splenius|semispinal|quadratus lumb|psoas minor|levator ani|coccyg|sphincter|'
    r'cremaster|bulbo|ischio|transverse perineal|palmaris brevis',
    re.I,
)
LIMB_BONE_RE = re.compile(
    r'clavicle|scapula|humerus|radius|ulna|scaphoid|lunate|triquetr|pisiform|'
    r'trapezium|trapezoid|capitate|hamate|metacarpal|phalanx.*hand|sesamoid.*hand|'
    r'hip bone|femur|patella|tibia|fibula|talus|calcaneus|navicular|cuboid|'
    r'cuneiform|metatarsal|phalanx.*foot|sesamoid.*foot',
    re.I,
)
INCLUDE_LIMB_TISSUE_RE = re.compile(
    r'sternocleidomastoid|trapezius|levator scapulae|rhomboid|serratus anterior|subclavius|'
    r'pectoralis major|pectoralis minor|latissimus dorsi|teres major|teres minor|'
    r'supraspinatus|infraspinatus|subscapularis|deltoid|coracobrachialis|'
    r'biceps brachii|triceps brachii|brachialis|brachioradialis|anconeus|pronator|supinator|'
    r'flexor carpi|extensor carpi|flexor digitorum|extensor digitorum|flexor pollicis|'
    r'extensor pollicis|abductor pollicis|adductor pollicis|opponens|extensor indicis|'
    r'extensor digiti|flexor digiti|abductor digiti|palmaris longus|interossei|lumbrical|'
    r'iliacus|psoas major|gluteus (maximus|medius|minimus)|tensor fasciae latae|iliotibial|'
    r'piriformis|obturator|gemellus|quadratus femoris|pectineus|adductor|gracilis|sartorius|'
    r'rectus femoris|vastus|biceps femoris|semitendinosus|semimembranosus|'
    r'gastrocnemius|soleus|plantaris|popliteus|calcaneal tendon|tibialis|fibularis|'
    r'flexor hallucis|extensor hallucis|abductor hallucis|adductor hallucis|quadratus plantae|'
    r'subclavian (artery|vein)|axillary (artery|vein)|circumflex humeral|circumflex scapular|'
    r'subscapular (artery|vein)|suprascapular (artery|vein)|thoraco-acromial|'
    r'brachial|radial|ulnar|interosseous|palmar|carpal|metacarpal|cephalic vein|basilic vein|'
    r'median cubital|median antebrachial|'
    r'external iliac (artery|vein)|femoral|circumflex femoral|gluteal (artery|vein|nerve)|'
    r'popliteal|genicular|patellar|tibial|fibular|saphenous|dorsalis pedis|plantar|tarsal|'
    r'metatarsal|arcuate artery|perforating (femoral|veins)|calcaneal branch|'
    r'brachial plexus|axillary nerve|musculocutaneous|median nerve|ulnar nerve|radial nerve|'
    r'interosseous nerve|suprascapular nerve|subscapular nerve|pectoral nerve|'
    r'antebrachial cutaneous|brachial cutaneous|sciatic nerve|femoral nerve|'
    r'lateral femoral cutaneous|posterior femoral cutaneous|nerve to (piriformis|quadratus femoris)|'
    r'common fibular|deep fibular|superficial fibular|tibial nerve|sural|saphenous nerve|'
    r'plantar nerve|digital (arter|vein|branch)|dorsal venous (network of hand|arch of foot)|'
    r'intercapitular veins of foot|dorsal cutaneous nerve of foot|middle collateral artery',
    re.I,
)

UPPER_NAME_RE = re.compile(
    r'clavic|scapul|humer|deltoid|pectoral|latissim|teres|supra|infra|subscap|coraco|'
    r'biceps brachii|triceps brachii|brachial|anconeus|pronator|supinator|radius|radial|'
    r'ulna|ulnar|carpi|carpal|palmar|metacarpal|pollicis|indicis|of hand|hand|'
    r'antebrach|cubital|cephalic vein|basilic vein|axillar|subclav|sternocleidomastoid|'
    r'trapezius|rhomboid|serratus anterior|levator scap|thoraco-acromial|median nerve|'
    r'musculocutaneous|middle collateral|interosseous (artery|nerve)|recurrent interosseous|'
    r'scaphoid|lunate|triquetr|pisiform|trapezium|trapezoid|capitate|hamate',
    re.I,
)
LOWER_NAME_RE = re.compile(
    r'hip bone|iliac|psoas|glute|piriform|obturat|gemell|quadratus femor|tensor fasciae|'
    r'iliotibial|pectineus|adductor (longus|brevis|magnus|minimus|hallucis)|gracilis|sartor|'
    r'femor|vastus|patell|biceps femoris|semitend|semimemb|poplite|genicul|gastrocnemius|'
    r'soleus|plantaris|calcane|tibia|fibula|talus|navicular|cuboid|cuneiform|tarsal|'
    r'metatarsal|plantar|hallucis|of foot|foot|sciatic|saphenous|sural|dorsalis pedis|'
    r'arcuate artery|perforating (femoral|veins|branches of plantar)|intercapitular veins',
    re.I,
)


def read_glb(data):
    magic, version, total = struct.unpack_from('<4sII', data)
    assert magic == b'glTF' and version == 2 and total == len(data)
    size, kind = struct.unpack_from('<II', data, 12)
    assert kind == 0x4e4f534a
    doc = json.loads(data[20:20 + size])
    count, kind = struct.unpack_from('<II', data, 20 + size)
    assert kind == 0x004e4942
    return doc, data[28 + size:28 + size + count]


def write_glb(doc, binary):
    header = json.dumps(doc, ensure_ascii=False, separators=(',', ':')).encode()
    header += b' ' * (-len(header) % 4)
    blob = bytes(binary) + b'\0' * (-len(binary) % 4)
    size = 12 + 8 + len(header) + 8 + len(blob)
    return (
        struct.pack('<4sIIII', b'glTF', 2, size, len(header), 0x4e4f534a)
        + header
        + struct.pack('<II', len(blob), 0x004e4942)
        + blob
    )


def transform(point, node):
    if 'matrix' in node:
        a = node['matrix']
        return tuple(sum(a[i + 4 * j] * point[j] for j in range(3)) + a[i + 12] for i in range(3))
    scale = node.get('scale', (1, 1, 1))
    offset = node.get('translation', (0, 0, 0))
    x, y, z, w = node.get('rotation', (0, 0, 0, 1))
    a, b, c = [v * s for v, s in zip(point, scale)]
    u, v, t = 2 * (y * c - z * b), 2 * (z * a - x * c), 2 * (x * b - y * a)
    return (
        a + w * u + y * t - z * v + offset[0],
        b + w * v + z * u - x * t + offset[1],
        c + w * t + x * v - y * u + offset[2],
    )


def bounds(doc, node):
    points = []
    for primitive in doc['meshes'][node['mesh']]['primitives']:
        p = doc['accessors'][primitive['attributes']['POSITION']]
        points.extend(transform(v, node) for v in itertools.product(*zip(p['min'], p['max'])))
    return [[round(f(v[i] for v in points), 6) for i in range(3)] for f in (min, max)]


def limb_for(label, box):
    if LOWER_NAME_RE.search(label):
        return 'lower'
    if UPPER_NAME_RE.search(label):
        return 'upper'
    cx = (box[0][0] + box[1][0]) / 2
    cy = (box[0][1] + box[1][1]) / 2
    if abs(cx) >= 0.165 and cy >= 0.65:
        return 'upper'
    if cy <= 0.95:
        return 'lower'
    return 'upper'


def zone_for(label, box):
    limb = limb_for(label, box)
    cy = (box[0][1] + box[1][1]) / 2
    if limb == 'upper':
        if re.search(r'hand|palmar|metacarpal|carpal|scaphoid|lunate|triquetr|pisiform|trapezium|trapezoid|capitate|hamate|pollicis brevis|opponens|lumbrical.*hand|interossei.*hand|abductor digiti minimi of hand|flexor digiti minimi of hand|adductor pollicis|digital.*(median|ulnar|radial|hand)', label, re.I):
            return 'wrist-hand'
        if re.search(r'clavic|scapul|deltoid|pectoral|latissim|teres|supra|infra|subscap|coraco|axillar|subclav|sternocleidomastoid|trapezius|rhomboid|serratus anterior|levator scap|brachial plexus|circumflex humeral|thoraco-acromial', label, re.I):
            return 'shoulder-arm'
        if cy >= 1.13:
            return 'shoulder-arm'
        if cy <= 0.875:
            return 'wrist-hand'
        return 'elbow-forearm'
    else:
        if re.search(r'foot|plantar|dorsalis pedis|tarsal|metatarsal|calcane|talus|navicular|cuboid|cuneiform|hallucis|arcuate artery|intercapitular|dorsal venous arch|dorsal cutaneous nerve of foot|quadratus plantae|extensor digitorum brevis|flexor digitorum brevis', label, re.I):
            return 'ankle-foot'
        if re.search(r'hip bone|iliac|psoas|glute|piriform|obturat|gemell|quadratus femor|pectineus|adductor|gracilis|sartor|circumflex femoral|femoral (artery|vein|nerve)|deep femoral|perforating femoral|femoral cutaneous|nerve to (piriformis|quadratus)|sciatic nerve|femur|rectus femoris|vastus|biceps femoris|semitend|semimemb|tensor fasciae|iliotibial', label, re.I):
            return 'hip-thigh'
        if cy >= 0.48:
            return 'hip-thigh'
        if cy <= 0.115:
            return 'ankle-foot'
        return 'knee-leg'


def touched_zones(label, box):
    limb = limb_for(label, box)
    y0, y1 = box[0][1], box[1][1]
    primary = zone_for(label, box)
    zones = [primary]
    if limb == 'upper':
        spans = [('shoulder-arm', 1.07, 1.56), ('elbow-forearm', 0.83, 1.20), ('wrist-hand', 0.65, 0.90)]
    else:
        spans = [('hip-thigh', 0.40, 1.08), ('knee-leg', 0.06, 0.52), ('ankle-foot', 0.0, 0.16)]
    for z, z0, z1 in spans:
        if z not in zones and y1 >= z0 and y0 <= z1:
            zones.append(z)
    return zones


def keep_structure(layer, label, box):
    if layer == 'bones':
        return bool(LIMB_BONE_RE.search(label))
    if layer == 'muscles':
        if ATTACHMENT_RE.match(label) or JUNK_MUSCLE_RE.search(label):
            return False
    if EXCLUDE_NON_LIMB_RE.search(label):
        return False
    if INCLUDE_LIMB_TISSUE_RE.search(label):
        return True
    # Catch any genuine limb structure sitting cleanly in limb space (e.g. unnamed head/branch)
    cx = (box[0][0] + box[1][0]) / 2
    cy = (box[0][1] + box[1][1]) / 2
    if (abs(cx) >= 0.175 and 0.65 <= cy <= 1.42) or cy <= 0.78:
        return True
    return False


def side_of(label, box):
    if re.search(r'\.l$|\bleft\b', label, re.I):
        return 'l'
    if re.search(r'\.r$|\bright\b', label, re.I):
        return 'r'
    cx = (box[0][0] + box[1][0]) / 2
    if cx > 0.01:
        return 'l'
    if cx < -0.01:
        return 'r'
    return ''


def partition(doc, binary, indices):
    subset = {
        'asset': doc['asset'],
        'extensionsUsed': doc['extensionsUsed'],
        'extensionsRequired': doc['extensionsRequired'],
        'scene': 0,
        'scenes': [{'nodes': list(range(len(indices)))}],
        'nodes': [],
        'meshes': [],
        'accessors': [],
        'bufferViews': [],
        'buffers': [{}],
    }
    buffer = bytearray()
    mapping = {'meshes': {}, 'accessors': {}, 'bufferViews': {}}

    def copy(kind, index):
        m = mapping[kind]
        if index in m:
            return m[index]
        item = deepcopy(doc[kind][index])
        new = len(subset[kind])
        m[index] = new
        subset[kind].append(item)
        if kind == 'bufferViews':
            start = item.get('byteOffset', 0)
            end = start + item['byteLength']
            buffer.extend(b'\0' * (-len(buffer) % 4))
            item['byteOffset'] = len(buffer)
            buffer.extend(binary[start:end])
        elif kind == 'accessors' and 'bufferView' in item:
            item['bufferView'] = copy('bufferViews', item['bufferView'])
        elif kind == 'meshes':
            for primitive in item['primitives']:
                primitive['attributes'] = {k: copy('accessors', i) for k, i in primitive['attributes'].items()}
                if 'indices' in primitive:
                    primitive['indices'] = copy('accessors', primitive['indices'])
                compressed = primitive['extensions']['KHR_draco_mesh_compression']
                compressed['bufferView'] = copy('bufferViews', compressed['bufferView'])
        return new

    for i in indices:
        node = deepcopy(doc['nodes'][i])
        assert not node.get('children'), 'expected flat anatomy scene'
        node['mesh'] = copy('meshes', node['mesh'])
        subset['nodes'].append(node)
    subset['buffers'][0]['byteLength'] = len(buffer)
    return write_glb(subset, buffer)


def mean_point(points):
    if not points:
        return None
    n = len(points)
    return [round(sum(p[i] for p in points) / n, 5) for i in range(3)]


def match_attachments(label, att_map):
    m = re.match(r'^(.+?)\.([lr])$', label)
    if not m:
        return [], []
    base, side = m.group(1).strip(), m.group(2)
    low = base.lower().strip('()')
    candidates = [low]
    # Handle multi-head muscles sharing a common insertion/origin patch (e.g. "Long head of biceps brachii" -> "biceps brachii muscle")
    for pat in (
        r'^(?:long|short|medial|lateral|humeral|ulnar|radial|humero-ulnar|deep|superficial|clavicular|sternocostal|abdominal|acromial|scapular spinal|oblique|transverse|ascending|descending)\s+(?:head|part)\s+of\s+(.+)$',
    ):
        hit = re.match(pat, low)
        if hit:
            core = hit.group(1).strip()
            candidates.extend([core, core + ' muscle', re.sub(r'\s+muscle$', '', core)])
    if low.endswith(' muscle'):
        candidates.append(low[:-7])
    else:
        candidates.append(low + ' muscle')

    origins, insertions = [], []
    def evidence(patches, candidate):
        return [dict(p, status='shared-head') if candidate != low and p['status'] == 'observed' else p for p in patches]
    for cand in candidates:
        rec = att_map.get((cand, side))
        if rec:
            if not origins and rec['o']:
                origins = evidence(rec['o'], cand)
            if not insertions and rec['e']:
                insertions = evidence(rec['e'], cand)
        if origins and insertions:
            break
    return origins, insertions


def named_side(label):
    if re.search(r'\.l$|^left\b', label, re.I):
        return 'l'
    if re.search(r'\.r$|^right\b', label, re.I):
        return 'r'
    return ''


def plan_regions(layer, doc, axial, owners):
    selections = {zone: [] for zone in (*ZONES, *AXIAL_ZONES)}
    excluded = []
    duplicates = []
    nodes = {}
    locked = {idx: (zone, label) for idx, zone, label in axial}
    for i, node in enumerate(doc['nodes']):
        label = node['name'].strip()
        key = label.casefold()
        box = bounds(doc, node)
        limb = keep_structure(layer, label, box)
        if i in locked:
            zone, expected = locked[i]
            if expected != label or zone not in AXIAL_ZONES or limb and key not in owners:
                raise ValueError(f'Unexpected axial selection {layer}/{i}: {label}')
        elif layer != 'bones' and key in owners and owners[key] != layer:
            duplicates.append(label)
            excluded.append([i, 'other-layer'])
            continue
        elif limb:
            zone = zone_for(label, box)
        else:
            excluded.append([i, 'attachment-metadata' if layer == 'muscles' and ATTACHMENT_RE.match(label) else 'outside-selection'])
            continue
        if key in owners and owners[key] != layer:
            raise ValueError(f'Structure selected in multiple layers: {label}')
        owners.setdefault(key, layer)
        selections[zone].append(i)
        primitives = doc['meshes'][node['mesh']]['primitives']
        nodes[i] = (label, {
            'region': zone,
            'zones': touched_zones(label, box) if zone in ZONES else [zone],
            'limb': limb_for(label, box) if zone in ZONES else '',
            'side': side_of(label, box) if zone in ZONES else named_side(label),
            'bounds': box,
            'sourceNode': i,
            'structureId': f'{layer}:{i}',
        }, sum(doc['accessors'][p['indices']]['count'] // 3 for p in primitives))
    parts = {}
    for zone, indices in selections.items():
        if not indices:
            raise ValueError(f'Uncovered zone {layer}/{zone}')
        if zone in ZONES or sum(nodes[i][2] for i in indices) <= TRIANGLE_LIMIT:
            parts[zone] = [indices]
            continue
        parts[zone] = []
        for side in ('', 'l', 'r'):
            current = []
            triangles = 0
            for i in indices:
                if named_side(nodes[i][0]) != side:
                    continue
                count = nodes[i][2]
                if triangles + count > TRIANGLE_LIMIT:
                    if not current or count > TRIANGLE_LIMIT:
                        raise ValueError(f'An individual node exceeds the triangle budget: {layer}/{i}')
                    parts[zone].append(current)
                    current, triangles = [], 0
                current.append(i)
                triangles += count
            if current:
                parts[zone].append(current)
    return parts, nodes, duplicates, excluded


def attachment_patches(doc, centres):
    attachments = {}
    for index, node in enumerate(doc['nodes']):
        match = ATTACHMENT_RE.match(node['name'].strip())
        if not match:
            continue
        base, kind, ordinal, source_side = match.groups()
        base = base.strip().lower().strip('()')
        point = centres[str(index)]
        side = ('l' if point[0] > 0 else 'r') if abs(point[0]) > .015 else source_side
        attachments.setdefault((base, side), {'o': [], 'e': []})[kind].append({
            'point': point, 'sourceNode': index, 'ordinal': ordinal, 'sourceSide': source_side,
            'side': side, 'sideConflict': side != source_side, 'method': 'decoded-world-bounds-centre',
            'status': 'observed',
        })
    for (base, side), record in list(attachments.items()):
        other = 'r' if side == 'l' else 'l'
        dst = attachments.setdefault((base, other), {'o': [], 'e': []})
        for kind, patches in record.items():
            if patches and not dst[kind]:
                dst[kind] = [dict(p, point=[-p['point'][0], *p['point'][1:]], side=other,
                                  status='mirrored') for p in patches]
    return attachments


def lock_geometry(doc, binary, nodes):
    digest = sha256()
    for index in sorted(nodes):
        node = doc['nodes'][index]
        primitive, = doc['meshes'][node['mesh']]['primitives']
        view = doc['bufferViews'][primitive['extensions']['KHR_draco_mesh_compression']['bufferView']]
        start = view.get('byteOffset', 0)
        count = view['byteLength']
        digest.update(struct.pack('<II', index, count))
        digest.update(binary[start:start + count])
    return digest.hexdigest()


def build(source, output):
    records = json.loads((source / 'sources.json').read_text(encoding='utf8'))
    selection = json.loads(Path(__file__).with_name('soft-tissue-axial-selection.json').read_text(encoding='utf8'))
    manifest = {
        'schemaVersion': 2,
        'license': 'CC-BY-SA-4.0',
        'scope': 'whole-body',
        'revision': records['revision'],
        'axialSelectionSha256': AXIAL_SELECTION_SHA256,
        'regions': [*ZONES, *AXIAL_ZONES],
        'layers': {},
        'coverage': {},
        'structures': {},
        'sourceGaps': {
            'textOnly': ['Phrenic nerve', 'Recurrent laryngeal nerve', 'Auriculotemporal nerve',
                         'Infra-orbital nerve', 'Complete cervical plexus', 'Complete lumbar plexus',
                         'Complete sacral plexus', 'Individual S2-S4 roots'],
            'groups': ['Intercostal nerves', 'Anterior root of spinal nerve', 'Posterior root of spinal nerve',
                       'Spinal ganglion', 'Cauda equina', 'Posterior intercostal arteries'],
        },
        'referenceComponents': {'FJ3266': 'medial', 'FJ3270': 'lateral',
                                'FJ3372': 'medial', 'FJ3376': 'lateral'},
    }
    owners = {}
    selector = sha256()
    for layer, filename in LAYERS.items():
        raw = (source / filename).read_bytes()
        declared = next(item for item in records['assets'] if item['file'] == filename)
        lock = selection[layer]
        if sha256(raw).hexdigest() != declared['sha256'] or declared['sha256'] != lock['sha256']:
            raise ValueError(f'Source checksum mismatch: {filename}')
        doc, binary = read_glb(raw)
        assert 'KHR_draco_mesh_compression' in doc['extensionsRequired'] and not doc.get('images')
        codes = bytearray(len(doc['nodes']))
        for index, zone, _ in lock['nodes']:
            codes[index] = AXIAL_ZONES.index(zone) + 1
        selector.update(codes)
        partitions, nodes, duplicates, excluded = plan_regions(layer, doc, lock['nodes'], owners)
        muscle_attachments = {}
        if layer == 'muscles':
            centres = subprocess.run(['node', str(ROOT / 'tools/soft-tissue-draco.mjs'), str(source / filename)],
                                     stdout=subprocess.PIPE, text=True, check=True)
            muscle_attachments = attachment_patches(doc, json.loads(centres.stdout))

        manifest['structures'][layer] = {}
        manifest['layers'][layer] = {}
        for zone, groups in partitions.items():
            parts = []
            for number, indices in enumerate(groups, 1):
                suffix = f'-{number}' if len(groups) > 1 else ''
                name = f'{layer}-{zone}{suffix}.glb'
                content = partition(doc, binary, indices)
                triangles = sum(nodes[i][2] for i in indices)
                if len(content) >= 25_000_000 or zone in AXIAL_ZONES and triangles > TRIANGLE_LIMIT:
                    raise ValueError(f'Partition exceeds budget: {name}')
                (output / name).write_bytes(content)
                parts.append({'file': name, 'bytes': len(content), 'sha256': sha256(content).hexdigest(),
                              'triangles': triangles, 'nodes': len(indices)})
                for i in indices:
                    label, record, _ = nodes[i]
                    record['ownerPart'] = name
                    record['anatomicalSide'] = {'l': 'left', 'r': 'right', '': 'midline'}[record['side']]
                    concept = re.sub(r'^(left|right)\s+', '', re.sub(r'\.[lr]$', '', label, flags=re.I), flags=re.I)
                    record['conceptId'] = f'{layer}:{concept.lower()}'
                    if layer == 'muscles':
                        origin, insertion = match_attachments(label, muscle_attachments)
                        for key, patches in [('origin', origin), ('insertion', insertion)]:
                            if patches:
                                record[key] = mean_point([p['point'] for p in patches])
                        record['attachmentEvidence'] = {'origin': origin, 'insertion': insertion}
                    manifest['structures'][layer][label] = record
            manifest['layers'][layer][zone] = parts[0] if len(parts) == 1 else parts

        manifest['coverage'][layer] = {
            'count': len(nodes), 'axialCount': len(lock['nodes']), 'source': declared,
            'duplicates': duplicates, 'excluded': excluded, 'dracoSha256': lock_geometry(doc, binary, nodes),
        }
        if len(manifest['structures'][layer]) != len(nodes):
            raise ValueError(f'Duplicate node labels in {layer}')
        print(f'{layer}: {len(nodes)} nodes ({len(lock["nodes"])} added)', flush=True)

    if selector.hexdigest() != AXIAL_SELECTION_SHA256:
        raise ValueError('Axial node assignments differ from the approved selection')
    (output / 'manifest.json').write_text(
        json.dumps(manifest, ensure_ascii=False, separators=(',', ':')) + '\n',
        encoding='utf8',
    )
    (output / 'NOTICE').write_bytes((source / 'NOTICE').read_bytes())


def main(source, output):
    source, output = source.resolve(), output.resolve()
    if output == source or source in output.parents:
        raise ValueError('Output must be outside the read-only source directory')
    output.parent.mkdir(parents=True, exist_ok=True)
    with TemporaryDirectory(prefix='soft-tissue-build-', dir=output.parent) as staging:
        staged = Path(staging)
        build(source, staged)
        output.mkdir(exist_ok=True)
        # Publish the manifest last so it never advertises files still being built.
        for asset in sorted(staged.glob('*.glb')):
            asset.replace(output / asset.name)
        (staged / 'NOTICE').replace(output / 'NOTICE')
        (staged / 'manifest.json').replace(output / 'manifest.json')


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('source', type=Path)
    parser.add_argument('--out', type=Path, default=ROOT / 'models/soft-tissue')
    args = parser.parse_args()
    main(args.source, args.out)
