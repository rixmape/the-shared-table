import { MobileShell, ViewHeader } from "@/components/MobileShell";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/AppContext";
import { useState } from "react";

export function AdminLoginView() {
  const { setView, login } = useApp();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleLogin = () => {
    if (!login(password)) {
      setError("Incorrect password");
      setPassword("");
    }
  };

  return (
    <MobileShell>
      <ViewHeader title="Organizer Login" onBack={() => setView("home")} />
      <div className="flex-1 flex flex-col px-6 pt-8">
        <p className="text-stone-500 text-sm mb-6">
          Enter the admin password to manage topics, questions, and session history.
        </p>
        <div className="space-y-3">
          <Input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => {
              setPassword(e.target.value);
              setError("");
            }}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="h-12 rounded-xl border-stone-200 bg-white text-base px-4"
          />
          {error && <p className="text-red-500 text-xs pl-1">{error}</p>}
          <button
            onClick={handleLogin}
            disabled={!password}
            className="w-full h-12 rounded-xl bg-stone-900 text-stone-50 font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-800 transition-colors active:scale-[0.98]"
          >
            Sign In
          </button>
        </div>
        <p className="text-stone-400 text-xs mt-4 text-center">
          Hint: <span className="font-mono text-stone-500">sharedtable2026</span>
        </p>
      </div>
    </MobileShell>
  );
}
