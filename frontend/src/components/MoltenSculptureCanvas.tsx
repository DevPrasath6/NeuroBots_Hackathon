import React, { useRef, useEffect } from 'react';

export const MoltenSculptureCanvas: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const uniformsRef = useRef({
    time: 0,
    mouse: { x: 0, y: 0, targetX: 0, targetY: 0 }
  });

  // Track mouse coordinates over the canvas for subtle parallax tilting
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

    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      console.warn('WebGL is not supported inside this component.');
      return;
    }

    // Vertex shader source
    const vsSource = `
      attribute vec2 aPosition;
      varying vec2 vUv;
      void main() {
        vUv = aPosition * 0.5 + 0.5;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    // Fragment shader source (Raymarching PBR metallic sculpture with environment reflections)
    const fsSource = `
      precision highp float;
      varying vec2 vUv;

      uniform vec2 uResolution;
      uniform float uTime;
      uniform vec2 uMouse;

      // 3D Simplex-style noise for volumetric reflections
      float hash(vec3 p) {
        p = fract(p * vec3(443.897, 441.423, 437.195));
        p += dot(p, p.yzx + 19.19);
        return fract((p.x + p.y) * p.z);
      }
      
      float noise3D(vec3 x) {
        vec3 p = floor(x);
        vec3 f = fract(x);
        f = f*f*(3.0-2.0*f);
        return mix(mix(mix(hash(p+vec3(0,0,0)), hash(p+vec3(1,0,0)), f.x),
                       mix(hash(p+vec3(0,1,0)), hash(p+vec3(1,1,0)), f.x), f.y),
                   mix(mix(hash(p+vec3(0,0,1)), hash(p+vec3(1,0,1)), f.x),
                       mix(hash(p+vec3(0,1,1)), hash(p+vec3(1,1,1)), f.x), f.y), f.z);
      }

      float envReflection(vec3 r) {
        float val = noise3D(r * 2.5 + vec3(uTime * 0.07));
        return 0.45 + 0.55 * val;
      }

      // Torus SDF definition (t.x = major radius, t.y = minor thickness)
      float sdTorus(vec3 p, vec2 t) {
        vec2 q = vec2(length(p.xz) - t.x, p.y);
        return length(q) - t.y;
      }

      // SDF Map function defining the twisting ribbon sculpture
      float map(vec3 p) {
        vec3 p1 = p;
        
        // Continuous organic slow floating and spinning
        float rotY = uTime * 0.16 + uMouse.x * 0.22;
        float cy = cos(rotY);
        float sy = sin(rotY);
        p1.xz = mat2(cy, -sy, sy, cy) * p1.xz;

        float rotX = sin(uTime * 0.1) * 0.12 + uMouse.y * 0.22;
        float cx = cos(rotX);
        float sx = sin(rotX);
        p1.yz = mat2(cx, -sx, sx, cx) * p1.yz;

        // Elegant Torus loop profile
        float d = sdTorus(p1, vec2(1.15, 0.22));

        // Organic waves twisting details
        float twist = sin(p1.x * 3.5 + uTime * 0.4) * cos(p1.y * 3.5 + uTime * 0.6) * 0.08;
        d += twist;

        // Subtract interior core to create a hollow engineered shell
        float hollow = length(p1.xy) - 0.72;
        d = max(d, -hollow);

        return d;
      }

      vec3 getNormal(vec3 p) {
        vec2 e = vec2(0.005, 0.0);
        return normalize(vec3(
          map(p + e.xyy) - map(p - e.xyy),
          map(p + e.yxy) - map(p - e.yxy),
          map(p + e.yyx) - map(p - e.yyx)
        ));
      }

      void main() {
        // Center aspect ratio normalized coordinates
        vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
        
        // Ray origin & direction
        vec3 ro = vec3(0.0, 0.0, -3.0);
        vec3 rd = normalize(vec3(uv, 1.2));
        
        float t = 0.0;
        bool hit = false;
        vec3 p;

        for (int i = 0; i < 60; i++) {
          p = ro + t * rd;
          float d = map(p);
          if (d < 0.001) {
            hit = true;
            break;
          }
          t += d;
          if (t > 5.0) break;
        }

        vec3 color;

        if (hit) {
          vec3 n = getNormal(p);
          vec3 viewDir = -rd;
          vec3 reflectDir = reflect(rd, n);
          float fresnel = pow(1.0 - max(dot(n, viewDir), 0.0), 3.8);

          // Polished mirror chrome environment base
          vec3 chromeColor = vec3(0.85, 0.88, 0.94) * envReflection(reflectDir);

          // Molten Orange highlight from top-right source
          vec3 lightDir1 = normalize(vec3(4.0, 4.0, -3.0));
          float spec1 = pow(max(dot(reflectDir, lightDir1), 0.0), 32.0);
          vec3 moltenGlow = vec3(1.0, 0.45, 0.08) * spec1 * 1.6;

          // Electric Cyan highlight from bottom-left source
          vec3 lightDir2 = normalize(vec3(-4.0, -3.0, -2.0));
          float spec2 = pow(max(dot(reflectDir, lightDir2), 0.0), 64.0);
          vec3 cyanGlow = vec3(0.0, 0.85, 1.0) * spec2 * 2.2;

          // White specular key highlight
          float spec3 = pow(max(dot(reflectDir, normalize(vec3(0.0, 5.0, 0.0))), 0.0), 128.0);
          vec3 silverHighlight = vec3(0.95, 0.98, 1.0) * spec3 * 2.5;

          // Glowing energy veins running along the hollow sculpture interior
          float veins = noise3D(p * 5.0 + vec3(0.0, uTime * 0.6, 0.0));
          veins = smoothstep(0.48, 0.65, veins);
          vec3 energyVeins = vec3(0.0, 0.85, 1.0) * veins * 0.85;

          color = chromeColor + energyVeins;
          color = mix(color, vec3(0.92, 0.96, 1.0), fresnel * 0.58);
          color += moltenGlow + cyanGlow + silverHighlight;
        } else {
          // Keep base space transparent/very dark to blend with landing page background
          color = vec3(0.0, 0.0, 0.0);

          // Add rotating digital twin holographic rings behind the sculpture
          float r_dist = length(uv);
          float hud1 = smoothstep(0.005, 0.0, abs(r_dist - 0.72));
          float hud2 = smoothstep(0.004, 0.0, abs(r_dist - 0.90));
          float hud3 = smoothstep(0.003, 0.0, abs(r_dist - 0.45));
          
          float angle = atan(uv.y, uv.x);
          float dash1 = step(0.18, sin(angle * 8.0 + uTime * 0.35));
          float dash2 = step(0.3, sin(angle * 12.0 - uTime * 0.5));
          
          vec3 hudColor = vec3(0.0, 0.55, 0.8) * (hud1 * dash1 + hud2 * dash2 + hud3 * 0.35);
          color += hudColor;

          // Add tiny drifting reflective metallic spheres/particles
          float particles = 0.0;
          for (int j = 0; j < 8; j++) {
            vec2 pPos = vec2(
              sin(uTime * 0.18 + float(j) * 1.5) * 0.8, 
              cos(uTime * 0.28 + float(j) * 2.0) * 0.6
            );
            float size = 0.005 + 0.0025 * sin(uTime * 1.5 + float(j));
            particles += smoothstep(size, 0.0, length(uv - pPos)) * (0.6 + 0.4 * sin(uTime * 2.2 + float(j)));
          }
          color += vec3(0.0, 0.85, 1.0) * particles * 0.65;
        }

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    // Compile helpers
    const compileShader = (type: number, source: string) => {
      const shader = gl.createShader(type);
      if (!shader) return null;
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        console.error('Shader compile error:', gl.getShaderInfoLog(shader));
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const vs = compileShader(gl.VERTEX_SHADER, vsSource);
    const fs = compileShader(gl.FRAGMENT_SHADER, fsSource);
    if (!vs || !fs) return;

    const program = gl.createProgram();
    if (!program) return;
    gl.attachShader(program, vs);
    gl.attachShader(program, fs);
    gl.linkProgram(program);

    if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
      console.error('Program link error:', gl.getProgramInfoLog(program));
      return;
    }

    const vertices = new Float32Array([
      -1.0, -1.0,
       1.0, -1.0,
      -1.0,  1.0,
      -1.0,  1.0,
       1.0, -1.0,
       1.0,  1.0
    ]);

    const buffer = gl.createBuffer();
    gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
    gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

    const aPosition = gl.getAttribLocation(program, 'aPosition');
    const uResolution = gl.getUniformLocation(program, 'uResolution');
    const uTime = gl.getUniformLocation(program, 'uTime');
    const uMouse = gl.getUniformLocation(program, 'uMouse');

    // Canvas resizing helper
    const resize = () => {
      const dpr = window.devicePixelRatio || 1;
      const displayWidth = Math.floor(container.clientWidth * dpr);
      const displayHeight = Math.floor(container.clientHeight * dpr);

      if (canvas.width !== displayWidth || canvas.height !== displayHeight) {
        canvas.width = displayWidth;
        canvas.height = displayHeight;
        gl.viewport(0, 0, canvas.width, canvas.height);
      }
    };
    resize();
    
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(container);

    // Render loop
    let animId = 0;
    let time = 0;
    let currentX = 0;
    let currentY = 0;

    const render = () => {
      time += 0.0166;
      animId = requestAnimationFrame(render);

      // Lerp mouse target for smooth trailing rotation inertia
      const tMouse = uniformsRef.current.mouse;
      currentX += (tMouse.targetX - currentX) * 0.07;
      currentY += (tMouse.targetY - currentY) * 0.07;

      gl.clearColor(0.0, 0.0, 0.0, 0.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);

      gl.enableVertexAttribArray(aPosition);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, time);
      gl.uniform2f(uMouse, currentX, currentY);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    render();

    return () => {
      cancelAnimationFrame(animId);
      resizeObserver.disconnect();
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
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
