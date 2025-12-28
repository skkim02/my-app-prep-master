import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

interface Editorial {
  title: string;
  content: string;
  date: string;
  link: string;
}

interface PrepItem {
  summary: string;
  sourceText: string;
}

interface AiPrepAnalysis {
  point1: PrepItem;
  reason: PrepItem;
  example: PrepItem;
  point2: PrepItem;
}

interface BestPractice {
  point1: string;
  reason: string;
  example: string;
  point2: string;
}

// 간단한 규칙 기반 PREP 분석 함수
function analyzePREP(content: string, title: string): AiPrepAnalysis {
  const sentences = content
    .split(/(?<=[.!?])\s+/)
    .filter((s) => s.trim().length > 10);

  // P1 (핵심 주장) - 제목에서 핵심 키워드를 포함한 첫 번째 문장 또는 첫 문단
  const titleKeywords = title
    .replace(/\[사설\]\s*/, "")
    .split(/[,\s]+/)
    .filter((w) => w.length > 2);

  let point1Source =
    sentences.find((s) =>
      titleKeywords.some((kw) => s.includes(kw))
    ) || sentences[0] || "";

  // R (근거) - "때문", "이유", "왜냐", "근거", "결함", "문제" 등을 포함한 문장
  const reasonKeywords = ["때문", "이유", "왜냐", "근거", "결함", "문제", "하자", "모호", "불명확", "포괄적"];
  let reasonSource =
    sentences.find((s) =>
      reasonKeywords.some((kw) => s.includes(kw))
    ) || sentences[1] || "";

  // E (사례) - 숫자, 퍼센트, 구체적 사례를 포함한 문장
  const examplePatterns = [/\d+/, /예를 들어/, /경우/, /사례/, /현장/, /실제/, /현재/, /구조/, /계약/, /기업/];
  let exampleSource =
    sentences.find((s) =>
      examplePatterns.some((p) => p.test(s))
    ) || sentences[2] || "";

  // P2 (최종 강조) - 마지막 문장 또는 "촉구", "필요", "해야" 등을 포함한 문장
  const conclusionKeywords = ["촉구", "필요", "해야", "바란다", "되어야", "요구", "결국", "따라서"];
  let point2Source =
    sentences.find((s) =>
      conclusionKeywords.some((kw) => s.includes(kw))
    ) || sentences[sentences.length - 1] || "";

  // 중복 제거 - 같은 문장이 여러 항목에 할당되지 않도록
  const usedSentences = new Set<string>();

  const getUniqueSentence = (preferred: string, fallbackIndex: number): string => {
    if (preferred && !usedSentences.has(preferred)) {
      usedSentences.add(preferred);
      return preferred;
    }
    for (let i = fallbackIndex; i < sentences.length; i++) {
      if (!usedSentences.has(sentences[i])) {
        usedSentences.add(sentences[i]);
        return sentences[i];
      }
    }
    return preferred;
  };

  point1Source = getUniqueSentence(point1Source, 0);
  reasonSource = getUniqueSentence(reasonSource, 1);
  exampleSource = getUniqueSentence(exampleSource, 2);
  point2Source = getUniqueSentence(point2Source, sentences.length - 1);

  return {
    point1: {
      summary: `이 사설은 "${title.replace(/\[사설\]\s*/, "").slice(0, 30)}..."에 대해 비판적 입장을 취하며, 근본적인 문제점을 지적합니다.`,
      sourceText: point1Source,
    },
    reason: {
      summary: "법/정책 자체의 모호함과 불명확한 기준이 현장 혼란을 야기한다는 점을 근거로 제시합니다.",
      sourceText: reasonSource,
    },
    example: {
      summary: "구체적인 조항, 현장 사례, 예상되는 결과 등을 통해 주장을 뒷받침합니다.",
      sourceText: exampleSource,
    },
    point2: {
      summary: "현재 접근법의 한계를 지적하며 근본적인 재검토를 촉구합니다.",
      sourceText: point2Source,
    },
  };
}

// Best Practice 생성 함수 - AI가 작성한 모범 PREP 답안
function generateBestPractice(
  title: string,
  aiAnalysis: AiPrepAnalysis
): BestPractice {
  const cleanTitle = title.replace(/\[사설\]\s*/, "");

  // 원문에서 핵심 키워드 추출
  const extractKeyPhrase = (text: string, maxLen: number = 50): string => {
    if (text.length <= maxLen) return text;
    const shortened = text.slice(0, maxLen);
    const lastSpace = shortened.lastIndexOf(" ");
    return lastSpace > 0 ? shortened.slice(0, lastSpace) + "..." : shortened + "...";
  };

  return {
    point1: `이 사설의 핵심 주장은 "${cleanTitle}"입니다. 필자는 현재 정책/법안의 근본적인 결함을 지적하며, 이에 대한 재검토가 필요하다고 주장합니다.`,
    reason: `주장의 근거로는 ${extractKeyPhrase(aiAnalysis.reason.sourceText, 80)}를 제시합니다. 이는 정책의 모호함과 불명확한 기준이 실제 현장에서 혼란을 야기할 수 있음을 보여줍니다.`,
    example: `구체적인 사례로 ${extractKeyPhrase(aiAnalysis.example.sourceText, 80)}를 들어 주장을 뒷받침합니다. 이러한 실제 사례는 이론적 비판을 넘어 현실적인 문제점을 부각시킵니다.`,
    point2: `결론적으로, 필자는 ${extractKeyPhrase(aiAnalysis.point2.sourceText, 60)}라고 강조합니다. 미봉책이 아닌 근본적인 해결책이 필요하다는 것이 이 사설의 핵심 메시지입니다.`,
  };
}

export async function GET() {
  try {
    // 한국경제 사설 목록 페이지 (URL 변경됨)
    const listUrl = "https://www.hankyung.com/opinion/0001";
    const listRes = await fetch(listUrl, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
        Accept:
          "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
        "Accept-Language": "ko-KR,ko;q=0.9,en-US;q=0.8,en;q=0.7",
      },
    });

    if (!listRes.ok) {
      throw new Error("Failed to fetch editorial list");
    }

    const listHtml = await listRes.text();
    const $list = cheerio.load(listHtml);

    // 최신 사설 링크 가져오기 - [사설] 태그가 있는 기사 찾기
    let articleLink: string | undefined;
    $list("a").each((_, el) => {
      const text = $list(el).text();
      const href = $list(el).attr("href");
      if (text.includes("[사설]") && href && href.includes("/article/")) {
        if (!articleLink) {
          articleLink = href;
        }
      }
    });

    if (!articleLink) {
      throw new Error("No editorial found");
    }

    const fullLink = articleLink.startsWith("http")
      ? articleLink
      : `https://www.hankyung.com${articleLink}`;

    // 사설 상세 페이지 크롤링
    const articleRes = await fetch(fullLink, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      },
    });

    if (!articleRes.ok) {
      throw new Error("Failed to fetch article");
    }

    const articleHtml = await articleRes.text();
    const $article = cheerio.load(articleHtml);

    // 제목 추출
    const title =
      $article("h1.headline").text().trim() ||
      $article(".article-headline").text().trim() ||
      $article("h1").first().text().trim();

    // 본문 추출 - #articletxt 내의 텍스트 추출
    let content = "";
    const articleBody = $article("#articletxt");

    if (articleBody.length) {
      // p 태그들의 텍스트 수집
      const paragraphs: string[] = [];
      articleBody.find("p").each((_, el) => {
        const text = $article(el).text().trim();
        // 광고 및 저작권 텍스트 제외
        if (text && !text.includes("ⓒ") && !text.includes("ADVERTISEMENT")) {
          paragraphs.push(text);
        }
      });

      if (paragraphs.length > 0) {
        content = paragraphs.join("\n\n");
      } else {
        // p 태그가 없으면 전체 텍스트 사용
        content = articleBody.text().trim();
      }
    }

    // 본문이 없으면 다른 선택자 시도
    if (!content) {
      content =
        $article(".article-body").text().trim() ||
        $article(".article-content").text().trim();
    }

    // 날짜 추출
    const dateText = $article(".txt-date").first().text().trim();
    const date = dateText || new Date().toLocaleDateString("ko-KR");

    const editorial: Editorial = {
      title: title || "제목을 찾을 수 없습니다",
      content: content || "본문을 찾을 수 없습니다",
      date: date,
      link: fullLink,
    };

    // PREP 분석 수행
    const aiAnalysis = analyzePREP(editorial.content, editorial.title);

    // Best Practice 생성
    const bestPractice = generateBestPractice(editorial.title, aiAnalysis);

    return NextResponse.json({
      editorial,
      aiAnalysis,
      bestPractice,
    });
  } catch (error) {
    console.error("Scraping error:", error);
    return NextResponse.json(
      {
        error: "사설을 가져오는데 실패했습니다. 잠시 후 다시 시도해주세요.",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
