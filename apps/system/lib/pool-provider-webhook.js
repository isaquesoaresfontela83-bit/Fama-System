export async function forwardPoolWebhook(request, config, send = fetch) {
    const headers = { "Cache-Control": "no-store", "X-Content-Type-Options": "nosniff" }, given = request.headers.get("asaas-access-token") ?? "";
    const digest = async (text) => new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text))).join(",");
    if (config.webhookToken.length < 32 || given.length > 300 || await digest(config.webhookToken) !== await digest(given))
        return Response.json({ error: "Evento não autorizado." }, { status: 401, headers });
    if (!config.siteServiceToken)
        return Response.json({ error: "Entrada financeira indisponível." }, { status: 503, headers });
    const raw = await request.text();
    if (raw.length > 64000)
        return Response.json({ error: "Evento excede o limite." }, { status: 413, headers });
    let event;
    try {
        event = JSON.parse(raw);
    }
    catch {
        return Response.json({ error: "Evento inválido." }, { status: 400, headers });
    }
    if (typeof event.id !== "string" || typeof event.event !== "string")
        return Response.json({ error: "Evento inválido." }, { status: 422, headers });
    const reference = event.payment?.externalReference ?? event.transfer?.externalReference;
    if (typeof reference !== "string" || !reference.startsWith("pool:"))
        return Response.json({ received: true, ignored: true }, { headers });
    try {
        const response = await send("https://fama-pool-servicos.isaquesoaresfontela8.chatgpt.site/api/asaas/webhook", { method: "POST", redirect: "manual", signal: AbortSignal.timeout(30000), headers: { "Content-Type": "application/json", "asaas-access-token": config.webhookToken, "OAI-Sites-Authorization": "Bearer " + config.siteServiceToken }, body: raw });
        if (!response.ok)
            return Response.json({ error: "Evento aguardando conciliação." }, { status: 503, headers });
        return Response.json({ received: true }, { headers });
    }
    catch {
        return Response.json({ error: "Evento aguardando entrega." }, { status: 503, headers });
    }
}
