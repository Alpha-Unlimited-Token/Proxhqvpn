// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
import { useEffect, useRef } from "react";

export function MatrixBackground({ enabled = true }: { enabled?: boolean }) {
  const ref = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    if (!enabled) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const fontSize = 16;
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789$+-*/=<>!%".split("");
    let columns = 0;
    let drops: number[] = [];

    function resize() {
      canvas!.width = window.innerWidth;
      canvas!.height = window.innerHeight;
      columns = Math.floor(canvas!.width / fontSize);
      drops = Array.from({ length: columns }).fill(1) as number[];
    }

    function draw() {
      ctx!.fillStyle = "rgba(0, 0, 0, 0.06)";
      ctx!.fillRect(0, 0, canvas!.width, canvas!.height);
      ctx!.fillStyle = "#00ff88";
      ctx!.font = `${fontSize}px monospace`;

      for (let i = 0; i < drops.length; i++) {
        const text = chars[Math.floor(Math.random() * chars.length)];
        ctx!.fillText(text, i * fontSize, drops[i] * fontSize);
        if (drops[i] * fontSize > canvas!.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      }
    }

    resize();
    window.addEventListener("resize", resize);
    const timer = window.setInterval(draw, 40);

    return () => {
      window.removeEventListener("resize", resize);
      window.clearInterval(timer);
    };
  }, [enabled]);

  return <canvas ref={ref} aria-hidden="true" className="pointer-events-none fixed inset-0 z-0 opacity-10" />;
}
