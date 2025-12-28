export interface Editorial {
  title: string;
  content: string;
  date: string;
  link: string;
}

export interface EditorialListItem {
  title: string;
  link: string;
  date: string;
}

export interface EditorialListResponse {
  editorials: EditorialListItem[];
}

export interface PrepItem {
  summary: string; // AI가 분석한 요약
  sourceText: string; // 원문에서 추출한 문장
}

export interface AiPrepAnalysis {
  point1: PrepItem; // P - 핵심 주장
  reason: PrepItem; // R - 근거
  example: PrepItem; // E - 사례/데이터
  point2: PrepItem; // P - 최종 강조점
}

export interface PrepAnalysis {
  point1: string; // P - 핵심 주장
  reason: string; // R - 근거
  example: string; // E - 사례/데이터
  point2: string; // P - 최종 강조점
}

export interface SavedAnalysis {
  id: string;
  editorial: Editorial;
  prep: PrepAnalysis;
  savedAt: string;
}

export interface BestPractice {
  point1: string;
  reason: string;
  example: string;
  point2: string;
}

export interface ScrapeResponse {
  editorial: Editorial;
  aiAnalysis: AiPrepAnalysis;
  bestPractice: BestPractice;
}
