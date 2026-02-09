import { MobileShell, ViewHeader } from "@/components/MobileShell";
import { useApp } from "@/context/AppContext";
import { useMemo, useState } from "react";

export function HostVotingView() {
  const { currentSession, topics, advancePhase } = useApp();
  if (!currentSession) return null;

  const { guests, votes } = currentSession;
  const allVoted = guests.every((g) => g.hasVoted);

  // Tally votes
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

  return (
    <MobileShell>
      <ViewHeader title="Topic Voting" subtitle={`${Object.keys(votes).length}/${guests.length} voted`} />
      <div className="flex-1 px-5 pb-6">
        {/* Guest status */}
        <div className="flex flex-wrap gap-1.5 mb-5">
          {guests.map((g) => (
            <span
              key={g.id}
              className={`px-2.5 py-1 rounded-lg text-xs font-medium ${
                g.hasVoted ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-500"
              }`}
            >
              {g.nickname} {g.hasVoted ? "✓" : "..."}
            </span>
          ))}
        </div>

        {/* Tally */}
        {Object.keys(votes).length > 0 && (
          <div className="space-y-1.5 mb-6">
            <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-2 font-medium">Live Results</p>
            {tally.map((t, i) => (
              <div key={t.id} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between mb-1">
                    <span className={`text-sm font-medium ${i < 3 ? "text-amber-800" : "text-stone-600"}`}>
                      {t.name}
                    </span>
                    <span className="text-xs font-bold text-stone-500">{t.count}</span>
                  </div>
                  <div className="w-full h-2 bg-stone-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${i < 3 ? "bg-amber-600" : "bg-stone-300"}`}
                      style={{ width: `${guests.length > 0 ? (t.count / guests.length) * 100 : 0}%` }}
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Proceed */}
        {allVoted && (
          <button
            onClick={() => advancePhase("topicResults")}
            className="w-full h-14 rounded-2xl bg-amber-800 text-amber-50 font-semibold text-[15px] hover:bg-amber-900 transition-colors active:scale-[0.98]"
          >
            View Results & Choose Topics
          </button>
        )}
      </div>
    </MobileShell>
  );
}

export function GuestVotingView() {
  const { currentSession, currentGuestId, topics, submitVotes } = useApp();
  const [selected, setSelected] = useState<string[]>([]);

  if (!currentSession || !currentGuestId) return null;

  const me = currentSession.guests.find((g) => g.id === currentGuestId);
  if (!me) return null;

  const submitted = me.hasVoted;

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((s) => s !== id));
    } else if (selected.length < 3) {
      setSelected([...selected, id]);
    }
  };

  const handleSubmit = () => {
    if (me && selected.length === 3) {
      submitVotes(me.id, selected);
    }
  };

  if (submitted) {
    return (
      <MobileShell>
        <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
          <div className="w-12 h-12 rounded-full bg-green-100 flex items-center justify-center mb-4">
            <svg
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#15803d"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="text-lg font-bold text-stone-900 mb-1">Votes Submitted!</h2>
          <p className="text-stone-500 text-sm">Waiting for the host to reveal topics...</p>
          <div className="mt-6 flex items-center gap-2">
            <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
            <span className="text-xs text-stone-400">Waiting for host</span>
          </div>
        </div>
      </MobileShell>
    );
  }

  return (
    <MobileShell>
      <ViewHeader title="Pick Your Topics" subtitle={`${selected.length} of 3 selected`} />
      <div className="flex-1 px-5 pb-6">
        <p className="text-stone-500 text-sm mb-4">Choose 3 topics you'd love to talk about today.</p>
        <div className="space-y-2 mb-6">
          {topics.map((t) => {
            const isSelected = selected.includes(t.id);
            const isDisabled = !isSelected && selected.length >= 3;
            return (
              <button
                key={t.id}
                onClick={() => toggle(t.id)}
                disabled={isDisabled}
                className={`w-full text-left px-4 py-3.5 rounded-xl border-2 transition-all ${
                  isSelected
                    ? "border-amber-600 bg-amber-50"
                    : isDisabled
                      ? "border-stone-100 bg-stone-50 opacity-40"
                      : "border-stone-100 bg-white hover:border-stone-200"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className={`text-sm font-medium ${isSelected ? "text-amber-800" : "text-stone-700"}`}>
                    {t.name}
                  </span>
                  {isSelected && (
                    <div className="w-5 h-5 rounded-full bg-amber-600 flex items-center justify-center">
                      <svg
                        width="12"
                        height="12"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="white"
                        strokeWidth="3"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      >
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    </div>
                  )}
                </div>
              </button>
            );
          })}
        </div>

        <button
          onClick={handleSubmit}
          disabled={selected.length !== 3}
          className="w-full h-14 rounded-2xl bg-amber-800 text-amber-50 font-semibold text-[15px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-900 transition-colors active:scale-[0.98]"
        >
          Submit Votes
        </button>
      </div>
    </MobileShell>
  );
}
