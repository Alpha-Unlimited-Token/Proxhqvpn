import { useState } from "react";
import { Panel } from "@/components/system";

const steps = ["Account", "Plan", "Device", "Config", "Connect"];

export function SetupWizard() {
  const [index, setIndex] = useState(0);

  return (
    <Panel title="Interactive Setup Wizard" subtitle="Complete your ProxhqVPN setup">
      <div className="mb-6 flex gap-2">
        {steps.map((step, i) => (
          <div
            key={step}
            className={[
              "flex-1 rounded-full px-3 py-2 text-center text-xs font-semibold",
              i <= index ? "bg-primary text-black" : "bg-white/5 text-white/45",
            ].join(" ")}
          >
            {step}
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-white/10 bg-black/30 p-5">
        <div className="text-lg font-semibold text-white">{steps[index]}</div>
        <p className="mt-2 text-sm text-white/55">
          Follow the instructions for this setup stage.
        </p>
      </div>

      <div className="mt-6 flex justify-between">
        <button
          disabled={index === 0}
          onClick={() => setIndex((value) => Math.max(0, value - 1))}
          className="rounded-lg border border-white/10 px-4 py-2 text-sm text-white disabled:opacity-40"
        >
          Back
        </button>

        <button
          disabled={index === steps.length - 1}
          onClick={() => setIndex((value) => Math.min(steps.length - 1, value + 1))}
          className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-black disabled:opacity-40"
        >
          Next
        </button>
      </div>
    </Panel>
  );
}
