import { RequestError } from "@/lib/request-error";
export async function readLimitedBody(request, maximumBytes, timeoutMs = 10000) {
    const announced = Number(request.headers.get("content-length") ?? 0);
    if (announced > maximumBytes)
        throw new RequestError("A solicitação excede o tamanho permitido.", 413);
    if (!request.body)
        return new Uint8Array();
    const reader = request.body.getReader();
    const chunks = [];
    let size = 0;
    let timer;
    const deadline = new Promise((_, reject) => {
        timer = setTimeout(() => reject(new RequestError("Tempo excedido ao receber a solicitação.", 408)), timeoutMs);
    });
    try {
        while (true) {
            const chunk = await Promise.race([reader.read(), deadline]);
            if (chunk.done)
                break;
            size += chunk.value.byteLength;
            if (size > maximumBytes)
                throw new RequestError("A solicitação excede o tamanho permitido.", 413);
            chunks.push(chunk.value);
        }
        const bytes = new Uint8Array(size);
        let offset = 0;
        for (const chunk of chunks) {
            bytes.set(chunk, offset);
            offset += chunk.byteLength;
        }
        return bytes;
    }
    catch (error) {
        void reader.cancel().catch(() => { });
        if (error instanceof RequestError)
            throw error;
        throw new RequestError("Não foi possível ler a solicitação.", 400);
    }
    finally {
        clearTimeout(timer);
        reader.releaseLock();
    }
}
export async function readJsonObject(request, maximumBytes = 256 * 1024) {
    if (!/^application\/json(?:\s*;|$)/i.test(request.headers.get("content-type") ?? "")) {
        throw new RequestError("Envie os dados em JSON.", 415);
    }
    const bytes = await readLimitedBody(request, maximumBytes);
    let value;
    try {
        value = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    }
    catch {
        throw new RequestError("O JSON enviado é inválido.", 400);
    }
    if (!value || typeof value !== "object" || Array.isArray(value))
        throw new RequestError("Envie um objeto JSON.", 400);
    return value;
}
