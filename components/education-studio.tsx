"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import styles from "./studio-tools.module.css";

// ---------------------------------------------------------------------------
// Art Education Studio — build educational packs per exhibition: learner
// labels, structured learning guides, curatorial questions with model
// answers, multiple-choice quizzes with a live "Take quiz" mode, artwork
// analysis prompts, guided learning paths, and printable / JSON resources.
// Saved as SavedWork ("education-pack"); several packs can live side by
// side (one per audience, one per exhibition).
// ---------------------------------------------------------------------------

export type EducationArtwork = {
  id: string;
  title: string;
  medium: string;
  year: string;
  dimensions: string;
  description: string;
  imageUrl: string | null;
};

export type EducationExhibition = {
  id: string;
  title: string;
  status: string;
  artworks: EducationArtwork[];
};

type GuideSection = { id: string; heading: string; body: string };
type Guide = { id: string; title: string; sections: GuideSection[] };
type CuratorialQuestion = { id: string; question: string; answer: string };
type QuizQuestion = {
  id: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
};
type Quiz = { id: string; title: string; questions: QuizQuestion[] };
type AnalysisPrompts = { observation: string; interpretation: string; context: string };
type PathStep = { id: string; artworkId: string; note: string };
type LearningPath = { id: string; title: string; description: string; steps: PathStep[] };

type EduPackData = {
  exhibitionId: string;
  exhibitionTitle: string;
  audience: string;
  labels: Record<string, string>;
  guides: Guide[];
  questions: Record<string, CuratorialQuestion[]>;
  quizzes: Quiz[];
  prompts: Record<string, AnalysisPrompts>;
  paths: LearningPath[];
};

type SavedPack = {
  id: string;
  title: string;
  data: EduPackData;
  createdAt: string;
  updatedAt: string;
};

const EMPTY_PROMPTS: AnalysisPrompts = { observation: "", interpretation: "", context: "" };

function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function blankPack(exhibition: EducationExhibition): EduPackData {
  return {
    exhibitionId: exhibition.id,
    exhibitionTitle: exhibition.title,
    audience: "General public",
    labels: {},
    guides: [],
    questions: {},
    quizzes: [],
    prompts: {},
    paths: [],
  };
}

const AUDIENCES = ["General public", "Primary school", "Secondary school", "University", "Families", "Teachers"];

type Tab = "labels" | "guides" | "questions" | "quizzes" | "prompts" | "paths" | "resources";

export default function EducationStudio({ exhibitions }: { exhibitions: EducationExhibition[] }) {
  const [exhibitionId, setExhibitionId] = useState(exhibitions[0]?.id ?? "");
  const exhibition = exhibitions.find((e) => e.id === exhibitionId) ?? exhibitions[0];
  const [pack, setPack] = useState<EduPackData | null>(() =>
    exhibition ? blankPack(exhibition) : null,
  );
  const [savedId, setSavedId] = useState<string | null>(null);
  const [saved, setSaved] = useState<SavedPack[]>([]);
  const [savedLoading, setSavedLoading] = useState(true);
  const [savedError, setSavedError] = useState<string | null>(null);
  const [saveName, setSaveName] = useState("");
  const [saveStatus, setSaveStatus] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>("labels");
  const [selectedArtworkId, setSelectedArtworkId] = useState<string>("");

  // Quiz taking state
  const [takingQuizId, setTakingQuizId] = useState<string | null>(null);
  const [quizIndex, setQuizIndex] = useState(0);
  const [pickedOption, setPickedOption] = useState<number | null>(null);
  const [answered, setAnswered] = useState(false);
  const [score, setScore] = useState(0);
  const [finished, setFinished] = useState(false);

  // Quiz builder draft
  const [quizTitle, setQuizTitle] = useState("");
  const [quizQ, setQuizQ] = useState("");
  const [quizOptions, setQuizOptions] = useState(["", "", "", ""]);
  const [quizCorrect, setQuizCorrect] = useState(0);
  const [quizExplanation, setQuizExplanation] = useState("");
  const [quizDraft, setQuizDraft] = useState<QuizQuestion[]>([]);

  // Guide builder draft
  const [guideTitle, setGuideTitle] = useState("");
  const [guideHeading, setGuideHeading] = useState("");
  const [guideBody, setGuideBody] = useState("");
  const [guideDraftSections, setGuideDraftSections] = useState<GuideSection[]>([]);

  // Question builder draft
  const [qText, setQText] = useState("");
  const [qAnswer, setQAnswer] = useState("");

  // Path builder draft
  const [pathTitle, setPathTitle] = useState("");
  const [pathDescription, setPathDescription] = useState("");
  const [pathSteps, setPathSteps] = useState<PathStep[]>([]);
  const [pathStepArtwork, setPathStepArtwork] = useState("");
  const [pathStepNote, setPathStepNote] = useState("");

  const artworks = exhibition?.artworks ?? [];
  const selectedArtwork =
    artworks.find((a) => a.id === selectedArtworkId) ?? artworks[0] ?? null;

  const loadSaved = useCallback(async () => {
    setSavedLoading(true);
    setSavedError(null);
    try {
      const res = await fetch("/api/saved-work?kind=education-pack");
      if (!res.ok) throw new Error("fetch");
      const json = (await res.json()) as { saved?: SavedPack[] };
      setSaved(json.saved ?? []);
    } catch {
      setSavedError("Saved packs could not be loaded — check your connection and refresh.");
      setSaved([]);
    } finally {
      setSavedLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadSaved();
  }, [loadSaved]);

  const switchExhibition = useCallback(
    (id: string) => {
      const next = exhibitions.find((e) => e.id === id);
      if (!next) return;
      setExhibitionId(id);
      setSelectedArtworkId("");
      setSavedId(null);
      setSaveStatus(null);
      setTakingQuizId(null);
      const existing = saved.find((s) => s.data.exhibitionId === id);
      setPack(existing ? existing.data : blankPack(next));
      if (existing) setSavedId(existing.id);
    },
    [exhibitions, saved],
  );

  const updatePack = useCallback((fn: (current: EduPackData) => EduPackData) => {
    setPack((current) => (current ? fn(current) : current));
  }, []);

  const savePack = useCallback(async () => {
    if (!pack || !exhibition) return;
    const title = saveName.trim() || `Education pack — ${exhibition.title} (${pack.audience})`;
    setSaving(true);
    setSaveStatus(null);
    try {
      const res = await fetch("/api/saved-work", {
        method: savedId ? "PUT" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(
          savedId ? { id: savedId, title, data: pack } : { kind: "education-pack", title, data: pack },
        ),
      });
      if (!res.ok) throw new Error("save");
      const json = (await res.json()) as { saved?: SavedPack };
      if (json.saved) setSavedId(json.saved.id);
      setSaveStatus(`Saved as “${title}”.`);
      setSaveName("");
      await loadSaved();
    } catch {
      setSaveStatus("Could not save — check your connection and try again.");
    } finally {
      setSaving(false);
    }
  }, [pack, exhibition, saveName, savedId, loadSaved]);

  const loadPack = useCallback(
    (row: SavedPack) => {
      const target = exhibitions.find((e) => e.id === row.data.exhibitionId);
      if (target) {
        setExhibitionId(target.id);
        setSelectedArtworkId("");
      }
      setPack(row.data);
      setSavedId(row.id);
      setTakingQuizId(null);
      setSaveStatus(`Loaded “${row.title}”.`);
    },
    [exhibitions],
  );

  const deletePack = useCallback(
    async (id: string) => {
      await fetch(`/api/saved-work?id=${encodeURIComponent(id)}`, { method: "DELETE" });
      setConfirmDeleteId(null);
      if (savedId === id) {
        setSavedId(null);
        if (exhibition) setPack(blankPack(exhibition));
      }
      await loadSaved();
    },
    [savedId, exhibition, loadSaved],
  );

  // --- quiz taking ---------------------------------------------------------
  const takingQuiz = pack?.quizzes.find((q) => q.id === takingQuizId) ?? null;
  const currentQuestion = takingQuiz?.questions[quizIndex] ?? null;

  const startQuiz = useCallback((quiz: Quiz) => {
    setTakingQuizId(quiz.id);
    setQuizIndex(0);
    setPickedOption(null);
    setAnswered(false);
    setScore(0);
    setFinished(false);
  }, []);

  const pickOption = useCallback(
    (index: number) => {
      if (answered || !currentQuestion) return;
      setPickedOption(index);
      setAnswered(true);
      if (index === currentQuestion.correctIndex) setScore((s) => s + 1);
    },
    [answered, currentQuestion],
  );

  const nextQuestion = useCallback(() => {
    if (!takingQuiz) return;
    if (quizIndex + 1 >= takingQuiz.questions.length) {
      setFinished(true);
    } else {
      setQuizIndex((i) => i + 1);
      setPickedOption(null);
      setAnswered(false);
    }
  }, [takingQuiz, quizIndex]);

  // --- exports --------------------------------------------------------------
  const exportJson = useCallback(() => {
    if (!pack) return;
    const blob = new Blob([JSON.stringify(pack, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `education-pack-${pack.exhibitionTitle.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.json`;
    a.click();
    URL.revokeObjectURL(url);
  }, [pack]);

  const artworkById = useCallback(
    (id: string) => artworks.find((a) => a.id === id),
    [artworks],
  );

  const counts = useMemo(() => {
    if (!pack) return { labels: 0, guides: 0, questions: 0, quizzes: 0, paths: 0 };
    return {
      labels: Object.values(pack.labels).filter((v) => v.trim()).length,
      guides: pack.guides.length,
      questions: Object.values(pack.questions).reduce((n, list) => n + list.length, 0),
      quizzes: pack.quizzes.length,
      paths: pack.paths.length,
    };
  }, [pack]);

  if (exhibitions.length === 0) {
    return (
      <div className={styles.wrap}>
        <div className={styles.emptyBox}>
          <strong>No exhibitions yet.</strong>
          <p>Create an exhibition and add artworks first — the education pack is built per exhibition, artwork by artwork.</p>
        </div>
      </div>
    );
  }

  if (!exhibition || !pack) return null;

  const prompts: AnalysisPrompts =
    (selectedArtwork && pack.prompts[selectedArtwork.id]) || EMPTY_PROMPTS;
  const artworkQuestions = selectedArtwork ? pack.questions[selectedArtwork.id] ?? [] : [];

  const tabs: { id: Tab; label: string; count?: number }[] = [
    { id: "labels", label: "Labels", count: counts.labels },
    { id: "guides", label: "Learning guides", count: counts.guides },
    { id: "questions", label: "Questions", count: counts.questions },
    { id: "quizzes", label: "Quizzes", count: counts.quizzes },
    { id: "prompts", label: "Analysis prompts" },
    { id: "paths", label: "Learning paths", count: counts.paths },
    { id: "resources", label: "Resources" },
  ];

  return (
    <div className={styles.wrap}>
      <div className={styles.screenOnly}>
      <div className={styles.card}>
        <p className={styles.kicker}>Exhibition &amp; audience</p>
        <div className={styles.twoCol}>
          <div className={styles.field} style={{ marginTop: 0 }}>
            <label htmlFor="edu-exhibition">Which exhibition is this pack for?</label>
            <select
              id="edu-exhibition"
              value={exhibition.id}
              onChange={(e) => switchExhibition(e.target.value)}
            >
              {exhibitions.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.title} ({e.artworks.length} artworks · {e.status})
                </option>
              ))}
            </select>
          </div>
          <div className={styles.field} style={{ marginTop: 0 }}>
            <label htmlFor="edu-audience">Who is it written for?</label>
            <select
              id="edu-audience"
              value={pack.audience}
              onChange={(e) => updatePack((c) => ({ ...c, audience: e.target.value }))}
            >
              {AUDIENCES.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        </div>
        <p className={styles.muted} style={{ marginTop: 12 }}>
          {counts.labels} learner labels · {counts.guides} guides · {counts.questions} curatorial
          questions · {counts.quizzes} quizzes · {counts.paths} learning paths in this pack.
        </p>
      </div>

      <div className={styles.card}>
        <div className={styles.tabs} role="tablist" aria-label="Education pack sections">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              aria-selected={tab === t.id}
              className={`${styles.tab} ${tab === t.id ? styles.tabActive : ""}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
              {typeof t.count === "number" ? ` (${t.count})` : ""}
            </button>
          ))}
        </div>

        {/* ---- Labels ---------------------------------------------------- */}
        {tab === "labels" && (
          <>
            <h3 style={{ marginTop: 18 }}>Educational labels</h3>
            <p className={styles.muted}>
              Short, learner-friendly text per artwork — plain words, one idea at a time.
              Written for {pack.audience.toLowerCase()}.
            </p>
            {artworks.length === 0 ? (
              <p className={styles.status} style={{ marginTop: 12 }}>This exhibition has no artworks yet.</p>
            ) : (
              <>
                <div className={styles.artworkPicker}>
                  {artworks.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={`${styles.artworkPick} ${selectedArtwork?.id === a.id ? styles.artworkPickActive : ""}`}
                      onClick={() => setSelectedArtworkId(a.id)}
                      aria-pressed={selectedArtwork?.id === a.id}
                    >
                      {a.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.imageUrl} alt="" loading="lazy" />
                      ) : (
                        <span style={{ aspectRatio: "4 / 3", display: "grid", placeItems: "center", background: "#efebe1", color: "#898a82" }}>
                          No image
                        </span>
                      )}
                      <span>{a.title}</span>
                      <small>
                        {pack.labels[a.id]?.trim() ? "Label written ✓" : "No label yet"}
                      </small>
                    </button>
                  ))}
                </div>
                {selectedArtwork && (
                  <div className={styles.field}>
                    <label htmlFor="edu-label">
                      Learner label — {selectedArtwork.title}{" "}
                      <span>({selectedArtwork.year} · {selectedArtwork.medium})</span>
                    </label>
                    <textarea
                      id="edu-label"
                      value={pack.labels[selectedArtwork.id] ?? ""}
                      onChange={(e) =>
                        updatePack((c) => ({
                          ...c,
                          labels: { ...c.labels, [selectedArtwork.id]: e.target.value },
                        }))
                      }
                      placeholder="In two or three short sentences: what is this work, and what should a learner notice first?"
                    />
                  </div>
                )}
              </>
            )}
          </>
        )}

        {/* ---- Guides ----------------------------------------------------- */}
        {tab === "guides" && (
          <>
            <h3 style={{ marginTop: 18 }}>Learning guides</h3>
            <p className={styles.muted}>
              Structured guides for the whole exhibition — build them section by section,
              then add the finished guide to the pack.
            </p>
            <div className={styles.field}>
              <label htmlFor="edu-guide-title">Guide title</label>
              <input
                id="edu-guide-title"
                type="text"
                value={guideTitle}
                onChange={(e) => setGuideTitle(e.target.value)}
                placeholder="e.g. Looking at portraits: a guide for young visitors"
              />
            </div>
            <div className={styles.twoCol}>
              <div className={styles.field}>
                <label htmlFor="edu-guide-heading">Section heading</label>
                <input
                  id="edu-guide-heading"
                  type="text"
                  value={guideHeading}
                  onChange={(e) => setGuideHeading(e.target.value)}
                  placeholder="e.g. Before you look"
                />
              </div>
              <div className={styles.field}>
                <label htmlFor="edu-guide-body">Section text</label>
                <textarea
                  id="edu-guide-body"
                  style={{ minHeight: 64 }}
                  value={guideBody}
                  onChange={(e) => setGuideBody(e.target.value)}
                  placeholder="What should the learner do, look for, or think about here?"
                />
              </div>
            </div>
            <div className={styles.row} style={{ marginTop: 12 }}>
              <button
                type="button"
                className={styles.btn}
                disabled={!guideHeading.trim() || !guideBody.trim()}
                onClick={() => {
                  setGuideDraftSections((s) => [...s, { id: newId(), heading: guideHeading.trim(), body: guideBody.trim() }]);
                  setGuideHeading("");
                  setGuideBody("");
                }}
              >
                Add section
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={!guideTitle.trim() || guideDraftSections.length === 0}
                onClick={() => {
                  updatePack((c) => ({
                    ...c,
                    guides: [...c.guides, { id: newId(), title: guideTitle.trim(), sections: guideDraftSections }],
                  }));
                  setGuideTitle("");
                  setGuideDraftSections([]);
                }}
              >
                Add guide to pack
              </button>
            </div>
            {guideDraftSections.length > 0 && (
              <div className={styles.list}>
                {guideDraftSections.map((s, i) => (
                  <div key={s.id} className={styles.listItem}>
                    <div>
                      <strong>{i + 1}. {s.heading}</strong>
                      <span>{s.body}</span>
                    </div>
                    <button
                      type="button"
                      className={`${styles.btn} ${styles.btnSmall}`}
                      onClick={() => setGuideDraftSections((list) => list.filter((x) => x.id !== s.id))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            )}
            {pack.guides.length > 0 && (
              <>
                <div className={styles.divider} />
                <div className={styles.list}>
                  {pack.guides.map((g) => (
                    <div key={g.id} className={styles.listItem}>
                      <div>
                        <strong>{g.title}</strong>
                        <span>{g.sections.length} sections: {g.sections.map((s) => s.heading).join(" · ")}</span>
                      </div>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`}
                        onClick={() => updatePack((c) => ({ ...c, guides: c.guides.filter((x) => x.id !== g.id) }))}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ---- Questions --------------------------------------------------- */}
        {tab === "questions" && (
          <>
            <h3 style={{ marginTop: 18 }}>Curatorial questions</h3>
            <p className={styles.muted}>
              One question per artwork, with a model answer — the kind of question a
              guide asks a group standing in front of the work.
            </p>
            {artworks.length === 0 ? (
              <p className={styles.status} style={{ marginTop: 12 }}>This exhibition has no artworks yet.</p>
            ) : (
              <>
                <div className={styles.artworkPicker}>
                  {artworks.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      className={`${styles.artworkPick} ${selectedArtwork?.id === a.id ? styles.artworkPickActive : ""}`}
                      onClick={() => setSelectedArtworkId(a.id)}
                      aria-pressed={selectedArtwork?.id === a.id}
                    >
                      {a.imageUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={a.imageUrl} alt="" loading="lazy" />
                      ) : (
                        <span style={{ aspectRatio: "4 / 3", display: "grid", placeItems: "center", background: "#efebe1", color: "#898a82" }}>
                          No image
                        </span>
                      )}
                      <span>{a.title}</span>
                      <small>{(pack.questions[a.id] ?? []).length} question(s)</small>
                    </button>
                  ))}
                </div>
                {selectedArtwork && (
                  <>
                    <div className={styles.field}>
                      <label htmlFor="edu-q">Question — {selectedArtwork.title}</label>
                      <input
                        id="edu-q"
                        type="text"
                        value={qText}
                        onChange={(e) => setQText(e.target.value)}
                        placeholder="e.g. What does the gold in this portrait tell you about the person?"
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="edu-a">Model answer</label>
                      <textarea
                        id="edu-a"
                        style={{ minHeight: 64 }}
                        value={qAnswer}
                        onChange={(e) => setQAnswer(e.target.value)}
                        placeholder="The answer a guide could give, or steer the group toward."
                      />
                    </div>
                    <div className={styles.row} style={{ marginTop: 12 }}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnPrimary}`}
                        disabled={!qText.trim() || !qAnswer.trim()}
                        onClick={() => {
                          updatePack((c) => ({
                            ...c,
                            questions: {
                              ...c.questions,
                              [selectedArtwork.id]: [
                                ...(c.questions[selectedArtwork.id] ?? []),
                                { id: newId(), question: qText.trim(), answer: qAnswer.trim() },
                              ],
                            },
                          }));
                          setQText("");
                          setQAnswer("");
                        }}
                      >
                        Add question
                      </button>
                    </div>
                    {artworkQuestions.length > 0 && (
                      <div className={styles.list}>
                        {artworkQuestions.map((q) => (
                          <div key={q.id} className={styles.listItem}>
                            <div>
                              <strong>{q.question}</strong>
                              <span>{q.answer}</span>
                            </div>
                            <button
                              type="button"
                              className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`}
                              onClick={() =>
                                updatePack((c) => ({
                                  ...c,
                                  questions: {
                                    ...c.questions,
                                    [selectedArtwork.id]: (c.questions[selectedArtwork.id] ?? []).filter((x) => x.id !== q.id),
                                  },
                                }))
                              }
                            >
                              Delete
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ---- Quizzes ----------------------------------------------------- */}
        {tab === "quizzes" && (
          <>
            <h3 style={{ marginTop: 18 }}>Interactive quizzes</h3>
            {takingQuiz ? (
              <div style={{ marginTop: 12 }}>
                <div className={styles.spread}>
                  <p className={styles.kicker} style={{ margin: 0 }}>{takingQuiz.title}</p>
                  <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={() => setTakingQuizId(null)}>
                    Exit quiz
                  </button>
                </div>
                {finished || !currentQuestion ? (
                  <div style={{ marginTop: 14 }}>
                    <p className={styles.score}>
                      {score} / {takingQuiz.questions.length} correct
                    </p>
                    <p className={styles.muted}>
                      {score === takingQuiz.questions.length
                        ? "A perfect score — you read this exhibition closely."
                        : score >= takingQuiz.questions.length / 2
                          ? "A solid score — revisit the works you missed and try again."
                          : "Worth another walk through the exhibition — the answers are in the works."}
                    </p>
                    <div className={styles.row} style={{ marginTop: 12 }}>
                      <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => startQuiz(takingQuiz)}>
                        Take it again
                      </button>
                      <button type="button" className={styles.btn} onClick={() => setTakingQuizId(null)}>
                        Back to quizzes
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginTop: 14 }}>
                    <p className={styles.status}>
                      Question {quizIndex + 1} of {takingQuiz.questions.length} · Score so far: {score}
                    </p>
                    <h2 style={{ font: "600 18px/1.4 'Fraunces', Georgia, serif", margin: "8px 0 4px" }}>
                      {currentQuestion.question}
                    </h2>
                    {currentQuestion.options.map((option, i) => {
                      const isCorrect = i === currentQuestion.correctIndex;
                      const isPicked = i === pickedOption;
                      const cls = answered
                        ? isCorrect
                          ? `${styles.quizOption} ${styles.quizCorrect}`
                          : isPicked
                            ? `${styles.quizOption} ${styles.quizWrong}`
                            : styles.quizOption
                        : styles.quizOption;
                      return (
                        <button key={i} type="button" className={cls} disabled={answered} onClick={() => pickOption(i)}>
                          {isCorrect && answered ? "✓ " : isPicked && answered ? "✕ " : ""}
                          {option}
                        </button>
                      );
                    })}
                    {answered && (
                      <div style={{ marginTop: 14 }}>
                        <p className={styles.muted}>
                          {pickedOption === currentQuestion.correctIndex
                            ? "Correct."
                            : `Not quite — the answer is “${currentQuestion.options[currentQuestion.correctIndex]}”.`}{" "}
                          {currentQuestion.explanation}
                        </p>
                        <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={nextQuestion} style={{ marginTop: 10 }}>
                          {quizIndex + 1 >= takingQuiz.questions.length ? "See my score" : "Next question"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <>
                <p className={styles.muted}>
                  Build a multiple-choice quiz, then take it right here — answers are scored
                  live and every question explains itself afterwards.
                </p>
                <div className={styles.field}>
                  <label htmlFor="edu-quiz-title">Quiz title</label>
                  <input
                    id="edu-quiz-title"
                    type="text"
                    value={quizTitle}
                    onChange={(e) => setQuizTitle(e.target.value)}
                    placeholder="e.g. How well do you know this exhibition?"
                  />
                </div>
                <div className={styles.field}>
                  <label htmlFor="edu-quiz-q">Question</label>
                  <input
                    id="edu-quiz-q"
                    type="text"
                    value={quizQ}
                    onChange={(e) => setQuizQ(e.target.value)}
                    placeholder="e.g. Which material dominates this exhibition?"
                  />
                </div>
                <div className={styles.twoCol}>
                  {quizOptions.map((option, i) => (
                    <div className={styles.field} key={i} style={{ marginTop: 8 }}>
                      <label>
                        Option {i + 1}{" "}
                        <span>
                          <input
                            type="radio"
                            name="quiz-correct"
                            checked={quizCorrect === i}
                            onChange={() => setQuizCorrect(i)}
                            aria-label={`Mark option ${i + 1} as the correct answer`}
                          />{" "}
                          correct answer
                        </span>
                      </label>
                      <input
                        type="text"
                        value={option}
                        onChange={(e) =>
                          setQuizOptions((opts) => opts.map((o, j) => (j === i ? e.target.value : o)))
                        }
                        placeholder={`Option ${i + 1}`}
                      />
                    </div>
                  ))}
                </div>
                <div className={styles.field}>
                  <label htmlFor="edu-quiz-expl">Explanation <span>(shown after the visitor answers)</span></label>
                  <textarea
                    id="edu-quiz-expl"
                    style={{ minHeight: 64 }}
                    value={quizExplanation}
                    onChange={(e) => setQuizExplanation(e.target.value)}
                    placeholder="Why this answer is right — point back to the work."
                  />
                </div>
                <div className={styles.row} style={{ marginTop: 12 }}>
                  <button
                    type="button"
                    className={styles.btn}
                    disabled={
                      !quizQ.trim() ||
                      quizOptions.filter((o) => o.trim()).length < 2 ||
                      !quizOptions[quizCorrect]?.trim()
                    }
                    onClick={() => {
                      const options = quizOptions.map((o) => o.trim()).filter(Boolean);
                      setQuizDraft((d) => [
                        ...d,
                        {
                          id: newId(),
                          question: quizQ.trim(),
                          options,
                          correctIndex: Math.min(quizCorrect, options.length - 1),
                          explanation: quizExplanation.trim(),
                        },
                      ]);
                      setQuizQ("");
                      setQuizOptions(["", "", "", ""]);
                      setQuizCorrect(0);
                      setQuizExplanation("");
                    }}
                  >
                    Add question to quiz
                  </button>
                  <button
                    type="button"
                    className={`${styles.btn} ${styles.btnPrimary}`}
                    disabled={!quizTitle.trim() || quizDraft.length === 0}
                    onClick={() => {
                      updatePack((c) => ({
                        ...c,
                        quizzes: [...c.quizzes, { id: newId(), title: quizTitle.trim(), questions: quizDraft }],
                      }));
                      setQuizTitle("");
                      setQuizDraft([]);
                    }}
                  >
                    Save quiz to pack
                  </button>
                </div>
                {quizDraft.length > 0 && (
                  <p className={styles.status} style={{ marginTop: 10 }}>
                    {quizDraft.length} question(s) in this draft quiz.
                  </p>
                )}
                {pack.quizzes.length > 0 && (
                  <>
                    <div className={styles.divider} />
                    <div className={styles.list}>
                      {pack.quizzes.map((quiz) => (
                        <div key={quiz.id} className={styles.listItem}>
                          <div>
                            <strong>{quiz.title}</strong>
                            <span>{quiz.questions.length} questions</span>
                          </div>
                          <div className={styles.row}>
                            <button type="button" className={`${styles.btn} ${styles.btnSmall} ${styles.btnPrimary}`} onClick={() => startQuiz(quiz)}>
                              Take quiz
                            </button>
                            <button
                              type="button"
                              className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`}
                              onClick={() => updatePack((c) => ({ ...c, quizzes: c.quizzes.filter((x) => x.id !== quiz.id) }))}
                            >
                              Delete
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ---- Prompts ----------------------------------------------------- */}
        {tab === "prompts" && (
          <>
            <h3 style={{ marginTop: 18 }}>Artwork analysis prompts</h3>
            <p className={styles.muted}>
              Three lenses per artwork — observe, interpret, put in context. Learners work
              through them in order, in front of the work.
            </p>
            {artworks.length === 0 ? (
              <p className={styles.status} style={{ marginTop: 12 }}>This exhibition has no artworks yet.</p>
            ) : (
              <>
                <div className={styles.artworkPicker}>
                  {artworks.map((a) => {
                    const p = pack.prompts[a.id];
                    const filled = p && (p.observation.trim() || p.interpretation.trim() || p.context.trim());
                    return (
                      <button
                        key={a.id}
                        type="button"
                        className={`${styles.artworkPick} ${selectedArtwork?.id === a.id ? styles.artworkPickActive : ""}`}
                        onClick={() => setSelectedArtworkId(a.id)}
                        aria-pressed={selectedArtwork?.id === a.id}
                      >
                        {a.imageUrl ? (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={a.imageUrl} alt="" loading="lazy" />
                        ) : (
                          <span style={{ aspectRatio: "4 / 3", display: "grid", placeItems: "center", background: "#efebe1", color: "#898a82" }}>
                            No image
                          </span>
                        )}
                        <span>{a.title}</span>
                        <small>{filled ? "Prompts written ✓" : "No prompts yet"}</small>
                      </button>
                    );
                  })}
                </div>
                {selectedArtwork && (
                  <>
                    <div className={styles.field}>
                      <label htmlFor="edu-prompt-obs">1 · Observe <span>(what do you actually see?)</span></label>
                      <textarea
                        id="edu-prompt-obs"
                        style={{ minHeight: 64 }}
                        value={prompts.observation}
                        onChange={(e) =>
                          updatePack((c) => ({
                            ...c,
                            prompts: { ...c.prompts, [selectedArtwork.id]: { ...prompts, observation: e.target.value } },
                          }))
                        }
                        placeholder="Look closely for one minute. List what you see — colours, shapes, people, objects — before guessing what any of it means."
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="edu-prompt-int">2 · Interpret <span>(what could it mean?)</span></label>
                      <textarea
                        id="edu-prompt-int"
                        style={{ minHeight: 64 }}
                        value={prompts.interpretation}
                        onChange={(e) =>
                          updatePack((c) => ({
                            ...c,
                            prompts: { ...c.prompts, [selectedArtwork.id]: { ...prompts, interpretation: e.target.value } },
                          }))
                        }
                        placeholder="What feeling, story or idea does the work carry? What in the image makes you think so?"
                      />
                    </div>
                    <div className={styles.field}>
                      <label htmlFor="edu-prompt-ctx">3 · Context <span>(where does it come from?)</span></label>
                      <textarea
                        id="edu-prompt-ctx"
                        style={{ minHeight: 64 }}
                        value={prompts.context}
                        onChange={(e) =>
                          updatePack((c) => ({
                            ...c,
                            prompts: { ...c.prompts, [selectedArtwork.id]: { ...prompts, context: e.target.value } },
                          }))
                        }
                        placeholder="Who made it, when, where — and what was happening around it?"
                      />
                    </div>
                  </>
                )}
              </>
            )}
          </>
        )}

        {/* ---- Paths ------------------------------------------------------- */}
        {tab === "paths" && (
          <>
            <h3 style={{ marginTop: 18 }}>Guided learning paths</h3>
            <p className={styles.muted}>
              An ordered route through the exhibition — each stop is an artwork with a
              note for the group. Build the stops in order, then save the path.
            </p>
            <div className={styles.field}>
              <label htmlFor="edu-path-title">Path title</label>
              <input
                id="edu-path-title"
                type="text"
                value={pathTitle}
                onChange={(e) => setPathTitle(e.target.value)}
                placeholder="e.g. From portrait to pride — a 20-minute route"
              />
            </div>
            <div className={styles.field}>
              <label htmlFor="edu-path-desc">Path description</label>
              <textarea
                id="edu-path-desc"
                style={{ minHeight: 64 }}
                value={pathDescription}
                onChange={(e) => setPathDescription(e.target.value)}
                placeholder="Who is this route for, and what will they take away from it?"
              />
            </div>
            {artworks.length > 0 && (
              <div className={styles.twoCol}>
                <div className={styles.field}>
                  <label htmlFor="edu-path-artwork">Next stop — artwork</label>
                  <select
                    id="edu-path-artwork"
                    value={pathStepArtwork}
                    onChange={(e) => setPathStepArtwork(e.target.value)}
                  >
                    <option value="">Choose an artwork…</option>
                    {artworks.map((a) => (
                      <option key={a.id} value={a.id}>{a.title}</option>
                    ))}
                  </select>
                </div>
                <div className={styles.field}>
                  <label htmlFor="edu-path-note">Stop note</label>
                  <input
                    id="edu-path-note"
                    type="text"
                    value={pathStepNote}
                    onChange={(e) => setPathStepNote(e.target.value)}
                    placeholder="What to look at or discuss at this stop"
                  />
                </div>
              </div>
            )}
            <div className={styles.row} style={{ marginTop: 12 }}>
              <button
                type="button"
                className={styles.btn}
                disabled={!pathStepArtwork}
                onClick={() => {
                  setPathSteps((s) => [...s, { id: newId(), artworkId: pathStepArtwork, note: pathStepNote.trim() }]);
                  setPathStepArtwork("");
                  setPathStepNote("");
                }}
              >
                Add stop
              </button>
              <button
                type="button"
                className={`${styles.btn} ${styles.btnPrimary}`}
                disabled={!pathTitle.trim() || pathSteps.length === 0}
                onClick={() => {
                  updatePack((c) => ({
                    ...c,
                    paths: [...c.paths, { id: newId(), title: pathTitle.trim(), description: pathDescription.trim(), steps: pathSteps }],
                  }));
                  setPathTitle("");
                  setPathDescription("");
                  setPathSteps([]);
                }}
              >
                Save path to pack
              </button>
            </div>
            {pathSteps.length > 0 && (
              <div className={styles.list}>
                {pathSteps.map((step, i) => (
                  <div key={step.id} className={styles.listItem}>
                    <div>
                      <strong>Stop {i + 1} — {artworkById(step.artworkId)?.title ?? "Artwork"}</strong>
                      <span>{step.note || "No note"}</span>
                    </div>
                    <div className={styles.row}>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSmall}`}
                        disabled={i === 0}
                        onClick={() =>
                          setPathSteps((s) => {
                            const next = [...s];
                            [next[i - 1], next[i]] = [next[i], next[i - 1]];
                            return next;
                          })
                        }
                      >
                        ↑
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSmall}`}
                        disabled={i === pathSteps.length - 1}
                        onClick={() =>
                          setPathSteps((s) => {
                            const next = [...s];
                            [next[i + 1], next[i]] = [next[i], next[i + 1]];
                            return next;
                          })
                        }
                      >
                        ↓
                      </button>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSmall}`}
                        onClick={() => setPathSteps((s) => s.filter((x) => x.id !== step.id))}
                      >
                        Remove
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
            {pack.paths.length > 0 && (
              <>
                <div className={styles.divider} />
                <div className={styles.list}>
                  {pack.paths.map((p) => (
                    <div key={p.id} className={styles.listItem}>
                      <div>
                        <strong>{p.title}</strong>
                        <span>
                          {p.steps.length} stops:{" "}
                          {p.steps.map((s) => artworkById(s.artworkId)?.title ?? "Artwork").join(" → ")}
                        </span>
                      </div>
                      <button
                        type="button"
                        className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`}
                        onClick={() => updatePack((c) => ({ ...c, paths: c.paths.filter((x) => x.id !== p.id) }))}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </>
            )}
          </>
        )}

        {/* ---- Resources --------------------------------------------------- */}
        {tab === "resources" && (
          <>
            <h3 style={{ marginTop: 18 }}>Downloadable resources</h3>
            <p className={styles.muted}>
              Print the whole pack as a handout (your browser’s print dialog saves it as
              PDF), or download the pack as JSON to reuse elsewhere.
            </p>
            <div className={styles.row} style={{ marginTop: 12 }}>
              <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => window.print()}>
                Print / save as PDF
              </button>
              <button type="button" className={styles.btn} onClick={exportJson}>
                Download JSON
              </button>
            </div>
            <p className={styles.status} style={{ marginTop: 10 }}>
              The printout contains the learner labels, guides, questions, analysis prompts
              and learning paths for “{exhibition.title}” ({pack.audience}).
            </p>
          </>
        )}
      </div>

      <div className={styles.card}>
        <p className={styles.kicker}>Save</p>
        <h2>Save this education pack</h2>
        <div className={styles.row} style={{ marginTop: 12 }}>
          <input
            type="text"
            value={saveName}
            onChange={(e) => setSaveName(e.target.value)}
            placeholder={savedId ? "Rename the pack…" : `Education pack — ${exhibition.title} (${pack.audience})`}
            aria-label="Pack name"
            style={{ flex: 1, minWidth: 220, padding: "10px 12px", border: "1px solid var(--line, #eceae4)", borderRadius: 6, background: "#fff", fontSize: 13 }}
          />
          <button type="button" className={`${styles.btn} ${styles.btnPrimary}`} onClick={() => void savePack()} disabled={saving}>
            {saving ? "Saving…" : savedId ? "Update saved pack" : "Save pack"}
          </button>
        </div>
        {saveStatus && (
          <p className={`${styles.status} ${saveStatus.startsWith("Could") ? styles.statusErr : styles.statusOk}`} role="status" style={{ marginTop: 10 }}>
            {saveStatus}
          </p>
        )}
        <div className={styles.divider} />
        <h3>Saved packs</h3>
        {savedLoading ? (
          <p className={styles.status}>Loading saved packs…</p>
        ) : savedError ? (
          <p className={styles.statusErr} role="alert">{savedError}</p>
        ) : saved.length === 0 ? (
          <p className={styles.status}>No education packs saved yet.</p>
        ) : (
          <div className={styles.list}>
            {saved.map((row) => (
              <div key={row.id} className={styles.listItem}>
                <div>
                  <strong>{row.title}</strong>
                  <span>
                    {row.data.exhibitionTitle} · {row.data.audience} ·{" "}
                    {Object.values(row.data.labels ?? {}).filter((v) => typeof v === "string" && v.trim()).length} labels ·{" "}
                    {(row.data.quizzes ?? []).length} quizzes · updated{" "}
                    {new Date(row.updatedAt).toLocaleDateString()}
                  </span>
                </div>
                <div className={styles.row}>
                  <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={() => loadPack(row)}>
                    Load
                  </button>
                  {confirmDeleteId === row.id ? (
                    <>
                      <button type="button" className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`} onClick={() => void deletePack(row.id)}>
                        Confirm delete
                      </button>
                      <button type="button" className={`${styles.btn} ${styles.btnSmall}`} onClick={() => setConfirmDeleteId(null)}>
                        Keep
                      </button>
                    </>
                  ) : (
                    <button type="button" className={`${styles.btn} ${styles.btnSmall} ${styles.btnDanger}`} onClick={() => setConfirmDeleteId(row.id)}>
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      </div>

      {/* Printable resource sheet — visible only when printing. */}
      <div className={styles.printOnly} aria-hidden>
        <h1>{exhibition.title} — Learning resources</h1>
        <p>Education pack · {pack.audience} · SANAA</p>
        {artworks.map((a) => {
          const label = pack.labels[a.id];
          const qs = pack.questions[a.id] ?? [];
          const p = pack.prompts[a.id];
          if (!label?.trim() && qs.length === 0 && !p?.observation.trim() && !p?.interpretation.trim() && !p?.context.trim()) return null;
          return (
            <section key={a.id}>
              <h2>{a.title} ({a.year} · {a.medium})</h2>
              {label?.trim() && <p>{label}</p>}
              {p?.observation.trim() && <p><strong>Observe:</strong> {p.observation}</p>}
              {p?.interpretation.trim() && <p><strong>Interpret:</strong> {p.interpretation}</p>}
              {p?.context.trim() && <p><strong>Context:</strong> {p.context}</p>}
              {qs.map((q) => (
                <p key={q.id}><strong>Q:</strong> {q.question}<br /><strong>A:</strong> {q.answer}</p>
              ))}
            </section>
          );
        })}
        {pack.guides.map((g) => (
          <section key={g.id}>
            <h2>{g.title}</h2>
            {g.sections.map((s) => (
              <div key={s.id}>
                <h3>{s.heading}</h3>
                <p>{s.body}</p>
              </div>
            ))}
          </section>
        ))}
        {pack.paths.map((p) => (
          <section key={p.id}>
            <h2>Route — {p.title}</h2>
            {p.description && <p>{p.description}</p>}
            <ol>
              {p.steps.map((s) => (
                <li key={s.id}>
                  {artworkById(s.artworkId)?.title ?? "Artwork"}
                  {s.note ? ` — ${s.note}` : ""}
                </li>
              ))}
            </ol>
          </section>
        ))}
      </div>
    </div>
  );
}
