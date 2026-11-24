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
import re
import time
from dataclasses import asdict, dataclass, field
from typing import Any, Optional

from dotenv import load_dotenv

# OpenTelemetry 백그라운드 SSL 재시도 스팸 및 GIL 경합으로 인한 오디오 지연 차단
os.environ.setdefault("OTEL_SDK_DISABLED", "true")
os.environ.setdefault("OTEL_TRACES_EXPORTER", "none")
os.environ.setdefault("OTEL_METRICS_EXPORTER", "none")
os.environ.setdefault("OTEL_LOGS_EXPORTER", "none")

# Windows / 사내 네트워크 환경에서 Python 및 Rust(livekit-rtc) 엔진 모두 OS 루트 인증서를 신뢰하도록 설정
def _configure_windows_ca_bundle() -> None:
    try:
        import base64
        import ssl
        import certifi

        bundle_path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "combined_cacert.pem")
        if not os.path.exists(bundle_path):
            seen_certs: set[bytes] = set()
            pem_certs: list[str] = []
            for store_name in ("ROOT", "CA"):
                for cert, encoding, _ in ssl.enum_certificates(store_name):
                    if encoding == "x509_asn" and cert not in seen_certs:
                        seen_certs.add(cert)
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
        # 거부하지 않도록 기본 SSLContext 생성 시 VERIFY_X509_STRICT 플래그를 해제하고,
        # 프로세스 시작 시 1회만 인증서 번들을 파싱하여 이벤트 루프 블로킹(오디오 지연)을 완전히 제거합니다.
        _orig_create_default_context = ssl.create_default_context
        _shared_server_auth_ctx = _orig_create_default_context(
            ssl.Purpose.SERVER_AUTH, cafile=bundle_path
        )
        if hasattr(ssl, "VERIFY_X509_STRICT"):
            _shared_server_auth_ctx.verify_flags &= ~ssl.VERIFY_X509_STRICT

        def _relaxed_create_default_context(
            purpose: Any = ssl.Purpose.SERVER_AUTH,
            *,
            cafile: Any = None,
            capath: Any = None,
            cadata: Any = None,
        ) -> ssl.SSLContext:
            if purpose == ssl.Purpose.SERVER_AUTH and capath is None and cadata is None:
                return _shared_server_auth_ctx
            ctx = _orig_create_default_context(
                purpose, cafile=cafile or bundle_path, capath=capath, cadata=cadata
            )
            if hasattr(ssl, "VERIFY_X509_STRICT"):
                ctx.verify_flags &= ~ssl.VERIFY_X509_STRICT
            return ctx

        ssl.create_default_context = _relaxed_create_default_context  # type: ignore

        # livekit.agents 서브프로세스가 agent.py import 이전에 preload한 aiohttp의 캐시된 SSLContext도 함께 갱신하여
        # Anam 등 자체 aiohttp.ClientSession()을 사용하는 플러그인의 SSL 인증서 오류(Missing Authority Key Identifier)를 방지합니다.
        try:
            import aiohttp.connector

            aiohttp.connector._SSL_CONTEXT_VERIFIED = _shared_server_auth_ctx  # type: ignore[attr-defined]
        except Exception:
            pass
    except Exception:
        pass


_configure_windows_ca_bundle()

from livekit import rtc
from livekit.agents import (
    APIConnectOptions,
    Agent,
    AgentSession,
    AutoSubscribe,
    JobContext,
    JobProcess,
    RunContext,
    StopResponse,
    WorkerOptions,
    cli,
    function_tool,
)
try:
    from livekit.agents.voice.io import _AudioSinkProxy
except ImportError:
    _AudioSinkProxy = None  # type: ignore
# 주의: LiveKit 플러그인들은 반드시 메인 스레드(파일 최상단)에서 import 해야 워커에 정상 등록됩니다!
from livekit.plugins import anam, deepgram, elevenlabs, google, lemonslice, liveavatar, silero, simli

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
1. 말투와 목소리 톤 유지 (가장 중요!):
   - 중후하고 따뜻하며 인자한 할아버지 말투를 일정한 속도로 차분하게 유지하세요.
   - **매번 대답을 "호호호"나 "허허허"로 시작하지 마세요! (연속 사용 절대 금지)**
   - 웃음소리("호호호," 또는 "허허허,")는 **첫인사**나 **정말 크게 기뻐하며 칭찬할 때(전체 대화 중 4~5번에 1번 이하)**만 가끔 자연스럽게 쓰고, 평소 대답은 "그래, 우리 {note.childName}이가...", "오, 정말 기특하구나.", "음, 그렇구나.", "맞아, 북극 마을에서도..."처럼 실제 할아버지가 손주와 대화하듯 자연스럽고 다양하게 시작하세요.
   - 목소리 톤이 얇아지거나 여자/젊은이 목소리로 튀지 않도록 **물결표(~)나 과도한 느낌표(!!)를 절대 사용하지 마세요.**
   - 문장 끝은 가급적 마침표(.)나 물음표(?)로 차분하게 마무리하고, **한 번에 반드시 1~2문장(최대 65자 이내)**으로 짧고 또렷하게 말한 뒤 아이의 대답을 기다리세요.
   - 숫자와 단위는 아라비아 숫자 대신 자연스러운 한글 발음(예: "여섯 살", "세 번", "열두 시")으로 적어서 음성 합성 지연을 줄이세요.
2. 동적 정보 활용:
   - 북극의 '착한 어린이 마법 수첩'에서 봤다면서 '{note.praise}'에 대해 구체적으로 칭찬해 주세요.
   - 대화 중 자연스럽게 '{note.mission}' 약속을 잘 지킬 수 있는지 손가락 걸고 약속을 받아내세요.
   - 크리스마스에 무슨 선물을 받고 싶은지 물어보고, 아이가 망설이면 '{note.giftHint}' 관련 이야기를 은근슬쩍 꺼내며 반응을 살펴보세요.
3. 동심 파괴 방지 (의심 대처):
   - 아이가 "산타 진짜 있어요?", "가짜 아니에요?", "아빠/로봇 아니에요?"라고 의심해도 절대 AI이거나 가짜라고 인정하지 마세요.
   - "방금 루돌프 코가 반짝이는 바람에 북극 카메라가 살짝 흔들렸나 보구나. 지금 요정 친구들이 옆에서 선물 리본을 묶고 있단다."처럼 동화적이고 재치 있게 넘어가세요.
4. 침묵 및 돌발 상황 대처:
   - 아이가 부끄러워하거나 말이 없으면 "우리 {note.childName}이가 산타할아버지를 보니까 조금 부끄러운가 보구나. 할아버지 흰 수염이 신기하지?"라며 다정하게 긴장을 풀어주세요.
5. 초저지연 즉시 응답 규칙:
   - 응답 지연을 막기 위해 통화 중에는 별도의 도구(function tool)를 호출하지 말고 **즉시 음성 대사 텍스트만 생성**하세요(선물 기록과 마법 연출은 백그라운드 시스템이 자동으로 처리합니다).
6. 작별 인사 및 통화 종료 규칙:
   - 아이가 "안녕히 계세요", "다음에 만나요", "빠이빠이", "끊을게요", "끊어주세요" 등 작별 인사를 건네거나 통화 종료를 원하면, 추가 질문을 절대 하지 말고 "그래, 우리 {note.childName} 어린이 다음에 또 만나자꾸나. 메리 크리스마스."처럼 1문장으로 따뜻하게 마무리 인사를 건네세요.
"""


# =====================================================================
# 3. 실시간 아바타 팩토리 (4종 모드: anam | simli | loop | hybrid + lemonslice/heygen)
# =====================================================================
class AvatarFactory:
    """
    환경변수 또는 프론트엔드 선택 모드(`anam` | `simli` | `loop` | `hybrid` | `lemonslice` | `heygen`)에 따라
    오디오-투-비디오(Audio-to-Video) 실시간 아바타 세션을 생성하는 팩토리 클래스입니다.
    """

    @staticmethod
    def create_avatar_session(override_provider: Optional[str] = None) -> Optional[Any]:
        provider = (override_provider or os.getenv("AVATAR_PROVIDER", "anam")).strip().lower()
        logger.info("Initializing avatar mode: %s", provider)

        # 대안 B 단독 모드: 유료 아바타 API 호출을 완전히 생략하고 프론트엔드 0원 모션 루프 스테이지 사용
        if provider == "loop":
            logger.info("Mode 'loop' (Option B only) selected — skipping external avatar API ($0/min).")
            return None

        # 대안 A 단독 모드: Simli 초저가($0.01/분) 실시간 립싱크 아바타
        if provider == "simli":
            simli_session = AvatarFactory._create_simli_avatar()
            if simli_session is not None:
                return simli_session
            logger.warning("SIMLI_API_KEY not set yet; falling back to Anam avatar for testing.")
            return AvatarFactory._create_anam_avatar()

        # 하이브리드 모드: 프론트엔드에서 0초 모션 루프로 즉시 시작한 뒤 백엔드 실사 산타 아바타(Anam 우선)로 자동 전환
        if provider == "hybrid":
            return AvatarFactory._create_anam_avatar() or AvatarFactory._create_simli_avatar()

        if provider == "heygen":
            return AvatarFactory._create_heygen_liveavatar()
        if provider == "lemonslice":
            return AvatarFactory._create_lemonslice_avatar()
        return AvatarFactory._create_anam_avatar()

    @staticmethod
    def _create_simli_avatar() -> Optional[Any]:
        api_key = os.getenv("SIMLI_API_KEY", "").strip()
        face_id = os.getenv("SIMLI_FACE_ID", "tmp9i8bbq7c").strip()

        if not api_key or api_key.startswith("your_"):
            logger.warning(
                "SIMLI_API_KEY is not configured in .env."
            )
            return None

        try:
            return simli.AvatarSession(
                simli_config=simli.SimliConfig(
                    api_key=api_key,
                    face_id=face_id,
                ),
                conn_options=APIConnectOptions(
                    max_retry=2,
                    retry_interval=1.2,
                    timeout=8.0,
                ),
            )
        except Exception as exc:
            logger.error("Failed to initialize Simli AvatarSession: %s", exc)
            return None

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
                conn_options=APIConnectOptions(
                    max_retry=1,
                    retry_interval=0.5,
                    timeout=8.0,
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
        self.recent_santa_texts: list[tuple[float, str]] = []
        self.report = SantaReportPayload(
            childName=note.childName,
            detectedGifts=[],
            conversationSummary=f"{note.childName} 어린이와 북극 산타 마을 영상 통화를 진행했습니다.",
            missionPromise=f"'{note.mission}' 약속을 산타할아버지와 함께 다짐했어요!",
            santaComment=f"올해 '{note.praise}' 모습을 보여준 {note.childName}, 정말 기특하구나! 호호호!",
        )

    @staticmethod
    def _normalize_hangul(text: str) -> str:
        return re.sub(r"[^가-힣0-9]", "", text)

    def record_santa_utterance(self, text: str) -> None:
        norm = self._normalize_hangul(text)
        if not norm:
            return
        now = time.monotonic()
        self.recent_santa_texts = [
            (ts, s) for ts, s in self.recent_santa_texts if (now - ts) <= 16.0
        ]
        self.recent_santa_texts.append((now, norm))

    def is_self_echo(self, user_text: str) -> bool:
        """스마트폰 스피커폰 최대 볼륨 사용 시 스피커 음성이 마이크로 되먹임(Echo)된 문장인지 판별합니다."""
        norm_user = self._normalize_hangul(user_text)
        if len(norm_user) < 5:
            return False
        now = time.monotonic()
        recent_norms = [s for ts, s in self.recent_santa_texts if (now - ts) <= 14.0]
        if not recent_norms:
            return False
        combined_santa = " ".join(recent_norms)
        if norm_user in combined_santa:
            return True
        user_bigrams = [norm_user[i : i + 2] for i in range(len(norm_user) - 1)]
        if not user_bigrams:
            return False
        matched = sum(1 for bg in user_bigrams if bg in combined_santa)
        return (matched / len(user_bigrams)) >= 0.62

    async def on_user_turn_completed(self, turn_ctx: Any, new_message: Any) -> None:
        try:
            raw_text = getattr(new_message, "text_content", "")
            if callable(raw_text):
                raw_text = raw_text()
            text_str = str(raw_text or "").strip()
            if text_str and self.is_self_echo(text_str):
                logger.info("Blocked speakerphone self-echo transcript: %s", text_str)
                raise StopResponse()
        except StopResponse:
            raise
        except Exception:
            pass

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

    async def trigger_santa_magic(
        self,
        effect_type: str,
        message: str = "",
    ) -> str:
        """
        통화 화면에 실시간 북극 마법 이펙트(눈꽃 파티클, 착한 어린이 도장, 루돌프 코 반짝임, 선물 상자)와 사운드를 실행합니다.
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

    async def publish_end_call(self, reason: str = "farewell") -> None:
        """LiveKit DataChannel ('santa-end-call' 토픽)을 통해 프론트엔드에 통화 자동 종료 신호를 전송합니다."""
        try:
            await self.publish_report_to_frontend()
            payload_bytes = json.dumps({"reason": reason}, ensure_ascii=False).encode("utf-8")
            await self.room.local_participant.publish_data(
                payload_bytes,
                reliable=True,
                topic="santa-end-call",
            )
            logger.info("Published santa-end-call to frontend (reason=%s)", reason)
        except Exception as exc:
            logger.warning("Could not publish santa-end-call packet: %s", exc)


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
    """
    import re

    text = utterance.strip()
    if len(text) < 2:
        return

    updated = False
    for kw in GIFT_CANDIDATE_KEYWORDS:
        if kw in text and kw not in santa_agent.report.detectedGifts:
            santa_agent.report.detectedGifts.append(kw)
            updated = True

    # 정규식으로 '~ 받고 싶어요 / 갖고 싶어요 / 사주세요' 앞의 구문도 자동 추출
    wish_match = re.search(
        r"([가-힣a-zA-Z0-9\s]{2,18}?)\s*(?:받고\s*싶|갖고\s*싶|사\s*주|선물\s*받고)",
        text,
    )
    if wish_match:
        raw_phrase = wish_match.group(1).strip()
        for prefix in ("산타할아버지", "할아버지", "저는요", "저는", "나는", "음", "그냥", "크리스마스에"):
            if raw_phrase.startswith(prefix):
                raw_phrase = raw_phrase[len(prefix) :].strip()
        if raw_phrase.endswith(("을", "를", "이", "가")):
            raw_phrase = raw_phrase[:-1].strip()
        if 2 <= len(raw_phrase) <= 15 and raw_phrase not in santa_agent.report.detectedGifts:
            santa_agent.report.detectedGifts.insert(0, raw_phrase)
            updated = True

    if updated:
        await santa_agent.publish_report_to_frontend()
        await santa_agent.publish_magic_fx(
            effect="gift",
            message=f"마법 수첩에 '{santa_agent.report.detectedGifts[0]}' 기록 🎁",
        )


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
            smart_format=False,
            no_delay=True,
            keywords=boost_terms,
            api_key=os.getenv("DEEPGRAM_API_KEY"),
        )
    except TypeError:
        stt_engine = deepgram.STT(
            model="nova-2",
            language="ko",
            smart_format=False,
            api_key=os.getenv("DEEPGRAM_API_KEY"),
        )

    # - LLM: Google Gemini Flash (최소 추론 thinking_level=MINIMAL + max_output_tokens=120으로 TTFT 최소화)
    gemini_model = os.getenv("GEMINI_MODEL", "gemini-3.5-flash-lite").strip()
    llm_kwargs: dict[str, Any] = {
        "model": gemini_model,
        "temperature": 0.7,
        "max_output_tokens": 120,
        "api_key": os.getenv("GOOGLE_API_KEY"),
    }
    if "2.5" in gemini_model:
        llm_kwargs["thinking_config"] = {"thinking_budget": 0}
    elif "3.5" in gemini_model:
        llm_kwargs["thinking_config"] = {"thinking_level": "MINIMAL"}
    llm_engine = google.LLM(**llm_kwargs)

    # - TTS: ElevenLabs 초저지연 Flash 모델(eleven_flash_v2_5) + auto_mode=False & 청크 스케줄 튜닝
    # (목소리 톤 안정성과 급발진 방지를 유지하면서 첫 음성 송출 지연만 단축합니다.)
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
        voice_settings=elevenlabs.VoiceSettings(
            stability=0.86,
            similarity_boost=0.88,
            style=0.0,
            speed=0.90,
            use_speaker_boost=True,
        ),
        auto_mode=False,
        apply_text_normalization="off",
    )

    # prewarm된 Silero VAD가 있으면 재사용하여 진입 시 ONNX 초기화 블로킹(150~250ms) 제거
    prewarmed_vad = getattr(ctx.proc, "userdata", {}).get("vad") if getattr(ctx, "proc", None) else None
    if prewarmed_vad is not None:
        vad_engine = prewarmed_vad
    else:
        try:
            vad_engine = silero.VAD.load(min_silence_duration=0.50, min_speech_duration=0.15)
        except TypeError:
            vad_engine = silero.VAD.load()

    # TurnHandlingOptions(v1.8+)로 고정:
    # - interruption mode="vad" + min_duration=0.65 / min_words=2로 50ms대 스피커 잔향/노이즈에 의한 오작동(자가 끊김) 원천 차단
    # - min_delay=0.55 유지 상태에서 preemptive_generation 활성화
    session = AgentSession(
        vad=vad_engine,
        stt=stt_engine,
        llm=llm_engine,
        tts=tts_engine,
        turn_handling={
            "endpointing": {
                "mode": "fixed",
                "min_delay": 0.55,
                "max_delay": 1.10,
            },
            "interruption": {
                "enabled": True,
                "mode": "vad",
                "min_duration": 0.65,
                "min_words": 2,
                "resume_false_interruption": True,
                "false_interruption_timeout": 1.2,
            },
            "preemptive_generation": {
                "enabled": True,
            },
        },
    )

    santa_agent = SantaClausAgent(note=note, room=ctx.room)
    last_activity_ts = asyncio.get_event_loop().time()
    last_magic_fx_time = 0.0
    child_turn_count = 0
    nudge_sent = False
    farewell_requested = False
    hangup_sent = False

    farewell_keywords = (
        "안녕히 계세요",
        "안녕히 가세요",
        "안녕히계세요",
        "안녕히가세요",
        "다음에 만나",
        "다음에 또 만나",
        "나중에 만나",
        "또 만나요",
        "끊을게",
        "끊어주",
        "끊어 주",
        "먼저 끊",
        "통화 종료",
        "빠이빠이",
        "바이바이",
        "잘 가요",
        "잘가요",
    )

    async def _trigger_graceful_hangup(delay_sec: float = 1.4, reason: str = "farewell") -> None:
        nonlocal hangup_sent
        await asyncio.sleep(delay_sec)
        if hangup_sent:
            return
        hangup_sent = True
        await santa_agent.publish_end_call(reason=reason)

    # 사용자/산타 대화가 추가될 때마다 프론트엔드 실시간 자막 및 대화록('santa-transcript' 토픽)으로 즉시 전송
    @session.on("conversation_item_added")
    def _on_conversation_item_added(event: Any) -> None:
        nonlocal last_activity_ts, last_magic_fx_time, child_turn_count, farewell_requested
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
            now_ts = asyncio.get_event_loop().time()
            last_activity_ts = now_ts

            if speaker == "child":
                if santa_agent.is_self_echo(text_str):
                    return
                child_turn_count += 1
                if any(kw in text_str for kw in farewell_keywords):
                    logger.info("Farewell detected from child transcript: %s", text_str)
                    farewell_requested = True
                    asyncio.create_task(_trigger_graceful_hangup(delay_sec=15.0, reason="farewell_timeout"))
            else:
                santa_agent.record_santa_utterance(text_str)
                # 산타의 마무리 인사(작별 요청 직후의 답변이거나, 대화 후반부 명확한 작별 멘트)가 끝났을 때 자동 통화 종료
                is_santa_closing = (
                    child_turn_count >= 1
                    and "?" not in text_str
                    and (
                        ("메리 크리스마스" in text_str and any(k in text_str for k in ("또 만나", "안녕", "끊어야", "썰매 점검")))
                        or any(k in text_str for k in ("전화를 끊어야", "다음에 또 만나자꾸나. 안녕", "안녕히 계세요"))
                    )
                )
                if farewell_requested or is_santa_closing:
                    farewell_requested = True
                    logger.info("Santa finished farewell speech; scheduling automatic call hangup in 1.4s.")
                    asyncio.create_task(_trigger_graceful_hangup(delay_sec=1.4, reason="farewell_completed"))

                # 산타 대사 중 핵심 이벤트가 있을 때만(최소 10초 간격 쿨다운 적용) 좌측 상단 소형 알림 표시
                if (now_ts - last_magic_fx_time) >= 10.0 and not farewell_requested:
                    if any(k in text_str for k in ("루돌프", "썰매")):
                        last_magic_fx_time = now_ts
                        asyncio.create_task(
                            santa_agent.publish_magic_fx("rudolph", "루돌프가 반짝이는 코로 인사해요 🦌")
                        )
                    elif any(k in text_str for k in ("약속", "손가락", "도장")):
                        last_magic_fx_time = now_ts
                        asyncio.create_task(
                            santa_agent.publish_magic_fx("stamp", "착한 어린이 약속 완료 ⭐")
                        )
                    elif any(k in text_str for k in ("수첩", "적어")):
                        last_magic_fx_time = now_ts
                        asyncio.create_task(
                            santa_agent.publish_magic_fx("gift", "북극 마법 수첩 기록 중 🎁")
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

    # 사용자 발화 시 백그라운드 선물 키워드 추출 및 작별 의사 감지 연결
    @session.on("user_input_transcribed")
    def _on_user_transcribed(event: Any) -> None:
        nonlocal last_activity_ts, farewell_requested
        transcript = getattr(event, "transcript", "")
        is_final = getattr(event, "is_final", True)
        if transcript:
            last_activity_ts = asyncio.get_event_loop().time()
        if is_final and transcript:
            if any(kw in transcript for kw in farewell_keywords):
                farewell_requested = True
                asyncio.create_task(_trigger_graceful_hangup(delay_sec=15.0, reason="farewell_timeout"))
            asyncio.create_task(extract_gift_keywords_in_background(transcript, santa_agent))

    # 프론트엔드 DataChannel 메시지('child-chat', 'parent-whisper', 'santa-vision-speak') 수신 연동
    @ctx.room.on("data_received")
    def _on_data_received(data_packet: rtc.DataPacket) -> None:
        nonlocal last_activity_ts, child_turn_count, farewell_requested
        try:
            topic = data_packet.topic
            text = data_packet.data.decode("utf-8").strip()
            if not text:
                return

            if topic == "child-chat":
                last_activity_ts = asyncio.get_event_loop().time()
                child_turn_count += 1
                logger.info("Received child-chat message from frontend: %s", text)
                if any(kw in text for kw in farewell_keywords):
                    farewell_requested = True
                    asyncio.create_task(_trigger_graceful_hangup(delay_sec=15.0, reason="farewell_timeout"))
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

    # 아바타 연결 실패/지연 시 기본 WebRTC 직접 음성 출력(RoomIO)으로 복구하기 위해 원본 오디오 싱크 보관
    orig_audio_tail: Any = None
    if _AudioSinkProxy is not None:
        cur_sink = getattr(session.output, "_audio_sink", None)
        while cur_sink is not None:
            if isinstance(cur_sink, _AudioSinkProxy):
                orig_audio_tail = cur_sink.next_in_chain
                break
            cur_sink = getattr(cur_sink, "next_in_chain", None)

    avatar = AvatarFactory.create_avatar_session(override_provider=note.avatarProvider)
    if avatar is not None:
        avatar_ready = False
        try:
            await asyncio.wait_for(avatar.start(session, room=ctx.room), timeout=10.0)
            logger.info("Real-time Santa avatar session started; waiting for remote video track...")
            # 아바타 비디오 트랙이 실제로 퍼블리시되어 오디오 수신 준비가 끝날 때까지 대기 (최대 6.5초)
            for _ in range(65):
                has_avatar_video = any(
                    pub.kind == rtc.TrackKind.KIND_VIDEO
                    for p in ctx.room.remote_participants.values()
                    for pub in p.track_publications.values()
                )
                if has_avatar_video:
                    avatar_ready = True
                    break
                await asyncio.sleep(0.1)
            if avatar_ready:
                await asyncio.sleep(0.35)
                logger.info("Remote avatar video track confirmed ready.")
            else:
                logger.warning(
                    "Avatar participant did not publish video within 6.5s; restoring direct voice output."
                )
        except Exception as exc:
            logger.error("Avatar session failed to start; restoring direct voice output: %s", exc)

        if avatar_ready:
            # 사용자가 통화를 종료하거나 모드를 전환할 때 25초 리포트 업로드를 기다리지 않고 아바타 세션을 즉시 닫아 429 제한 방지
            avatar_closed = False

            def _on_participant_disconnected(participant: rtc.RemoteParticipant) -> None:
                nonlocal avatar_closed
                if avatar_closed or participant.identity == getattr(avatar, "avatar_identity", ""):
                    return
                avatar_closed = True
                asyncio.create_task(avatar.aclose())

            ctx.room.on("participant_disconnected", _on_participant_disconnected)
        else:
            if orig_audio_tail is not None:
                try:
                    session.output.replace_audio_tail(orig_audio_tail)
                except Exception as restore_exc:
                    logger.warning("Failed to restore orig_audio_tail: %s", restore_exc)
            try:
                await avatar.aclose()
            except Exception:
                pass

    # 초기 리포트 상태 프론트엔드 동기화
    await santa_agent.publish_report_to_frontend()

    # 5. 통화 연결 직후 산타가 먼저 반갑게 첫인사 (느낌표 남발 없이 차분하고 일정한 속도로 1~2문장 발화)
    is_generic_name = note.childName in ("착한 어린이", "우리 아이", "아이", "")
    if is_generic_name:
        opening_instructions = (
            "방금 영상 통화가 연결되었습니다. "
            "'호호호, 안녕, 북극 산타 마을에서 산타할아버지가 전화했단다.'라고 차분하고 인자하게 인사한 뒤, "
            "'우리 멋진 친구 이름이 무엇인지 할아버지에게 알려줄래?'라고 "
            "1~2문장으로 다정하게 물어보세요."
        )
    elif note.stampsCollected >= 5:
        opening_instructions = (
            f"방금 영상 통화가 연결되었습니다. "
            f"'호호호, 우리 {note.childName} 어린이, 약속 별 도장 다섯 개를 전부 모았다고 요정들이 알려줬단다. 정말 기특하구나.'라며 "
            f"1~2문장으로 차분하고 따뜻하게 축하 인사를 건네세요."
        )
    elif note.previousCallCount >= 1:
        opening_instructions = (
            f"방금 '{note.childName}' 어린이와 다시 영상 통화가 연결되었습니다. "
            f"'호호호, 우리 {note.childName} 어린이, 또 만나서 반갑구나. 지난번에 할아버지랑 약속했던 {note.lastPromise or note.mission} 잘 지키고 있니?'라고 "
            f"1~2문장으로 차분하고 다정하게 첫인사를 건네세요."
        )
    else:
        opening_instructions = (
            f"방금 영상 통화가 연결되었습니다. "
            f"'호호호, 우리 {note.childName} 어린이 안녕, 북극 산타 마을에서 산타할아버지가 전화했단다.'라고 "
            f"차분하게 시작하고, 올해 '{note.praise}' 한 모습을 마법 수첩에서 봤다고 1~2문장으로 따뜻하게 첫인사를 건네세요."
        )

    await session.generate_reply(instructions=opening_instructions)
    last_activity_ts = asyncio.get_event_loop().time()

    # 6. 침묵 넛지(아이가 한 번도 말을 안 한 상태에서 산타 첫인사 완료 후 18초 무응답 시 1회) & 150초 자연 마무리
    async def _call_lifecycle_guardian() -> None:
        nonlocal nudge_sent, farewell_requested
        call_started = asyncio.get_event_loop().time()
        wrapup_sent = False
        try:
            while ctx.room.connection_state == rtc.ConnectionState.CONN_CONNECTED:
                await asyncio.sleep(3.0)
                if farewell_requested or hangup_sent:
                    break
                now = asyncio.get_event_loop().time()

                if (
                    not nudge_sent
                    and child_turn_count == 0
                    and (now - last_activity_ts) >= 18.0
                    and (now - call_started) < 65.0
                ):
                    nudge_sent = True
                    session.generate_reply(
                        instructions=(
                            f"아이가 부끄러워서 아직 말을 못 하고 있습니다. "
                            f"'산타할아버지 흰 수염이 신기해서 보고 있구나. 고개만 끄덕여도 할아버지는 다 보인단다.'라고 "
                            f"웃음소리 없이 1문장으로 차분하고 다정하게 긴장을 풀어주세요."
                        )
                    )

                # 사용자가 대화를 계속 이어가는 동안에는 시간제한 없이 얼마든지 길게 통화할 수 있도록 보장하고,
                # 통화 2분 경과 후 45초 이상 완전 침묵(무응답)이 지속될 때만 자연스럽게 마무리 인사를 건네고 종료합니다.
                if (
                    not wrapup_sent
                    and not farewell_requested
                    and (now - call_started) >= 120.0
                    and (now - last_activity_ts) >= 45.0
                ):
                    wrapup_sent = True
                    farewell_requested = True
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
                            f"'앗, 요정 친구들이 루돌프 썰매 점검 시간이라고 종을 울리는구나. 우리 {note.childName}, 약속 꼭 지키고 크리스마스에 또 만나자. 메리 크리스마스.'라고 "
                            f"1~2문장으로 다정하게 작별 인사를 건네세요."
                        )
                    )
                    asyncio.create_task(_trigger_graceful_hangup(delay_sec=15.0, reason="wrapup_timeout"))
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


def prewarm_process(proc: JobProcess) -> None:
    """워커 유휴 서브프로세스를 미리 초기화하여 모드 전환/재접속 시 콜드 스타트 지연과 SSL 오류를 방지합니다."""
    _configure_windows_ca_bundle()
    try:
        proc.userdata["vad"] = silero.VAD.load(min_silence_duration=0.50, min_speech_duration=0.15)
    except Exception:
        try:
            proc.userdata["vad"] = silero.VAD.load()
        except Exception:
            pass


if __name__ == "__main__":
    _cleanup_stale_agent_workers()
    cli.run_app(
        WorkerOptions(
            entrypoint_fnc=entrypoint,
            prewarm_fnc=prewarm_process,
            num_idle_processes=2,
        )
    )
