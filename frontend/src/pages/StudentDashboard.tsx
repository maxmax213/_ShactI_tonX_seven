import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../app/api";
import { useAuth } from "../app/auth";
import { createStarterProgram, parseBlockAssignmentConfig, serializeBlockSubmission } from "../app/blockProgramming";
import type { Assignment, CommentView, Course, CourseTree, Submission, UserAchievement, UserStats } from "../app/types";
import { BlockEditor } from "../components/BlockEditor";
import { EmptyState } from "../components/EmptyState";
import { SectionCard } from "../components/SectionCard";

type CourseAssignmentInfo = {
  assignmentId: number;
  lessonTitle: string;
};

function assignmentTypeLabel(type: "python" | "blocks" | "test"): string {
  if (type === "python") return "Python";
  if (type === "blocks") return "Блоки";
  return "Тест";
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

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function StudentDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState<"profile" | "assignments">("profile");
  const [message, setMessage] = useState("");

  const [courses, setCourses] = useState<Course[]>([]);
  const [courseTreesById, setCourseTreesById] = useState<Record<number, CourseTree>>({});
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [courseTree, setCourseTree] = useState<CourseTree | null>(null);

  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [solution, setSolution] = useState<string>("print('hello world')");
  const [blockProgram, setBlockProgram] = useState(createStarterProgram({ hints: [] }));
  const [comments, setComments] = useState<CommentView[]>([]);
  const [newComment, setNewComment] = useState("");

  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [enrollCode, setEnrollCode] = useState("");

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

  const assignmentList = useMemo(() => {
    if (!courseTree) return [];
    return courseTree.modules.flatMap((module) => module.lessons.flatMap((lesson) => lesson.assignments));
  }, [courseTree]);

  const courseProgressData = useMemo(() => {
    const result = courses.map((course) => {
      const tree = courseTreesById[course.id];
      if (!tree) {
        return {
          courseId: course.id,
          title: course.title,
          progress: 0,
          lastTopic: "Загружаем темы...",
          lessonsCount: 0,
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
      };
    });

    return result;
  }, [courses, courseTreesById, submissions]);

  const activeBlockConfig = useMemo(() => {
    if (!activeAssignment || activeAssignment.assignment_type !== "blocks") {
      return { hints: [] };
    }
    return parseBlockAssignmentConfig(activeAssignment.content_payload);
  }, [activeAssignment]);

  useEffect(() => {
    async function loadDashboard() {
      const [myCourses, mySubs, myAchievements, myStats] = await Promise.all([
        api.myCourses(),
        api.mySubmissions(),
        api.myAchievements(),
        api.meStats(),
      ]);

      setCourses(myCourses);
      setSubmissions(mySubs);
      setAchievements(myAchievements);
      setStats(myStats);

      if (myCourses.length > 0) {
        setSelectedCourseId((current) => current ?? myCourses[0].id);
      }

      const treeResults = await Promise.allSettled(myCourses.map((course) => api.courseTree(course.id)));
      const nextTrees: Record<number, CourseTree> = {};
      treeResults.forEach((result, index) => {
        if (result.status === "fulfilled") {
          nextTrees[myCourses[index].id] = result.value;
        }
      });
      setCourseTreesById(nextTrees);
    }

    loadDashboard().catch((err) => setMessage(`Не удалось загрузить данные: ${String(err)}`));
  }, []);

  useEffect(() => {
    if (!selectedCourseId) {
      setCourseTree(null);
      return;
    }

    const cached = courseTreesById[selectedCourseId];
    if (cached) {
      setCourseTree(cached);
      return;
    }

    api
      .courseTree(selectedCourseId)
      .then((tree) => {
        setCourseTree(tree);
        setCourseTreesById((current) => ({ ...current, [selectedCourseId]: tree }));
      })
      .catch((err) => setMessage(`Ошибка загрузки курса: ${String(err)}`));
  }, [selectedCourseId, courseTreesById]);

  useEffect(() => {
    if (!activeAssignment) {
      setComments([]);
      return;
    }

    api
      .assignmentComments(activeAssignment.id)
      .then(setComments)
      .catch((err) => setMessage(`Ошибка загрузки комментариев: ${String(err)}`));
  }, [activeAssignment]);

  async function refreshData() {
    const [myCourses, mySubs, myStats] = await Promise.all([api.myCourses(), api.mySubmissions(), api.meStats()]);
    setCourses(myCourses);
    setSubmissions(mySubs);
    setStats(myStats);
  }

  async function onEnroll(event: FormEvent) {
    event.preventDefault();
    await api.enroll(enrollCode);
    setEnrollCode("");
    setMessage("Вы записались на курс");
    await refreshData();
  }

  async function onOpenAssignment(assignmentId: number) {
    const assignment = await api.assignment(assignmentId);
    if (assignment.assignment_type === "test") {
      navigate(`/student/tests/${assignmentId}`);
      return;
    }
    setActiveAssignment(assignment);
    if (assignment.assignment_type === "blocks") {
      setBlockProgram(createStarterProgram(parseBlockAssignmentConfig(assignment.content_payload)));
    } else {
      setSolution("print('solution')");
    }
  }

  async function onSubmitAssignment(event: FormEvent) {
    event.preventDefault();
    if (!activeAssignment) return;

    const payload =
      activeAssignment.assignment_type === "blocks" ? serializeBlockSubmission(blockProgram) : solution;

    await api.submitAssignment(activeAssignment.id, payload);
    setMessage("Решение отправлено");
    await refreshData();
  }

  async function onSendComment(event: FormEvent) {
    event.preventDefault();
    if (!activeAssignment || !newComment.trim()) return;

    await api.createComment({
      assignment_id: activeAssignment.id,
      content: newComment.trim(),
      parent_comment_id: null,
    });

    setNewComment("");
    setComments(await api.assignmentComments(activeAssignment.id));
  }

  return (
    <>
      <SectionCard
        title="Панель ученика"
        actions={
          <div className="tab-row">
            <button type="button" className={activeTab === "profile" ? "active" : ""} onClick={() => setActiveTab("profile")}>
              Профиль
            </button>
            <button
              type="button"
              className={activeTab === "assignments" ? "active" : ""}
              onClick={() => setActiveTab("assignments")}
            >
              Задания
            </button>
          </div>
        }
      >
        {message && <p className="hint">{message}</p>}
      </SectionCard>

      {activeTab === "profile" && (
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
            {courseProgressData.length === 0 && <EmptyState message="У вас пока нет активных курсов" />}
            <div className="student-course-list">
              {courseProgressData.map((course) => (
                <article key={course.courseId} className="student-course-card">
                  <div className="student-course-head">
                    <h3>{course.title}</h3>
                    <button
                      type="button"
                      className="student-course-open"
                      onClick={() => {
                        setSelectedCourseId(course.courseId);
                        setActiveTab("assignments");
                      }}
                    >
                      Перейти
                    </button>
                  </div>
                  <p className="student-course-topic">Последняя тема: {course.lastTopic}</p>
                  <p className="student-course-topic">Уроков в курсе: {course.lessonsCount}</p>
                  <div className="student-progress-track">
                    <div className="student-progress-fill" style={{ width: `${course.progress}%` }} />
                  </div>
                  <p className="student-progress-label">Пройдено: {course.progress}%</p>
                </article>
              ))}
            </div>
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

      {activeTab === "assignments" && (
        <>
          <div className="two-col">
            <SectionCard title="Курсы и задания">
              <form className="inline-form" onSubmit={onEnroll}>
                <input
                  placeholder="Введите код записи"
                  value={enrollCode}
                  onChange={(event) => setEnrollCode(event.target.value)}
                  required
                />
                <button type="submit">Записаться</button>
              </form>

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

              {!courseTree && <EmptyState message="Выберите курс" />}
              {courseTree && (
                <div className="tree-view">
                  {courseTree.modules.map((module) => (
                    <div key={module.id} className="tree-node">
                      <h3>{module.title}</h3>
                      {module.lessons.map((lesson) => (
                        <div key={lesson.id} className="tree-lesson">
                          <strong>{lesson.title}</strong>
                          <ul>
                            {lesson.assignments.map((assignment) => (
                              <li key={assignment.id}>
                                <button onClick={() => onOpenAssignment(assignment.id)}>
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

            <SectionCard title="Рабочая область">
              {!activeAssignment && <EmptyState message="Откройте задание в списке слева" />}
              {activeAssignment && (
                <>
                  <h3>{activeAssignment.title}</h3>
                  <p>{activeAssignment.description}</p>
                  <form className="form-grid" onSubmit={onSubmitAssignment}>
                    {activeAssignment.assignment_type === "blocks" ? (
                      <BlockEditor config={activeBlockConfig} value={blockProgram} onChange={setBlockProgram} />
                    ) : (
                      <textarea value={solution} onChange={(event) => setSolution(event.target.value)} rows={9} />
                    )}
                    <button className="primary" type="submit">
                      Отправить решение
                    </button>
                  </form>
                </>
              )}
            </SectionCard>
          </div>

          <div className="two-col">
            <SectionCard title="Комментарии к заданию">
              {!activeAssignment && <EmptyState message="Откройте задание, чтобы писать комментарии" />}
              {activeAssignment && (
                <>
                  <form className="inline-form" onSubmit={onSendComment}>
                    <input
                      placeholder="Комментарий для учителя"
                      value={newComment}
                      onChange={(event) => setNewComment(event.target.value)}
                    />
                    <button type="submit">Отправить</button>
                  </form>
                  <div className="comment-list">
                    {comments.map((comment) => (
                      <article key={comment.id} className="comment-item">
                        <strong>{comment.author_name}</strong>
                        <p>{comment.content}</p>
                      </article>
                    ))}
                  </div>
                </>
              )}
            </SectionCard>

            <SectionCard title="Быстрый доступ">
              {assignmentList.length === 0 && <EmptyState message="В этом курсе пока нет заданий" />}
              <div className="chip-row">
                {assignmentList.map((assignment) => (
                  <button key={assignment.id} className="chip" onClick={() => onOpenAssignment(assignment.id)}>
                    {assignment.title}
                  </button>
                ))}
              </div>
            </SectionCard>
          </div>
        </>
      )}
    </>
  );
}
