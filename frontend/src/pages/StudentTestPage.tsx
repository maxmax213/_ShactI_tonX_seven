import { FormEvent, useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import { api } from "../app/api";
import type { Assignment, CommentView, TestContentPayload, TestQuestion } from "../app/types";
import { EmptyState } from "../components/EmptyState";
import { SectionCard } from "../components/SectionCard";

function normalizeQuestions(payload: TestContentPayload | null): TestQuestion[] {
  if (!payload || !Array.isArray(payload.questions)) return [];
  return payload.questions.filter(
    (question) => question && (typeof question.id === "string" || typeof question.id === "number"),
  );
}

export function StudentTestPage() {
  const { assignmentId } = useParams();
  const navigate = useNavigate();
  const [assignment, setAssignment] = useState<Assignment | null>(null);
  const [questions, setQuestions] = useState<TestQuestion[]>([]);
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [comments, setComments] = useState<CommentView[]>([]);
  const [newComment, setNewComment] = useState("");

  useEffect(() => {
    async function load() {
      if (!assignmentId) {
        setMessage("Тест не найден");
        setLoading(false);
        return;
      }

      setLoading(true);
      try {
        const data = await api.assignment(Number(assignmentId));
        if (data.assignment_type !== "test") {
          setMessage("Это задание не является тестом");
          navigate("/student", { replace: true });
          return;
        }

        setAssignment(data);

        let parsed: TestContentPayload | null = null;
        if (data.content_payload) {
          try {
            parsed = JSON.parse(data.content_payload) as TestContentPayload;
          } catch {
            parsed = null;
          }
        }

        const normalized = normalizeQuestions(parsed);
        setQuestions(normalized);
        if (normalized.length === 0) {
          setMessage("В тесте нет корректно настроенных вопросов");
        } else {
          setMessage("");
        }
      } catch (err) {
        setMessage(`Не удалось загрузить тест: ${getErrorMessage(err)}`);
      } finally {
        setLoading(false);
      }
    }

    load().catch((err) => setMessage(`Не удалось загрузить тест: ${getErrorMessage(err)}`));
  }, [assignmentId, navigate]);
  async function refreshComments(targetAssignmentId: number): Promise<void> {
    try {
      setComments(await api.assignmentComments(targetAssignmentId));
    } catch (err) {
      setMessage(`Не удалось загрузить комментарии: ${String(err)}`);
    }
  }

  useEffect(() => {
    if (!assignment?.id) {
      setComments([]);
      return;
    }

    setNewComment("");
    refreshComments(assignment.id).catch(() => null);
  }, [assignment?.id]);

  function setAnswer(questionId: string, value: unknown) {
    setAnswers((current) => ({ ...current, [questionId]: value }));
  }

  function toggleMultiAnswer(questionId: string, optionId: string) {
    setAnswers((current) => {
      const prev = current[questionId];
      const list = Array.isArray(prev) ? [...prev] : [];
      if (list.includes(optionId)) {
        return { ...current, [questionId]: list.filter((item) => item !== optionId) };
      }
      list.push(optionId);
      return { ...current, [questionId]: list };
    });
  }

  async function onSubmit(event: FormEvent) {
    event.preventDefault();
    if (!assignment) return;
    setSubmitting(true);
    setMessage("");

    try {
      await api.submitAssignment(assignment.id, JSON.stringify(answers));
      setMessage("Ответы отправлены");
    } catch (err) {
      setMessage(`Не удалось отправить тест: ${getErrorMessage(err)}`);
    } finally {
      setSubmitting(false);
    }
  }

  async function onSendComment(event: FormEvent) {
    event.preventDefault();
    if (!assignment?.id || !newComment.trim()) return;

    try {
      await api.createComment({
        assignment_id: assignment.id,
        content: newComment.trim(),
        parent_comment_id: null,
      });

      setNewComment("");
      await refreshComments(assignment.id);
    } catch (err) {
      setMessage(`РќРµ СѓРґР°Р»РѕСЃСЊ РѕС‚РїСЂР°РІРёС‚СЊ РєРѕРјРјРµРЅС‚Р°СЂРёР№: ${String(err)}`);
    }
  }

  if (loading) {
    return <div className="page-loading">Loading...</div>;
  }

  return (
    <SectionCard
      title={assignment ? assignment.title : "Тест"}
      actions={
        <button type="button" onClick={() => navigate("/student")}>
          Назад
        </button>
      }
    >
      {assignment?.description && <p>{assignment.description}</p>}
      {message && <p className="hint">{message}</p>}

      {questions.length === 0 && <EmptyState message="В тесте пока нет вопросов" />}

      {questions.length > 0 && (
        <form className="test-form" onSubmit={onSubmit}>
          {questions.map((question, index) => {
            const questionId = String(question.id);
            const answer = answers[questionId];
            const prompt = question.prompt || question.title || `Вопрос ${index + 1}`;

            return (
              <div key={questionId} className="test-question">
                <h3>{prompt}</h3>

                {question.type === "single_choice" && (
                  <div className="test-options">
                    {(question.options ?? []).map((option) => (
                      <label key={option.id} className="test-option">
                        <input
                          type="radio"
                          name={`q-${questionId}`}
                          value={option.id}
                          checked={answer === option.id}
                          onChange={() => setAnswer(questionId, option.id)}
                        />
                        <span>{option.text}</span>
                      </label>
                    ))}
                  </div>
                )}

                {question.type === "multiple_choice" && (
                  <div className="test-options">
                    {(question.options ?? []).map((option) => (
                      <label key={option.id} className="test-option">
                        <input
                          type="checkbox"
                          value={option.id}
                          checked={Array.isArray(answer) && answer.includes(option.id)}
                          onChange={() => toggleMultiAnswer(questionId, option.id)}
                        />
                        <span>{option.text}</span>
                      </label>
                    ))}
                  </div>
                )}

                {question.type === "true_false" && (
                  <div className="test-options">
                    <label className="test-option">
                      <input
                        type="radio"
                        name={`q-${questionId}`}
                        checked={answer === true}
                        onChange={() => setAnswer(questionId, true)}
                      />
                      <span>Верно</span>
                    </label>
                    <label className="test-option">
                      <input
                        type="radio"
                        name={`q-${questionId}`}
                        checked={answer === false}
                        onChange={() => setAnswer(questionId, false)}
                      />
                      <span>Неверно</span>
                    </label>
                  </div>
                )}

                {question.type === "short_text" && (
                  <input
                    className="test-input"
                    value={typeof answer === "string" ? answer : ""}
                    onChange={(event) => setAnswer(questionId, event.target.value)}
                    placeholder="Ваш ответ"
                  />
                )}
              </div>
            );
          })}

          <div className="test-actions">
            <button className="primary" type="submit" disabled={submitting}>
              {submitting ? "Отправка..." : "Отправить ответы"}
            </button>
          </div>
        </form>
      )}
      {assignment && (
        <>
          <div className="lesson-divider" />

          <div className="lesson-testing">
            <h3>Минифорум по тесту</h3>
            <form className="inline-form" onSubmit={onSendComment}>
              <input
                placeholder="Комментарий к тесту"
                value={newComment}
                onChange={(event) => setNewComment(event.target.value)}
              />
              <button type="submit">Отправить</button>
            </form>

            {comments.length === 0 && <p className="hint">Пока нет комментариев по этому тесту</p>}
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
    </SectionCard>
  );
}






