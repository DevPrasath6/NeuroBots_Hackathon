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

    // 3. Construct base high-resolution Sphere Geometry for the Molten Droplet
    const geom = new THREE.SphereGeometry(0.85, 128, 128);

    // Uniforms mapping time for breathing and ripple shaders
    const uniforms = {
      uTime: { value: 0.0 }
    };

    // 4. Mirror Chrome PBR Material configuration
    const material = new THREE.MeshPhysicalMaterial({
      color: 0xdddddd,
      metalness: 1.0,
      roughness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      envMap: envMap,
      envMapIntensity: 2.2,
      shadowSide: THREE.DoubleSide
    });

    // Custom shader compile modification to inject Simplex noise and displace vertices/normals
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = uniforms.uTime;
      
      shader.vertexShader = `
        uniform float uTime;
        
        // Simplex 3D Noise generator by Ashima Arts / Ian McEwan
        vec4 permute(vec4 x){return mod(((x*34.0)+1.0)*x, 289.0);}
        vec4 taylorInvSqrt(vec4 r){return 1.79284291400159 - 0.85373472095314 * r;}

        float snoise(vec3 v){
          const vec2  C = vec2(1.0/6.0, 1.0/3.0) ;
          const vec4  D = vec4(0.0, 0.5, 1.0, 2.0);

          vec3 i  = floor(v + dot(v, C.yyy) );
          vec3 x0 =   v - i + dot(i, C.xxx) ;

          vec3 g = step(x0.yzx, x0.xyz);
          vec3 l = 1.0 - g;
          vec3 i1 = min( g.xyz, l.zxy );
          vec3 i2 = max( g.xyz, l.zxy );

          vec3 x1 = x0 - i1 + 1.0 * C.xxx;
          vec3 x2 = x0 - i2 + 2.0 * C.xxx;
          vec3 x3 = x0 - 1.0 + 3.0 * C.xxx;

          i = mod(i, 289.0 );
          vec4 p = permute( permute( permute(
                     i.z + vec4(0.0, i1.z, i2.z, 1.0 ))
                   + i.y + vec4(0.0, i1.y, i2.y, 1.0 ))
                   + i.x + vec4(0.0, i1.x, i2.x, 1.0 ));

          float n_ = 0.142857142857; // 1.0/7.0
          vec3  ns = n_ * D.wyz - D.xzx;

          vec4 j = p - 49.0 * floor(p * ns.z *ns.z);

          vec4 x_ = floor(j * ns.z);
          vec4 y_ = floor(j - 7.0 * x_ );

          vec4 x = x_ *ns.x + ns.yyyy;
          vec4 y = y_ *ns.x + ns.yyyy;
          vec4 h = 1.0 - abs(x) - abs(y);

          vec4 b0 = vec4( x.xy, y.xy );
          vec4 b1 = vec4( x.zw, y.zw );

          vec4 s0 = floor(b0)*2.0 + 1.0;
          vec4 s1 = floor(b1)*2.0 + 1.0;
          vec4 sh = -step(h, vec4(0.0));

          vec4 a0 = b0.xzyw + s0.xzyw*sh.xxyy ;
          vec4 a1 = b1.xzyw + s1.xzyw*sh.zzww ;

          vec3 p0 = vec3(a0.xy,h.x);
          vec3 p1 = vec3(a0.zw,h.y);
          vec3 p2 = vec3(a1.xy,h.z);
          vec3 p3 = vec3(a1.zw,h.w);

          vec4 norm = taylorInvSqrt(vec4(dot(p0,p0), dot(p1,p1), dot(p2, p2), dot(p3,p3)));
          p0 *= norm.x;
          p1 *= norm.y;
          p2 *= norm.z;
          p3 *= norm.w;

          vec4 m = max(0.6 - vec4(dot(x0,x0), dot(x1,x1), dot(x2,x2), dot(x3,x3)), 0.0);
          m = m * m;
          return 42.0 * dot( m*m, vec4( dot(p0,x0), dot(p1,x1),
                                        dot(p2,x2), dot(p3,x3) ) );
        }

        // Compute organic surface breathing, deformation, and high viscosity flowing ripples
        vec3 displace(vec3 p, float t) {
            // Low-frequency organic blobbiness (merges droplets together asymmetry)
            float blob = snoise(p * 1.5) * 0.35;
            // Extremely slow breathing cycle
            float breathe = snoise(p * 1.1 + vec3(0.0, t * 0.08, 0.0)) * 0.05;
            // Tiny surface ripples
            float ripple = snoise(p * 6.5 + vec3(0.0, 0.0, t * 0.15)) * 0.012;
            return p + normalize(p) * (blob + breathe + ripple);
        }
      ` + shader.vertexShader;
      
      shader.vertexShader = shader.vertexShader.replace(
        '#include <beginnormal_vertex>',
        `
        #include <beginnormal_vertex>
        
        // Approximate normals of displaced organic surface using neighboring points
        vec3 tangent = vec3(1.0, 0.0, 0.0);
        if (abs(objectNormal.x) > 0.9) tangent = vec3(0.0, 1.0, 0.0);
        vec3 bitangent = normalize(cross(objectNormal, tangent));
        tangent = normalize(cross(bitangent, objectNormal));

        float epsilon = 0.01;
        vec3 p1 = position + tangent * epsilon;
        vec3 p2 = position + bitangent * epsilon;

        vec3 dp = displace(position, uTime);
        vec3 dp1 = displace(p1, uTime);
        vec3 dp2 = displace(p2, uTime);

        objectNormal = normalize(cross(dp1 - dp, dp2 - dp));
        `
      );
      
      shader.vertexShader = shader.vertexShader.replace(
        '#include <begin_vertex>',
        `
        #include <begin_vertex>
        transformed = displace(position, uTime);
        `
      );
    };

    const sculptureMesh = new THREE.Mesh(geom, material);
    scene.add(sculptureMesh);

    // 5. Add Cinematic Lights in the main scene
    const ambientLight = new THREE.AmbientLight(0x0a0c10);
    scene.add(ambientLight);

    const dirLight1 = new THREE.DirectionalLight(0x00dfff, 4.0); // Cinematic blue rim light
    dirLight1.position.set(-6, -2, 4);
    scene.add(dirLight1);

    const dirLight2 = new THREE.DirectionalLight(0xff5500, 3.5); // Orange furnace rim light
    dirLight2.position.set(6, 4, 3);
    scene.add(dirLight2);

    const dirLight3 = new THREE.DirectionalLight(0xffffff, 3.0); // White key light for highlights
    dirLight3.position.set(0, 10, 0);
    scene.add(dirLight3);

    // 6. Add Faint Floating Dust Particles for background ambient highlights
    const particleCount = 35;
    const particleGeo = new THREE.BufferGeometry();
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities: number[] = [];

    for (let i = 0; i < particleCount; i++) {
      particlePositions[i * 3] = (Math.random() - 0.5) * 4.0;
      particlePositions[i * 3 + 1] = (Math.random() - 0.5) * 4.0;
      particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 3.0;
      particleVelocities.push((Math.random() - 0.5) * 0.003);
    }
    
    particleGeo.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));
    const particleMat = new THREE.PointsMaterial({
      color: 0x00dfff,
      size: 0.02,
      transparent: true,
      opacity: 0.35,
      blending: THREE.AdditiveBlending
    });
    
    const particles = new THREE.Points(particleGeo, particleMat);
    scene.add(particles);

    // 7. Resizing Observer
    const handleResize = () => {
      const w = container.clientWidth;
      const h = container.clientHeight;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    };

    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // 8. Frame loop variables
    let animId = 0;
    let time = 0;
    let currentTiltX = 0;
    let currentTiltY = 0;

    const animate = () => {
      time += 0.006; // Slow animation rate
      animId = requestAnimationFrame(animate);

      // Update shader time uniform for surface deformation
      uniforms.uTime.value = time;

      // Extremely gentle breathing vertical drift
      sculptureMesh.position.y = Math.sin(time * 0.5) * 0.04;

      // Subtle mouse tilt response (non-cumulative to prevent continuous spinning)
      const tMouse = uniformsRef.current.mouse;
      currentTiltX += (tMouse.targetY * 0.12 - currentTiltX) * 0.05;
      currentTiltY += (tMouse.targetX * 0.12 - currentTiltY) * 0.05;

      sculptureMesh.rotation.x = currentTiltX;
      sculptureMesh.rotation.y = currentTiltY;

      // Animate background highlights
      const positions = particleGeo.attributes.position.array as Float32Array;
      for (let i = 0; i < particleCount; i++) {
        positions[i * 3 + 1] += 0.0008 + Math.abs(particleVelocities[i]);
        if (positions[i * 3 + 1] > 2.0) {
          positions[i * 3 + 1] = -2.0;
        }
      }
      particleGeo.attributes.position.needsUpdate = true;

      renderer.render(scene, camera);
    };
    animate();

    // 9. Clean up references
    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      pmremGenerator.dispose();
      envMapTarget.dispose();
      geom.dispose();
      material.dispose();
      particleGeo.dispose();
      particleMat.dispose();
      renderer.dispose();
    };
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
