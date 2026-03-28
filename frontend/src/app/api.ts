import type {
  Achievement,
  Assignment,
  AuthResponse,
  ChildDetail,
  ChildProgress,
  CommentRead,
  CommentView,
  Course,
  CourseTree,
  LeaderboardEntry,
  LessonSurvey,
  Submission,
  User,
  UserAchievement,
  UserStats,
} from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:8000/api";

let token: string | null = localStorage.getItem("access_token");

function stripHtml(source: string): string {
  return source.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim();
}

function pydanticDetailMessage(detail: unknown): string | null {
  if (typeof detail === "string") return detail;

  if (Array.isArray(detail) && detail.length > 0) {
    const first = detail[0] as {
      type?: string;
      msg?: string;
      loc?: unknown[];
      ctx?: { min_length?: number; max_length?: number };
    };

    const field = Array.isArray(first.loc) ? String(first.loc[first.loc.length - 1] ?? "") : "";

    if (first.type === "string_too_short" && field === "link_code") {
      const minLength = first.ctx?.min_length ?? 0;
      return `Код должен содержать минимум ${minLength} символа`;
    }

    if (typeof first.msg === "string" && first.msg.trim()) {
      return first.msg.trim();
    }
  }

  return null;
}

export function getErrorMessage(error: unknown, fallback = "Произошла ошибка"): string {
  const raw = String(error ?? "");
  const normalized = raw.startsWith("Error: ") ? raw.slice(7) : raw;

  try {
    const parsed = JSON.parse(normalized) as { detail?: unknown };
    const detailMessage = pydanticDetailMessage(parsed.detail);
    if (detailMessage) return detailMessage;
  } catch {
    // Ignore parsing issues and fall back to cleaned text.
  }

  const cleaned = stripHtml(normalized);
  return cleaned || fallback;
}

export function setToken(value: string | null): void {
  token = value;
  if (value) {
    localStorage.setItem("access_token", value);
  } else {
    localStorage.removeItem("access_token");
  }
}

async function apiRequest<T>(path: string, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers ?? {});
  headers.set("Content-Type", "application/json");
  if (token) {
    headers.set("Authorization", `Bearer ${token}`);
  }

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
  });

  if (!response.ok) {
    const body = await response.text();
    const contentType = response.headers.get("content-type") ?? "";

    if (contentType.includes("application/json")) {
      let parsedMessage: string | null = null;
      try {
        const parsed = JSON.parse(body) as { detail?: unknown };
        parsedMessage = pydanticDetailMessage(parsed.detail);
      } catch {
        parsedMessage = null;
      }
      throw new Error(parsedMessage || stripHtml(body) || `Request failed: ${response.status}`);
    }

    const cleaned = stripHtml(body);
    throw new Error(cleaned || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  register(payload: {
    email: string;
    password: string;
    full_name: string;
    role: "teacher" | "student" | "parent";
  }) {
    return apiRequest<AuthResponse>("/auth/register", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  login(payload: { email: string; password: string }) {
    return apiRequest<AuthResponse>("/auth/login", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  me() {
    return apiRequest<User>("/auth/me");
  },

  meStats() {
    return apiRequest<UserStats>("/users/me/stats");
  },

  listUsers(role?: string) {
    const query = role ? `?role=${role}` : "";
    return apiRequest<User[]>(`/users/${query}`);
  },

  linkParentByCode(linkCode: string) {
    return apiRequest<{ parent_id: number; student_id: number; link_code: string }>(
      "/users/parent-links/by-code",
      {
        method: "POST",
        body: JSON.stringify({ link_code: linkCode }),
      },
    );
  },

  myCourses() {
    return apiRequest<Course[]>("/courses/my");
  },

  createCourse(payload: { title: string; description?: string }) {
    return apiRequest<Course>("/courses/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  publishCourse(courseId: number, isPublished: boolean) {
    return apiRequest<Course>(`/courses/${courseId}/publish?is_published=${isPublished}`, {
      method: "POST",
    });
  },

  courseTree(courseId: number) {
    return apiRequest<CourseTree>(`/courses/${courseId}/tree`);
  },

  createModule(courseId: number, payload: { title: string; description?: string; order_index: number }) {
    return apiRequest<{ id: number; course_id: number; title: string; order_index: number }>(
      `/courses/${courseId}/modules`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  createLesson(moduleId: number, payload: { title: string; theory_text?: string; order_index: number }) {
    return apiRequest<{ id: number; module_id: number; title: string; order_index: number }>(
      `/courses/modules/${moduleId}/lessons`,
      {
        method: "POST",
        body: JSON.stringify(payload),
      },
    );
  },

  enroll(enrollCode: string) {
    return apiRequest<{ status: string }>(`/courses/enroll/${enrollCode}`, { method: "POST" });
  },

  assignment(id: number) {
    return apiRequest<Assignment>(`/assignments/${id}`);
  },

  createAssignment(payload: {
    lesson_id: number;
    title: string;
    description?: string;
    assignment_type: "blocks" | "python" | "test";
    max_score: number;
    is_auto_check: boolean;
    content_payload?: string;
  }) {
    return apiRequest<Assignment>("/assignments/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  submitAssignment(assignmentId: number, solutionPayload: string) {
    return apiRequest<Submission>(`/submissions/assignments/${assignmentId}`, {
      method: "POST",
      body: JSON.stringify({ solution_payload: solutionPayload }),
    });
  },

  assignmentSubmissions(assignmentId: number) {
    return apiRequest<Submission[]>(`/submissions/assignments/${assignmentId}`);
  },

  gradeSubmission(submissionId: number, score: number, teacherFeedback?: string) {
    return apiRequest<Submission>(`/submissions/${submissionId}/grade`, {
      method: "POST",
      body: JSON.stringify({ score, teacher_feedback: teacherFeedback }),
    });
  },

  mySubmissions() {
    return apiRequest<Submission[]>("/submissions/my");
  },

  assignmentComments(assignmentId: number) {
    return apiRequest<CommentView[]>(`/comments/assignment/${assignmentId}`);
  },

  createComment(payload: { assignment_id: number; content: string; parent_comment_id?: number | null }) {
    return apiRequest<CommentRead>("/comments/", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  leaderboard() {
    return apiRequest<LeaderboardEntry[]>("/gamification/leaderboard");
  },

  achievements() {
    return apiRequest<Achievement[]>("/gamification/achievements");
  },

  myAchievements() {
    return apiRequest<UserAchievement[]>("/gamification/achievements/my");
  },

  createAchievement(payload: {
    slug: string;
    title: string;
    description: string;
    rarity: "common" | "rare" | "epic";
    xp_reward: number;
  }) {
    return apiRequest<Achievement>("/gamification/achievements", {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  awardAchievement(achievementId: number, studentId: number) {
    return apiRequest<{ status: string }>(`/gamification/achievements/${achievementId}/award/${studentId}`, {
      method: "POST",
    });
  },

  childrenProgress() {
    return apiRequest<ChildProgress[]>("/parental/children");
  },

  childDetail(studentId: number) {
    return apiRequest<ChildDetail>(`/parental/children/${studentId}`);
  },

  submitLessonSurvey(
    lessonId: number,
    payload: {
      clarity_rating: number;
      difficulty_rating: number;
      interest_rating: number;
      comment?: string;
    },
  ) {
    return apiRequest<LessonSurvey>(`/surveys/lessons/${lessonId}`, {
      method: "POST",
      body: JSON.stringify(payload),
    });
  },

  myLessonSurveys() {
    return apiRequest<LessonSurvey[]>("/surveys/my");
  },
};
