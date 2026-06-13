const DEFAULT_STEPS = [
  "create_account",
  "choose_plan",
  "add_device",
  "download_config",
  "connect_vpn",
];

export function OnboardingChecklist({ completed }: { completed: string[] }) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.035] p-5">
      <h2 className="text-sm font-semibold text-white">Setup checklist</h2>

      <div className="mt-4 space-y-2">
        {DEFAULT_STEPS.map((step) => {
          const done = completed.includes(step);

          return (
            <div key={step} className="flex items-center gap-3 text-sm">
              <span
                className={[
                  "h-4 w-4 rounded-full border",
                  done
                    ? "border-primary bg-primary"
                    : "border-white/20 bg-white/[0.03]",
                ].join(" ")}
              />
              <span className={done ? "text-white/60 line-through" : "text-white"}>
                {step.replaceAll("_", " ")}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
