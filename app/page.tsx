"use client";

import { useState, useMemo, useEffect, useCallback } from "react";
import {
  Editorial,
  AiPrepAnalysis,
  ScrapeResponse,
  BestPractice,
  EditorialListItem,
  EditorialListResponse,
  SavedAnalysis,
  PrepAnalysis,
} from "./types";

const STORAGE_KEY = "prep-master-saved-analyses";

type HighlightType = "point1" | "reason" | "example" | "point2";

const HIGHLIGHT_COLORS: Record<
  HighlightType,
  { bg: string; border: string; text: string }
> = {
  point1: { bg: "bg-red-100", border: "border-red-400", text: "text-red-700" },
  reason: {
    bg: "bg-orange-100",
    border: "border-orange-400",
    text: "text-orange-700",
  },
  example: {
    bg: "bg-green-100",
    border: "border-green-400",
    text: "text-green-700",
  },
  point2: {
    bg: "bg-purple-100",
    border: "border-purple-400",
    text: "text-purple-700",
  },
};

const PREP_LABELS: Record<
  HighlightType,
  { letter: string; name: string; color: string }
> = {
  point1: { letter: "P", name: "핵심 주장", color: "bg-red-500" },
  reason: { letter: "R", name: "근거", color: "bg-orange-500" },
  example: { letter: "E", name: "사례/데이터", color: "bg-green-500" },
  point2: { letter: "P", name: "최종 강조", color: "bg-purple-500" },
};

export default function Home() {
  // 사설 목록 관련 상태
  const [editorialList, setEditorialList] = useState<EditorialListItem[]>([]);
  const [isLoadingList, setIsLoadingList] = useState(false);
  const [selectedEditorial, setSelectedEditorial] =
    useState<EditorialListItem | null>(null);

  // 사설 상세 관련 상태
  const [editorial, setEditorial] = useState<Editorial | null>(null);
  const [aiAnalysis, setAiAnalysis] = useState<AiPrepAnalysis | null>(null);
  const [bestPractice, setBestPractice] = useState<BestPractice | null>(null);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);

  const [error, setError] = useState<string | null>(null);
  const [activeHighlight, setActiveHighlight] = useState<HighlightType | null>(
    null
  );

  // 저장 관련 상태
  const [savedAnalyses, setSavedAnalyses] = useState<SavedAnalysis[]>([]);
  const [showSavedList, setShowSavedList] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);

  // LocalStorage에서 저장된 분석 불러오기
  useEffect(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved) {
      try {
        setSavedAnalyses(JSON.parse(saved));
      } catch (e) {
        console.error("Failed to parse saved analyses:", e);
      }
    }
  }, []);

  // 현재 분석 저장하기
  const saveCurrentAnalysis = useCallback(() => {
    if (!editorial || !aiAnalysis) return;

    const prep: PrepAnalysis = {
      point1: aiAnalysis.point1.sourceText,
      reason: aiAnalysis.reason.sourceText,
      example: aiAnalysis.example.sourceText,
      point2: aiAnalysis.point2.sourceText,
    };

    const newSaved: SavedAnalysis = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      editorial,
      prep,
      savedAt: new Date().toISOString(),
    };

    const updated = [newSaved, ...savedAnalyses];
    setSavedAnalyses(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));

    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2000);
  }, [editorial, aiAnalysis, savedAnalyses]);

  // 저장된 분석 삭제하기
  const deleteAnalysis = useCallback((id: string) => {
    const updated = savedAnalyses.filter((a) => a.id !== id);
    setSavedAnalyses(updated);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  }, [savedAnalyses]);

  // 이미 저장된 분석인지 확인
  const isAlreadySaved = useMemo(() => {
    if (!editorial) return false;
    return savedAnalyses.some((a) => a.editorial.link === editorial.link);
  }, [editorial, savedAnalyses]);

  // 사설 목록 가져오기
  const fetchEditorialList = async () => {
    setIsLoadingList(true);
    setError(null);
    setEditorialList([]);
    setSelectedEditorial(null);
    setEditorial(null);
    setAiAnalysis(null);
    setBestPractice(null);

    try {
      const res = await fetch("/api/scrape");
      const data: EditorialListResponse = await res.json();

      if (!res.ok) {
        throw new Error(
          (data as unknown as { error: string }).error ||
            "사설 목록을 가져오는데 실패했습니다."
        );
      }

      setEditorialList(data.editorials);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setIsLoadingList(false);
    }
  };

  // 사설 상세 가져오기
  const fetchEditorialDetail = async (item: EditorialListItem) => {
    setIsLoadingDetail(true);
    setError(null);
    setSelectedEditorial(item);

    try {
      const res = await fetch(
        `/api/scrape?url=${encodeURIComponent(item.link)}`
      );
      const data: ScrapeResponse = await res.json();

      if (!res.ok) {
        throw new Error(
          (data as unknown as { error: string }).error ||
            "사설을 가져오는데 실패했습니다."
        );
      }

      setEditorial(data.editorial);
      setAiAnalysis(data.aiAnalysis);
      setBestPractice(data.bestPractice);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "알 수 없는 오류가 발생했습니다."
      );
    } finally {
      setIsLoadingDetail(false);
    }
  };

  // 날짜별로 그룹화
  const groupedEditorials = useMemo(() => {
    const groups: Record<string, EditorialListItem[]> = {};
    editorialList.forEach((item) => {
      if (!groups[item.date]) {
        groups[item.date] = [];
      }
      groups[item.date].push(item);
    });
    return groups;
  }, [editorialList]);

  // 하이라이트된 본문 생성
  const highlightedContent = useMemo(() => {
    if (!editorial || !aiAnalysis) return null;

    const content = editorial.content;
    const highlights: { text: string; type: HighlightType }[] = [
      { text: aiAnalysis.point1.sourceText, type: "point1" },
      { text: aiAnalysis.reason.sourceText, type: "reason" },
      { text: aiAnalysis.example.sourceText, type: "example" },
      { text: aiAnalysis.point2.sourceText, type: "point2" },
    ];

    const paragraphs = content.split("\n\n");

    return paragraphs.map((paragraph, pIdx) => {
      let result: React.ReactNode[] = [];
      let remainingText = paragraph;
      let keyIndex = 0;

      for (const highlight of highlights) {
        if (!highlight.text || !remainingText.includes(highlight.text))
          continue;

        const parts = remainingText.split(highlight.text);
        if (parts.length > 1) {
          if (parts[0]) {
            result.push(<span key={`${pIdx}-${keyIndex++}`}>{parts[0]}</span>);
          }

          const colors = HIGHLIGHT_COLORS[highlight.type];
          const isActive = activeHighlight === highlight.type;
          result.push(
            <span
              key={`${pIdx}-${keyIndex++}`}
              className={`relative cursor-pointer border-b-2 ${colors.border} ${
                isActive ? `${colors.bg} px-1 rounded` : ""
              } transition-all duration-200`}
              onMouseEnter={() => setActiveHighlight(highlight.type)}
              onMouseLeave={() => setActiveHighlight(null)}
            >
              {highlight.text}
              {isActive && (
                <span
                  className={`absolute -top-6 left-0 ${colors.bg} ${colors.text} text-xs px-2 py-1 rounded shadow-lg whitespace-nowrap z-10`}
                >
                  {PREP_LABELS[highlight.type].letter} -{" "}
                  {PREP_LABELS[highlight.type].name}
                </span>
              )}
            </span>
          );

          remainingText = parts.slice(1).join(highlight.text);
        }
      }

      if (remainingText) {
        result.push(<span key={`${pIdx}-${keyIndex++}`}>{remainingText}</span>);
      }

      return (
        <p
          key={pIdx}
          className="mb-4 text-slate-700 dark:text-slate-300 leading-relaxed"
        >
          {result.length > 0 ? result : paragraph}
        </p>
      );
    });
  }, [editorial, aiAnalysis, activeHighlight]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-slate-100 dark:from-slate-900 dark:to-slate-800">
      {/* 헤더 */}
      <header className="border-b border-slate-200 bg-white/80 backdrop-blur-sm dark:border-slate-700 dark:bg-slate-900/80">
        <div className="mx-auto max-w-7xl px-4 py-6">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
                PREP Master
              </h1>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                한경 사설 분석기 - 읽기만 하는 사설에서, 내 논리로 만드는 사설로
              </p>
            </div>
            <button
              onClick={() => setShowSavedList(!showSavedList)}
              className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                showSavedList
                  ? "bg-blue-600 text-white"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200 dark:bg-slate-700 dark:text-slate-300 dark:hover:bg-slate-600"
              }`}
            >
              <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
              </svg>
              저장됨 ({savedAnalyses.length})
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">
        {/* 사설 목록 가져오기 버튼 */}
        <div className="mb-8 text-center">
          <button
            onClick={fetchEditorialList}
            disabled={isLoadingList}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-6 py-3 font-semibold text-white shadow-lg transition-all hover:bg-blue-700 hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-50"
          >
            {isLoadingList ? (
              <>
                <svg
                  className="h-5 w-5 animate-spin"
                  fill="none"
                  viewBox="0 0 24 24"
                >
                  <circle
                    className="opacity-25"
                    cx="12"
                    cy="12"
                    r="10"
                    stroke="currentColor"
                    strokeWidth="4"
                  />
                  <path
                    className="opacity-75"
                    fill="currentColor"
                    d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                  />
                </svg>
                목록 가져오는 중...
              </>
            ) : (
              <>
                <svg
                  className="h-5 w-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                사설 목록 가져오기
              </>
            )}
          </button>
        </div>

        {/* 에러 메시지 */}
        {error && (
          <div className="mb-8 rounded-lg bg-red-50 p-4 text-center text-red-600 dark:bg-red-900/20 dark:text-red-400">
            {error}
          </div>
        )}

        {/* 저장된 분석 목록 */}
        {showSavedList && (
          <div className="mb-8">
            <div className="rounded-xl bg-white p-6 shadow-lg dark:bg-slate-800">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                  저장된 분석 ({savedAnalyses.length}개)
                </h2>
                <button
                  onClick={() => setShowSavedList(false)}
                  className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300"
                >
                  <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {savedAnalyses.length === 0 ? (
                <div className="text-center py-8 text-slate-500 dark:text-slate-400">
                  <svg className="h-12 w-12 mx-auto mb-3 opacity-50" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                  </svg>
                  <p>저장된 분석이 없습니다.</p>
                  <p className="text-sm mt-1">사설을 분석한 후 저장해보세요!</p>
                </div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {savedAnalyses.map((saved) => (
                    <div
                      key={saved.id}
                      className="flex items-start justify-between p-4 rounded-lg bg-slate-50 dark:bg-slate-700 hover:bg-slate-100 dark:hover:bg-slate-600 transition-colors"
                    >
                      <div className="flex-1 min-w-0">
                        <h3 className="font-medium text-slate-900 dark:text-white truncate">
                          {saved.editorial.title}
                        </h3>
                        <div className="flex items-center gap-3 mt-1 text-sm text-slate-500 dark:text-slate-400">
                          <span>{saved.editorial.date}</span>
                          <span>•</span>
                          <span>저장: {new Date(saved.savedAt).toLocaleDateString("ko-KR")}</span>
                        </div>
                        <a
                          href={saved.editorial.link}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-blue-600 hover:underline dark:text-blue-400 mt-1 inline-block"
                        >
                          원문 보기 →
                        </a>
                      </div>
                      <button
                        onClick={() => deleteAnalysis(saved.id)}
                        className="ml-3 p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20 rounded-lg transition-colors"
                        title="삭제"
                      >
                        <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* 사설 목록 (날짜별 그룹화) */}
        {editorialList.length > 0 && !editorial && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-slate-900 dark:text-white mb-4">
              사설 목록 ({editorialList.length}개)
            </h2>
            <div className="space-y-6">
              {Object.entries(groupedEditorials)
                .sort(([a], [b]) => b.localeCompare(a))
                .map(([date, items]) => (
                  <div key={date}>
                    <h3 className="text-sm font-semibold text-slate-500 dark:text-slate-400 mb-2 flex items-center gap-2">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                      {date}
                    </h3>
                    <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                      {items.map((item) => (
                        <button
                          key={item.link}
                          onClick={() => fetchEditorialDetail(item)}
                          disabled={isLoadingDetail}
                          className={`text-left rounded-lg border p-4 transition-all hover:shadow-md ${
                            selectedEditorial?.link === item.link
                              ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20"
                              : "border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-800 hover:border-blue-300"
                          } ${
                            isLoadingDetail &&
                            selectedEditorial?.link === item.link
                              ? "opacity-50"
                              : ""
                          }`}
                        >
                          <p className="font-medium text-slate-900 dark:text-white text-sm line-clamp-2">
                            {item.title}
                          </p>
                          {isLoadingDetail &&
                            selectedEditorial?.link === item.link && (
                              <p className="text-xs text-blue-600 mt-2">
                                로딩 중...
                              </p>
                            )}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* 메인 콘텐츠 - 2단 레이아웃 */}
        {editorial && aiAnalysis && bestPractice && (
          <>
            {/* 뒤로가기 + 저장 버튼 */}
            <div className="mb-4 flex items-center justify-between">
              <button
                onClick={() => {
                  setEditorial(null);
                  setAiAnalysis(null);
                  setBestPractice(null);
                  setSelectedEditorial(null);
                }}
                className="inline-flex items-center gap-2 text-sm text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              >
                <svg
                  className="h-4 w-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M15 19l-7-7 7-7"
                  />
                </svg>
                목록으로 돌아가기
              </button>

              <button
                onClick={saveCurrentAnalysis}
                disabled={isAlreadySaved}
                className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-all ${
                  saveSuccess
                    ? "bg-green-500 text-white"
                    : isAlreadySaved
                    ? "bg-slate-200 text-slate-500 cursor-not-allowed dark:bg-slate-700 dark:text-slate-400"
                    : "bg-blue-600 text-white hover:bg-blue-700"
                }`}
              >
                {saveSuccess ? (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    저장됨!
                  </>
                ) : isAlreadySaved ? (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    이미 저장됨
                  </>
                ) : (
                  <>
                    <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 5a2 2 0 012-2h10a2 2 0 012 2v16l-7-3.5L5 21V5z" />
                    </svg>
                    분석 저장
                  </>
                )}
              </button>
            </div>

            <div className="grid gap-8 lg:grid-cols-2">
              {/* 좌측: 사설 원문 (하이라이트 포함) */}
              <div className="rounded-xl bg-white p-6 shadow-lg dark:bg-slate-800">
                <div className="mb-4 flex items-start justify-between">
                  <div>
                    <span className="inline-block rounded-full bg-blue-100 px-3 py-1 text-xs font-medium text-blue-800 dark:bg-blue-900 dark:text-blue-200">
                      한국경제 사설
                    </span>
                    <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
                      {editorial.date}
                    </p>
                  </div>
                  <a
                    href={editorial.link}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-sm text-blue-600 hover:underline dark:text-blue-400"
                  >
                    원문 보기 &rarr;
                  </a>
                </div>
                <h2 className="mb-4 text-xl font-bold text-slate-900 dark:text-white">
                  {editorial.title}
                </h2>

                {/* 하이라이트 범례 */}
                <div className="mb-4 flex flex-wrap gap-2 rounded-lg bg-slate-50 p-3 dark:bg-slate-700">
                  <span className="text-xs text-slate-500 dark:text-slate-400 mr-2">
                    색상 범례:
                  </span>
                  {(Object.keys(PREP_LABELS) as HighlightType[]).map((type) => (
                    <span
                      key={type}
                      className={`flex items-center gap-1 text-xs cursor-pointer transition-opacity ${
                        activeHighlight && activeHighlight !== type
                          ? "opacity-50"
                          : ""
                      }`}
                      onMouseEnter={() => setActiveHighlight(type)}
                      onMouseLeave={() => setActiveHighlight(null)}
                    >
                      <span
                        className={`${PREP_LABELS[type].color} text-white w-4 h-4 rounded-full flex items-center justify-center text-[10px]`}
                      >
                        {PREP_LABELS[type].letter}
                      </span>
                      <span className="text-slate-600 dark:text-slate-300">
                        {PREP_LABELS[type].name}
                      </span>
                    </span>
                  ))}
                </div>

                {/* 하이라이트된 본문 */}
                <div className="prose prose-slate max-h-[500px] overflow-y-auto dark:prose-invert pr-2">
                  {highlightedContent}
                </div>
              </div>

              {/* 우측: AI 분석 + Best Practice */}
              <div className="space-y-6">
                {/* AI 분석 결과 */}
                <div className="rounded-xl bg-gradient-to-br from-blue-50 to-indigo-50 p-6 shadow-lg dark:from-slate-800 dark:to-slate-700">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                    <svg
                      className="h-5 w-5 text-blue-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                      />
                    </svg>
                    AI 분석 결과
                  </h3>
                  <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
                    사설에서 추출한 PREP 구조입니다. 밑줄 친 부분이 해당 내용의
                    출처입니다.
                  </p>

                  <div className="space-y-4">
                    {(Object.keys(PREP_LABELS) as HighlightType[]).map(
                      (type) => {
                        const label = PREP_LABELS[type];
                        const analysis = aiAnalysis[type];
                        const colors = HIGHLIGHT_COLORS[type];

                        return (
                          <div
                            key={type}
                            className={`rounded-lg bg-white p-4 shadow-sm dark:bg-slate-800 border-l-4 ${colors.border} cursor-pointer transition-all ${
                              activeHighlight === type
                                ? "ring-2 ring-offset-2 ring-blue-500"
                                : ""
                            }`}
                            onMouseEnter={() => setActiveHighlight(type)}
                            onMouseLeave={() => setActiveHighlight(null)}
                          >
                            <div className="flex items-center gap-2 mb-2">
                              <span
                                className={`${label.color} text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold`}
                              >
                                {label.letter}
                              </span>
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {label.name}
                              </span>
                            </div>
                            <p className="text-sm text-slate-700 dark:text-slate-300 mb-2">
                              {analysis.summary}
                            </p>
                            <div
                              className={`text-xs ${colors.bg} ${colors.text} p-2 rounded border ${colors.border}`}
                            >
                              <span className="font-medium">원문:</span> &ldquo;
                              {analysis.sourceText.slice(0, 100)}
                              {analysis.sourceText.length > 100 ? "..." : ""}
                              &rdquo;
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>
                </div>

                {/* Best Practice - AI 작성 예시 */}
                <div className="rounded-xl bg-gradient-to-br from-emerald-50 to-teal-50 p-6 shadow-lg dark:from-slate-800 dark:to-slate-700">
                  <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
                    <svg
                      className="h-5 w-5 text-emerald-600"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z"
                      />
                    </svg>
                    Best Practice - AI 작성 예시
                  </h3>
                  <p className="mb-4 text-sm text-slate-600 dark:text-slate-400">
                    아래는 AI가 작성한 모범 PREP 분석입니다. 이 예시를 참고하여
                    본인만의 분석을 연습해보세요.
                  </p>

                  <div className="space-y-4">
                    {(Object.keys(PREP_LABELS) as HighlightType[]).map(
                      (type) => {
                        const label = PREP_LABELS[type];
                        const colors = HIGHLIGHT_COLORS[type];
                        const practiceText = bestPractice[type];

                        return (
                          <div
                            key={type}
                            className={`rounded-lg bg-white p-4 shadow-sm dark:bg-slate-800 border-l-4 ${colors.border}`}
                          >
                            <div className="flex items-center gap-2 mb-3">
                              <span
                                className={`${label.color} text-white w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold`}
                              >
                                {label.letter}
                              </span>
                              <span className="font-semibold text-slate-900 dark:text-white">
                                {label.name}
                              </span>
                            </div>
                            <div className="bg-slate-50 dark:bg-slate-700 rounded-lg p-3">
                              <p className="text-sm text-slate-700 dark:text-slate-300 leading-relaxed">
                                {practiceText}
                              </p>
                            </div>
                          </div>
                        );
                      }
                    )}
                  </div>

                  {/* 연습 팁 */}
                  <div className="mt-6 rounded-lg bg-white/50 dark:bg-slate-700/50 p-4 border border-emerald-200 dark:border-slate-600">
                    <h4 className="font-semibold text-emerald-700 dark:text-emerald-400 mb-2 flex items-center gap-2">
                      <svg
                        className="h-4 w-4"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          strokeWidth={2}
                          d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                        />
                      </svg>
                      연습 팁
                    </h4>
                    <ul className="text-sm text-slate-600 dark:text-slate-400 space-y-1">
                      <li>1. 위의 AI 분석 결과에서 원문 출처를 확인하세요.</li>
                      <li>2. Best Practice 예시를 읽고 구조를 파악하세요.</li>
                      <li>3. 노트에 본인만의 PREP 분석을 작성해보세요.</li>
                      <li>4. AI 예시와 비교하며 개선점을 찾아보세요.</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          </>
        )}

        {/* 초기 상태 안내 */}
        {editorialList.length === 0 && !isLoadingList && !error && (
          <div className="text-center">
            <div className="mx-auto max-w-md rounded-xl bg-white p-8 shadow-lg dark:bg-slate-800">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100 dark:bg-blue-900">
                <svg
                  className="h-8 w-8 text-blue-600 dark:text-blue-400"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                  />
                </svg>
              </div>
              <h2 className="mb-2 text-xl font-bold text-slate-900 dark:text-white">
                시작하기
              </h2>
              <p className="text-slate-600 dark:text-slate-400">
                위의 &quot;사설 목록 가져오기&quot; 버튼을 클릭하여 한국경제
                사설 목록을 불러오고, 분석할 사설을 선택하세요.
              </p>
            </div>
          </div>
        )}
      </main>

      {/* 푸터 */}
      <footer className="mt-auto border-t border-slate-200 bg-white py-6 dark:border-slate-700 dark:bg-slate-900">
        <div className="mx-auto max-w-7xl px-4 text-center text-sm text-slate-500 dark:text-slate-400">
          PREP Master v3 - 논리적 글쓰기 훈련 도구
        </div>
      </footer>
    </div>
  );
}
