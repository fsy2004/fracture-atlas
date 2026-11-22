from pathlib import Path
from urllib.parse import quote
import requests,concurrent.futures,hashlib,json,time,argparse

REV='9cdfccfc74a42ea657c2adf055513e6371239f49'
BASE='https://huggingface.co/datasets/BoneHub/visible-human-3d-models/resolve/'+REV+'/'
ROOT='visible_human_3d_models/CT/Mesh/01_Male'
def wanted(filename):
    stem=Path(filename).stem
    return not stem.startswith(('PHALANGE_','SKULL_CRANIAL_MAXILLA','HUMERUS_','ULNA_','RADIUS_')) and stem not in {'SACRUM','STERNUM'}
def main(folder):
    folder.mkdir(parents=True,exist_ok=True)
    api='https://huggingface.co/api/datasets/BoneHub/visible-human-3d-models/tree/'+REV+'/'+ROOT
    r=requests.get(api,params={'limit':1000,'recursive':'true'},timeout=40);r.raise_for_status()
    selected=[x for x in r.json() if x['path'].endswith('.stl') and wanted(x['path'])]
    assert len(selected)==113 and len(set(Path(x['path']).name for x in selected))==113
    def fetch(x):
        p=folder/Path(x['path']).name; url=BASE+quote(x['path']); digest=x['lfs']['oid']
        if not (p.is_file() and p.stat().st_size==x['size'] and hashlib.sha256(p.read_bytes()).hexdigest()==digest):
            for attempt in range(5):
                try:
                    resp=requests.get(url,timeout=(20,90));resp.raise_for_status()
                    data=resp.content
                    if len(data)!=x['size'] or hashlib.sha256(data).hexdigest()!=digest:raise ValueError('hash or length mismatch')
                    tmp=p.with_suffix('.stl.part');tmp.write_bytes(data);tmp.replace(p);break
                except (requests.RequestException,ValueError):
                    if attempt==4:raise
                    time.sleep(attempt+1)
        raw=p.read_bytes();n=int.from_bytes(raw[80:84],'little');assert len(raw)==84+50*n
        return {'path':x['path'],'url':url,'size':len(raw),'SHA256':digest,'triangles':n}
    print('selected',len(selected),'raw bytes',sum(x['size'] for x in selected),flush=True)
    out=[]
    with concurrent.futures.ThreadPoolExecutor(max_workers=7) as pool:
        for i,x in enumerate(pool.map(fetch,selected),1):
            out.append(x)
            if i%10==0:print('verified',i,flush=True)
    (folder/'sources-113.json').write_text(json.dumps(out,indent=2)+'\n',encoding='utf-8')
if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('folder',type=Path);main(ap.parse_args().folder)
