# 차분한치킨

> 일단 모르겠고 차분해지는 치킨이나 먹고 싶다

기획서는 [CLAUDE.md](CLAUDE.md)에 있습니다. 게임 흐름 전체(키오스크 설문 → 때리기 → 흔들기 → 던지기 → 튀기기 → 뿌시기 → 결과 카드)가 들어 있습니다.
그림은 아직 없어서 임시 도형을 쓰고, 효과음도 브라우저에서 만든 임시 소리를 씁니다.
그림·소리 파일을 넣는 방법은 CLAUDE.md 9번에 있습니다.

## 로컬에서 확인하기

처음 한 번만:

```bash
npm install
cp .dev.vars.example .dev.vars   # 그리고 .dev.vars 안에 Pexels API 키를 넣기
```

### 화면만 빠르게 보기

```bash
npm run dev
```

터미널에 나온 주소(보통 http://localhost:5173)를 엽니다. 코드를 고치면 바로 반영됩니다.
이때 `/api/photo`는 꺼져 있어서 마지막 화면에서 "사진을 못 가져왔어요"가 나옵니다. 정상입니다.

### 사진까지 확인 (Cloudflare와 같은 환경)

```bash
npm run preview
```

빌드한 뒤 wrangler가 화면과 Pages Function을 함께 띄웁니다. http://localhost:8788 을 엽니다.
설문을 끝까지 하면 마지막 화면에 Pexels 사진과 작가 표기가 나옵니다.

> 코드를 고치면서 사진까지 보고 싶으면 터미널 두 개를 씁니다.
> 하나는 `npm run build && npm run dev:api`(8788), 다른 하나는 `npm run dev`(5173) — 5173에서 `/api` 요청이 8788로 넘어갑니다.

### 원하는 단계부터 바로 시험하기

주소 뒤에 `?skip=단계` 를 붙이면 설문을 건너뜁니다.

- `?skip=crush` — 뿌시기부터 (`&fry=raw` / `golden` / `burnt` 로 튀김 상태, `&q=바다` 로 속 재료)
- `?skip=beat`, `?skip=shake`, `?skip=throw`, `?skip=fry`, `?skip=result`

소리는 화면을 한 번 누른 다음부터 납니다.

### 폰에서 보기

`npm run dev` 를 켜면 `Network: http://192.168.x.x:5173` 주소도 나옵니다. 같은 와이파이에 있는 폰으로 그 주소를 엽니다.
컴퓨터 브라우저에서는 개발자 도구의 기기 모드(Chrome: F12 → 휴대폰 아이콘)로 세로 화면을 볼 수 있습니다.

> **폰 흔들기(3단계)는 https 주소에서만 됩니다.** `http://192.168...` 로 열면 아이폰·안드로이드 모두 흔들림 센서를 막습니다.
> 이때는 손가락으로 봉지를 좌우로 문지르면 됩니다. 실제 흔들기는 Cloudflare Pages 에 올린 `https://...pages.dev` 주소에서 시험하세요.

## Cloudflare Pages에 배포하기

1. Cloudflare 대시보드 → **Workers & Pages** → **Create** → **Pages** → **Connect to Git** → 이 저장소 선택
2. 빌드 설정
   - Framework preset: **Vite** (또는 None)
   - Build command: `npm run build`
   - Build output directory: `dist`
3. **Settings → Variables and Secrets** 에 `PEXELS_API_KEY` 를 **Secret** 으로 추가 (Production, Preview 둘 다)
4. 저장 후 다시 배포. 이후로는 푸시하면 자동 배포됩니다.

`functions/` 폴더는 Cloudflare가 알아서 Pages Function으로 올립니다. `/api/photo` 주소가 됩니다.

## /api/photo

`GET /api/photo?q=고양이`

- 검색어 = 차분한 수식어(랜덤) + 입력. 결과가 없으면 입력만으로, 그래도 없으면 "잠자는 강아지"로 찾습니다.
- 같은 검색어 결과는 Cloudflare 캐시에 하루 동안 저장합니다 (Pexels 한도 절약).
- 응답 예: `{ "query": "포근한 고양이", "level": "modifier", "photo": { "src", "photographer", "photographerUrl", "pexelsUrl", ... } }`
- 오류: `empty_query`(400), `banned`(400, 금지어), `missing_api_key`(500), `pexels_failed`(502)

## /api/image

`GET /api/image?src=https://images.pexels.com/...` — Pexels 사진을 우리 주소로 대신 받아 줍니다.
다른 사이트의 사진을 캔버스에 그리면 브라우저가 "이미지 저장"을 막을 수 있어서, 사진을 바로 못 불러오면 이 길로 다시 불러옵니다.
`images.pexels.com` 외의 주소는 거절합니다.

## 폴더

CLAUDE.md 9번에 정리해 두었습니다.

`notebooks/`, `data/`, `requirements.txt` 는 이 저장소를 처음 만들 때 있던 Jupyter 템플릿 파일로, 차분한치킨과는 관계없습니다.
