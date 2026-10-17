# 밈 포맷 — 작업 규칙

## 답하는 방식
- 한국어로, 쉬운 말로 답합니다.
- 모르면 모른다고 말합니다. 확인하지 못한 것은 확인하지 못했다고 적습니다.
- 답의 끝에 "물어보면 좋은 질문 3가지"를 붙입니다.
- 작업을 마무리할 때는 맨 마지막에 실제 사이트 주소를 적습니다: https://zeminism-meme.pages.dev

## 구조
- `app/` 이 그대로 Cloudflare Pages 에 올라갑니다. 빌드 과정 없음. 아이디어 아카이브(zeminismharu/test)와 같은 계정·같은 방식.
- 서버는 `app/_worker.js` 한 파일 (D1 = DB, 비밀값 ADMIN_PASSWORD · YOUTUBE_API_KEY · ANTHROPIC_API_KEY, 선택 CLAUDE_MODEL).
- 모든 API 는 로그인 필요. ADMIN_PASSWORD 가 없으면 아무도 못 씀 (유튜브 쿼터·Claude 요금 보호). 아카이브의 '열린 모드'와 다름.
- 표는 `ensureSchema` 가 자동으로 만듭니다. 칸을 추가할 때는 ALTER 를 따로 넣어야 합니다.
- Claude 호출은 fetch 로 직접 (빌드 과정이 없어서 SDK 를 쓰지 않음). 답은 `output_config.format` json_schema 로 받고, `fallbacks: "default"` 로 거절 시 다른 모델.
- 원래 Python CLI(2026-10-17 사장님이 zip 으로 줌)를 웹으로 옮긴 것. Python 판은 이 저장소에 넣지 않음.
- 로컬 시험용으로 `YOUTUBE_API_BASE`, `ANTHROPIC_BASE_URL` 을 바꿀 수 있음 (가짜 서버로 시험할 때).

## 배포
- 자동 아님. GitHub Actions → "사이트 배포 (밈 포맷)" → Run workflow.
- 수집은 `.github/workflows/collect.yml` (매일 UTC 0:23·12:23 = 한국 9:23·21:23). 예약 실행은 기본 브랜치(main)에 있어야 돕니다.
