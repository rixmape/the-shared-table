import { MobileShell, ViewHeader } from "@/components/MobileShell";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/AppContext";
import { useState } from "react";

export function CreateSessionView() {
  const { setView, createSession } = useApp();

  return (
    <MobileShell>
      <ViewHeader title="Host a Gathering" onBack={() => setView("home")} />
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-12">
        <div className="w-20 h-20 rounded-3xl bg-amber-100 flex items-center justify-center mb-6">
          <svg
            width="36"
            height="36"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#92400e"
            strokeWidth="1.5"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <path d="M23 21v-2a4 4 0 00-3-3.87" />
            <path d="M16 3.13a4 4 0 010 7.75" />
          </svg>
        </div>
        <h2 className="text-xl font-bold text-stone-900 mb-2 text-center">Start a New Session</h2>
        <p className="text-stone-500 text-sm text-center mb-10 max-w-[260px] leading-relaxed">
          Create a gathering session and share the code with your guests.
        </p>
        <button
          onClick={createSession}
          className="w-full h-14 rounded-2xl bg-amber-800 text-amber-50 font-semibold text-[15px] hover:bg-amber-900 transition-colors shadow-sm active:scale-[0.98]"
        >
          Create Session
        </button>
      </div>
    </MobileShell>
  );
}

export function HostLobbyView() {
  const { setView, currentSession, addSimGuest, advancePhase, endSession } = useApp();
  const [guestName, setGuestName] = useState("");

  if (!currentSession) return null;
  const { code, guests } = currentSession;

  const handleAddGuest = () => {
    if (guestName.trim() && !guests.find((g) => g.nickname.toLowerCase() === guestName.trim().toLowerCase())) {
      addSimGuest(guestName.trim());
      setGuestName("");
    }
  };

  return (
    <MobileShell>
      <ViewHeader
        title="Session Lobby"
        subtitle="Waiting for guests"
        rightAction={
          <button
            onClick={() => {
              endSession();
              setView("home");
            }}
            className="text-xs text-red-400 font-medium"
          >
            Close
          </button>
        }
      />
      <div className="flex-1 px-5 pb-6">
        {/* Session code display */}
        <div className="bg-stone-900 rounded-2xl p-6 text-center mb-5">
          <p className="text-stone-400 text-[10px] uppercase tracking-[0.2em] mb-2">Session Code</p>
          <p className="text-4xl font-bold text-white tracking-[0.15em] font-mono">{code}</p>
          <p className="text-stone-500 text-xs mt-3">Share this code with your guests</p>
          {/* Simple QR placeholder */}
          <div className="mx-auto mt-4 w-28 h-28 bg-white rounded-xl flex items-center justify-center">
            <div className="grid grid-cols-5 gap-[2px]">
              {Array.from({ length: 25 }).map((_, i) => (
                <div
                  key={i}
                  className={`w-4 h-4 rounded-[2px] ${
                    [0, 1, 2, 3, 4, 5, 9, 10, 14, 15, 19, 20, 21, 22, 23, 24, 6, 8, 12, 16, 18].includes(i)
                      ? "bg-stone-900"
                      : "bg-stone-200"
                  }`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Add guest (simulation) */}
        <div className="mb-4">
          <p className="text-[10px] text-stone-400 uppercase tracking-wider mb-2 font-medium">Simulate Guest Joining</p>
          <div className="flex gap-2">
            <Input
              placeholder="Guest nickname..."
              value={guestName}
              onChange={(e) => setGuestName(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddGuest()}
              className="h-10 rounded-lg text-sm bg-white border-stone-200 flex-1"
            />
            <button
              onClick={handleAddGuest}
              disabled={!guestName.trim()}
              className="h-10 px-4 rounded-lg bg-stone-900 text-white text-sm font-medium disabled:opacity-40 shrink-0"
            >
              Join
            </button>
          </div>
        </div>

        {/* Guest list */}
        <div className="bg-white rounded-xl border border-stone-100 p-4 mb-6">
          <div className="flex items-center justify-between mb-3">
            <span className="text-[10px] text-stone-400 uppercase tracking-wider font-medium">Guests</span>
            <span className="text-xs font-semibold text-stone-600">{guests.length}</span>
          </div>
          {guests.length === 0 ? (
            <p className="text-stone-400 text-sm py-4 text-center">No guests yet</p>
          ) : (
            <div className="space-y-2">
              {guests.map((g) => (
                <div key={g.id} className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center text-amber-800 text-xs font-bold">
                    {g.nickname.charAt(0).toUpperCase()}
                  </div>
                  <span className="text-sm font-medium text-stone-700">{g.nickname}</span>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Proceed button */}
        <button
          onClick={() => advancePhase("voting")}
          disabled={guests.length === 0}
          className="w-full h-14 rounded-2xl bg-amber-800 text-amber-50 font-semibold text-[15px] disabled:opacity-40 disabled:cursor-not-allowed hover:bg-amber-900 transition-colors active:scale-[0.98]"
        >
          Start Topic Voting
        </button>
      </div>
    </MobileShell>
  );
}
