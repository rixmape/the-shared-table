import { MobileShell, ViewHeader } from "@/components/MobileShell";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/AppContext";
import { useState } from "react";

export function JoinSessionView() {
  const { setView, currentSession, addSimGuest } = useApp();
  const [code, setCode] = useState("");
  const [nickname, setNickname] = useState("");
  const [step, setStep] = useState<"code" | "nickname">("code");
  const [error, setError] = useState("");

  const handleCodeSubmit = () => {
    if (!currentSession) {
      setError("No active session. Ask the host to create one first.");
      return;
    }
    if (code.toUpperCase() !== currentSession.code) {
      setError("Session not found. Check the code and try again.");
      return;
    }
    setError("");
    setStep("nickname");
  };

  const handleJoin = () => {
    if (!nickname.trim()) {
      setError("Please enter a nickname.");
      return;
    }
    if (currentSession?.guests.find((g) => g.nickname.toLowerCase() === nickname.trim().toLowerCase())) {
      setError("That nickname is taken. Pick another.");
      return;
    }
    addSimGuest(nickname.trim());
    setView("guestLobby");
  };

  return (
    <MobileShell>
      <ViewHeader title="Join a Session" onBack={() => setView("home")} />
      <div className="flex-1 px-6 pt-8">
        {step === "code" ? (
          <>
            <div className="w-16 h-16 rounded-2xl bg-stone-200 flex items-center justify-center mb-5 mx-auto">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#44403c"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-center mb-1">Enter Session Code</h2>
            <p className="text-stone-500 text-sm text-center mb-6">Ask your host for the 5-character code.</p>
            <Input
              placeholder="e.g. ABC12"
              value={code}
              onChange={(e) => {
                setCode(e.target.value.toUpperCase());
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleCodeSubmit()}
              maxLength={6}
              className="h-14 rounded-xl border-stone-200 bg-white text-center text-2xl font-mono tracking-[0.2em] uppercase"
            />
            {error && <p className="text-red-500 text-xs mt-2 text-center">{error}</p>}
            <button
              onClick={handleCodeSubmit}
              disabled={code.length < 5}
              className="w-full h-12 rounded-xl bg-stone-900 text-stone-50 font-semibold text-sm mt-4 disabled:opacity-40 hover:bg-stone-800 transition-colors active:scale-[0.98]"
            >
              Find Session
            </button>
          </>
        ) : (
          <>
            <div className="w-16 h-16 rounded-2xl bg-amber-100 flex items-center justify-center mb-5 mx-auto">
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#92400e"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2" />
                <circle cx="12" cy="7" r="4" />
              </svg>
            </div>
            <h2 className="text-lg font-bold text-center mb-1">What's your name?</h2>
            <p className="text-stone-500 text-sm text-center mb-6">Pick a nickname for this gathering.</p>
            <Input
              placeholder="Your nickname"
              value={nickname}
              onChange={(e) => {
                setNickname(e.target.value);
                setError("");
              }}
              onKeyDown={(e) => e.key === "Enter" && handleJoin()}
              className="h-12 rounded-xl border-stone-200 bg-white text-base px-4"
              autoFocus
            />
            {error && <p className="text-red-500 text-xs mt-2 text-center">{error}</p>}
            <button
              onClick={handleJoin}
              disabled={!nickname.trim()}
              className="w-full h-12 rounded-xl bg-amber-800 text-amber-50 font-semibold text-sm mt-4 disabled:opacity-40 hover:bg-amber-900 transition-colors active:scale-[0.98]"
            >
              Join Table
            </button>
          </>
        )}
      </div>
    </MobileShell>
  );
}

export function GuestLobbyView() {
  const { currentSession } = useApp();
  if (!currentSession) return null;

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
        <h2 className="text-lg font-bold text-stone-900 mb-1">You're In!</h2>
        <p className="text-stone-500 text-sm mb-6">Waiting for the host to begin...</p>
        <div className="bg-white rounded-xl border border-stone-100 p-4 w-full max-w-xs">
          <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-2 font-medium">Session</p>
          <p className="font-mono text-xl font-bold text-stone-800 tracking-widest mb-3">{currentSession.code}</p>
          <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-2 font-medium">
            Guests ({currentSession.guests.length})
          </p>
          <div className="flex flex-wrap gap-1.5">
            {currentSession.guests.map((g) => (
              <span key={g.id} className="px-2.5 py-1 bg-stone-100 rounded-lg text-xs font-medium text-stone-600">
                {g.nickname}
              </span>
            ))}
          </div>
        </div>
        <div className="mt-8 flex items-center gap-2">
          <div className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse" />
          <span className="text-xs text-stone-400">Waiting for host</span>
        </div>
      </div>
    </MobileShell>
  );
}
