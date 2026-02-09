import { MobileShell, ViewHeader } from "@/components/MobileShell";
import { Input } from "@/components/ui/input";
import { useApp } from "@/context/AppContext";
import { useState } from "react";

export function AdminLoginView() {
  const { setView, login } = useApp();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setLoading(true);
    setError("");

    const result = await login(email, password);

    if (!result.success) {
      setError(result.error || "Login failed");
      setPassword("");
    }

    setLoading(false);
  };

  return (
    <MobileShell>
      <ViewHeader title="Organizer Login" onBack={() => setView("home")} />
      <div className="flex-1 flex flex-col px-6 pt-8">
        <p className="text-stone-500 text-sm mb-6">
          Sign in with your admin account to manage topics, questions, and session history.
        </p>
        <div className="space-y-3">
          <Input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => {
              setEmail(e.target.value);
              setError("");
            }}
            className="h-12 rounded-xl border-stone-200 bg-white text-base px-4"
          />
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
            disabled={!email || !password || loading}
            className="w-full h-12 rounded-xl bg-stone-900 text-stone-50 font-semibold text-sm disabled:opacity-40 disabled:cursor-not-allowed hover:bg-stone-800 transition-colors active:scale-[0.98]"
          >
            {loading ? "Signing In..." : "Sign In"}
          </button>
        </div>
      </div>
    </MobileShell>
  );
}
