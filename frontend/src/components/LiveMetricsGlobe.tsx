import React, { useEffect, useRef, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Globe, Satellite, Zap, Activity, Signal, Wifi, Database } from 'lucide-react';

interface DataPoint {
  id: string;
  lat: number;
  lng: number;
  value: number;
  label: string;
  color: string;
  status: 'online' | 'warning' | 'offline';
}

export const LiveMetricsGlobe = () => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dataPoints] = useState<DataPoint[]>([
    { id: '1', lat: 40.7128, lng: -74.0060, value: 94.2, label: 'New York Plant', color: '#10b981', status: 'online' },
    { id: '2', lat: 51.5074, lng: -0.1278, value: 87.5, label: 'London Facility', color: '#3b82f6', status: 'online' },
    { id: '3', lat: 35.6762, lng: 139.6503, value: 91.8, label: 'Tokyo Center', color: '#8b5cf6', status: 'online' },
    { id: '4', lat: -33.8688, lng: 151.2093, value: 89.3, label: 'Sydney Hub', color: '#f59e0b', status: 'warning' },
    { id: '5', lat: 52.5200, lng: 13.4050, value: 92.1, label: 'Berlin Unit', color: '#ef4444', status: 'warning' },
    { id: '6', lat: 37.7749, lng: -122.4194, value: 96.7, label: 'SF Research', color: '#06b6d4', status: 'online' },
  ]);

  const [metrics, setMetrics] = useState({
    globalEfficiency: 91.2,
    activeFurnaces: 47,
    totalProduction: 12847,
    qualityScore: 94.8,
    dataTransfer: 2.4,
    uptime: 99.97
  });

  const uniformsRef = useRef({
    time: 0,
    mouse: { x: 0, y: 0, targetX: 0, targetY: 0 }
  });

  // Track relative canvas mouse movements for elegant parallax
  const handleMouseMove = (e: React.MouseEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    uniformsRef.current.mouse.targetX = x;
    uniformsRef.current.mouse.targetY = y;
  };

  // Compile WebGL context and run the PBR torus sculpture shader loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      console.warn('WebGL is not supported in this container.');
      return;
    }

    // Vertex shader code
    const vsSource = `
      attribute vec2 aPosition;
      varying vec2 vUv;
      void main() {
        vUv = aPosition * 0.5 + 0.5;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    // Fragment shader (Custom raymarching molten steel sculpture with HUD circles and metal stars)
    const fsSource = `
      precision highp float;
      varying vec2 vUv;

      uniform vec2 uResolution;
      uniform float uTime;
      uniform vec2 uMouse;

      // 3D Simplex-style noise for organic material flows
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
        float val = noise3D(r * 2.5 + vec3(uTime * 0.08));
        return 0.45 + 0.55 * val;
      }

      // Torus SDF loop (t.x = major radius, t.y = minor thickness)
      float sdTorus(vec3 p, vec2 t) {
        vec2 q = vec2(length(p.xz) - t.x, p.y);
        return length(q) - t.y;
      }

      // SDF Map function defining the twisting ribbon sculpture
      float map(vec3 p) {
        vec3 p1 = p;
        
        // Dynamic slow continuous breathing spin
        float rotY = uTime * 0.22 + uMouse.x * 0.25;
        float cy = cos(rotY);
        float sy = sin(rotY);
        p1.xz = mat2(cy, -sy, sy, cy) * p1.xz;

        float rotX = sin(uTime * 0.12) * 0.15 + uMouse.y * 0.25;
        float cx = cos(rotX);
        float sx = sin(rotX);
        p1.yz = mat2(cx, -sx, sx, cx) * p1.yz;

        // Elegant Torus loop profile
        float d = sdTorus(p1, vec2(1.15, 0.22));

        // Organic waves twisting details
        float twist = sin(p1.x * 3.5 + uTime * 0.5) * cos(p1.y * 3.5 + uTime * 0.7) * 0.08;
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
        // Aspect ratio correction
        vec2 uv = (gl_FragCoord.xy - 0.5 * uResolution.xy) / uResolution.y;
        
        // Ray setup
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

          // Polished mirror chrome PBR highlights
          vec3 chromeColor = vec3(0.85, 0.88, 0.94) * envReflection(reflectDir);

          // Specular highlights:
          // Molten Orange glow from top-right source
          vec3 lightDir1 = normalize(vec3(4.0, 4.0, -3.0));
          float spec1 = pow(max(dot(reflectDir, lightDir1), 0.0), 32.0);
          vec3 moltenGlow = vec3(1.0, 0.45, 0.08) * spec1 * 1.5;

          // Electric Cyan glow from bottom-left source
          vec3 lightDir2 = normalize(vec3(-4.0, -3.0, -2.0));
          float spec2 = pow(max(dot(reflectDir, lightDir2), 0.0), 64.0);
          vec3 cyanGlow = vec3(0.0, 0.85, 1.0) * spec2 * 2.0;

          // White specular highlight
          float spec3 = pow(max(dot(reflectDir, normalize(vec3(0.0, 5.0, 0.0))), 0.0), 128.0);
          vec3 silverHighlight = vec3(0.95, 0.98, 1.0) * spec3 * 2.5;

          // Volumetric glowing veins inside the sculpture
          float veins = noise3D(p * 5.0 + vec3(0.0, uTime * 0.7, 0.0));
          veins = smoothstep(0.48, 0.65, veins);
          vec3 energyVeins = vec3(0.0, 0.85, 1.0) * veins * 0.85;

          color = chromeColor + energyVeins;
          color = mix(color, vec3(0.92, 0.96, 1.0), fresnel * 0.58);
          color += moltenGlow + cyanGlow + silverHighlight;
        } else {
          // Draw card-matching dark space background underlay
          color = vec3(0.015, 0.025, 0.045);

          // Render digital twin concentric HUD rings
          float r_dist = length(uv);
          float hud1 = smoothstep(0.005, 0.0, abs(r_dist - 0.72));
          float hud2 = smoothstep(0.004, 0.0, abs(r_dist - 0.90));
          float hud3 = smoothstep(0.003, 0.0, abs(r_dist - 0.45));
          
          float angle = atan(uv.y, uv.x);
          float dash1 = step(0.18, sin(angle * 8.0 + uTime * 0.45));
          float dash2 = step(0.3, sin(angle * 12.0 - uTime * 0.6));
          
          vec3 hudColor = vec3(0.0, 0.55, 0.8) * (hud1 * dash1 + hud2 * dash2 + hud3 * 0.35);
          color += hudColor;

          // Render floating glinting metallic particles
          float particles = 0.0;
          for (int j = 0; j < 6; j++) {
            vec2 pPos = vec2(
              sin(uTime * 0.22 + float(j) * 1.6) * 0.75, 
              cos(uTime * 0.32 + float(j) * 2.1) * 0.55
            );
            float size = 0.006 + 0.003 * sin(uTime * 1.8 + float(j));
            particles += smoothstep(size, 0.0, length(uv - pPos)) * (0.55 + 0.45 * sin(uTime * 2.5 + float(j)));
          }
          color += vec3(0.0, 0.85, 1.0) * particles * 0.8;
        }

        gl_FragColor = vec4(color, 1.0);
      }
    `;

    // Compile helper functions
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

    // Run animation frames
    let animId = 0;
    let time = 0;
    let currentX = 0;
    let currentY = 0;

    const render = () => {
      time += 0.0166;
      animId = requestAnimationFrame(render);

      // Lerp mouse variables smoothly for inertia rotation
      const tMouse = uniformsRef.current.mouse;
      currentX += (tMouse.targetX - currentX) * 0.08;
      currentY += (tMouse.targetY - currentY) * 0.08;

      gl.viewport(0, 0, canvas.width, canvas.height);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);

      // Bind vertex attribute
      gl.enableVertexAttribArray(aPosition);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

      // Set shader values
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, time);
      gl.uniform2f(uMouse, currentX, currentY);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    render();

    return () => {
      cancelAnimationFrame(animId);
      gl.deleteBuffer(buffer);
      gl.deleteProgram(program);
    };
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMetrics(prev => ({
        globalEfficiency: Math.max(85, Math.min(98, prev.globalEfficiency + (Math.random() - 0.5) * 0.5)),
        activeFurnaces: Math.max(40, Math.min(55, prev.activeFurnaces + Math.floor((Math.random() - 0.5) * 2))),
        totalProduction: Math.max(10000, prev.totalProduction + Math.floor((Math.random() - 0.5) * 100)),
        qualityScore: Math.max(90, Math.min(99, prev.qualityScore + (Math.random() - 0.5) * 0.3)),
        dataTransfer: Math.max(1, Math.min(5, prev.dataTransfer + (Math.random() - 0.5) * 0.2)),
        uptime: Math.max(99.5, Math.min(100, prev.uptime + (Math.random() - 0.5) * 0.01))
      }));
    }, 3000);

    return () => clearInterval(interval);
  }, []);

  return (
    <Card className="bg-slate-900/95 backdrop-blur-xl border-slate-700/50 shadow-2xl shadow-cyan-500/10 overflow-hidden">
      <CardHeader className="pb-4 bg-gradient-to-r from-slate-900/90 to-slate-800/90 backdrop-blur-xl border-b border-slate-700/50">
        <CardTitle className="text-xl text-white flex items-center font-semibold">
          <div className="p-3 rounded-xl bg-gradient-to-br from-cyan-500 to-blue-600 text-white mr-3 shadow-lg shadow-cyan-500/25">
            <Globe className="h-6 w-6" />
          </div>
          <div>
            <span className="bg-gradient-to-r from-cyan-400 to-blue-400 bg-clip-text text-transparent">
              Global Operations Hub
            </span>
            <div className="text-sm text-slate-400 font-normal">Real-time Monitoring</div>
          </div>
        </CardTitle>
      </CardHeader>
      
      <CardContent className="p-8 space-y-8">
        {/* WebGL Molten Alloy Sculpture */}
        <div className="flex justify-center">
          <div className="relative">
            <canvas
              ref={canvasRef}
              width={400}
              height={300}
              onMouseMove={handleMouseMove}
              onMouseLeave={() => {
                uniformsRef.current.mouse.targetX = 0;
                uniformsRef.current.mouse.targetY = 0;
              }}
              className="rounded-2xl bg-slate-850/80 backdrop-blur-sm border border-slate-700/60 cursor-pointer shadow-[0_0_30px_rgba(0,243,255,0.05)]"
            />
            <div className="absolute top-4 right-4 flex items-center space-x-2 bg-slate-800/80 backdrop-blur-sm px-3 py-2 rounded-full border border-slate-600/50">
              <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-lg shadow-emerald-500/50"></div>
              <span className="text-xs font-medium text-emerald-400">LIVE</span>
            </div>
          </div>
        </div>

        {/* Enhanced Metrics Grid */}
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-emerald-500/10 to-green-500/10 backdrop-blur-xl p-5 rounded-2xl border border-emerald-500/20 shadow-lg shadow-emerald-500/5">
            <div className="flex items-center justify-between mb-3">
              <Activity className="h-6 w-6 text-emerald-400" />
              <span className="text-xs text-emerald-300 font-semibold bg-emerald-500/20 px-2 py-1 rounded-full">
                ↗ +2.1%
              </span>
            </div>
            <div className="text-3xl font-bold text-emerald-400 mb-1">
              {metrics.globalEfficiency.toFixed(1)}%
            </div>
            <div className="text-xs text-slate-400 font-medium font-mono">GLOBAL EFFICIENCY</div>
          </div>

          <div className="bg-gradient-to-br from-blue-500/10 to-cyan-500/10 backdrop-blur-xl p-5 rounded-2xl border border-blue-500/20 shadow-lg shadow-blue-500/5">
            <div className="flex items-center justify-between mb-3">
              <Database className="h-6 w-6 text-blue-400" />
              <span className="text-xs text-blue-300 font-semibold bg-blue-500/20 px-2 py-1 rounded-full">
                ACTIVE
              </span>
            </div>
            <div className="text-3xl font-bold text-blue-400 mb-1">
              {metrics.activeFurnaces}
            </div>
            <div className="text-xs text-slate-400 font-medium font-mono">ACTIVE FURNACES</div>
          </div>

          <div className="bg-gradient-to-br from-purple-500/10 to-pink-500/10 backdrop-blur-xl p-5 rounded-2xl border border-purple-500/20 shadow-lg shadow-purple-500/5">
            <div className="flex items-center justify-between mb-3">
              <Zap className="h-6 w-6 text-purple-400" />
              <span className="text-xs text-purple-300 font-semibold bg-purple-500/20 px-2 py-1 rounded-full">
                TONS
              </span>
            </div>
            <div className="text-3xl font-bold text-purple-400 mb-1">
              {metrics.totalProduction.toLocaleString()}
            </div>
            <div className="text-xs text-slate-400 font-medium font-mono">DAILY PRODUCTION</div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 text-sm font-mono text-slate-300 border-t border-slate-800/80 pt-6">
          <div className="flex items-center justify-between p-3.5 bg-slate-950/30 rounded-xl border border-slate-800/60">
            <div className="flex items-center">
              <Signal className="h-4 w-4 mr-2 text-cyan-400" />
              <span>QUALITY SCORE</span>
            </div>
            <span className="text-white font-bold">{metrics.qualityScore.toFixed(1)}%</span>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-slate-950/30 rounded-xl border border-slate-800/60">
            <div className="flex items-center">
              <Wifi className="h-4 w-4 mr-2 text-cyan-400" />
              <span>DATA BANDWIDTH</span>
            </div>
            <span className="text-white font-bold">{metrics.dataTransfer.toFixed(1)} GB/s</span>
          </div>

          <div className="flex items-center justify-between p-3.5 bg-slate-950/30 rounded-xl border border-slate-800/60 lg:col-span-2">
            <div className="flex items-center">
              <Satellite className="h-4 w-4 mr-2 text-cyan-400" />
              <span>TELEMETRY UPTIME</span>
            </div>
            <span className="text-emerald-400 font-bold">{metrics.uptime.toFixed(2)}%</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
