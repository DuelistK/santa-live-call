// LiveKit Room 접속용 AccessToken 및 산타 메타데이터(SecretSantaNote) 발급 API 라우트
import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { ConnectionDetailsResponse, SecretSantaNote } from "@/types/santa";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<SecretSantaNote>;

    const metadata: SecretSantaNote = {
      childName: (body.childName || "우리 아이").trim(),
      childAge: (body.childAge || "6").trim(),
      praise: (body.praise || "올해도 건강하고 밝게 자라며 친구들과 사이좋게 지낸 일").trim(),
      mission: (body.mission || "밤에 일찍 잠자리에 들고 스스로 깨끗이 양치질하기").trim(),
      giftHint: (body.giftHint || "크리스마스 깜짝 선물").trim(),
      avatarProvider: body.avatarProvider || "anam",
    };

    const livekitUrl =
      process.env.LIVEKIT_URL || process.env.NEXT_PUBLIC_LIVEKIT_URL || "";
    const apiKey = process.env.LIVEKIT_API_KEY || "";
    const apiSecret = process.env.LIVEKIT_API_SECRET || "";

    const isConfigured =
      Boolean(livekitUrl && apiKey && apiSecret) &&
      !livekitUrl.includes("your-project") &&
      !apiKey.startsWith("APxxxx");

    const roomName = `santa-room-${Date.now()}`;
    const participantName = metadata.childName || "child-user";

    if (!isConfigured) {
      // 로컬/UI 검증 시 LiveKit Cloud 키가 없어도 전체 플로우를 시연할 수 있도록 demoMode 응답 반환
      const demoResponse: ConnectionDetailsResponse = {
        serverUrl: "wss://demo.livekit.cloud",
        roomName,
        participantName,
        participantToken: "demo-preview-token",
        demoMode: true,
        metadata,
      };
      return NextResponse.json(demoResponse);
    }

    const at = new AccessToken(apiKey, apiSecret, {
      identity: `child-${Date.now()}`,
      name: participantName,
      ttl: "15m",
      // 백엔드 agent.py가 participant.metadata 및 attributes 양쪽에서 모두 읽을 수 있도록 주입
      metadata: JSON.stringify(metadata),
      attributes: {
        childName: metadata.childName,
        childAge: metadata.childAge,
        praise: metadata.praise,
        mission: metadata.mission,
        giftHint: metadata.giftHint,
        avatarProvider: metadata.avatarProvider || "anam",
      },
    });

    at.addGrant({
      room: roomName,
      roomJoin: true,
      canPublish: true,
      canPublishData: true,
      canSubscribe: true,
    });

    const participantToken = await at.toJwt();

    const response: ConnectionDetailsResponse = {
      serverUrl: livekitUrl,
      roomName,
      participantName,
      participantToken,
      demoMode: false,
      metadata,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Failed to generate LiveKit connection details:", error);
    return NextResponse.json(
      { error: "Failed to create connection details" },
      { status: 500 }
    );
  }
}
