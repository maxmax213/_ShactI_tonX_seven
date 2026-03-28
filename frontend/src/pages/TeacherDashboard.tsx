import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";

import { api, getErrorMessage } from "../app/api";
import { DEFAULT_BLOCK_ASSIGNMENT_TEMPLATE } from "../app/blockProgramming";
import type {
  AssignmentBrief,
  CommentView,
  Course,
  CourseModule,
  CourseParticipant,
  CourseTree,
  Lesson,
  Submission,
} from "../app/types";
import { EmptyState } from "../components/EmptyState";
import { SectionCard } from "../components/SectionCard";

type Kind = "python" | "blocks" | "test";
type Editor =
  | { type: "course"; mode: "create" | "edit" }
  | { type: "module"; mode: "create" | "edit"; moduleId?: number }
  | { type: "lesson"; mode: "create" | "edit"; moduleId?: number; lessonId?: number }
  | { type: "assignment"; mode: "create" | "edit"; lessonId?: number; assignmentId?: number };

const assignmentLabel = (type: Kind) => (type === "python" ? "Python" : type === "blocks" ? "Блоки" : "Тест");
const submissionLabel = (status: Submission["status"]) =>
  status === "pending" ? "ожидает проверки" : status === "checked" ? "проверено" : "нужна доработка";
const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part.trim()[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

function participantAvatar(participantId: number): string | null {
  try {
    return localStorage.getItem(`edu_orbit_avatar_${participantId}`);
  } catch {
    return null;
  }
}

function commentAvatar(comment: CommentView): ReactNode {
  const stored = comment.author_avatar_url || participantAvatar(comment.author_id);
  if (stored) return <img src={stored} alt="avatar" />;
  return initials(comment.author_name);
}

export function TeacherDashboard() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [tree, setTree] = useState<CourseTree | null>(null);
  const [participants, setParticipants] = useState<CourseParticipant[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [selectedAssignmentId, setSelectedAssignmentId] = useState<number | null>(null);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [comments, setComments] = useState<CommentView[]>([]);
  const [gradeValues, setGradeValues] = useState<Record<number, number>>({});
  const [editor, setEditor] = useState<Editor>({ type: "course", mode: "create" });
  const [message, setMessage] = useState("");

  const [courseForm, setCourseForm] = useState({ title: "", description: "", is_published: false });
  const [moduleForm, setModuleForm] = useState({ title: "", description: "", order_index: 1 });
  const [lessonForm, setLessonForm] = useState({ title: "", theory_text: "", order_index: 1 });
  const [assignmentForm, setAssignmentForm] = useState({
    title: "",
    description: "",
    assignment_type: "python" as Kind,
    max_score: 100,
    is_auto_check: false,
    content_payload: "",
  });

  const selectedCourse = useMemo(
    () => courses.find((course) => course.id === selectedCourseId) ?? null,
    [courses, selectedCourseId],
  );
  const participantNameMap = useMemo(
    () => new Map(participants.map((participant) => [participant.id, participant.full_name])),
    [participants],
  );
  const participantMap = useMemo(() => new Map(participants.map((participant) => [participant.id, participant])), [participants]);

  function commentXp(comment: CommentView): number {
    if (typeof comment.author_xp === "number") return comment.author_xp;
    const participant = participantMap.get(comment.author_id);
    return participant?.xp ?? 0;
  }

  const stats = useMemo(() => {
    if (!tree) return { modules: 0, lessons: 0, assignments: 0 };
    return {
      modules: tree.modules.length,
      lessons: tree.modules.reduce((sum, module) => sum + module.lessons.length, 0),
      assignments: tree.modules.reduce(
        (sum, module) => sum + module.lessons.reduce((lessonSum, lesson) => lessonSum + lesson.assignments.length, 0),
        0,
      ),
    };
  }, [tree]);

  async function refreshCourses(preferredId?: number) {
    const next = await api.myCourses();
    setCourses(next);
    if (next.length === 0) {
      setSelectedCourseId(null);
      setTree(null);
      setParticipants([]);
      return;
    }
    const target = preferredId && next.some((course) => course.id === preferredId) ? preferredId : next[0].id;
    setSelectedCourseId(target);
  }

  async function refreshCourseData(courseId: number) {
    const [nextTree, nextParticipants] = await Promise.all([api.courseTree(courseId), api.courseParticipants(courseId)]);
    setTree(nextTree);
    setParticipants(nextParticipants);
  }

  useEffect(() => {
    refreshCourses().catch((err) => setMessage(`Не удалось загрузить курсы: ${getErrorMessage(err)}`));
  }, []);

  useEffect(() => {
    if (!selectedCourseId) return;
    refreshCourseData(selectedCourseId).catch((err) => setMessage(`Ошибка курса: ${getErrorMessage(err)}`));
  }, [selectedCourseId]);

  useEffect(() => {
    if (!selectedCourse) return;
    setCourseForm({
      title: selectedCourse.title,
      description: selectedCourse.description ?? "",
      is_published: selectedCourse.is_published,
    });
    if (editor.type === "course" && editor.mode === "create") {
      setEditor({ type: "course", mode: "edit" });
    }
  }, [selectedCourse]);

  useEffect(() => {
    if (selectedAssignmentId === null) {
      setSubmissions([]);
      setComments([]);
      return;
    }
    Promise.all([api.assignmentSubmissions(selectedAssignmentId), api.assignmentComments(selectedAssignmentId)])
      .then(([nextSubmissions, nextComments]) => {
        setSubmissions(nextSubmissions);
        setComments(nextComments);
      })
      .catch((err) => setMessage(`Ошибка задания: ${getErrorMessage(err)}`));
  }, [selectedAssignmentId]);

  useEffect(() => {
    setGradeValues((current) => {
      const next = { ...current };
      submissions.forEach((submission) => {
        next[submission.id] = submission.score ?? current[submission.id] ?? 0;
      });
      return next;
    });
  }, [submissions]);

  function editCourse() {
    if (!selectedCourse) return;
    setCourseForm({
      title: selectedCourse.title,
      description: selectedCourse.description ?? "",
      is_published: selectedCourse.is_published,
    });
    setEditor({ type: "course", mode: "edit" });
  }

  function addModule() {
    setModuleForm({ title: "", description: "", order_index: (tree?.modules.length ?? 0) + 1 });
    setEditor({ type: "module", mode: "create" });
  }

  function editModule(module: CourseModule) {
    setModuleForm({ title: module.title, description: module.description ?? "", order_index: module.order_index });
    setEditor({ type: "module", mode: "edit", moduleId: module.id });
  }

  function addLesson(module: CourseModule) {
    setLessonForm({ title: "", theory_text: "", order_index: module.lessons.length + 1 });
    setEditor({ type: "lesson", mode: "create", moduleId: module.id });
  }

  function editLesson(lesson: Lesson) {
    setLessonForm({ title: lesson.title, theory_text: lesson.theory_text ?? "", order_index: lesson.order_index });
    setEditor({ type: "lesson", mode: "edit", lessonId: lesson.id });
  }

  function addAssignment(lesson: Lesson) {
    setAssignmentForm({
      title: "",
      description: "",
      assignment_type: "python",
      max_score: 100,
      is_auto_check: false,
      content_payload: "",
    });
    setEditor({ type: "assignment", mode: "create", lessonId: lesson.id });
  }

  async function editAssignment(assignment: AssignmentBrief) {
    const full = await api.assignment(assignment.id);
    setAssignmentForm({
      title: full.title,
      description: full.description ?? "",
      assignment_type: full.assignment_type,
      max_score: full.max_score,
      is_auto_check: full.is_auto_check,
      content_payload: full.content_payload ?? "",
    });
    setSelectedAssignmentId(assignment.id);
    setEditor({ type: "assignment", mode: "edit", assignmentId: assignment.id });
  }

  async function submitCourse(event: FormEvent) {
    event.preventDefault();
    if (editor.mode === "create") {
      const created = await api.createCourse({ title: courseForm.title, description: courseForm.description || undefined });
      await refreshCourses(created.id);
      setMessage("Курс создан");
      return;
    }
    if (!selectedCourseId) return;
    await api.updateCourse(
      { title: courseForm.title, description: courseForm.description || null, is_published: courseForm.is_published },
      selectedCourseId,
    );
    await refreshCourses(selectedCourseId);
    await refreshCourseData(selectedCourseId);
    setMessage("Курс обновлён");
  }

  async function submitModule(event: FormEvent) {
    event.preventDefault();
    if (!selectedCourseId) return;
    if (editor.type === "module" && editor.mode === "create") {
      await api.createModule(selectedCourseId, {
        title: moduleForm.title,
        description: moduleForm.description || undefined,
        order_index: moduleForm.order_index,
      });
      setMessage("Модуль добавлен");
    } else if (editor.type === "module" && editor.moduleId) {
      await api.updateModule(editor.moduleId, {
        title: moduleForm.title,
        description: moduleForm.description || null,
        order_index: moduleForm.order_index,
      });
      setMessage("Модуль обновлён");
    }
    await refreshCourseData(selectedCourseId);
  }

  async function submitLesson(event: FormEvent) {
    event.preventDefault();
    if (editor.type === "lesson" && editor.mode === "create" && editor.moduleId) {
      await api.createLesson(editor.moduleId, {
        title: lessonForm.title,
        theory_text: lessonForm.theory_text || undefined,
        order_index: lessonForm.order_index,
      });
      setMessage("Урок добавлен");
    } else if (editor.type === "lesson" && editor.lessonId) {
      await api.updateLesson(editor.lessonId, {
        title: lessonForm.title,
        theory_text: lessonForm.theory_text || null,
        order_index: lessonForm.order_index,
      });
      setMessage("Урок обновлён");
    }
    if (selectedCourseId) await refreshCourseData(selectedCourseId);
  }

  async function submitAssignment(event: FormEvent) {
    event.preventDefault();
    const updatePayload = {
      title: assignmentForm.title,
      description: assignmentForm.description || null,
      assignment_type: assignmentForm.assignment_type,
      max_score: assignmentForm.max_score,
      is_auto_check: assignmentForm.is_auto_check,
      content_payload: assignmentForm.content_payload || null,
    };
    if (editor.type === "assignment" && editor.mode === "create" && editor.lessonId) {
      await api.createAssignment({
        lesson_id: editor.lessonId,
        title: assignmentForm.title,
        description: assignmentForm.description || undefined,
        assignment_type: assignmentForm.assignment_type,
        max_score: assignmentForm.max_score,
        is_auto_check: assignmentForm.is_auto_check,
        content_payload: assignmentForm.content_payload || undefined,
      });
      setMessage("Задание добавлено");
    } else if (editor.type === "assignment" && editor.assignmentId) {
      await api.updateAssignment(editor.assignmentId, updatePayload);
      setSelectedAssignmentId(editor.assignmentId);
      setMessage("Задание обновлено");
    }
    if (selectedCourseId) await refreshCourseData(selectedCourseId);
  }

  async function gradeSubmission(id: number, score: number) {
    await api.gradeSubmission(id, score, "Проверено учителем");
    if (selectedAssignmentId !== null) {
      setSubmissions(await api.assignmentSubmissions(selectedAssignmentId));
    }
  }

  const editorTitle =
    editor.type === "course"
      ? editor.mode === "create"
        ? "Новый курс"
        : "Редактор курса"
      : editor.type === "module"
        ? editor.mode === "create"
          ? "Новый модуль"
          : "Редактор модуля"
        : editor.type === "lesson"
          ? editor.mode === "create"
            ? "Новый урок"
            : "Редактор урока"
          : editor.mode === "create"
            ? "Новое задание"
            : "Редактор задания";

  return (
    <div className="teacher-dashboard">
      <SectionCard
        title="Курсы"
        actions={
          <button className="primary" onClick={() => setEditor({ type: "course", mode: "create" })}>
            Новый курс
          </button>
        }
      >
        {message && <p className="hint">{message}</p>}
        {courses.length === 0 && <EmptyState message="Курсов пока нет." />}
        {courses.length > 0 && (
          <div className="teacher-course-grid">
            {courses.map((course) => (
              <button
                key={course.id}
                className={selectedCourseId === course.id ? "teacher-course-card active" : "teacher-course-card"}
                onClick={() => setSelectedCourseId(course.id)}
              >
                <div className="teacher-course-card__top">
                  <strong>{course.title}</strong>
                  <span className={course.is_published ? "teacher-status live" : "teacher-status draft"}>
                    {course.is_published ? "Опубликован" : "Черновик"}
                  </span>
                </div>
                <p>{course.description || "Добавьте описание курса."}</p>
                <span>Код входа: {course.enroll_code}</span>
              </button>
            ))}
          </div>
        )}
      </SectionCard>

      <div className="teacher-layout">
        <div className="teacher-main-column">
          <SectionCard
            title={selectedCourse?.title || "Структура курса"}
            actions={
              selectedCourseId ? (
                <div className="chip-row">
                  <button onClick={editCourse}>Редактировать курс</button>
                  <button onClick={addModule}>Добавить модуль</button>
                </div>
              ) : undefined
            }
          >
            {!tree && <EmptyState message="Выберите курс для просмотра структуры." />}
            {tree && (
              <>
                <div className="teacher-overview">
                  <div className="teacher-overview__hero">
                    <span className="teacher-overview__eyebrow">Teacher workspace</span>
                    <h3>{tree.title}</h3>
                    <p>{tree.description || "Соберите здесь программу: модули, уроки, задания и участников."}</p>
                  </div>
                  <div className="teacher-stat-grid">
                    <div className="teacher-stat-tile">
                      <span>Модули</span>
                      <strong>{stats.modules}</strong>
                    </div>
                    <div className="teacher-stat-tile">
                      <span>Уроки</span>
                      <strong>{stats.lessons}</strong>
                    </div>
                    <div className="teacher-stat-tile">
                      <span>Задания</span>
                      <strong>{stats.assignments}</strong>
                    </div>
                    <div className="teacher-stat-tile">
                      <span>Участники</span>
                      <strong>{participants.length}</strong>
                    </div>
                  </div>
                </div>
                <div className="teacher-structure">
                  {tree.modules.length === 0 && <EmptyState message="Начните с первого модуля." />}
                  {tree.modules.map((module) => (
                    <article key={module.id} className="teacher-module-card">
                      <div className="teacher-item-head">
                        <div>
                          <span className="teacher-item-kicker">Модуль {module.order_index}</span>
                          <h3>{module.title}</h3>
                          {module.description && <p>{module.description}</p>}
                        </div>
                        <div className="teacher-item-actions">
                          <button onClick={() => editModule(module)}>Редактировать</button>
                          <button onClick={() => addLesson(module)}>Добавить урок</button>
                        </div>
                      </div>
                      <div className="teacher-lesson-stack">
                        {module.lessons.length === 0 && <p className="hint">Уроков пока нет.</p>}
                        {module.lessons.map((lesson) => (
                          <div key={lesson.id} className="teacher-lesson-card">
                            <div className="teacher-item-head compact">
                              <div>
                                <span className="teacher-item-kicker">
                                  Урок {module.order_index}.{lesson.order_index}
                                </span>
                                <h4>{lesson.title}</h4>
                                <p>{lesson.theory_text || "Добавьте теорию и материалы урока."}</p>
                              </div>
                              <div className="teacher-item-actions">
                                <button onClick={() => editLesson(lesson)}>Редактировать</button>
                                <button onClick={() => addAssignment(lesson)}>Добавить задание</button>
                              </div>
                            </div>
                            <div className="teacher-assignment-list">
                              {lesson.assignments.length === 0 && <p className="hint">Заданий пока нет.</p>}
                              {lesson.assignments.map((assignment) => (
                                <div
                                  key={assignment.id}
                                  className={
                                    selectedAssignmentId === assignment.id
                                      ? "teacher-assignment-item active"
                                      : "teacher-assignment-item"
                                  }
                                >
                                  <button
                                    className="teacher-assignment-item__main"
                                    onClick={() => setSelectedAssignmentId(assignment.id)}
                                  >
                                    <strong>{assignment.title}</strong>
                                    <span>
                                      {assignmentLabel(assignment.assignment_type)} | {assignment.max_score} баллов
                                    </span>
                                  </button>
                                  <button onClick={() => editAssignment(assignment)}>Редактировать</button>
                                </div>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </SectionCard>

          <SectionCard title="Проверка работ">
            {selectedAssignmentId === null && <EmptyState message="Выберите задание, чтобы проверить работы." />}
            {selectedAssignmentId !== null && submissions.length === 0 && <EmptyState message="Отправок пока нет." />}
            {submissions.map((submission) => (
              <article key={submission.id} className="submission-item">
                <p>
                  {participantNameMap.get(submission.student_id) ?? `Ученик ${submission.student_id}`}, попытка{" "}
                  {submission.attempt}, статус: {submissionLabel(submission.status)}
                </p>
                <pre>{submission.solution_payload}</pre>
                <div className="teacher-grade-box">
                  <label className="teacher-grade-label" htmlFor={`grade-${submission.id}`}>
                    Оценка: <strong>{gradeValues[submission.id] ?? 0}</strong>
                  </label>
                  <input
                    id={`grade-${submission.id}`}
                    className="teacher-grade-range"
                    type="range"
                    min={0}
                    max={100}
                    step={1}
                    value={gradeValues[submission.id] ?? 0}
                    onChange={(event) =>
                      setGradeValues((current) => ({
                        ...current,
                        [submission.id]: Number(event.target.value),
                      }))
                    }
                  />
                  <button onClick={() => gradeSubmission(submission.id, gradeValues[submission.id] ?? 0)}>
                    Сохранить оценку
                  </button>
                </div>
              </article>
            ))}
            {selectedAssignmentId !== null && (
              <div className="teacher-comments-panel">
                <h3>Комментарии по заданию</h3>
                {comments.length === 0 && <p className="hint">Комментариев от учеников пока нет.</p>}
                {comments.map((comment) => (
                  <article key={comment.id} className="comment-item">
                    <div className="student-inline">
                      <span className="student-inline-avatar">{commentAvatar(comment)}</span>
                      <span className="student-inline-meta">
                        <strong>{comment.author_name}</strong>
                        <span className="student-inline-sub">XP: {commentXp(comment)}</span>
                      </span>
                    </div>
                    <p>{comment.content}</p>
                  </article>
                ))}
              </div>
            )}
          </SectionCard>
        </div>

        <div className="teacher-side-column">
          <SectionCard title={editorTitle}>
            {editor.type === "course" && (
              <form className="form-grid teacher-editor-form" onSubmit={submitCourse}>
                <input
                  value={courseForm.title}
                  onChange={(event) => setCourseForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Название курса"
                  required
                />
                <textarea
                  value={courseForm.description}
                  onChange={(event) => setCourseForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Описание курса"
                  rows={5}
                />
                {editor.mode === "edit" && (
                  <label className="inline">
                    <input
                      type="checkbox"
                      checked={courseForm.is_published}
                      onChange={(event) =>
                        setCourseForm((current) => ({ ...current, is_published: event.target.checked }))
                      }
                    />
                    Курс опубликован
                  </label>
                )}
                <button className="primary" type="submit">
                  {editor.mode === "create" ? "Создать курс" : "Сохранить курс"}
                </button>
              </form>
            )}
            {editor.type === "module" && (
              <form className="form-grid teacher-editor-form" onSubmit={submitModule}>
                <input
                  value={moduleForm.title}
                  onChange={(event) => setModuleForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Название модуля"
                  required
                />
                <textarea
                  value={moduleForm.description}
                  onChange={(event) => setModuleForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Описание модуля"
                  rows={4}
                />
                <input
                  type="number"
                  min={1}
                  value={moduleForm.order_index}
                  onChange={(event) => setModuleForm((current) => ({ ...current, order_index: Number(event.target.value) }))}
                />
                <button className="primary" type="submit">
                  {editor.mode === "create" ? "Добавить модуль" : "Сохранить модуль"}
                </button>
              </form>
            )}
            {editor.type === "lesson" && (
              <form className="form-grid teacher-editor-form" onSubmit={submitLesson}>
                <input
                  value={lessonForm.title}
                  onChange={(event) => setLessonForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Название урока"
                  required
                />
                <textarea
                  value={lessonForm.theory_text}
                  onChange={(event) => setLessonForm((current) => ({ ...current, theory_text: event.target.value }))}
                  placeholder="Теория урока"
                  rows={8}
                />
                <input
                  type="number"
                  min={1}
                  value={lessonForm.order_index}
                  onChange={(event) => setLessonForm((current) => ({ ...current, order_index: Number(event.target.value) }))}
                />
                <button className="primary" type="submit">
                  {editor.mode === "create" ? "Добавить урок" : "Сохранить урок"}
                </button>
              </form>
            )}
            {editor.type === "assignment" && (
              <form className="form-grid teacher-editor-form" onSubmit={submitAssignment}>
                <input
                  value={assignmentForm.title}
                  onChange={(event) => setAssignmentForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Название задания"
                  required
                />
                <textarea
                  value={assignmentForm.description}
                  onChange={(event) => setAssignmentForm((current) => ({ ...current, description: event.target.value }))}
                  placeholder="Описание задания"
                  rows={4}
                />
                <select
                  value={assignmentForm.assignment_type}
                  onChange={(event) =>
                    setAssignmentForm((current) => ({ ...current, assignment_type: event.target.value as Kind }))
                  }
                >
                  <option value="python">Python</option>
                  <option value="blocks">Блоки</option>
                  <option value="test">Тест</option>
                </select>
                <input
                  type="number"
                  min={1}
                  value={assignmentForm.max_score}
                  onChange={(event) =>
                    setAssignmentForm((current) => ({ ...current, max_score: Number(event.target.value) }))
                  }
                />
                {assignmentForm.assignment_type === "blocks" && (
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
                )}
                <textarea
                  value={assignmentForm.content_payload}
                  onChange={(event) =>
                    setAssignmentForm((current) => ({ ...current, content_payload: event.target.value }))
                  }
                  placeholder="Payload задания"
                  rows={8}
                />
                <label className="inline">
                  <input
                    type="checkbox"
                    checked={assignmentForm.is_auto_check}
                    onChange={(event) =>
                      setAssignmentForm((current) => ({ ...current, is_auto_check: event.target.checked }))
                    }
                  />
                  Автопроверка
                </label>
                <button className="primary" type="submit">
                  {editor.mode === "create" ? "Добавить задание" : "Сохранить задание"}
                </button>
              </form>
            )}
          </SectionCard>

          <SectionCard title="Участники курса">
            {!selectedCourseId && <EmptyState message="Выберите курс." />}
            {selectedCourseId && participants.length === 0 && <EmptyState message="Участников пока нет." />}
            {participants.length > 0 && (
              <div className="teacher-participant-list">
                {participants.map((participant) => {
                  const avatarUrl = participantAvatar(participant.id);

                  return (
                    <article key={participant.id} className="teacher-participant-card">
                      <div className="teacher-participant-avatar">
                        {avatarUrl ? (
                          <img
                            src={avatarUrl}
                            alt={participant.full_name}
                            className="teacher-participant-avatar-image"
                          />
                        ) : (
                          <span className="teacher-participant-avatar-fallback">
                            {initials(participant.full_name)}
                          </span>
                        )}
                      </div>
                      <div className="teacher-participant-info">
                        <strong>{participant.full_name}</strong>
                        <span>{participant.email}</span>
                      </div>
                      <div className="teacher-participant-meta">
                        <span>Уровень {participant.level}</span>
                        <span>{participant.xp} XP</span>
                      </div>
                    </article>
                  );
                })}
              </div>
            )}
          </SectionCard>
        </div>
      </div>
    </div>
  );
}
