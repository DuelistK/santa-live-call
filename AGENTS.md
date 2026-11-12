# AGENTS.md — Santa Live Call MVP

실시간 WebRTC(`LiveKit`) 및 AI 아바타 파이프라인 기반의 **AI 산타할아버지 실시간 영상 통화 앱 (Santa Live Call MVP)** 프로젝트 지침서입니다.

---

## 1. 시스템 아키텍처 (System Architecture)

```
[부모 설정 (/setup)]
       │ (아이 이름, 나이, 칭찬할 일, 당부할 습관, 선물 힌트)
       ▼
[Next.js API Route (/api/connection-details)]
       │ LiveKit AccessToken 발급 (Participant Metadata/Attributes 포함)
       ▼
[LiveKit Cloud Room] ◄──── WebRTC (Video/Audio/DataChannel) ────► [프론트엔드 (/call)]
       │                                                                │
       ▼                                                                ▼
[Python LiveKit Agent (/backend/agent.py)]                    [통화 종료 후 리포트 (/report)]
  ├─ STT: Deepgram (nova-2 / nova-3, ko)                      - 대화 중 추출된 희망 선물 키워드
  ├─ LLM: Google Gemini (gemini-2.5-flash)                    - 대화 요약 및 산타의 코멘트
  ├─ TTS: ElevenLabs (eleven_flash_v2_5)
  └─ Avatar Factory (AVATAR_PROVIDER 환경변수 스위칭)
       ├─ default: Anam (livekit-plugins-anam)
       ├─ option1: LemonSlice (livekit-plugins-lemonslice)
       └─ option2: HeyGen LiveAvatar (livekit-plugins-liveavatar)
```

---

## 2. 모노레포 폴더 구조 (Directory Structure)

```text
santa/
├── AGENTS.md                   # 프로젝트 아키텍처 및 에이전트 개발 지침
├── CLAUDE.md                   # @AGENTS.md 참조 파일
├── backend/                    # Python 3.11+ LiveKit Agent 서버
│   ├── pyproject.toml          # Python 패키지 의존성 정의
│   ├── requirements.txt        # pip 호환 의존성 목록
│   ├── .env.example            # 백엔드 환경변수 템플릿
│   └── agent.py                # 산타 AI 음성/영상 에이전트 & 아바타 팩토리
└── frontend/                   # Next.js 15 (App Router) + TypeScript + Tailwind CSS
    ├── .env.local.example      # 프론트엔드 환경변수 템플릿
    ├── package.json
    ├── tsconfig.json
    └── src/
        ├── app/
        │   ├── layout.tsx
        │   ├── page.tsx                        # 랜딩 -> /setup 리다이렉트 또는 인트로
        │   ├── setup/page.tsx                  # 부모용 '비밀 산타 노트' 설정 화면
        │   ├── call/page.tsx                   # 발신 대기 + 실시간 아바타 영상 통화 + PIP 화면
        │   ├── report/page.tsx                 # 통화 종료 후 산타의 비밀 리포트 화면
        │   └── api/
        │       ├── connection-details/route.ts # LiveKit Token & 메타데이터 발급 API
        │       └── report-summary/route.ts     # 대화록 기반 선물 추출/요약 폴백 API
        ├── context/
        │   └── SantaSessionContext.tsx         # 부모 설정값 & 대화 기록/리포트 상태 관리
        └── types/
            └── santa.ts                        # 공통 타입 정의 (SecretSantaNote, GiftReport 등)
```

---

## 3. 핵심 요구사항 및 가드레일 (Guardrails)

1. **동적 시스템 프롬프트 주입 (Dynamic Prompt Injection)**
   - 프론트엔드 `/setup`에서 입력한 `childName`, `childAge`, `praise`, `mission`, `giftHint` 데이터를 LiveKit Participant Metadata(및 Room Metadata)에 JSON으로 직렬화하여 전달합니다.
   - 백엔드 `agent.py`는 참가자 연결 시 메타데이터를 파싱하여 산타 페르소나 시스템 프롬프트에 즉시 반영합니다.

2. **동심 파괴 방지 및 대화 규칙 (Child-Safe Persona)**
   - 항상 따뜻하고 인자한 말투와 **"호호호!"** 웃음소리를 자연스럽게 섞어 사용합니다.
   - 아이의 집중력을 고려해 **한 번에 1~2문장 이내**로 짧고 다정하게 대답합니다.
   - *"산타 진짜 있어요?"*, *"가짜 아니에요?"* 같은 의심 질문에도 동심을 지켜주며 북극 마을 에피소드(루돌프, 요정 이야기 등)로 재치 있게 넘어갑니다.
   - 통화 연결 직후 `session.generate_reply`를 호출하여 산타가 먼저 아이의 이름을 부르며 반갑게 첫인사를 건넵니다.

3. **아바타 프로바이더 팩토리 패턴 (Avatar Factory)**
   - 환경변수 `AVATAR_PROVIDER`(`anam` [기본값] | `lemonslice` | `heygen`)에 따라 코드 수정 없이 실시간 아바타 엔진을 스위칭할 수 있어야 합니다.
   - 아바타 API 키가 설정되지 않은 로컬 UI 테스트 환경에서도 음성 에이전트 및 UI 플로우가 크래시 없이 우아하게(Graceful fallback) 동작하도록 구현합니다.

4. **백그라운드 선물 키워드 추출 및 리포트 연동**
   - 아이와의 대화 중 언급된 받고 싶은 선물과 대화 요약을 추출하여 LiveKit DataChannel(`santa-report` 토픽) 및 프론트엔드 리포트 상태에 실시간 반영합니다.

---

## 4. 코딩 컨벤션 (Coding Conventions)

- **Backend (Python 3.11+):**
  - `livekit-agents` 1.x의 `Agent`, `AgentSession`, `@function_tool` 패턴을 준수합니다.
  - 타입 힌트(`typing`, `dataclasses`, `pydantic`)와 구조화된 로깅(`logging`)을 적극 사용합니다.
- **Frontend (Next.js 15 + TypeScript):**
  - 모바일 뷰포트(9:16 세로형 스마트폰 비율)를 최우선 타겟으로 하여 반응형 WebView 호환 레이아웃으로 제작합니다.
  - 통화 대기 화면에서 아바타 비디오 트랙이 수신되면 부드러운 **Cross-fade(`opacity` 트랜지션)** 효과를 적용합니다.
