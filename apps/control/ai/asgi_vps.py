"""VPS entry point. Optional generation uses an Ollama service on the private network."""
import asyncio
import json
import os
import urllib.request
from urllib.parse import urlsplit
from service import handle, MAX_BODY


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def infer(_model, payload):
    origin = os.environ.get('OLLAMA_URL', 'http://ollama:11434')
    url = urlsplit(origin)
    if url.scheme not in {'http', 'https'} or not url.hostname or url.username or url.password or url.path not in {'', '/'} or url.query or url.fragment:
        raise ValueError('Invalid model server')
    request = urllib.request.Request(origin.rstrip('/') + '/api/chat',
        data=json.dumps({'model': os.environ.get('OLLAMA_MODEL', 'qwen2.5:1.5b'),
            'messages': payload['messages'], 'stream': False,
            'options': {'temperature': payload.get('temperature', 0.2), 'num_predict': payload['max_tokens']}}).encode(),
        headers={'Content-Type': 'application/json'})
    with urllib.request.build_opener(NoRedirect()).open(request, timeout=25) as response:
        raw = response.read(64_001)
        if len(raw) > 64_000 or not response.headers.get('Content-Type', '').startswith('application/json'):
            raise ValueError('Invalid model response')
        return {'response': json.loads(raw).get('message', {}).get('content')}


async def app(scope, receive, send):
    if scope['type'] == 'lifespan':
        while True:
            message = await receive()
            await send({'type': message['type'] + '.complete'})
            if message['type'] == 'lifespan.shutdown':
                return
    if scope['type'] != 'http':
        return
    body = bytearray()
    while True:
        message = await receive()
        if message['type'] == 'http.disconnect':
            return
        body.extend(message.get('body', b''))
        if len(body) > MAX_BODY or not message.get('more_body', False):
            break
    headers = {key.decode().lower(): value.decode() for key, value in scope.get('headers', [])}
    async def run_model(model, payload):
        return await asyncio.to_thread(infer, model, payload)
    configuration = {**os.environ, 'FAMA_AI_PROVIDER': 'local-python'}
    configuration.setdefault('FAMA_AI_MODEL', '@local/ollama/qwen2.5-1.5b-instruct')
    status, payload = await handle(scope['method'], scope['path'], headers, bytes(body), configuration, run_model)
    await send({'type': 'http.response.start', 'status': status, 'headers': [
        (b'content-type', b'application/json; charset=utf-8'), (b'cache-control', b'no-store'),
        (b'x-content-type-options', b'nosniff')]})
    await send({'type': 'http.response.body', 'body': json.dumps(payload, ensure_ascii=False).encode()})
