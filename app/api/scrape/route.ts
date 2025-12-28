import { NextResponse } from "next/server";
import * as cheerio from "cheerio";

interface Editorial {
  title: string;
  content: string;
  date: string;
  link: string;
}

interface EditorialListItem {
  title: string;
  link: string;
  date: string;
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

  const titleKeywords = title
    .replace(/\[사설\]\s*/, "")
    .split(/[,\s]+/)
    .filter((w) => w.length > 2);

  let point1Source =
    sentences.find((s) => titleKeywords.some((kw) => s.includes(kw))) ||
    sentences[0] ||
    "";

  const reasonKeywords = [
    "때문",
    "이유",
    "왜냐",
    "근거",
    "결함",
    "문제",
    "하자",
    "모호",
    "불명확",
    "포괄적",
  ];
  let reasonSource =
    sentences.find((s) => reasonKeywords.some((kw) => s.includes(kw))) ||
    sentences[1] ||
    "";

  const examplePatterns = [
    /\d+/,
    /예를 들어/,
    /경우/,
    /사례/,
    /현장/,
    /실제/,
    /현재/,
    /구조/,
    /계약/,
    /기업/,
  ];
  let exampleSource =
    sentences.find((s) => examplePatterns.some((p) => p.test(s))) ||
    sentences[2] ||
    "";

  const conclusionKeywords = [
    "촉구",
    "필요",
    "해야",
    "바란다",
    "되어야",
    "요구",
    "결국",
    "따라서",
  ];
  let point2Source =
    sentences.find((s) => conclusionKeywords.some((kw) => s.includes(kw))) ||
    sentences[sentences.length - 1] ||
    "";

  const usedSentences = new Set<string>();

  const getUniqueSentence = (
    preferred: string,
    fallbackIndex: number
  ): string => {
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
      summary: `이 사설은 "${title
        .replace(/\[사설\]\s*/, "")
        .slice(0, 30)}..."에 대해 비판적 입장을 취하며, 근본적인 문제점을 지적합니다.`,
      sourceText: point1Source,
    },
    reason: {
      summary:
        "법/정책 자체의 모호함과 불명확한 기준이 현장 혼란을 야기한다는 점을 근거로 제시합니다.",
      sourceText: reasonSource,
    },
    example: {
      summary:
        "구체적인 조항, 현장 사례, 예상되는 결과 등을 통해 주장을 뒷받침합니다.",
      sourceText: exampleSource,
    },
    point2: {
      summary: "현재 접근법의 한계를 지적하며 근본적인 재검토를 촉구합니다.",
      sourceText: point2Source,
    },
  };
}

// Best Practice 생성 함수 - 다른 사람에게 주장하듯이 작성 (사설 문체 유지)
function generateBestPractice(
  title: string,
  aiAnalysis: AiPrepAnalysis
): BestPractice {
  const cleanTitle = title.replace(/\[사설\]\s*/, "");

  return {
    point1: `"${cleanTitle}" 문제를 짚어보자. ${aiAnalysis.point1.sourceText}`,
    reason: `왜 그런가. ${aiAnalysis.reason.sourceText}`,
    example: `실제로 ${aiAnalysis.example.sourceText}`,
    point2: `결론적으로 ${aiAnalysis.point2.sourceText}`,
  };
}

// 사설 목록 가져오기
async function fetchEditorialList(): Promise<EditorialListItem[]> {
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

  const editorials: EditorialListItem[] = [];
  const seenLinks = new Set<string>();

  $list("a").each((_, el) => {
    const text = $list(el).text().trim();
    const href = $list(el).attr("href");

    if (
      text.includes("[사설]") &&
      href &&
      href.includes("/article/") &&
      !seenLinks.has(href)
    ) {
      seenLinks.add(href);

      // 날짜 추출 (URL에서 YYYYMMDD 형식)
      const dateMatch = href.match(/\/(\d{4})(\d{2})(\d{2})/);
      const date = dateMatch
        ? `${dateMatch[1]}.${dateMatch[2]}.${dateMatch[3]}`
        : new Date().toLocaleDateString("ko-KR");

      editorials.push({
        title: text,
        link: href.startsWith("http") ? href : `https://www.hankyung.com${href}`,
        date,
      });
    }
  });

  return editorials;
}

// 사설 상세 가져오기
async function fetchEditorialDetail(articleUrl: string): Promise<Editorial> {
  const articleRes = await fetch(articleUrl, {
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

  const title =
    $article("h1.headline").text().trim() ||
    $article(".article-headline").text().trim() ||
    $article("h1").first().text().trim();

  let content = "";
  const articleBody = $article("#articletxt");

  if (articleBody.length) {
    const paragraphs: string[] = [];
    articleBody.find("p").each((_, el) => {
      const text = $article(el).text().trim();
      if (text && !text.includes("ⓒ") && !text.includes("ADVERTISEMENT")) {
        paragraphs.push(text);
      }
    });

    if (paragraphs.length > 0) {
      content = paragraphs.join("\n\n");
    } else {
      content = articleBody.text().trim();
    }
  }

  if (!content) {
    content =
      $article(".article-body").text().trim() ||
      $article(".article-content").text().trim();
  }

  const dateText = $article(".txt-date").first().text().trim();
  const date = dateText || new Date().toLocaleDateString("ko-KR");

  return {
    title: title || "제목을 찾을 수 없습니다",
    content: content || "본문을 찾을 수 없습니다",
    date,
    link: articleUrl,
  };
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const articleUrl = searchParams.get("url");

    // URL 파라미터가 없으면 목록 반환
    if (!articleUrl) {
      const editorials = await fetchEditorialList();
      return NextResponse.json({ editorials });
    }

    // URL 파라미터가 있으면 상세 + 분석 반환
    const editorial = await fetchEditorialDetail(articleUrl);
    const aiAnalysis = analyzePREP(editorial.content, editorial.title);
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
