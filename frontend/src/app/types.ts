export type Role = "teacher" | "student" | "parent";

export interface User {
  id: number;
  email: string;
  full_name: string;
  role: Role;
  xp: number;
  level: number;
  streak: number;
  parent_link_code: string | null;
}

export interface AuthResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface Course {
  id: number;
  teacher_id: number;
  title: string;
  description: string | null;
  enroll_code: string;
  is_published: boolean;
}

export interface CourseTree {
  id: number;
  title: string;
  description: string | null;
  enroll_code: string;
  is_published: boolean;
  modules: CourseModule[];
}

export interface CourseModule {
  id: number;
  title: string;
  description: string | null;
  order_index: number;
  lessons: Lesson[];
}

export interface Lesson {
  id: number;
  title: string;
  theory_text: string | null;
  order_index: number;
  assignments: AssignmentBrief[];
}

export interface LessonSurvey {
  id: number;
  lesson_id: number;
  student_id: number;
  clarity_rating: number;
  difficulty_rating: number;
  interest_rating: number;
  comment: string | null;
}

export type TestQuestionType = "single_choice" | "multiple_choice" | "true_false" | "short_text";

export interface TestOption {
  id: string;
  text: string;
}

export interface TestQuestion {
  id: string;
  type: TestQuestionType;
  prompt?: string;
  title?: string;
  options?: TestOption[];
  correct?: string | string[] | boolean;
}

export interface TestContentPayload {
  questions: TestQuestion[];
}

export interface AssignmentBrief {
  id: number;
  title: string;
  assignment_type: "blocks" | "python" | "test";
  max_score: number;
}

export interface Assignment {
  id: number;
  lesson_id: number;
  title: string;
  description: string | null;
  assignment_type: "blocks" | "python" | "test";
  max_score: number;
  is_auto_check: boolean;
  content_payload: string | null;
}

export interface CourseParticipant {
  id: number;
  full_name: string;
  email: string;
  xp: number;
  level: number;
  streak: number;
}

export interface Submission {
  id: number;
  assignment_id: number;
  student_id: number;
  attempt: number;
  solution_payload: string;
  status: "pending" | "checked" | "needs_rework";
  score: number | null;
  teacher_feedback: string | null;
  created_at: string;
  updated_at: string;
}

export interface CommentView {
  id: number;
  assignment_id: number;
  author_id: number;
  author_name: string;
  parent_comment_id: number | null;
  content: string;
  created_at: string;
}

export interface CommentRead {
  id: number;
  assignment_id: number;
  author_id: number;
  parent_comment_id: number | null;
  content: string;
  created_at: string;
  updated_at: string;
}

export interface LeaderboardEntry {
  user_id: number;
  full_name: string;
  xp: number;
  level: number;
  achievement_count: number;
  streak: number;
  rank: number;
}

export interface Achievement {
  id: number;
  slug: string;
  title: string;
  description: string;
  rarity: "common" | "rare" | "epic";
  xp_reward: number;
}

export interface UserAchievement {
  achievement_id: number;
  slug: string;
  title: string;
  rarity: "common" | "rare" | "epic";
  xp_reward: number;
}

export interface UserStats {
  user_id: number;
  full_name: string;
  xp: number;
  level: number;
  streak: number;
  total_submissions: number;
  average_score: number;
}

export interface ChildProgress {
  student_id: number;
  student_name: string;
  xp: number;
  level: number;
  streak: number;
  achievements_count: number;
  active_courses_count: number;
  total_submissions: number;
  average_score: number;
}

export interface ChildAchievement {
  achievement_id: number;
  slug: string;
  title: string;
  description: string;
  rarity: "common" | "rare" | "epic";
  xp_reward: number;
}

export interface ChildSubmissionInfo {
  submission_id: number;
  assignment_id: number;
  title: string;
  assignment_type: "blocks" | "python" | "test";
  attempt: number;
  status: "pending" | "checked" | "needs_rework";
  score: number | null;
  max_score: number;
  updated_at: string;
}

export interface ChildDetail {
  student_id: number;
  student_name: string;
  xp: number;
  level: number;
  streak: number;
  achievements_count: number;
  active_courses_count: number;
  total_submissions: number;
  average_score: number;
  achievements: ChildAchievement[];
  submissions: ChildSubmissionInfo[];
}
