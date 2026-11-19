const order = ['inicial', 'intermediario', 'profissional'];
const labels = ['ORGANIZAÇÃO', 'EQUIPE E GESTÃO', 'INTELIGÊNCIA E ESCALA'];
const icons = ['grid', 'layers', 'sparkles'];

function limit(numeric, label) {
 const value = Number(numeric ?? String(label ?? '').match(/[\d.]+/)?.[0]?.replaceAll('.', ''));
 if (!Number.isSafeInteger(value) || value <= 0) throw new Error('Invalid plan limit');
 return value;
}

function shortFeature(value) {
 const rules = [
  [/Painel personalizável/i, 'Painel de gestão'],
  [/CRM e acompanhamento/i, 'CRM e negociações'],
  [/Orçamentos em PDF/i, 'Orçamentos em PDF'],
  [/Agenda semanal/i, 'Agenda e planejamento de visitas'],
  [/Ordens de serviço/i, 'Ordens de serviço com checklist'],
  [/Financeiro, contas/i, 'Contas a pagar e receber'],
  [/Compras, fornecedores/i, 'Compras e fornecedores'],
  [/Estoque e controle/i, 'Estoque e código de barras'],
  [/Gestão da equipe/i, 'Gestão da equipe e modo técnico'],
  [/Filiais com/i, 'Gestão de filiais'],
  [/Fama IA com voz/i, 'Fama IA com voz'],
  [/Apoio da IA/i, 'Planejamento com IA'],
  [/Frete automático/i, 'Cálculo automático de frete'],
  [/Preparação e arquivo/i, 'Recursos fiscais integrados'],
 ];
 return rules.find(([pattern]) => pattern.test(value))?.[1] || value;
}

export function normalizeCatalog(payload) {
 if (payload?.plans && !Array.isArray(payload.plans) && typeof payload.plans === 'object') {
  const plans = Object.entries(payload.plans).map(([id, plan]) => {
   if (plan?.code !== id || !Array.isArray(plan.highlights) || !plan.highlights.every(value => typeof value === 'string')) throw new Error('Invalid application catalog');
   return { id, name: plan.name, price: plan.priceCents, description: plan.description,
    userLimit: plan.limits?.users, customerLimit: plan.limits?.customers, modules: plan.highlights.join('\n') };
  });
  payload = { plans };
 }
 if (!Array.isArray(payload?.plans) || payload.plans.length !== 3) throw new Error('Invalid public catalog');
 const effective = [];
 const plans = order.map((code, index) => {
  const matching = payload.plans.filter(plan => plan?.id === code);
  if (matching.length !== 1) throw new Error('Missing or duplicated plan');
  const source = matching[0];
  if (!Number.isSafeInteger(source.price) || source.price <= 0) throw new Error('Invalid plan price');
  if (typeof source.name !== 'string' || !source.name.trim() || typeof source.modules !== 'string') {
   throw new Error('Invalid plan presentation');
  }
  const modules = source.modules.split(/\r?\n/).map(value => value.trim()).filter(Boolean);
  const inherited = modules.find(value => /^Tudo do (Basic|Plus)/i.test(value));
  const own = modules.filter(value => !/^Até\s|^Tudo do\s/i.test(value));
  const parent = /^Tudo do Plus/i.test(inherited || '') ? 1 : /^Tudo do Basic/i.test(inherited || '') ? 0 : -1;
  effective[index] = [...new Set([...(parent >= 0 ? effective[parent] || [] : []), ...own])];
  return {
   code,
   name: source.name.trim().slice(0, 80),
   priceCents: source.price,
   users: limit(source.userLimit, source.users),
   customers: limit(source.customerLimit, source.clients),
   icon: icons[index],
   label: labels[index],
   description: String(source.description ?? '').slice(0, 1500),
   featureTitle: inherited || 'Incluído neste plano',
   features: own.slice(0, 5).map(shortFeature),
  };
 });
 const features = [...new Set(effective.flat())];
 return {
  plans,
  featureGroups: [{
   title: 'Recursos do catálogo atual',
   minimum: 0,
   features,
   availability: Object.fromEntries(features.map(feature => [feature, effective.map(items => items.includes(feature))])),
  }],
 };
}
