// Copyright © 2026 Alpha Unlimited Technologies LLC. All rights reserved.
// Onboarding Wizard v2 — P310
import { useState } from "react";
import { Link } from "wouter";
import { Check, ChevronRight } from "lucide-react";

const STEPS = [
  { id: "account",  label: "Create account",    description: "Sign in and verify your email." },
  { id: "plan",     label: "Choose plan",        description: "Select personal, business, or security operations." },
  { id: "device",   label: "Add device",         description: "Register your computer or phone." },
  { id: "install",  label: "Install config",     description: "Download the app or WireGuard profile." },
  { id: "connect",  label: "Connect VPN",        description: "Connect and verify your protection." },
  { id: "protect",  label: "Enable protection",  description: "Turn on DNS, firewall, and safety features." },
] as const;

type StepId = (typeof STEPS)[number]["id"];

function getCompletedSteps(): Set<StepId> {
  try {
    const raw = localStorage.getItem("proxhqvpn.onboardingCompleted");
    return new Set((raw ? JSON.parse(raw) : []) as StepId[]);
  } catch {
    return new Set();
  }
}

function saveCompletedSteps(s: Set<StepId>) {
  localStorage.setItem("proxhqvpn.onboardingCompleted", JSON.stringify([...s]));
}

export default function OnboardingV2() {
  const [completed, setCompleted] = useState<Set<StepId>>(getCompletedSteps);
  const [activeStep, setActiveStep] = useState<StepId | null>(
    STEPS.find(s => !completed.has(s.id))?.id ?? null,
  );

  function markDone(id: StepId) {
    const next = new Set(completed);
    next.add(id);
    setCompleted(next);
    saveCompletedSteps(next);
    const nextStep = STEPS.find(s => !next.has(s.id));
    setActiveStep(nextStep?.id ?? null);
  }

  const allDone = STEPS.every(s => completed.has(s.id));

  return (
    <main id="main-content" className="mx-auto max-w-2xl space-y-6">
      <div className="rounded-2xl border border-primary/20 bg-primary/[0.04] p-6 text-center">
        <div className="text-xs uppercase tracking-[0.35em] text-primary/70">ProxhqVPN</div>
        <h1 className="mt-2 text-2xl font-bold text-white">Get started in minutes</h1>
        <p className="mt-2 text-sm text-white/55">
          Complete each step to protect your device.
        </p>
      </div>

      {allDone && (
        <div className="rounded-2xl border border-primary/20 bg-primary/10 p-6 text-center">
          <div className="text-xl font-bold text-primary">You're all set! 🎉</div>
          <p className="mt-2 text-sm text-white/55">
            ProxhqVPN is protecting your device.
          </p>
          <Link
            href="/dashboard"
            className="mt-4 inline-block rounded-xl bg-primary px-6 py-2 text-sm font-bold text-black"
          >
            Go to Dashboard
          </Link>
        </div>
      )}

      <div className="space-y-3">
        {STEPS.map((step, i) => {
          const done = completed.has(step.id);
          const active = activeStep === step.id;
          return (
            <div
              key={step.id}
              className={[
                "rounded-2xl border p-4 transition",
                done
                  ? "border-primary/20 bg-primary/[0.04]"
                  : active
                  ? "border-white/20 bg-white/[0.05]"
                  : "border-white/8 bg-white/[0.025] opacity-60",
              ].join(" ")}
            >
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div
                    className={[
                      "flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-xs font-bold",
                      done
                        ? "border-primary bg-primary text-black"
                        : "border-white/20 text-white/40",
                    ].join(" ")}
                  >
                    {done ? <Check className="h-3.5 w-3.5" /> : i + 1}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-white">{step.label}</div>
                    <div className="text-xs text-white/55">{step.description}</div>
                  </div>
                </div>
                {!done && active && (
                  <button
                    onClick={() => markDone(step.id)}
                    className="flex shrink-0 items-center gap-1 rounded-lg bg-primary px-3 py-1.5 text-xs font-bold text-black"
                  >
                    Done <ChevronRight className="h-3 w-3" />
                  </button>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </main>
  );
}
