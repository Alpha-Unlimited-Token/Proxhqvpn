import { useEffect, useState, useRef } from "react";

import screenshotConnect    from "@assets/Screenshot_2026-04-23_at_1.25.52_AM_1776922413463.png";
import screenshotPricing    from "@assets/Screenshot_20260423-005035_Chrome_1776922328389.png";
import screenshotVpnGate    from "@assets/Screenshot_2026-04-23_at_12.19.51_AM_1776922413778.png";
import screenshotGhostChain from "@assets/Screenshot_2026-04-23_at_12.21.14_AM_1776922413812.png";
import screenshotKillSwitch from "@assets/Screenshot_2026-04-23_at_12.11.09_AM_1776922413651.png";
import screenshotGhostTrace from "@assets/Screenshot_2026-04-23_at_12.13.21_AM_1776922413682.png";
import screenshotDns        from "@assets/Screenshot_2026-04-23_at_12.17.07_AM_1776922413743.png";

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

/* ─── Typewriter ─── */
function Typewriter({ text, delay = 0 }: { text: string; delay?: number }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    let i = 0;
    const t0 = setTimeout(() => {
      const iv = setInterval(() => {
        i++;
        setShown(text.slice(0, i));
        if (i >= text.length) clearInterval(iv);
      }, 48);
      return () => clearInterval(iv);
    }, delay);
    return () => clearTimeout(t0);
  }, [text, delay]);
  return <span>{shown}</span>;
}

/* ─── Blinking cursor ─── */
function Cursor() {
  const [on, setOn] = useState(true);
  useEffect(() => {
    const iv = setInterval(() => setOn(v => !v), 500);
    return () => clearInterval(iv);
  }, []);
  return <span style={{ opacity: on ? 1 : 0 }}>█</span>;
}

/* ─── SCENES ─── */

function Scene1() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 2600);
    const t2 = setTimeout(() => setPhase(2), 3600);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);
  return (
    <div className="abs-scene bg-[#020704] flex flex-col items-center justify-center text-center px-8">
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.07]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 3px,#00ff88 3px,#00ff88 4px)" }}
      />
      <div className="relative z-10 font-mono">
        {phase === 0 && (
          <div className="text-[#00ff88] text-3xl md:text-4xl font-bold leading-snug">
            <Typewriter text="SYSTEM BREACH DETECTED..." />&nbsp;<Cursor />
          </div>
        )}
        {phase === 1 && (
          <div
            className="text-white text-5xl md:text-7xl font-black tracking-widest uppercase"
            style={{ animation: "slam 0.4s cubic-bezier(0.22,1,0.36,1) both" }}
          >
            NOT ON<br />
            <span className="text-[#00ff88]">OUR WATCH.</span>
          </div>
        )}
        {phase === 2 && (
          <div className="flex flex-col items-center" style={{ animation: "fadeUp 0.5s ease both" }}>
            <div
              className="w-28 h-28 rounded-2xl bg-[#00ff88]/10 border-2 border-[#00ff88]/50 flex items-center justify-center"
              style={{ boxShadow: "0 0 60px rgba(0,255,136,0.35)" }}
            >
              <img src={`${basePath}/icon-final2.png`} alt="ProxhqVPN" className="w-20 h-20" />
            </div>
            <div className="mt-4 text-[#00ff88] text-4xl font-black tracking-tight">ProxhqVPN</div>
          </div>
        )}
      </div>
    </div>
  );
}

function Scene2() {
  const [show, setShow] = useState(false);
  useEffect(() => { const t = setTimeout(() => setShow(true), 200); return () => clearTimeout(t); }, []);
  return (
    <div className="abs-scene bg-[#020704] flex items-center justify-center overflow-hidden" style={{ animation: "slideInRight 0.55s cubic-bezier(0.22,1,0.36,1) both" }}>
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 3px,#00ff88 3px,#00ff88 4px)" }}
      />
      <div className="relative z-10 w-full max-w-6xl px-8 flex flex-col md:flex-row items-center gap-10">
        <div className="flex-1 rounded-xl overflow-hidden border border-[#00ff88]/30" style={{ boxShadow: "0 0 50px rgba(0,255,136,0.12)", animation: "fadeUp 0.6s 0.1s ease both" }}>
          <img src={screenshotConnect} alt="Connect" className="w-full h-auto" />
        </div>
        <div className="flex-1 font-mono" style={{ animation: "fadeUp 0.6s 0.3s ease both" }}>
          <div className="text-5xl font-black text-white leading-tight mb-4">
            MILITARY<br /><span className="text-[#00ff88]">GRADE</span><br />WIREGUARD
          </div>
          <div className="text-xl text-white/50 uppercase tracking-[0.2em]">
            {show && <Typewriter text="ZERO LOGS. ALWAYS." delay={800} />}
          </div>
        </div>
      </div>
    </div>
  );
}

function Scene3() {
  return (
    <div className="abs-scene bg-[#020704] flex flex-col items-center justify-center overflow-hidden" style={{ animation: "zoomIn 0.6s ease both" }}>
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 3px,#00ff88 3px,#00ff88 4px)" }}
      />
      <div className="absolute inset-0 overflow-hidden opacity-20">
        <img src={screenshotVpnGate} alt="" className="w-full h-full object-cover blur-sm mix-blend-screen" />
      </div>
      <div className="relative z-10 flex flex-col items-center w-full max-w-5xl px-8">
        <div className="flex gap-6 mb-8" style={{ animation: "fadeUp 0.5s 0.2s ease both" }}>
          {["98 NODES", "9 COUNTRIES", "299 MBPS"].map((s, i) => (
            <div key={s} className="bg-[#00ff88]/10 border border-[#00ff88]/30 px-5 py-3 rounded-lg font-mono font-black text-[#00ff88] text-xl tracking-widest"
              style={{ animation: `fadeUp 0.4s ${0.3 + i * 0.12}s ease both` }}
            >{s}</div>
          ))}
        </div>
        <div className="w-full max-w-md rounded-xl overflow-hidden border border-[#00ff88]/20" style={{ animation: "fadeUp 0.5s 0.55s ease both", boxShadow: "0 20px 60px rgba(0,255,136,0.1)" }}>
          <img src={screenshotGhostChain} alt="Ghost Chain" className="w-full h-auto" />
        </div>
        <div className="mt-6 text-[#00ff88] text-lg font-bold tracking-[0.25em] uppercase font-mono" style={{ animation: "fadeUp 0.5s 0.9s ease both" }}>
          7-Hop Tor-Veiled Routing
        </div>
      </div>
    </div>
  );
}

function Scene4() {
  const [phase, setPhase] = useState(0);
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 600);
    const t2 = setTimeout(() => setPhase(2), 1100);
    const t3 = setTimeout(() => setPhase(3), 1600);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, []);
  return (
    <div className="abs-scene bg-[#020704] overflow-hidden" style={{ animation: "fadeIn 0.4s ease both" }}>
      <div className="absolute inset-0 flex">
        <div className="w-1/2 h-full relative border-r border-[#00ff88]/20" style={{ animation: "slideInLeft 0.5s 0.1s ease both" }}>
          <img src={screenshotKillSwitch} alt="Kill Switch" className="w-full h-full object-cover opacity-55" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#020704] via-transparent to-transparent" />
        </div>
        <div className="w-1/2 h-full relative" style={{ animation: "slideInRight 0.5s 0.2s ease both" }}>
          <img src={screenshotGhostTrace} alt="Ghost Trace" className="w-full h-full object-cover opacity-55" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#020704] via-transparent to-transparent" />
        </div>
      </div>
      <div className="absolute inset-0 z-10 flex flex-col items-center justify-center">
        <div className="bg-black/85 border border-[#00ff88]/30 px-10 py-8 rounded-2xl flex flex-col items-center gap-3 font-black text-3xl tracking-tight" style={{ animation: "scaleIn 0.5s 0.6s ease both" }}>
          <div className="text-white/40 text-xs font-mono uppercase tracking-[0.4em] mb-2">Offensive Toolkit</div>
          <div className="text-white" style={{ opacity: phase >= 1 ? 1 : 0, transition: "opacity 0.4s" }}>KILL SWITCH.</div>
          <div className="text-[#00ff88]" style={{ opacity: phase >= 2 ? 1 : 0, transition: "opacity 0.4s" }}>GHOST TRACE.</div>
          <div className="text-white" style={{ opacity: phase >= 3 ? 1 : 0, transition: "opacity 0.4s" }}>DNS SINKHOLE.</div>
        </div>
      </div>
    </div>
  );
}

function Scene5() {
  return (
    <div className="abs-scene bg-[#020704] flex flex-col items-center justify-center overflow-hidden" style={{ animation: "fadeUp 0.5s ease both" }}>
      <div className="pointer-events-none absolute inset-0 opacity-[0.04]"
        style={{ backgroundImage: "repeating-linear-gradient(0deg,transparent,transparent 3px,#00ff88 3px,#00ff88 4px)" }}
      />
      <div className="relative z-10 w-full max-w-4xl px-8">
        <div className="relative" style={{ animation: "fadeUp 0.5s 0.2s ease both" }}>
          <div className="absolute -inset-6 bg-[#00ff88]/8 blur-3xl rounded-full" />
          <img src={screenshotPricing} alt="Pricing" className="w-full h-auto rounded-xl border border-[#00ff88]/30 relative z-10" style={{ boxShadow: "0 0 80px rgba(0,255,136,0.15)" }} />
        </div>
        <div className="mt-8 flex flex-col items-center z-10 relative" style={{ animation: "fadeUp 0.5s 0.7s ease both" }}>
          <div className="text-[#00ff88] text-6xl font-black tracking-tighter font-mono">
            <Typewriter text="$6.99/mo" delay={900} />
          </div>
          <div className="text-white/50 font-mono tracking-widest text-base uppercase mt-2" style={{ animation: "fadeIn 0.5s 2.2s ease both", opacity: 0, animationFillMode: "forwards" }}>
            Pro Plan from $39.99/mo
          </div>
        </div>
      </div>
    </div>
  );
}

function Scene6() {
  return (
    <div className="abs-scene bg-[#020704] flex flex-col items-center justify-center text-center" style={{ animation: "fadeIn 0.8s ease both" }}>
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
        <div className="w-[700px] h-[700px] rounded-full bg-[#00ff88]/8 blur-[100px]" style={{ animation: "pulse2 4s ease-in-out infinite" }} />
      </div>
      <div className="relative z-10 flex flex-col items-center">
        <div className="w-28 h-28 rounded-2xl bg-[#00ff88]/10 border-2 border-[#00ff88]/50 flex items-center justify-center mb-8"
          style={{ boxShadow: "0 0 60px rgba(0,255,136,0.4)", animation: "scaleIn 0.6s 0.2s ease both" }}
        >
          <img src={`${basePath}/icon-final2.png`} alt="ProxhqVPN" className="w-20 h-20" />
        </div>
        <div className="text-5xl md:text-7xl font-black text-white tracking-tight leading-none mb-4" style={{ animation: "fadeUp 0.6s 0.5s ease both" }}>
          STAY INVISIBLE.<br />
          <span className="text-[#00ff88]">STAY PROTECTED.</span>
        </div>
        <div className="mt-8 text-2xl font-mono text-[#00ff88] tracking-widest px-8 py-3 border border-[#00ff88]/30 bg-[#00ff88]/5 rounded-lg"
          style={{ animation: "scaleIn 0.5s 1s ease both" }}
        >
          PROXHQVPN.COM
        </div>
        <div className="mt-4 text-xs text-white/25 uppercase tracking-[0.2em] font-mono" style={{ animation: "fadeIn 0.5s 1.5s ease both" }}>
          Alpha Unlimited Technologies LLC
        </div>
      </div>
    </div>
  );
}

const SCENES = [Scene1, Scene2, Scene3, Scene4, Scene5, Scene6];
const DURATIONS = [5000, 5000, 5200, 5000, 5200, 5500];

/* ─── Main Commercial Component ─── */
export default function Commercial() {
  const [scene, setScene] = useState(0);
  const [visible, setVisible] = useState(true);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const advance = () => {
      setVisible(false);
      timerRef.current = setTimeout(() => {
        setScene(s => (s + 1) % SCENES.length);
        setVisible(true);
      }, 400);
    };
    timerRef.current = setTimeout(advance, DURATIONS[scene]);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [scene]);

  const SceneComponent = SCENES[scene];

  return (
    <>
      <style>{`
        .abs-scene {
          position: absolute;
          inset: 0;
        }
        @keyframes fadeIn  { from { opacity: 0 }        to { opacity: 1 } }
        @keyframes fadeUp  { from { opacity: 0; transform: translateY(28px) } to { opacity: 1; transform: translateY(0) } }
        @keyframes slam    { from { opacity: 0; transform: scale(1.4) } to { opacity: 1; transform: scale(1) } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.85) } to { opacity: 1; transform: scale(1) } }
        @keyframes slideInRight { from { opacity: 0; transform: translateX(60px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes slideInLeft  { from { opacity: 0; transform: translateX(-60px) } to { opacity: 1; transform: translateX(0) } }
        @keyframes zoomIn  { from { opacity: 0; transform: scale(0.92) } to { opacity: 1; transform: scale(1) } }
        @keyframes pulse2  { 0%,100% { opacity: 0.1 } 50% { opacity: 0.3 } }
      `}</style>
      <div className="w-full h-screen bg-[#020704] overflow-hidden relative">
        <div
          style={{
            opacity: visible ? 1 : 0,
            transition: "opacity 0.35s ease",
            position: "absolute",
            inset: 0,
          }}
        >
          <SceneComponent key={scene} />
        </div>

        {/* Scene progress dots */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-2 z-50">
          {SCENES.map((_, i) => (
            <div
              key={i}
              className="w-1.5 h-1.5 rounded-full transition-all"
              style={{ background: i === scene ? "#00ff88" : "rgba(0,255,136,0.2)", transform: i === scene ? "scale(1.4)" : "scale(1)" }}
            />
          ))}
        </div>
      </div>
    </>
  );
}
