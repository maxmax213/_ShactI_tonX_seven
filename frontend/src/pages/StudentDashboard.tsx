import { FormEvent, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";

import { api } from "../app/api";
import { createStarterProgram, parseBlockAssignmentConfig, serializeBlockSubmission } from "../app/blockProgramming";
import type {
  Assignment,
  CommentView,
  Course,
  CourseTree,
  LeaderboardEntry,
  Submission,
  UserAchievement,
  UserStats,
} from "../app/types";
import { BlockEditor } from "../components/BlockEditor";
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

export function StudentDashboard() {
  const navigate = useNavigate();
  const [courses, setCourses] = useState<Course[]>([]);
  const [selectedCourseId, setSelectedCourseId] = useState<number | null>(null);
  const [courseTree, setCourseTree] = useState<CourseTree | null>(null);
  const [activeAssignment, setActiveAssignment] = useState<Assignment | null>(null);
  const [solution, setSolution] = useState<string>("print('hello world')");
  const [blockProgram, setBlockProgram] = useState(createStarterProgram({ hints: [] }));
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [comments, setComments] = useState<CommentView[]>([]);
  const [newComment, setNewComment] = useState("");
  const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
  const [achievements, setAchievements] = useState<UserAchievement[]>([]);
  const [stats, setStats] = useState<UserStats | null>(null);
  const [enrollCode, setEnrollCode] = useState("");
  const [message, setMessage] = useState("");
  const [activeTab, setActiveTab] = useState<"profile" | "assignments">("profile");

  useEffect(() => {
    async function load() {
      const [myCourses, mySubs, board, myAchievements, myStats] = await Promise.all([
        api.myCourses(),
        api.mySubmissions(),
        api.leaderboard(),
        api.myAchievements(),
        api.meStats(),
      ]);
      setCourses(myCourses);
      setSubmissions(mySubs);
      setLeaderboard(board);
      setAchievements(myAchievements);
      setStats(myStats);
      if (myCourses.length > 0) {
        setSelectedCourseId(myCourses[0].id);
      }
    }

    load().catch((err) => setMessage(`Не удалось загрузить данные ученика: ${String(err)}`));
  }, []);

  useEffect(() => {
    if (!selectedCourseId) {
      setCourseTree(null);
      return;
    }

    api
      .courseTree(selectedCourseId)
      .then(setCourseTree)
      .catch((err) => setMessage(`Ошибка загрузки структуры курса: ${String(err)}`));
  }, [selectedCourseId]);

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

  const assignmentList = useMemo(() => {
    if (!courseTree) return [];
    return courseTree.modules.flatMap((module) => module.lessons.flatMap((lesson) => lesson.assignments));
  }, [courseTree]);

  const activeBlockConfig = useMemo(() => {
    if (!activeAssignment || activeAssignment.assignment_type !== "blocks") {
      return { hints: [] };
    }

    return parseBlockAssignmentConfig(activeAssignment.content_payload);
  }, [activeAssignment]);

  async function refreshData() {
    const [myCourses, mySubs, myStats] = await Promise.all([api.myCourses(), api.mySubmissions(), api.meStats()]);
    setCourses(myCourses);
    setSubmissions(mySubs);
    setStats(myStats);
    if (selectedCourseId) {
      setCourseTree(await api.courseTree(selectedCourseId));
    }
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
            <button
              type="button"
              className={activeTab === "profile" ? "active" : ""}
              onClick={() => setActiveTab("profile")}
            >
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
        {stats && (
          <p className="hint">
            Уровень {stats.level}, XP {stats.xp}, серия {stats.streak}, средний балл {stats.average_score}
          </p>
        )}
        {message && <p className="hint">{message}</p>}
      </SectionCard>

      {activeTab === "assignments" && (
        <>
          <div className="two-col">
            <SectionCard title="Запись и структура курса">
              <form className="inline-form" onSubmit={onEnroll}>
                <input
                  placeholder="Введите код записи"
                  value={enrollCode}
                  onChange={(event) => setEnrollCode(event.target.value)}
                  required
                />
                <button type="submit">Записаться</button>
              </form>

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

            <SectionCard title="Рабочая область задания">
              {!activeAssignment && <EmptyState message="Выберите задание в структуре курса" />}
              {activeAssignment && (
                <>
                  <h3>{activeAssignment.title}</h3>
                  <p>{activeAssignment.description}</p>
                  {activeAssignment.assignment_type === "blocks" && (
                    <p className="hint">
                      Соберите программу из блоков и получите Python-код как в упрощённом Scratch.
                    </p>
                  )}
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

            <SectionCard title="Быстрый доступ к заданиям">
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

      {activeTab === "profile" && (
        <>
          <SectionCard title="Мои результаты">
            <h3>Мои решения</h3>
            {submissions.length === 0 && <EmptyState message="Пока нет отправленных решений" />}
            {submissions.map((submission) => (
              <article key={submission.id} className="submission-item">
                <p>
                  Задание #{submission.assignment_id} / попытка {submission.attempt}
                </p>
                <p>
                  Статус: {submissionStatusLabel(submission.status)}, балл: {submission.score ?? "-"}
                </p>
              </article>
            ))}

            <h3>Мои ачивки</h3>
            {achievements.length === 0 && <EmptyState message="Пока нет ачивок" />}
            {achievements.map((achievement) => (
              <p key={achievement.achievement_id}>
                {achievement.title} ({achievement.rarity}) +{achievement.xp_reward} XP
              </p>
            ))}
          </SectionCard>

          <SectionCard title="Топ лидерборда">
            {leaderboard.slice(0, 10).map((entry) => (
              <div key={entry.user_id} className="leader-row">
                <span>
                  #{entry.rank} {entry.full_name}
                </span>
                <span>
                  ур. {entry.level} / {entry.xp} XP / серия {entry.streak}
                </span>
              </div>
            ))}
          </SectionCard>
        </>
      )}
    </>
  );
}
