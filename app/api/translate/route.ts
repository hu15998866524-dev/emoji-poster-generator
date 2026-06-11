import { NextResponse } from "next/server";

export const runtime = "nodejs";

type TranslateRequest = {
  texts?: unknown;
};

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as TranslateRequest;
  const texts = normalizeTexts(body.texts);

  if (texts.length === 0) {
    return NextResponse.json({ translations: {} });
  }

  const pairs = await Promise.all(
    texts.map(async (text) => {
      try {
        return [text, await translateChineseToEnglish(text)] as const;
      } catch (error) {
        console.warn(`Translation failed for "${text}"`, error);
        return [text, ""] as const;
      }
    })
  );

  return NextResponse.json({
    translations: Object.fromEntries(pairs.filter(([, english]) => english.length > 0))
  });
}

function normalizeTexts(value: unknown) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .filter((item): item is string => typeof item === "string")
        .map((item) => item.trim())
        .filter((item) => item.length > 0 && item.length <= 80)
    )
  ).slice(0, 16);
}

async function translateChineseToEnglish(text: string) {
  const params = new URLSearchParams({
    client: "gtx",
    sl: "zh-CN",
    tl: "en",
    dt: "t",
    q: text
  });

  const response = await fetch(
    `https://translate.googleapis.com/translate_a/single?${params.toString()}`,
    {
      headers: {
        "User-Agent": "emoji-poster-generator/0.1"
      },
      next: {
        revalidate: 60 * 60 * 24
      }
    }
  );

  if (!response.ok) return "";

  const data = (await response.json()) as unknown;
  return toTitleCase(extractTranslatedText(data));
}

function extractTranslatedText(data: unknown) {
  if (!Array.isArray(data) || !Array.isArray(data[0])) return "";

  return data[0]
    .map((part) => (Array.isArray(part) && typeof part[0] === "string" ? part[0] : ""))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
}

function toTitleCase(value: string) {
  return value
    .toLowerCase()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase())
    .replace(/\b(A|An|And|As|At|But|By|For|In|Of|On|Or|The|To|With)\b/g, (word, _, offset) =>
      offset === 0 ? word : word.toLowerCase()
    );
}
