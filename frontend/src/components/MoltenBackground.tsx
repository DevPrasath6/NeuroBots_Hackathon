import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  pulseSpeed: number;
  pulsePhase: number;
  type: 'atom' | 'lattice' | 'bond';
  charge: number;
}

export const MoltenBackground: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const particles: Particle[] = [];
    const particleCount = Math.min(60, Math.floor((width * height) / 25000));

    // Elements colors
    const colors = [
      'rgba(0, 243, 255, 0.25)', // Cyan (Electric)
      'rgba(56, 189, 248, 0.2)',  // Steel Blue
      'rgba(255, 107, 0, 0.15)',  // Molten Orange
      'rgba(148, 163, 184, 0.15)', // Titanium Gray
    ];

    // Generate random particle settings
    for (let i = 0; i < particleCount; i++) {
      const typeRand = Math.random();
      const type: 'atom' | 'lattice' | 'bond' = 
        typeRand < 0.3 ? 'atom' : typeRand < 0.8 ? 'lattice' : 'bond';

      particles.push({
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        size: Math.random() * 3 + (type === 'atom' ? 2 : 1),
        color: colors[Math.floor(Math.random() * colors.length)],
        pulseSpeed: 0.01 + Math.random() * 0.02,
        pulsePhase: Math.random() * Math.PI * 2,
        type,
        charge: Math.random() * 360,
      });
    }

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('resize', handleResize);

    // Draw hexagon structures helper
    const drawHexagon = (c: CanvasRenderingContext2D, x: number, y: number, size: number, color: string) => {
      c.beginPath();
      for (let side = 0; side < 7; side++) {
        c.lineTo(
          x + size * Math.cos((side * 2 * Math.PI) / 6),
          y + size * Math.sin((side * 2 * Math.PI) / 6)
        );
      }
      c.strokeStyle = color;
      c.lineWidth = 0.5;
      c.stroke();
    };

    // Main animation loop
    const animate = () => {
      ctx.clearRect(0, 0, width, height);

      // 1. Draw static grid underlay
      ctx.strokeStyle = 'rgba(56, 189, 248, 0.015)';
      ctx.lineWidth = 1;
      const gridSize = 80;
      for (let x = 0; x < width; x += gridSize) {
        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
        ctx.stroke();
      }
      for (let y = 0; y < height; y += gridSize) {
        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
        ctx.stroke();
      }

      // 2. Draw connections (Lattice bonds)
      for (let i = 0; i < particles.length; i++) {
        const p1 = particles[i];
        for (let j = i + 1; j < particles.length; j++) {
          const p2 = particles[j];
          const dist = Math.hypot(p1.x - p2.x, p1.y - p2.y);
          const maxDist = 180;

          if (dist < maxDist) {
            const alpha = (1 - dist / maxDist) * 0.08;
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = p1.color.replace(/[\d.]+\)$/, `${alpha})`);
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      // 3. Draw particles
      particles.forEach((p) => {
        p.x += p.vx;
        p.y += p.vy;

        // Boundary collision
        if (p.x < 0 || p.x > width) p.vx *= -1;
        if (p.y < 0 || p.y > height) p.vy *= -1;

        p.pulsePhase += p.pulseSpeed;
        const currentAlpha = 0.15 + 0.1 * Math.sin(p.pulsePhase);
        const particleColor = p.color.replace(/[\d.]+\)$/, `${currentAlpha})`);

        ctx.shadowBlur = p.type === 'atom' ? 8 : 0;
        ctx.shadowColor = p.color;

        if (p.type === 'atom') {
          // Draw Atom Node with Electron Orbit ring
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = p.color;
          ctx.fill();

          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size * 5, 0, Math.PI * 2);
          ctx.strokeStyle = p.color.replace(/[\d.]+\)$/, `0.02)`);
          ctx.lineWidth = 0.5;
          ctx.stroke();

          // Electron orbit dot
          p.charge += 0.02;
          const ex = p.x + p.size * 5 * Math.cos(p.charge);
          const ey = p.y + p.size * 5 * Math.sin(p.charge);
          ctx.beginPath();
          ctx.arc(ex, ey, 1, 0, Math.PI * 2);
          ctx.fillStyle = p.color.replace(/[\d.]+\)$/, `0.6)`);
          ctx.fill();
        } else if (p.type === 'lattice') {
          // Draw crystalline hexagonal structure
          drawHexagon(ctx, p.x, p.y, 25, p.color.replace(/[\d.]+\)$/, `0.03)`));
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = particleColor;
          ctx.fill();
        } else {
          // Draw basic floating crystalline vertex
          ctx.beginPath();
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          ctx.fillStyle = particleColor;
          ctx.fill();
        }

        ctx.shadowBlur = 0; // reset
      });

      animationFrameId = requestAnimationFrame(animate);
    };

    animate();

    return () => {
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full -z-50 pointer-events-none"
      style={{ background: '#06080c', zIndex: -50 }}
    />
  );
};
