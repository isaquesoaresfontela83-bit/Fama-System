export function whatsappPhone(value) {
    if (typeof value !== 'string' || value.length > 40 || /[^\d+\s().-]/.test(value))
        throw new Error('Informe o telefone com DDI e DDD, por exemplo 5511999999999.');
    const phone = value.replace(/\D/g, '');
    if (!/^[1-9]\d{9,14}$/.test(phone))
        throw new Error('Informe o telefone com DDI e DDD, por exemplo 5511999999999.');
    return phone;
}
/** Brazilian users may enter DDD + number; a leading + preserves international numbers. */
export function whatsappPhoneInput(value) {
    const phone = whatsappPhone(value);
    return typeof value === 'string' && !value.trim().startsWith('+') && /^\d{10,11}$/.test(phone) ? `55${phone}` : phone;
}
export function whatsappChatUrl(value) {
    try {
        return `https://wa.me/${whatsappPhone(value)}?text=${encodeURIComponent('Agenda de hoje')}`;
    }
    catch {
        return '';
    }
}
export async function limitedWhatsappBody(request, limit = 256_000, timeoutMs = 5000) {
    if (Number(request.headers.get('content-length') || 0) > limit)
        throw new Error('body_limit');
    const reader = request.body?.getReader();
    if (!reader)
        return '';
    let timer;
    const chunks = [];
    let size = 0;
    try {
        const read = async () => {
            while (true) {
                const item = await reader.read();
                if (item.done)
                    break;
                size += item.value.byteLength;
                if (size > limit)
                    throw new Error('body_limit');
                chunks.push(item.value);
            }
            const bytes = new Uint8Array(size);
            let offset = 0;
            for (const chunk of chunks) {
                bytes.set(chunk, offset);
                offset += chunk.length;
            }
            return new TextDecoder('utf-8', { fatal: true }).decode(bytes);
        };
        return await Promise.race([read(), new Promise((_, reject) => { timer = setTimeout(() => reject(new Error('body_timeout')), timeoutMs); })]);
    }
    finally {
        clearTimeout(timer);
        void reader.cancel().catch(() => { });
    }
}
