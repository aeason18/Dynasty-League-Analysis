import type { BufferGeometry, BufferAttribute, Matrix4 } from "three";

export interface FacetGradient {
  geometry: BufferGeometry;
  /** Recompute every facet's color from the mesh's current world matrix. */
  update: (matrixWorld: Matrix4) => void;
}

/**
 * Returns a non-indexed copy of `geo` with a per-face (not per-vertex-shared)
 * "color" attribute, plus an `update` function to call every frame, so a
 * MeshPhysicalMaterial with vertexColors:true renders each triangular facet
 * as a distinct flat tint -- the faceted-gem look, versus one uniform body
 * color across the whole mesh.
 *
 * The gradient (green -> pale cream -> purple) is computed from each face's
 * *world-space* x position, recomputed on every call rather than baked in
 * once at the geometry's own local coordinates. A real light source fixed
 * in the scene would keep lighting the true left/right of the object as it
 * spins, not rotate along with it -- recomputing in world space each frame
 * reproduces that, instead of the gradient rigidly rotating with the mesh.
 */
export function withFacetGradient(
  geo: BufferGeometry,
  THREE: typeof import("three"),
  fromHex: number,
  toHex: number
): FacetGradient {
  const nonIndexed = geo.toNonIndexed();
  const position = nonIndexed.attributes.position;
  const colorAttr = new THREE.BufferAttribute(new Float32Array(position.count * 3), 3);
  nonIndexed.setAttribute("color", colorAttr as BufferAttribute);
  nonIndexed.computeVertexNormals();

  const from = new THREE.Color(fromHex);
  const mid = new THREE.Color(0xe8ddc7); // pale cream midpoint, so the shift isn't a flat two-color blend
  const to = new THREE.Color(toHex);
  const color = new THREE.Color();
  const vertex = new THREE.Vector3();
  const worldX = new Float32Array(position.count);

  const update = (matrixWorld: Matrix4) => {
    let minX = Infinity;
    let maxX = -Infinity;
    for (let i = 0; i < position.count; i++) {
      vertex.fromBufferAttribute(position, i).applyMatrix4(matrixWorld);
      worldX[i] = vertex.x;
      if (vertex.x < minX) minX = vertex.x;
      if (vertex.x > maxX) maxX = vertex.x;
    }
    const span = maxX - minX || 1;

    for (let i = 0; i < position.count; i += 3) {
      const avgX = (worldX[i] + worldX[i + 1] + worldX[i + 2]) / 3;
      const t = (avgX - minX) / span;
      if (t < 0.5) {
        color.copy(from).lerp(mid, t * 2);
      } else {
        color.copy(mid).lerp(to, (t - 0.5) * 2);
      }
      for (let v = 0; v < 3; v++) {
        colorAttr.setXYZ(i + v, color.r, color.g, color.b);
      }
    }
    colorAttr.needsUpdate = true;
  };

  return { geometry: nonIndexed, update };
}
