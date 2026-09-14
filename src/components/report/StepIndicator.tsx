"use client";

const STEPS = [
  { step: 1, label: "Instellingen" },
  { step: 2, label: "Broninformatie" },
  { step: 3, label: "VERA-analyse" },
  { step: 4, label: "Controle en bewerking" },
  { step: 5, label: "Export" },
];

export function StepIndicator({
  activeStep,
  maxReachedStep,
  onSelect,
}: {
  activeStep: number;
  maxReachedStep: number;
  onSelect: (step: number) => void;
}) {
  return (
    <ol className="mb-8 flex flex-wrap gap-2">
      {STEPS.map(({ step, label }) => {
        const reachable = step <= maxReachedStep;
        const completed = step < maxReachedStep && step !== activeStep;
        return (
          <li key={step}>
            <button
              type="button"
              disabled={!reachable}
              onClick={() => onSelect(step)}
              data-active={step === activeStep}
              className="step-indicator-item flex items-center gap-2 rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-gray-600 transition-all duration-150 disabled:cursor-not-allowed disabled:opacity-40"
            >
              <span
                className={`flex h-5 w-5 items-center justify-center rounded-full text-[11px] transition-colors ${
                  completed ? "bg-green-100 text-green-700" : "bg-gray-100"
                }`}
              >
                {completed ? "✓" : step}
              </span>
              {label}
            </button>
          </li>
        );
      })}
    </ol>
  );
}
