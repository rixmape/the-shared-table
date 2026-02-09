import { REALTIME_ENABLED, supabase } from "@/lib/supabase";
import type { Guest, PickedQuestion, Question, Session, SessionPhase, Topic } from "@/types";
import type { RealtimePayload } from "@/types/realtime";
import { mergeGuests, mergePickedQuestions, mergeVotes } from "@/utils/polling";
import { useCallback, useEffect, useState } from "react";
import { usePolling } from "./usePolling";
import { useSupabaseRealtime } from "./useSupabaseRealtime";

interface UseSupabaseSessionOptions {
  sessionId: string | null;
  topics: Topic[];
  questions: Question[];
}

type ConnectionMode = "realtime" | "polling";

interface ConnectionModeState {
  mode: ConnectionMode;
  realtimeHealth: "healthy" | "degraded" | "failed";
  lastModeSwitch: Date | null;
}

export function useSupabaseSession({ sessionId, topics, questions }: UseSupabaseSessionOptions) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastPollTime, setLastPollTime] = useState<Date>(new Date());
  const [lastSessionUpdate, setLastSessionUpdate] = useState<Date>(new Date());
  const [connectionMode, setConnectionMode] = useState<ConnectionModeState>({
    mode: REALTIME_ENABLED ? "realtime" : "polling",
    realtimeHealth: "healthy",
    lastModeSwitch: null,
  });

  const loadSessionData = useCallback(
    async (sid: string) => {
      try {
        setLoading(true);
        setError(null);

        // Fetch session
        const { data: sessionData, error: sessionError } = await supabase
          .from("sessions")
          .select("*")
          .eq("id", sid)
          .single();

        if (sessionError) throw sessionError;

        // Fetch guests
        const { data: guestsData, error: guestsError } = await supabase
          .from("guests")
          .select("*")
          .eq("session_id", sid)
          .order("joined_at");

        if (guestsError) throw guestsError;

        // Fetch votes
        const { data: votesData, error: votesError } = await supabase.from("votes").select("*").eq("session_id", sid);

        if (votesError) throw votesError;

        // Fetch confirmed topics
        const { data: sessionTopicsData, error: topicsError } = await supabase
          .from("session_topics")
          .select("topic_id")
          .eq("session_id", sid);

        if (topicsError) throw topicsError;

        // Fetch question pool
        const { data: poolData, error: poolError } = await supabase
          .from("question_pool")
          .select(
            `
          question_id,
          position,
          picked
        `,
          )
          .eq("session_id", sid)
          .order("position");

        if (poolError) throw poolError;

        // Fetch picked questions
        const { data: pickedData, error: pickedError } = await supabase
          .from("picked_questions")
          .select(
            `
          question_id,
          round,
          guests(nickname),
          questions(text, topic_id, topics(name))
        `,
          )
          .eq("session_id", sid);

        if (pickedError) throw pickedError;

        // Transform data
        const guests: Guest[] = (guestsData || []).map((g) => ({
          id: g.id,
          sessionId: g.session_id,
          nickname: g.nickname,
          hasVoted: g.has_voted,
          hasPicked: g.has_picked,
          pickedQuestionId: g.picked_question_id,
          joined_at: g.joined_at,
        }));

        const votes: Record<string, string[]> = {};
        votesData?.forEach((vote) => {
          if (!votes[vote.guest_id]) {
            votes[vote.guest_id] = [];
          }
          votes[vote.guest_id].push(vote.topic_id);
        });

        const confirmedTopicIds = sessionTopicsData?.map((st) => st.topic_id) || [];
        const confirmedTopics = topics.filter((t) => confirmedTopicIds.includes(t.id));

        const questionPoolIds = poolData?.filter((p) => !p.picked).map((p) => p.question_id) || [];
        const questionPool = questions.filter((q) => questionPoolIds.includes(q.id));

        const pickedQuestions: PickedQuestion[] = (pickedData || []).map((p: any) => ({
          questionId: p.question_id,
          questionText: p.questions.text,
          topicName: p.questions.topics.name,
          guestNickname: p.guests.nickname,
          round: p.round,
        }));

        setSession({
          id: sessionData.id,
          code: sessionData.code,
          phase: sessionData.phase as SessionPhase,
          guests,
          votes,
          confirmedTopics,
          questionPool,
          pickedQuestions,
          currentRound: sessionData.current_round,
          startTime: sessionData.start_time,
          endTime: sessionData.end_time,
          created_at: sessionData.created_at,
          updated_at: sessionData.updated_at,
        });

        setConnected(true);
      } catch (err) {
        const errorMessage = err instanceof Error ? err.message : "Failed to load session";
        setError(errorMessage);
        console.error("Error loading session:", err);
      } finally {
        setLoading(false);
      }
    },
    [topics, questions],
  );

  // Incremental fetch functions for polling
  const fetchNewGuests = useCallback(async (sid: string, since: Date) => {
    const { data, error } = await supabase
      .from("guests")
      .select("*")
      .eq("session_id", sid)
      .gt("joined_at", since.toISOString())
      .order("joined_at");

    if (error) throw error;
    return data || [];
  }, []);

  const fetchNewVotes = useCallback(async (sid: string, since: Date) => {
    const { data, error } = await supabase
      .from("votes")
      .select("*")
      .eq("session_id", sid)
      .gt("created_at", since.toISOString());

    if (error) throw error;
    return data || [];
  }, []);

  const fetchNewPickedQuestions = useCallback(async (sid: string, since: Date) => {
    const { data, error } = await supabase
      .from("picked_questions")
      .select(
        `
        question_id,
        round,
        guests(nickname),
        questions(text, topic_id, topics(name))
      `,
      )
      .eq("session_id", sid)
      .gt("picked_at", since.toISOString());

    if (error) throw error;
    return data || [];
  }, []);

  const checkSessionUpdate = useCallback(async (sid: string) => {
    const { data, error } = await supabase
      .from("sessions")
      .select("updated_at, phase, current_round")
      .eq("id", sid)
      .single();

    if (error) throw error;
    return data;
  }, []);

  // Incremental poll handler - fetches only new data since last poll
  const handleIncrementalPoll = useCallback(async () => {
    if (!sessionId) return;

    try {
      // Fetch new data in parallel
      const [sessionUpdate, newGuests, newVotes, newPicks] = await Promise.all([
        checkSessionUpdate(sessionId),
        fetchNewGuests(sessionId, lastPollTime),
        fetchNewVotes(sessionId, lastPollTime),
        fetchNewPickedQuestions(sessionId, lastPollTime),
      ]);

      setSession((prev) => {
        if (!prev) return prev;

        const updatedSession = { ...prev };

        // Merge new guests
        if (newGuests.length > 0) {
          console.log(`[Polling] Merging ${newGuests.length} new guests`);
          const transformedGuests: Guest[] = newGuests.map((g) => ({
            id: g.id,
            sessionId: g.session_id,
            nickname: g.nickname,
            hasVoted: g.has_voted,
            hasPicked: g.has_picked,
            pickedQuestionId: g.picked_question_id,
            joined_at: g.joined_at,
          }));
          updatedSession.guests = mergeGuests(prev.guests, transformedGuests);
        }

        // Merge new votes
        if (newVotes.length > 0) {
          console.log(`[Polling] Merging ${newVotes.length} new votes`);
          updatedSession.votes = mergeVotes(prev.votes, newVotes);
        }

        // Merge new picked questions
        if (newPicks.length > 0) {
          console.log(`[Polling] Merging ${newPicks.length} new picked questions`);
          const transformedPicks: PickedQuestion[] = newPicks.map((p: any) => ({
            questionId: p.question_id,
            questionText: p.questions.text,
            topicName: p.questions.topics.name,
            guestNickname: p.guests.nickname,
            round: p.round,
          }));
          updatedSession.pickedQuestions = mergePickedQuestions(prev.pickedQuestions, transformedPicks);
        }

        // Update session metadata if changed
        const newUpdateTime = new Date(sessionUpdate.updated_at);
        if (newUpdateTime > lastSessionUpdate) {
          console.log("[Polling] Session metadata updated");
          updatedSession.phase = sessionUpdate.phase as SessionPhase;
          updatedSession.currentRound = sessionUpdate.current_round;
          updatedSession.updated_at = sessionUpdate.updated_at;
          setLastSessionUpdate(newUpdateTime);
        }

        return updatedSession;
      });

      setLastPollTime(new Date());
    } catch (err) {
      console.error("[Polling] Incremental poll failed:", err);
      throw err;
    }
  }, [
    sessionId,
    lastPollTime,
    lastSessionUpdate,
    fetchNewGuests,
    fetchNewVotes,
    fetchNewPickedQuestions,
    checkSessionUpdate,
  ]);

  // Full reload handler - wraps loadSessionData
  const handleFullReload = useCallback(async () => {
    if (!sessionId) return;
    console.log("[Polling] Executing full reload");
    await loadSessionData(sessionId);
    setLastPollTime(new Date());
  }, [sessionId, loadSessionData]);

  // Realtime event handlers
  const handleRealtimeGuestInsert = useCallback((payload: RealtimePayload) => {
    // payload.new is already transformed by useSupabaseRealtime
    const newGuest: Guest = {
      id: payload.new.id,
      sessionId: payload.new.sessionId,
      nickname: payload.new.nickname,
      hasVoted: payload.new.hasVoted || false,
      hasPicked: payload.new.hasPicked || false,
      pickedQuestionId: payload.new.pickedQuestionId || null,
      joined_at: payload.new.joinedAt,
    };

    setSession((prev) => {
      if (!prev) return prev;
      // Deduplicate by ID
      const exists = prev.guests.some((g) => g.id === newGuest.id);
      if (exists) {
        console.log("[Realtime] Guest already exists, skipping duplicate:", newGuest.id);
        return prev;
      }
      console.log("[Realtime] Adding new guest:", newGuest.nickname);
      return { ...prev, guests: [...prev.guests, newGuest] };
    });
  }, []);

  const handleRealtimeGuestUpdate = useCallback((payload: RealtimePayload) => {
    // payload.new is already transformed by useSupabaseRealtime
    const updatedGuest: Guest = {
      id: payload.new.id,
      sessionId: payload.new.sessionId,
      nickname: payload.new.nickname,
      hasVoted: payload.new.hasVoted || false,
      hasPicked: payload.new.hasPicked || false,
      pickedQuestionId: payload.new.pickedQuestionId || null,
      joined_at: payload.new.joinedAt,
    };

    setSession((prev) => {
      if (!prev) return prev;

      // Find and update the guest
      const guestIndex = prev.guests.findIndex((g) => g.id === updatedGuest.id);
      if (guestIndex === -1) {
        console.log("[Realtime] Guest not found for update, ignoring:", updatedGuest.id);
        return prev;
      }

      const updatedGuests = [...prev.guests];
      updatedGuests[guestIndex] = updatedGuest;

      console.log("[Realtime] Updating guest:", updatedGuest.nickname, {
        hasVoted: updatedGuest.hasVoted,
        hasPicked: updatedGuest.hasPicked,
      });

      return { ...prev, guests: updatedGuests };
    });
  }, []);

  const handleRealtimeVoteInsert = useCallback((payload: RealtimePayload) => {
    const vote = {
      guestId: payload.new.guestId,
      topicId: payload.new.topicId,
    };

    setSession((prev) => {
      if (!prev) return prev;

      const updatedVotes = { ...prev.votes };
      if (!updatedVotes[vote.guestId]) {
        updatedVotes[vote.guestId] = [];
      }

      // Deduplicate
      if (updatedVotes[vote.guestId].includes(vote.topicId)) {
        console.log("[Realtime] Vote already exists, skipping duplicate");
        return prev;
      }

      updatedVotes[vote.guestId] = [...updatedVotes[vote.guestId], vote.topicId];
      console.log("[Realtime] Adding new vote for guest:", vote.guestId);
      return { ...prev, votes: updatedVotes };
    });
  }, []);

  const handleRealtimePickedQuestionInsert = useCallback(
    (_payload: RealtimePayload) => {
      // Need to fetch the full question details since Realtime only gives us IDs
      // For now, we'll let polling handle this or implement a fetch here
      console.log("[Realtime] Picked question event received, triggering refresh");
      if (sessionId) {
        handleFullReload();
      }
    },
    [sessionId, handleFullReload],
  );

  const handleRealtimeSessionTopicInsert = useCallback(
    (payload: RealtimePayload) => {
      const topicId = payload.new.topicId;

      setSession((prev) => {
        if (!prev) return prev;

        // Find topic in available topics
        const topic = topics.find((t) => t.id === topicId);
        if (!topic) {
          console.log("[Realtime] Topic not found:", topicId);
          return prev;
        }

        // Deduplicate
        const exists = prev.confirmedTopics.some((t) => t.id === topicId);
        if (exists) {
          console.log("[Realtime] Topic already confirmed, skipping duplicate");
          return prev;
        }

        console.log("[Realtime] Adding confirmed topic:", topic.name);
        return { ...prev, confirmedTopics: [...prev.confirmedTopics, topic] };
      });
    },
    [topics],
  );

  const handleRealtimeSessionUpdate = useCallback((payload: RealtimePayload) => {
    setSession((prev) => {
      if (!prev) return prev;

      console.log("[Realtime] Session updated, phase:", payload.new.phase);
      return {
        ...prev,
        phase: payload.new.phase as SessionPhase,
        currentRound: payload.new.currentRound,
        updated_at: payload.new.updatedAt,
      };
    });
    setLastSessionUpdate(new Date());
  }, []);

  const handleRealtimeQuestionPoolUpdate = useCallback(
    (_payload: RealtimePayload) => {
      console.log("[Realtime] Question pool updated");
      // Pool updates are complex, let polling handle full refresh
      if (sessionId) {
        handleFullReload();
      }
    },
    [sessionId, handleFullReload],
  );

  const handleConnectionStateChange = useCallback((mode: ConnectionMode) => {
    console.log("[Connection] Mode changed to:", mode);
    setConnectionMode((prev) => ({
      ...prev,
      mode,
      realtimeHealth: mode === "realtime" ? "healthy" : "failed",
      lastModeSwitch: new Date(),
    }));
  }, []);

  // Initialize Realtime hook
  const realtime = useSupabaseRealtime({
    sessionId,
    enabled: REALTIME_ENABLED && connectionMode.mode === "realtime",
    onGuestInsert: handleRealtimeGuestInsert,
    onGuestUpdate: handleRealtimeGuestUpdate,
    onVoteInsert: handleRealtimeVoteInsert,
    onPickedQuestionInsert: handleRealtimePickedQuestionInsert,
    onSessionTopicInsert: handleRealtimeSessionTopicInsert,
    onSessionUpdate: handleRealtimeSessionUpdate,
    onQuestionPoolUpdate: handleRealtimeQuestionPoolUpdate,
    onConnectionStateChange: handleConnectionStateChange,
  });

  // Set up polling (only enabled when in polling mode)
  const polling = usePolling({
    enabled: connectionMode.mode === "polling" && !!sessionId,
    sessionId,
    phase: session?.phase || "lobby",
    onIncrementalPoll: handleIncrementalPoll,
    onFullReload: handleFullReload,
  });

  // Initial data load
  useEffect(() => {
    if (!sessionId) {
      setSession(null);
      setConnected(false);
      return;
    }

    loadSessionData(sessionId);
  }, [sessionId, loadSessionData]);

  // Auto-recovery: attempt to switch back to Realtime after 30 seconds
  useEffect(() => {
    if (REALTIME_ENABLED && connectionMode.mode === "polling" && connectionMode.lastModeSwitch) {
      console.log("[Connection] Scheduling Realtime reconnection attempt in 30s");
      const timer = setTimeout(() => {
        console.log("[Connection] Attempting Realtime reconnection");
        setConnectionMode((prev) => ({
          ...prev,
          mode: "realtime",
          realtimeHealth: "healthy",
        }));
      }, 30000);

      return () => clearTimeout(timer);
    }
  }, [connectionMode.mode, connectionMode.lastModeSwitch]);

  // Update connected state based on current mode
  useEffect(() => {
    const isHealthy =
      connectionMode.mode === "realtime" ? realtime.isConnected : polling.connectionHealth === "healthy";
    setConnected(isHealthy);
  }, [connectionMode.mode, realtime.isConnected, polling.connectionHealth]);

  return {
    session,
    loading,
    error,
    connected,
    connectionHealth: connectionMode.mode === "realtime" ? realtime.connectionHealth : polling.connectionHealth,
    connectionMode: connectionMode.mode,
    lastUpdate: connectionMode.mode === "realtime" ? realtime.lastUpdate : polling.lastUpdate,
    refetch: polling.manualRefresh,
  };
}
