import { MobileShell, ViewHeader } from "@/components/MobileShell";
import { useApp } from "@/context/AppContext";
import { useMemo, useState } from "react";

export function HostTopicResultsView() {
  const { currentSession, topics, confirmTopics } = useApp();
  if (!currentSession) return null;

  const { votes } = currentSession;

  const tally = useMemo(() => {
    const counts: Record<string, number> = {};
    topics.forEach((t) => (counts[t.id] = 0));
    Object.values(votes).forEach((topicIds) => {
      topicIds.forEach((id) => {
        counts[id] = (counts[id] || 0) + 1;
      });
    });
    return topics.map((t) => ({ ...t, count: counts[t.id] || 0 })).sort((a, b) => b.count - a.count);
  }, [votes, topics]);

  const topThreeIds = tally.slice(0, 3).map((t) => t.id);
  const [selected, setSelected] = useState<string[]>(topThreeIds);

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((s) => s !== id));
    } else if (selected.length < 3) {
      setSelected([...selected, id]);
    }
  };

  return (
    <MobileShell>
      <ViewHeader title="Topic Results" subtitle="Confirm the top 3 or override" />
      <div className="flex-1 px-5 pb-6">
        <p className="text-stone-500 text-sm mb-4">
          Tap to select or deselect topics. You can override the vote results.
        </p>
        <div className="space-y-1.5 mb-6">
          {tally.map((t, i) => {
            const isSelected = selected.includes(t.id);
            return (
              <button
                key={t.id}
                onClick={() => toggle(t.id)}
                disabled={!isSelected && selected.length >= 3}
                className={`w-full text-left px-4 py-3 rounded-xl border-2 transition-all ${
                  isSelected ? "border-amber-600 bg-amber-50" : "border-stone-100 bg-white opacity-60"
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`w-7 h-7 rounded-lg flex items-center justify-center text-xs font-bold ${
                        isSelected ? "bg-amber-600 text-white" : "bg-stone-200 text-stone-500"
                      }`}
                    >
                      {i + 1}
                    </span>
                    <span className={`text-sm font-medium ${isSelected ? "text-amber-800" : "text-stone-600"}`}>
                      {t.name}
                    </span>
                  </div>
                  <span className="text-xs font-bold text-stone-400">
                    {t.count} vote{t.count !== 1 ? "s" : ""}
                  </span>
                </div>
              </button>
            );
          })}
        </div>

        <div className="text-center mb-4">
          <span className="text-xs text-stone-400">{selected.length}/3 selected</span>
        </div>

        <button
          onClick={() => confirmTopics(selected)}
          disabled={selected.length !== 3}
          className="w-full h-14 rounded-2xl bg-amber-800 text-amber-50 font-semibold text-[15px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-900 transition-colors active:scale-[0.98]"
        >
          Reveal Topics to Guests
        </button>
      </div>
    </MobileShell>
  );
}

export function TopicRevealView() {
  const { currentSession, advancePhase } = useApp();
  const [revealed, setRevealed] = useState(false);

  if (!currentSession) return null;
  const { confirmedTopics } = currentSession;

  const handleContinue = () => {
    advancePhase("questionPhase");
  };

  return (
    <MobileShell>
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        {!revealed ? (
          <>
            <p className="text-amber-800 text-xs uppercase tracking-[0.2em] font-semibold mb-4">Tonight's Topics</p>
            <button
              onClick={() => setRevealed(true)}
              className="w-32 h-32 rounded-full bg-amber-800 text-amber-50 font-bold text-lg shadow-lg hover:bg-amber-900 transition-all active:scale-95 animate-pulse"
            >
              Reveal
            </button>
          </>
        ) : (
          <>
            <p className="text-amber-800 text-xs uppercase tracking-[0.2em] font-semibold mb-6">
              Tonight's Topics Are...
            </p>
            <div className="space-y-3 w-full max-w-xs mb-10">
              {confirmedTopics.map((t, i) => (
                <div
                  key={t.id}
                  className="bg-white rounded-2xl border-2 border-amber-200 px-5 py-4 shadow-sm"
                  style={{ animationDelay: `${i * 200}ms` }}
                >
                  <span className="text-xs text-amber-600 font-semibold mb-1 block">#{i + 1}</span>
                  <span className="text-lg font-bold text-stone-900">{t.name}</span>
                </div>
              ))}
            </div>
            <button
              onClick={handleContinue}
              className="w-full max-w-xs h-14 rounded-2xl bg-amber-800 text-amber-50 font-semibold text-[15px] hover:bg-amber-900 transition-colors active:scale-[0.98]"
            >
              Start Questions
            </button>
          </>
        )}
      </div>
    </MobileShell>
  );
}
