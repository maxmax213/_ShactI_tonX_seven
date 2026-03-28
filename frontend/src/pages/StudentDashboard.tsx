import { FormEvent, useEffect, useMemo, useState } from "react";

import { api } from "../app/api";
import { useAuth } from "../app/auth";
import {
  createStarterProgram,
  parseBlockAssignmentConfig,
  parseBlockSubmissionPayload,
  serializeBlockSubmission,
  type BlockNode,
} from "../app/blockProgramming";
import type {
  Assignment,
  AssignmentBrief,
  CommentView,
  Course,
  CourseModule,
  CourseTree,
  LeaderboardEntry,
  Lesson,
  Submission,
  TestOption,
  TestQuestionType,
  UserAchievement,
  UserStats,
} from "../app/types";
import { BlockEditor } from "../components/BlockEditor";
import { EmptyState } from "../components/EmptyState";
import { SectionCard } from "../components/SectionCard";

type MainTab = "learning" | "leaderboard";
type LearningView = "catalog" | "course" | "lesson";
type LessonTab = "theory_test" | "assignment";
type TestAnswerValue = string | string[] | boolean | null;

interface ParsedTestQuestion {
  id: string;
  type: TestQuestionType;
  prompt: string;
  options: TestOption[];
}

type CourseAssignmentInfo = {
  assignmentId: number;
  lessonTitle: string;
};

function submissionStatusLabel(status: "pending" | "checked" | "needs_rework"): string {
  if (status === "pending") return "ожидает проверки";
  if (status === "checked") return "проверено";
  return "нужна доработка";
}

function achievementRarityLabel(rarity: "common" | "rare" | "epic"): string {
  if (rarity === "common") return "Обычная";
  if (rarity === "rare") return "Редкая";
  return "Эпическая";
}

function achievementDescription(item: UserAchievement): string {
  if (item.slug.includes("streak")) return "Стабильные занятия каждый день. Так держать.";
  if (item.slug.includes("first")) return "Первый важный шаг в обучении уже сделан.";
  if (item.slug.includes("score")) return "Отличный результат и уверенный рост навыков.";
  return "Новая награда за активность и прогресс в учебе.";
}

function firstModule(tree: CourseTree | null): CourseModule | null {
  if (!tree || tree.modules.length === 0) return null;
  return tree.modules[0];
}

function normalizeQuestionType(value: unknown): TestQuestionType {
  if (value === "single_choice") return "single_choice";
  if (value === "multiple_choice") return "multiple_choice";
  if (value === "true_false") return "true_false";
  return "short_text";
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function parseTestQuestions(payload: string | null): ParsedTestQuestion[] {
  if (!payload) return [];

  try {
    const parsed = JSON.parse(payload) as unknown;
    if (!isRecord(parsed)) return [];

    const questionsRaw = parsed["questions"];
    if (!Array.isArray(questionsRaw)) return [];

    return questionsRaw
      .map((question, index) => {
        if (!isRecord(question)) return null;

        const id = String(question["id"] ?? `q${index + 1}`);
        const promptSource =
          typeof question["prompt"] === "string"
            ? question["prompt"]
            : typeof question["title"] === "string"
              ? question["title"]
              : null;
        const prompt = (promptSource ?? `Вопрос ${index + 1}`).trim();
        const type = normalizeQuestionType(question["type"]);

        const optionsRaw = Array.isArray(question["options"]) ? question["options"] : [];
        const options = optionsRaw
          .map((option, optionIndex) => {
            if (typeof option === "string") {
              return { id: String(optionIndex + 1), text: option };
            }

            if (isRecord(option)) {
              const optionId = option["id"] !== undefined ? String(option["id"]) : String(optionIndex + 1);
              const optionText = option["text"] !== undefined ? String(option["text"]) : "";
              if (!optionText.trim()) return null;
              return { id: optionId, text: optionText };
            }

            return null;
          })
          .filter((option): option is TestOption => option !== null);

        return { id, type, prompt, options };
      })
      .filter((question): question is ParsedTestQuestion => question !== null && question.id.length > 0);
  } catch {
    return [];
  }
}

function initialAnswers(questions: ParsedTestQuestion[]): Record<string, TestAnswerValue> {
  return questions.reduce<Record<string, TestAnswerValue>>((acc, question) => {
    if (question.type === "multiple_choice") {
      acc[question.id] = [];
      return acc;
    }

    if (question.type === "true_false") {
      acc[question.id] = null;
      return acc;
    }

    acc[question.id] = "";
    return acc;
  }, {});
}

function compactAnswers(source: Record<string, TestAnswerValue>): Record<string, string | string[] | boolean> {
  return Object.entries(source).reduce<Record<string, string | string[] | boolean>>((acc, [qid, value]) => {
    if (Array.isArray(value)) {
      if (value.length > 0) acc[qid] = value;
      return acc;
    }

    if (typeof value === "boolean") {
      acc[qid] = value;
      return acc;
    }

    if (typeof value === "string" && value.trim().length > 0) {
      acc[qid] = value.trim();
    }

    return acc;
  }, {});
}

function asString(value: TestAnswerValue): string {
  return typeof value === "string" ? value : "";
}

function asBool(value: TestAnswerValue): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function asStringArray(value: TestAnswerValue): string[] {
  return Array.isArray(value) ? value : [];
}

function defaultPracticeSolution(assignment: Assignment): string {
  if (assignment.assignment_type === "blocks") {
    return "# Блоки (MVP)\ninput -> if -> print";
  }
  return "print('solution')";
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function StudentDashboard() {
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<MainTab>("learning");
  const [learningView, setLearningView] = useState<LearningView>("catalog");

  const [courses, setCourses] = useState<Course[]>([]);
  const [courseTreesById, setCourseTreesById] = useState<Record<number, CourseTree>>({});
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [courseTree, setCourseTree] = useState<CourseTree | null>(null);
  const [selectedModuleId, setSelectedModuleId] = useState<number | null>(null);
  const [selectedLessonId, setSelectedLessonId] = useState<number | null>(null);
  const [expandedModules, setExpandedModules] = useState<Record<number, boolean>>({});

  const [selectedLessonTab, setSelectedLessonTab] = useState<LessonTab>("theory_test");
  const [activeTestAssignment, setActiveTestAssignment] = useState<Assignment | null>(null);
  const [testQuestions, setTestQuestions] = useState<ParsedTestQuestion[]>([]);
  const [testAnswers, setTestAnswers] = useState<Record<string, TestAnswerValue>>({});

  const [activePracticeAssignment, setActivePracticeAssignment] = useState<Assignment | null>(null);
  const [practiceSolution, setPracticeSolution] = useState<string>("print('solution')");
  const [blockProgram, setBlockProgram] = useState<BlockNode[]>(createStarterProgram({ hints: [] }));

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [comments, setComments] = useState<CommentView[]>([]);
  const [newComment, setNewComment] = useState("");

  const [enrollCode, setEnrollCode] = useState("");
  const [message, setMessage] = useState("");

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId],
  );

  const selectedModule = useMemo(() => {
    if (!courseTree || selectedModuleId === null) return null;
    return courseTree.modules.find((module) => module.id === selectedModuleId) ?? null;
  }, [courseTree, selectedModuleId]);

  const selectedLesson = useMemo(() => {
    if (!selectedModule || selectedLessonId === null) return null;
    return selectedModule.lessons.find((lesson) => lesson.id === selectedLessonId) ?? null;
  }, [selectedModule, selectedLessonId]);

  const testAssignments = useMemo(
    () => selectedLesson?.assignments.filter((assignment) => assignment.assignment_type === "test") ?? [],
    [selectedLesson],
  );

  const practiceAssignments = useMemo(
    () => selectedLesson?.assignments.filter((assignment) => assignment.assignment_type !== "test") ?? [],
    [selectedLesson],
  );

  const activeBlockConfig = useMemo(() => {
    if (!activePracticeAssignment || activePracticeAssignment.assignment_type !== "blocks") {
      return { hints: [] };
    }
    return parseBlockAssignmentConfig(activePracticeAssignment.content_payload);
  }, [activePracticeAssignment]);

  const latestSubmissionByAssignment = useMemo(() => {
    const map = new Map<number, Submission>();
    for (const submission of submissions) {
      const current = map.get(submission.assignment_id);
      if (!current || submission.attempt > current.attempt) {
        map.set(submission.assignment_id, submission);
      }
    }
    return map;
  }, [submissions]);

  const totalCourseAssignments = useMemo(() => {
    if (!courseTree) return 0;
    return courseTree.modules.reduce(
      (total, module) => total + module.lessons.reduce((sum, lesson) => sum + lesson.assignments.length, 0),
      0,
    );
  }, [courseTree]);

  const submittedCourseAssignments = useMemo(() => {
    if (!courseTree) return 0;
    let completed = 0;

    for (const module of courseTree.modules) {
      for (const lesson of module.lessons) {
        for (const assignment of lesson.assignments) {
          if (latestSubmissionByAssignment.has(assignment.id)) completed += 1;
        }
      }
    }

    return completed;
  }, [courseTree, latestSubmissionByAssignment]);

  const expProgress = useMemo(() => {
    const level = stats?.level ?? user?.level ?? 1;
    const xp = stats?.xp ?? user?.xp ?? 0;
    const levelFloor = Math.max(0, (level - 1) * 100);
    return clamp(((xp - levelFloor) / 100) * 100, 0, 100);
  }, [stats, user]);

  const xpToNextLevel = useMemo(() => {
    const level = stats?.level ?? user?.level ?? 1;
    const xp = stats?.xp ?? user?.xp ?? 0;
    return Math.max(0, level * 100 - xp);
  }, [stats, user]);

  const courseProgressData = useMemo(() => {
    return courses.map((course) => {
      const tree = courseTreesById[course.id];
      if (!tree) {
        return {
          courseId: course.id,
          title: course.title,
          progress: 0,
          lastTopic: "Загружаем темы...",
          lessonsCount: 0,
          description: course.description || "Описание курса скоро появится",
          isPublished: course.is_published,
        };
      }

      const assignmentMap: CourseAssignmentInfo[] = tree.modules.flatMap((module) =>
        module.lessons.flatMap((lesson) =>
          lesson.assignments.map((assignment) => ({
            assignmentId: assignment.id,
            lessonTitle: lesson.title,
          })),
        ),
      );

      const assignmentIds = new Set(assignmentMap.map((item) => item.assignmentId));
      const courseSubmissions = submissions.filter((submission) => assignmentIds.has(submission.assignment_id));
      const completedAssignmentIds = new Set(courseSubmissions.map((submission) => submission.assignment_id));
      const totalAssignments = assignmentMap.length;
      const progress = totalAssignments === 0 ? 0 : Math.round((completedAssignmentIds.size / totalAssignments) * 100);

      const latestSubmission = [...courseSubmissions].sort((a, b) => {
        return new Date(b.updated_at).getTime() - new Date(a.updated_at).getTime();
      })[0];

      const latestInfo = assignmentMap.find((item) => item.assignmentId === latestSubmission?.assignment_id);
      const fallbackTopic = tree.modules[0]?.lessons[0]?.title ?? "Курс пока пустой";

      return {
        courseId: course.id,
        title: course.title,
        progress,
        lastTopic: latestInfo?.lessonTitle ?? fallbackTopic,
        lessonsCount: tree.modules.reduce((count, module) => count + module.lessons.length, 0),
        description: course.description || "Описание курса скоро появится",
        isPublished: course.is_published,
      };
    });
  }, [courses, courseTreesById, submissions]);

  function applyCourseTree(tree: CourseTree): void {
    setCourseTree(tree);
    setExpandedModules((current) => {
      const next = { ...current };
      for (const module of tree.modules) {
        if (next[module.id] === undefined) {
          next[module.id] = true;
        }
      }
      return next;
    });

    setSelectedModuleId((currentModuleId) => {
      if (currentModuleId && tree.modules.some((module) => module.id === currentModuleId)) {
        return currentModuleId;
      }
      return firstModule(tree)?.id ?? null;
    });

    setSelectedLessonId((currentLessonId) => {
      if (!currentLessonId) return null;
      const exists = tree.modules.some((module) => module.lessons.some((lesson) => lesson.id === currentLessonId));
      return exists ? currentLessonId : null;
    });
  }

  async function loadStudentData(): Promise<void> {
    const [myCourses, mySubmissions, myAchievements, myStats] = await Promise.all([
      api.myCourses(),
      api.mySubmissions(),
      api.myAchievements(),
      api.meStats(),
    ]);

    setCourses(myCourses);
    setSubmissions(mySubmissions);
    setAchievements(myAchievements);
    setStats(myStats);

    if (myCourses.length === 0) {
      setSelectedCourseId(null);
      setCourseTree(null);
      setSelectedModuleId(null);
      setSelectedLessonId(null);
      setCourseTreesById({});
      return;
    }

    setSelectedCourseId((current) => {
      if (current && myCourses.some((course) => course.id === current)) return current;
      return myCourses[0].id;
    });

    const treeResults = await Promise.allSettled(myCourses.map((course) => api.courseTree(course.id)));
    const nextTrees: Record<number, CourseTree> = {};
    treeResults.forEach((result, index) => {
      if (result.status === "fulfilled") {
        nextTrees[myCourses[index].id] = result.value;
      }
    });
    setCourseTreesById(nextTrees);
  }

  async function refreshProgressData(): Promise<void> {
    const [mySubmissions, myAchievements, myStats] = await Promise.all([
      api.mySubmissions(),
      api.myAchievements(),
      api.meStats(),
    ]);

    setSubmissions(mySubmissions);
    setAchievements(myAchievements);
    setStats(myStats);
  }

  useEffect(() => {
    loadStudentData().catch((err) => {
      setMessage(`Не удалось загрузить данные ученика: ${String(err)}`);
    });
  }, []);

  useEffect(() => {
    if (activeTab !== "leaderboard") return;

    api
      .leaderboard()
      .then(setLeaderboard)
      .catch((err) => setMessage(`Ошибка загрузки лидерборда: ${String(err)}`));
  }, [activeTab]);

  useEffect(() => {
    if (!selectedCourseId) {
      setCourseTree(null);
      setSelectedModuleId(null);
      setSelectedLessonId(null);
      return;
    }

    const cachedTree = courseTreesById[selectedCourseId];
    if (cachedTree) {
      applyCourseTree(cachedTree);
      return;
    }

    api
      .courseTree(selectedCourseId)
      .then((tree) => {
        setCourseTreesById((current) => ({ ...current, [selectedCourseId]: tree }));
        setCourseTree(tree);
        setExpandedModules((current) => {
          const next = { ...current };
          for (const module of tree.modules) {
            if (next[module.id] === undefined) {
              next[module.id] = true;
            }
          }
          return next;
        });

        setSelectedModuleId((currentModuleId) => {
          if (currentModuleId && tree.modules.some((module) => module.id === currentModuleId)) {
            return currentModuleId;
          }
          return firstModule(tree)?.id ?? null;
        });

        setSelectedLessonId((currentLessonId) => {
          if (!currentLessonId) return null;
          const exists = tree.modules.some((module) => module.lessons.some((lesson) => lesson.id === currentLessonId));
          return exists ? currentLessonId : null;
        });
      })
      .catch((err) => setMessage(`Ошибка загрузки структуры курса: ${String(err)}`));
  }, [selectedCourseId, courseTreesById]);

  useEffect(() => {
    if (!selectedLesson) {
      setSelectedLessonTab("theory_test");
      setActiveTestAssignment(null);
      setTestQuestions([]);
      setTestAnswers({});
      setActivePracticeAssignment(null);
      setPracticeSolution("print('solution')");
      setBlockProgram(createStarterProgram({ hints: [] }));
      return;
    }

    const firstTestAssignment = selectedLesson.assignments.find((assignment) => assignment.assignment_type === "test");
    if (firstTestAssignment) {
      openTestAssignment(firstTestAssignment.id);
    } else {
      setActiveTestAssignment(null);
      setTestQuestions([]);
      setTestAnswers({});
    }

    const firstPracticeAssignment = selectedLesson.assignments.find((assignment) => assignment.assignment_type !== "test");
    if (firstPracticeAssignment) {
      openPracticeAssignment(firstPracticeAssignment.id);
    } else {
      setActivePracticeAssignment(null);
      setPracticeSolution("print('solution')");
      setBlockProgram(createStarterProgram({ hints: [] }));
    }
  }, [selectedLesson?.id]);

  const activeCommentAssignmentId =
    selectedLessonTab === "theory_test" ? activeTestAssignment?.id ?? null : activePracticeAssignment?.id ?? null;

  async function refreshComments(assignmentId: number): Promise<void> {
    try {
      setComments(await api.assignmentComments(assignmentId));
    } catch (err) {
      setMessage(`?????? ???????? ????????????: ${String(err)}`);
    }
  }

  useEffect(() => {
    if (!activeCommentAssignmentId) {
      setComments([]);
      return;
    }

    refreshComments(activeCommentAssignmentId).catch(() => null);
  }, [activeCommentAssignmentId]);

  function lessonProgress(lesson: Lesson): { done: number; total: number } {
    const total = lesson.assignments.length;
    const done = lesson.assignments.filter((assignment) => latestSubmissionByAssignment.has(assignment.id)).length;
    return { done, total };
  }

  function moduleProgress(module: CourseModule): { done: number; total: number } {
    const totals = module.lessons.map((lesson) => lessonProgress(lesson));
    const done = totals.reduce((sum, item) => sum + item.done, 0);
    const total = totals.reduce((sum, item) => sum + item.total, 0);
    return { done, total };
  }

  function assignmentSubmissionInfo(assignment: AssignmentBrief): Submission | null {
    return latestSubmissionByAssignment.get(assignment.id) ?? null;
  }

  function assignmentStatusHint(assignment: AssignmentBrief): string {
    const submission = assignmentSubmissionInfo(assignment);
    if (!submission) return "Не отправлено";
    return `Отправлено (${submissionStatusLabel(submission.status)})`;
  }

  function toggleModule(moduleId: number): void {
    setExpandedModules((current) => ({ ...current, [moduleId]: !current[moduleId] }));
  }

  function openCourse(courseId: number): void {
    setSelectedCourseId(courseId);
    setSelectedLessonId(null);
    setLearningView("course");
  }

  function openLesson(moduleId: number, lessonId: number): void {
    setSelectedModuleId(moduleId);
    setSelectedLessonId(lessonId);
    setSelectedLessonTab("theory_test");
    setLearningView("lesson");
  }

  async function openTestAssignment(assignmentId: number): Promise<void> {
    try {
      const assignment = await api.assignment(assignmentId);
      if (assignment.assignment_type !== "test") return;

      setActiveTestAssignment(assignment);
      const parsed = parseTestQuestions(assignment.content_payload);
      setTestQuestions(parsed);
      setTestAnswers(initialAnswers(parsed));
    } catch (err) {
      setMessage(`Не удалось открыть тест: ${String(err)}`);
    }
  }

  async function openPracticeAssignment(assignmentId: number): Promise<void> {
    try {
      const assignment = await api.assignment(assignmentId);
      if (assignment.assignment_type === "test") return;

      setActivePracticeAssignment(assignment);

      const previousSubmission = latestSubmissionByAssignment.get(assignment.id);
      if (assignment.assignment_type === "blocks") {
        const config = parseBlockAssignmentConfig(assignment.content_payload);
        const parsedSubmission = previousSubmission
          ? parseBlockSubmissionPayload(previousSubmission.solution_payload)
          : null;
        setBlockProgram(parsedSubmission?.blocks ?? createStarterProgram(config));
        setPracticeSolution(defaultPracticeSolution(assignment));
        return;
      }

      setPracticeSolution(previousSubmission?.solution_payload ?? defaultPracticeSolution(assignment));
      setBlockProgram(createStarterProgram({ hints: [] }));
    } catch (err) {
      setMessage(`Не удалось открыть задание: ${String(err)}`);
    }
  }

  async function onEnroll(event: FormEvent): Promise<void> {
    event.preventDefault();

    try {
      await api.enroll(enrollCode.trim());
      setEnrollCode("");
      setMessage("Вы успешно записались на курс");
      await loadStudentData();
    } catch (err) {
      setMessage(`Не удалось записаться на курс: ${String(err)}`);
    }
  }

  async function onSubmitTest(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!activeTestAssignment) return;

    try {
      const payload = JSON.stringify(compactAnswers(testAnswers));
      await api.submitAssignment(activeTestAssignment.id, payload);
      setMessage("Тест отправлен на проверку");
      await refreshProgressData();
    } catch (err) {
      setMessage(`Не удалось отправить тест: ${String(err)}`);
    }
  }

  async function onSubmitPractice(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!activePracticeAssignment) return;

    try {
      const payload =
        activePracticeAssignment.assignment_type === "blocks"
          ? serializeBlockSubmission(blockProgram)
          : practiceSolution;

      await api.submitAssignment(activePracticeAssignment.id, payload);
      setMessage("Задание отправлено учителю");
      await refreshProgressData();
      await refreshComments(activePracticeAssignment.id);
    } catch (err) {
      setMessage(`Не удалось отправить задание: ${String(err)}`);
    }
  }

  async function onSendComment(event: FormEvent): Promise<void> {
    event.preventDefault();
    if (!activeCommentAssignmentId || !newComment.trim()) return;

    try {
      await api.createComment({
        assignment_id: activeCommentAssignmentId,
        content: newComment.trim(),
        parent_comment_id: null,
      });

      setNewComment("");
      await refreshComments(activeCommentAssignmentId);
    } catch (err) {
      setMessage(`?????? ???????? ???????????: ${String(err)}`);
    }
  }
  }

  function onSingleChoiceAnswer(questionId: string, optionId: string): void {
    setTestAnswers((current) => ({ ...current, [questionId]: optionId }));
  }

  function onMultipleChoiceAnswer(questionId: string, optionId: string, checked: boolean): void {
    setTestAnswers((current) => {
      const currentValues = asStringArray(current[questionId]);
      if (checked) {
        if (currentValues.includes(optionId)) return current;
        return { ...current, [questionId]: [...currentValues, optionId] };
      }
      return { ...current, [questionId]: currentValues.filter((item) => item !== optionId) };
    });
  }

  function onTrueFalseAnswer(questionId: string, value: boolean): void {
    setTestAnswers((current) => ({ ...current, [questionId]: value }));
  }

  function onShortTextAnswer(questionId: string, value: string): void {
    setTestAnswers((current) => ({ ...current, [questionId]: value }));
  }

  function renderQuestion(question: ParsedTestQuestion, index: number) {
    if (question.type === "single_choice") {
      const currentValue = asString(testAnswers[question.id]);
      return (
        <div className="test-question" key={question.id}>
          <h4>
            {index + 1}. {question.prompt}
          </h4>
          <div className="option-list">
            {question.options.map((option) => (
              <label key={option.id} className="inline">
                <input
                  type="radio"
                  name={`single-${question.id}`}
                  checked={currentValue === option.id}
                  onChange={() => onSingleChoiceAnswer(question.id, option.id)}
                />
                {option.text}
              </label>
            ))}
          </div>
        </div>
      );
    }

    if (question.type === "multiple_choice") {
      const currentValues = asStringArray(testAnswers[question.id]);
      return (
        <div className="test-question" key={question.id}>
          <h4>
            {index + 1}. {question.prompt}
          </h4>
          <div className="option-list">
            {question.options.map((option) => (
              <label key={option.id} className="inline">
                <input
                  type="checkbox"
                  checked={currentValues.includes(option.id)}
                  onChange={(event) => onMultipleChoiceAnswer(question.id, option.id, event.target.checked)}
                />
                {option.text}
              </label>
            ))}
          </div>
        </div>
      );
    }

    if (question.type === "true_false") {
      const currentValue = asBool(testAnswers[question.id]);
      return (
        <div className="test-question" key={question.id}>
          <h4>
            {index + 1}. {question.prompt}
          </h4>
          <div className="option-list">
            <label className="inline">
              <input
                type="radio"
                name={`boolean-${question.id}`}
                checked={currentValue === true}
                onChange={() => onTrueFalseAnswer(question.id, true)}
              />
              Верно
            </label>
            <label className="inline">
              <input
                type="radio"
                name={`boolean-${question.id}`}
                checked={currentValue === false}
                onChange={() => onTrueFalseAnswer(question.id, false)}
              />
              Неверно
            </label>
          </div>
        </div>
      );
    }

    return (
      <div className="test-question" key={question.id}>
        <h4>
          {index + 1}. {question.prompt}
        </h4>
        <input
          value={asString(testAnswers[question.id])}
          onChange={(event) => onShortTextAnswer(question.id, event.target.value)}
          placeholder="Введите краткий ответ"
        />
      </div>
    );
  }

  const activeTestSubmission = activeTestAssignment
    ? latestSubmissionByAssignment.get(activeTestAssignment.id) ?? null
    : null;

  const activePracticeSubmission = activePracticeAssignment
    ? latestSubmissionByAssignment.get(activePracticeAssignment.id) ?? null
    : null;

  return (
    <>
      <SectionCard title="Главная страница">
        <div className="chip-row">
          <button
            className={activeTab === "learning" ? "chip active" : "chip"}
            onClick={() => setActiveTab("learning")}
          >
            Обучение
          </button>
          <button
            className={activeTab === "leaderboard" ? "chip active" : "chip"}
            onClick={() => setActiveTab("leaderboard")}
          >
            Лидерборд
          </button>
        </div>
        {message && <p className="hint">{message}</p>}
      </SectionCard>

      {activeTab === "learning" && learningView === "catalog" && (
        <div className="student-dashboard">
          <section className="student-hero">
            <div className="student-hero-main">
              <div className="student-hero-top">
                <div>
                  <p className="student-hero-subtitle">Мой прогресс</p>
                  <h2>{stats?.full_name ?? user?.full_name ?? "Ученик"}</h2>
                </div>
                <div className="student-level-pill">Уровень {stats?.level ?? user?.level ?? 1}</div>
              </div>
              <div className="student-exp-row">
                <p className="student-hero-exp">EXP: {stats?.xp ?? user?.xp ?? 0}</p>
                <span className="student-exp-target">До след. уровня: {xpToNextLevel}</span>
              </div>
              <div className="student-level-track">
                <div className="student-level-fill" style={{ width: `${expProgress}%` }} />
              </div>
              <p className="student-level-note">Прогресс уровня: {Math.round(expProgress)}%</p>
            </div>
            <div className="student-hero-bubbles" aria-hidden="true">
              <span />
              <span />
              <span />
            </div>
          </section>

          <section className="student-metric-grid">
            <article className="student-metric-card">
              <span>Средний балл</span>
              <strong>{stats ? Number(stats.average_score).toFixed(1) : "0.0"}</strong>
            </article>
            <article className="student-metric-card">
              <span>Уровень</span>
              <strong>{stats?.level ?? user?.level ?? 1}</strong>
            </article>
            <article className="student-metric-card">
              <span>Серия</span>
              <strong>{stats?.streak ?? user?.streak ?? 0} дней</strong>
            </article>
          </section>

          <SectionCard title="Мои курсы">
            <p className="hint">Выберите курс и перейдите к его модулям и урокам.</p>
            {courseProgressData.length === 0 && <EmptyState message="У вас пока нет активных курсов" />}
            {courseProgressData.length > 0 && (
              <div className="student-course-list">
                {courseProgressData.map((course) => (
                  <article key={course.courseId} className="student-course-card">
                    <div className="student-course-head">
                      <h3>{course.title}</h3>
                      <button type="button" className="student-course-open" onClick={() => openCourse(course.courseId)}>
                        Перейти
                      </button>
                    </div>
                    <p className="student-course-topic">{course.description}</p>
                    <p className="student-course-topic">Последняя тема: {course.lastTopic}</p>
                    <p className="student-course-topic">Уроков в курсе: {course.lessonsCount}</p>
                    <div className="student-progress-track">
                      <div className="student-progress-fill" style={{ width: `${course.progress}%` }} />
                    </div>
                    <p className="student-progress-label">Пройдено: {course.progress}%</p>
                  </article>
                ))}
              </div>
            )}

            <form className="inline-form" onSubmit={onEnroll}>
              <input
                placeholder="Введите код записи на курс"
                value={enrollCode}
                onChange={(event) => setEnrollCode(event.target.value)}
                required
              />
              <button type="submit">Записаться</button>
            </form>
          </SectionCard>

          <SectionCard title="Мои ачивки">
            {achievements.length === 0 && <EmptyState message="Пока нет ачивок. Сделайте первое задание." />}
            <div className="student-achievement-grid">
              {achievements.map((achievement) => (
                <article key={achievement.achievement_id} className="student-achievement-card">
                  <div className={`student-achievement-icon rarity-${achievement.rarity}`} aria-hidden="true">
                    {achievement.rarity === "epic" ? "EP" : achievement.rarity === "rare" ? "R" : "C"}
                  </div>
                  <div>
                    <h3>{achievement.title}</h3>
                    <p>{achievementDescription(achievement)}</p>
                    <p className="student-achievement-meta">
                      {achievementRarityLabel(achievement.rarity)} | +{achievement.xp_reward} EXP
                    </p>
                  </div>
                </article>
              ))}
            </div>
          </SectionCard>
        </div>
      )}

      {activeTab === "learning" && learningView === "course" && (
        <>
          <SectionCard title="Страница курса" actions={<button onClick={() => setLearningView("catalog")}>К курсам</button>}>
            {!selectedCourse && <EmptyState message="Выберите курс" />}
            {selectedCourse && (
              <div className="course-hero">
                <p className="breadcrumbs">Главная / Обучение / {selectedCourse.title}</p>
                <h3>{selectedCourse.title}</h3>
                <p>{selectedCourse.description || "Описание курса скоро появится"}</p>
                <div className="progress-line">
                  <span>
                    Выполнено заданий: {submittedCourseAssignments}/{totalCourseAssignments}
                  </span>
                  <span>
                    Достижения: {achievements.length} · Уровень {stats?.level ?? 1}
                  </span>
                </div>
              </div>
            )}
          </SectionCard>

          <SectionCard title="Модули курса">
            {!courseTree && <EmptyState message="Структура курса загружается" />}
            {courseTree && courseTree.modules.length === 0 && <EmptyState message="В курсе пока нет модулей" />}
            {courseTree && courseTree.modules.length > 0 && (
              <div className="module-stack">
                {courseTree.modules.map((module) => {
                  const progress = moduleProgress(module);
                  const expanded = expandedModules[module.id] ?? true;

                  return (
                    <article key={module.id} className="module-block">
                      <div className="module-header">
                        <button
                          className={selectedModuleId === module.id ? "ghost-btn module-title active" : "ghost-btn module-title"}
                          onClick={() => setSelectedModuleId(module.id)}
                        >
                          {module.order_index}. {module.title}
                        </button>
                        <div className="module-actions">
                          <span className="progress-badge">
                            {progress.done}/{progress.total} выполнено
                          </span>
                          <button className="module-toggle" onClick={() => toggleModule(module.id)}>
                            {expanded ? "Скрыть" : "Показать"}
                          </button>
                        </div>
                      </div>

                      {expanded && (
                        <div className="lesson-stack">
                          {module.lessons.length === 0 && <p className="hint">В модуле пока нет уроков</p>}
                          {module.lessons.map((lesson) => {
                            const lessonStats = lessonProgress(lesson);
                            return (
                              <button key={lesson.id} className="lesson-row" onClick={() => openLesson(module.id, lesson.id)}>
                                <span>
                                  {module.order_index}.{lesson.order_index} {lesson.title}
                                </span>
                                <span className={lessonStats.done === lessonStats.total && lessonStats.total > 0 ? "lesson-done" : "lesson-pending"}>
                                  {lessonStats.done}/{lessonStats.total} выполнено
                                </span>
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </>
      )}

      {activeTab === "learning" && learningView === "lesson" && (
        <>
          <SectionCard title="Выбранный урок" actions={<button onClick={() => setLearningView("course")}>К модулям</button>}>
            {!selectedLesson && <EmptyState message="Выберите урок" />}
            {selectedLesson && (
              <>
                <p className="breadcrumbs">
                  Главная / Обучение / {selectedCourse?.title ?? "Курс"} / {selectedModule?.title ?? "Модуль"} / {selectedLesson.title}
                </p>
                <h3>{selectedLesson.title}</h3>
                <div className="chip-row">
                  <button
                    className={selectedLessonTab === "theory_test" ? "chip active" : "chip"}
                    onClick={() => setSelectedLessonTab("theory_test")}
                  >
                    Теория и тестирование
                  </button>
                  <button
                    className={selectedLessonTab === "assignment" ? "chip active" : "chip"}
                    onClick={() => setSelectedLessonTab("assignment")}
                  >
                    Задание
                  </button>
                </div>
              </>
            )}
          </SectionCard>

          {selectedLesson && selectedLessonTab === "theory_test" && (
            <SectionCard title="Теория и тестирование">
              <div className="theory-block">
                <h3>Теория</h3>
                <p>{selectedLesson.theory_text || "Теория для урока пока не добавлена"}</p>
              </div>

              <div className="lesson-divider" />

              <div className="lesson-testing">
                <h3>Тестирование знаний</h3>
                {testAssignments.length === 0 && <EmptyState message="Для этого урока тесты пока не добавлены" />}
                {testAssignments.length > 0 && (
                  <>
                    <div className="chip-row">
                      {testAssignments.map((assignment) => (
                        <button
                          key={assignment.id}
                          className={activeTestAssignment?.id === assignment.id ? "chip active" : "chip"}
                          onClick={() => openTestAssignment(assignment.id)}
                        >
                          {assignment.title}
                          <span className="chip-sub">{assignmentStatusHint(assignment)}</span>
                        </button>
                      ))}
                    </div>

                    {!activeTestAssignment && <EmptyState message="Выберите тест из списка" />}

                    {activeTestAssignment && (
                      <form className="form-grid" onSubmit={onSubmitTest}>
                        <h3>{activeTestAssignment.title}</h3>
                        {activeTestAssignment.description && <p>{activeTestAssignment.description}</p>}
                        {activeTestSubmission && (
                          <p className="submission-note">
                            Последняя отправка: попытка {activeTestSubmission.attempt}, статус {submissionStatusLabel(activeTestSubmission.status)}
                            {activeTestSubmission.score !== null && `, балл ${activeTestSubmission.score}`}
                          </p>
                        )}

                        {testQuestions.length === 0 && <p className="hint">В тесте нет настроенных вопросов</p>}
                        {testQuestions.map((question, index) => renderQuestion(question, index))}
                        <button className="primary" type="submit">
                          Отправить тест на проверку
                        </button>
                      </form>
                    )}
                  </>
                )}
              </div>
            </SectionCard>
          )}

          {selectedLesson && selectedLessonTab === "assignment" && (
            <SectionCard title="Задание">
              {practiceAssignments.length === 0 && <EmptyState message="Для этого урока практические задания пока не добавлены" />}

              {practiceAssignments.length > 0 && (
                <>
                  <div className="chip-row">
                    {practiceAssignments.map((assignment) => (
                      <button
                        key={assignment.id}
                        className={activePracticeAssignment?.id === assignment.id ? "chip active" : "chip"}
                        onClick={() => openPracticeAssignment(assignment.id)}
                      >
                        {assignment.title}
                        <span className="chip-sub">{assignmentStatusHint(assignment)}</span>
                      </button>
                    ))}
                  </div>

                  {!activePracticeAssignment && <EmptyState message="Выберите задание из списка" />}

                  {activePracticeAssignment && (
                    <>
                      <form className="form-grid" onSubmit={onSubmitPractice}>
                        <h3>{activePracticeAssignment.title}</h3>
                        {activePracticeAssignment.description && <p>{activePracticeAssignment.description}</p>}

                        <div className={activePracticeSubmission ? "submission-flag sent" : "submission-flag not-sent"}>
                          {activePracticeSubmission
                            ? `Задание отправлено: попытка ${activePracticeSubmission.attempt}, статус ${submissionStatusLabel(activePracticeSubmission.status)}`
                            : "Задание еще не отправлено"}
                        </div>

                        {activePracticeAssignment.assignment_type === "blocks" ? (
                          <BlockEditor config={activeBlockConfig} value={blockProgram} onChange={setBlockProgram} />
                        ) : (
                          <textarea
                            className="code-editor"
                            value={practiceSolution}
                            onChange={(event) => setPracticeSolution(event.target.value)}
                            rows={12}
                            placeholder="Введите решение на Python"
                          />
                        )}

                        <button className="primary" type="submit">
                          Отправить на проверку учителю
                        </button>
                      </form>

                      <div className="lesson-divider" />

                      <div className="lesson-testing">
                        <h3>Комментарии к заданию</h3>
                        <form className="inline-form" onSubmit={onSendComment}>
                          <input
                            placeholder="Комментарий для учителя"
                            value={newComment}
                            onChange={(event) => setNewComment(event.target.value)}
                          />
                          <button type="submit">Отправить</button>
                        </form>

                        {comments.length === 0 && <p className="hint">Пока нет комментариев по этому заданию</p>}
                        {comments.length > 0 && (
                          <div className="comment-list">
                            {comments.map((comment) => (
                              <article key={comment.id} className="comment-item">
                                <strong>{comment.author_name}</strong>
                                <p>{comment.content}</p>
                              </article>
                            ))}
                          </div>
                        )}
                      </div>
                    </>
                  )}
                </>
              )}
            </SectionCard>
          )}
        </>
      )}

      {activeTab === "leaderboard" && (
        <SectionCard title="Лидерборд">
          {leaderboard.length === 0 && <EmptyState message="Лидерборд пока пуст" />}
          {leaderboard.map((entry) => (
            <div key={entry.user_id} className="leader-row">
              <span>
                #{entry.rank} {entry.full_name}
              </span>
              <span>
                уровень {entry.level} · {entry.xp} XP · серия {entry.streak}
              </span>
            </div>
          ))}
        </SectionCard>
      )}
    </>
  );
}

