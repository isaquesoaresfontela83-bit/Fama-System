export const serviceChecklist = [
    { name: "waterChecks", label: "Medir pH e cloro", keys: ["medir_ph", "medir_cloro"] },
    { name: "cleaningChecks", label: "Limpar bordas e pré-filtro", keys: ["escovar_bordas", "limpar_pre_filtro"] },
    { name: "vacuumCheck", label: "Aspirar fundo", keys: ["aspirar_fundo"] },
    { name: "productsCheck", label: "Aplicar produtos necessários", keys: ["aplicar_produto"] },
    { name: "photoCheck", label: "Registrar foto antes/depois", keys: ["tirar_foto_final"] },
    { name: "customerCheck", label: "Confirmar com o cliente", keys: ["cliente_confirmou"] },
];
export function checklistSummary(value) {
    return serviceChecklist.filter(item => item.keys.every(key => value[key] === true)).map(item => item.label).join("; ");
}
export function serviceProducts(value) {
    try {
        const items = JSON.parse(value);
        if (Array.isArray(items))
            return items.map(item => {
                if (!item || typeof item !== "object")
                    return "";
                const { name, quantity, unit } = item;
                return [String(name || "Item"), Number(quantity || 0).toLocaleString("pt-BR"), String(unit || "")].filter(Boolean).join(" · ");
            }).filter(Boolean).join("; ");
    }
    catch { /* Preserve older plain text. */ }
    return value;
}
