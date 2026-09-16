"use client";

import { useEffect, useRef } from "react";
import { CRYSTAL_ACCENT_HEX, CRYSTAL_POP_HEX } from "@/components/three/palette";
import { withFacetGradient } from "@/components/three/facet-colors";

/**
 * A rotating, low-poly, tapered "crystal football" — a decorative hero
 * object, Dashboard only. Skips mounting under prefers-reduced-motion.
 */
export function CrystalHero() {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    let disposed = false;
    let frameId = 0;
    let renderer: import("three").WebGLRenderer | undefined;
    let resizeObserver: ResizeObserver | undefined;

    (async () => {
      const THREE = await import("three");
      if (disposed || !container) return;

      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.toneMapping = THREE.ACESFilmicToneMapping;
      renderer.toneMappingExposure = 1.6;
      container.appendChild(renderer.domElement);

      const scene = new THREE.Scene();
      const camera = new THREE.PerspectiveCamera(50, 1, 0.1, 100);
      camera.position.set(0, 0, 6.5);

      // An elongated, tapered icosahedron reads as a low-poly "crystal
      // football" -- the taper is applied per-vertex so the profile pinches
      // to a point at each tip instead of staying a smooth ellipsoid.
      const baseRadius = 1.5;
      const elongation = 1.75;
      const geo = new THREE.IcosahedronGeometry(baseRadius, 1);
      const posAttr = geo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const x = posAttr.getX(i);
        const y = posAttr.getY(i);
        const z = posAttr.getZ(i);
        const yNorm = y / baseRadius;
        const shapeFactor = Math.sqrt(Math.max(0, 1 - Math.pow(Math.abs(yNorm), 4)));
        posAttr.setX(i, x * shapeFactor);
        posAttr.setZ(i, z * shapeFactor);
        posAttr.setY(i, y * elongation);
      }
      posAttr.needsUpdate = true;
      geo.computeVertexNormals();

      // Faceted-gem look: panels shift from the sage accent on the left to
      // the pop magenta on the right, rather than one flat body color. The
      // gradient is recomputed in world space every frame (see the animate
      // loop below) so it stays anchored to true left/right as the crystal
      // spins, the way a real fixed-position light would.
      const { geometry: facetGeo, update: updateFacetGradient } = withFacetGradient(
        geo,
        THREE,
        CRYSTAL_ACCENT_HEX,
        CRYSTAL_POP_HEX
      );

      const mat = new THREE.MeshPhysicalMaterial({
        vertexColors: true,
        flatShading: true,
        metalness: 0,
        roughness: 0.08,
        clearcoat: 0.6,
        clearcoatRoughness: 0.1,
        transparent: true,
        opacity: 0.72,
        transmission: 0.3,
        thickness: 0.7,
        side: THREE.DoubleSide,
      });
      const mesh = new THREE.Mesh(facetGeo, mat);
      mesh.rotation.x = 0.3;
      mesh.rotation.z = -0.15;
      mesh.updateMatrixWorld();
      updateFacetGradient(mesh.matrixWorld);
      scene.add(mesh);

      const edges = new THREE.LineSegments(
        new THREE.EdgesGeometry(geo),
        new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 })
      );
      mesh.add(edges);

      scene.add(new THREE.AmbientLight(0xffffff, 1));
      const light1 = new THREE.PointLight(CRYSTAL_ACCENT_HEX, 4.5, 30);
      light1.position.set(-4, 3, 4);
      scene.add(light1);
      const light2 = new THREE.PointLight(CRYSTAL_POP_HEX, 6, 30);
      light2.position.set(3, -2.5, 3.5);
      scene.add(light2);
      const light3 = new THREE.PointLight(0xffffff, 2.5, 30);
      light3.position.set(0, 4, -4);
      scene.add(light3);
      const light4 = new THREE.PointLight(0xffffff, 1.4, 30);
      light4.position.set(0, 0, 6);
      scene.add(light4);

      const resize = () => {
        if (!renderer || !container) return;
        const { clientWidth, clientHeight } = container;
        if (clientWidth === 0 || clientHeight === 0) return;
        renderer.setSize(clientWidth, clientHeight);
        camera.aspect = clientWidth / clientHeight;
        camera.updateProjectionMatrix();
      };
      resizeObserver = new ResizeObserver(resize);
      resizeObserver.observe(container);
      resize();

      const animate = () => {
        frameId = requestAnimationFrame(animate);
        mesh.rotation.y += 0.0035;
        mesh.updateMatrixWorld();
        updateFacetGradient(mesh.matrixWorld);
        renderer!.render(scene, camera);
      };
      animate();
    })();

    return () => {
      disposed = true;
      cancelAnimationFrame(frameId);
      resizeObserver?.disconnect();
      renderer?.dispose();
      if (container) container.replaceChildren();
    };
  }, []);

  return <div ref={containerRef} className="absolute inset-0" aria-hidden />;
}
