import { useState } from "react";
import { json } from "@remix-run/server-runtime";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs,
  MetaFunction,
} from "@remix-run/node";
import { useFetcher, Link } from "@remix-run/react";
import { QuizStepIndicator } from "~/components/ai/QuizStepIndicator";
import { FastApiError, type RoutineResult } from "~/lib/types";
import { getAiToken, setAiToken } from "~/lib/ai-session.server";
import { getSessionToken, postSkinQuiz } from "~/lib/fastapi.server";

// ─── Page meta ───────────────────────────────────────────────────────────

export const meta: MetaFunction = () => [
  { title: "Skin Quiz — Glass Skincare" },
  {
    name: "description",
    content:
      "Take our 5-step skin quiz to get a personalized AM/PM routine and product recommendations.",
  },
];

// ─── Loader: ensure AI session token cookie ──────────────────────────────

export async function loader({ request, context }: LoaderFunctionArgs) {
  const existing = await getAiToken(request);
  if (existing) {
    return json({ ok: true, fresh: false }, { status: 200 });
  }

  try {
    const token = await getSessionToken(request, context.env.FASTAPI_URL);
    const expiresIn = 15 * 60 - 60; // 14 min — under FastAPI TTL
    const setCookie = await setAiToken(token, expiresIn);
    return json(
      { ok: true, fresh: true },
      { status: 200, headers: { "Set-Cookie": setCookie } },
    );
  } catch (err) {
    const message =
      err instanceof FastApiError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Could not obtain AI session token.";
    return json({ ok: false, fresh: false, error: message }, { status: 200 });
  }
}

// ─── Action: POST quiz answers, return RoutineResult ─────────────────────

export async function action({ request, context }: ActionFunctionArgs) {
  if (request.method !== "POST") {
    return json({ error: "Method Not Allowed" }, { status: 405 });
  }

  let body: { answers?: Partial<QuizAnswerState> };
  try {
    body = (await request.json()) as { answers?: Partial<QuizAnswerState> };
  } catch {
    return json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const answers = body.answers;
  if (!answers) {
    return json({ error: "answers is required." }, { status: 400 });
  }

  let token = await getAiToken(request);
  let setCookie: string | undefined;
  if (!token) {
    try {
      token = await getSessionToken(request, context.env.FASTAPI_URL);
      setCookie = await setAiToken(token, 15 * 60 - 60);
    } catch (err) {
      return json(
        {
          error:
            err instanceof Error
              ? err.message
              : "Could not obtain AI session token.",
        },
        { status: 502 },
      );
    }
  }

  const normalized = {
    skin_type: answers.skinType ?? "",
    primary_concern: (answers.concerns ?? []).join(", "),
    current_routine: answers.currentRoutine ?? "",
    lifestyle: answers.lifestyle ?? "",
    budget: answers.goals ?? "",
  };

  try {
    const routine = await postSkinQuiz(token, normalized, {
      fastApiUrl: context.env.FASTAPI_URL,
      request,
    });
    const headers: HeadersInit = {};
    if (setCookie) (headers as Record<string, string>)["Set-Cookie"] = setCookie;
    return json({ routine }, { status: 200, headers });
  } catch (err) {
    if (err instanceof FastApiError) {
      return json({ error: err.message, status: err.status }, { status: 502 });
    }
    return json(
      { error: "Skin quiz service is unavailable." },
      { status: 502 },
    );
  }
}

// ─── Client component state definitions ──────────────────────────────────

interface QuizAnswerState {
  skinType: string;
  concerns: string[];
  currentRoutine: string;
  lifestyle: string;
  goals: string;
}

const STEP_LABELS = ["Type", "Concerns", "Routine", "Lifestyle", "Goals"];

const SKIN_TYPE_OPTIONS = [
  { value: "oily", label: "Oily Skin", hint: "Shiny T-zone, enlarged pores" },
  { value: "dry", label: "Dry Skin", hint: "Tight, flaky, rough texture" },
  { value: "combination", label: "Combination", hint: "Oily T-zone, dry cheeks" },
  { value: "normal", label: "Normal Skin", hint: "Balanced, few concerns" },
  { value: "sensitive", label: "Sensitive", hint: "Easily irritated, reactive" },
];

const CONCERN_OPTIONS = [
  { value: "acne", label: "Acne & Breakouts" },
  { value: "aging", label: "Fine Lines & Aging" },
  { value: "dark spots", label: "Dark Spots & Pigmentation" },
  { value: "redness", label: "Redness & Irritation" },
  { value: "dehydration", label: "Dehydration & Dullness" },
  { value: "pores", label: "Large Pores & Texture" },
];

const ROUTINE_OPTIONS = [
  { value: "none", label: "Just Water", hint: "No products yet" },
  { value: "basic", label: "Cleanser + Moisture", hint: "The fundamentals" },
  { value: "moderate", label: "Add SPF Daily", hint: "Cleanser, moisturizer, sunscreen" },
  { value: "advanced", label: "Full Active Routine", hint: "Serums, retinoids, treatments" },
];

const LIFESTYLE_OPTIONS = [
  {
    value: "low",
    label: "Low Stress & Sleep Well",
    hint: "7-9h sleep, mostly indoors",
  },
  {
    value: "moderate",
    label: "Moderate Stress & Sun",
    hint: "Some sun exposure, occasional late nights",
  },
  {
    value: "high",
    label: "High Stress & Sun",
    hint: "Frequent travel, outdoor work, <6h sleep",
  },
];

const GOAL_OPTIONS = [
  { value: "anti-aging", label: "Anti-Aging & Firmness", hint: "Prevent lines, plump skin" },
  { value: "clear", label: "Clear & Calm Skin", hint: "Calm breakouts, soothe redness" },
  { value: "hydration", label: "Deep Bouncy Hydration", hint: "Plump, dewy, glass finish" },
  { value: "glow", label: "Radiance & Glow", hint: "Brightening, even skin tone" },
];

const STEP_TITLES = [
  "What's your skin type?",
  "What are your primary concerns?",
  "What's your current routine?",
  "Tell us about your lifestyle",
  "What are your goals?",
];

const STEP_SUBTITLES = [
  "Pick the closest match — we'll fine-tune from there.",
  "Select all that apply. We'll prioritize the top concerns.",
  "We'll build on what you're already using.",
  "Stress, sleep, and sun all impact your skin.",
  "The skin you want, in your own words.",
];

export default function SkinQuizRoute() {
  const fetcher = useFetcher<{
    routine?: RoutineResult;
    error?: string;
    status?: number;
  }>();

  const [step, setStep] = useState<1 | 2 | 3 | 4 | 5>(1);
  const [answers, setAnswers] = useState<QuizAnswerState>({
    skinType: "",
    concerns: [],
    currentRoutine: "",
    lifestyle: "",
    goals: "",
  });

  const submitting = fetcher.state !== "idle";
  const result = fetcher.data?.routine;
  const errorMessage = fetcher.data?.error;

  function canAdvance(): boolean {
    switch (step) {
      case 1:
        return answers.skinType.length > 0;
      case 2:
        return answers.concerns.length > 0;
      case 3:
        return answers.currentRoutine.length > 0;
      case 4:
        return answers.lifestyle.length > 0;
      case 5:
        return answers.goals.length > 0;
      default:
        return false;
    }
  }

  function next() {
    if (!canAdvance()) return;
    if (step < 5) {
      setStep((s) => (s + 1) as 1 | 2 | 3 | 4 | 5);
    } else {
      fetcher.submit(JSON.stringify({ answers }), {
        method: "POST",
        action: "/skin-quiz",
        encType: "application/json",
      });
    }
  }

  function back() {
    if (step > 1) setStep((s) => (s - 1) as 1 | 2 | 3 | 4 | 5);
  }

  function restart() {
    setStep(1);
    setAnswers({
      skinType: "",
      concerns: [],
      currentRoutine: "",
      lifestyle: "",
      goals: "",
    });
  }

  if (result) {
    return <ResultsView routine={result} onRestart={restart} />;
  }

  return (
    <main className="min-h-screen bg-brand-bg relative overflow-hidden flex flex-col justify-between">
      {/* Playful Background Glow Orbs */}
      <div className="absolute -top-10 -left-10 w-64 h-64 bg-brand-yellow/40 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute bottom-10 right-10 w-80 h-80 bg-brand-sky/30 rounded-full blur-3xl pointer-events-none"></div>
      <div className="absolute top-1/3 left-1/2 w-48 h-48 bg-brand-pink/50 rounded-full blur-2xl pointer-events-none"></div>

      {/* Main Container */}
      <div className="mx-auto max-w-4xl px-6 py-12 md:py-16 relative z-10 w-full">
        {/* Header Title Section */}
        <div className="text-center mb-10">
          <span className="inline-block bg-brand-yellow text-brand-text font-display font-bold text-xs uppercase tracking-wider px-5 py-2 -rotate-2 mb-4 border-2 border-brand-text shadow-play rounded-full">
            Skin Quiz ✨
          </span>
          <h1 className="font-display font-bold text-4xl md:text-6xl text-brand-text leading-tight mb-4">
            Your personalized <span className="text-brand-magenta">routine</span>
          </h1>
          <p className="font-rounded font-semibold text-lg text-brand-text/80 max-w-xl mx-auto">
            5 quick questions. Our AI advisor builds your custom AM/PM skincare ritual.
          </p>
        </div>

        {/* Quiz Card */}
        <div className="bg-white border-4 border-brand-text rounded-3xl p-6 md:p-12 shadow-play relative">
          <QuizStepIndicator
            current={step}
            total={5}
            labels={STEP_LABELS}
            className="mb-10 md:mb-12"
          />

          {/* Step Heading */}
          <div className="min-h-[300px]">
            <div className="mb-6">
              <h2 className="font-display font-bold text-2xl md:text-3xl text-brand-text mb-2">
                {STEP_TITLES[step - 1]}
              </h2>
              <p className="font-rounded font-semibold text-sm text-brand-text/70">
                {STEP_SUBTITLES[step - 1]}
              </p>
            </div>

            {step === 1 && (
              <OptionGrid
                options={SKIN_TYPE_OPTIONS}
                value={answers.skinType}
                onChange={(v) => setAnswers((a) => ({ ...a, skinType: v }))}
                multi={false}
              />
            )}
            {step === 2 && (
              <OptionGrid
                options={CONCERN_OPTIONS}
                values={answers.concerns}
                onToggle={(v) =>
                  setAnswers((a) => ({
                    ...a,
                    concerns: a.concerns.includes(v)
                      ? a.concerns.filter((x) => x !== v)
                      : [...a.concerns, v],
                  }))
                }
                multi
              />
            )}
            {step === 3 && (
              <OptionGrid
                options={ROUTINE_OPTIONS}
                value={answers.currentRoutine}
                onChange={(v) =>
                  setAnswers((a) => ({ ...a, currentRoutine: v }))
                }
                multi={false}
              />
            )}
            {step === 4 && (
              <OptionGrid
                options={LIFESTYLE_OPTIONS}
                value={answers.lifestyle}
                onChange={(v) => setAnswers((a) => ({ ...a, lifestyle: v }))}
                multi={false}
              />
            )}
            {step === 5 && (
              <OptionGrid
                options={GOAL_OPTIONS}
                value={answers.goals}
                onChange={(v) => setAnswers((a) => ({ ...a, goals: v }))}
                multi={false}
              />
            )}
          </div>

          {errorMessage && (
            <div className="mt-6 bg-red-100 border-2 border-red-500 text-red-700 px-4 py-3 rounded-xl font-rounded font-bold text-sm">
              ⚠️ {errorMessage}
            </div>
          )}

          {/* Navigation Bar */}
          <div className="mt-10 pt-6 border-t-2 border-brand-text/20 flex items-center justify-between gap-4">
            <button
              type="button"
              onClick={back}
              disabled={step === 1 || submitting}
              className="bg-white text-brand-text font-display font-bold text-xs uppercase tracking-widest px-6 py-3.5 border-2 border-brand-text rounded-xl shadow-play hover:bg-brand-yellow transition-all disabled:opacity-40 disabled:shadow-none cursor-pointer"
            >
              Back
            </button>

            <div className="font-display font-bold text-xs uppercase tracking-widest text-brand-text/60">
              Step {step} of 5
            </div>

            <button
              type="button"
              onClick={next}
              disabled={!canAdvance() || submitting}
              className="bg-brand-accent text-white font-display font-bold text-xs uppercase tracking-widest px-8 py-3.5 border-2 border-brand-text rounded-xl shadow-play hover:translate-y-0.5 hover:shadow-none transition-all disabled:opacity-40 disabled:shadow-none flex items-center gap-2 cursor-pointer"
            >
              {submitting ? (
                <>
                  <Spinner />
                  Building Ritual…
                </>
              ) : step === 5 ? (
                "Get My Routine ✨"
              ) : (
                <>
                  Continue
                  <ArrowRight />
                </>
              )}
            </button>
          </div>
        </div>

        <p className="text-center font-rounded font-semibold text-xs text-brand-text/70 mt-6">
          🔒 Your answers stay private. Zero account creation required.
        </p>
      </div>
    </main>
  );
}

// ─── Option grid components ──────────────────────────────────────────────

interface OptionDef {
  value: string;
  label: string;
  hint?: string;
}

interface OptionGridPropsBase {
  options: OptionDef[];
}

function OptionGridSingle({
  options,
  value,
  onChange,
}: OptionGridPropsBase & {
  value: string;
  onChange: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {options.map((opt) => {
        const selected = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={`text-left p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${
              selected
                ? "bg-brand-yellow text-brand-text border-4 border-brand-text shadow-play -translate-y-1"
                : "bg-white text-brand-text border-brand-text hover:bg-brand-pink/30 hover:shadow-play hover:-translate-y-0.5"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div>
                <div className="font-display font-bold text-lg text-brand-text">
                  {opt.label}
                </div>
                {opt.hint && (
                  <div className="font-rounded font-semibold text-xs text-brand-text/70 mt-1">
                    {opt.hint}
                  </div>
                )}
              </div>
              <div
                className={`h-6 w-6 rounded-full border-2 border-brand-text flex-shrink-0 transition-all flex items-center justify-center ${
                  selected ? "bg-brand-magenta text-white shadow-play" : "bg-white"
                }`}
              >
                {selected && (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="h-3.5 w-3.5 text-white"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function OptionGridMulti({
  options,
  values,
  onToggle,
}: OptionGridPropsBase & {
  values: string[];
  onToggle: (v: string) => void;
}) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {options.map((opt) => {
        const selected = values.includes(opt.value);
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onToggle(opt.value)}
            className={`text-left p-5 rounded-2xl border-2 transition-all duration-200 cursor-pointer ${
              selected
                ? "bg-brand-yellow text-brand-text border-4 border-brand-text shadow-play -translate-y-1"
                : "bg-white text-brand-text border-brand-text hover:bg-brand-pink/30 hover:shadow-play hover:-translate-y-0.5"
            }`}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="font-display font-bold text-lg text-brand-text">
                {opt.label}
              </div>
              <div
                className={`h-6 w-6 rounded-md border-2 border-brand-text flex-shrink-0 transition-all flex items-center justify-center ${
                  selected ? "bg-brand-magenta text-white shadow-play" : "bg-white"
                }`}
              >
                {selected && (
                  <svg
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="4"
                    className="h-3.5 w-3.5 text-white"
                  >
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                )}
              </div>
            </div>
          </button>
        );
      })}
    </div>
  );
}

function OptionGrid(
  props:
    | (OptionGridPropsBase & {
        value: string;
        onChange: (v: string) => void;
        multi?: false;
      })
    | (OptionGridPropsBase & {
        values: string[];
        onToggle: (v: string) => void;
        multi: true;
      }),
) {
  if (props.multi === true) {
    const { options, values, onToggle } = props;
    return <OptionGridMulti options={options} values={values} onToggle={onToggle} />;
  }
  const { options, value, onChange } = props as OptionGridPropsBase & {
    value: string;
    onChange: (v: string) => void;
  };
  return <OptionGridSingle options={options} value={value} onChange={onChange} />;
}

// ─── Results view ────────────────────────────────────────────────────────

function ResultsView({
  routine,
  onRestart,
}: {
  routine: RoutineResult;
  onRestart: () => void;
}) {
  return (
    <main className="min-h-screen bg-brand-bg py-12 px-6">
      <div className="mx-auto max-w-4xl">
        <div className="text-center mb-10">
          <span className="inline-block bg-brand-mint text-brand-text font-display font-bold text-xs uppercase tracking-wider px-5 py-2 rotate-2 mb-4 border-2 border-brand-text shadow-play rounded-full">
            Your AI Skin Routine ✨
          </span>
          <h1 className="font-display font-bold text-4xl md:text-6xl text-brand-text leading-tight mb-4">
            Made for <span className="text-brand-magenta">your skin</span>
          </h1>
          <button
            type="button"
            onClick={onRestart}
            className="bg-white text-brand-text font-display font-bold text-xs uppercase tracking-widest px-6 py-2.5 border-2 border-brand-text rounded-full shadow-play hover:bg-brand-yellow transition-all"
          >
            Retake Quiz ↺
          </button>
        </div>

        {/* Skin Profile Summary */}
        <div className="bg-white border-4 border-brand-text rounded-3xl p-8 md:p-10 shadow-play mb-10">
          <h2 className="font-display font-bold text-2xl text-brand-text mb-3">
            Your Skin Analysis
          </h2>
          <p className="font-rounded font-semibold text-base text-brand-text/80 leading-relaxed">
            {routine.skin_profile_summary}
          </p>
          {routine.routine_goal && (
            <div className="mt-6 pt-6 border-t-2 border-brand-text/20">
              <div className="font-display font-bold text-xs uppercase tracking-widest text-brand-text/60 mb-1">
                Primary Goal
              </div>
              <div className="font-display font-bold text-xl text-brand-magenta">
                {routine.routine_goal}
              </div>
            </div>
          )}
        </div>

        {/* Morning Routine */}
        <div className="bg-white border-4 border-brand-text rounded-3xl p-8 md:p-10 shadow-play mb-8">
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-brand-yellow text-brand-text text-xl p-3 border-2 border-brand-text shadow-play rounded-xl">
              ☀️
            </span>
            <h2 className="font-display font-bold text-3xl text-brand-text">
              Morning Ritual
            </h2>
          </div>
          <RoutineSteps steps={routine.morning_routine} />
        </div>

        {/* Evening Routine */}
        <div className="bg-white border-4 border-brand-text rounded-3xl p-8 md:p-10 shadow-play mb-10">
          <div className="flex items-center gap-3 mb-6">
            <span className="bg-brand-sky text-white text-xl p-3 border-2 border-brand-text shadow-play rounded-xl">
              🌙
            </span>
            <h2 className="font-display font-bold text-3xl text-brand-text">
              Evening Ritual
            </h2>
          </div>
          <RoutineSteps steps={routine.evening_routine} />
        </div>

        {/* CTA */}
        <div className="text-center">
          <Link
            to="/products"
            className="inline-block bg-brand-accent text-white font-display font-bold text-xs uppercase tracking-widest px-10 py-5 border-2 border-brand-text rounded-2xl shadow-play hover:translate-y-1 hover:shadow-none transition-all"
          >
            Shop Your Custom Routine 🛍️
          </Link>
        </div>
      </div>
    </main>
  );
}

function RoutineSteps({ steps }: { steps: RoutineResult["morning_routine"] }) {
  if (!steps || steps.length === 0) {
    return (
      <p className="font-rounded font-semibold text-sm text-brand-text/70">
        No steps returned for this routine.
      </p>
    );
  }
  return (
    <ol className="space-y-4">
      {steps.map((s) => (
        <li
          key={`${s.step}-${s.product_name}`}
          className="flex gap-4 p-5 rounded-2xl bg-brand-bg border-2 border-brand-text shadow-play"
        >
          <div className="flex-shrink-0 h-10 w-10 rounded-full bg-brand-magenta text-white font-display font-bold text-sm border-2 border-brand-text flex items-center justify-center shadow-play">
            {s.step}
          </div>
          <div className="flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="bg-brand-yellow text-brand-text text-[10px] uppercase font-bold px-2.5 py-0.5 border border-brand-text rounded-full">
                {s.action}
              </span>
              <h3 className="font-display font-bold text-xl text-brand-text">
                {s.product_name}
              </h3>
            </div>
            <p className="font-rounded font-semibold text-sm text-brand-text/80 mt-1">
              {s.how_to_use}
            </p>
            {s.why && (
              <p className="font-rounded font-semibold text-xs text-brand-magenta mt-2">
                Why: {s.why}
              </p>
            )}
          </div>
        </li>
      ))}
    </ol>
  );
}

function ArrowRight() {
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
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}

function Spinner() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
      className="h-4 w-4 animate-spin"
      aria-hidden="true"
    >
      <path d="M21 12a9 9 0 1 1-6.219-8.56" />
    </svg>
  );
}
