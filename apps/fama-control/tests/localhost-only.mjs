// Preload for offline tests. Production services cannot receive test requests.
const nativeFetch = globalThis.fetch;
globalThis.fetch = async (input, init = {}) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.protocol !== 'http:' || !['127.0.0.1', 'localhost', '[::1]'].includes(url.hostname)) {
    throw new Error('External network is disabled in localhost tests. Use a provider fixture.');
  }
  return nativeFetch(input, { ...init, redirect: 'error' });
};
