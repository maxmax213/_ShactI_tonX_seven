import { FormEvent, useEffect, useMemo, useState } from "react";

import { api } from "../app/api";
import { DEFAULT_BLOCK_ASSIGNMENT_TEMPLATE, parseBlockSubmissionPayload } from "../app/blockProgramming";
import type {
  Achievement,
  Assignment,
  Course,
  CourseTree,
  Submission,
  TestContentPayload,
  TestQuestion,
  User,
} from "../app/types";
import { EmptyState } from "../components/EmptyState";
import { SectionCard } from "../components/SectionCard";

function assignmentTypeLabel(type: "python" | "blocks" | "test"): string {
  if (type === "python") return "Python";
  if (type === "blocks") return "Блоки";
  return "Тест";
}

function submissionStatusLabel(status: "pending" | "checked" | "needs_rework"): string {
  if (status === "pending") return "ожидает проверки";
  if (status === "checked") return "проверено";
  return "нужна доработка";
}

function normalizeTestQuestions(payload: string | null): TestQuestion[] {
  if (!payload) return [];
  try {
    const parsed = JSON.parse(payload) as TestContentPayload;
    if (!parsed || !Array.isArray(parsed.questions)) return [];
    return parsed.questions.filter(
      (question) => question && (typeof question.id === "string" || typeof question.id === "number"),
    );
  } catch {
    return [];
  }
}

function parseTestAnswers(questions: TestQuestion[], payload: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(payload);
    if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
      return parsed as Record<string, unknown>;
    }
    if (Array.isArray(parsed)) {
      const mapped: Record<string, unknown> = {};
      questions.forEach((question, index) => {
        if (index < parsed.length) {
          mapped[String(question.id)] = parsed[index];
        }
      });
      return mapped;
    }
  } catch {
    // fallthrough to text parsing
  }

  const raw = payload.trim();
  if (!raw) return {};

  const answers: Record<string, unknown> = {};
  const separators = ["\n", ";"];
  let chunks = [raw];
  for (const sep of separators) {
    if (raw.includes(sep)) {
      chunks = raw.split(sep).map((part) => part.trim()).filter(Boolean);
      break;
    }
  }

  if (chunks.some((chunk) => chunk.includes("=") || chunk.includes(":"))) {
    chunks.forEach((chunk) => {
      let key = "";
      let value = "";
      if (chunk.includes("=")) {
        const index = chunk.indexOf("=");
        key = chunk.slice(0, index);
        value = chunk.slice(index + 1);
      } else if (chunk.includes(":")) {
        const index = chunk.indexOf(":");
        key = chunk.slice(0, index);
        value = chunk.slice(index + 1);
      }
      key = key.trim();
      value = value.trim();
      if (!key) return;
      answers[key] = value.includes(",")
        ? value.split(",").map((item) => item.trim()).filter(Boolean)
        : value;
    });
    return answers;
  }

  const ordered = chunks.length > 1 ? chunks : raw.split(",").map((part) => part.trim()).filter(Boolean);
  questions.forEach((question, index) => {
    if (index < ordered.length) {
      const value = ordered[index];
      answers[String(question.id)] = value.includes(",")
        ? value.split(",").map((item) => item.trim()).filter(Boolean)
        : value;
    }
  });
  return answers;
}

function formatTestAnswer(question: TestQuestion, answer: unknown): string {
  if (answer === null || typeof answer === "undefined" || answer === "") return "Нет ответа";
  if (question.type === "true_false") {
    if (answer === true || answer === "true" || answer === "да") return "Верно";
    if (answer === false || answer === "false" || answer === "нет") return "Неверно";
  }

  const options = question.options ?? [];
  const optionMap = new Map(options.map((option) => [String(option.id), option.text]));

  if (Array.isArray(answer)) {
    const resolved = answer.map((value) => optionMap.get(String(value)) ?? String(value));
    return resolved.join(", ");
  }

  return optionMap.get(String(answer)) ?? String(answer);
}

function formatCorrectAnswer(question: TestQuestion): string {
  if (typeof question.correct === "undefined") return "";
  return formatTestAnswer(question, question.correct);
}

function renderSubmissionContent(
  submission: Submission,
  assignment: Assignment | null,
  testQuestions: TestQuestion[],
) {
  if (assignment?.assignment_type === "test" && testQuestions.length > 0) {
    const answers = parseTestAnswers(testQuestions, submission.solution_payload);
    return (
      <div className="test-review">
        {testQuestions.map((question, index) => {
          const questionId = String(question.id);
          const prompt = question.prompt || question.title || `Вопрос ${index + 1}`;
          const studentAnswer = formatTestAnswer(question, answers[questionId]);
          const correctAnswer = formatCorrectAnswer(question);

          return (
            <div key={questionId} className="test-review__question">
              <strong>{prompt}</strong>
              <p>Ответ ученика: {studentAnswer}</p>
              {correctAnswer && <p className="hint">Правильный ответ: {correctAnswer}</p>}
            </div>
          );
        })}
      </div>
    );
  }

  const blockPayload = parseBlockSubmissionPayload(submission.solution_payload);
  if (!blockPayload) {
    return <pre>{submission.solution_payload}</pre>;
  }

  return (
    <div className="block-review">
      <p className="hint">Блочное решение: {blockPayload.blocks.length} блоков</p>
      <pre>{blockPayload.generated_code}</pre>
    </div>
  );
}

export function TeacherDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [students, setStudents] = useState<User[]>([]);
  const [achievements, setAchievements] = useState<Achievement[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedTree, setSelectedTree] = useState<CourseTree | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [testQuestions, setTestQuestions] = useState<TestQuestion[]>([]);
  const [assignmentSubmissions, setAssignmentSubmissions] = useState<Submission[]>([]);
  const [message, setMessage] = useState<string>("");

  const [courseForm, setCourseForm] = useState({ title: "", description: "" });
  const [moduleForm, setModuleForm] = useState({ title: "", description: "", order_index: 1 });
  const [lessonForm, setLessonForm] = useState({ module_id: 0, title: "", theory_text: "", order_index: 1 });
  const [assignmentForm, setAssignmentForm] = useState({
    lesson_id: 0,
    title: "",
    description: "",
    assignment_type: "python" as "python" | "blocks" | "test",
    max_score: 100,
    is_auto_check: false,
    content_payload: "",
  });
  const [achievementForm, setAchievementForm] = useState({
    slug: "",
    title: "",
    description: "",
    rarity: "common" as "common" | "rare" | "epic",
    xp_reward: 10,
  });

  useEffect(() => {
    async function load() {
      const [myCourses, users, allAchievements] = await Promise.all([
        api.myCourses(),
        api.listUsers("student"),
        api.achievements(),
      ]);
      setCourses(myCourses);
      setStudents(users);
      setAchievements(allAchievements);
      if (myCourses.length > 0) {
        setSelectedCourseId(myCourses[0].id);
      }
    }

    load().catch((err) => setMessage(`Не удалось загрузить данные: ${String(err)}`));
  }, []);

  useEffect(() => {
    if (!selectedCourseId) {
      setSelectedTree(null);
      return;
    }

    api
      .courseTree(selectedCourseId)
      .then(setSelectedTree)
      .catch((err) => setMessage(`Ошибка загрузки структуры курса: ${String(err)}`));
  }, [selectedCourseId]);

  useEffect(() => {
    if (selectedAssignmentId === null) {
      setAssignmentSubmissions([]);
      setSelectedAssignment(null);
      setTestQuestions([]);
      return;
    }

    const assignmentId: number = selectedAssignmentId;
    async function loadAssignmentDetails() {
      const [submissions, assignment] = await Promise.all([
        api.assignmentSubmissions(assignmentId),
        api.assignment(assignmentId),
      ]);
      setAssignmentSubmissions(submissions);
      setSelectedAssignment(assignment);
      if (assignment.assignment_type === "test") {
        setTestQuestions(normalizeTestQuestions(assignment.content_payload));
      } else {
        setTestQuestions([]);
      }
    }

    loadAssignmentDetails().catch((err) => setMessage(`Ошибка загрузки решений: ${String(err)}`));
  }, [selectedAssignmentId]);

  const lessons = useMemo(() => {
    if (!selectedTree) return [];
    return selectedTree.modules.flatMap((module) => module.lessons);
  }, [selectedTree]);

  async function refreshCourses() {
    const myCourses = await api.myCourses();
    setCourses(myCourses);
    if (myCourses.length > 0 && !selectedCourseId) {
      setSelectedCourseId(myCourses[0].id);
    }
  }

  async function onCreateCourse(event: FormEvent) {
    event.preventDefault();
    await api.createCourse(courseForm);
    setCourseForm({ title: "", description: "" });
    setMessage("Курс создан");
    await refreshCourses();
  }

  async function onCreateModule(event: FormEvent) {
    event.preventDefault();
    if (!selectedCourseId) return;
    await api.createModule(selectedCourseId, moduleForm);
    setModuleForm({ title: "", description: "", order_index: moduleForm.order_index + 1 });
    setMessage("Модуль создан");
    setSelectedTree(await api.courseTree(selectedCourseId));
  }

  async function onCreateLesson(event: FormEvent) {
    event.preventDefault();
    if (!lessonForm.module_id) return;
    await api.createLesson(lessonForm.module_id, {
      title: lessonForm.title,
      theory_text: lessonForm.theory_text,
      order_index: lessonForm.order_index,
    });
    setLessonForm((current) => ({ ...current, title: "", theory_text: "", order_index: current.order_index + 1 }));
    setMessage("Урок создан");
    if (selectedCourseId) setSelectedTree(await api.courseTree(selectedCourseId));
  }

  async function onCreateAssignment(event: FormEvent) {
    event.preventDefault();
    await api.createAssignment({
      ...assignmentForm,
      content_payload: assignmentForm.content_payload || undefined,
    });
    setAssignmentForm((current) => ({
      ...current,
      title: "",
      description: "",
      content_payload: "",
    }));
    setMessage("Задание создано");
    if (selectedCourseId) setSelectedTree(await api.courseTree(selectedCourseId));
  }

  async function onCreateAchievement(event: FormEvent) {
    event.preventDefault();
    await api.createAchievement(achievementForm);
    setAchievementForm({
      slug: "",
      title: "",
      description: "",
      rarity: "common",
      xp_reward: 10,
    });
    setAchievements(await api.achievements());
    setMessage("Ачивка создана");
  }

  async function onAwardAchievement(achievementId: number, studentId: number) {
    await api.awardAchievement(achievementId, studentId);
    setMessage("Ачивка выдана");
  }

  async function onGradeSubmission(submissionId: number, score: number) {
    await api.gradeSubmission(submissionId, score, "Проверено учителем");
    if (selectedAssignmentId !== null) {
      setAssignmentSubmissions(await api.assignmentSubmissions(selectedAssignmentId));
    }
    setMessage("Решение проверено");
  }

  return (
    <>
      <SectionCard title="Панель учителя">
        <div className="chip-row">
          {courses.map((course) => (
            <button
              key={course.id}
              className={selectedCourseId === course.id ? "chip active" : "chip"}
              onClick={() => setSelectedCourseId(course.id)}
            >
              {course.title}
            </button>
          ))}
        </div>
        {message && <p className="hint">{message}</p>}
      </SectionCard>

      <div className="two-col">
        <SectionCard title="Создание контента">
          <form className="form-grid" onSubmit={onCreateCourse}>
            <h3>Новый курс</h3>
            <input
              placeholder="Название курса"
              value={courseForm.title}
              onChange={(event) => setCourseForm((current) => ({ ...current, title: event.target.value }))}
              required
            />
            <textarea
              placeholder="Описание"
              value={courseForm.description}
              onChange={(event) => setCourseForm((current) => ({ ...current, description: event.target.value }))}
            />
            <button className="primary" type="submit">
              Создать курс
            </button>
          </form>

          <form className="form-grid" onSubmit={onCreateModule}>
            <h3>Новый модуль</h3>
            <input
              placeholder="Название модуля"
              value={moduleForm.title}
              onChange={(event) => setModuleForm((current) => ({ ...current, title: event.target.value }))}
              required
            />
            <input
              type="number"
              min={1}
              value={moduleForm.order_index}
              onChange={(event) => setModuleForm((current) => ({ ...current, order_index: Number(event.target.value) }))}
            />
            <button type="submit">Добавить модуль</button>
          </form>

          <form className="form-grid" onSubmit={onCreateLesson}>
            <h3>Новый урок</h3>
            <select
              value={lessonForm.module_id}
              onChange={(event) => setLessonForm((current) => ({ ...current, module_id: Number(event.target.value) }))}
              required
            >
              <option value={0}>Выберите модуль</option>
              {selectedTree?.modules.map((module) => (
                <option key={module.id} value={module.id}>
                  {module.title}
                </option>
              ))}
            </select>
            <input
              placeholder="Название урока"
              value={lessonForm.title}
              onChange={(event) => setLessonForm((current) => ({ ...current, title: event.target.value }))}
              required
            />
            <textarea
              placeholder="Теория"
              value={lessonForm.theory_text}
              onChange={(event) => setLessonForm((current) => ({ ...current, theory_text: event.target.value }))}
            />
            <input
              type="number"
              min={1}
              value={lessonForm.order_index}
              onChange={(event) => setLessonForm((current) => ({ ...current, order_index: Number(event.target.value) }))}
            />
            <button type="submit">Добавить урок</button>
          </form>

          <form className="form-grid" onSubmit={onCreateAssignment}>
            <h3>Новое задание</h3>
            <select
              value={assignmentForm.lesson_id}
              onChange={(event) =>
                setAssignmentForm((current) => ({ ...current, lesson_id: Number(event.target.value) }))
              }
              required
            >
              <option value={0}>Выберите урок</option>
              {lessons.map((lesson) => (
                <option key={lesson.id} value={lesson.id}>
                  {lesson.title}
                </option>
              ))}
            </select>
            <input
              placeholder="Название задания"
              value={assignmentForm.title}
              onChange={(event) => setAssignmentForm((current) => ({ ...current, title: event.target.value }))}
              required
            />
            <select
              value={assignmentForm.assignment_type}
              onChange={(event) =>
                setAssignmentForm((current) => ({
                  ...current,
                  assignment_type: event.target.value as "python" | "blocks" | "test",
                }))
              }
            >
              <option value="python">Python</option>
              <option value="blocks">Блоки</option>
              <option value="test">Тест</option>
            </select>
            <textarea
              placeholder="Описание"
              value={assignmentForm.description}
              onChange={(event) => setAssignmentForm((current) => ({ ...current, description: event.target.value }))}
            />
            {assignmentForm.assignment_type === "blocks" && (
              <>
                <p className="hint">
                  Можно оставить поле ниже пустым, тогда редактор возьмёт стандартную палитру блоков. Или вставьте JSON-конфиг.
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setAssignmentForm((current) => ({
                      ...current,
                      content_payload: current.content_payload || DEFAULT_BLOCK_ASSIGNMENT_TEMPLATE,
                    }))
                  }
                >
                  Подставить шаблон блоков
                </button>
              </>
            )}
            <textarea
              placeholder={
                assignmentForm.assignment_type === "blocks"
                  ? "JSON-конфиг для блочного редактора"
                  : 'JSON для автопроверки теста, пример: {"questions":[{"id":"1","correct":"for"}]}'
              }
              value={assignmentForm.content_payload}
              onChange={(event) =>
                setAssignmentForm((current) => ({
                  ...current,
                  content_payload: event.target.value,
                }))
              }
            />
            <label className="inline">
              <input
                type="checkbox"
                checked={assignmentForm.is_auto_check}
                onChange={(event) =>
                  setAssignmentForm((current) => ({
                    ...current,
                    is_auto_check: event.target.checked,
                  }))
                }
              />
              Автопроверка
            </label>
            <button type="submit">Добавить задание</button>
          </form>
        </SectionCard>

        <SectionCard title="Структура курса">
          {!selectedTree && <EmptyState message="Выберите курс для просмотра структуры" />}
          {selectedTree && (
            <div className="tree-view">
              {selectedTree.modules.map((module) => (
                <div key={module.id} className="tree-node">
                  <h3>
                    #{module.order_index} {module.title}
                  </h3>
                  {module.lessons.map((lesson) => (
                    <div key={lesson.id} className="tree-lesson">
                      <strong>
                        Урок {lesson.order_index}: {lesson.title}
                      </strong>
                      <ul>
                        {lesson.assignments.map((assignment) => (
                          <li key={assignment.id}>
                            <button onClick={() => setSelectedAssignmentId(assignment.id)}>
                              {assignment.title} ({assignmentTypeLabel(assignment.assignment_type)})
                            </button>
                          </li>
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </SectionCard>
      </div>

      <div className="two-col">
        <SectionCard title="Проверка решений">
          {selectedAssignmentId === null && <EmptyState message="Выберите задание в структуре курса" />}
          {selectedAssignmentId !== null && assignmentSubmissions.length === 0 && (
            <EmptyState message="Решений пока нет" />
          )}
          {assignmentSubmissions.map((submission) => (
            <article key={submission.id} className="submission-item">
              <p>
                Ученик #{submission.student_id}, попытка {submission.attempt}, статус: {submissionStatusLabel(submission.status)}
              </p>
              {renderSubmissionContent(submission, selectedAssignment, testQuestions)}
              <div className="chip-row">
                {[60, 75, 90, 100].map((score) => (
                  <button key={score} onClick={() => onGradeSubmission(submission.id, score)}>
                    Поставить {score}
                  </button>
                ))}
              </div>
            </article>
          ))}
        </SectionCard>

        <SectionCard title="Ачивки">
          <form className="form-grid" onSubmit={onCreateAchievement}>
            <input
              placeholder="Slug"
              value={achievementForm.slug}
              onChange={(event) => setAchievementForm((current) => ({ ...current, slug: event.target.value }))}
              required
            />
            <input
              placeholder="Название"
              value={achievementForm.title}
              onChange={(event) => setAchievementForm((current) => ({ ...current, title: event.target.value }))}
              required
            />
            <textarea
              placeholder="Описание"
              value={achievementForm.description}
              onChange={(event) =>
                setAchievementForm((current) => ({ ...current, description: event.target.value }))
              }
              required
            />
            <select
              value={achievementForm.rarity}
              onChange={(event) =>
                setAchievementForm((current) => ({
                  ...current,
                  rarity: event.target.value as "common" | "rare" | "epic",
                }))
              }
            >
              <option value="common">Обычная</option>
              <option value="rare">Редкая</option>
              <option value="epic">Эпическая</option>
            </select>
            <input
              type="number"
              min={1}
              value={achievementForm.xp_reward}
              onChange={(event) =>
                setAchievementForm((current) => ({
                  ...current,
                  xp_reward: Number(event.target.value),
                }))
              }
            />
            <button type="submit">Создать ачивку</button>
          </form>

          <div className="award-grid">
            {achievements.map((achievement) => (
              <div className="achievement-tile" key={achievement.id}>
                <h4>{achievement.title}</h4>
                <p>{achievement.description}</p>
                <select onChange={(event) => onAwardAchievement(achievement.id, Number(event.target.value))} defaultValue="">
                  <option value="" disabled>
                    Выдать ученику
                  </option>
                  {students.map((student) => (
                    <option key={student.id} value={student.id}>
                      {student.full_name}
                    </option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </SectionCard>
      </div>
    </>
  );
}
