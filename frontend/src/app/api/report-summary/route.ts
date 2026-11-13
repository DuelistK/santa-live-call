// 대화록 기반 Gemini AI 구조화 선물 추출·대화 요약 API (키 미설정 시 휴리스틱 폴백 지원)
import { NextRequest, NextResponse } from "next/server";
import { ChatTurn, SecretSantaNote } from "@/types/santa";

interface SummaryRequest {
  note: SecretSantaNote;
  transcript: ChatTurn[];
  existingGifts?: string[];
}

const CANDIDATE_KEYWORDS = [
  "레고 소방차",
  "변신 로봇",
  "티니핑 인형",
  "하츄핑",
  "티니핑",
  "카봇",
  "베이블레이드",
  "레고",
  "소방차",
  "로봇",
  "자전거",
  "킥보드",
  "닌텐도",
  "인형",
  "공룡",
  "보드게임",
  "미술 세트",
  "축구공",
];

function buildHeuristicSummary(
  note: SecretSantaNote,
  transcript: ChatTurn[],
  existingGifts: string[] = []
) {
  const childName =
    note.childName && note.childName !== "우리 아이"
      ? note.childName
      : "우리 아이";
  const childUtterances = transcript
    .filter((t) => t.speaker === "child")
    .map((t) => t.text)
    .join(" ");

  const detected = [...existingGifts];
  for (const kw of CANDIDATE_KEYWORDS) {
    if (childUtterances.includes(kw) && !detected.includes(kw)) {
      detected.push(kw);
    }
  }
  if (detected.length === 0 && note.giftHint) {
    detected.push(note.giftHint);
  }

  const uniqueGifts = Array.from(new Set(detected));

  return {
    detectedGifts: uniqueGifts,
    giftReasonSummary: `${childName}가 통화 중 반짝이는 목소리로 '${uniqueGifts[0]}' 선물을 이야기했어요.`,
    conversationSummary: `${childName}와(과) 따뜻한 인사를 나누며 '${note.praise}' 모습을 칭찬해 주었고, 크리스마스 소원(${uniqueGifts.join(", ")})과 약속에 대해 즐겁게 대화했습니다.`,
    missionPromise: note.mission,
    santaComment: `호호호! ${childName}의 맑은 목소리를 들으니 북극 마을까지 따뜻해졌단다. 우리 약속 꼭 지키고 행복한 크리스마스 보내렴!`,
  };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<SummaryRequest> &
      Partial<SecretSantaNote>;
    const safeNote: SecretSantaNote = body.note || {
      childName: body.childName || "우리 아이",
      childAge: body.childAge || "6",
      praise: body.praise || "밝고 씩씩하게 지낸 일",
      mission: body.mission || "약속 잘 지키기",
      giftHint: body.giftHint || "크리스마스 깜짝 선물",
    };
    const transcript = body.transcript || [];
    const existingGifts = body.existingGifts || [];

    const fallback = buildHeuristicSummary(safeNote, transcript, existingGifts);

    const apiKey =
      process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";
    if (
      !apiKey ||
      apiKey.startsWith("your_") ||
      !transcript ||
      transcript.length === 0
    ) {
      return NextResponse.json(fallback);
    }

    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";
    const dialogueText = transcript
      .map(
        (t) =>
          `${t.speaker === "santa" ? "산타" : safeNote.childName || "아이"}: ${t.text}`
      )
      .join("\n");

    const prompt = `다음은 산타할아버지와 어린이(${safeNote.childName || "우리 아이"}, ${safeNote.childAge || "6"}세)의 실시간 영상통화 대화록입니다.
부모님이 사전에 입력한 정보:
- 칭찬할 일: ${safeNote.praise}
- 약속할 습관: ${safeNote.mission}
- 선물 힌트: ${safeNote.giftHint}

[대화록]
${dialogueText}

위 대화를 분석하여 부모님용 비밀 리포트 JSON을 생성하세요. 반드시 아래 JSON 스키마 키만 포함하세요:
{
  "detectedGifts": ["대화에서 아이가 언급한 받고 싶은 구체적인 선물 키워드 배열 (없으면 선물 힌트 1개 포함)"],
  "giftReasonSummary": "아이가 선물에 대해 보인 반응이나 맥락 한 줄 요약 (한국어)",
  "conversationSummary": "오늘 통화 전체 내용 2문장 요약 (한국어)",
  "missionPromise": "산타와 손가락 걸고 다짐한 핵심 생활 습관 문구 (한국어, 간결하게)",
  "santaComment": "산타할아버지가 아이에게 남기는 다정하고 따뜻한 한마디 메시지 (한국어, 호호호 포함)"
}`;

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: {
            temperature: 0.4,
            responseMimeType: "application/json",
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      return NextResponse.json(fallback);
    }

    const geminiJson = await geminiRes.json();
    const rawText =
      geminiJson?.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const parsed = JSON.parse(rawText);

    return NextResponse.json({
      detectedGifts:
        Array.isArray(parsed.detectedGifts) && parsed.detectedGifts.length > 0
          ? parsed.detectedGifts
          : fallback.detectedGifts,
      giftReasonSummary: parsed.giftReasonSummary || fallback.giftReasonSummary,
      conversationSummary:
        parsed.conversationSummary || fallback.conversationSummary,
      missionPromise: parsed.missionPromise || fallback.missionPromise,
      santaComment: parsed.santaComment || fallback.santaComment,
    });
  } catch {
    return NextResponse.json(
      { error: "Summary generation fallback" },
      { status: 200 }
    );
  }
}
