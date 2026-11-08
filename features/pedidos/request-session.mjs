/** Carry rotated session cookies through internal authorization calls and back to the browser. */
export function sessionForwarder(app, request) {
  const jar = new Map((request.headers.get('cookie') || '').split(';').flatMap(part => {
    const index = part.indexOf('=');
    return index < 1 ? [] : [[part.slice(0,index).trim(),part.slice(index+1).trim()]];
  }));
  const cookies = [];
  let changed = false;
  return {
    app: {...app, async fetch(input, env, ctx) {
      const headers = new Headers(input.headers);
      if (changed) {
        if (jar.size) headers.set('cookie', [...jar].map(([key,value]) => `${key}=${value}`).join('; '));
        else headers.delete('cookie');
      }
      const response = await app.fetch(new Request(input,{headers}), env, ctx);
      const values = typeof response.headers.getSetCookie === 'function' ? response.headers.getSetCookie()
        : typeof response.headers.getAll === 'function' ? response.headers.getAll('Set-Cookie')
        : (response.headers.get('set-cookie') || '').split(/,(?=\s*[^;,\s]+=)/).filter(Boolean);
      for (const value of values) {
        cookies.push(value);
        const pair = value.split(';',1)[0], index = pair.indexOf('=');
        if (index < 1) continue;
        const name = pair.slice(0,index).trim();
        changed = true;
        if (/;\s*max-age\s*=\s*0(?:;|$)/i.test(value)) jar.delete(name);
        else jar.set(name,pair.slice(index+1));
      }
      return response;
    }},
    finish(response) {
      if (!response || !cookies.length) return response;
      const headers = new Headers(response.headers);
      for (const value of new Set(cookies)) headers.append('set-cookie',value);
      headers.set('cache-control','private, no-store');
      return new Response(response.body,{status:response.status,statusText:response.statusText,headers});
    },
  };
}
