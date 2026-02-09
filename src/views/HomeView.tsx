import { MobileShell } from "@/components/MobileShell";
import { useApp } from "@/context/AppContext";

export function HomeView() {
  const { setView } = useApp();
  return (
    <MobileShell>
      <div className="flex-1 flex flex-col px-6 pt-16 pb-8">
        {/* Logo area */}
        <div className="mb-12">
          <div className="w-14 h-14 rounded-2xl bg-amber-800 flex items-center justify-center mb-5 shadow-md">
            <svg
              width="28"
              height="28"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#fef3c7"
              strokeWidth="1.8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M3 11h18M5 11V6a2 2 0 012-2h10a2 2 0 012 2v5M7 11v7a2 2 0 002 2h6a2 2 0 002-2v-7" />
              <line x1="12" y1="4" x2="12" y2="11" />
            </svg>
          </div>
          <h1 className="text-3xl font-bold tracking-tight text-stone-900 leading-none">
            The Shared
            <br />
            Table
          </h1>
          <p className="text-stone-500 text-sm mt-3 leading-relaxed max-w-[280px]">
            Share a meal. Share a story.
            <br />
            Baguio City community gatherings.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-3 mt-auto">
          <button
            onClick={() => setView("createSession")}
            className="w-full h-14 rounded-2xl bg-amber-800 text-amber-50 font-semibold text-[15px] tracking-wide hover:bg-amber-900 transition-colors shadow-sm active:scale-[0.98]"
          >
            Host a Gathering
          </button>
          <button
            onClick={() => setView("joinSession")}
            className="w-full h-14 rounded-2xl bg-stone-900 text-stone-50 font-semibold text-[15px] tracking-wide hover:bg-stone-800 transition-colors shadow-sm active:scale-[0.98]"
          >
            Join a Session
          </button>
          <button
            onClick={() => setView("adminLogin")}
            className="w-full h-11 rounded-xl text-stone-400 text-sm font-medium hover:text-stone-600 transition-colors"
          >
            Organizer Panel
          </button>
        </div>
      </div>
    </MobileShell>
  );
}
