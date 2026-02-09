import { MobileShell, ViewHeader } from "@/components/MobileShell";
import { useApp } from "@/context/AppContext";
import { useEffect, useState } from "react";

export function HostQuestionPhaseView() {
  const { currentSession, nextRound, endSession } = useApp();
  if (!currentSession) return null;

  const { guests, currentRound, questionPool, pickedQuestions } = currentSession;
  const allPicked = guests.every((g) => g.hasPicked);
  const poolEmpty = questionPool.length === 0;

  return (
    <MobileShell>
      <ViewHeader
        title={`Round ${currentRound}`}
        subtitle={`${questionPool.length} questions remaining`}
        rightAction={
          <button onClick={endSession} className="text-xs text-red-400 font-medium">
            End
          </button>
        }
      />
      <div className="flex-1 px-5 pb-6">
        {/* Guest status grid */}
        <div className="space-y-2 mb-5">
          {guests.map((g) => {
            const pq = pickedQuestions.find((p) => p.guestNickname === g.nickname && p.round === currentRound);
            return (
              <div key={g.id} className="bg-white rounded-xl border border-stone-100 px-4 py-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${
                        g.hasPicked ? "bg-green-100 text-green-700" : "bg-stone-100 text-stone-500"
                      }`}
                    >
                      {g.hasPicked ? "✓" : g.nickname.charAt(0).toUpperCase()}
                    </div>
                    <div>
                      <span className="text-sm font-medium text-stone-800">{g.nickname}</span>
                      {pq && (
                        <p className="text-xs text-stone-500 mt-0.5 leading-snug max-w-[220px] truncate">
                          "{pq.questionText}"
                        </p>
                      )}
                    </div>
                  </div>
                  {!g.hasPicked && !poolEmpty && <span className="text-xs text-stone-400">Waiting...</span>}
                </div>
              </div>
            );
          })}
        </div>

        {/* Pool empty warning */}
        {poolEmpty && (
          <div className="bg-orange-50 border border-orange-200 rounded-xl px-4 py-3 mb-5">
            <p className="text-sm text-orange-800 font-medium">No more questions available!</p>
            <p className="text-xs text-orange-600 mt-1">All questions from the selected topics have been used.</p>
          </div>
        )}

        {/* Round controls */}
        <div className="space-y-3 mt-auto">
          {allPicked && !poolEmpty && (
            <button
              onClick={nextRound}
              className="w-full h-14 rounded-2xl bg-amber-800 text-amber-50 font-semibold text-[15px] hover:bg-amber-900 transition-colors active:scale-[0.98]"
            >
              Start Round {currentRound + 1}
            </button>
          )}
          {!allPicked && !poolEmpty && (
            <button
              onClick={nextRound}
              className="w-full h-11 rounded-xl bg-stone-200 text-stone-700 text-sm font-medium hover:bg-stone-300 transition-colors"
            >
              Skip to Next Round
            </button>
          )}
          <button
            onClick={endSession}
            className="w-full h-11 rounded-xl border border-stone-200 text-stone-600 text-sm font-medium hover:bg-stone-50 transition-colors"
          >
            End Gathering
          </button>
        </div>
      </div>
    </MobileShell>
  );
}

export function GuestQuestionPhaseView() {
  const { currentSession, currentGuestId, pickQuestion } = useApp();
  const [myQuestion, setMyQuestion] = useState<string | null>(null);
  const [myQuestionRound, setMyQuestionRound] = useState<number | null>(null);
  const [isAnimating, setIsAnimating] = useState(false);

  if (!currentSession || !currentGuestId) return null;

  const me = currentSession.guests.find((g) => g.id === currentGuestId);
  if (!me) return null;

  const poolEmpty = currentSession.questionPool.length === 0;

  const handlePick = async () => {
    if (!me || poolEmpty) return;
    setIsAnimating(true);
    setTimeout(async () => {
      const q = await pickQuestion(me.id);
      if (q) {
        setMyQuestion(q.text);
        setMyQuestionRound(currentSession.currentRound);
      }
      setIsAnimating(false);
    }, 800);
  };

  // Reset local state when a new round starts
  useEffect(() => {
    // If we have a question from a previous round, clear it
    if (myQuestion && myQuestionRound !== null && myQuestionRound < currentSession.currentRound) {
      console.log(`[Guest] Round changed from ${myQuestionRound} to ${currentSession.currentRound}, clearing question`);
      setMyQuestion(null);
      setMyQuestionRound(null);
    }
  }, [currentSession.currentRound, myQuestion, myQuestionRound]);

  return (
    <MobileShell>
      <div className="flex-1 flex flex-col items-center justify-center px-6 text-center">
        {myQuestion ? (
          <>
            <p className="text-amber-800 text-[10px] uppercase tracking-[0.2em] font-semibold mb-4">Your Question</p>
            <div className="bg-white rounded-2xl border-2 border-amber-200 px-6 py-8 shadow-sm w-full max-w-xs mb-6">
              <p className="text-lg font-bold text-stone-900 leading-snug">{myQuestion}</p>
            </div>
            <p className="text-stone-400 text-xs max-w-[240px]">
              Share your answer with the table. Your host will start the next round when everyone's ready.
            </p>
          </>
        ) : (
          <>
            <p className="text-stone-500 text-sm mb-2">Round {currentSession.currentRound}</p>
            <p className="text-stone-400 text-xs mb-8 max-w-[240px]">
              Tap the button to receive your question. Answer it out loud at the table.
            </p>

            {poolEmpty ? (
              <div className="bg-orange-50 border border-orange-200 rounded-xl px-6 py-4 w-full max-w-xs">
                <p className="text-sm text-orange-800 font-medium">No more questions!</p>
                <p className="text-xs text-orange-600 mt-1">The question pool has been exhausted.</p>
              </div>
            ) : (
              <button
                onClick={handlePick}
                disabled={isAnimating || !me || me.hasPicked}
                className={`w-40 h-40 rounded-full font-bold text-xl shadow-xl transition-all active:scale-95 ${
                  isAnimating
                    ? "bg-amber-600 text-amber-100 animate-spin scale-90"
                    : "bg-amber-800 text-amber-50 hover:bg-amber-900 hover:shadow-2xl"
                }`}
              >
                {isAnimating ? "..." : "PICK"}
              </button>
            )}
          </>
        )}
      </div>
    </MobileShell>
  );
}
