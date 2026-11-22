import numpy as np,gzip,struct,json
from scipy.spatial import cKDTree
from scipy.sparse import coo_matrix
from scipy.sparse.csgraph import connected_components
from pathlib import Path
# Helper used to weld numerical slivers generated where horizontal clipping lines
# coincide with the restricted Delaunay contour boundaries.
def heal(v,f,tol=.00018):
 pairs=cKDTree(v).query_pairs(tol,output_type='ndarray')
 if len(pairs):
  n,l=connected_components(coo_matrix((np.ones(len(pairs)),(pairs[:,0],pairs[:,1])),shape=(len(v),len(v))),directed=False)
  _,rr=np.unique(l,return_index=True);v=v[rr];f=l[f]
 q=v[f];ar=np.linalg.norm(np.cross(q[:,1]-q[:,0],q[:,2]-q[:,0]),axis=1);f=f[ar>1e-8]
 # Raw surface may contain repeated index triangles from binarized original annotation.

 return v,f
