'use client';

import { useEffect, useRef } from 'react';

const TEAL_RGB = '20, 184, 166';
const MAX_BLOBS = 100;
const BLOB_LIFETIME_MS = 900;
const SPAWN_THROTTLE_MS = 16;

type SprayBlob = {
  x: number;
  y: number;
  radius: number;
  peakOpacity: number;
  born: number;
  driftX: number;
  driftY: number;
  squash: number;
  rotation: number;
  speckles: Array<{ x: number; y: number; radius: number; opacity: number }>;
};

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function hasFinePointerHover(): boolean {
  if (typeof window === 'undefined') return false;
  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

function spawnSprayCluster(blobs: SprayBlob[], x: number, y: number, now: number): void {
  const count = 4 + Math.floor(Math.random() * 5);

  for (let i = 0; i < count; i += 1) {
    if (blobs.length >= MAX_BLOBS) {
      blobs.shift();
    }

    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 28 + 4;
    const radius = Math.random() * 22 + 6;

    blobs.push({
      x: x + Math.cos(angle) * distance,
      y: y + Math.sin(angle) * distance,
      radius,
      peakOpacity: Math.random() * 0.22 + 0.08,
      born: now,
      driftX: (Math.random() - 0.5) * 0.35,
      driftY: (Math.random() - 0.5) * 0.35,
      squash: Math.random() * 0.45 + 0.55,
      rotation: Math.random() * Math.PI,
      speckles:
        Math.random() > 0.45
          ? [
              {
                x: (Math.random() - 0.5) * radius * 0.9,
                y: (Math.random() - 0.5) * radius * 0.9,
                radius: radius * (0.25 + Math.random() * 0.2),
                opacity: 0.35,
              },
            ]
          : [],
    });
  }
}

function drawBlob(ctx: CanvasRenderingContext2D, blob: SprayBlob, now: number): boolean {
  const age = now - blob.born;
  if (age >= BLOB_LIFETIME_MS) return false;

  const life = 1 - age / BLOB_LIFETIME_MS;
  const fadeIn = Math.min(age / 80, 1);
  const opacity = blob.peakOpacity * fadeIn * life * life;

  const x = blob.x + blob.driftX * age * 0.08;
  const y = blob.y + blob.driftY * age * 0.08;
  const radius = blob.radius * (0.85 + life * 0.25);

  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(blob.rotation);
  ctx.scale(1, blob.squash);

  const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
  gradient.addColorStop(0, `rgba(${TEAL_RGB}, ${opacity * 0.95})`);
  gradient.addColorStop(0.35, `rgba(${TEAL_RGB}, ${opacity * 0.45})`);
  gradient.addColorStop(0.7, `rgba(${TEAL_RGB}, ${opacity * 0.12})`);
  gradient.addColorStop(1, `rgba(${TEAL_RGB}, 0)`);

  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(0, 0, radius, 0, Math.PI * 2);
  ctx.fill();

  for (const speck of blob.speckles) {
    const speckGradient = ctx.createRadialGradient(speck.x, speck.y, 0, speck.x, speck.y, speck.radius);
    speckGradient.addColorStop(0, `rgba(${TEAL_RGB}, ${opacity * speck.opacity})`);
    speckGradient.addColorStop(1, `rgba(${TEAL_RGB}, 0)`);
    ctx.fillStyle = speckGradient;
    ctx.beginPath();
    ctx.arc(speck.x, speck.y, speck.radius, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  return true;
}

export function HeroSprayBackground() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const blobsRef = useRef<SprayBlob[]>([]);
  const rafRef = useRef<number | null>(null);
  const lastSpawnRef = useRef(0);
  const sizeRef = useRef({ width: 0, height: 0, dpr: 1 });

  useEffect(() => {
    if (prefersReducedMotion() || !hasFinePointerHover()) return;

    const wrapper = wrapperRef.current;
    const canvas = canvasRef.current;
    const section = wrapper?.parentElement;
    if (!wrapper || !canvas || !section) return;

    const ctx = canvas.getContext('2d', { alpha: true });
    if (!ctx) return;

    const resize = () => {
      const rect = section.getBoundingClientRect();
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      sizeRef.current = { width: rect.width, height: rect.height, dpr };
      canvas.width = Math.max(1, Math.floor(rect.width * dpr));
      canvas.height = Math.max(1, Math.floor(rect.height * dpr));
      canvas.style.width = `${rect.width}px`;
      canvas.style.height = `${rect.height}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    const stopLoop = () => {
      if (rafRef.current !== null) {
        cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };

    const tick = (now: number) => {
      const { width, height } = sizeRef.current;
      ctx.clearRect(0, 0, width, height);
      ctx.globalCompositeOperation = 'lighter';

      const blobs = blobsRef.current;
      let alive = 0;
      for (let i = 0; i < blobs.length; i += 1) {
        if (drawBlob(ctx, blobs[i], now)) {
          if (alive !== i) blobs[alive] = blobs[i];
          alive += 1;
        }
      }
      blobs.length = alive;

      if (blobs.length > 0) {
        rafRef.current = requestAnimationFrame(tick);
      } else {
        rafRef.current = null;
      }
    };

    const ensureLoop = () => {
      if (rafRef.current === null) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    const handleMouseMove = (event: MouseEvent) => {
      const now = performance.now();
      if (now - lastSpawnRef.current < SPAWN_THROTTLE_MS) return;
      lastSpawnRef.current = now;

      const rect = section.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;

      if (x < 0 || y < 0 || x > rect.width || y > rect.height) return;

      spawnSprayCluster(blobsRef.current, x, y, now);
      ensureLoop();
    };

    const handleMouseLeave = () => {
      lastSpawnRef.current = 0;
    };

    resize();
    const resizeObserver = new ResizeObserver(resize);
    resizeObserver.observe(section);
    window.addEventListener('resize', resize);
    section.addEventListener('mousemove', handleMouseMove);
    section.addEventListener('mouseleave', handleMouseLeave);

    return () => {
      stopLoop();
      resizeObserver.disconnect();
      window.removeEventListener('resize', resize);
      section.removeEventListener('mousemove', handleMouseMove);
      section.removeEventListener('mouseleave', handleMouseLeave);
      blobsRef.current = [];
      ctx.clearRect(0, 0, sizeRef.current.width, sizeRef.current.height);
    };
  }, []);

  return (
    <div
      ref={wrapperRef}
      className="pointer-events-none absolute inset-0 z-[1]"
      aria-hidden="true"
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
    </div>
  );
}
