import { createServer } from 'node:http';
const nativeFetch = globalThis.fetch;

// Test transport only: no development server, public listener or production credentials.
export async function withLocalApi(routes, run) {
  const server = createServer(async (incoming, outgoing) => {
    try {
      const headers = new Headers();
      for (const [key, value] of Object.entries(incoming.headers)) {
        for (const item of Array.isArray(value) ? value : [value]) {
          if (item !== undefined) headers.append(key, item);
        }
      }
      const chunks = [];
      for await (const chunk of incoming) chunks.push(chunk);
      const url = new URL(incoming.url, `http://127.0.0.1:${server.address().port}`);
      const method = incoming.method ?? 'GET';
      const handler = routes[url.pathname]?.[method];
      const request = new Request(url, {
        method, headers,
        ...(!['GET', 'HEAD'].includes(method) ? { body: Buffer.concat(chunks) } : {}),
      });
      const response = handler ? await handler(request) : Response.json({ error: 'Unknown test route' }, { status: 404 });
      outgoing.writeHead(response.status, Object.fromEntries(response.headers));
      outgoing.end(Buffer.from(await response.arrayBuffer()));
    } catch (error) {
      outgoing.destroy(error);
    }
  });
  await new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', resolve);
  });
  try {
    const origin = `http://127.0.0.1:${server.address().port}`;
    const localFetch = async (input, init = {}) => {
      const url = new URL(input instanceof Request ? input.url : String(input));
      if (url.origin !== origin) throw new Error('External network is disabled in localhost API tests.');
      // Never follow a test response to a second origin, even on machines where
      // the native transport can reach public services.
      return nativeFetch(input, { ...init, redirect: 'error' });
    };
    return await run(origin, localFetch);
  } finally {
    await new Promise((resolve, reject) => {
      server.close(error => error ? reject(error) : resolve());
      server.closeAllConnections();
    });
  }
}
