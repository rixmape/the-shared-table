import { supabase } from "@/lib/supabase";
import type { Question, Topic } from "@/types";
import { useEffect, useState } from "react";

export function useSupabaseTopics() {
  const [topics, setTopics] = useState<Topic[]>([]);
  const [questions, setQuestions] = useState<Question[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchTopicsAndQuestions = async () => {
    try {
      setLoading(true);
      setError(null);

      // Fetch topics
      const { data: topicsData, error: topicsError } = await supabase.from("topics").select("*").order("name");

      if (topicsError) throw topicsError;

      // Fetch questions with topic_id mapping
      const { data: questionsData, error: questionsError } = await supabase
        .from("questions")
        .select("*")
        .order("created_at");

      if (questionsError) throw questionsError;

      // Transform database format to app format
      setTopics(topicsData || []);
      setQuestions(
        (questionsData || []).map((q) => ({
          id: q.id,
          topicId: q.topic_id,
          text: q.text,
          created_at: q.created_at,
          updated_at: q.updated_at,
        })),
      );
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : "Failed to fetch topics and questions";
      setError(errorMessage);
      console.error("Error fetching topics and questions:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTopicsAndQuestions();
  }, []);

  const refetch = () => {
    fetchTopicsAndQuestions();
  };

  return {
    topics,
    questions,
    loading,
    error,
    refetch,
  };
}
