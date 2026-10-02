import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Bell,
  BookOpen,
  Check,
  Clock3,
  Command,
  FileCheck2,
  Filter,
  GraduationCap,
  Eye,
  EyeOff,
  LayoutDashboard,
  LockKeyhole,
  LoaderCircle,
  LogOut,
  Mail,
  Menu,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  X,
} from "lucide-react";
import AdminWorkspace from "./AdminWorkspace";
import { apiRequest } from "./api";

const USER_STORAGE_KEY = "formative.user";

function formatDate(value) {
  if (!value) return "Recently";
  return new Intl.DateTimeFormat("en", {
    month: "short",
    day: "numeric",
  }).format(new Date(value));
}

function formatTime(seconds) {
  const minutes = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const remainder = (seconds % 60).toString().padStart(2, "0");
  return `${minutes}:${remainder}`;
}

function App() {
  const [tests, setTests] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [testSubjects, setTestSubjects] = useState({});
  const [history, setHistory] = useState([]);
  const [user, setUser] = useState(() => {
    try {
      const storedUser = JSON.parse(localStorage.getItem(USER_STORAGE_KEY));
      if (storedUser?.token) return storedUser;
      localStorage.removeItem(USER_STORAGE_KEY);
      return null;
    } catch {
      return null;
    }
  });
  const [page, setPage] = useState("overview");
  const [search, setSearch] = useState("");
  const [subjectFilter, setSubjectFilter] = useState("all");
  const [durationFilter, setDurationFilter] = useState("all");
  const [isRegisterOpen, setIsRegisterOpen] = useState(false);
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isMobileNavOpen, setIsMobileNavOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(null);
  const [testSession, setTestSession] = useState(null);
  const [answers, setAnswers] = useState({});
  const [questionIndex, setQuestionIndex] = useState(0);
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [result, setResult] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [startingTestId, setStartingTestId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [activeTests, allSubjects] = await Promise.all([
        apiRequest("/api/mock-tests/active"),
        apiRequest("/api/subjects"),
      ]);
      const attachedQuestions = await Promise.all(
        activeTests.map((test) =>
          apiRequest(`/api/mock-tests/${test.id}/questions`).catch(() => []),
        ),
      );
      const subjectMap = Object.fromEntries(
        activeTests.map((test, index) => [
          test.id,
          [
            ...new Set(
              attachedQuestions[index]
                .map((item) => item.subjectId)
                .filter(Boolean),
            ),
          ],
        ]),
      );
      setTests(activeTests);
      setSubjects(allSubjects.filter((subject) => subject.active));
      setTestSubjects(subjectMap);
      setError("");
      setHistory(
        user?.id && user.role !== "ADMIN"
          ? await apiRequest("/api/attempts/history")
          : [],
      );
    } catch (requestError) {
      setError(
        requestError.message || "Could not connect to the mock test API.",
      );
    } finally {
      setIsLoading(false);
    }
  }, [user]);

  useEffect(() => {
    const timer = window.setTimeout(loadData, 0);
    return () => window.clearTimeout(timer);
  }, [loadData]);

  useEffect(() => {
    const handleAuthExpired = () => {
      setUser(null);
      setHistory([]);
      setPage("login");
      setError("Your session expired. Please sign in again.");
    };
    window.addEventListener("formative:auth-expired", handleAuthExpired);
    return () =>
      window.removeEventListener("formative:auth-expired", handleAuthExpired);
  }, []);

  const filteredTests = useMemo(
    () =>
      tests.filter((test) => {
        const query = search.trim().toLowerCase();
        const textMatch =
          !query ||
          `${test.title} ${test.description ?? ""}`
            .toLowerCase()
            .includes(query);
        const durationMatch =
          durationFilter === "all" ||
          (durationFilter === "quick" && test.durationMinutes <= 30) ||
          (durationFilter === "full" && test.durationMinutes > 30);
        const subjectMatch =
          subjectFilter === "all" ||
          (testSubjects[test.id] ?? []).includes(Number(subjectFilter));
        return textMatch && durationMatch && subjectMatch;
      }),
    [tests, search, durationFilter, subjectFilter, testSubjects],
  );

  const submitAttempt = useCallback(async () => {
    if (!attempt || !user?.id || isSubmitting) return;
    setIsSubmitting(true);
    try {
      const finalResult = await apiRequest(
        `/api/attempts/${attempt.attemptId}/submit`,
        { method: "POST" },
      );
      setResult(finalResult);
      setAttempt(null);
      setTestSession(null);
      setPage("result");
      await loadData();
    } catch (requestError) {
      setError(requestError.message || "Your test could not be submitted.");
    } finally {
      setIsSubmitting(false);
    }
  }, [attempt, user, isSubmitting, loadData]);

  useEffect(() => {
    if (!attempt || page !== "attempt") return undefined;
    if (secondsLeft <= 0) {
      const submitTimer = window.setTimeout(submitAttempt, 0);
      return () => window.clearTimeout(submitTimer);
    }
    const timer = window.setTimeout(
      () => setSecondsLeft((current) => current - 1),
      1000,
    );
    return () => window.clearTimeout(timer);
  }, [attempt, page, secondsLeft, submitAttempt]);

  async function registerProfile(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    try {
      const registered = await apiRequest("/api/auth/register", {
        method: "POST",
        body: JSON.stringify({
          name: formData.get("name"),
          email: formData.get("email"),
          password: formData.get("password"),
          role: "STUDENT",
        }),
      });
      const loginResponse = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      });
      const savedUser = {
        id: loginResponse.userId ?? registered.id,
        name: loginResponse.name ?? registered.name,
        email: loginResponse.email ?? registered.email,
        role: loginResponse.role ?? registered.role,
        token: loginResponse.token,
      };
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(savedUser));
      setUser(savedUser);
      setIsRegisterOpen(false);
      navigate("overview");
      setError("");
    } catch (requestError) {
      setError(requestError.message || "Could not create your profile.");
    }
  }

  async function login(event) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    setIsLoggingIn(true);
    setError("");
    try {
      const response = await apiRequest("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        }),
      });
      const signedInUser = {
        id: response.userId,
        name: response.name,
        email: response.email,
        role: response.role,
        token: response.token,
      };
      localStorage.setItem(USER_STORAGE_KEY, JSON.stringify(signedInUser));
      setUser(signedInUser);
      navigate("overview");
    } catch (requestError) {
      setError(
        requestError.message ||
          "We couldn't sign you in. Check your details and try again.",
      );
    } finally {
      setIsLoggingIn(false);
    }
  }

  async function startTest(test) {
    if (!user?.id) {
      setIsRegisterOpen(true);
      return;
    }
    setStartingTestId(test.id);
    setError("");
    try {
      const nextAttempt = await apiRequest(`/api/attempts/start/${test.id}`, {
        method: "POST",
      });
      const session = await apiRequest(
        `/api/attempts/${nextAttempt.attemptId}/test`,
      );
      const savedAnswers = await apiRequest(
        `/api/attempts/${nextAttempt.attemptId}/answers`,
      ).catch(() => []);
      setAttempt(nextAttempt);
      setTestSession(session);
      setAnswers(
        Object.fromEntries(
          savedAnswers.map((answer) => [
            answer.questionId,
            answer.selectedOptionId,
          ]),
        ),
      );
      setQuestionIndex(0);
      setSecondsLeft(
        (nextAttempt.durationMinutes ?? session.durationMinutes ?? 0) * 60,
      );
      setPage("attempt");
    } catch (requestError) {
      setError(requestError.message || "Could not start this test.");
    } finally {
      setStartingTestId(null);
    }
  }

  async function selectOption(question, option) {
    if (!attempt || !user?.id) return;
    setAnswers((current) => ({ ...current, [question.id]: option.id }));
    try {
      await apiRequest(`/api/attempts/${attempt.attemptId}/answers`, {
        method: "POST",
        body: JSON.stringify({
          questionId: question.id,
          optionId: option.id,
        }),
      });
    } catch (requestError) {
      setError(requestError.message || "Your answer could not be saved.");
    }
  }

  function navigate(nextPage) {
    setPage(nextPage);
    setIsMobileNavOpen(false);
    setError("");
  }

  function signOut() {
    localStorage.removeItem(USER_STORAGE_KEY);
    setUser(null);
    setHistory([]);
    navigate("overview");
  }

  const questions = testSession?.questions ?? [];
  const activeQuestion = questions[questionIndex];
  const completedCount = history.filter(
    (item) => item.status === "SUBMITTED",
  ).length;
  const averageScore = history.length
    ? Math.round(
        history.reduce((total, item) => total + (item.percentage ?? 0), 0) /
          history.length,
      )
    : 0;
  const today = new Intl.DateTimeFormat("en", {
    weekday: "long",
    month: "long",
    day: "numeric",
  }).format(new Date());

  if (page === "login" && !user) {
    return (
      <LoginPage
        onSubmit={login}
        onCreateProfile={() => setIsRegisterOpen(true)}
        error={error}
        onDismissError={() => setError("")}
        isSubmitting={isLoggingIn}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f7f3] text-[#17221f]">
      <div className="flex min-h-screen">
        <aside
          className={`fixed inset-y-0 left-0 z-40 flex w-[252px] flex-col bg-[#17221f] px-5 py-6 text-white transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${isMobileNavOpen ? "translate-x-0" : "-translate-x-full"}`}
        >
          <a
            href="#home"
            onClick={(event) => {
              event.preventDefault();
              navigate("overview");
            }}
            className="mb-11 flex items-center gap-3 px-2 text-white no-underline"
          >
            <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#d8f270] text-[#17221f]">
              <Command size={20} strokeWidth={2.5} />
            </span>
            <span className="font-display text-[20px] font-extrabold">
              formative<span className="text-[#d8f270]">.</span>
            </span>
          </a>
          <p className="mb-3 px-3 text-[10px] font-bold uppercase tracking-[1.7px] text-white/35">
            Workspace
          </p>
          <nav className="space-y-1" aria-label="Main navigation">
            <SidebarLink
              icon={LayoutDashboard}
              label="Overview"
              active={page === "overview"}
              onClick={() => navigate("overview")}
            />
            <SidebarLink
              icon={BookOpen}
              label="Practice tests"
              active={page === "tests"}
              onClick={() => navigate("tests")}
            />
            <SidebarLink
              icon={Target}
              label="My results"
              active={page === "history"}
              onClick={() => navigate("history")}
            />
            {user?.role === "ADMIN" && (
              <SidebarLink
                icon={ShieldCheck}
                label="Admin workspace"
                active={page === "admin"}
                onClick={() => navigate("admin")}
              />
            )}
          </nav>
          <div className="mt-auto">
            <div className="mb-5 rounded-2xl border border-white/10 bg-white/[0.055] p-4">
              <div className="mb-3 flex h-8 w-8 items-center justify-center rounded-lg bg-[#ff8166]/15 text-[#ff9d85]">
                <Sparkles size={16} />
              </div>
              <p className="font-display text-[14px] font-bold text-white">
                A little, often.
              </p>
              <p className="mt-1 text-[12px] leading-5 text-white/50">
                Short practice sessions add up to real progress.
              </p>
              <button
                onClick={() => navigate("tests")}
                className="mt-3 inline-flex items-center gap-1.5 text-[12px] font-bold text-[#d8f270]"
              >
                Find a test <ArrowRight size={13} />
              </button>
            </div>
            <div className="flex items-center gap-3 border-t border-white/10 px-2 pt-4">
              <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-[#b5d9ce] text-[13px] font-bold text-[#17352d]">
                {user?.name?.slice(0, 1).toUpperCase() ?? (
                  <GraduationCap size={17} />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-[12px] font-semibold">
                  {user?.name ?? "Your profile"}
                </p>
                <p className="truncate text-[11px] text-white/40">
                  {user?.role === "ADMIN"
                    ? "Administrator"
                    : (user?.email ?? "Student workspace")}
                </p>
              </div>
              {user && (
                <button
                  onClick={signOut}
                  aria-label="Sign out"
                  title="Sign out"
                  className="rounded-md p-1.5 text-white/40 hover:bg-white/10 hover:text-white"
                >
                  <LogOut size={15} />
                </button>
              )}
            </div>
          </div>
        </aside>

        {isMobileNavOpen && (
          <button
            className="fixed inset-0 z-30 bg-black/40 lg:hidden"
            aria-label="Close navigation"
            onClick={() => setIsMobileNavOpen(false)}
          />
        )}

        <main className="min-w-0 flex-1">
          <header className="flex h-[76px] items-center justify-between border-b border-[#e6eae4] px-5 sm:px-8 xl:px-12">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsMobileNavOpen(true)}
                className="grid h-9 w-9 place-items-center rounded-lg border border-[#e0e5dd] text-[#43514b] lg:hidden"
                aria-label="Open navigation"
              >
                <Menu size={19} />
              </button>
              <span className="hidden text-[12px] font-semibold text-[#929a94] sm:inline">
                {today}
              </span>
              <span className="hidden h-1 w-1 rounded-full bg-[#c2c9c2] sm:inline-block" />
              <span className="text-[12px] font-semibold text-[#63716a]">
                {page === "attempt"
                  ? "Test in progress"
                  : page === "history"
                    ? "Your results"
                    : page === "tests"
                      ? "Test library"
                      : page === "admin"
                        ? "Admin workspace"
                        : "Your learning space"}
              </span>
            </div>
            <div className="flex items-center gap-2.5">
              <button
                className="relative grid h-9 w-9 place-items-center rounded-full text-[#6d7972] hover:bg-[#e9ede7]"
                aria-label="Notifications"
              >
                <Bell size={18} />
                <span className="absolute right-[8px] top-[7px] h-1.5 w-1.5 rounded-full bg-[#ff8166] ring-2 ring-[#f5f7f3]" />
              </button>
              {!user && (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => navigate("login")}
                    className="text-[12px] font-bold text-[#53645a] hover:text-[#17221f]"
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => setIsRegisterOpen(true)}
                    className="rounded-full bg-[#17221f] px-4 py-2 text-[12px] font-bold text-white hover:bg-[#293a33]"
                  >
                    Create profile
                  </button>
                </div>
              )}
            </div>
          </header>

          <div className="mx-auto max-w-[1440px] px-5 pb-12 pt-7 sm:px-8 xl:px-12">
            {error && (
              <div
                className="mb-5 flex items-start gap-3 rounded-xl border border-[#f1c4b8] bg-[#fff3ee] px-4 py-3 text-[12px] text-[#994a36]"
                role="alert"
              >
                <span className="flex-1">{error}</span>
                <button
                  onClick={() => setError("")}
                  aria-label="Dismiss message"
                >
                  <X size={16} />
                </button>
              </div>
            )}
            {page === "admin" && user?.role === "ADMIN" ? (
              <AdminWorkspace onCatalogChanged={loadData} />
            ) : page === "attempt" && testSession ? (
              <TestRunner
                attempt={attempt}
                session={testSession}
                questions={questions}
                activeQuestion={activeQuestion}
                questionIndex={questionIndex}
                answers={answers}
                secondsLeft={secondsLeft}
                isSubmitting={isSubmitting}
                onNavigate={setQuestionIndex}
                onSelect={selectOption}
                onSubmit={submitAttempt}
              />
            ) : page === "result" && result ? (
              <ResultView
                result={result}
                onReturn={() => navigate("overview")}
                onExplore={() => navigate("tests")}
              />
            ) : page === "history" ? (
              <HistoryView
                history={history}
                hasUser={Boolean(user)}
                onRegister={() => setIsRegisterOpen(true)}
              />
            ) : (
              <>
                {page === "overview" && (
                  <DashboardHero
                    user={user}
                    testCount={tests.length}
                    onBrowse={() => navigate("tests")}
                  />
                )}
                <section className={page === "overview" ? "mt-10" : ""}>
                  <div className="mb-5 flex flex-wrap items-end justify-between gap-4">
                    <div>
                      <p className="mb-1 text-[10px] font-bold uppercase tracking-[1.8px] text-[#98a19a]">
                        {page === "overview"
                          ? "Pick up where you are"
                          : "Find your next challenge"}
                      </p>
                      <h2 className="font-display text-[23px] font-extrabold tracking-[-0.8px] text-[#1a2822]">
                        {page === "overview"
                          ? "Ready when you are"
                          : "Practice library"}
                      </h2>
                    </div>
                    {page === "overview" && (
                      <button
                        onClick={() => navigate("tests")}
                        className="hidden items-center gap-1.5 text-[12px] font-bold text-[#53645a] sm:inline-flex"
                      >
                        View all tests <ArrowUpRight size={14} />
                      </button>
                    )}
                  </div>
                  <TestCatalog
                    tests={
                      page === "overview"
                        ? filteredTests.slice(0, 3)
                        : filteredTests
                    }
                    subjects={subjects}
                    testSubjects={testSubjects}
                    isLoading={isLoading}
                    search={search}
                    onSearch={setSearch}
                    subjectFilter={subjectFilter}
                    onSubjectFilter={setSubjectFilter}
                    durationFilter={durationFilter}
                    onDurationFilter={setDurationFilter}
                    onStart={startTest}
                    startingTestId={startingTestId}
                    onRetry={() => {
                      setIsLoading(true);
                      loadData();
                    }}
                    hasError={Boolean(error)}
                  />
                </section>
                {page === "overview" && (
                  <DashboardFooter
                    history={history}
                    user={user}
                    averageScore={averageScore}
                    completedCount={completedCount}
                    onViewHistory={() => navigate("history")}
                    onRegister={() => setIsRegisterOpen(true)}
                  />
                )}
              </>
            )}
          </div>
        </main>
      </div>
      {isRegisterOpen && (
        <RegisterModal
          onClose={() => setIsRegisterOpen(false)}
          onSubmit={registerProfile}
        />
      )}
    </div>
  );
}

function SidebarLink({ icon: Icon, label, active, onClick }) {
  return (
    <button
      onClick={onClick}
      className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left text-[13px] font-semibold transition ${active ? "bg-[#d8f270] text-[#17221f]" : "text-white/60 hover:bg-white/[0.07] hover:text-white"}`}
    >
      <Icon size={17} strokeWidth={active ? 2.4 : 1.8} />
      <span>{label}</span>
      {active && (
        <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#17221f]" />
      )}
    </button>
  );
}

function DashboardHero({ user, testCount, onBrowse }) {
  return (
    <section className="hero-enter grid overflow-hidden rounded-[20px] bg-[#d8f270] lg:min-h-[262px] lg:grid-cols-[1.15fr_0.85fr]">
      <div className="relative z-10 flex flex-col items-start justify-center px-6 py-8 sm:px-10 lg:px-12 lg:py-10">
        <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-[#65752f]/15 bg-white/40 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[1.4px] text-[#526226]">
          <Sparkles size={13} /> Your study space
        </div>
        <h1 className="max-w-[550px] font-display text-[34px] font-extrabold leading-[1.08] tracking-[-1.6px] text-[#18231c] sm:text-[42px]">
          {user
            ? `Good to have you back, ${user.name.split(" ")[0]}.`
            : "Make room for your next breakthrough."}
        </h1>
        <p className="mt-3 max-w-[420px] text-[14px] leading-6 text-[#35452b]">
          A focused practice today is a more confident you on test day.
        </p>
        <button
          onClick={onBrowse}
          className="mt-6 inline-flex items-center gap-2 rounded-full bg-[#17221f] px-5 py-3 text-[12px] font-bold text-white hover:bg-[#304238]"
        >
          Explore mock tests <ArrowRight size={15} />
        </button>
        <div className="mt-6 flex items-center gap-2 text-[11px] font-semibold text-[#42552d]">
          <span className="flex -space-x-1.5">
            <span className="h-5 w-5 rounded-full border-2 border-[#d8f270] bg-[#fc8166]" />
            <span className="h-5 w-5 rounded-full border-2 border-[#d8f270] bg-[#698f82]" />
            <span className="h-5 w-5 rounded-full border-2 border-[#d8f270] bg-[#e0ad68]" />
          </span>
          <span>{testCount} active tests ready to explore</span>
        </div>
      </div>
      <div className="relative hidden min-h-[260px] overflow-hidden lg:block">
        <img
          className="absolute inset-0 h-full w-full object-cover object-center"
          src="https://images.unsplash.com/photo-1455390582262-044cdead277a?auto=format&fit=crop&w=1200&q=85"
          alt="Notebook and pen ready for a study session"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#d8f270] via-[#d8f270]/30 to-transparent" />
        <div className="absolute bottom-7 right-8 flex items-center gap-3 rounded-xl border border-white/70 bg-white/90 px-4 py-3 shadow-lg">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-[#17221f] text-[#d8f270]">
            <FileCheck2 size={18} />
          </span>
          <span>
            <span className="block text-[10px] font-bold uppercase text-[#8a948d]">
              Small steps
            </span>
            <span className="mt-0.5 block text-[13px] font-bold">
              Big confidence
            </span>
          </span>
        </div>
      </div>
    </section>
  );
}

function TestCatalog({
  tests,
  subjects,
  testSubjects,
  isLoading,
  search,
  onSearch,
  subjectFilter,
  onSubjectFilter,
  durationFilter,
  onDurationFilter,
  onStart,
  startingTestId,
  onRetry,
  hasError,
}) {
  return (
    <>
      <div className="mb-5 flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
        <div className="relative max-w-[360px] flex-1">
          <Search
            size={16}
            className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9ba49d]"
          />
          <input
            value={search}
            onChange={(event) => onSearch(event.target.value)}
            placeholder="Search tests"
            aria-label="Search tests"
            className="h-10 w-full rounded-lg border border-[#e2e7e0] bg-white pl-10 pr-4 text-[12px] outline-none placeholder:text-[#a4aca6] focus:border-[#80964c]"
          />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-[#8b958e]">
            <Filter size={13} />
            <span className="sr-only">Filters</span>
          </span>
          <select
            value={subjectFilter}
            onChange={(event) => onSubjectFilter(event.target.value)}
            aria-label="Filter by subject"
            className="h-9 max-w-[190px] rounded-full border border-[#e1e6df] bg-white px-3 text-[10px] font-bold text-[#69766f]"
          >
            <option value="all">All subjects</option>
            {subjects.map((subject) => (
              <option key={subject.id} value={subject.id}>
                {subject.name}
              </option>
            ))}
          </select>
          {[
            ["all", "All tests"],
            ["quick", "Quick practice"],
            ["full", "Full length"],
          ].map(([value, label]) => (
            <button
              key={value}
              onClick={() => onDurationFilter(value)}
              className={`whitespace-nowrap rounded-full px-3.5 py-2 text-[10px] font-bold ${durationFilter === value ? "bg-[#17221f] text-white" : "border border-[#e1e6df] bg-white text-[#69766f]"}`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>
      {isLoading ? (
        <div className="grid min-h-[180px] place-items-center rounded-xl border border-[#e6eae4] bg-white">
          <div className="flex items-center gap-2 text-[13px] font-semibold text-[#728077]">
            <LoaderCircle size={18} className="animate-spin" /> Loading your
            test library
          </div>
        </div>
      ) : tests.length ? (
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {tests.map((test, index) => (
            <TestCard
              key={test.id}
              test={test}
              index={index}
              subjects={(testSubjects[test.id] ?? [])
                .map(
                  (id) => subjects.find((subject) => subject.id === id)?.name,
                )
                .filter(Boolean)}
              onStart={onStart}
              isStarting={startingTestId === test.id}
            />
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-[#d9e0d8] bg-white px-5 py-12 text-center">
          <div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-[#eff3eb] text-[#75877b]">
            <BookOpen size={19} />
          </div>
          <p className="font-display text-[15px] font-extrabold text-[#24312a]">
            {hasError
              ? "Your test library is taking a break"
              : search
                ? "No tests match that search"
                : subjectFilter !== "all"
                  ? "No tests in this subject yet"
                  : "No active tests just yet"}
          </p>
          <p className="mx-auto mt-1.5 max-w-[390px] text-[12px] leading-5 text-[#849088]">
            {hasError
              ? "Check that the Spring API is running, then try again."
              : "Choose another subject or check back after a new test is published."}
          </p>
          {hasError && (
            <button
              onClick={onRetry}
              className="mt-4 rounded-full bg-[#17221f] px-4 py-2 text-[11px] font-bold text-white"
            >
              Try again
            </button>
          )}
        </div>
      )}
    </>
  );
}

function TestCard({ test, index, subjects, onStart, isStarting }) {
  const themes = [
    { icon: "bg-[#e8f1df] text-[#607d4d]", tag: "bg-[#d8e8cd] text-[#49673a]" },
    { icon: "bg-[#fce8df] text-[#b76b52]", tag: "bg-[#f7d9cc] text-[#99563f]" },
    { icon: "bg-[#e4edf0] text-[#567988]", tag: "bg-[#d5e5e9] text-[#466a77]" },
  ];
  const theme = themes[index % themes.length];
  return (
    <article className="group flex min-h-[210px] flex-col rounded-xl border border-[#e6eae4] bg-white p-5 transition hover:-translate-y-0.5 hover:border-[#cad3c8] hover:shadow-lg">
      <div className="flex items-start justify-between gap-3">
        <span
          className={`grid h-10 w-10 place-items-center rounded-xl ${theme.icon}`}
        >
          <BookOpen size={18} />
        </span>
        <span
          className={`rounded-full px-2.5 py-1 text-[9px] font-bold uppercase tracking-[1px] ${theme.tag}`}
        >
          {test.durationMinutes <= 30 ? "Quick set" : "Mock exam"}
        </span>
      </div>
      <h3 className="mt-4 font-display text-[16px] font-extrabold leading-5 text-[#202d26]">
        {test.title}
      </h3>
      {subjects.length > 0 && (
        <p className="mt-1 text-[9px] font-bold uppercase tracking-[0.8px] text-[#799064]">
          {subjects.join(" · ")}
        </p>
      )}
      <p className="mt-1.5 line-clamp-2 min-h-[36px] text-[11px] leading-[18px] text-[#89938c]">
        {test.description ||
          "A focused set to help you build confidence and keep your preparation moving."}
      </p>
      <div className="mt-auto flex items-center justify-between border-t border-[#edf0eb] pt-4">
        <div className="flex items-center gap-3 text-[10px] font-semibold text-[#758078]">
          <span className="inline-flex items-center gap-1">
            <Clock3 size={13} />
            {test.durationMinutes}m
          </span>
          <span className="inline-flex items-center gap-1">
            <FileCheck2 size={13} />
            {test.questionCount ?? "—"} Qs
          </span>
          <span>{test.totalMarks ?? "—"} pts</span>
        </div>
        <button
          onClick={() => onStart(test)}
          disabled={isStarting}
          aria-label={`Start ${test.title}`}
          className="grid h-8 w-8 place-items-center rounded-full bg-[#17221f] text-white disabled:opacity-60"
        >
          {isStarting ? (
            <LoaderCircle size={15} className="animate-spin" />
          ) : (
            <ArrowUpRight size={15} />
          )}
        </button>
      </div>
    </article>
  );
}

function DashboardFooter({
  history,
  user,
  averageScore,
  completedCount,
  onViewHistory,
  onRegister,
}) {
  return (
    <section className="mt-10 grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
      <div className="rounded-xl border border-[#e6eae4] bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#98a19a]">
              Your momentum
            </p>
            <h2 className="mt-1 font-display text-[17px] font-extrabold">
              Progress, at a glance
            </h2>
          </div>
          {user && (
            <button
              onClick={onViewHistory}
              className="text-[11px] font-bold text-[#617168]"
            >
              See results <ArrowRight size={13} />
            </button>
          )}
        </div>
        {user ? (
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3">
            <Metric
              label="Tests completed"
              value={completedCount}
              note="Keep showing up"
            />
            <Metric
              label="Average score"
              value={`${averageScore}%`}
              note={
                history.length ? "Across attempts" : "Your first one is waiting"
              }
            />
            <Metric
              label="Recent activity"
              value={
                history.length
                  ? formatDate(history[0].submittedAt ?? history[0].startedAt)
                  : "—"
              }
              note="Last test session"
              extraClass="hidden sm:block"
            />
          </div>
        ) : (
          <div className="mt-5 flex flex-col items-start gap-3 rounded-lg bg-[#f4f7f1] px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
            <p className="max-w-[410px] text-[12px] leading-5 text-[#69766e]">
              Create a student profile to save your attempts and see your scores
              here.
            </p>
            <button
              onClick={onRegister}
              className="rounded-full border border-[#c8d2c2] bg-white px-4 py-2 text-[11px] font-bold text-[#34463a]"
            >
              Set up profile
            </button>
          </div>
        )}
      </div>
      <div className="rounded-xl bg-[#e6edf1] p-5 sm:p-6">
        <div className="mb-4 grid h-9 w-9 place-items-center rounded-lg bg-white/80 text-[#527283]">
          <Target size={17} />
        </div>
        <p className="text-[10px] font-bold uppercase tracking-[1.5px] text-[#6f8894]">
          Your next step
        </p>
        <h3 className="mt-1 max-w-[250px] font-display text-[18px] font-extrabold text-[#253941]">
          Build a routine that works for you.
        </h3>
        <p className="mt-3 text-[11px] leading-5 text-[#6e828b]">
          Choose a test, take it at your pace, and learn from every attempt.
        </p>
      </div>
    </section>
  );
}

function Metric({ label, value, note, extraClass = "" }) {
  return (
    <div className={`rounded-lg bg-[#f6f8f4] px-4 py-3 ${extraClass}`}>
      <p className="text-[10px] font-semibold text-[#879189]">{label}</p>
      <p className="mt-1 font-display text-[22px] font-extrabold text-[#25332a]">
        {value}
      </p>
      <p className="mt-0.5 text-[9px] text-[#a1aaa2]">{note}</p>
    </div>
  );
}

function HistoryView({ history, hasUser, onRegister }) {
  if (!hasUser)
    return (
      <div className="mx-auto max-w-[560px] py-20 text-center">
        <span className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-[#e8eee5] text-[#69806c]">
          <Target size={23} />
        </span>
        <h1 className="mt-5 font-display text-2xl font-extrabold">
          Your results live here
        </h1>
        <p className="mt-2 text-[13px] leading-6 text-[#829087]">
          Create a student profile to save attempts and track your progress.
        </p>
        <button
          onClick={onRegister}
          className="mt-5 rounded-full bg-[#17221f] px-5 py-3 text-[12px] font-bold text-white"
        >
          Create a profile
        </button>
      </div>
    );
  return (
    <section className="mx-auto max-w-[980px] pt-4">
      <div className="mb-7">
        <p className="mb-1 text-[10px] font-bold uppercase tracking-[1.8px] text-[#98a19a]">
          A record of your work
        </p>
        <h1 className="font-display text-[30px] font-extrabold">My results</h1>
      </div>
      <div className="overflow-hidden rounded-xl border border-[#e5eae3] bg-white">
        {history.length ? (
          history.map((entry) => (
            <div
              key={entry.attemptId}
              className="flex items-center justify-between gap-4 border-b border-[#f0f2ef] px-5 py-4 last:border-0"
            >
              <div className="min-w-0">
                <p className="truncate text-[12px] font-bold text-[#26332b]">
                  {entry.testTitle}
                </p>
                <p className="mt-1 text-[10px] text-[#9aa39c]">
                  {formatDate(entry.submittedAt ?? entry.startedAt)}
                </p>
              </div>
              <span className="text-[12px] font-bold text-[#344a3b]">
                {entry.score ?? "—"}/{entry.totalMarks ?? "—"}
              </span>
              <span className="text-[12px] font-semibold text-[#68766d]">
                {entry.percentage != null
                  ? `${Math.round(entry.percentage)}%`
                  : "In progress"}
              </span>
            </div>
          ))
        ) : (
          <div className="px-5 py-14 text-center">
            <p className="font-display text-[15px] font-extrabold">
              No attempts yet
            </p>
            <p className="mt-1 text-[12px] text-[#8a958d]">
              Your completed mock tests will appear here.
            </p>
          </div>
        )}
      </div>
    </section>
  );
}

function TestRunner({
  attempt,
  session,
  questions,
  activeQuestion,
  questionIndex,
  answers,
  secondsLeft,
  isSubmitting,
  onNavigate,
  onSelect,
  onSubmit,
}) {
  const [confirm, setConfirm] = useState(false);
  const answered = Object.keys(answers).length;
  if (!activeQuestion)
    return (
      <div className="grid min-h-[420px] place-items-center text-center">
        <div>
          <p className="font-display text-xl font-extrabold">
            This test has no questions yet.
          </p>
          <button
            onClick={onSubmit}
            disabled={isSubmitting}
            className="mt-5 rounded-full bg-[#17221f] px-5 py-3 text-[12px] font-bold text-white"
          >
            Submit attempt
          </button>
        </div>
      </div>
    );
  return (
    <section className="mx-auto max-w-[1080px]">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <p className="mb-2 text-[10px] font-bold uppercase tracking-[1.5px] text-[#8b968e]">
            Question {questionIndex + 1} of {questions.length}
          </p>
          <h1 className="font-display text-[25px] font-extrabold">
            {session.title}
          </h1>
        </div>
        <div className="flex items-center gap-2 rounded-xl border border-[#e3e9e1] bg-white px-4 py-2.5">
          <Clock3 size={16} />
          <span className="font-display text-[18px] font-extrabold tabular-nums">
            {formatTime(secondsLeft)}
          </span>
        </div>
      </div>
      <div className="mb-5 h-1.5 rounded-full bg-[#e5eae2]">
        <div
          className="h-full rounded-full bg-[#8eaa59]"
          style={{
            width: `${((questionIndex + 1) / questions.length) * 100}%`,
          }}
        />
      </div>
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_230px]">
        <article className="rounded-xl border border-[#e5eae3] bg-white p-5 sm:p-8">
          <div className="mb-5 flex justify-between text-[10px] font-semibold text-[#87938b]">
            <span>Question {String(questionIndex + 1).padStart(2, "0")}</span>
            <span>{activeQuestion.marks} marks</span>
          </div>
          <h2 className="whitespace-pre-wrap font-display text-[19px] font-bold leading-[1.55] text-[#25332b]">
            {activeQuestion.questionText}
          </h2>
          <div className="mt-7 space-y-2.5">
            {(activeQuestion.options ?? []).map((option, index) => {
              const selected = answers[activeQuestion.id] === option.id;
              return (
                <button
                  key={option.id}
                  onClick={() => onSelect(activeQuestion, option)}
                  className={`flex w-full items-start gap-3 rounded-lg border px-4 py-3.5 text-left ${selected ? "border-[#8ca75a] bg-[#f3f8e9]" : "border-[#e8ece6] hover:border-[#c5d1bf]"}`}
                >
                  <span
                    className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[10px] font-bold ${selected ? "border-[#6e8c45] bg-[#6e8c45] text-white" : "border-[#d9e0d7] text-[#7f8c82]"}`}
                  >
                    {selected ? (
                      <Check size={13} />
                    ) : (
                      String.fromCharCode(65 + index)
                    )}
                  </span>
                  <span className="pt-0.5 text-[12px] leading-5 text-[#69776e]">
                    {option.optionText}
                  </span>
                </button>
              );
            })}
          </div>
          <div className="mt-8 flex justify-between border-t border-[#edf0eb] pt-5">
            <button
              disabled={!questionIndex}
              onClick={() => onNavigate(questionIndex - 1)}
              className="inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[11px] font-bold disabled:opacity-40"
            >
              <ArrowLeft size={14} /> Previous
            </button>
            {questionIndex < questions.length - 1 ? (
              <button
                onClick={() => onNavigate(questionIndex + 1)}
                className="inline-flex items-center gap-2 rounded-full bg-[#17221f] px-5 py-2.5 text-[11px] font-bold text-white"
              >
                Next question <ArrowRight size={14} />
              </button>
            ) : (
              <button
                onClick={() => setConfirm(true)}
                className="rounded-full bg-[#17221f] px-5 py-2.5 text-[11px] font-bold text-white"
              >
                Submit test
              </button>
            )}
          </div>
        </article>
        <aside className="h-fit rounded-xl border border-[#e5eae3] bg-white p-5">
          <h3 className="font-display text-[13px] font-extrabold">
            Question map
          </h3>
          <div className="mt-4 grid grid-cols-5 gap-2">
            {questions.map((question, index) => (
              <button
                key={question.id}
                onClick={() => onNavigate(index)}
                aria-label={`Go to question ${index + 1}`}
                className={`aspect-square rounded-md text-[10px] font-bold ${index === questionIndex ? "bg-[#17221f] text-white" : answers[question.id] ? "bg-[#dceacb] text-[#47643e]" : "bg-[#f0f3ef] text-[#839087]"}`}
              >
                {index + 1}
              </button>
            ))}
          </div>
          <p className="mt-5 border-t pt-4 text-[10px] text-[#89958c]">
            {answered} answered ·{" "}
            {attempt.durationMinutes ?? session.durationMinutes} minutes
          </p>
          <button
            onClick={() => setConfirm(true)}
            className="mt-3 w-full rounded-lg border py-2 text-[10px] font-bold"
          >
            Finish test
          </button>
        </aside>
      </div>
      {confirm && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-[#17221f]/45 p-4">
          <div
            role="dialog"
            aria-modal="true"
            className="w-full max-w-[390px] rounded-2xl bg-white p-6 shadow-2xl"
          >
            <h2 className="font-display text-[19px] font-extrabold">
              Finish this attempt?
            </h2>
            <p className="mt-2 text-[12px] leading-5 text-[#7b8880]">
              You have answered {answered} of {questions.length} questions.
            </p>
            <div className="mt-5 flex justify-end gap-2">
              <button
                onClick={() => setConfirm(false)}
                className="rounded-full border px-4 py-2.5 text-[11px] font-bold"
              >
                Keep going
              </button>
              <button
                onClick={() => {
                  setConfirm(false);
                  onSubmit();
                }}
                disabled={isSubmitting}
                className="rounded-full bg-[#17221f] px-4 py-2.5 text-[11px] font-bold text-white"
              >
                {isSubmitting ? "Submitting…" : "Submit test"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ResultView({ result, onReturn, onExplore }) {
  return (
    <section className="mx-auto max-w-[800px] pt-5">
      <div className="overflow-hidden rounded-2xl border border-[#e5eae3] bg-white">
        <div className="bg-[#17221f] px-6 py-9 text-white sm:px-10">
          <span
            className={`rounded-full px-3 py-1.5 text-[9px] font-bold uppercase ${result.passed ? "bg-[#d8f270] text-[#35452b]" : "bg-[#ff8b70]/20 text-[#ffab98]"}`}
          >
            {result.passed ? "Passing score" : "Attempt complete"}
          </span>
          <p className="mt-4 text-[11px] text-white/50">{result.testTitle}</p>
          <h1 className="mt-1 font-display text-[34px] font-extrabold">
            {result.percentage != null
              ? `${Math.round(result.percentage)}%`
              : "Well done"}
          </h1>
          <p className="text-[13px] text-white/60">
            You scored {result.score} out of {result.totalMarks} marks.
          </p>
        </div>
        <div className="grid grid-cols-2 divide-x divide-[#edf0eb] sm:grid-cols-4">
          {[
            ["Correct", result.correctAnswers ?? 0],
            ["Incorrect", result.incorrectAnswers ?? 0],
            ["Unanswered", result.unanswered ?? 0],
            ["Score", `${result.score ?? 0}/${result.totalMarks ?? 0}`],
          ].map(([label, value]) => (
            <div key={label} className="px-4 py-5 text-center">
              <p className="font-display text-[21px] font-extrabold">{value}</p>
              <p className="mt-1 text-[9px] font-bold uppercase tracking-[1px] text-[#95a097]">
                {label}
              </p>
            </div>
          ))}
        </div>
        <div className="flex justify-between gap-3 border-t border-[#edf0eb] px-6 py-5">
          <button
            onClick={onReturn}
            className="inline-flex items-center gap-2 rounded-full border px-4 py-2.5 text-[11px] font-bold"
          >
            <ArrowLeft size={14} /> Overview
          </button>
          <button
            onClick={onExplore}
            className="inline-flex items-center gap-2 rounded-full bg-[#17221f] px-5 py-2.5 text-[11px] font-bold text-white"
          >
            Try another test <ArrowRight size={14} />
          </button>
        </div>
      </div>
    </section>
  );
}

function RegisterModal({ onClose, onSubmit }) {
  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center bg-[#17221f]/50 p-4"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="register-title"
        className="relative w-full max-w-[430px] rounded-2xl bg-white p-6 shadow-2xl sm:p-8"
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute right-5 top-5 grid h-8 w-8 place-items-center rounded-full text-[#89958c] hover:bg-[#f0f3ee]"
        >
          <X size={17} />
        </button>
        <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-[#eaf3dc] text-[#607c4c]">
          <GraduationCap size={21} />
        </div>
        <p className="mb-1 text-[9px] font-bold uppercase tracking-[1.6px] text-[#96a096]">
          Create profile
        </p>
        <h2
          id="register-title"
          className="font-display text-[23px] font-extrabold"
        >
          Make it yours.
        </h2>
        <p className="mt-2 text-[12px] leading-5 text-[#7f8c83]">
          Create a profile to take tests and save your progress.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-3.5">
          <Field label="Your name">
            <input
              required
              name="name"
              maxLength="100"
              autoComplete="name"
              placeholder="e.g. Sam Taylor"
              className="form-input"
            />
          </Field>
          <Field label="Email address">
            <input
              required
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@example.com"
              className="form-input"
            />
          </Field>
          <Field label="Password">
            <input
              required
              name="password"
              type="password"
              minLength="6"
              maxLength="100"
              autoComplete="new-password"
              placeholder="At least 6 characters"
              className="form-input"
            />
          </Field>
          <button
            type="submit"
            className="inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#17221f] text-[12px] font-bold text-white"
          >
            Create profile <ArrowRight size={15} />
          </button>
        </form>
        <p className="mt-4 text-center text-[9px] leading-4 text-[#9ba49d]">
          Admin access is provisioned by your system administrator.
        </p>
      </div>
    </div>
  );
}

function LoginPage({
  onSubmit,
  onCreateProfile,
  error,
  onDismissError,
  isSubmitting,
}) {
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="grid min-h-screen bg-[#f5f7f3] lg:grid-cols-[1fr_0.92fr]">
      <section className="relative hidden min-h-screen overflow-hidden bg-[#17221f] text-white lg:flex lg:flex-col lg:justify-between lg:px-12 lg:py-10 xl:px-20">
        <img
          src="https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1500&q=85"
          alt="Student studying at a desk"
          className="absolute inset-0 h-full w-full object-cover opacity-35"
        />
        <div className="absolute inset-0 bg-gradient-to-br from-[#17221f]/90 via-[#17221f]/70 to-[#294235]/65" />
        <a
          href="#home"
          className="relative z-10 flex items-center gap-3 text-white no-underline"
        >
          <span className="grid h-9 w-9 place-items-center rounded-xl bg-[#d8f270] text-[#17221f]">
            <Command size={20} strokeWidth={2.5} />
          </span>
          <span className="font-display text-[20px] font-extrabold">
            formative<span className="text-[#d8f270]">.</span>
          </span>
        </a>
        <div className="relative z-10 max-w-[520px] pb-8">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 text-[10px] font-bold uppercase tracking-[1.4px] text-[#e0f3bc]">
            <Sparkles size={13} /> A clearer way to prepare
          </span>
          <h1 className="font-display text-[42px] font-extrabold leading-[1.08] tracking-[-1.4px] xl:text-[52px]">
            Show up for the work. Let confidence follow.
          </h1>
          <p className="mt-5 max-w-[410px] text-[14px] leading-6 text-white/65">
            Your practice sets, progress, and next steps, all in one focused
            place.
          </p>
          <div className="mt-9 flex items-center gap-3 text-[11px] font-semibold text-white/75">
            <span className="grid h-8 w-8 place-items-center rounded-full bg-[#d8f270] text-[#17221f]">
              <Check size={15} />
            </span>
            Built around your pace, not someone else's.
          </div>
        </div>
        <p className="relative z-10 text-[10px] text-white/45">
          Formative learning space · 2026
        </p>
      </section>

      <section className="flex min-h-screen flex-col px-5 py-6 sm:px-10 lg:px-12 xl:px-20">
        <div className="flex items-center justify-between lg:justify-end">
          <a
            href="#home"
            className="flex items-center gap-2.5 text-[#17221f] no-underline lg:hidden"
          >
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-[#d8f270]">
              <Command size={18} />
            </span>
            <span className="font-display text-[17px] font-extrabold">
              formative.
            </span>
          </a>
          <p className="text-[11px] text-[#7d8981]">
            New here?{" "}
            <button
              onClick={onCreateProfile}
              className="font-bold text-[#344a3b] underline underline-offset-4"
            >
              Create profile
            </button>
          </p>
        </div>

        <div className="mx-auto flex w-full max-w-[400px] flex-1 flex-col justify-center py-12">
          <div className="mb-8">
            <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-[#eaf3dc] text-[#607c4c]">
              <GraduationCap size={21} />
            </div>
            <p className="mb-1 text-[10px] font-bold uppercase tracking-[1.6px] text-[#96a096]">
              Welcome back
            </p>
            <h2 className="font-display text-[29px] font-extrabold tracking-[-1px] text-[#1d2a23]">
              Sign in to Formative
            </h2>
            <p className="mt-2 text-[12px] leading-5 text-[#7f8c83]">
              Pick up right where your learning left off.
            </p>
          </div>

          {error && (
            <div
              className="mb-5 flex items-start gap-2.5 rounded-lg border border-[#f1c4b8] bg-[#fff3ee] px-3.5 py-3 text-[11px] leading-5 text-[#994a36]"
              role="alert"
            >
              <span className="flex-1">{error}</span>
              <button onClick={onDismissError} aria-label="Dismiss message">
                <X size={15} />
              </button>
            </div>
          )}

          <form onSubmit={onSubmit} className="space-y-4">
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-bold text-[#56645b]">
                Email address
              </span>
              <span className="relative block">
                <Mail
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9ba49d]"
                />
                <input
                  required
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  className="h-11 w-full rounded-lg border border-[#e1e7df] bg-white pl-10 pr-3 text-[12px] outline-none transition focus:border-[#80964c] focus:ring-2 focus:ring-[#d8f270]/50"
                />
              </span>
            </label>
            <label className="block">
              <span className="mb-1.5 block text-[10px] font-bold text-[#56645b]">
                Password
              </span>
              <span className="relative block">
                <LockKeyhole
                  size={15}
                  className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#9ba49d]"
                />
                <input
                  required
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  className="h-11 w-full rounded-lg border border-[#e1e7df] bg-white pl-10 pr-11 text-[12px] outline-none transition focus:border-[#80964c] focus:ring-2 focus:ring-[#d8f270]/50"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  className="absolute right-3 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-md text-[#89958c] hover:bg-[#f0f3ee]"
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </span>
            </label>
            <div className="flex items-center justify-between pt-0.5">
              <label className="inline-flex items-center gap-2 text-[10px] text-[#6f7c73]">
                <input
                  name="remember"
                  type="checkbox"
                  className="h-3.5 w-3.5 accent-[#536c40]"
                />
                Remember me
              </label>
              <span className="text-[10px] font-semibold text-[#97a098]">
                Forgot password?
              </span>
            </div>
            <button
              type="submit"
              disabled={isSubmitting}
              className="mt-2 inline-flex h-11 w-full items-center justify-center gap-2 rounded-lg bg-[#17221f] text-[12px] font-bold text-white transition hover:bg-[#304238] disabled:opacity-60"
            >
              {isSubmitting ? (
                <>
                  <LoaderCircle size={15} className="animate-spin" /> Signing
                  in…
                </>
              ) : (
                <>
                  Sign in <ArrowRight size={15} />
                </>
              )}
            </button>
          </form>
          <div className="my-6 flex items-center gap-3">
            <span className="h-px flex-1 bg-[#e6eae4]" />
            <span className="text-[9px] font-semibold uppercase tracking-[1px] text-[#a0a8a1]">
              or
            </span>
            <span className="h-px flex-1 bg-[#e6eae4]" />
          </div>
          <button
            onClick={onCreateProfile}
            className="h-11 w-full rounded-lg border border-[#dfe5dd] bg-white text-[11px] font-bold text-[#4d5d52] transition hover:border-[#b9c8b4] hover:bg-[#fafbf9]"
          >
            Create a new profile
          </button>
          <p className="mt-6 text-center text-[9px] leading-4 text-[#9ba49d]">
            Your sign-in uses a secure, time-limited session.
          </p>
        </div>
        <p className="text-center text-[9px] text-[#a2aaa3]">
          © 2026 Formative. Learn at your own pace.
        </p>
      </section>
    </main>
  );
}

function Field({ label, children }) {
  return (
    <label className="block">
      <span className="mb-1.5 block text-[10px] font-bold text-[#56645b]">
        {label}
      </span>
      {children}
    </label>
  );
}

export default App;
