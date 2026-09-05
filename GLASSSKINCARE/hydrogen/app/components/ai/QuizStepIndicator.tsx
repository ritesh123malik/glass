export interface QuizStepIndicatorProps {
  current: number;
  total: number;
  labels?: string[];
  className?: string;
}

export function QuizStepIndicator({
  current,
  total,
  labels,
  className = "",
}: QuizStepIndicatorProps) {
  const safeTotal = Math.max(1, Math.floor(total));
  const safeCurrent = Math.min(Math.max(1, Math.floor(current)), safeTotal);

  return (
    <div
      role="progressbar"
      aria-valuemin={1}
      aria-valuemax={safeTotal}
      aria-valuenow={safeCurrent}
      aria-label={`Step ${safeCurrent} of ${safeTotal}`}
      className={`w-full ${className}`}
    >
      <div className="relative flex items-center justify-between">
        {/* Connecting line behind the dots */}
        <div
          aria-hidden="true"
          className="absolute left-4 right-4 top-1/2 -translate-y-1/2 h-1 bg-brand-text/30 z-0"
        />
        {Array.from({ length: safeTotal }).map((_, i) => {
          const stepNum = i + 1;
          const state =
            stepNum < safeCurrent
              ? "done"
              : stepNum === safeCurrent
                ? "active"
                : "todo";
          return (
            <div
              key={stepNum}
              className="relative z-10 flex flex-col items-center gap-2"
            >
              <Dot step={stepNum} state={state} />
              {labels?.[i] && (
                <span
                  className={`text-xs uppercase tracking-wider font-display hidden sm:block ${
                    state === "active"
                      ? "text-brand-magenta font-black"
                      : state === "done"
                        ? "text-brand-text font-bold"
                        : "text-brand-text/40 font-bold"
                  }`}
                >
                  {labels[i]}
                </span>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function Dot({ step, state }: { step: number; state: "done" | "active" | "todo" }) {
  const base =
    "h-8 w-8 rounded-full flex items-center justify-center text-xs font-display font-bold transition-all duration-300 border-2 border-brand-text";

  if (state === "active") {
    return (
      <div className={`${base} bg-brand-magenta text-white shadow-play scale-110`}>
        {step}
      </div>
    );
  }
  if (state === "done") {
    return (
      <div className={`${base} bg-brand-yellow text-brand-text shadow-play`}>
        <CheckIcon />
      </div>
    );
  }
  return (
    <div className={`${base} bg-white text-brand-text/40 border-brand-text/30`}>
      {step}
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4"
      aria-hidden="true"
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export default QuizStepIndicator;
