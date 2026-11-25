export async function onRequest(context) {
  const { request, params } = context;
  const raw = params.path;
  const path = Array.isArray(raw) ? raw.join('/') : (raw || '');
  const incoming = new URL(request.url);

  const target = new URL(`https://mbbsadmissionguide-in.wahidiqubal9.workers.dev/api/${path}`);
  target.search = incoming.search;

  const headers = new Headers(request.headers);
  headers.delete('host');
  headers.delete('content-length');

  const init = { method: request.method, headers, redirect: 'manual' };
  if (request.method !== 'GET' && request.method !== 'HEAD') {
    init.body = await request.arrayBuffer();
  }

  const res = await fetch(target, init);
  const out = new Headers(res.headers);
  out.delete('content-encoding');
  out.delete('content-length');
  return new Response(res.body, { status: res.status, headers: out });
}
