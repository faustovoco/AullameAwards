"""
Convierte el STL pesado (~100MB) del trofeo Aullame a un GLB liviano para web.
- Carga el STL
- Reduce la cantidad de triangulos (decimation) para que pese poco
- Centra y escala el modelo
- Exporta a GLB
"""
import sys
import numpy as np
import trimesh

SRC = r"C:\Users\faust\Downloads\hitem3d.stl"
OUT = r"C:\Users\faust\Desktop\Aullame Awards\public\models\trophy.glb"

TARGET_TRIS = 90_000  # objetivo de triangulos (calidad/peso equilibrado)

def main():
    print("Cargando STL...", flush=True)
    mesh = trimesh.load(SRC, force="mesh")
    print(f"  vertices={len(mesh.vertices):,}  triangulos={len(mesh.faces):,}", flush=True)

    # Limpieza basica
    mesh.remove_infinite_values()
    mesh.merge_vertices()
    mesh.update_faces(mesh.unique_faces())
    mesh.remove_unreferenced_vertices()

    # Decimation
    n = len(mesh.faces)
    if n > TARGET_TRIS:
        ratio = 1.0 - (TARGET_TRIS / n)
        print(f"Decimando de {n:,} -> ~{TARGET_TRIS:,} (reduccion {ratio:.3f})...", flush=True)
        try:
            import fast_simplification
            v, f = fast_simplification.simplify(
                mesh.vertices.astype(np.float64),
                mesh.faces.astype(np.int64),
                target_reduction=ratio,
            )
            mesh = trimesh.Trimesh(vertices=v, faces=f, process=True)
        except Exception as e:
            print(f"  fast_simplification fallo ({e}), uso trimesh simplify", flush=True)
            mesh = mesh.simplify_quadric_decimation(TARGET_TRIS)
        print(f"  resultado: triangulos={len(mesh.faces):,}", flush=True)

    # Normales suaves
    mesh.fix_normals()

    # Centrar en origen y escalar a altura ~2 unidades
    mesh.apply_translation(-mesh.bounding_box.centroid)
    extents = mesh.extents
    scale = 2.0 / max(extents)
    mesh.apply_scale(scale)

    # Exportar GLB
    import os
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    mesh.export(OUT)
    size_mb = os.path.getsize(OUT) / 1e6
    print(f"OK -> {OUT}  ({size_mb:.2f} MB, {len(mesh.faces):,} tris)", flush=True)

if __name__ == "__main__":
    main()
