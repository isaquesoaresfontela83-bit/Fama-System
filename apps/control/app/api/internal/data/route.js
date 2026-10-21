import { env } from "cloudflare:workers";
import { isInternalRequest } from "@/lib/internal-auth";
import { readLimitedBody } from "@/lib/request-body";
import { RequestError } from "@/lib/request-error";
import { allowedDataPath } from "@/lib/internal-data-path";
const methods = new Set(["GET", "POST", "PATCH", "DELETE"]);
export async function POST(request) {
    const runtime = env;
    if (!await isInternalRequest(request)) {
        return Response.json({ error: "Acesso não autorizado." }, { status: 401 });
    }
    const path = request.headers.get("x-fama-data-path") ?? "";
    const method = request.headers.get("x-fama-data-method") ?? "GET";
    if (!methods.has(method) || !allowedDataPath(path, method)) {
        return Response.json({ error: "Operação não permitida." }, { status: 400 });
    }
    const baseUrl = String(runtime.SUPABASE_URL ?? "").replace(/\/+$/, "");
    const key = String(runtime.SUPABASE_SECRET_KEY ?? "");
    if (!baseUrl || !key)
        return Response.json({ error: "Serviço de dados indisponível." }, { status: 503 });
    const headers = new Headers({ apikey: key, Accept: "application/json" });
    if (key.startsWith("eyJ"))
        headers.set("Authorization", `Bearer ${key}`);
    for (const name of ["content-type", "prefer", "x-upsert"]) {
        const value = request.headers.get(name);
        if (value)
            headers.set(name, value);
    }
    try {
        const body = method === "GET" ? undefined : await readLimitedBody(request, 12 * 1024 * 1024);
        const response = await fetch(`${baseUrl}${path}`, { method, headers, ...(body?.byteLength ? { body } : {}), signal: AbortSignal.timeout(20000), redirect: "manual" });
        if (response.status >= 300 && response.status < 400)
            return Response.json({ error: "O serviço de dados retornou um redirecionamento inesperado." }, { status: 502 });
        return new Response(response.body, { status: response.status, headers: {
                "Content-Type": response.headers.get("content-type") ?? "application/json",
                "Cache-Control": "private, no-store",
            } });
    }
    catch (error) {
        if (error instanceof RequestError)
            return Response.json({ error: error.message }, { status: error.status });
        return Response.json({ error: "Serviço de dados temporariamente indisponível." }, { status: 503 });
    }
}
