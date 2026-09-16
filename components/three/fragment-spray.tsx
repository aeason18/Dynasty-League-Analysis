"use client";

import { useEffect, useRef } from "react";
import { CRYSTAL_ACCENT_HEX, CRYSTAL_POP_HEX } from "@/components/three/palette";
import { withFacetGradient } from "@/components/three/facet-colors";

// [x, y, z, size, opacity, rotSpeedY, rotSpeedX] -- biggest/boldest near the
// left "origin", shrinking and fading as the debris spreads right.
const FRAGMENT_CONFIGS: [number, number, number, number, number, number, number][] = [
  [-7.5, 0.25, 0.1, 0.625, 0.55, 0.003, 0.001],
  [-5.7, -0.35, -0.2, 0.5, 0.5, -0.004, 0.002],
  [-4.02, 0.4, 0.15, 0.4125, 0.44, 0.005, -0.0015],
  [-2.34, -0.25, -0.15, 0.3375, 0.38, -0.0035, 0.0025],
  [-0.66, 0.35, 0.2, 0.275, 0.32, 0.006, -0.001],
  [1.02, -0.4, -0.1, 0.225, 0.26, -0.0045, 0.003],
  [2.7, 0.2, 0.15, 0.1875, 0.2, 0.007, -0.002],
  [4.38, -0.25, -0.15, 0.15, 0.16, -0.005, 0.0035],
];

/**
 * A horizontal spray of small rotating shards, as if a crystal shattered just
 * off the left edge -- decorative, Dashboard only. Skips mounting under
 * prefers-reduced-motion. Give the container a wide, short aspect ratio
 * (it was tuned around ~1400x260) so the full spread stays in frame.
 */
export function FragmentSpray() {
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
      camera.position.set(0, 0, 3);

      scene.add(new THREE.AmbientLight(0xffffff, 1));
      const lightA = new THREE.PointLight(CRYSTAL_ACCENT_HEX, 4, 30);
      lightA.position.set(-4, 3, 4);
      scene.add(lightA);
      const lightB = new THREE.PointLight(CRYSTAL_POP_HEX, 4.5, 30);
      lightB.position.set(4, -2, 3);
      scene.add(lightB);
      const lightC = new THREE.PointLight(0xffffff, 1.6, 30);
      lightC.position.set(0, 0, 4);
      scene.add(lightC);

      const fragments = FRAGMENT_CONFIGS.map(([x, y, z, size, opacity, rotY, rotX]) => {
        const geo = new THREE.IcosahedronGeometry(size, 0);
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
          opacity,
          transmission: 0.3,
          thickness: 0.5,
          side: THREE.DoubleSide,
        });
        const mesh = new THREE.Mesh(facetGeo, mat);
        mesh.position.set(x, y, z);
        mesh.rotation.set(Math.random() * 3, Math.random() * 3, Math.random() * 3);
        mesh.updateMatrixWorld();
        updateFacetGradient(mesh.matrixWorld);
        const edges = new THREE.LineSegments(
          new THREE.EdgesGeometry(geo),
          new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.2 })
        );
        mesh.add(edges);
        scene.add(mesh);
        return { mesh, rotY, rotX, updateFacetGradient };
      });

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
        for (const f of fragments) {
          f.mesh.rotation.y += f.rotY;
          f.mesh.rotation.x += f.rotX;
          f.mesh.updateMatrixWorld();
          f.updateFacetGradient(f.mesh.matrixWorld);
        }
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
