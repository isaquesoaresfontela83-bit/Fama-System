/** Cache API fixture consumes complete response bodies, like Cache.put. */
export function memoryCacheStorage() {
  const stores = new Map();
  return {
    stores, deny: false, failWrites: false,
    async open(name) {
      if (this.deny) throw new DOMException('Storage disabled', 'SecurityError');
      if (!stores.has(name)) stores.set(name, new Map());
      const entries = stores.get(name);
      const storage = this;
      const key = input => typeof input === 'string' ? input : input.url;
      return {
        async match(input) { return entries.get(key(input))?.clone(); },
        async put(input, response) {
          if (storage.failWrites) throw new DOMException('Storage full', 'QuotaExceededError');
          const bytes = await response.arrayBuffer();
          entries.set(key(input), new Response(bytes, { status: response.status, headers: response.headers }));
        },
        async keys() { return [...entries.keys()].map(url => new Request(url)); },
        async delete(input) { return entries.delete(key(input)); },
      };
    },
  };
}
