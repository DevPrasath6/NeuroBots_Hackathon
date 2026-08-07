import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';

export const MoltenSculptureCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const uniformsRef = useRef({
    mouse: { x: 0, y: 0, targetX: 0, targetY: 0 }
  });

  // Track mouse coordinates for smooth 3D tilt interaction
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    uniformsRef.current.mouse.targetX = x;
    uniformsRef.current.mouse.targetY = y;
  };

  const handleMouseLeave = () => {
    uniformsRef.current.mouse.targetX = 0;
    uniformsRef.current.mouse.targetY = 0;
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    // 1. Create Scene, Camera, and WebGL Renderer
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(0, 0, 3.8);

    const renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance'
    });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setClearColor(0x000000, 0); // Transparent background to blend cleanly
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.25;

    // 2. Generate Dynamic PMREM Environment Map (Chrome reflections)
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();

    const envScene = new THREE.Scene();
    
    // Add dark background shell
    const bgSphere = new THREE.Mesh(
      new THREE.SphereGeometry(15, 16, 16),
      new THREE.MeshBasicMaterial({ color: 0x030508, side: THREE.BackSide })
    );
    envScene.add(bgSphere);

    // Add glowing cyan reflective lights in env map
    const lightGeo = new THREE.SphereGeometry(1.5, 16, 16);
    const cyanLightMesh = new THREE.Mesh(
      lightGeo,
      new THREE.MeshBasicMaterial({ color: 0x00dfff })
    );
    cyanLightMesh.position.set(-6, -4, -4);
    envScene.add(cyanLightMesh);

    // Add glowing orange reflective lights in env map
    const orangeLightMesh = new THREE.Mesh(
      lightGeo,
      new THREE.MeshBasicMaterial({ color: 0xff5500 })
    );
    orangeLightMesh.position.set(6, 6, -4);
    envScene.add(orangeLightMesh);

    // Add bright white light on top
    const whiteLightMesh = new THREE.Mesh(
      lightGeo,
      new THREE.MeshBasicMaterial({ color: 0xffffff })
    );
    whiteLightMesh.position.set(0, 10, 0);
    envScene.add(whiteLightMesh);

    const envMapTarget = pmremGenerator.fromScene(envScene);
    const envMap = envMapTarget.texture;

    // 3. Construct Custom 3D Parametric Ribbon Geometry (Trefoil Knot-based curves)
    const numPoints = 120;
    const curvePoints: THREE.Vector3[] = [];
    
    for (let i = 0; i <= numPoints; i++) {
      const t = (i / numPoints) * Math.PI * 2;
      // Trefoil-knot math loop
      const x = Math.sin(t) + 1.8 * Math.sin(2 * t);
      const y = Math.cos(t) - 1.8 * Math.cos(2 * t);
      const z = -Math.sin(3 * t) * 1.1;
      
      // Scaling down to center inside container nicely
      curvePoints.push(new THREE.Vector3(x * 0.44, y * 0.44, z * 0.44));
    }

    const curve = new THREE.CatmullRomCurve3(curvePoints, true);

    // Build ribbon buffer vertices
    const radialSegments = 16;
    const tubularSegments = 160;
    const geom = new THREE.BufferGeometry();
    const vertices: number[] = [];
    const normals: number[] = [];
    const uvs: number[] = [];
    const indices: number[] = [];

    // Calculate tangent frames along the loop
    const frames = curve.computeFrenetFrames(tubularSegments, true);

    for (let i = 0; i <= tubularSegments; i++) {
      const t = i / tubularSegments;
      const point = curve.getPointAt(t);

      const normal = frames.normals[i];
      const binormal = frames.binormals[i];

      // VARYING THICKNESS: swell and shrink along the loop to look organic
      const thicknessScale = 1.0 + 0.45 * Math.sin(t * Math.PI * 6);
      const width = 0.28 * thicknessScale;
      const height = 0.05 * thicknessScale;

      for (let j = 0; j < radialSegments; j++) {
        const rad = (j / radialSegments) * Math.PI * 2;
        const cosRad = Math.cos(rad);
        const sinRad = Math.sin(rad);

        const offset = new THREE.Vector3()
          .addScaledVector(normal, cosRad * width)
          .addScaledVector(binormal, sinRad * height);

        const vertex = new THREE.Vector3().copy(point).add(offset);
        vertices.push(vertex.x, vertex.y, vertex.z);

        const vertexNormal = offset.clone().normalize();
        normals.push(vertexNormal.x, vertexNormal.y, vertexNormal.z);

        uvs.push(t, j / radialSegments);
      }
    }

    // Generate indices mapping triangles
    for (let i = 0; i < tubularSegments; i++) {
      for (let j = 0; j < radialSegments; j++) {
        const nextJ = (j + 1) % radialSegments;

        const current = i * radialSegments + j;
        const next = i * radialSegments + nextJ;
        const currentNext = (i + 1) * radialSegments + j;
        const nextNext = (i + 1) * radialSegments + nextJ;

        indices.push(current, next, currentNext);
        indices.push(next, nextNext, currentNext);
      }
    }

    geom.setAttribute('position', new THREE.Float32BufferAttribute(vertices, 3));
    geom.setAttribute('normal', new THREE.Float32BufferAttribute(normals, 3));
    geom.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geom.setIndex(indices);

    // 4. Mirror Chrome PBR Material configuration
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xdddddd,
      metalness: 1.0,
      roughness: 0.03,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      envMap: envMap,
      envMapIntensity: 1.8,
      shadowSide: THREE.DoubleSide
    });

    const sculptureMesh = new THREE.Mesh(geom, material);
    scene.add(sculptureMesh);

    // 5. Add Cinematic Lights in the main scene
    const ambientLight = new THREE.AmbientLight(0x0c1015);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x00dfff, 3.5); // Cyan key light
    dirLight1.position.set(-5, -2, 5);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xff6600, 2.5); // Orange fill light
    dirLight2.position.set(5, 5, 5);
    scene.add(dirLight2);

    const dirLight3 = new THREE.DirectionalLight(0xffffff, 4.0); // White key specular
    dirLight3.position.set(0, 8, -2);
    scene.add(dirLight3);

    // 6. Add Holographic HUD rings behind the sculpture
    const createRing = (radius: number, segments: number, color: number) => {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= segments; i++) {
        const theta = (i / segments) * Math.PI * 2;
        points.push(new THREE.Vector3(Math.cos(theta) * radius, Math.sin(theta) * radius, 0));
      }
      const ringGeo = new THREE.BufferGeometry().setFromPoints(points);
      const ringMat = new THREE.LineBasicMaterial({
        color: color,
        transparent: true,
        opacity: 0.22,
        blending: THREE.AdditiveBlending
      });
      const ring = new THREE.Line(ringGeo, ringMat);
      ring.position.z = -0.9;
      return ring;
    };

    const hudRing1 = createRing(1.3, 64, 0x00dfff);
    const hudRing2 = createRing(1.6, 64, 0x3b82f6);
    scene.add(hudRing1);
    scene.add(hudRing2);

    // 7. Add Floating Dust Particles (Metallic glints)
    const particleCount = 50;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities: number[] = [];

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 4.5;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 4.5;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 3.5;
      particleVelocities.push((Math.random() - 0.5) * 0.005);
    }
    
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x00dfff,
      size: 0.03,
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending
    });
    
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // 8. Resizing Observer
    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 9. Frame loop variables
    let animId = 0;
    let time = 0;
    let currentTiltX = 0;
    let currentTiltY = 0;

    const animate = () => {
      time += 0.01;
      animId = requestAnimationFrame(animate);

      // Smooth float Y oscillation
      sculptureMesh.position.y = Math.sin(time * 0.45) * 0.08;

      // Smooth slow background auto-rotation
      sculptureMesh.rotation.y = time * 0.07;
      sculptureMesh.rotation.x = Math.sin(time * 0.22) * 0.06;

      // Smooth mouse tilting
      const tMouse = uniformsRef.current.mouse;
      currentTiltX += (tMouse.targetY * 0.15 - currentTiltX) * 0.06;
      currentTiltY += (tMouse.targetX * 0.15 - currentTiltY) * 0.06;

      sculptureMesh.rotation.x += currentTiltX;
      sculptureMesh.rotation.y += currentTiltY;

      // Rotate HUD rings
      hudRing1.rotation.z = time * 0.08;
      hudRing2.rotation.z = -time * 0.04;

      // Animate floating particles
      const positions = particleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3 + 1] += 0.0012 + Math.abs(particleVelocities[i]);
        if (positions[i * 3 + 1] > 2.2) {
          positions[i * 3 + 1] = -2.2;
        }
      }
      particleGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };
    animate();

    // 10. Clean up references
    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      pmremGenerator.dispose();
      envMapTarget.dispose();
      geom.dispose();
      material.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      ringGeoCleanUp(hudRing1);
      ringGeoCleanUp(hudRing2);
      renderer.dispose();
    };

    function ringGeoCleanUp(ringMesh: THREE.Line) {
      ringMesh.geometry.dispose();
      if (Array.isArray(ringMesh.material)) {
        ringMesh.material.forEach(m => m.dispose());
      } else {
        ringMesh.material.dispose();
      }
    }
  }, []);

  return (
    <div ref={containerRef} className="w-full h-full min-h-[450px] relative flex items-center justify-center">
      <canvas
        ref={canvasRef}
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
        className="w-full h-full max-h-[550px] aspect-square cursor-pointer select-none pointer-events-auto"
      />
    </div>
  );
};
