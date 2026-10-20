"""Portable ASGI entry point: uvicorn asgi:app --app-dir ai --port 8000."""
import asyncio
import json
import os
import urllib.request
from service import handle, MAX_BODY


class NoRedirect(urllib.request.HTTPRedirectHandler):
    def redirect_request(self, *args, **kwargs):
        return None


def infer(model, payload):
    account, token = os.environ.get("CLOUDFLARE_ACCOUNT_ID", ""), os.environ.get("CLOUDFLARE_AI_TOKEN", "")
    import re
    if not re.fullmatch(r"[a-f0-9]{32}", account) or not token or "\n" in token or "\r" in token:
        raise ValueError("Provider is not configured")
    request = urllib.request.Request(f"https://api.cloudflare.com/client/v4/accounts/{account}/ai/run/{model}",
        data=json.dumps(payload).encode(), headers={"Content-Type": "application/json", "Authorization": f"Bearer {token}"})
    with urllib.request.build_opener(NoRedirect()).open(request, timeout=20) as response:
        raw = response.read(64_001)
        if len(raw) > 64_000 or not response.headers.get("Content-Type", "").startswith("application/json"):
            raise ValueError("Invalid provider response")
        data = json.loads(raw)
        if data.get("success") is not True:
            raise ValueError("Inference unavailable")
        return data.get("result")


async def app(scope, receive, send):
    if scope["type"] == "lifespan":
        while True:
            message = await receive()
            await send({"type": message["type"] + ".complete"})
            if message["type"] == "lifespan.shutdown":
                return
    if scope["type"] != "http":
        return
    body = bytearray()
    while True:
        message = await receive()
        if message["type"] == "http.disconnect":
            return
        body.extend(message.get("body", b""))
        if len(body) > MAX_BODY or not message.get("more_body", False):
            break
    headers = {key.decode().lower(): value.decode() for key, value in scope.get("headers", [])}
    async def run_model(model, payload):
        return await asyncio.to_thread(infer, model, payload)
    status, payload = await handle(scope["method"], scope["path"], headers, bytes(body), os.environ, run_model)
    await send({"type": "http.response.start", "status": status, "headers": [
        (b"content-type", b"application/json; charset=utf-8"), (b"cache-control", b"no-store"),
        (b"x-content-type-options", b"nosniff")]})
    await send({"type": "http.response.body", "body": json.dumps(payload, ensure_ascii=False).encode()})
