// 전면 카메라 스냅샷을 분석하여 산타가 아이의 옷차림·표정·장난감을 알아보고 칭찬하는 멀티모달 비전 API
import { NextRequest, NextResponse } from "next/server";

interface VisionRequest {
  imageBase64: string;
  childName?: string;
}

const WARM_FALLBACK_COMMENTS = [
  "호호호! 카메라로 보니까 눈이 별처럼 반짝반짝 빛나는구나! 오늘 표정이 정말 밝아서 산타할아버지도 기분이 좋단다!",
  "우와! 환하게 웃는 얼굴이 북극 수정구슬에 아주 선명하게 비치는구나! 정말 씩씩하고 멋지단다!",
  "허허허! 할아버지한테 인사해 주는 모습이 너무 귀엽구나! 올해 얼마나 건강하게 자랐는지 한눈에 보인단다!",
];

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, childName } = (await req.json()) as VisionRequest;
    const nameLabel =
      childName && childName !== "우리 아이" ? `${childName} 어린이` : "우리 친구";

    const randomFallback =
      WARM_FALLBACK_COMMENTS[
        Math.floor(Math.random() * WARM_FALLBACK_COMMENTS.length)
      ];

    const apiKey =
      process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY || "";
    if (!apiKey || apiKey.startsWith("your_") || !imageBase64) {
      return NextResponse.json({ santaVisionReply: randomFallback });
    }

    const cleanedBase64 = imageBase64.replace(/^data:image\/\w+;base64,/, "");
    const model = process.env.GEMINI_MODEL || "gemini-2.5-flash";

    const geminiRes = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            {
              parts: [
                {
                  text: `당신은 북극의 진짜 산타할아버지입니다. 지금 영상통화 카메라로 '${nameLabel}'가 자신의 모습이나 물건을 보여주고 있습니다.
사진 속에 보이는 아이의 밝은 표정, 옷차림 색상/무늬, 손에 들고 있는 장난감이나 그림 중 확실히 보이는 특징 하나를 콕 집어서
"우와! ~구나! 호호호!"처럼 따뜻하고 신비로운 산타 말투로 1~2문장 이내로 다정하게 칭찬해 주세요.`,
                },
                {
                  inlineData: {
                    mimeType: "image/jpeg",
                    data: cleanedBase64,
                  },
                },
              ],
            },
          ],
          generationConfig: {
            temperature: 0.6,
            maxOutputTokens: 160,
          },
        }),
      }
    );

    if (!geminiRes.ok) {
      return NextResponse.json({ santaVisionReply: randomFallback });
    }

    const data = await geminiRes.json();
    const reply =
      data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim() ||
      randomFallback;

    return NextResponse.json({ santaVisionReply: reply });
  } catch {
    return NextResponse.json({
      santaVisionReply:
        "호호호! 우리 친구 얼굴을 보니까 북극 공방까지 환해지는구나!",
    });
  }
}
