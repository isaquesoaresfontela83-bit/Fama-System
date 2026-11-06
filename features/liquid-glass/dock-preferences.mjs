export const DOCK_ITEMS=['home','agenda','new','customers','more'];
export const DOCK_CATALOG=[
 {id:'home',label:'Início',section:'dashboard',source:'Início',group:''},
 {id:'agenda',label:'Agenda',section:'agenda',source:'Agenda',group:''},
 {id:'new',label:'Novo',native:true},
 {id:'customers',label:'Clientes',section:'customers',source:'Clientes',group:''},
 {id:'more',label:'Mais',native:true},
 {id:'pedidos',label:'Pedidos',section:'pedidos',source:'Pedidos',group:''},
 {id:'quotes',label:'Orçamentos',section:'quotes',source:'Orçamentos',group:''},
 {id:'orders',label:'Serviços',section:'orders',source:'Serviços',group:''},
 {id:'finance',label:'Financeiro',section:'finance',source:'Financeiro',group:''},
 {id:'charts',label:'Gráficos',section:'charts',source:'Gráficos',group:''},
 {id:'management',label:'Gestão geral',section:'management',source:'Gestão geral',group:'Gestão'},
 {id:'crm',label:'CRM de vendas',short:'CRM',section:'crm',source:'CRM de vendas',group:'Gestão'},
 {id:'contracts',label:'Contratos',section:'contracts',source:'Contratos',group:'Gestão'},
 {id:'warranties',label:'Garantias',section:'warranties',source:'Garantias',group:'Gestão'},
 {id:'inventory',label:'Estoque',section:'inventory',source:'Estoque',group:'Gestão'},
 {id:'team',label:'Equipe',section:'team',source:'Equipe',group:'Gestão'},
 {id:'invoices',label:'Notas fiscais',short:'Notas',section:'invoices',source:'Notas fiscais',group:'Gestão'},
 {id:'planning',label:'Planejamento e rotas',short:'Rotas',section:'planning',source:'Planejamento e rotas',group:'Ferramentas'},
 {id:'assistant',label:'Fama IA',section:'assistant',source:'Fama IA',group:'Ferramentas'},
 {id:'chat',label:'Chat da equipe',short:'Chat',section:'chat',source:'Chat da equipe',group:'Ferramentas'},
 {id:'consultation',label:'Consulta CNPJ e CEP',short:'Consulta',section:'consultation',source:'Consulta CNPJ e CEP',group:'Ferramentas'},
 {id:'mobile',label:'Modo técnico',short:'Técnico',section:'mobile',source:'Modo técnico',group:'Ferramentas'},
 {id:'billing',label:'Planos e pagamentos',short:'Planos',section:'billing',source:'Planos e pagamentos',group:'Configurações e ajuda'},
 {id:'settings',label:'Configurações da empresa',short:'Config.',section:'settings',source:'Configurações da empresa',group:'Configurações e ajuda'},
 {id:'members',label:'Usuários e empresas',short:'Usuários',section:'members',source:'Usuários e empresas',group:'Configurações e ajuda'},
 {id:'support',label:'Suporte',section:'support',source:'Suporte',group:'Configurações e ajuda'},
 {id:'privacy',label:'Privacidade e segurança',short:'Privacidade',section:'privacy',source:'Privacidade e segurança',group:'Configurações e ajuda'},
 {id:'manual',label:'Manual de uso',short:'Manual',section:'manual',source:'Manual de uso',group:'Configurações e ajuda'},
];
export const DOCK_LABELS=Object.fromEntries(DOCK_CATALOG.map(x=>[x.id,x.label]));
export const STORAGE_KEY='fama:dock-layout:v1';
const ALL=DOCK_CATALOG.map(x=>x.id),EXTRA=ALL.filter(id=>!DOCK_ITEMS.includes(id));
export function normalizePreferences(value){
 const order=[...new Set((Array.isArray(value?.order)?value.order:[]).filter(id=>ALL.includes(id)))];
 const hidden=[...new Set((Array.isArray(value?.hidden)?value.hidden:[]).filter(id=>ALL.includes(id)&&id!=='more'))];
 if(value?.version!==2)for(const id of EXTRA)if(!hidden.includes(id))hidden.push(id);
 return {version:2,order:[...order,...ALL.filter(id=>!order.includes(id))],hidden};
}
export function moveItem(preferences,id,direction,available=ALL){
 const result=normalizePreferences(preferences),visible=result.order.filter(key=>available.includes(key)),index=visible.indexOf(id),other=visible[index+direction];
 if(index>=0&&other){const a=result.order.indexOf(id),b=result.order.indexOf(other);[result.order[a],result.order[b]]=[result.order[b],result.order[a]];}
 return result;
}
export function allowedCatalog(access,pedidos=false){
 if(!access||!Array.isArray(access.moduleAccess))return [];
 const modules=access.moduleAccess,admin=['owner','admin'].includes(access.role);
 const invoiceFeature=Array.isArray(access.planFeatures)?access.planFeatures.includes('invoices'):access.plan==='profissional';
 return DOCK_CATALOG.filter(item=>{
  const s=item.section;if(item.native)return true;
  if(s==='pedidos')return pedidos&&modules.includes('quotes');
  if(['manual','privacy','support'].includes(s))return true;
  if(['settings','billing','members'].includes(s))return admin;
  if(s==='invoices')return invoiceFeature&&modules.includes('finance');
  const feature=({planning:'agenda',charts:'dashboard',management:'dashboard',consultation:'customers',invoices:'finance'})[s]||s;
  return modules.includes(feature);
 });
}
