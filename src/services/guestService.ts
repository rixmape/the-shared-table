import { supabase } from "@/lib/supabase";

/**
 * Add a guest to a session
 * @param sessionId - The session ID
 * @param nickname - The guest's nickname
 */
export async function joinSession(sessionId: string, nickname: string) {
  try {
    const { data, error } = await supabase
      .from("guests")
      .insert({
        session_id: sessionId,
        nickname: nickname.trim(),
      })
      .select()
      .single();

    if (error) {
      // Check for unique constraint violation
      if (error.code === "23505") {
        return {
          success: false,
          error: "Nickname already taken in this session",
        };
      }
      throw error;
    }

    return {
      success: true,
      guest: {
        id: data.id,
        sessionId: data.session_id,
        nickname: data.nickname,
        hasVoted: data.has_voted,
        hasPicked: data.has_picked,
        pickedQuestionId: data.picked_question_id,
        joined_at: data.joined_at,
      },
    };
  } catch (err) {
    console.error("Error joining session:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to join session",
    };
  }
}

/**
 * Submit votes for a guest atomically
 * Uses database RPC function to prevent duplicate voting
 * @param sessionId - The session ID
 * @param guestId - The guest ID
 * @param topicIds - Array of topic IDs voted for
 */
export async function submitVote(sessionId: string, guestId: string, topicIds: string[]) {
  try {
    const { data, error } = await supabase.rpc("submit_vote_atomic", {
      p_session_id: sessionId,
      p_guest_id: guestId,
      p_topic_ids: topicIds,
    });

    if (error) throw error;

    const result = data as {
      success: boolean;
      votes_count?: number;
      error?: string;
      error_code?: string;
    };

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to submit vote",
        errorCode: result.error_code,
      };
    }

    return { success: true, votesCount: result.votes_count };
  } catch (err) {
    console.error("Error submitting vote:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to submit vote",
    };
  }
}

/**
 * Get vote counts for a session
 * @param sessionId - The session ID
 */
export async function getVoteCounts(sessionId: string) {
  try {
    const { data, error } = await supabase.from("votes").select("topic_id").eq("session_id", sessionId);

    if (error) throw error;

    // Count votes per topic
    const voteCounts: Record<string, number> = {};
    data?.forEach((vote) => {
      voteCounts[vote.topic_id] = (voteCounts[vote.topic_id] || 0) + 1;
    });

    return { success: true, voteCounts };
  } catch (err) {
    console.error("Error getting vote counts:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to get vote counts",
    };
  }
}
