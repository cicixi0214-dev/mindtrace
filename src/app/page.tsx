"use client";

import { useCallback, useEffect, useRef, useState } from "react";

type FollowupRound = { question: string; answer: string };
type Personality = "friend" | "wise" | "family";

type Entry = {
  id: string;
  content: string;
  followups: string;
  createdAt: string;
};

type PersonData = {
  id: string;
  name: string;
  summary: string;
  traits: string[];
  events: string[];
  updatedAt: string;
};

type InsightGroup = {
  category: string;
  items: string[];
};

const PERSONALITIES: { key: Personality; label: string; desc: string; icon: string }[] = [
  { key: "friend", label: "知心朋友", desc: "温暖共情，像最好的朋友", icon: "🤗" },
  { key: "wise", label: "智者", desc: "沉静深邃，帮你看得更远", icon: "🕯️" },
  { key: "family", label: "家人", desc: "亲切家常，像家里人在聊天", icon: "🏠" },
];

const STORAGE_KEY_PERSONALITY = "mindtrace_personality";

const DIMENSION_LABELS = [
  { round: 1, label: "感受", icon: "💭" },
  { round: 2, label: "想法", icon: "🤔" },
  { round: 3, label: "感悟", icon: "✨" },
  { round: 4, label: "思考", icon: "🌱" },
  { round: 5, label: "智慧", icon: "🕯️" },
];

export default function Home() {
  const [entries, setEntries] = useState<Entry[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [asking, setAsking] = useState(false);
  const [followup, setFollowup] = useState<{ q: string; entryId?: string } | null>(null);
  const [followupAnswering, setFollowupAnswering] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [personality, setPersonality] = useState<Personality>("friend");
  const [showSettings, setShowSettings] = useState(false);
  const [people, setPeople] = useState<PersonData[]>([]);
  const [insights, setInsights] = useState<InsightGroup[]>([]);
  const [showPeoplePanel, setShowPeoplePanel] = useState(false);
  const [peopleTab, setPeopleTab] = useState<"people" | "insights">("people");
  const [toast, setToast] = useState<string | null>(null);
  const [followupRound, setFollowupRound] = useState(0);
  const [showMorningCard, setShowMorningCard] = useState(false);
  const [morningGreeting, setMorningGreeting] = useState("");
  const [morningWeather, setMorningWeather] = useState<{ icon: string; temp: string; condition: string; city: string } | null>(null);
  const [morningQuote, setMorningQuote] = useState("");
  const [morningLoading, setMorningLoading] = useState(false);
  const [usageStats, setUsageStats] = useState<{ dailyPercent: number; monthPercent: number } | null>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  const recognitionRef = useRef<any>(null);

  useEffect(() => {
    setMounted(true);
    fetchEntries();
    fetchPeople();
    fetchInsights();
    const saved = localStorage.getItem(STORAGE_KEY_PERSONALITY) as Personality | null;
    if (saved && ["friend", "wise", "family"].includes(saved)) {
      setPersonality(saved);
    }

    fetchUsageStats();

    // Check if first visit of the day → show morning briefing
    const today = new Date().toISOString().slice(0, 10);
    const lastVisit = localStorage.getItem("mindtrace_last_visit");
    if (lastVisit !== today) {
      setMorningLoading(true);
      fetch("/api/briefing")
        .then((r) => r.json())
        .then((data) => {
          setMorningGreeting(data.greeting);
          if (data.weather) setMorningWeather(data.weather);
          if (data.quote) setMorningQuote(data.quote);
          setShowMorningCard(true);
        })
        .catch(() => {})
        .finally(() => setMorningLoading(false));
    }
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 2000);
    return () => clearTimeout(t);
  }, [toast]);

  const changePersonality = useCallback((p: Personality) => {
    setPersonality(p);
    localStorage.setItem(STORAGE_KEY_PERSONALITY, p);
    setShowSettings(false);
  }, []);

  const fetchEntries = useCallback(async () => {
    try {
      const res = await fetch("/api/entries");
      if (res.ok) setEntries(await res.json());
    } catch {}
  }, []);

  const fetchPeople = useCallback(async () => {
    try {
      const res = await fetch("/api/people");
      if (res.ok) setPeople(await res.json());
    } catch {}
  }, []);

  const fetchInsights = useCallback(async () => {
    try {
      const res = await fetch("/api/insights");
      if (res.ok) setInsights(await res.json());
    } catch {}
  }, []);

  const fetchUsageStats = useCallback(async () => {
    try {
      const res = await fetch("/api/usage");
      if (res.ok) setUsageStats(await res.json());
    } catch {}
  }, []);

  const triggerExtraction = useCallback(
    async (content: string, followups: FollowupRound[]) => {
      try {
        await fetch("/api/extract", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ content, followups }),
        });
        fetchPeople();
        fetchInsights();
      } catch {}
    },
    [fetchPeople, fetchInsights]
  );

  const getNextQuestion = useCallback(
    async (entryId: string, content: string, existingFollowups: FollowupRound[]) => {
      setAsking(true);
      try {
        const res = await fetch("/api/ask", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            content,
            existingFollowups,
            maxRounds: 5,
            personality,
          }),
        });
        if (res.ok) {
          const { question } = await res.json();
          const qText = question?.data ?? question;
          if (qText) {
            setFollowupRound(existingFollowups.length + 1);
            setFollowup({ q: qText, entryId });
            setAsking(false);
            fetchUsageStats();
            return;
          }
        }
      } catch {}
      const fallbackQ = getLocalFallback(content, existingFollowups, personality);
      if (fallbackQ) {
        setFollowupRound(existingFollowups.length + 1);
        setAsking(false);
        return;
      }
      // No more questions — extract people and insights from the full conversation
      triggerExtraction(content, existingFollowups);
      setAsking(false);
    },
    [personality, triggerExtraction]
  );

  const handleSubmit = useCallback(async () => {
    const text = input.trim();
    if (!text || loading) return;

    setLoading(true);
    setInput("");
    setFollowupAnswering(false);

    if (followup && followup.entryId) {
      const entry = entries.find((e) => e.id === followup.entryId);
      if (entry) {
        const rounds: FollowupRound[] = JSON.parse(entry.followups);
        rounds.push({ question: followup.q, answer: text });

        await fetch("/api/entries", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id: entry.id, followups: rounds }),
        });

        setFollowup(null);
        setToast("已记录 ✓");
        fetchEntries();
        getNextQuestion(entry.id, entry.content, rounds);
      }
    } else {
      const res = await fetch("/api/entries", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: text, followups: [] }),
      });

      if (res.ok) {
        const entry = await res.json();
        setEntries((prev) => [entry, ...prev]);
        setToast("已记录 ✓");
        getNextQuestion(entry.id, entry.content, []);
      }
    }

    setLoading(false);
    inputRef.current?.focus();
  }, [input, loading, followup, entries, fetchEntries, getNextQuestion]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        handleSubmit();
      }
    },
    [handleSubmit]
  );

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      recognitionRef.current?.stop();
      setIsRecording(false);
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("语音识别在此浏览器不可用，请使用 Chrome");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.lang = "zh-CN";
    recognition.interimResults = false;
    recognition.continuous = false;
    recognition.onresult = (e: any) => {
      const text = e.results[0][0].transcript;
      setInput((prev) => prev + (prev ? " " : "") + text);
      setIsRecording(false);
    };
    recognition.onerror = () => setIsRecording(false);
    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
    setIsRecording(true);
  }, [isRecording]);

  const handleRandomTopic = useCallback(async () => {
    try {
      const res = await fetch("/api/topics");
      if (res.ok) {
        const { topic } = await res.json();
        setFollowup({ q: topic, entryId: undefined });
        setFollowupAnswering(false);
        setInput("");
        inputRef.current?.focus();
      }
    } catch {}
  }, []);

  const handleDismissMorning = useCallback(() => {
    setShowMorningCard(false);
    localStorage.setItem("mindtrace_last_visit", new Date().toISOString().slice(0, 10));
  }, []);

  const handleMorningRecord = useCallback(() => {
    setShowMorningCard(false);
    localStorage.setItem("mindtrace_last_visit", new Date().toISOString().slice(0, 10));
    inputRef.current?.focus();
  }, []);

  const handleSkipFollowup = useCallback(() => {
    setFollowup(null);
    setFollowupRound(0);
    setFollowupAnswering(false);
    inputRef.current?.focus();
  }, []);

  const parseFollowups = (entry: Entry): FollowupRound[] => {
    try {
      return JSON.parse(entry.followups);
    } catch {
      return [];
    }
  };

  const formatDate = (dateStr: string) => {
    const d = new Date(dateStr);
    const today = new Date();
    const isToday =
      d.getFullYear() === today.getFullYear() &&
      d.getMonth() === today.getMonth() &&
      d.getDate() === today.getDate();
    return isToday ? "今天" : `${d.getMonth() + 1}月${d.getDate()}日`;
  };

  const formatTime = (dateStr: string) =>
    new Date(dateStr).toLocaleTimeString("zh-CN", {
      hour: "2-digit",
      minute: "2-digit",
    });

  const groupedEntries = entries.reduce<Record<string, Entry[]>>((acc, e) => {
    const key = formatDate(e.createdAt);
    if (!acc[key]) acc[key] = [];
    acc[key].push(e);
    return acc;
  }, {});

  const totalPeople = people.length;
  const totalInsights = insights.reduce((sum, g) => sum + g.items.length, 0);

  if (!mounted) return null;

  return (
    <div className="flex flex-col min-h-dvh">
      {/* ── Header ── */}
      <header
        className="sticky top-0 z-10 backdrop-blur-lg border-b px-5 py-3 text-center"
        style={{
          background:
            "color-mix(in srgb, var(--color-mt-surface) 80%, transparent)",
          borderColor: "var(--color-mt-border)",
        }}
      >
        <div className="flex items-center justify-center relative">
          <div className="flex-1" />
          <div>
            <h1 className="text-[17px] font-semibold tracking-[1px]">思迹</h1>
            <p className="text-[11px] mt-0.5" style={{ color: "var(--color-mt-text3)" }}>
              记录思想的轨迹
            </p>
          </div>
          <div className="flex-1 flex justify-end items-center gap-1">
            {usageStats && (
              <div
                className="text-[10px] px-1.5 py-0.5 rounded mr-0.5"
                style={{
                  color: usageStats.dailyPercent > 80 ? "#ff6b6b" : "var(--color-mt-text3)",
                }}
                title={`每日用量 ${usageStats.dailyPercent}%`}
              >
                {usageStats.dailyPercent}%
              </div>
            )}
            <button
              onClick={() => {
                setPeopleTab("people");
                setShowPeoplePanel(true);
              }}
              className="w-8 h-8 flex items-center justify-center rounded-full border-none text-base cursor-pointer hover:opacity-70 transition-opacity"
              style={{ color: "var(--color-mt-text3)" }}
              title="人物与洞察"
            >
              👥
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-full border text-[12px] cursor-pointer hover:opacity-70 transition-all"
              style={{
                borderColor: "var(--color-mt-border)",
                color: "var(--color-mt-text2)",
              }}
              title="切换小助理性格"
            >
              <span>{PERSONALITIES.find(p => p.key === personality)?.icon}</span>
              <span>{PERSONALITIES.find(p => p.key === personality)?.label}</span>
            </button>
          </div>
        </div>
      </header>

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-30 animate-fade-in">
          <div
            className="px-5 py-2.5 rounded-full text-sm font-medium shadow-lg"
            style={{
              background: "var(--color-mt-accent)",
              color: "#fff",
            }}
          >
            {toast}
          </div>
        </div>
      )}

      {/* ── Personality picker ── */}
      {showSettings && (
        <div
          className="fixed inset-0 z-20 flex items-end sm:items-center justify-center"
          onClick={() => setShowSettings(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl p-5 shadow-lg animate-fade-in"
            style={{
              background: "var(--color-mt-surface)",
              border: "1px solid var(--color-mt-border)",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <p className="text-[15px] font-semibold mb-1">选择小助理性格</p>
            <p className="text-[12px] mb-4" style={{ color: "var(--color-mt-text3)" }}>
              不同性格会用不同的方式和语气陪你聊天
            </p>
            <div className="flex flex-col gap-2.5">
              {PERSONALITIES.map((p) => (
                <button
                  key={p.key}
                  onClick={() => changePersonality(p.key)}
                  className={`flex items-center gap-3 w-full text-left px-4 py-3.5 rounded-xl border text-sm cursor-pointer transition-all ${
                    personality === p.key ? "ring-2" : ""
                  }`}
                  style={{
                    background:
                      personality === p.key
                        ? "var(--color-mt-accent-light)"
                        : "var(--color-mt-surface)",
                    borderColor:
                      personality === p.key
                        ? "var(--color-mt-accent)"
                        : "var(--color-mt-border)",
                  }}
                >
                  <span className="text-2xl">{p.icon}</span>
                  <div>
                    <p className="font-medium">{p.label}</p>
                    <p className="text-[12px] mt-0.5" style={{ color: "var(--color-mt-text3)" }}>
                      {p.desc}
                    </p>
                  </div>
                </button>
              ))}
            </div>
            {usageStats && (
              <div
                className="mt-4 pt-3 border-t text-[11px] space-y-0.5"
                style={{ borderColor: "var(--color-mt-border)", color: "var(--color-mt-text3)" }}
              >
                <p>今日用量：{usageStats.dailyPercent}% · 月用量：{usageStats.monthPercent}%</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── People & Insights Panel ── */}
      {showPeoplePanel && (
        <div
          className="fixed inset-0 z-20 flex items-end sm:items-center justify-center"
          onClick={() => setShowPeoplePanel(false)}
        >
          <div
            className="w-full max-w-sm rounded-t-2xl sm:rounded-2xl shadow-lg animate-fade-in flex flex-col"
            style={{
              background: "var(--color-mt-surface)",
              border: "1px solid var(--color-mt-border)",
              maxHeight: "70vh",
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-5 pt-4 pb-2">
              <p className="text-[15px] font-semibold">人物与洞察</p>
              <button
                onClick={() => setShowPeoplePanel(false)}
                className="w-7 h-7 flex items-center justify-center rounded-full border-none text-base cursor-pointer"
                style={{ color: "var(--color-mt-text3)" }}
              >
                ✕
              </button>
            </div>

            {/* Tabs */}
            <div className="flex gap-1 px-5 pb-3 border-b" style={{ borderColor: "var(--color-mt-border)" }}>
              <button
                onClick={() => setPeopleTab("people")}
                className="flex-1 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-all"
                style={{
                  background:
                    peopleTab === "people"
                      ? "var(--color-mt-accent-light)"
                      : "transparent",
                  color:
                    peopleTab === "people"
                      ? "var(--color-mt-accent)"
                      : "var(--color-mt-text3)",
                }}
              >
                提到的人{totalPeople > 0 ? ` (${totalPeople})` : ""}
              </button>
              <button
                onClick={() => setPeopleTab("insights")}
                className="flex-1 py-2 rounded-lg text-[13px] font-medium cursor-pointer transition-all"
                style={{
                  background:
                    peopleTab === "insights"
                      ? "var(--color-mt-accent-light)"
                      : "transparent",
                  color:
                    peopleTab === "insights"
                      ? "var(--color-mt-accent)"
                      : "var(--color-mt-text3)",
                }}
              >
                关于你{totalInsights > 0 ? ` (${totalInsights})` : ""}
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto px-5 py-3 flex-1">
              {peopleTab === "people" ? (
                people.length === 0 ? (
                  <p className="text-center text-[13px] py-8" style={{ color: "var(--color-mt-text3)" }}>
                    还没有提到过其他人
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {people.map((p) => (
                      <div
                        key={p.id}
                        className="rounded-xl p-3.5 border"
                        style={{
                          background: "var(--color-mt-bg)",
                          borderColor: "var(--color-mt-border)",
                        }}
                      >
                        <div className="flex items-center gap-2 mb-1.5">
                          <span className="text-[15px] font-semibold">{p.name}</span>
                          {p.summary && (
                            <span className="text-[12px]" style={{ color: "var(--color-mt-text3)" }}>
                              {p.summary}
                            </span>
                          )}
                        </div>
                        {p.traits.length > 0 && (
                          <div className="flex flex-wrap gap-1.5 mb-2">
                            {p.traits.map((t, i) => (
                              <span
                                key={i}
                                className="text-[11px] px-2 py-0.5 rounded-full"
                                style={{
                                  background: "var(--color-mt-accent-light)",
                                  color: "var(--color-mt-accent)",
                                }}
                              >
                                {t}
                              </span>
                            ))}
                          </div>
                        )}
                        {p.events.length > 0 && (
                          <ul className="space-y-1">
                            {p.events.map((ev, i) => (
                              <li
                                key={i}
                                className="text-[12px] leading-relaxed"
                                style={{ color: "var(--color-mt-text2)" }}
                              >
                                · {ev}
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    ))}
                  </div>
                )
              ) : (
                insights.length === 0 ? (
                  <p className="text-center text-[13px] py-8" style={{ color: "var(--color-mt-text3)" }}>
                    还没有分析出关于你的洞察
                  </p>
                ) : (
                  <div className="flex flex-col gap-3">
                    {insights.map((group) => (
                      <div key={group.category}>
                        <p className="text-[13px] font-semibold mb-1.5">{group.category}</p>
                        <div className="flex flex-col gap-1.5">
                          {group.items.map((item, i) => (
                            <div
                              key={i}
                              className="rounded-xl px-3.5 py-2.5 border text-[13px] leading-relaxed"
                              style={{
                                background: "var(--color-mt-bg)",
                                borderColor: "var(--color-mt-border)",
                                color: "var(--color-mt-text2)",
                              }}
                            >
                              {item}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}
            </div>
          </div>
        </div>
      )}

      <main className="flex-1 max-w-[600px] mx-auto w-full px-4 flex flex-col">
        {/* ── Morning card ── */}
        {showMorningCard && (
          <div
            className="rounded-2xl p-5 mt-4 animate-fade-in border"
            style={{
              background: "var(--color-mt-surface)",
              borderColor: "var(--color-mt-border)",
              borderLeft: "3px solid var(--color-mt-accent)",
            }}
          >
            {morningLoading ? (
              <p className="text-[13px]" style={{ color: "var(--color-mt-text3)" }}>
                早上好，准备中…
              </p>
            ) : (
              <>
                {/* Header: time + weather */}
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <span className="text-lg">☀️</span>
                    <span className="text-[11px] font-medium tracking-[1px]" style={{ color: "var(--color-mt-text3)" }}>
                      早安
                    </span>
                    <span className="text-[10px]" style={{ color: "var(--color-mt-text3)" }}>
                      {new Date().toLocaleDateString("zh-CN", { weekday: "long", month: "long", day: "numeric" })}
                    </span>
                  </div>
                  {morningWeather && morningWeather.condition && (
                    <div className="flex items-center gap-1.5 text-sm" style={{ color: "var(--color-mt-text2)" }}>
                      <span>{morningWeather.icon}</span>
                      <span className="text-[13px] font-medium">{morningWeather.temp}</span>
                      <span className="text-[11px]" style={{ color: "var(--color-mt-text3)" }}>
                        {morningWeather.condition}
                        {morningWeather.city ? ` · ${morningWeather.city}` : ""}
                      </span>
                    </div>
                  )}
                </div>

                {/* Greeting */}
                <p className="text-[15px] leading-relaxed" style={{ color: "var(--color-mt-text2)" }}>
                  {morningGreeting}
                </p>

                {/* Quote */}
                {morningQuote && (
                  <div
                    className="mt-3 pt-3 border-t text-center"
                    style={{ borderTopColor: "var(--color-mt-border)" }}
                  >
                    <p className="text-[13px] italic leading-relaxed" style={{ color: "var(--color-mt-accent)" }}>
                      「{morningQuote}」
                    </p>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 mt-4">
                  <button
                    onClick={handleMorningRecord}
                    className="px-4 py-2 rounded-full border-none text-[13px] font-medium cursor-pointer transition-all"
                    style={{
                      background: "var(--color-mt-accent)",
                      color: "#fff",
                    }}
                  >
                    来记录今天的安排
                  </button>
                  <button
                    onClick={handleDismissMorning}
                    className="px-4 py-2 rounded-full border text-[13px] cursor-pointer transition-all"
                    style={{
                      background: "transparent",
                      borderColor: "var(--color-mt-border)",
                      color: "var(--color-mt-text3)",
                    }}
                  >
                    跳过
                  </button>
                </div>
              </>
            )}
          </div>
        )}

        {/* ── Entry area ── */}
        <div
          className="rounded-2xl p-5 mt-4 shadow-sm border"
          style={{
            background: "var(--color-mt-surface)",
            borderColor: "var(--color-mt-border)",
          }}
        >
          <textarea
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={
              followupAnswering
                ? `回答：${followup?.q}`
                : followup
                ? "说说你的想法… 或者直接写你想记录的"
                : "今天想记录点什么？\n随便说，随便写…"
            }
            rows={3}
            className="w-full border-none bg-transparent text-base leading-relaxed resize-none outline-none placeholder:opacity-50"
            style={{
              color: "var(--color-mt-text)",
              minHeight: "80px",
            }}
          />
          <div className="flex items-center gap-2 mt-3">
            <button
              onClick={handleSubmit}
              disabled={loading || !input.trim()}
              className="flex items-center gap-1.5 px-5 py-2.5 rounded-full border-none text-sm font-medium cursor-pointer transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              style={{
                background: "var(--color-mt-accent)",
                color: "#fff",
              }}
            >
              {loading ? "记录中…" : "记录"}
            </button>
            <button
              onClick={handleRandomTopic}
              className="px-5 py-2.5 rounded-full border-none text-sm font-medium cursor-pointer transition-opacity"
              style={{
                background: "var(--color-mt-accent-light)",
                color: "var(--color-mt-accent)",
              }}
            >
              随便聊聊
            </button>
            <div className="flex-1" />
            <button
              onClick={toggleRecording}
              className={`w-11 h-11 rounded-full border-none text-xl cursor-pointer transition-all flex items-center justify-center ${
                isRecording ? "recording !bg-red-500 !text-white" : ""
              }`}
              style={
                isRecording
                  ? undefined
                  : {
                      background: "var(--color-mt-accent-light)",
                      color: "var(--color-mt-accent)",
                    }
              }
            >
              🎤
            </button>
          </div>
        </div>

        {/* ── Follow-up banner ── */}
        {followup && (
          <div
            className="rounded-2xl p-4 mt-3 animate-fade-in relative"
            style={{ background: "var(--color-mt-accent-light)" }}
          >
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <span className="text-[11px] tracking-[1px]" style={{ color: "var(--color-mt-text3)" }}>
                    {asking ? "AI 正在思考…" : PERSONALITIES.find(p => p.key === personality)?.label}
                  </span>
                  {!asking && followupRound > 0 && (() => {
                    const dim = DIMENSION_LABELS.find(d => d.round === followupRound);
                    return dim ? (
                      <span
                        className="text-[10px] px-1.5 py-0.5 rounded-full"
                        style={{
                          background: "var(--color-mt-surface)",
                          color: "var(--color-mt-accent)",
                        }}
                      >
                        {dim.icon} {dim.label}
                      </span>
                    ) : null;
                  })()}
                </div>
                <p className="text-[15px] leading-relaxed pr-2 whitespace-pre-wrap">{followup.q}</p>
              </div>
              <button
                onClick={handleSkipFollowup}
                className="shrink-0 w-7 h-7 flex items-center justify-center rounded-full border-none text-base cursor-pointer hover:opacity-70 transition-opacity mt-0.5"
                style={{
                  background: "transparent",
                  color: "var(--color-mt-text3)",
                }}
                title="关闭"
              >
                ✕
              </button>
            </div>
            <div className="mt-3 flex gap-2">
              <button
                onClick={() => {
                  setFollowupAnswering(true);
                  inputRef.current?.focus();
                  inputRef.current?.scrollIntoView({ behavior: "smooth", block: "center" });
                }}
                className="px-4 py-2 rounded-full border text-[13px] cursor-pointer transition-all"
                style={{
                  background: "var(--color-mt-surface)",
                  borderColor: "var(--color-mt-border)",
                  color: "var(--color-mt-text2)",
                }}
              >
                继续聊聊
              </button>
              <button
                onClick={handleSkipFollowup}
                className="px-4 py-2 rounded-full border text-[13px] cursor-pointer transition-all"
                style={{
                  background: "transparent",
                  borderColor: "var(--color-mt-border)",
                  color: "var(--color-mt-text3)",
                }}
              >
                跳过
              </button>
            </div>
          </div>
        )}

        {/* ── Asking indicator ── */}
        {asking && !followup && (
          <div
            className="text-center py-3 text-[13px]"
            style={{ color: "var(--color-mt-text3)" }}
          >
            {PERSONALITIES.find(p => p.key === personality)?.label} 正在思考…
          </div>
        )}

        {/* ── Empty state ── */}
        {entries.length === 0 && !followup && (
          <div className="flex-1 flex flex-col items-center justify-center px-4 pb-16">
            <div className="text-5xl mb-4">🌱</div>
            <p
              className="text-center text-sm leading-relaxed mb-6"
              style={{ color: "var(--color-mt-text3)" }}
            >
              还没有记录。
              <br />
              在输入框里写下你想留下的，
              <br />
              或者点「随便聊聊」开始。
            </p>
            <button
              onClick={handleRandomTopic}
              className="px-6 py-3 rounded-full border-none text-sm font-medium cursor-pointer transition-all"
              style={{
                background: "var(--color-mt-accent-light)",
                color: "var(--color-mt-accent)",
              }}
            >
              随便聊聊 →
            </button>
          </div>
        )}

        {/* ── Timeline ── */}
        {entries.length > 0 && (
          <div className="flex-1 mt-2">
            {Object.entries(groupedEntries).map(([date, items]) => (
              <div key={date}>
                <p
                  className="text-[12px] font-medium tracking-[0.5px] mt-4 mb-2"
                  style={{ color: "var(--color-mt-text3)" }}
                >
                  {date}
                </p>
                {items.map((entry) => {
                  const rounds = parseFollowups(entry);
                  return (
                    <div
                      key={entry.id}
                      className="rounded-2xl p-4 mb-2.5 shadow-sm border-l-[3px] animate-fade-in"
                      style={{
                        background: "var(--color-mt-surface)",
                        borderColor: "var(--color-mt-border)",
                        borderLeftColor: "var(--color-mt-accent)",
                      }}
                    >
                      <p
                        className="text-[11px] mb-1"
                        style={{ color: "var(--color-mt-text3)" }}
                      >
                        {formatTime(entry.createdAt)}
                      </p>
                      <p
                        className="text-sm leading-relaxed"
                        style={{ color: "var(--color-mt-text2)" }}
                      >
                        {entry.content}
                      </p>
                      {rounds.length > 0 && (
                        <div
                          className="mt-2.5 pt-2.5 border-t text-[13px] leading-relaxed space-y-2"
                          style={{
                            borderTopColor: "var(--color-mt-border)",
                          }}
                        >
                          {rounds.map((r, i) => (
                            <div key={i}>
                              <p
                                className="font-medium"
                                style={{ color: "var(--color-mt-accent)" }}
                              >
                                ↪ {r.question}
                              </p>
                              {r.answer && (
                                <p
                                  className="mt-0.5"
                                  style={{ color: "var(--color-mt-text2)" }}
                                >
                                  {r.answer}
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

// ── Local fallback (psychology-informed) ──
function getLocalFallback(
  content: string,
  existingFollowups: { question: string; answer: string }[],
  personality: Personality = "friend"
): string | null {
  if (existingFollowups.length >= 5) return null;

  const allText = [
    content,
    ...existingFollowups.flatMap((r) => [r.question, r.answer]),
  ].join(" ");

  const hasEmotion = /开心|难过|高兴|伤心|愤怒|生气|害怕|焦虑|感动|失望|满足|后悔|幸福|痛苦|喜欢|讨厌/i.test(allText);
  const hasOpinion = /觉得|认为|以为|看法|观点|信念|重要|对|错|好|坏/i.test(allText);
  const hasLesson = /学到|明白|懂得|教训|经验|体会|改变|成长|以后|将来/i.test(allText);
  const hasDecision = /打算|计划|决定|准备|将要|行动|开始|调整|以后会/i.test(allText);
  const hasWisdom = /理解|意识到|认识到|体会到|发现|原来|人生|生活|世界/i.test(allText);

  const openings: Record<Personality, string[]> = {
    friend: ["嗯，我听到了。", "明白了，谢谢你和我说这些。", "能感受到你的心情。"],
    wise: ["你的分享很珍贵。", "每段经历都是一面镜子。", "嗯，我在听。"],
    family: ["诶，我在听呢。", "咱慢慢说，不着急。", "身体还好吧，边说我边听着。"],
  };
  const open = openings[personality][Math.floor(Math.random() * openings[personality].length)];

  if (!hasEmotion) {
    const qs: Record<Personality, string[]> = {
      friend: ["当时心里是什么滋味呀？", "那会儿你心情怎么样？"],
      wise: ["那时的你，心里是什么感受？", "这件事触动了你什么？"],
      family: ["那会儿心里难受不？", "心情怎么样，跟咱说说？"],
    };
    return open + qs[personality][Math.floor(Math.random() * qs[personality].length)];
  }
  if (!hasOpinion) {
    const qs: Record<Personality, string[]> = {
      friend: ["这件事你怎么看呀？", "你觉得这说明了什么？"],
      wise: ["这件事让你对什么有了新的认识？", "你觉得这背后告诉了你什么道理？"],
      family: ["那你是怎么想的呢？", "你觉得这事咋样？"],
    };
    return open + qs[personality][Math.floor(Math.random() * qs[personality].length)];
  }
  if (!hasLesson) {
    const qs: Record<Personality, string[]> = {
      friend: ["这件事让你学到了什么呀？", "如果以后再遇到，你会怎么做？"],
      wise: ["这段经历给了你什么智慧？", "如果对年轻的自己说句话，你会说什么？"],
      family: ["这事让你明白了什么道理？", "以后咱就知道该咋办了，对吧？"],
    };
    return open + qs[personality][Math.floor(Math.random() * qs[personality].length)];
  }
  if (!hasDecision) {
    const qs: Record<Personality, string[]> = {
      friend: ["那接下来你有什么打算吗？", "这件事会让你以后怎么做呢？"],
      wise: ["这些感悟会让你的生活有什么不同？", "你打算如何把这份理解融入生活？"],
      family: ["那咱以后该咋做才好呢？", "这下心里有数了吧？"],
    };
    return open + qs[personality][Math.floor(Math.random() * qs[personality].length)];
  }
  if (!hasWisdom) {
    const qs: Record<Personality, string[]> = {
      friend: ["这段经历让你对生活有了什么新的认识？", "你有没有发现什么以前没注意到的事？"],
      wise: ["这让你对人生有了什么新的理解？", "这件事让你看清了什么本质？"],
      family: ["这事让你看明白啥了没？", "活到老学到老，咱又长见识了对吧？"],
    };
    return open + qs[personality][Math.floor(Math.random() * qs[personality].length)];
  }
  return null;
}
