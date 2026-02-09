import { supabase } from "@/lib/supabase";

/**
 * Confirm topics and populate question pool atomically
 * Uses database RPC function to prevent partial failures
 * @param sessionId - The session ID
 * @param topicIds - Array of confirmed topic IDs
 */
export async function confirmTopics(sessionId: string, topicIds: string[]) {
  try {
    const { data, error } = await supabase.rpc("confirm_topics_atomic", {
      p_session_id: sessionId,
      p_topic_ids: topicIds,
    });

    if (error) throw error;

    const result = data as {
      success: boolean;
      topic_count?: number;
      question_count?: number;
      error?: string;
      error_code?: string;
    };

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to confirm topics",
        errorCode: result.error_code,
      };
    }

    return {
      success: true,
      topicCount: result.topic_count,
      questionCount: result.question_count,
    };
  } catch (err) {
    console.error("Error confirming topics:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to confirm topics",
    };
  }
}

/**
 * Pick a question for a guest atomically
 * Uses database RPC function to prevent race conditions
 * @param sessionId - The session ID
 * @param guestId - The guest ID
 * @param round - The current round number
 */
export async function pickQuestion(sessionId: string, guestId: string, round: number) {
  try {
    const { data, error } = await supabase.rpc("pick_question_atomic", {
      p_session_id: sessionId,
      p_guest_id: guestId,
      p_round: round,
    });

    if (error) throw error;

    const result = data as {
      success: boolean;
      question?: any;
      error?: string;
      error_code?: string;
    };

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to pick question",
        errorCode: result.error_code,
      };
    }

    return { success: true, question: result.question };
  } catch (err) {
    console.error("Error picking question:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to pick question",
    };
  }
}
