import { NextRequest, NextResponse } from "next/server";
import { AccessToken } from "livekit-server-sdk";
import { ConnectionDetailsResponse, SecretSantaNote } from "@/types/santa";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Partial<SecretSantaNote>;

    const metadata: SecretSantaNote = {
      childName: (body.childName || "지우").trim(),
      childAge: (body.childAge || "6").trim(),
      praise: (body.praise || "올해도 부모님 말씀을 잘 듣고 친구들과 사이좋게 지낸 일").trim(),
      mission: (body.mission || "밤 9시 전에 양치질 깨끗이 하고 일찍 잠들기").trim(),
      giftHint: (body.giftHint || "레고 소방차 세트").trim(),
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
