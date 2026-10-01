export type PoolQuoteFieldRole = "info" | "length" | "width" | "depth" | "area" | "volume" | "quantity";
export type PoolQuoteField = { key: string; label: string; type?: "text" | "number"; unit?: string; options?: string[]; role?: PoolQuoteFieldRole };
export type PoolQuoteItem = { name: string; unit: string; price: number; markup: number; fields: PoolQuoteField[] };
export type PoolQuoteConfig = { title: string; urgency: { normal: number; urgente: number; emergencia: number }; catalog: { category: string; items: PoolQuoteItem[] }[] };

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

const fieldRoles: PoolQuoteFieldRole[] = ["info", "length", "width", "depth", "area", "volume", "quantity"];
const legacyRoles: Record<string, PoolQuoteFieldRole> = {
  length: "length", comprimento: "length", width: "width", largura: "width",
  depth: "depth", profundidade: "depth", area: "area", "área": "area", volume: "volume",
  quantity: "quantity", quantidade: "quantity",
};

export function poolQuoteFieldRole(field: PoolQuoteField): PoolQuoteFieldRole {
  return field.role ?? (Object.hasOwn(legacyRoles, field.key) ? legacyRoles[field.key] : "info");
}

export function poolQuoteQuantity(item: PoolQuoteItem, dimensions: Record<string, unknown>) {
  const measure = (role: PoolQuoteFieldRole) => {
    const field = item.fields.find(candidate => poolQuoteFieldRole(candidate) === role);
    const aliases = Object.keys(legacyRoles).filter(key => legacyRoles[key] === role);
    const key = [field?.key, ...aliases.filter(key => !item.fields.some(candidate => candidate.key === key))].find(key => key !== undefined && dimensions[key] !== undefined);
    const value = Number(String(key ? dimensions[key] : "").replace(",", "."));
    return Number.isFinite(value) && value > 0 ? value : 0;
  };
  const unit = item.unit.trim().toLowerCase();
  if (["m²", "m2"].includes(unit)) return measure("area") || measure("length") * measure("width");
  if (["m³", "m3"].includes(unit)) return measure("volume") || measure("length") * measure("width") * measure("depth");
  if (["m", "metro", "metros"].includes(unit)) return measure("length") || measure("quantity");
  const quantityField = item.fields.some(field => poolQuoteFieldRole(field) === "quantity")
    || dimensions.quantity !== undefined || dimensions.quantidade !== undefined;
  return quantityField ? measure("quantity") : 1;
}

export function poolQuoteConfigError(value: unknown): string | null {
  const object = (value: unknown): value is Record<string, unknown> => !!value && typeof value === "object" && !Array.isArray(value);
  const named = (value: unknown): value is string => typeof value === "string" && !!value.trim();
  if (!object(value) || !named(value.title)) return "Informe o título do catálogo.";
  if (!object(value.urgency) || ["normal", "urgente", "emergencia"].some(key => typeof value.urgency !== "object" || !Number.isFinite((value.urgency as Record<string, number>)[key]) || (value.urgency as Record<string, number>)[key] < 0 || (value.urgency as Record<string, number>)[key] > 500)) return "As taxas de urgência devem ficar entre 0 e 500%.";
  if (!Array.isArray(value.catalog) || value.catalog.length > 50) return "Use até 50 categorias no catálogo.";
  const categories = new Set<string>();
  for (const category of value.catalog) {
    if (!object(category) || !named(category.category)) return "Informe o nome de cada categoria.";
    if (categories.has(category.category.trim())) return "Use um nome diferente para cada categoria.";
    categories.add(category.category.trim());
    if (!Array.isArray(category.items) || category.items.length > 200) return "Use até 200 itens por categoria.";
    const items = new Set<string>();
    for (const item of category.items) {
      if (!object(item) || !named(item.name) || !named(item.unit)) return "Informe nome e unidade de cada item.";
      if (items.has(item.name.trim())) return `Há itens com o mesmo nome em ${category.category}.`;
      items.add(item.name.trim());
      if (typeof item.price !== "number" || !Number.isFinite(item.price) || item.price < 0 || typeof item.markup !== "number" || !Number.isFinite(item.markup) || item.markup < 0) return `Confira o preço e a margem de ${item.name}.`;
      if (!Array.isArray(item.fields) || item.fields.length > 50) return "Use até 50 campos por item.";
      const keys = new Set<string>();
      const roles = new Set<string>();
      for (const field of item.fields) {
        if (!object(field) || !named(field.key) || !named(field.label) || !["text", "number"].includes(String(field.type ?? "text")) || (field.role !== undefined && !fieldRoles.includes(field.role as PoolQuoteFieldRole))) return `Confira os campos de medida de ${item.name}.`;
        if (keys.has(field.key)) return `Há campos repetidos em ${item.name}.`;
        keys.add(field.key);
        const role = poolQuoteFieldRole(field as PoolQuoteField);
        if (role !== "info" && roles.has(role)) return `Use cada medida do cálculo apenas uma vez em ${item.name}.`;
        if (role !== "info") roles.add(role);
      }
    }
  }
  return null;
}

export function isPoolQuoteConfig(value: unknown): value is PoolQuoteConfig {
  return poolQuoteConfigError(value) === null;
}
