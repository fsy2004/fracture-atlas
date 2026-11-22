"""Rebuild the Visible Korean head surfaces for the teaching atlas.

Uses NumPy, SciPy and Shapely 2.1+. Fetching additionally uses Requests.
Photograph retracing is optional and additionally uses Numba and Pillow.
"""
import argparse
import binascii
import concurrent.futures
import gzip
import hashlib
import json
from pathlib import Path
import struct
import zlib
from vk_mesh import pack
from vk_partition import partition

HERE=Path(__file__).resolve().parent

def fetch_stl(source):
 import requests
 lock=json.loads((HERE/'source-lock.json').read_text())
 def fetch(entry):
  p=source/Path(entry['file']).name
  if p.exists() and hashlib.sha256(p.read_bytes()).hexdigest()==entry['sha256']:return
  a=entry['offset'];b=a+entry['compressed']+256
  for attempt in range(3):
   with requests.get(lock['url']+f'?member={a}-{attempt}',headers={'Range':f'bytes={a}-{b}'},timeout=70,stream=True) as r:
    if r.status_code!=206 or not r.headers.get('Content-Range','').startswith(f'bytes {a}-{b}/'):
     if attempt<2:continue
     raise RuntimeError(f'Expected HTTP byte range for {p.name}')
    raw=r.content
   assert raw[:4]==b'PK\x03\x04'
   n,k=struct.unpack_from('<HH',raw,26);start=30+n+k
   data=zlib.decompress(raw[start:start+entry['compressed']],-15)
   if len(data)!=entry['size'] or entry['CRC']!=binascii.crc32(data) or hashlib.sha256(data).hexdigest()!=entry['sha256']:
    raise ValueError(f'Failed integrity check for {p.name}')
   p.write_bytes(data);return
 with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:list(pool.map(fetch,lock['files']))

def retrace(source):
 import numpy as np
 from vk_photographs import project
 from vk_trace import trace
 p=source/'volume.nii.gz'
 if hashlib.md5(p.read_bytes()).hexdigest()!='76cba704128600dd94665cb88f37329c':raise ValueError('Unexpected Visible Korean RGB volume')
 with gzip.open(p,'rb') as f:
  header=f.read(352);assert struct.unpack_from('<hh',header,70)==(128,24)
  rgb=np.frombuffer(f.read(),dtype=np.uint8).reshape((469,412,414,3))
 project(source,rgb);trace(source)
 return source/'traced-landmarks.json'

def main(args):
 args.source.mkdir(parents=True,exist_ok=True);args.out.mkdir(parents=True,exist_ok=True)
 if args.fetch:fetch_stl(args.source)
 lock=json.loads((HERE/'source-lock.json').read_text())
 for e in lock['files']:
  p=args.source/Path(e['file']).name
  if hashlib.sha256(p.read_bytes()).hexdigest()!=e['sha256']:raise ValueError(f'Unexpected source STL {p.name}')
 marks=retrace(args.source) if args.retrace else HERE/'traced-landmarks.json'
 pack(args.source,args.atlas,args.out);partition(args.source,args.atlas,args.out,marks)

if __name__=='__main__':
 ap=argparse.ArgumentParser(description=__doc__);ap.add_argument('--source',required=True,type=Path);ap.add_argument('--atlas',required=True,type=Path,help='Original atlas models directory, including detail.json and detail.bin.gz')
 ap.add_argument('--out',required=True,type=Path);ap.add_argument('--fetch',action='store_true',help='Retrieve and verify the required STL members from Zenodo')
 ap.add_argument('--retrace',action='store_true',help='Recompute the checked-in traces from source/volume.nii.gz')
 main(ap.parse_args())
