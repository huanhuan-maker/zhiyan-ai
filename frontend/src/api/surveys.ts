export type QuestionType = "SINGLE" | "MULTIPLE" | "SCALE" | "OPEN";
export interface Option { id: string; label: string }
export interface Question {
  id: string; type: QuestionType; text: string; required: boolean;
  allowFollowup: boolean; options: Option[]; min: number | null; max: number | null;
}
export interface Draft {
  title: string; description: string; privacyNotice: string; questions: Question[];
  perQuestionFollowupLimit: number; totalFollowupLimit: number;
}
export interface Version { id: number; versionNumber: number; publishedAt: string; status?: string }
export interface Survey {
  id: number; draft: Draft; status: string; revision: number;
  latestVersionId: number | null; updatedAt: string; versions?: Version[];
}
export type AnswerValue = string | string[] | number | null;
export interface PublicSurvey { versionId: number; versionNumber: number; survey: Draft; aiMode?: string }
export interface Session extends PublicSurvey {
  answers: Record<string, AnswerValue>; status: string; aiConsent: boolean;
}
export interface ResultOption extends Option { numerator: number; denominator: number; percentage: number }
export interface QuestionResult {
  questionId: string; text: string; type: QuestionType; denominator: number;
  total: number; missing: number; options: ResultOption[]; average?: number | null;
  responses?: { answerId: number; anonymousSessionId: number; text: string }[];
}
export interface Results {
  surveyId: number; versionId: number; versionNumber: number; title: string;
  completedCount: number; questions: QuestionResult[];
}
export const typeNames: Record<QuestionType, string> = {
  SINGLE: "单选题", MULTIPLE: "多选题", SCALE: "量表题", OPEN: "开放题",
};
export function newId(prefix: string) { return `${prefix}_${crypto.randomUUID()}`; }
export function newQuestion(type: QuestionType): Question {
  return {
    id: newId("q"), type, text: "", required: true, allowFollowup: false,
    options: type === "SINGLE" || type === "MULTIPLE"
      ? [{ id: newId("o"), label: "" }, { id: newId("o"), label: "" }] : [],
    min: type === "SCALE" ? 1 : null, max: type === "SCALE" ? 5 : null,
  };
}
export function newDraft(): Draft {
  return { title: "", description: "", privacyNotice: "本调查仅用于匿名调研分析。请勿填写姓名、联系方式或其他敏感个人信息。你可以自行选择是否参与；开放题原文将供发起者查看。", questions: [newQuestion("SINGLE")], perQuestionFollowupLimit: 1, totalFollowupLimit: 3 };
}
export interface ShareLink { versionId: number; versionNumber: number; url: string }
const shareKey = (id: number) => `zhiyan:shares:${id}`;
export function getShares(id: number): ShareLink[] {
  try {
    const data: unknown = JSON.parse(localStorage.getItem(shareKey(id)) ?? "[]");
    return Array.isArray(data) ? data.filter((x): x is ShareLink => typeof x?.versionId === "number" && typeof x?.versionNumber === "number" && typeof x?.url === "string") : [];
  } catch { return []; }
}
export function rememberShare(id: number, link: ShareLink): boolean {
  try { localStorage.setItem(shareKey(id), JSON.stringify([link, ...getShares(id).filter(x => x.versionId !== link.versionId)])); return true; }
  catch { return false; }
}
