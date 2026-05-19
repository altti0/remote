// Aurora canvas — volumetric airflow / breathing atmosphere.
// Renders a flowing field of gradient blobs + drifting particles.
// `presence` (0–1) controls how far left the atmosphere extends and overall intensity.
// `hueShift` lets the tweaks panel re-tune the palette without touching draw code.

function AuroraCanvas({ presence = 0.7, hueShift = 0, intensity = 1, paused = false }) {
  const canvasRef = React.useRef(null);
  const rafRef = React.useRef(0);
  const stateRef = React.useRef({ t: 0, particles: [], w: 0, h: 0, dpr: 1 });
  const propsRef = React.useRef({ presence, hueShift, intensity, paused });
  propsRef.current = { presence, hueShift, intensity, paused };

  React.useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d', { alpha: true });
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const resize = () => {
      const rect = canvas.getBoundingClientRect();
      const w = Math.max(1, Math.round(rect.width));
      const h = Math.max(1, Math.round(rect.height));
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      stateRef.current.w = w;
      stateRef.current.h = h;
      stateRef.current.dpr = dpr;
      // Seed particles
      const target = 90;
      const ps = stateRef.current.particles;
      while (ps.length < target) {
        ps.push(spawn(w, h));
      }
      ps.length = target;
    };

    const spawn = (w, h) => ({
      x: 200 + Math.random() * (w - 200),
      y: Math.random() * h,
      vx: 0.05 + Math.random() * 0.15,
      vy: (Math.random() - 0.5) * 0.08,
      r: 0.4 + Math.random() * 1.6,
      life: Math.random() * 1,
      max: 0.4 + Math.random() * 0.7,
      drift: Math.random() * Math.PI * 2,
    });

    resize();
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);

    // Hue palette: tone the aurora. h0 = base, three stops shift around it.
    const draw = () => {
      const { w, h } = stateRef.current;
      const { presence, hueShift, intensity, paused } = propsRef.current;
      if (!paused) stateRef.current.t += 0.004;
      const t = stateRef.current.t;

      ctx.clearRect(0, 0, w, h);

      // Base deep navy wash – everywhere, but subtler on the left
      const baseGrad = ctx.createLinearGradient(0, 0, w, 0);
      baseGrad.addColorStop(0, 'rgba(10, 14, 28, 0)');
      baseGrad.addColorStop(0.35, 'rgba(10, 14, 28, 0.0)');
      baseGrad.addColorStop(1, 'rgba(8, 18, 38, 0.0)');
      ctx.fillStyle = baseGrad;
      ctx.fillRect(0, 0, w, h);

      // Atmosphere extent: presence pushes the AI field further left
      // At 0% presence, atmosphere is far off the right edge; at 100%, it covers everything
      const leftEdge = w * (1 - presence) * 0.95; // soft left bound of AI field

      // Aurora blobs — additive blending
      ctx.globalCompositeOperation = 'screen';

      const blobs = [
        { ox: 0.78, oy: 0.32, hue: 188 + hueShift, sat: 70, lit: 55, sx: 1.4, sy: 0.9, phase: 0 },
        { ox: 0.62, oy: 0.62, hue: 168 + hueShift, sat: 60, lit: 60, sx: 1.1, sy: 1.0, phase: 1.3 },
        { ox: 0.86, oy: 0.78, hue: 208 + hueShift, sat: 70, lit: 50, sx: 1.0, sy: 0.7, phase: 2.7 },
        { ox: 0.55, oy: 0.25, hue: 260 + hueShift, sat: 55, lit: 45, sx: 0.9, sy: 0.8, phase: 4.1 },
        { ox: 0.92, oy: 0.5,  hue: 180 + hueShift, sat: 75, lit: 60, sx: 0.7, sy: 1.2, phase: 5.0 },
      ];

      blobs.forEach((b, i) => {
        // breathing motion
        const breathe = 0.5 + 0.5 * Math.sin(t * 1.7 + b.phase);
        const drift = Math.sin(t * 0.6 + b.phase * 1.1) * 0.04;
        const cx = w * (b.ox + drift);
        const cy = h * (b.oy + Math.cos(t * 0.5 + b.phase) * 0.06);
        const rad = Math.min(w, h) * (0.55 + breathe * 0.15) * Math.max(b.sx, b.sy);
        const alpha = (0.10 + 0.10 * breathe) * intensity;

        const grd = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        grd.addColorStop(0, `hsla(${b.hue}, ${b.sat}%, ${b.lit}%, ${alpha})`);
        grd.addColorStop(0.5, `hsla(${b.hue}, ${b.sat}%, ${b.lit}%, ${alpha * 0.35})`);
        grd.addColorStop(1, `hsla(${b.hue}, ${b.sat}%, ${b.lit}%, 0)`);
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
      });

      // Volumetric horizontal sweep band — like air current
      {
        const yc = h * (0.5 + Math.sin(t * 0.9) * 0.12);
        const grd = ctx.createLinearGradient(0, yc - 80, 0, yc + 80);
        grd.addColorStop(0, 'hsla(190, 80%, 70%, 0)');
        grd.addColorStop(0.5, `hsla(${190 + hueShift}, 80%, 75%, ${0.08 * intensity})`);
        grd.addColorStop(1, 'hsla(190, 80%, 70%, 0)');
        ctx.fillStyle = grd;
        ctx.fillRect(leftEdge, yc - 80, w - leftEdge, 160);
      }

      ctx.globalCompositeOperation = 'lighter';

      // Particles — drifting motes of light
      const ps = stateRef.current.particles;
      for (let i = 0; i < ps.length; i++) {
        const p = ps[i];
        if (!paused) {
          p.x += p.vx + Math.sin(t * 2 + p.drift) * 0.05;
          p.y += p.vy + Math.cos(t * 1.5 + p.drift) * 0.08;
          p.life += 0.004;
        }
        if (p.x > w + 20 || p.y < -20 || p.y > h + 20 || p.life > 1) {
          ps[i] = spawn(w, h);
          ps[i].x = leftEdge + Math.random() * (w - leftEdge);
          continue;
        }
        // Only render in atmosphere zone, with soft falloff at boundary
        const zoneAlpha = Math.min(1, Math.max(0, (p.x - leftEdge) / 120));
        const lifeAlpha = Math.sin(p.life * Math.PI);
        const a = lifeAlpha * zoneAlpha * 0.85 * intensity;
        if (a <= 0) continue;
        const hue = 180 + hueShift + Math.sin(p.drift + t) * 25;
        ctx.fillStyle = `hsla(${hue}, 90%, 80%, ${a})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fill();
        // subtle glow
        ctx.fillStyle = `hsla(${hue}, 90%, 80%, ${a * 0.15})`;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r * 3.5, 0, Math.PI * 2);
        ctx.fill();
      }

      ctx.globalCompositeOperation = 'source-over';

      // Soft vertical mask near the boundary — fades atmosphere into control zone
      const mask = ctx.createLinearGradient(0, 0, w, 0);
      mask.addColorStop(0, 'rgba(8, 12, 24, 0.78)');
      mask.addColorStop(Math.max(0, (leftEdge - 60) / w), 'rgba(8, 12, 24, 0.55)');
      mask.addColorStop(Math.max(0, leftEdge / w), 'rgba(8, 12, 24, 0.0)');
      mask.addColorStop(1, 'rgba(8, 12, 24, 0)');
      ctx.fillStyle = mask;
      ctx.fillRect(0, 0, w, h);

      rafRef.current = requestAnimationFrame(draw);
    };
    rafRef.current = requestAnimationFrame(draw);

    return () => {
      cancelAnimationFrame(rafRef.current);
      ro.disconnect();
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        display: 'block',
      }}
    />
  );
}

window.AuroraCanvas = AuroraCanvas;
