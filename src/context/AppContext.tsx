import { ConnectionHealth } from "@/hooks/usePolling";
import { useSupabaseAuth } from "@/hooks/useSupabaseAuth";
import { useSupabaseSession } from "@/hooks/useSupabaseSession";
import { useSupabaseTopics } from "@/hooks/useSupabaseTopics";
import { supabase } from "@/lib/supabase";
import * as guestService from "@/services/guestService";
import * as questionService from "@/services/questionService";
import * as sessionService from "@/services/sessionService";
import type { AppView, Question, Session, SessionPhase, SessionRecord, Topic } from "@/types";
import { createContext, ReactNode, useCallback, useContext, useEffect, useState } from "react";

interface AppState {
  view: AppView;
  sessions: SessionRecord[];
  currentSessionId: string | null;
  currentGuestId: string | null;
}

interface AppContextType extends AppState {
  // Derived from hooks
  topics: Topic[];
  questions: Question[];
  currentSession: Session | null;
  isAdmin: boolean;
  loading: boolean;
  connected: boolean;
  connectionHealth?: ConnectionHealth;
  connectionMode?: "realtime" | "polling";
  lastUpdate?: Date | null;

  setView: (v: AppView) => void;

  // Admin
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => Promise<void>;
  addTopic: (name: string) => Promise<void>;
  editTopic: (id: string, name: string) => Promise<void>;
  removeTopic: (id: string) => Promise<void>;
  addQuestion: (topicId: string, text: string) => Promise<void>;
  editQuestion: (id: string, text: string, topicId: string) => Promise<void>;
  removeQuestion: (id: string) => Promise<void>;
  deleteSessionRecord: (id: string) => Promise<void>;

  // Session
  createSession: () => Promise<void>;
  joinSession: (code: string, nickname: string) => Promise<{ success: boolean; error?: string; guestId?: string }>;
  advancePhase: (phase: SessionPhase) => Promise<void>;

  // Voting
  submitVotes: (guestId: string, topicIds: string[]) => Promise<void>;

  // Topic confirm
  confirmTopics: (topicIds: string[]) => Promise<void>;

  // Question
  pickQuestion: (guestId: string) => Promise<Question | null>;
  nextRound: () => Promise<void>;
  endSession: () => Promise<void>;

  // Refresh functions
  refetchTopics: () => void;
  refetchSession: () => void;
  loadSessionHistory: () => Promise<void>;
}

const AppContext = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<AppState>({
    view: "home",
    sessions: [],
    currentSessionId: null,
    currentGuestId: null,
  });

  // Use hooks for Supabase integration
  const auth = useSupabaseAuth();
  const topicsHook = useSupabaseTopics();
  const sessionHook = useSupabaseSession({
    sessionId: state.currentSessionId,
    topics: topicsHook.topics,
    questions: topicsHook.questions,
  });

  // Load session history when admin logs in
  useEffect(() => {
    if (auth.isAuthenticated) {
      loadSessionHistory();
    }
  }, [auth.isAuthenticated]);

  // Sync guest view with session phase changes
  useEffect(() => {
    // Only run for guests (not hosts or admins)
    if (!state.currentGuestId || !sessionHook.session) {
      return;
    }

    const currentPhase = sessionHook.session.phase;

    // Map session phase to guest view
    const phaseToViewMap: Record<SessionPhase, AppView> = {
      lobby: "guestLobby",
      voting: "guestVoting",
      topicResults: "guestVoting", // Guests wait during host topic selection
      topicReveal: "guestVoting", // Guests wait during topic reveal
      questionPhase: "guestQuestionPhase",
      ended: "guestEnded",
    };

    const targetView = phaseToViewMap[currentPhase];

    // Only update view if it differs from target (prevent infinite loops)
    if (state.view !== targetView) {
      console.log(
        `[Guest View Sync] Phase changed to '${currentPhase}', updating view from '${state.view}' to '${targetView}'`,
      );
      setState((s) => ({ ...s, view: targetView }));
    }
  }, [state.currentGuestId, sessionHook.session?.phase, state.view]);

  const setView = useCallback((view: AppView) => {
    setState((s) => ({ ...s, view }));
  }, []);

  // ─── Admin ───
  const login = useCallback(
    async (email: string, password: string) => {
      const result = await auth.login(email, password);
      if (result.success) {
        setState((s) => ({ ...s, view: "admin" }));
      }
      return result;
    },
    [auth],
  );

  const logout = useCallback(async () => {
    await auth.logout();
    setState((s) => ({ ...s, view: "home", currentSessionId: null, currentGuestId: null }));
  }, [auth]);

  const addTopic = useCallback(
    async (name: string) => {
      try {
        const { error } = await supabase.from("topics").insert({ name });

        if (error) throw error;

        topicsHook.refetch();
      } catch (err) {
        console.error("Error adding topic:", err);
      }
    },
    [topicsHook],
  );

  const editTopic = useCallback(
    async (id: string, name: string) => {
      try {
        const { error } = await supabase.from("topics").update({ name }).eq("id", id);

        if (error) throw error;

        topicsHook.refetch();
      } catch (err) {
        console.error("Error editing topic:", err);
      }
    },
    [topicsHook],
  );

  const removeTopic = useCallback(
    async (id: string) => {
      try {
        // Questions will be cascade deleted due to ON DELETE CASCADE
        const { error } = await supabase.from("topics").delete().eq("id", id);

        if (error) throw error;

        topicsHook.refetch();
      } catch (err) {
        console.error("Error removing topic:", err);
      }
    },
    [topicsHook],
  );

  const addQuestion = useCallback(
    async (topicId: string, text: string) => {
      try {
        const { error } = await supabase.from("questions").insert({ topic_id: topicId, text });

        if (error) throw error;

        topicsHook.refetch();
      } catch (err) {
        console.error("Error adding question:", err);
      }
    },
    [topicsHook],
  );

  const editQuestion = useCallback(
    async (id: string, text: string, topicId: string) => {
      try {
        const { error } = await supabase.from("questions").update({ text, topic_id: topicId }).eq("id", id);

        if (error) throw error;

        topicsHook.refetch();
      } catch (err) {
        console.error("Error editing question:", err);
      }
    },
    [topicsHook],
  );

  const removeQuestion = useCallback(
    async (id: string) => {
      try {
        const { error } = await supabase.from("questions").delete().eq("id", id);

        if (error) throw error;

        topicsHook.refetch();
      } catch (err) {
        console.error("Error removing question:", err);
      }
    },
    [topicsHook],
  );

  const deleteSessionRecord = useCallback(async (id: string) => {
    try {
      const { error } = await supabase.from("session_records").delete().eq("id", id);

      if (error) throw error;

      await loadSessionHistory();
    } catch (err) {
      console.error("Error deleting session record:", err);
    }
  }, []);

  const loadSessionHistory = useCallback(async () => {
    try {
      const { data, error } = await supabase
        .from("session_records")
        .select("*")
        .order("end_time", { ascending: false });

      if (error) throw error;

      const records: SessionRecord[] = (data || []).map((record: any) => ({
        id: record.id,
        code: record.code,
        startTime: record.start_time,
        endTime: record.end_time,
        guestCount: record.guest_count,
        guests: record.guests_json.map((g: any) => g.nickname),
        confirmedTopics: record.confirmed_topics_json.map((t: any) => t.topics?.name || "Unknown"),
        pickedQuestions: record.picked_questions_json.map((pq: any) => ({
          questionId: pq.question_id,
          questionText: pq.questions?.text || "",
          topicName: pq.questions?.topics?.name || "Unknown",
          guestNickname: pq.guests?.nickname || "Unknown",
          round: pq.round,
        })),
      }));

      setState((s) => ({ ...s, sessions: records }));
    } catch (err) {
      console.error("Error loading session history:", err);
    }
  }, []);

  // ─── Session ───
  const createSession = useCallback(async () => {
    const result = await sessionService.createSession();
    if (result.success && result.session) {
      setState((s) => ({
        ...s,
        currentSessionId: result.session!.id,
        view: "hostLobby",
      }));
    }
  }, []);

  const joinSession = useCallback(async (code: string, nickname: string) => {
    // Validate session code
    const validation = await sessionService.validateSessionCode(code);
    if (!validation.valid) {
      return { success: false, error: validation.error };
    }

    // Join session
    const result = await guestService.joinSession(validation.session!.id, nickname);
    if (result.success && result.guest) {
      setState((s) => ({
        ...s,
        currentSessionId: validation.session!.id,
        currentGuestId: result.guest!.id,
        view: validation.session!.phase === "lobby" ? "guestLobby" : "guestVoting",
      }));

      return { success: true, guestId: result.guest.id };
    }

    return { success: false, error: result.error };
  }, []);

  const advancePhase = useCallback(
    async (phase: SessionPhase) => {
      if (!state.currentSessionId) return;

      await sessionService.advancePhase(state.currentSessionId, phase);

      // Update local view based on phase
      setState((s) => ({
        ...s,
        view:
          phase === "voting"
            ? "hostVoting"
            : phase === "topicResults"
              ? "hostTopicResults"
              : phase === "topicReveal"
                ? "topicReveal"
                : phase === "questionPhase"
                  ? "hostQuestionPhase"
                  : s.view,
      }));
    },
    [state.currentSessionId],
  );

  // ─── Voting ───
  const submitVotes = useCallback(
    async (guestId: string, topicIds: string[]) => {
      if (!state.currentSessionId) return;

      await guestService.submitVote(state.currentSessionId, guestId, topicIds);
    },
    [state.currentSessionId],
  );

  // ─── Topic Confirm ───
  const confirmTopics = useCallback(
    async (topicIds: string[]) => {
      if (!state.currentSessionId) return;

      await questionService.confirmTopics(state.currentSessionId, topicIds);

      // Advance to topic reveal
      await sessionService.advancePhase(state.currentSessionId, "topicReveal");

      setState((s) => ({ ...s, view: "topicReveal" }));
    },
    [state.currentSessionId],
  );

  // ─── Question ───
  const pickQuestion = useCallback(
    async (guestId: string): Promise<Question | null> => {
      if (!state.currentSessionId || !sessionHook.session) return null;

      const result = await questionService.pickQuestion(
        state.currentSessionId,
        guestId,
        sessionHook.session.currentRound,
      );

      if (result.success && result.question) {
        return {
          id: result.question.id,
          text: result.question.text,
          topicId: result.question.topicId,
        };
      }

      return null;
    },
    [state.currentSessionId, sessionHook.session],
  );

  const nextRound = useCallback(async () => {
    if (!state.currentSessionId) return;

    try {
      const { data, error } = await supabase.rpc("advance_round_atomic", {
        p_session_id: state.currentSessionId,
      });

      if (error) {
        console.error("Error advancing round:", error);
        // TODO: Show error to user
        return;
      }

      const result = data as {
        success: boolean;
        new_round?: number;
        error?: string;
      };

      if (!result.success) {
        console.error("Failed to advance round:", result.error);
        // TODO: Show error to user
      }
    } catch (err) {
      console.error("Exception advancing round:", err);
      // TODO: Show error to user
    }
  }, [state.currentSessionId]);

  const endSession = useCallback(async () => {
    if (!state.currentSessionId) return;

    await sessionService.endSession(state.currentSessionId);

    setState((s) => ({ ...s, view: "hostEnded" }));

    // Reload session history
    if (auth.isAuthenticated) {
      await loadSessionHistory();
    }
  }, [state.currentSessionId, auth.isAuthenticated, loadSessionHistory]);

  return (
    <AppContext.Provider
      value={{
        ...state,
        topics: topicsHook.topics,
        questions: topicsHook.questions,
        currentSession: sessionHook.session,
        isAdmin: auth.isAuthenticated,
        loading: auth.loading || topicsHook.loading || sessionHook.loading,
        connected: sessionHook.connected,
        connectionHealth: sessionHook.connectionHealth,
        connectionMode: sessionHook.connectionMode,
        lastUpdate: sessionHook.lastUpdate,
        setView,
        login,
        logout,
        addTopic,
        editTopic,
        removeTopic,
        addQuestion,
        editQuestion,
        removeQuestion,
        deleteSessionRecord,
        createSession,
        joinSession,
        advancePhase,
        submitVotes,
        confirmTopics,
        pickQuestion,
        nextRound,
        endSession,
        refetchTopics: topicsHook.refetch,
        refetchSession: sessionHook.refetch,
        loadSessionHistory,
      }}
    >
      {children}
    </AppContext.Provider>
  );
}

export function useApp() {
  const ctx = useContext(AppContext);
  if (!ctx) throw new Error("useApp must be used within AppProvider");
  return ctx;
}
