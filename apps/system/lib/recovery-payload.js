import { decryptText, encryptionPrefix } from "@/lib/crypto";
import { callRpc } from "@/lib/supabase";
import { RequestError } from "@/lib/request-error";
const aliases = { work_orders: "workOrders", inventory_items: "inventory" };
export function recoveryEntity(value) {
    const entity = String(value ?? "");
    return Object.hasOwn(aliases, entity) ? aliases[entity] : entity;
}
export async function recoveryPayload(snapshot, organizationId) {
    const encrypted = String(snapshot.encrypted_payload ?? "");
    let payload;
    if (encrypted.startsWith(encryptionPrefix) || encrypted.trimStart().startsWith("{")) {
        payload = JSON.parse(await decryptText(encrypted));
    }
    else {
        try {
            payload = await callRpc("fama_recovery_payload", { p_snapshot_id: String(snapshot.id), p_organization_id: organizationId });
        }
        catch {
            throw new RequestError("Não foi possível abrir esta cópia de recuperação. Tente outra cópia ou contate o suporte.", 409);
        }
    }
    if (!payload)
        throw new RequestError("Este registro não está mais disponível para recuperação.", 404);
    if (typeof payload !== "object" || Array.isArray(payload))
        throw new RequestError("A cópia de recuperação é inválida.", 409);
    return payload;
}
