import { MobileShell } from "@/components/MobileShell";
import { useApp } from "@/context/AppContext";

export function EndedView() {
  const { setView, currentSession } = useApp();

  return (
    <MobileShell>
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        <div className="w-16 h-16 rounded-3xl bg-amber-100 flex items-center justify-center mb-6">
          <svg
            width="32"
            height="32"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#92400e"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20.84 4.61a5.5 5.5 0 00-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 00-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 000-7.78z" />
          </svg>
        </div>
        <h2 className="text-2xl font-bold text-stone-900 mb-2">
          Thank you for sharing
          <br />
          your table.
        </h2>
        <p className="text-stone-500 text-sm max-w-[260px] leading-relaxed mb-2">
          Great conversations happen when strangers become friends. See you at the next gathering.
        </p>
        {currentSession && (
          <p className="text-stone-400 text-xs mb-8 font-mono">
            Session {currentSession.code} · {currentSession.pickedQuestions.length} questions shared
          </p>
        )}
        <button
          onClick={() => setView("home")}
          className="w-full max-w-xs h-12 rounded-xl bg-stone-900 text-stone-50 font-semibold text-sm hover:bg-stone-800 transition-colors active:scale-[0.98]"
        >
          Back to Home
        </button>
      </div>
    </MobileShell>
  );
}
