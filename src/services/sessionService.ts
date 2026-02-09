import { supabase } from "@/lib/supabase";
import type { SessionPhase } from "@/types";

/**
 * Create a new session with a unique code
 * @returns The created session with id and code
 */
export async function createSession() {
  try {
    // Generate unique session code using database function
    const { data: codeData, error: codeError } = await supabase.rpc("generate_session_code");

    if (codeError) throw codeError;

    const code = codeData as string;

    // Create session
    const { data, error } = await supabase
      .from("sessions")
      .insert({
        code,
        phase: "lobby",
        current_round: 1,
      })
      .select()
      .single();

    if (error) throw error;

    return {
      success: true,
      session: {
        id: data.id,
        code: data.code,
        phase: data.phase as SessionPhase,
        currentRound: data.current_round,
        startTime: data.start_time,
        created_at: data.created_at,
        updated_at: data.updated_at,
      },
    };
  } catch (err) {
    console.error("Error creating session:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to create session",
    };
  }
}

/**
 * Update session phase
 * @param sessionId - The session ID
 * @param phase - The new phase
 */
export async function advancePhase(sessionId: string, phase: SessionPhase) {
  try {
    const { error } = await supabase.from("sessions").update({ phase }).eq("id", sessionId);

    if (error) throw error;

    return { success: true };
  } catch (err) {
    console.error("Error advancing phase:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to advance phase",
    };
  }
}

/**
 * End a session and archive its data atomically
 * Uses database RPC function to prevent partial failures
 * @param sessionId - The session ID to end
 */
export async function endSession(sessionId: string) {
  try {
    const { data, error } = await supabase.rpc("end_session_atomic", {
      p_session_id: sessionId,
    });

    if (error) throw error;

    const result = data as {
      success: boolean;
      session_id?: string;
      guest_count?: number;
      error?: string;
      error_code?: string;
    };

    if (!result.success) {
      return {
        success: false,
        error: result.error || "Failed to end session",
        errorCode: result.error_code,
      };
    }

    return {
      success: true,
      sessionId: result.session_id,
      guestCount: result.guest_count,
    };
  } catch (err) {
    console.error("Error ending session:", err);
    return {
      success: false,
      error: err instanceof Error ? err.message : "Failed to end session",
    };
  }
}

/**
 * Validate a session code
 * @param code - The session code to validate
 */
export async function validateSessionCode(code: string) {
  try {
    const { data, error } = await supabase
      .from("sessions")
      .select("id, code, phase")
      .eq("code", code.toUpperCase())
      .single();

    if (error) {
      if (error.code === "PGRST116") {
        return { valid: false, error: "Invalid session code" };
      }
      throw error;
    }

    if (data.phase === "ended") {
      return { valid: false, error: "Session has ended" };
    }

    return { valid: true, session: data };
  } catch (err) {
    console.error("Error validating session code:", err);
    return {
      valid: false,
      error: err instanceof Error ? err.message : "Failed to validate session code",
    };
  }
}
