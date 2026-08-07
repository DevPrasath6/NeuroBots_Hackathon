import React, { useEffect, useRef } from 'react';

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  size: number;
  color: string;
  alpha: number;
  decay: number;
  gravity: number;
}

export const SparklesCursor: React.FC = () => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const mouseRef = useRef({ x: 0, y: 0, lastX: 0, lastY: 0, isMoving: false });
  const isHoveringRef = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animationFrameId: number;
    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const particles: Particle[] = [];

    const colors = {
      spark: ['#ff8a00', '#ff6b00', '#ffa600', '#ff5500'], // Molten Orange / Ember Gold
      electric: ['#00f3ff', '#38bdf8', '#00d0ff'],        // Electric Cyan / Neon Blue
    };

    // Track cursor coordinates
    const handleMouseMove = (e: MouseEvent) => {
      mouseRef.current.x = e.clientX;
      mouseRef.current.y = e.clientY;
      mouseRef.current.isMoving = true;

      // Spawn particles on move
      const dx = mouseRef.current.x - mouseRef.current.lastX;
      const dy = mouseRef.current.y - mouseRef.current.lastY;
      const speed = Math.hypot(dx, dy);

      if (speed > 2) {
        const count = isHoveringRef.current ? 4 : 2;
        for (let i = 0; i < count; i++) {
          const isElectric = Math.random() < 0.4;
          const colorList = isElectric ? colors.electric : colors.spark;
          const angle = Math.random() * Math.PI * 2;
          const vel = Math.random() * 1.5 + (isHoveringRef.current ? 1.0 : 0.2);

          particles.push({
            x: e.clientX,
            y: e.clientY,
            vx: Math.cos(angle) * vel + dx * 0.15,
            vy: Math.sin(angle) * vel + dy * 0.15 - 0.2, // slight upward bias
            size: Math.random() * (isHoveringRef.current ? 3.0 : 2.0) + 1.0,
            color: colorList[Math.floor(Math.random() * colorList.length)],
            alpha: 1.0,
            decay: 0.02 + Math.random() * 0.02,
            gravity: isElectric ? 0.0 : 0.04, // only ember filings drop down
          });
        }
      }

      mouseRef.current.lastX = e.clientX;
      mouseRef.current.lastY = e.clientY;
    };

    // Listen to hover states on interactive items
    const handleMouseOver = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target) return;

      const isInteractive = 
        target.tagName === 'A' ||
        target.tagName === 'BUTTON' ||
        target.tagName === 'INPUT' ||
        target.tagName === 'SELECT' ||
        target.tagName === 'TEXTAREA' ||
        target.closest('a') ||
        target.closest('button') ||
        target.closest('.glass-card') ||
        target.closest('.glass-button') ||
        target.getAttribute('role') === 'button' ||
        target.classList.contains('cursor-pointer');

      isHoveringRef.current = !!isInteractive;
    };

    const handleResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
    };

    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseover', handleMouseOver);
    window.addEventListener('resize', handleResize);

    // Animation runner
    const drawParticles = () => {
      ctx.clearRect(0, 0, width, height);

      for (let i = particles.length - 1; i >= 0; i--) {
        const p = particles[i];
        p.vy += p.gravity;
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= p.decay;

        if (p.alpha <= 0) {
          particles.splice(i, 1);
          continue;
        }

        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.shadowBlur = p.color === '#00f3ff' || p.color === '#ff6b00' ? 8 : 4;
        ctx.shadowColor = p.color;

        ctx.fillStyle = p.color;
        ctx.beginPath();
        
        if (p.gravity > 0) {
          // Embers / Sparks are elongated slightly in the direction of velocity
          const speed = Math.hypot(p.vx, p.vy);
          if (speed > 1) {
            ctx.ellipse(p.x, p.y, p.size, p.size / 2, Math.atan2(p.vy, p.vx), 0, Math.PI * 2);
          } else {
            ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
          }
        } else {
          // Electric dots remain spherical
          ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
        }
        
        ctx.fill();
        ctx.restore();
      }

      // Add a subtle glowing ring around the actual cursor when hovering items
      if (isHoveringRef.current) {
        ctx.beginPath();
        ctx.arc(mouseRef.current.x, mouseRef.current.y, 14, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(0, 243, 255, 0.25)';
        ctx.lineWidth = 1;
        ctx.stroke();

        ctx.beginPath();
        ctx.arc(mouseRef.current.x, mouseRef.current.y, 2, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(0, 243, 255, 0.8)';
        ctx.fill();
      }

      animationFrameId = requestAnimationFrame(drawParticles);
    };

    drawParticles();

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseover', handleMouseOver);
      window.removeEventListener('resize', handleResize);
      cancelAnimationFrame(animationFrameId);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 w-full h-full pointer-events-none"
      style={{ zIndex: 99999 }}
    />
  );
};
