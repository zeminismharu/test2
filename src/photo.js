// 속 재료 사진을 /api/photo 에 요청한다. 실패해도 게임은 계속 간다.
export async function fetchCalmPhoto(word) {
  try {
    const res = await fetch(`/api/photo?q=${encodeURIComponent(word)}`);
    const data = await res.json().catch(() => ({ error: `http_${res.status}` }));
    if (!res.ok || !data.photo) return { photo: null, error: data.error || `http_${res.status}` };
    return { photo: data.photo, query: data.query, level: data.level };
  } catch (err) {
    return { photo: null, error: 'network' };
  }
}

// 사진을 캔버스에 그려도 "이미지 저장"이 막히지 않게 불러온다.
//   ① Pexels 서버에서 바로 (crossOrigin) → ② 막히면 /api/image 를 거쳐서 → ③ 그래도 안 되면 null
export function ensurePhotoImage(state) {
  if (!state.photoImage) {
    state.photoImage = Promise.resolve(state.photoRequest).then(async (result) => {
      const src = result?.photo?.src;
      if (!src) return null;
      return (await loadImage(src, true)) || (await loadImage(`/api/image?src=${encodeURIComponent(src)}`, false));
    });
  }
  return state.photoImage;
}

function loadImage(src, cors) {
  return new Promise((resolve) => {
    const img = new Image();
    if (cors) img.crossOrigin = 'anonymous';
    img.decoding = 'async';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
