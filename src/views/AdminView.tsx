import { MobileShell, ViewHeader } from "@/components/MobileShell";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/context/AppContext";
import { useState } from "react";

function TopicsTab() {
  const { topics, questions, addTopic, editTopic, removeTopic } = useApp();
  const [newName, setNewName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const qCount = (topicId: string) => questions.filter((q) => q.topicId === topicId).length;

  return (
    <div className="space-y-4">
      {/* Add topic */}
      <div className="flex gap-2">
        <Input
          placeholder="New topic name..."
          value={newName}
          onChange={(e) => setNewName(e.target.value)}
          className="h-10 rounded-lg border-stone-200 bg-white text-sm flex-1"
        />
        <button
          onClick={() => {
            if (newName.trim()) {
              addTopic(newName.trim());
              setNewName("");
            }
          }}
          disabled={!newName.trim()}
          className="h-10 px-4 rounded-lg bg-amber-800 text-amber-50 text-sm font-medium disabled:opacity-40 hover:bg-amber-900 transition-colors shrink-0"
        >
          Add
        </button>
      </div>

      {/* Topic list */}
      <div className="space-y-1.5">
        {topics.map((t) => (
          <div key={t.id} className="bg-white rounded-xl px-4 py-3 border border-stone-100">
            {editingId === t.id ? (
              <div className="flex gap-2 items-center">
                <Input
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="h-9 rounded-lg text-sm flex-1"
                  autoFocus
                />
                <button
                  onClick={() => {
                    editTopic(t.id, editName);
                    setEditingId(null);
                  }}
                  className="text-xs font-medium text-amber-800"
                >
                  Save
                </button>
                <button onClick={() => setEditingId(null)} className="text-xs text-stone-400">
                  Cancel
                </button>
              </div>
            ) : confirmDelete === t.id ? (
              <div>
                <p className="text-xs text-red-600 mb-2">
                  Delete "{t.name}"? This removes {qCount(t.id)} question{qCount(t.id) !== 1 ? "s" : ""}.
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      removeTopic(t.id);
                      setConfirmDelete(null);
                    }}
                    className="text-xs font-medium text-red-600"
                  >
                    Confirm Delete
                  </button>
                  <button onClick={() => setConfirmDelete(null)} className="text-xs text-stone-400">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between">
                <div>
                  <span className="text-sm font-medium text-stone-800">{t.name}</span>
                  <span className="text-xs text-stone-400 ml-2">{qCount(t.id)} Q</span>
                </div>
                <div className="flex gap-3">
                  <button
                    onClick={() => {
                      setEditingId(t.id);
                      setEditName(t.name);
                    }}
                    className="text-xs text-stone-500 hover:text-stone-700"
                  >
                    Edit
                  </button>
                  <button onClick={() => setConfirmDelete(t.id)} className="text-xs text-red-400 hover:text-red-600">
                    Delete
                  </button>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

function QuestionsTab() {
  const { topics, questions, addQuestion, editQuestion, removeQuestion } = useApp();
  const [filterTopicId, setFilterTopicId] = useState<string>("all");
  const [newText, setNewText] = useState("");
  const [newTopicId, setNewTopicId] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editText, setEditText] = useState("");
  const [editTopicId, setEditTopicId] = useState("");

  const filtered = filterTopicId === "all" ? questions : questions.filter((q) => q.topicId === filterTopicId);
  const topicName = (id: string) => topics.find((t) => t.id === id)?.name || "—";

  return (
    <div className="space-y-4">
      {/* Filter */}
      <Select value={filterTopicId} onValueChange={setFilterTopicId}>
        <SelectTrigger className="h-10 rounded-lg text-sm bg-white border-stone-200">
          <SelectValue placeholder="Filter by topic" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="all">All Topics</SelectItem>
          {topics.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {/* Add question */}
      <div className="space-y-2 bg-white rounded-xl p-3 border border-stone-100">
        <Input
          placeholder="New question text..."
          value={newText}
          onChange={(e) => setNewText(e.target.value)}
          className="h-9 rounded-lg text-sm"
        />
        <div className="flex gap-2">
          <Select value={newTopicId} onValueChange={setNewTopicId}>
            <SelectTrigger className="h-9 rounded-lg text-xs flex-1 bg-stone-50">
              <SelectValue placeholder="Assign topic" />
            </SelectTrigger>
            <SelectContent>
              {topics.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <button
            onClick={() => {
              if (newText.trim() && newTopicId) {
                addQuestion(newTopicId, newText.trim());
                setNewText("");
                setNewTopicId("");
              }
            }}
            disabled={!newText.trim() || !newTopicId}
            className="h-9 px-4 rounded-lg bg-amber-800 text-amber-50 text-xs font-medium disabled:opacity-40 shrink-0"
          >
            Add
          </button>
        </div>
      </div>

      {/* Question list */}
      <div className="space-y-1.5">
        {filtered.map((q) => (
          <div key={q.id} className="bg-white rounded-xl px-4 py-3 border border-stone-100">
            {editingId === q.id ? (
              <div className="space-y-2">
                <Input
                  value={editText}
                  onChange={(e) => setEditText(e.target.value)}
                  className="h-9 rounded-lg text-sm"
                  autoFocus
                />
                <Select value={editTopicId} onValueChange={setEditTopicId}>
                  <SelectTrigger className="h-9 rounded-lg text-xs bg-stone-50">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {topics.map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <div className="flex gap-2">
                  <button
                    onClick={() => {
                      editQuestion(q.id, editText, editTopicId);
                      setEditingId(null);
                    }}
                    className="text-xs font-medium text-amber-800"
                  >
                    Save
                  </button>
                  <button onClick={() => setEditingId(null)} className="text-xs text-stone-400">
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <div>
                <p className="text-sm text-stone-800 leading-snug">{q.text}</p>
                <div className="flex items-center justify-between mt-2">
                  <span className="text-[10px] font-medium text-stone-400 uppercase tracking-wider">
                    {topicName(q.topicId)}
                  </span>
                  <div className="flex gap-3">
                    <button
                      onClick={() => {
                        setEditingId(q.id);
                        setEditText(q.text);
                        setEditTopicId(q.topicId);
                      }}
                      className="text-xs text-stone-500"
                    >
                      Edit
                    </button>
                    <button onClick={() => removeQuestion(q.id)} className="text-xs text-red-400">
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        ))}
        {filtered.length === 0 && <p className="text-center text-stone-400 text-sm py-8">No questions found.</p>}
      </div>
    </div>
  );
}

function HistoryTab() {
  const { sessions, deleteSessionRecord } = useApp();
  const [expandedId, setExpandedId] = useState<string | null>(null);

  if (sessions.length === 0) {
    return <p className="text-center text-stone-400 text-sm py-12">No session history yet.</p>;
  }

  return (
    <div className="space-y-2">
      {sessions.map((s) => (
        <div key={s.id} className="bg-white rounded-xl border border-stone-100 overflow-hidden">
          <button
            onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
            className="w-full px-4 py-3 flex items-center justify-between text-left"
          >
            <div>
              <span className="text-sm font-semibold text-stone-800 font-mono">{s.code}</span>
              <p className="text-[10px] text-stone-400 mt-0.5">
                {new Date(s.startTime).toLocaleDateString()} · {s.guestCount} guest{s.guestCount !== 1 ? "s" : ""}
              </p>
            </div>
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              className={`text-stone-400 transition-transform ${expandedId === s.id ? "rotate-180" : ""}`}
            >
              <polyline points="6 9 12 15 18 9" />
            </svg>
          </button>
          {expandedId === s.id && (
            <div className="px-4 pb-4 border-t border-stone-50 pt-3 space-y-3">
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div>
                  <span className="text-stone-400 block mb-1">Start</span>
                  <span className="text-stone-700">{new Date(s.startTime).toLocaleString()}</span>
                </div>
                <div>
                  <span className="text-stone-400 block mb-1">End</span>
                  <span className="text-stone-700">{new Date(s.endTime).toLocaleString()}</span>
                </div>
              </div>
              <div>
                <span className="text-[10px] text-stone-400 uppercase tracking-wider block mb-1">Topics</span>
                <div className="flex flex-wrap gap-1">
                  {s.confirmedTopics.map((t, i) => (
                    <span key={i} className="px-2 py-0.5 bg-amber-100 text-amber-800 rounded-md text-xs font-medium">
                      {t}
                    </span>
                  ))}
                </div>
              </div>
              <div>
                <span className="text-[10px] text-stone-400 uppercase tracking-wider block mb-1">Guests</span>
                <p className="text-xs text-stone-600">{s.guests.join(", ")}</p>
              </div>
              <div>
                <span className="text-[10px] text-stone-400 uppercase tracking-wider block mb-1">
                  Questions Picked ({s.pickedQuestions.length})
                </span>
                <div className="space-y-1.5 max-h-48 overflow-auto">
                  {s.pickedQuestions.map((pq, i) => (
                    <div key={i} className="bg-stone-50 rounded-lg px-3 py-2">
                      <p className="text-xs text-stone-700 leading-snug">"{pq.questionText}"</p>
                      <p className="text-[10px] text-stone-400 mt-1">
                        {pq.guestNickname} · Round {pq.round} · {pq.topicName}
                      </p>
                    </div>
                  ))}
                </div>
              </div>
              <button
                onClick={() => deleteSessionRecord(s.id)}
                className="text-xs text-red-400 hover:text-red-600 mt-2"
              >
                Delete Record
              </button>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

export function AdminView() {
  const { logout, topics, questions } = useApp();
  return (
    <MobileShell>
      <ViewHeader
        title="Admin Panel"
        subtitle={`${topics.length} topics · ${questions.length} questions`}
        onBack={() => {
          logout();
        }}
        rightAction={
          <button onClick={logout} className="text-xs text-stone-500 font-medium">
            Sign Out
          </button>
        }
      />
      <div className="flex-1 px-5 pb-6">
        <Tabs defaultValue="topics" className="w-full">
          <TabsList className="w-full h-10 bg-stone-200/60 rounded-xl mb-4 p-1">
            <TabsTrigger
              value="topics"
              className="flex-1 text-xs font-medium rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Topics
            </TabsTrigger>
            <TabsTrigger
              value="questions"
              className="flex-1 text-xs font-medium rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              Questions
            </TabsTrigger>
            <TabsTrigger
              value="history"
              className="flex-1 text-xs font-medium rounded-lg data-[state=active]:bg-white data-[state=active]:shadow-sm"
            >
              History
            </TabsTrigger>
          </TabsList>
          <TabsContent value="topics">
            <TopicsTab />
          </TabsContent>
          <TabsContent value="questions">
            <QuestionsTab />
          </TabsContent>
          <TabsContent value="history">
            <HistoryTab />
          </TabsContent>
        </Tabs>
      </div>
    </MobileShell>
  );
}
