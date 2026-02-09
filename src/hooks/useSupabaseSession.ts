import { supabase } from "@/lib/supabase";
import type { Guest, PickedQuestion, Question, Session, SessionPhase, Topic } from "@/types";
import { mergeGuests, mergePickedQuestions, mergeVotes } from "@/utils/polling";
import { useCallback, useEffect, useState } from "react";
import { usePolling } from "./usePolling";

interface UseSupabaseSessionOptions {
  sessionId: string | null;
  topics: Topic[];
  questions: Question[];
}

export function useSupabaseSession({ sessionId, topics, questions }: UseSupabaseSessionOptions) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [connected, setConnected] = useState(false);
  const [lastPollTime, setLastPollTime] = useState<Date>(new Date());
  const [lastSessionUpdate, setLastSessionUpdate] = useState<Date>(new Date());

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

  // Set up polling
  const polling = usePolling({
    enabled: !!sessionId,
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

  // Update connected state based on polling health
  useEffect(() => {
    setConnected(polling.connectionHealth === "healthy");
  }, [polling.connectionHealth]);

  return {
    session,
    loading,
    error,
    connected,
    connectionHealth: polling.connectionHealth,
    lastUpdate: polling.lastUpdate,
    refetch: polling.manualRefresh,
  };
}
