// GET /api/image?src=https://images.pexels.com/...
// Pexels 사진을 우리 주소로 대신 받아 준다. 브라우저가 다른 사이트 사진을 캔버스에 그리면
// "이미지 저장"이 막히는데(CORS), 같은 주소에서 온 사진은 막히지 않는다.
// 아무 주소나 대신 받아 주면 위험하므로 images.pexels.com 만 허용한다.
const ALLOWED_HOST = 'images.pexels.com';
const CACHE_SECONDS = 60 * 60 * 24 * 7;

export async function onRequestGet({ request }) {
  const raw = new URL(request.url).searchParams.get('src') || '';
  let src;
  try {
    src = new URL(raw);
  } catch {
    return new Response('bad src', { status: 400 });
  }
  if (src.protocol !== 'https:' || src.hostname !== ALLOWED_HOST) {
    return new Response('host not allowed', { status: 403 });
  }

  const upstream = await fetch(src.toString(), { cf: { cacheEverything: true, cacheTtl: CACHE_SECONDS } });
  const type = upstream.headers.get('content-type') || '';
  if (!upstream.ok || !type.startsWith('image/')) {
    return new Response('upstream failed', { status: 502 });
  }
  return new Response(upstream.body, {
    headers: {
      'Content-Type': type,
      'Cache-Control': `public, max-age=${CACHE_SECONDS}`,
    },
  });
}
