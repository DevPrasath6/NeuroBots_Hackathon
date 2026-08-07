import React, { useRef, useEffect } from 'react';

interface LiquidMetalCanvasProps {
  hoverCTA1: boolean;
  hoverCTA2: boolean;
  transitionProgress: number;
}

export const LiquidMetalCanvas: React.FC<LiquidMetalCanvasProps> = ({
  hoverCTA1,
  hoverCTA2,
  transitionProgress
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const uniformsRef = useRef({
    time: 0,
    mouse: { x: 0, y: 0, targetX: 0, targetY: 0 },
    scroll: 0,
    hoverCTA1: 0,
    hoverCTA2: 0,
    transition: 0
  });

  // Track cursor position
  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      const x = (e.clientX / window.innerWidth) * 2 - 1;
      const y = -(e.clientY / window.innerHeight) * 2 + 1;
      uniformsRef.current.mouse.targetX = x;
      uniformsRef.current.mouse.targetY = y;
    };
    window.addEventListener('mousemove', handleMouseMove);
    return () => window.removeEventListener('mousemove', handleMouseMove);
  }, []);

  // Track scroll position
  useEffect(() => {
    const handleScroll = () => {
      const scrollPercent = window.scrollY / (document.documentElement.scrollHeight - window.innerHeight || 1);
      uniformsRef.current.scroll = scrollPercent;
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  // Sync animation states
  useEffect(() => {
    uniformsRef.current.hoverCTA1 = hoverCTA1 ? 1.0 : 0.0;
  }, [hoverCTA1]);

  useEffect(() => {
    uniformsRef.current.hoverCTA2 = hoverCTA2 ? 1.0 : 0.0;
  }, [hoverCTA2]);

  useEffect(() => {
    uniformsRef.current.transition = transitionProgress;
  }, [transitionProgress]);

  // WebGL Setup and Loop
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    if (!gl) {
      console.warn('WebGL is not supported in this browser.');
      return;
    }

    // Vertex shader
    const vsSource = `
      attribute vec2 aPosition;
      varying vec2 vUv;
      void main() {
        vUv = aPosition * 0.5 + 0.5;
        // Flip Y for texture loading standard orientation
        vUv.y = 1.0 - vUv.y;
        gl_Position = vec4(aPosition, 0.0, 1.0);
      }
    `;

    // Fragment shader (Loads the image texture and applies PBR-style shimmers, flow waves, and 3D parallax)
    const fsSource = `
      precision highp float;
      varying vec2 vUv;

      uniform sampler2D uTexture;
      uniform vec2 uResolution;
      uniform float uTime;
      uniform vec2 uMouse;
      uniform float uScroll;
      uniform float uHoverCTA1;
      uniform float uHoverCTA2;
      uniform float uTransition;

      // Simple 3D noise for organic flow displacement
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

      void main() {
        // Subtle 3D parallax offset based on cursor position
        vec2 parallax = uMouse * 0.016;

        // Subtle scroll parallax offset
        vec2 scrollOffset = vec2(0.0, uScroll * 0.05);

        vec2 texUv = vUv + parallax - scrollOffset;

        // Sample initial texture to detect bright metallic areas
        vec4 initialColor = texture2D(uTexture, clamp(texUv, 0.001, 0.999));
        float brightness = dot(initialColor.rgb, vec3(0.299, 0.587, 0.114));

        // Apply a flowing wave distortion ONLY to the bright metallic regions of the torus
        float wave = noise3D(vec3(vUv * 6.5, uTime * 0.12));
        vec2 flowOffset = vec2(cos(wave), sin(wave)) * 0.007 * smoothstep(0.4, 0.8, brightness);

        // Re-sample the texture with the flow wave offset applied
        vec4 finalColor = texture2D(uTexture, clamp(texUv + flowOffset, 0.001, 0.999));

        // Calculate dynamic specular light shimmers on the metal parts
        vec2 lightUv = uMouse * 0.4 + 0.5;
        float distToLight = length(vUv - lightUv);
        float shimmer = smoothstep(0.35, 0.0, distToLight);

        // Add soft orange light reflections (Molten highlight) on the metallic torus
        vec3 orangeHighlight = vec3(1.0, 0.5, 0.08) * pow(shimmer, 4.0) * 0.38 * smoothstep(0.45, 0.85, brightness);

        // Add pulsating cyan energy veins along the metallic elements
        float pulse = sin(uTime * 1.8 + vUv.y * 15.0) * 0.5 + 0.5;
        vec3 cyanVeins = vec3(0.0, 0.85, 1.0) * pulse * 0.22 * smoothstep(0.55, 0.9, brightness);

        // Extra hover button ripples
        float hoverRipple = sin(length(vUv - vec2(0.5, 0.75)) * 25.0 - uTime * 8.0) * 0.04 * uHoverCTA1;
        finalColor += texture2D(uTexture, clamp(texUv + flowOffset + hoverRipple, 0.001, 0.999)) * uHoverCTA1 * 0.15;

        // Combine base color and dynamic highlights
        finalColor.rgb += orangeHighlight + cyanVeins;

        // Handle particles dissolve transition on click
        if (uTransition > 0.001) {
          float dissolve = noise3D(vec3(vUv * 16.0, uTime * 2.5));
          if (dissolve < uTransition) {
            discard;
          }
          finalColor.a *= (1.0 - uTransition);
        }

        gl_FragColor = finalColor;
      }
    `;

    // Compile helper
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

    // Set up full screen quad
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

    // Attributes and Uniforms
    const aPosition = gl.getAttribLocation(program, 'aPosition');
    const uResolution = gl.getUniformLocation(program, 'uResolution');
    const uTime = gl.getUniformLocation(program, 'uTime');
    const uMouse = gl.getUniformLocation(program, 'uMouse');
    const uScroll = gl.getUniformLocation(program, 'uScroll');
    const uHoverCTA1 = gl.getUniformLocation(program, 'uHoverCTA1');
    const uHoverCTA2 = gl.getUniformLocation(program, 'uHoverCTA2');
    const uTransition = gl.getUniformLocation(program, 'uTransition');
    const uTexture = gl.getUniformLocation(program, 'uTexture');

    // Create and configure texture
    const texture = gl.createTexture();
    gl.bindTexture(gl.TEXTURE_2D, texture);

    // Initial 1x1 dummy pixel to prevent WebGL warnings before load
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 1, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, new Uint8Array([10, 15, 25, 255]));

    // Load Cloudinary image
    const image = new Image();
    image.crossOrigin = 'anonymous';
    image.onload = () => {
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, image);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    };
    image.src = "https://res.cloudinary.com/vple2ht3/image/upload/v1786095202/ChatGPT_Image_Aug_7_2026_03_01_40_PM_g7rjre.png";

    // Resize handler
    const resize = () => {
      canvas.width = canvas.clientWidth;
      canvas.height = canvas.clientHeight;
      gl.viewport(0, 0, canvas.width, canvas.height);
    };
    resize();
    window.addEventListener('resize', resize);

    // Render loop
    let animId = 0;
    let time = 0;
    let currentX = 0;
    let currentY = 0;

    const render = () => {
      time += 0.0166;
      animId = requestAnimationFrame(render);

      // Smooth lerp mouse coordinates
      const tMouse = uniformsRef.current.mouse;
      currentX += (tMouse.targetX - currentX) * 0.07;
      currentY += (tMouse.targetY - currentY) * 0.07;

      gl.clearColor(0.04, 0.06, 0.1, 1.0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);

      // Bind quad buffer
      gl.enableVertexAttribArray(aPosition);
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);

      // Bind texture
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, texture);
      gl.uniform1i(uTexture, 0);

      // Set uniforms
      gl.uniform2f(uResolution, canvas.width, canvas.height);
      gl.uniform1f(uTime, time);
      gl.uniform2f(uMouse, currentX, currentY);
      gl.uniform1f(uScroll, uniformsRef.current.scroll);
      gl.uniform1f(uHoverCTA1, uniformsRef.current.hoverCTA1);
      gl.uniform1f(uHoverCTA2, uniformsRef.current.hoverCTA2);
      gl.uniform1f(uTransition, uniformsRef.current.transition);

      gl.drawArrays(gl.TRIANGLES, 0, 6);
    };
    render();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
      gl.deleteBuffer(buffer);
      gl.deleteTexture(texture);
      gl.deleteProgram(program);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="absolute inset-0 w-full h-full object-cover select-none pointer-events-none z-0"
    />
  );
};
