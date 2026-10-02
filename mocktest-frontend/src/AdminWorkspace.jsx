import { useEffect, useMemo, useState } from "react";
import {
  BookOpen,
  Check,
  CircleHelp,
  FilePlus2,
  Layers3,
  Plus,
  ShieldCheck,
} from "lucide-react";
import { apiRequest } from "./api";

const fieldClass =
  "h-10 w-full rounded-lg border border-[#e1e7df] bg-white px-3 text-[12px] outline-none focus:border-[#80964c] focus:ring-2 focus:ring-[#d8f270]/50";
const labelClass = "mb-1.5 block text-[10px] font-bold text-[#56645b]";

export default function AdminWorkspace({ onCatalogChanged }) {
  const [view, setView] = useState("subjects");
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [tests, setTests] = useState([]);
  const [questions, setQuestions] = useState([]);
  const [selectedSubjectId, setSelectedSubjectId] = useState("");
  const [selectedQuestionIds, setSelectedQuestionIds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  async function loadAdminData() {
    setLoading(true);
    setError("");
    try {
      const [sectionData, subjectData, testData] = await Promise.all([
        apiRequest("/api/sections"),
        apiRequest("/api/subjects"),
        apiRequest("/api/mock-tests"),
      ]);
      setSections(sectionData);
      setSubjects(subjectData);
      setTests(testData);
      setSelectedSubjectId(
        (current) => current || String(subjectData[0]?.id ?? ""),
      );
    } catch (requestError) {
      setError(requestError.message || "Could not load admin data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    let isCurrent = true;
    Promise.all([
      apiRequest("/api/sections"),
      apiRequest("/api/subjects"),
      apiRequest("/api/mock-tests"),
    ])
      .then(([sectionData, subjectData, testData]) => {
        if (!isCurrent) return;
        setSections(sectionData);
        setSubjects(subjectData);
        setTests(testData);
        setSelectedSubjectId(
          (current) => current || String(subjectData[0]?.id ?? ""),
        );
      })
      .catch((requestError) => {
        if (isCurrent)
          setError(requestError.message || "Could not load admin data.");
      })
      .finally(() => {
        if (isCurrent) setLoading(false);
      });
    return () => {
      isCurrent = false;
    };
  }, []);

  useEffect(() => {
    if (!selectedSubjectId) return;
    let isCurrent = true;
    apiRequest(`/api/questions/subject/${selectedSubjectId}`)
      .then((subjectQuestions) => {
        if (!isCurrent) return;
        setQuestions(subjectQuestions);
        setSelectedQuestionIds([]);
      })
      .catch((requestError) => {
        if (isCurrent)
          setError(requestError.message || "Could not load questions.");
      });
    return () => {
      isCurrent = false;
    };
  }, [selectedSubjectId]);

  const selectedQuestions = useMemo(
    () =>
      questions.filter((question) => selectedQuestionIds.includes(question.id)),
    [questions, selectedQuestionIds],
  );
  const selectedMarks = selectedQuestions.reduce(
    (total, question) => total + (question.marks ?? 0),
    0,
  );

  async function handleCreateSection(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const section = await apiRequest("/api/sections", {
        method: "POST",
        body: JSON.stringify({
          name: formData.get("sectionName"),
          description: formData.get("sectionDescription"),
        }),
      });
      setSections((current) => [...current, section]);
      form.reset();
      setNotice(`${section.name} section created.`);
    } catch (requestError) {
      setError(requestError.message || "Could not create the section.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateSubject(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const sectionId = formData.get("sectionId");
      const subject = await apiRequest(`/api/sections/${sectionId}/subjects`, {
        method: "POST",
        body: JSON.stringify({
          name: formData.get("subjectName"),
          description: formData.get("subjectDescription"),
        }),
      });
      setSubjects((current) => [...current, subject]);
      setSelectedSubjectId(String(subject.id));
      form.reset();
      setNotice(`${subject.name} is ready for questions.`);
      await onCatalogChanged();
    } catch (requestError) {
      setError(requestError.message || "Could not create the subject.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateQuestion(event) {
    event.preventDefault();
    const form = event.currentTarget;
    const formData = new FormData(form);
    const correctOption = Number(formData.get("correctOption"));
    const options = [1, 2, 3, 4].map((optionNumber) => ({
      optionText: formData.get(`option${optionNumber}`),
      correct: optionNumber === correctOption,
    }));
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const question = await apiRequest(
        `/api/questions/subjects/${selectedSubjectId}`,
        {
          method: "POST",
          body: JSON.stringify({
            questionText: formData.get("questionText"),
            explanation: formData.get("explanation"),
            marks: Number(formData.get("marks")),
            negativeMarks: Number(formData.get("negativeMarks")),
            difficulty: formData.get("difficulty"),
            options,
          }),
        },
      );
      setQuestions((current) => [...current, question]);
      form.reset();
      setNotice("Question added to the selected subject.");
    } catch (requestError) {
      setError(requestError.message || "Could not create the question.");
    } finally {
      setSaving(false);
    }
  }

  async function handleCreateTest(event) {
    event.preventDefault();
    if (!selectedQuestions.length) {
      setError("Select at least one question for this test.");
      return;
    }
    const form = event.currentTarget;
    const formData = new FormData(form);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      const test = await apiRequest("/api/mock-tests", {
        method: "POST",
        body: JSON.stringify({
          title: formData.get("title"),
          description: formData.get("description"),
          durationMinutes: Number(formData.get("durationMinutes")),
          totalMarks: Number(formData.get("totalMarks")),
          passingMarks: Number(formData.get("passingMarks")),
        }),
      });
      for (const [index, question] of selectedQuestions.entries()) {
        await apiRequest(`/api/mock-tests/${test.id}/questions`, {
          method: "POST",
          body: JSON.stringify({
            questionId: question.id,
            questionOrder: index + 1,
          }),
        });
      }
      setTests((current) => [test, ...current]);
      setSelectedQuestionIds([]);
      form.reset();
      setNotice(
        `“${test.title}” is published with ${selectedQuestions.length} questions.`,
      );
      await onCatalogChanged();
    } catch (requestError) {
      setError(
        requestError.message ||
          "The test could not be completed. Check its questions and try again.",
      );
      await loadAdminData();
    } finally {
      setSaving(false);
    }
  }

  function toggleQuestion(questionId) {
    setSelectedQuestionIds((current) =>
      current.includes(questionId)
        ? current.filter((id) => id !== questionId)
        : [...current, questionId],
    );
  }

  return (
    <section className="mx-auto max-w-[1120px] pt-2">
      <div className="mb-7 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[1.7px] text-[#8d9a90]">
            <ShieldCheck size={13} /> Admin workspace
          </p>
          <h1 className="font-display text-[30px] font-extrabold tracking-[-1px] text-[#1d2a23]">
            Build the test library
          </h1>
          <p className="mt-2 max-w-[600px] text-[13px] leading-6 text-[#7c8980]">
            Organize subjects, write questions, and publish a ready-to-take mock
            test.
          </p>
        </div>
        <div className="flex rounded-full border border-[#e1e7df] bg-white p-1">
          <AdminTab
            active={view === "subjects"}
            onClick={() => setView("subjects")}
          >
            <Layers3 size={14} /> Subjects & questions
          </AdminTab>
          <AdminTab active={view === "tests"} onClick={() => setView("tests")}>
            <FilePlus2 size={14} /> Mock tests
          </AdminTab>
        </div>
      </div>

      {error && (
        <Message tone="error" onDismiss={() => setError("")}>
          {error}
        </Message>
      )}
      {notice && (
        <Message tone="success" onDismiss={() => setNotice("")}>
          {notice}
        </Message>
      )}

      {loading ? (
        <div className="rounded-xl border border-[#e5eae3] bg-white px-5 py-12 text-center text-[12px] font-semibold text-[#7d8981]">
          Loading admin workspace…
        </div>
      ) : view === "subjects" ? (
        <div className="grid gap-5 xl:grid-cols-[0.8fr_1.2fr]">
          <div className="space-y-5">
            <Panel
              icon={Plus}
              eyebrow="First, organize"
              title="Create a section"
              description="Sections group related subjects together."
            >
              <form onSubmit={handleCreateSection} className="space-y-3">
                <label className="block">
                  <span className={labelClass}>Section name</span>
                  <input
                    required
                    name="sectionName"
                    maxLength="100"
                    placeholder="e.g. Entrance preparation"
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Description</span>
                  <textarea
                    name="sectionDescription"
                    maxLength="500"
                    rows="2"
                    placeholder="A short note about this section"
                    className="w-full resize-y rounded-lg border border-[#e1e7df] bg-white px-3 py-2.5 text-[12px] outline-none focus:border-[#80964c] focus:ring-2 focus:ring-[#d8f270]/50"
                  />
                </label>
                <button
                  disabled={saving}
                  className="inline-flex items-center gap-2 rounded-full bg-[#17221f] px-4 py-2.5 text-[11px] font-bold text-white hover:bg-[#304238] disabled:opacity-50"
                >
                  <Plus size={14} /> Add section
                </button>
              </form>
            </Panel>

            <Panel
              icon={BookOpen}
              eyebrow="Build your catalog"
              title="Add a subject"
              description="Every subject belongs to a section."
            >
              <form onSubmit={handleCreateSubject} className="space-y-3">
                <label className="block">
                  <span className={labelClass}>Section</span>
                  <select
                    required
                    name="sectionId"
                    defaultValue=""
                    className={fieldClass}
                  >
                    <option value="" disabled>
                      Select a section
                    </option>
                    {sections.map((section) => (
                      <option key={section.id} value={section.id}>
                        {section.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={labelClass}>Subject name</span>
                  <input
                    required
                    name="subjectName"
                    maxLength="100"
                    placeholder="e.g. Applied Mathematics"
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Description</span>
                  <textarea
                    name="subjectDescription"
                    maxLength="500"
                    rows="2"
                    placeholder="What will students practice?"
                    className="w-full resize-y rounded-lg border border-[#e1e7df] bg-white px-3 py-2.5 text-[12px] outline-none focus:border-[#80964c] focus:ring-2 focus:ring-[#d8f270]/50"
                  />
                </label>
                <button
                  disabled={saving || !sections.length}
                  className="inline-flex items-center gap-2 rounded-full bg-[#17221f] px-4 py-2.5 text-[11px] font-bold text-white hover:bg-[#304238] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <Plus size={14} /> Add subject
                </button>
                {!sections.length && (
                  <p className="text-[10px] text-[#9b7762]">
                    Create a section before adding a subject.
                  </p>
                )}
              </form>
            </Panel>
          </div>

          <Panel
            icon={FilePlus2}
            eyebrow="Question bank"
            title="Write a question"
            description="Questions are added to a subject and can be used in multiple mock tests."
          >
            <form onSubmit={handleCreateQuestion} className="space-y-4">
              <label className="block">
                <span className={labelClass}>Subject</span>
                <select
                  required
                  value={selectedSubjectId}
                  onChange={(event) => setSelectedSubjectId(event.target.value)}
                  className={fieldClass}
                >
                  <option value="">Select a subject</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                      {subject.sectionName ? ` · ${subject.sectionName}` : ""}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block">
                <span className={labelClass}>Question</span>
                <textarea
                  required
                  name="questionText"
                  rows="3"
                  placeholder="Write the question prompt"
                  className="w-full resize-y rounded-lg border border-[#e1e7df] bg-white px-3 py-2.5 text-[12px] outline-none focus:border-[#80964c] focus:ring-2 focus:ring-[#d8f270]/50"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-2">
                {[1, 2, 3, 4].map((number) => (
                  <label key={number} className="block">
                    <span className={labelClass}>
                      Option {String.fromCharCode(64 + number)}
                    </span>
                    <input
                      required
                      name={`option${number}`}
                      placeholder={`Answer option ${number}`}
                      className={fieldClass}
                    />
                  </label>
                ))}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className={labelClass}>Correct option</span>
                  <select
                    name="correctOption"
                    defaultValue="1"
                    className={fieldClass}
                  >
                    {[1, 2, 3, 4].map((number) => (
                      <option key={number} value={number}>
                        Option {String.fromCharCode(64 + number)}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="block">
                  <span className={labelClass}>Difficulty</span>
                  <select
                    name="difficulty"
                    defaultValue="MEDIUM"
                    className={fieldClass}
                  >
                    <option value="EASY">Easy</option>
                    <option value="MEDIUM">Medium</option>
                    <option value="HARD">Hard</option>
                  </select>
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <label className="block">
                    <span className={labelClass}>Marks</span>
                    <input
                      required
                      name="marks"
                      type="number"
                      min="1"
                      defaultValue="1"
                      className={fieldClass}
                    />
                  </label>
                  <label className="block">
                    <span className={labelClass}>Penalty</span>
                    <input
                      name="negativeMarks"
                      type="number"
                      min="0"
                      defaultValue="0"
                      className={fieldClass}
                    />
                  </label>
                </div>
              </div>
              <label className="block">
                <span className={labelClass}>
                  Explanation{" "}
                  <span className="font-medium text-[#9ba49d]">(optional)</span>
                </span>
                <textarea
                  name="explanation"
                  rows="2"
                  placeholder="Explain why the answer is correct"
                  className="w-full resize-y rounded-lg border border-[#e1e7df] bg-white px-3 py-2.5 text-[12px] outline-none focus:border-[#80964c] focus:ring-2 focus:ring-[#d8f270]/50"
                />
              </label>
              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-[#edf0eb] pt-4">
                <span className="text-[10px] text-[#8b968e]">
                  {questions.length} question{questions.length === 1 ? "" : "s"}{" "}
                  in this subject
                </span>
                <button
                  disabled={saving || !selectedSubjectId}
                  className="inline-flex items-center gap-2 rounded-full bg-[#17221f] px-4 py-2.5 text-[11px] font-bold text-white hover:bg-[#304238] disabled:opacity-50"
                >
                  <Plus size={14} /> Add question
                </button>
              </div>
            </form>
          </Panel>
        </div>
      ) : (
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_350px]">
          <Panel
            icon={FilePlus2}
            eyebrow="Publish a practice set"
            title="Create a mock test"
            description="Choose a subject and select its questions. They will appear together in the student test library."
          >
            <form onSubmit={handleCreateTest} className="space-y-4">
              <label className="block">
                <span className={labelClass}>Test title</span>
                <input
                  required
                  name="title"
                  maxLength="200"
                  placeholder="e.g. Mathematics · Foundations"
                  className={fieldClass}
                />
              </label>
              <label className="block">
                <span className={labelClass}>Description</span>
                <textarea
                  name="description"
                  maxLength="1000"
                  rows="2"
                  placeholder="A brief description for students"
                  className="w-full resize-y rounded-lg border border-[#e1e7df] bg-white px-3 py-2.5 text-[12px] outline-none focus:border-[#80964c] focus:ring-2 focus:ring-[#d8f270]/50"
                />
              </label>
              <div className="grid gap-3 sm:grid-cols-3">
                <label className="block">
                  <span className={labelClass}>Duration (min)</span>
                  <input
                    required
                    name="durationMinutes"
                    type="number"
                    min="1"
                    defaultValue="30"
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Total marks</span>
                  <input
                    required
                    name="totalMarks"
                    type="number"
                    min="1"
                    defaultValue={selectedMarks || 1}
                    key={`${selectedSubjectId}-${selectedQuestionIds.join(",")}`}
                    className={fieldClass}
                  />
                </label>
                <label className="block">
                  <span className={labelClass}>Passing marks</span>
                  <input
                    required
                    name="passingMarks"
                    type="number"
                    min="0"
                    defaultValue="0"
                    className={fieldClass}
                  />
                </label>
              </div>
              <label className="block">
                <span className={labelClass}>Subject</span>
                <select
                  required
                  value={selectedSubjectId}
                  onChange={(event) => setSelectedSubjectId(event.target.value)}
                  className={fieldClass}
                >
                  <option value="">Select a subject</option>
                  {subjects.map((subject) => (
                    <option key={subject.id} value={subject.id}>
                      {subject.name}
                    </option>
                  ))}
                </select>
              </label>
              <div className="rounded-lg border border-[#e7ece5]">
                <div className="flex items-center justify-between gap-3 border-b border-[#edf0eb] bg-[#fafbf9] px-4 py-3">
                  <span className="text-[10px] font-bold text-[#59685e]">
                    Choose questions
                  </span>
                  <span className="text-[9px] font-semibold text-[#97a198]">
                    {selectedQuestions.length} selected · {selectedMarks} marks
                  </span>
                </div>
                <div className="max-h-[310px] divide-y divide-[#f0f2ef] overflow-auto">
                  {questions.length ? (
                    questions.map((question) => (
                      <label
                        key={question.id}
                        className="flex cursor-pointer items-start gap-3 px-4 py-3 hover:bg-[#fafbf9]"
                      >
                        <input
                          type="checkbox"
                          checked={selectedQuestionIds.includes(question.id)}
                          onChange={() => toggleQuestion(question.id)}
                          className="mt-0.5 accent-[#526c40]"
                        />
                        <span className="min-w-0 flex-1">
                          <span className="line-clamp-2 block text-[11px] font-semibold leading-5 text-[#3d4c42]">
                            {question.questionText}
                          </span>
                          <span className="mt-1 block text-[9px] text-[#929d94]">
                            {question.difficulty} · {question.marks}{" "}
                            {question.marks === 1 ? "mark" : "marks"}
                          </span>
                        </span>
                      </label>
                    ))
                  ) : (
                    <div className="px-4 py-8 text-center text-[11px] text-[#89958c]">
                      {selectedSubjectId
                        ? "No questions here yet. Add subject questions first."
                        : "Select a subject to load its questions."}
                    </div>
                  )}
                </div>
              </div>
              <div className="flex justify-end border-t border-[#edf0eb] pt-4">
                <button
                  disabled={saving || !selectedQuestions.length}
                  className="inline-flex items-center gap-2 rounded-full bg-[#17221f] px-5 py-3 text-[11px] font-bold text-white hover:bg-[#304238] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {saving ? "Publishing…" : "Publish mock test"}
                  <Check size={14} />
                </button>
              </div>
            </form>
          </Panel>

          <aside className="space-y-5">
            <div className="rounded-xl bg-[#17221f] p-5 text-white">
              <div className="mb-4 grid h-9 w-9 place-items-center rounded-lg bg-[#d8f270] text-[#17221f]">
                <ShieldCheck size={18} />
              </div>
              <p className="text-[9px] font-bold uppercase tracking-[1.5px] text-white/45">
                Library overview
              </p>
              <p className="mt-2 font-display text-[23px] font-extrabold">
                {subjects.length}{" "}
                <span className="text-[13px] font-semibold text-white/50">
                  subjects
                </span>
              </p>
              <p className="mt-1 text-[11px] text-white/55">
                {tests.length} mock tests · {questions.length} questions in
                selected subject
              </p>
            </div>
            <div className="rounded-xl border border-[#e5eae3] bg-white p-5">
              <p className="mb-3 text-[9px] font-bold uppercase tracking-[1.3px] text-[#98a19a]">
                Recently created tests
              </p>
              {tests.slice(0, 5).length ? (
                <ul className="space-y-3">
                  {tests.slice(0, 5).map((test) => (
                    <li key={test.id} className="flex items-start gap-2.5">
                      <span className="mt-0.5 grid h-6 w-6 shrink-0 place-items-center rounded-md bg-[#eef3e8] text-[#698252]">
                        <BookOpen size={13} />
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-[11px] font-bold text-[#3d4b42]">
                          {test.title}
                        </span>
                        <span className="mt-0.5 block text-[9px] text-[#929d94]">
                          {test.durationMinutes} min · {test.questionCount ?? 0}{" "}
                          questions
                        </span>
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="text-[11px] text-[#919c93]">
                  Tests you publish will show here.
                </p>
              )}
            </div>
            <p className="flex items-start gap-2 px-1 text-[10px] leading-4 text-[#8e9990]">
              <CircleHelp size={14} className="mt-0.5 shrink-0" />A test’s
              subject is determined by the subject of its attached questions.
            </p>
          </aside>
        </div>
      )}
    </section>
  );
}

function AdminTab({ active, onClick, children }) {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-3 py-2 text-[10px] font-bold transition sm:px-3.5 ${active ? "bg-[#17221f] text-white" : "text-[#738078] hover:text-[#17221f]"}`}
    >
      {children}
    </button>
  );
}

function Panel({ icon: Icon, eyebrow, title, description, children }) {
  return (
    <section className="rounded-xl border border-[#e5eae3] bg-white p-5 sm:p-6">
      <div className="mb-5 flex items-start gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-[#edf3e7] text-[#637d51]">
          <Icon size={17} />
        </span>
        <div>
          <p className="text-[9px] font-bold uppercase tracking-[1.3px] text-[#9aa49b]">
            {eyebrow}
          </p>
          <h2 className="mt-0.5 font-display text-[16px] font-extrabold tracking-[-0.4px] text-[#26342b]">
            {title}
          </h2>
          <p className="mt-1 text-[10px] leading-4 text-[#8b968e]">
            {description}
          </p>
        </div>
      </div>
      {children}
    </section>
  );
}

function Message({ tone, onDismiss, children }) {
  const styles =
    tone === "error"
      ? "border-[#f1c4b8] bg-[#fff3ee] text-[#994a36]"
      : "border-[#cfdfc4] bg-[#f0f7e9] text-[#52713f]";
  return (
    <div
      className={`mb-5 flex items-start gap-2 rounded-lg border px-3.5 py-3 text-[11px] ${styles}`}
      role="status"
    >
      <CircleHelp size={15} className="mt-0.5 shrink-0" />
      <span className="flex-1">{children}</span>
      <button
        onClick={onDismiss}
        aria-label="Dismiss message"
        className="font-bold"
      >
        ×
      </button>
    </div>
  );
}
