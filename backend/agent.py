# 실시간 WebRTC(LiveKit) 기반 AI 산타할아버지 음성·아바타 에이전트 서버
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

        # Python 3.14 OpenSSL VERIFY_X509_STRICT 플래그가 사내 루트 인증서의 Missing Authority Key Identifier를
        # 거부하지 않도록 기본 SSLContext 생성 시 VERIFY_X509_STRICT 플래그를 해제합니다.
        _orig_create_default_context = ssl.create_default_context

        def _relaxed_create_default_context(*args: Any, **kwargs: Any) -> ssl.SSLContext:
            ctx = _orig_create_default_context(*args, **kwargs)
            if hasattr(ssl, "VERIFY_X509_STRICT"):
                ctx.verify_flags &= ~ssl.VERIFY_X509_STRICT
            return ctx

        ssl.create_default_context = _relaxed_create_default_context  # type: ignore
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
# 주의: LiveKit 플러그인들은 반드시 메인 스레드(파일 최상단)에서 import 해야 워커에 정상 등록됩니다!
from livekit.plugins import anam, deepgram, elevenlabs, google, lemonslice, liveavatar, silero

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
    previousCallCount: int = 0
    lastPromise: str = ""
    lastGifts: str = ""
    stampsCollected: int = 0

    @classmethod
    def from_raw(cls, raw_metadata: Optional[str], attributes: Optional[dict[str, str]] = None) -> "SecretSantaNote":
        """Room/Participant metadata(JSON) 또는 Participant attributes에서 부모 설정값을 추출합니다."""
        data: dict[str, Any] = {}
        if raw_metadata:
            try:
                parsed = json.loads(raw_metadata)
                if isinstance(parsed, dict):
                    data.update(parsed)
                    prev_mem = parsed.get("previousMemory")
                    if isinstance(prev_mem, dict):
                        data["previousCallCount"] = prev_mem.get("callCount", 0)
                        data["lastPromise"] = prev_mem.get("lastPromise", "")
                        last_gifts_list = prev_mem.get("lastGifts")
                        if isinstance(last_gifts_list, list):
                            data["lastGifts"] = ", ".join(str(g) for g in last_gifts_list)
                        data["stampsCollected"] = prev_mem.get("stampsCollected", 0)
            except json.JSONDecodeError:
                logger.warning("Failed to parse JSON metadata; falling back to attributes/defaults.")

        if attributes:
            for key in (
                "childName",
                "childAge",
                "praise",
                "mission",
                "giftHint",
                "avatarProvider",
                "previousCallCount",
                "lastPromise",
                "lastGifts",
                "stampsCollected",
            ):
                if attributes.get(key):
                    data[key] = attributes[key]

        try:
            prev_count = int(data.get("previousCallCount") or 0)
        except (TypeError, ValueError):
            prev_count = 0

        try:
            stamps_num = int(data.get("stampsCollected") or 0)
        except (TypeError, ValueError):
            stamps_num = 0

        return cls(
            childName=str(data.get("childName") or cls.childName).strip(),
            childAge=str(data.get("childAge") or cls.childAge).strip(),
            praise=str(data.get("praise") or cls.praise).strip(),
            mission=str(data.get("mission") or cls.mission).strip(),
            giftHint=str(data.get("giftHint") or cls.giftHint).strip(),
            avatarProvider=str(data.get("avatarProvider") or "").strip(),
            previousCallCount=prev_count,
            lastPromise=str(data.get("lastPromise") or "").strip(),
            lastGifts=str(data.get("lastGifts") or "").strip(),
            stampsCollected=stamps_num,
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
    memory_section = ""
    if note.previousCallCount > 0 or note.stampsCollected > 0:
        memory_section = f"""
[이전 통화 기억 및 칭찬 도장 현황 (에피소드 메모리)]
- 누적 통화 횟수: 이전 {note.previousCallCount}회 통화함 (구면인 사이처럼 반갑게 아는 척해 주세요!)
- 지난번 약속했던 습관: {note.lastPromise or note.mission}
- 지난번 이야기했던 선물: {note.lastGifts or note.giftHint}
- 현재 모은 칭찬 별 도장: {note.stampsCollected}/5개 {"(5개 모두 달성! 엄청나게 축하해 주세요!)" if note.stampsCollected >= 5 else ""}
"""

    return f"""당신은 북극 산타 마을에 살고 있는 진짜 '산타할아버지'입니다.
지금 영상 통화로 한국의 '{note.childName}'({note.childAge}세) 어린이와 실시간으로 만나고 있습니다.

[부모님이 몰래 전해준 '비밀 산타 노트' 정보]
- 아이 이름: {note.childName} ({note.childAge}세)
- 올해 특별히 칭찬해 줄 일: {note.praise}
- 산타할아버지가 꼭 당부할 약속(습관): {note.mission}
- 부모님이 귀띔해 준 선물 힌트: {note.giftHint}
{memory_section}
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
        await self.publish_magic_fx(
            effect="gift" if cleaned_gift else "stamp",
            message=f"북극 마법 수첩에 '{cleaned_gift or '착한 약속'}' 기록 완료! ✨",
        )
        return f"Recorded gift wish '{cleaned_gift}' in Secret Santa Report."

    @function_tool
    async def trigger_santa_magic(
        self,
        context: RunContext,
        effect_type: str,
        message: str = "",
    ) -> str:
        """
        통화 화면에 실시간 북극 마법 이펙트(눈꽃 파티클, 착한 어린이 도장, 루돌프 코 반짝임, 선물 상자)와 사운드를 실행합니다.

        Args:
            effect_type: 실행할 마법 종류 ('snow' | 'stamp' | 'rudolph' | 'gift')
            message: 화면에 함께 표시할 짧은 마법 알림 문구
        """
        normalized = effect_type.strip().lower()
        if normalized not in ("snow", "stamp", "rudolph", "gift"):
            normalized = "snow"
        await self.publish_magic_fx(effect=normalized, message=message.strip())
        return f"Triggered Santa magic effect: {normalized}"

    async def publish_magic_fx(self, effect: str, message: str = "") -> None:
        """LiveKit DataChannel ('santa-magic-fx' 토픽)을 통해 프론트엔드에 실시간 마법 이펙트를 전송합니다."""
        try:
            default_labels = {
                "snow": "북극 마을의 마법 눈꽃이 내려요! ❄️",
                "stamp": "착한 어린이 약속 도장 쾅! ⭐",
                "rudolph": "루돌프가 반짝이는 코로 인사해요! 🦌",
                "gift": "마법 수첩에 소원 선물이 기록되었어요! 🎁",
            }
            payload = {
                "effect": effect,
                "message": message or default_labels.get(effect, "산타의 마법이 펼쳐집니다! ✨"),
            }
            payload_bytes = json.dumps(payload, ensure_ascii=False).encode("utf-8")
            await self.room.local_participant.publish_data(
                payload_bytes,
                reliable=True,
                topic="santa-magic-fx",
            )
            logger.info("Published santa-magic-fx to frontend: %s", effect)
        except Exception as exc:
            logger.warning("Could not publish santa-magic-fx packet: %s", exc)

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
# 5. 백그라운드 선물 키워드 추출기 (초경량 비블로킹 키워드 매칭)
# =====================================================================
GIFT_CANDIDATE_KEYWORDS = (
    "레고",
    "소방차",
    "로봇",
    "카봇",
    "티니핑",
    "하츄핑",
    "인형",
    "자전거",
    "킥보드",
    "닌텐도",
    "게임기",
    "공룡",
    "변신",
    "자동차",
    "블록",
    "색연필",
    "그림책",
    "축구공",
)


async def extract_gift_keywords_in_background(
    utterance: str,
    santa_agent: SantaClausAgent,
) -> None:
    """
    아이의 발화 텍스트에서 선물 후보 키워드를 이벤트 루프 블로킹 없이 즉시 감지합니다.
    (구체적인 선물 요약은 산타 에이전트의 record_child_gift_wish 함수 도구가 함께 처리합니다.)
    """
    text = utterance.strip()
    if len(text) < 2:
        return

    updated = False
    for kw in GIFT_CANDIDATE_KEYWORDS:
        if kw in text and kw not in santa_agent.report.detectedGifts:
            santa_agent.report.detectedGifts.append(kw)
            updated = True

    if updated:
        await santa_agent.publish_report_to_frontend()


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
    # - STT: Deepgram 한국어 최적화 설정 + 아이 이름/선물 고유명사 키워드 부스팅
    boost_terms: list[tuple[str, float]] = [
        ("산타할아버지", 3.0),
        ("루돌프", 2.5),
        ("티니핑", 3.0),
        ("하츄핑", 3.0),
        ("카봇", 3.0),
        ("레고", 2.5),
    ]
    if note.childName and note.childName not in ("착한 어린이", "우리 아이"):
        boost_terms.append((note.childName, 3.5))
    if note.giftHint and note.giftHint != "크리스마스 깜짝 선물":
        boost_terms.append((note.giftHint, 3.5))

    try:
        stt_engine = deepgram.STT(
            model="nova-2",
            language="ko",
            smart_format=True,
            keywords=boost_terms,
            api_key=os.getenv("DEEPGRAM_API_KEY"),
        )
    except TypeError:
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

    # 유아의 느린 말투와 추임새를 끊지 않도록 Silero VAD 침묵 허용 시간 완화
    try:
        vad_engine = silero.VAD.load(min_silence_duration=0.72, min_speech_duration=0.15)
    except TypeError:
        vad_engine = silero.VAD.load()

    session = AgentSession(
        vad=vad_engine,
        stt=stt_engine,
        llm=llm_engine,
        tts=tts_engine,
    )

    santa_agent = SantaClausAgent(note=note, room=ctx.room)
    last_child_activity = asyncio.get_event_loop().time()
    nudge_sent = False

    # 사용자/산타 대화가 추가될 때마다 프론트엔드 실시간 자막 및 대화록('santa-transcript' 토픽)으로 즉시 전송
    @session.on("conversation_item_added")
    def _on_conversation_item_added(event: Any) -> None:
        nonlocal last_child_activity
        try:
            item = getattr(event, "item", None)
            if not item:
                return
            role = getattr(item, "role", "")
            text_content = getattr(item, "text_content", None)
            if callable(text_content):
                text_content = text_content()
            if not text_content:
                content_list = getattr(item, "content", [])
                if isinstance(content_list, list):
                    text_content = " ".join([str(c) for c in content_list if isinstance(c, str)])
            text_str = str(text_content or "").strip()
            if not text_str:
                return

            speaker = "santa" if role == "assistant" else "child"
            if speaker == "child":
                last_child_activity = asyncio.get_event_loop().time()
            else:
                # 산타의 대사 맥락에 맞춰 자동으로 마법 이펙트('santa-magic-fx') 트리거
                if any(k in text_str for k in ("루돌프", "썰매", "방울")):
                    asyncio.create_task(
                        santa_agent.publish_magic_fx("rudolph", "루돌프가 반짝이는 코로 인사해요! 🦌")
                    )
                elif any(k in text_str for k in ("약속", "손가락", "기특", "도장", "잘했")):
                    asyncio.create_task(
                        santa_agent.publish_magic_fx("stamp", "착한 어린이 칭찬 도장 쾅! ⭐")
                    )
                elif any(k in text_str for k in ("선물", "수첩", "장난감")):
                    asyncio.create_task(
                        santa_agent.publish_magic_fx("gift", "북극 마법 수첩에 선물이 기록 중이에요! 🎁")
                    )
                elif any(k in text_str for k in ("북극", "눈", "호호호")):
                    asyncio.create_task(
                        santa_agent.publish_magic_fx("snow", "북극 마을의 마법 눈꽃이 내려요! ❄️")
                    )

            packet = json.dumps({"speaker": speaker, "text": text_str}, ensure_ascii=False).encode("utf-8")
            asyncio.create_task(
                ctx.room.local_participant.publish_data(
                    packet,
                    reliable=True,
                    topic="santa-transcript",
                )
            )
        except Exception as exc:
            logger.debug("Could not publish santa-transcript packet: %s", exc)

    # 사용자 발화 시 백그라운드 선물 키워드 추출 연결
    @session.on("user_input_transcribed")
    def _on_user_transcribed(event: Any) -> None:
        nonlocal last_child_activity
        transcript = getattr(event, "transcript", "")
        is_final = getattr(event, "is_final", True)
        if transcript:
            last_child_activity = asyncio.get_event_loop().time()
        if is_final and transcript:
            asyncio.create_task(extract_gift_keywords_in_background(transcript, santa_agent))

    # 프론트엔드 DataChannel 메시지('child-chat', 'parent-whisper', 'santa-vision-speak') 수신 연동
    @ctx.room.on("data_received")
    def _on_data_received(data_packet: rtc.DataPacket) -> None:
        nonlocal last_child_activity
        try:
            topic = data_packet.topic
            text = data_packet.data.decode("utf-8").strip()
            if not text:
                return

            if topic == "child-chat":
                last_child_activity = asyncio.get_event_loop().time()
                logger.info("Received child-chat message from frontend: %s", text)
                asyncio.create_task(extract_gift_keywords_in_background(text, santa_agent))
                session.generate_reply(
                    user_input=text,
                    instructions="아이가 방금 한 말에 대해 산타할아버지로서 1~2문장으로 다정하게 대답하세요.",
                )
            elif topic == "parent-whisper":
                logger.info("Received secret parent-whisper cue: %s", text)
                session.generate_reply(
                    instructions=f"부모님이 몰래 보낸 연출 지시입니다(아이에게는 비밀로 하세요): {text} — 산타할아버지답게 자연스럽게 1~2문장으로 말해주세요.",
                )
            elif topic == "santa-vision-speak":
                logger.info("Received multimodal vision observation: %s", text)
                session.generate_reply(
                    instructions=f"방금 카메라로 아이의 모습을 보았습니다. 다음 내용을 자연스러운 산타할아버지 대사(1~2문장)로 아이에게 직접 말해주세요: {text}",
                )
        except Exception as exc:
            logger.warning("Failed to handle data packet: %s", exc)

    # 3. AgentSession 먼저 시작 후 실시간 아바타 세션 연결
    await session.start(
        agent=santa_agent,
        room=ctx.room,
    )

    avatar = AvatarFactory.create_avatar_session(override_provider=note.avatarProvider)
    if avatar is not None:
        try:
            await avatar.start(session, room=ctx.room)
            logger.info("Real-time Santa avatar session started successfully.")
        except Exception as exc:
            logger.error("Avatar session failed to start; continuing with voice session: %s", exc)

    # 초기 리포트 상태 프론트엔드 동기화
    await santa_agent.publish_report_to_frontend()

    # 5. 통화 연결 직후 산타가 먼저 반갑게 첫인사 (칭찬 도장 5개 달성 / 재통화 기억 / 첫 통화 분기)
    is_generic_name = note.childName in ("착한 어린이", "우리 아이", "아이", "")
    if is_generic_name:
        opening_instructions = (
            "방금 영상 통화가 연결되었습니다! "
            "'호호호! 안녕! 북극 산타 마을에서 산타할아버지가 전화했단다!'라고 반갑게 인사한 뒤, "
            "'할아버지가 마법 수첩에서 찾으려는데, 우리 멋진 친구 이름이 무엇이니?'라고 "
            "1~2문장으로 다정하게 물어보세요. 이후 아이가 이름을 말하면 그 이름을 계속 불러주세요."
        )
    elif note.stampsCollected >= 5:
        opening_instructions = (
            f"방금 영상 통화가 연결되었습니다! "
            f"'{note.childName}' 어린이가 약속 도장 5개를 모두 모았다는 소식이 북극에 도착했습니다! "
            f"'호호호! 우리 {note.childName} 어린이! 약속 별 도장 다섯 개를 전부 모았다고 요정들이 알려줬단다! 정말 대단하구나!'라며 "
            f"1~2문장으로 신나게 축하 인사를 건네세요."
        )
    elif note.previousCallCount >= 1:
        opening_instructions = (
            f"방금 '{note.childName}' 어린이와 다시 영상 통화가 연결되었습니다(이전 {note.previousCallCount}회 통화)! "
            f"'호호호! 우리 {note.childName} 어린이, 또 만나서 반갑구나! 지난번에 할아버지랑 약속했던 {note.lastPromise or note.mission} 잘 지켰니?'라고 "
            f"기억하고 있다는 듯이 1~2문장으로 다정하게 첫인사를 건네세요."
        )
    else:
        opening_instructions = (
            f"방금 영상 통화가 연결되었습니다! "
            f"'호호호! 우리 {note.childName} 어린이, 안녕! 북극 산타 마을에서 산타할아버지가 전화했단다!'라고 "
            f"아이의 이름({note.childName})을 다정하게 부르며 시작하고, "
            f"올해 '{note.praise}' 한 모습을 마법 수첩에서 봤다고 1~2문장으로 따뜻하게 첫인사를 건네세요."
        )

    await session.generate_reply(instructions=opening_instructions)
    last_child_activity = asyncio.get_event_loop().time()

    # 6. 침묵 넛지(16초 무응답 시 1회 긴장 완화) & 루돌프 썰매 점검 알림(150초 도달 시 비용 보호 자연 마무리)
    async def _call_lifecycle_guardian() -> None:
        nonlocal nudge_sent
        call_started = asyncio.get_event_loop().time()
        wrapup_sent = False
        try:
            while ctx.room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
                await asyncio.sleep(3.0)
                now = asyncio.get_event_loop().time()

                if not nudge_sent and (now - last_child_activity) >= 16.0 and (now - call_started) < 60.0:
                    nudge_sent = True
                    session.generate_reply(
                        instructions=(
                            f"아이가 부끄러워서 아직 말을 못 하고 있습니다. "
                            f"'호호호, 산타할아버지 흰 수염이 신기해서 보고 있구나? 고개만 끄덕여도 할아버지는 다 보인단다!'라고 "
                            f"1문장으로 다정하게 긴장을 풀어주세요."
                        )
                    )

                if not wrapup_sent and (now - call_started) >= 150.0:
                    wrapup_sent = True
                    fx_packet = json.dumps(
                        {"effect": "sleigh_bell", "message": "요정들이 루돌프 썰매 점검 종을 울렸어요 🔔"},
                        ensure_ascii=False,
                    ).encode("utf-8")
                    await ctx.room.local_participant.publish_data(
                        fx_packet, reliable=True, topic="santa-magic-fx"
                    )
                    session.generate_reply(
                        instructions=(
                            f"이제 통화를 따뜻하게 마무리할 시간입니다. "
                            f"'앗, 요정 친구들이 루돌프 썰매 점검 시간이라고 종을 울리는구나! 우리 {note.childName}, 약속 꼭 지키고 크리스마스에 또 만나자! 메리 크리스마스!'라고 "
                            f"다정하게 작별 인사를 건네세요."
                        )
                    )
                    break
        except asyncio.CancelledError:
            pass
        except Exception as exc:
            logger.debug("Lifecycle guardian stopped: %s", exc)

    asyncio.create_task(_call_lifecycle_guardian())


def _cleanup_stale_agent_workers() -> None:
    """새 워커를 시작하기 전에 이전에 남아 있던 좀비/중복 agent.py 워커 프로세스를 자동 정리합니다."""
    try:
        import psutil  # type: ignore

        current_proc = psutil.Process(os.getpid())
        ancestors = {p.pid for p in current_proc.parents()}
        for proc in psutil.process_iter(["pid", "name", "cmdline"]):
            pid = proc.info.get("pid")
            if not pid or pid == current_proc.pid or pid in ancestors:
                continue
            cmdline = " ".join(proc.info.get("cmdline") or []).lower()
            if "agent.py" in cmdline and ("dev" in cmdline or "start" in cmdline):
                logger.info("Terminating stale Santa agent worker process (PID=%s)", pid)
                proc.kill()
    except Exception:
        pass


if __name__ == "__main__":
    _cleanup_stale_agent_workers()
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
        )
    )
