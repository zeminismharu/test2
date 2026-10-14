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
