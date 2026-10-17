# 밈 포맷 — 숏폼 형식 수집·정형화 도구

지금 뜨는 숏폼을 찾고, 그 형식을 "포맷 카드"로 정리한 뒤, 업체용 대본으로 바꾸는 웹앱입니다.
아이디어 아카이브(`zeminismharu/test`)와 같은 방식으로 Cloudflare Pages 에 올라갑니다.

- 주소: https://zeminism-meme.pages.dev (배포 후 열림, 로그인해야 씀)

## 흐름

1. **수집**: 유튜브에서 최근 짧은 영상을 찾고 조회수를 기록 (하루 2번 자동, 한국 시간 오전·오후 9시 23분쯤. '지금 수집' 단추도 있음)
2. **등록**: 틱톡·인스타에서 본 영상은 링크와 메모로 직접 등록
3. **순위**: 시간당 조회수 증가 속도 순. CSV 로 받기
4. **메모 → 포맷 카드**: 볼 만한 영상에 메모를 달고 Claude 로 카드 만들기
5. **대본**: 포맷 카드를 설정 화면의 업체 정보로 대본화 (만든 대본은 저장됨)

## 처음 한 번 (배포 준비)

1. GitHub 이 저장소 → **Settings → Secrets and variables → Actions → New repository secret**
2. 아래 5개를 넣기

| 이름 | 값 |
|---|---|
| `CLOUDFLARE_API_TOKEN` | Cloudflare 토큰 (권한: Account · Cloudflare Pages · Edit, Account · D1 · Edit). 아이디어 아카이브 토큰을 같이 써도 되고, 따로 만들면 더 안전 |
| `CLOUDFLARE_ACCOUNT_ID` | 아이디어 아카이브와 같은 계정 ID |
| `ADMIN_PASSWORD` | 로그인 비밀번호. **꼭 필요** (없으면 아무도 못 씀 — API 요금 보호) |
| `YOUTUBE_API_KEY` | Google Cloud Console → YouTube Data API v3 키 |
| `ANTHROPIC_API_KEY` | https://console.anthropic.com 에서 만든 Claude API 키 |

3. (선택) **Variables** 탭에 `CLAUDE_MODEL` — 기본은 `claude-sonnet-5-5`
4. **Actions → "사이트 배포 (밈 포맷)" → Run workflow**

이 저장소는 공개 저장소입니다. 키는 꼭 Secrets 에만 넣고 파일에 적지 마세요 (`.env` 는 `.gitignore` 에 있음).

## 구조

- `app/` 이 그대로 Cloudflare Pages 에 올라갑니다. 빌드 과정 없음.
- 서버는 `app/_worker.js` 한 파일 (D1 = DB). 화면은 `index.html` · `app.js` · `style.css`.
- `.github/workflows/deploy.yml` 배포(단추), `collect.yml` 하루 2번 수집.

## 알아둘 한계

- 틱톡·인스타 조회수는 자동 수집하지 않습니다. 공식 API로 일반 개인이 접근하기 어렵고, 스크래핑은 약관 위반입니다.
- Claude 는 영상을 보지 않습니다. 카드 품질은 메모의 구체성에 달려 있습니다.
- 따라 하는 것은 형식뿐. 원본 영상·음원은 쓰지 않고, 음원은 업로드 앱의 라이브러리에서 고릅니다.
- 쇼츠 판별은 길이(기본 180초 이하)로 근사합니다.
- 유튜브 쿼터: 기본 하루 10,000 단위, 검색 1회 100 단위. 검색어 5개 × 하루 2번 ≈ 1,000 단위.
- 순위는 같은 영상의 스냅샷 두 개가 1시간 이상 떨어져 있어야 나옵니다.

## 다음에 붙일 것

- [x] 수집 자동 실행 (GitHub Actions 하루 2번)
- [x] 순위 CSV 내보내기
- [ ] 대본을 숏폼 자동 편집 도구의 설정 파일로 바로 내보내기 (도구가 정해지면)

---

이 저장소에 원래 있던 GitHub Codespaces 예제(`notebooks/`, `data/`, `.devcontainer/`)는 그대로 두었습니다.
