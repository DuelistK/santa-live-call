import { NextRequest, NextResponse } from "next/server";
import { ChatTurn, SecretSantaNote } from "@/types/santa";

interface SummaryRequest {
  note: SecretSantaNote;
  transcript: ChatTurn[];
}

export async function POST(req: NextRequest) {
  try {
    const { note, transcript } = (await req.json()) as SummaryRequest;
    const childUtterances = transcript
      .filter((t) => t.speaker === "child")
      .map((t) => t.text)
      .join(" ");

    // 기본 휴리스틱 선물 키워드 추출 + 부모 힌트 병합
    const candidateKeywords = [
      "레고 소방차",
      "변신 로봇",
      "카봇",
      "티니핑",
      "자전거",
      "닌텐도",
      "인형",
      "공룡",
      "보드게임",
      "미술 세트",
    ];
    const detected = candidateKeywords.filter((kw) => childUtterances.includes(kw));
    if (detected.length === 0 && note.giftHint) {
      detected.push(note.giftHint);
    }

    return NextResponse.json({
      detectedGifts: Array.from(new Set(detected)),
      conversationSummary: `${note.childName} 어린이가 산타할아버지의 '${note.praise}' 칭찬에 기뻐하며, 크리스마스에 받고 싶은 선물(${detected.join(", ")})에 대해 신나게 이야기했습니다.`,
      missionPromise: `'${note.mission}' 약속을 산타할아버지와 손가락 걸고 꼭 지키기로 다짐했습니다!`,
      santaComment: `호호호! 우리 ${note.childName} 어린이의 맑은 웃음소리가 북극까지 울려 퍼졌답니다. 약속을 잘 지키는 멋진 겨울이 되길 응원할게요!`,
    });
  } catch (error) {
    console.error("Error summarizing report:", error);
    return NextResponse.json({ error: "Summary generation failed" }, { status: 500 });
  }
}
