export type PoolQuoteConfig = { title: string; urgency: { normal: number; urgente: number; emergencia: number }; catalog: { category: string; items: { name: string; unit: string; price: number; markup: number; fields: { key: string; label: string; type?: "text" | "number"; unit?: string; options?: string[] }[] }[] }[] };

export const defaultPoolQuoteConfig: PoolQuoteConfig = {
  title: "Orçamento de piscinas",
  urgency: { normal: 0, urgente: 10, emergencia: 20 },
  catalog: [
    { category: "Piscinas", items: [
      { name: "Piscina de concreto", unit: "m²", price: 1850, markup: 20, fields: [{ key: "length", label: "Comprimento", type: "number", unit: "m" }, { key: "width", label: "Largura", type: "number", unit: "m" }, { key: "depth", label: "Profundidade média", type: "number", unit: "m" }] },
      { name: "Piscina de fibra", unit: "unidade", price: 22000, markup: 20, fields: [{ key: "model", label: "Modelo" }, { key: "length", label: "Comprimento", type: "number", unit: "m" }] },
      { name: "Reforma de piscina", unit: "m²", price: 680, markup: 20, fields: [{ key: "area", label: "Área", type: "number", unit: "m²" }, { key: "service", label: "Serviço incluído" }] },
    ] },
    { category: "Equipamentos", items: [
      { name: "Casa de máquinas completa", unit: "unidade", price: 7500, markup: 20, fields: [{ key: "pump", label: "Bomba" }, { key: "filter", label: "Filtro" }] },
      { name: "Aquecimento", unit: "unidade", price: 9800, markup: 20, fields: [{ key: "type", label: "Tipo de aquecimento" }, { key: "capacity", label: "Capacidade", type: "number", unit: "kW" }] },
    ] },
  ],
};

export function isPoolQuoteConfig(value: unknown): boolean {
  if (!value || typeof value !== "object") return false;
  const config = value as typeof defaultPoolQuoteConfig;
  return typeof config.title === "string" && !!config.urgency && ["normal", "urgente", "emergencia"].every((key) => {
    const rate = config.urgency[key as keyof typeof config.urgency];
    return Number.isFinite(rate) && rate >= 0 && rate <= 500;
  }) && Array.isArray(config.catalog) && config.catalog.length <= 50 && config.catalog.every((category) => typeof category.category === "string" && Array.isArray(category.items) && category.items.length <= 200 && category.items.every((item) => typeof item.name === "string" && typeof item.unit === "string" && Number.isFinite(item.price) && item.price >= 0 && Number.isFinite(item.markup) && item.markup >= 0 && Array.isArray(item.fields) && item.fields.every((field) => typeof field.key === "string" && typeof field.label === "string" && ["text", "number"].includes(field.type ?? "text"))));
}
