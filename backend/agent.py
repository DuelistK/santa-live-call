"""
Santa Live Call MVP — Real-time AI Santa Claus Agent (LiveKit Agents 1.x)

- STT: Deepgram (`livekit-plugins-deepgram`, Korean optimized)
- LLM: Google Gemini (`livekit-plugins-google`, `gemini-2.5-flash`)
- TTS: ElevenLabs (`livekit-plugins-elevenlabs`, `eleven_flash_v2_5`)
- Avatar Factory (`AVATAR_PROVIDER` = "anam" | "lemonslice" | "heygen"):
    - Default: `livekit-plugins-anam` (Anam AI real-time persona avatar)
    - Option 1: `livekit-plugins-lemonslice`
    - Option 2: `livekit-plugins-liveavatar` (HeyGen LiveAvatar Lite mode)
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
from dataclasses import asdict, dataclass, field
from typing import Any, Optional

from dotenv import load_dotenv

# Windows / 사내 네트워크 환경에서 Python 및 Rust(livekit-rtc) 엔진 모두 OS 루트 인증서를 신뢰하도록 설정
def _configure_windows_ca_bundle() -> None:
    try:
        import base64
        import ssl
        import certifi

        bundle_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "combined_cacert.pem")
        if not os.path.exists(bundle_path):
            pem_certs: list[str] = []
            for store_name in ("ROOT", "CA"):
                for cert, encoding, _ in ssl.enum_certificates(store_name):
                    if encoding == "x509_asn":
                        b64 = base64.encodebytes(cert).decode("ascii")
                        pem_certs.append(
                            f"-----BEGIN CERTIFICATE-----\n{b64}-----END CERTIFICATE-----\n"
                        )
            with open(certifi.where(), "r", encoding="utf-8") as f:
                base_pem = f.read()
            with open(bundle_path, "w", encoding="utf-8") as f:
                f.write(base_pem + "\n" + "\n".join(pem_certs))

        os.environ["SSL_CERT_FILE"] = bundle_path
        os.environ["REQUESTS_CA_BUNDLE"] = bundle_path
    except Exception:
        pass

    try:
        import truststore  # type: ignore

        truststore.inject_into_ssl()
    except Exception:
        pass


_configure_windows_ca_bundle()

from livekit import rtc
from livekit.agents import (
    Agent,
    AgentSession,
    AutoSubscribe,
    JobContext,
    RunContext,
    WorkerOptions,
    cli,
    function_tool,
)
from livekit.plugins import deepgram, elevenlabs, google, silero

load_dotenv()

logger = logging.getLogger("santa-live-agent")
logger.setLevel(logging.INFO)


# =====================================================================
# 1. 부모의 '비밀 산타 노트' 데이터 모델 & 파서
# =====================================================================
@dataclass
class SecretSantaNote:
    childName: str = "착한 어린이"
    childAge: str = "6"
    praise: str = "올해도 밥도 잘 먹고 부모님 말씀을 잘 들은 점"
    mission: str = "밤에 일찍 자고 양치질을 깨끗이 하기"
    giftHint: str = "특별한 크리스마스 선물"
    avatarProvider: str = ""

    @classmethod
    def from_raw(cls, raw_metadata: Optional[str], attributes: Optional[dict[str, str]] = None) -> "SecretSantaNote":
        """Room/Participant metadata(JSON) 또는 Participant attributes에서 부모 설정값을 추출합니다."""
        data: dict[str, Any] = {}
        if raw_metadata:
            try:
                parsed = json.loads(raw_metadata)
                if isinstance(parsed, dict):
                    data.update(parsed)
            except json.JSONDecodeError:
                logger.warning("Failed to parse JSON metadata; falling back to attributes/defaults.")

        if attributes:
            for key in ("childName", "childAge", "praise", "mission", "giftHint", "avatarProvider"):
                if attributes.get(key):
                    data[key] = attributes[key]

        return cls(
            childName=str(data.get("childName") or cls.childName).strip(),
            childAge=str(data.get("childAge") or cls.childAge).strip(),
            praise=str(data.get("praise") or cls.praise).strip(),
            mission=str(data.get("mission") or cls.mission).strip(),
            giftHint=str(data.get("giftHint") or cls.giftHint).strip(),
            avatarProvider=str(data.get("avatarProvider") or "").strip(),
        )


@dataclass
class SantaReportPayload:
    childName: str
    detectedGifts: list[str] = field(default_factory=list)
    conversationSummary: str = ""
    missionPromise: str = ""
    santaComment: str = ""


# =====================================================================
# 2. 동적 산타 시스템 프롬프트 생성기 (동심 파괴 방지 & 가드레일 반영)
# =====================================================================
def build_santa_system_prompt(note: SecretSantaNote) -> str:
    return f"""당신은 북극 산타 마을에 살고 있는 진짜 '산타할아버지'입니다.
지금 영상 통화로 한국의 '{note.childName}'({note.childAge}세) 어린이와 실시간으로 만나고 있습니다.

[부모님이 몰래 전해준 '비밀 산타 노트' 정보]
- 아이 이름: {note.childName} ({note.childAge}세)
- 올해 특별히 칭찬해 줄 일: {note.praise}
- 산타할아버지가 꼭 당부할 약속(습관): {note.mission}
- 부모님이 귀띔해 준 선물 힌트: {note.giftHint}

[핵심 대화 규칙 및 동심 보호 가드레일 — 절대 준수!]
1. 말투와 페르소나:
   - 따뜻하고 인자하며 신비로운 할아버지 말투를 사용하세요.
   - 대화 중간중간 "호호호!" 또는 "허허허, 반갑구나!" 같은 산타 특유의 웃음소리를 자연스럽게 섞어 주세요.
   - 아이의 집중력을 위해 **한 번에 반드시 1~2문장 이내**로 짧고 다정하게 말하고, 아이가 대답할 차례를 넘겨주세요.
2. 동적 정보 활용:
   - 북극의 '착한 어린이 마법 수첩'에서 봤다면서 '{note.praise}'에 대해 구체적으로 칭찬해 주세요.
   - 대화 중 자연스럽게 '{note.mission}' 약속을 잘 지킬 수 있는지 손가락 걸고 약속을 받아내세요.
   - 크리스마스에 무슨 선물을 받고 싶은지 물어보고, 아이가 망설이면 '{note.giftHint}' 관련 이야기를 은근슬쩍 꺼내며 반응을 살펴보세요.
3. 동심 파괴 방지 (의심 대처):
   - 아이가 "산타 진짜 있어요?", "가짜 아니에요?", "아빠/로봇 아니에요?"라고 의심해도 절대 AI이거나 가짜라고 인정하지 마세요!
   - "호호호! 방금 루돌프 코가 반짝이는 바람에 북극 카메라가 살짝 흔들렸나 보구나! 지금 요정 친구들이 옆에서 선물 포장 리본을 묶고 있단다!"처럼 동화적이고 재치 있게 넘어가세요.
4. 침묵 및 돌발 상황 대처:
   - 아이가 부끄러워하거나 말이 없으면 "호호호, 우리 {note.childName}이가 산타할아버지를 보니까 조금 부끄러운가 보구나! 할아버지 수염이 하얘서 신기하지?"라며 다정하게 긴장을 풀어주세요.
5. 선물 키워드 기록 도구 호출:
   - 아이가 받고 싶은 선물을 말하거나 약속을 다짐하면 `record_child_gift_wish` 도구를 호출해 부모님 비밀 리포트에 실시간으로 기록하세요.
"""


# =====================================================================
# 3. 실시간 아바타 팩토리 (Anam [기본] <-> LemonSlice <-> HeyGen 스위칭)
# =====================================================================
class AvatarFactory:
    """
    환경변수 `AVATAR_PROVIDER` ('anam' | 'lemonslice' | 'heygen')에 따라
    오디오-투-비디오(Audio-to-Video) 실시간 아바타 세션을 생성하는 팩토리 클래스입니다.
    """

    @staticmethod
    def create_avatar_session(override_provider: Optional[str] = None) -> Optional[Any]:
        provider = (override_provider or os.getenv("AVATAR_PROVIDER", "anam")).strip().lower()
        logger.info("Initializing real-time avatar provider: %s", provider)

        if provider == "heygen":
            return AvatarFactory._create_heygen_liveavatar()
        if provider == "lemonslice":
            return AvatarFactory._create_lemonslice_avatar()
        return AvatarFactory._create_anam_avatar()

    @staticmethod
    def _create_anam_avatar() -> Optional[Any]:
        api_key = os.getenv("ANAM_API_KEY")
        avatar_id = os.getenv("ANAM_AVATAR_ID")

        if not api_key or api_key.startswith("your_"):
            logger.warning(
                "ANAM_API_KEY is not configured. Running in audio-only / UI fallback mode."
            )
            return None

        try:
            from livekit.plugins import anam  # type: ignore

            avatar = anam.AvatarSession(
                api_key=api_key,
                persona_config=anam.PersonaConfig(
                    name="Santa",
                    avatarId=avatar_id,
                ),
            )
            return avatar
        except Exception as exc:
            logger.error("Failed to initialize Anam AvatarSession: %s", exc)
            return None

    @staticmethod
    def _create_lemonslice_avatar() -> Optional[Any]:
        api_key = os.getenv("LEMONSLICE_API_KEY")
        avatar_id = os.getenv("LEMONSLICE_AVATAR_ID")
        agent_image_url = os.getenv("LEMONSLICE_AGENT_IMAGE_URL")

        if not api_key or api_key.startswith("your_"):
            logger.warning(
                "LEMONSLICE_API_KEY is not configured. Running in audio-only / UI fallback mode."
            )
            return None

        try:
            from livekit.plugins import lemonslice  # type: ignore

            kwargs: dict[str, Any] = {"api_key": api_key}
            if avatar_id and not avatar_id.startswith("your_"):
                kwargs["agent_id"] = avatar_id
            if agent_image_url and not agent_image_url.startswith("https://your-cdn"):
                kwargs["agent_image_url"] = agent_image_url
            kwargs["agent_prompt"] = (
                "A warm, benevolent Santa Claus with a fluffy white beard and kind smiling eyes, "
                "nodding gently inside a cozy North Pole workshop."
            )
            return lemonslice.AvatarSession(**kwargs)
        except Exception as exc:
            logger.error("Failed to initialize LemonSlice AvatarSession: %s", exc)
            return None

    @staticmethod
    def _create_heygen_liveavatar() -> Optional[Any]:
        api_key = os.getenv("LIVEAVATAR_API_KEY") or os.getenv("HEYGEN_API_KEY")
        avatar_id = os.getenv("LIVEAVATAR_AVATAR_ID", "default-santa-lite")

        if not api_key or api_key.startswith("your_"):
            logger.warning(
                "LIVEAVATAR_API_KEY / HEYGEN_API_KEY is not configured. Running in audio-only / UI fallback mode."
            )
            return None

        try:
            from livekit.plugins import liveavatar  # type: ignore

            return liveavatar.AvatarSession(
                api_key=api_key,
                avatar_id=avatar_id,
            )
        except Exception as exc:
            logger.error("Failed to initialize HeyGen LiveAvatar AvatarSession: %s", exc)
            return None


# =====================================================================
# 4. 산타 에이전트 정의 (대화 + 백그라운드 선물 키워드 추출 Tool)
# =====================================================================
class SantaClausAgent(Agent):
    def __init__(self, note: SecretSantaNote, room: rtc.Room) -> None:
        super().__init__(instructions=build_santa_system_prompt(note))
        self.note = note
        self.room = room
        self.report = SantaReportPayload(
            childName=note.childName,
            detectedGifts=[],
            conversationSummary=f"{note.childName} 어린이와 북극 산타 마을 영상 통화를 진행했습니다.",
            missionPromise=f"'{note.mission}' 약속을 산타할아버지와 함께 다짐했어요!",
            santaComment=f"올해 '{note.praise}' 모습을 보여준 {note.childName}, 정말 기특하구나! 호호호!",
        )

    @function_tool
    async def record_child_gift_wish(
        self,
        context: RunContext,
        gift_keyword: str,
        child_reaction_summary: str,
        promised_mission: bool = True,
    ) -> str:
        """
        아이가 대화 중 언급한 '받고 싶은 선물 키워드'와 반응 요약을 부모님용 비밀 산타 리포트로 실시간 전송합니다.

        Args:
            gift_keyword: 아이가 말한 받고 싶은 선물 이름이나 키워드 (예: '레고 시티 소방차', '티니핑 인형')
            child_reaction_summary: 아이와의 대화 내용 및 반응 한 줄 요약
            promised_mission: 부모님이 당부한 습관 약속에 아이가 동의했는지 여부
        """
        cleaned_gift = gift_keyword.strip()
        if cleaned_gift and cleaned_gift not in self.report.detectedGifts:
            self.report.detectedGifts.append(cleaned_gift)

        if child_reaction_summary.strip():
            self.report.conversationSummary = child_reaction_summary.strip()

        if promised_mission:
            self.report.missionPromise = (
                f"'{self.note.mission}' 약속을 산타할아버지와 손가락 걸고 꼭 지키기로 했어요!"
            )

        await self.publish_report_to_frontend()
        return f"Recorded gift wish '{cleaned_gift}' in Secret Santa Report."

    async def publish_report_to_frontend(self) -> None:
        """LiveKit DataChannel ('santa-report' 토픽)을 통해 프론트엔드에 리포트 JSON을 브로드캐스트합니다."""
        try:
            payload_bytes = json.dumps(asdict(self.report), ensure_ascii=False).encode("utf-8")
            await self.room.local_participant.publish_data(
                payload_bytes,
                reliable=True,
                topic="santa-report",
            )
            logger.info("Published updated Santa report to frontend: %s", self.report.detectedGifts)
        except Exception as exc:
            logger.warning("Could not publish Santa report data packet: %s", exc)


# =====================================================================
# 5. 백그라운드 선물 키워드 추출기 (Gemini 2.5 Flash 보조 분석)
# =====================================================================
async def extract_gift_keywords_in_background(
    utterance: str,
    santa_agent: SantaClausAgent,
) -> None:
    """
    아이의 발화 텍스트가 들어올 때마다 비동기로 선물 키워드를 빠르게 점검하여
    Tool 호출이 누락되더라도 부모 리포트에 선물 후보가 기록되도록 보완합니다.
    """
    text = utterance.strip()
    if len(text) < 2:
        return

    google_api_key = os.getenv("GOOGLE_API_KEY", "")
    if not google_api_key or google_api_key.startswith("your_"):
        return

    try:
        from google import genai  # type: ignore

        gemini_model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite").strip()
        client = genai.Client(api_key=google_api_key)
        prompt = (
            "다음은 어린이가 산타할아버지와 영상통화하며 한 말입니다. "
            "어린이가 받고 싶어 하는 '선물 품목/장난감/물건'이 포함되어 있다면 명사 키워드만 쉼표로 구분해 출력하고, "
            "없다면 'NONE'만 출력하세요.\n\n"
            f"어린이 발화: \"{text}\""
        )
        response = await asyncio.to_thread(
            client.models.generate_content,
            model=gemini_model,
            contents=prompt,
        )
        extracted = (response.text or "").strip()
        if extracted and extracted.upper() != "NONE":
            for item in [x.strip() for x in extracted.split(",") if x.strip()]:
                if item not in santa_agent.report.detectedGifts:
                    santa_agent.report.detectedGifts.append(item)
            await santa_agent.publish_report_to_frontend()
    except Exception as exc:
        logger.debug("Background gift extraction skipped: %s", exc)


# =====================================================================
# 6. LiveKit Agent Entrypoint
# =====================================================================
async def wait_for_child_note(ctx: JobContext) -> SecretSantaNote:
    """Room 메타데이터 또는 첫 번째 참가자의 메타데이터/속성에서 부모의 비밀 산타 노트를 읽어옵니다."""
    participant = await ctx.wait_for_participant()
    raw_metadata = participant.metadata or ctx.room.metadata
    attributes = getattr(participant, "attributes", None)
    note = SecretSantaNote.from_raw(raw_metadata=raw_metadata, attributes=attributes)
    logger.info(
        "Loaded SecretSantaNote for child='%s' (%s yrs), praise='%s', mission='%s', giftHint='%s'",
        note.childName,
        note.childAge,
        note.praise,
        note.mission,
        note.giftHint,
    )
    return note


async def entrypoint(ctx: JobContext) -> None:
    await ctx.connect(auto_subscribe=AutoSubscribe.AUDIO_ONLY)

    # 1. 부모가 입력한 '비밀 산타 노트' 메타데이터 수신
    note = await wait_for_child_note(ctx)

    # 2. STT / LLM / TTS 파이프라인 구성
    # - STT: Deepgram 한국어 최적화 설정
    stt_engine = deepgram.STT(
        model="nova-2",
        language="ko",
        smart_format=True,
        api_key=os.getenv("DEEPGRAM_API_KEY"),
    )

    # - LLM: Google Gemini Flash (신규 API 키에서 즉시 응답하는 gemini-3.5-flash-lite 기본 사용)
    gemini_model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite").strip()
    llm_engine = google.LLM(
        model=gemini_model,
        temperature=0.7,
        api_key=os.getenv("GOOGLE_API_KEY"),
    )

    # - TTS: ElevenLabs 인자한 할아버지 목소리 & 다국어/한국어 초저지연 스트리밍 모델
    # (livekit-plugins-elevenlabs는 기본적으로 ELEVEN_API_KEY를 찾으므로 ELEVENLABS_API_KEY를 명시 전달)
    eleven_api_key = os.getenv("ELEVENLABS_API_KEY") or os.getenv("ELEVEN_API_KEY")
    raw_voice_id = os.getenv("ELEVENLABS_VOICE_ID", "").strip()
    voice_id = (
        raw_voice_id
        if raw_voice_id and not raw_voice_id.startswith("your_")
        else "pNInz6obpgDQGcFmaJgB"
    )
    tts_engine = elevenlabs.TTS(
        api_key=eleven_api_key,
        voice_id=voice_id,
        model="eleven_flash_v2_5",
        language="ko",
    )

    session = AgentSession(
        vad=silero.VAD.load(),
        stt=stt_engine,
        llm=llm_engine,
        tts=tts_engine,
    )

    santa_agent = SantaClausAgent(note=note, room=ctx.room)

    # 사용자 발화 시 백그라운드 선물 키워드 추출 연결
    @session.on("user_input_transcribed")
    def _on_user_transcribed(event: Any) -> None:
        transcript = getattr(event, "transcript", "")
        is_final = getattr(event, "is_final", True)
        if is_final and transcript:
            asyncio.create_task(extract_gift_keywords_in_background(transcript, santa_agent))

    # 프론트엔드 채팅창('글쓰고 말하기')에서 보낸 텍스트 메시지('child-chat' 토픽)를 받아 산타가 실제로 음성/영상 대답하도록 연동
    @ctx.room.on("data_received")
    def _on_data_received(data_packet: rtc.DataPacket) -> None:
        try:
            if data_packet.topic == "child-chat":
                text = data_packet.data.decode("utf-8").strip()
                if text:
                    logger.info("Received child-chat message from frontend: %s", text)
                    asyncio.create_task(extract_gift_keywords_in_background(text, santa_agent))
                    session.generate_reply(
                        user_input=text,
                        instructions="아이가 방금 한 말에 대해 산타할아버지로서 1~2문장으로 다정하게 대답하세요.",
                    )
        except Exception as exc:
            logger.warning("Failed to handle child-chat data packet: %s", exc)

    # 3. 실시간 아바타 세션 시작 (Anam 기본 / LemonSlice / HeyGen 스위칭)
    avatar = AvatarFactory.create_avatar_session(override_provider=note.avatarProvider)
    if avatar is not None:
        try:
            await avatar.start(session, room=ctx.room)
            logger.info("Real-time Santa avatar session started successfully.")
        except Exception as exc:
            logger.error("Avatar session failed to start; continuing with voice session: %s", exc)

    # 4. AgentSession 시작
    await session.start(
        agent=santa_agent,
        room=ctx.room,
    )

    # 초기 리포트 상태 프론트엔드 동기화
    await santa_agent.publish_report_to_frontend()

    # 5. 통화 연결 직후 산타가 먼저 아이의 이름을 부르며 반갑게 첫인사!
    await session.generate_reply(
        instructions=(
            f"방금 영상 통화가 연결되었습니다! "
            f"'호호호! 우리 {note.childName} 어린이, 안녕! 북극 산타 마을에서 산타할아버지가 전화했단다!'라고 "
            f"아이의 이름({note.childName})을 다정하게 부르며 시작하고, "
            f"올해 '{note.praise}' 한 모습을 마법 수첩에서 봤다고 1~2문장으로 따뜻하게 첫인사를 건네세요."
        )
    )


if __name__ == "__main__":
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
        )
    )
