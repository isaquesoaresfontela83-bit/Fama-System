"""Cloudflare Python Worker. Access is restricted to the Fama servers."""
import json
from urllib.parse import urlsplit
from workers import WorkerEntrypoint, Response
from js import Object
from pyodide.ffi import to_js
from service import handle, MAX_BODY


class Default(WorkerEntrypoint):
    async def fetch(self, request):
        config = {name: getattr(self.env, name, "") for name in (
            "FAMA_AI_SERVICE_TOKEN", "FAMA_AI_MODEL", "FAMA_AI_GENERATIVE_ENABLED",
            "FAMA_AI_MAX_TOKENS", "FAMA_AI_TIMEOUT_MS")}
        headers = {name: request.headers.get(name) or "" for name in ("authorization", "content-type")}
        # Read incrementally to enforce the real limit without trusting Content-Length.
        body = bytearray()
        if request.body:
            reader = request.body.getReader()
            try:
                while True:
                    part = await reader.read()
                    if part.done:
                        break
                    body.extend(part.value.to_py())
                    if len(body) > MAX_BODY:
                        await reader.cancel()
                        return Response.json({"error": "Consulta muito grande."}, status=413)
            finally:
                reader.releaseLock()

        async def run_model(model, payload):
            result = await self.env.AI.run(model, to_js(payload, dict_converter=Object.fromEntries))
            return result.to_py() if hasattr(result, "to_py") else result

        status, payload = await handle(request.method, urlsplit(request.url).path, headers, bytes(body), config, run_model)
        return Response(json.dumps(payload, ensure_ascii=False), status=status, headers={
            "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store",
            "X-Content-Type-Options": "nosniff"})
