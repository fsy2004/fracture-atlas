# Visible Korean head derivatives

The source is Chung Yoh Kim and Jin Seo Park, *Visible Korean male head dataset: sectioned images, segmented images, 7.0 T MRI data, and 3D models*, version 2 (2026). The donor was a 67-year-old man. The source archive and these derivatives are available under [CC BY-NC 4.0](https://creativecommons.org/licenses/by-nc/4.0/). Preserve attribution, the licence and the description of changes on redistribution. [Source data](https://doi.org/10.5281/zenodo.22759852)

Ten structures use author-segmented surfaces. The two temporal bones and the two zygomatic bones were separated by their pre-existing disconnected mesh components. The same donor’s mandible is provided for local jaw-joint and condylar-neck scenes. Indices were deduplicated, positions converted from mm to m and one rigid transform fitted to the whole head region. No per-bone scaling is applied.

Six side-resolved teaching surfaces were derived from three author-labelled bilateral meshes. The outer surface follows the original specimen. For the parietals the location follows a visible sagittal suture trace on the cryosection, for the nasal bones a partial dorsal trace and crest, and for the maxillae the interincisor gap, partial median contrast and palatal crest. Depth and fusion zones use an estimated internal interface. Reference traces and numerical checks are in partition-audit.json. Subdivision at the interface increases facet count without increasing the original scan resolution. The original bilateral surfaces are retained in the manifest under paired_regions. The decomposition has no open edges; a few of the original annotation meshes have non-manifold edges as recorded per surface.

Rebuild from the published release with a local atlas checkout:

    python build_visible_korean.py --source SOURCE --atlas REPO/models --out OUTPUT --fetch

The default uses the checked-in reviewed control-point paths. To reproduce the photographic evidence images and curve fitting, download the record’s “5. Visible Head Volume model.nii.gz” to SOURCE/volume.nii.gz and add --retrace. The input is verified against the release MD5. The 0.5 mm RGB volume is used in reconstruction only and is not distributed by the browser. The locked author archive was accessed by HTTP ranges, and each decompressed STL is checked by byte size, member CRC and SHA-256.

Every half pair was verified to cover its original bilateral volume, agree at the estimated mutual interface, and retain zero open edges. These geometric checks cannot establish accuracy in fused bone.
