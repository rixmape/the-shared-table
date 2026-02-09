import { supabase } from "@/lib/supabase";

/**
 * Confirm topics and populate question pool
 * @param sessionId - The session ID
 * @param topicIds - Array of confirmed topic IDs
 */
export async function confirmTopics(sessionId: string, topicIds: string[]) {
  try {
    // Insert confirmed topics
    const sessionTopics = topicIds.map((topicId) => ({
      session_id: sessionId,
      topic_id: topicId,
    }));

    const { error: topicsError } = await supabase.from("session_topics").insert(sessionTopics);

    if (topicsError) throw topicsError;

    // Populate question pool using database function
    const { error: poolError } = await supabase.rpc("populate_question_pool", {
      session_uuid: sessionId,
      topic_uuids: topicIds,
    });

    if (poolError) throw poolError;

    return { success: true };
  } catch (err) {
    console.error("Error confirming topics:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to confirm topics",
    };
  }
}

/**
 * Get the next unpicked question from the pool
 * @param sessionId - The session ID
 */
export async function getNextQuestion(sessionId: string) {
  try {
    const { data, error } = await supabase
      .from("question_pool")
      .select(
        `
        id,
        question_id,
        position,
        questions(id, text, topic_id, topics(name))
      `,
      )
      .eq("session_id", sessionId)
      .eq("picked", false)
      .order("position")
      .limit(1)
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return { success: true, question: null }; // No questions left
      }
      throw error;
    }

    return {
      success: true,
      question: data,
    };
  } catch (err) {
    console.error("Error getting next question:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to get next question",
    };
  }
}

/**
 * Pick a question for a guest
 * @param sessionId - The session ID
 * @param guestId - The guest ID
 * @param round - The current round number
 */
export async function pickQuestion(sessionId: string, guestId: string, round: number) {
  try {
    // Get next available question
    const nextResult = await getNextQuestion(sessionId);
    if (!nextResult.success || !nextResult.question) {
      return {
        success: false,
        error: "No questions available",
      };
    }

    const questionData = nextResult.question as any;
    const questionId = questionData.questions.id;

    // Mark question as picked in pool
    const { error: poolError } = await supabase
      .from("question_pool")
      .update({ picked: true })
      .eq("id", questionData.id);

    if (poolError) throw poolError;

    // Insert picked question record
    const { error: pickError } = await supabase.from("picked_questions").insert({
      session_id: sessionId,
      guest_id: guestId,
      question_id: questionId,
      round,
    });

    if (pickError) throw pickError;

    // Update guest status
    const { error: guestError } = await supabase
      .from("guests")
      .update({
        has_picked: true,
        picked_question_id: questionId,
      })
      .eq("id", guestId);

    if (guestError) throw guestError;

    return {
      success: true,
      question: {
        id: questionData.questions.id,
        text: questionData.questions.text,
        topicId: questionData.questions.topic_id,
        topicName: questionData.questions.topics.name,
      },
    };
  } catch (err) {
    console.error("Error picking question:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to pick question",
    };
  }
}

/**
 * Reset guest pick status for next round
 * @param sessionId - The session ID
 */
export async function resetPicksForNextRound(sessionId: string) {
  try {
    const { error } = await supabase
      .from("guests")
      .update({
        has_picked: false,
        picked_question_id: null,
      })
      .eq("session_id", sessionId);

    if (error) throw error;

    return { success: true };
  } catch (err) {
    console.error("Error resetting picks:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to reset picks",
    };
  }
}
