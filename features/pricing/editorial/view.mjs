// Shared presentation source: the adapters provide React and the JSX runtime.
const el=(type,props,...children)=>{const{key,...rest}=props||{};return JSX.jsxs(type,children.length?{...rest,children}:rest,key);};
export const CYCLES={monthly:{label:'Mensal',months:1,discount:0},quarterly:{label:'Trimestral',months:3,discount:5},semiannual:{label:'Semestral',months:6,discount:10},annual:{label:'Anual',months:12,discount:15}};
export const planCodes=['inicial','intermediario','profissional'];
export const cycleTotal=(cents,cycle)=>Math.round(cents*CYCLES[cycle].months*(100-CYCLES[cycle].discount)/100);
const money=cents=>new Intl.NumberFormat('pt-BR',{style:'currency',currency:'BRL'}).format(cents/100);
const number=value=>new Intl.NumberFormat('pt-BR').format(value);
const contact='https://wa.me/5561991388546?text=Ol%C3%A1!%20Quero%20conhecer%20os%20planos%20do%20Fama%20System.';
const descriptions={inicial:'Para organizar os atendimentos do dia a dia.',intermediario:'Para acompanhar a equipe e a operação.',profissional:'Para ampliar os recursos da sua empresa.'};
const shortFeature=text=>{
 const rules=[[/Painel personalizável/i,'Painel de gestão'],[/CRM e acompanhamento/i,'CRM e negociações'],[/Orçamentos em PDF/i,'Orçamentos em PDF'],[/Agenda semanal/i,'Agenda e planejamento de visitas'],[/Ordens de serviço/i,'Ordens de serviço com checklist'],[/Financeiro, contas/i,'Contas a pagar e receber'],[/Compras, fornecedores/i,'Compras e fornecedores'],[/Estoque e controle/i,'Estoque e código de barras'],[/Gestão da equipe/i,'Gestão da equipe'],[/Filiais com/i,'Gestão de filiais'],[/Fama IA com voz/i,'Fama IA com voz'],[/Apoio da IA/i,'Planejamento com IA'],[/Frete automático/i,'Cálculo automático de frete'],[/Preparação e arquivo/i,'Recursos fiscais integrados']];
 return rules.find(([re])=>re.test(text))?.[1]||text;
};
const realFeatures=plan=>(plan?.highlights||[]).filter(t=>!/^Até\s|^Tudo do\s/i.test(t));
function effectiveFeatures(plans,code){const own=realFeatures(plans[code]);if(code==='intermediario'&&(plans[code]?.highlights||[]).some(t=>/^Tudo do Basic/i.test(t)))return [...effectiveFeatures(plans,'inicial'),...own];if(code==='profissional'&&(plans[code]?.highlights||[]).some(t=>/^Tudo do Plus/i.test(t)))return [...effectiveFeatures(plans,'intermediario'),...own];return own;}
export function PlansView({plans}){
 const[cycle,setCycle]=React.useState('monthly');const[expanded,setExpanded]=React.useState(false);
 const available=planCodes.filter(code=>plans?.[code]);
 const fullRows=[...new Set(available.flatMap(code=>effectiveFeatures(plans,code)))];
 const rows=expanded?fullRows:fullRows.slice(0,7);
 return el('main',{className:'fp-page',id:'conteudo'},
  el('header',{className:'fp-header'},el('div',{className:'fp-shell fp-header-inner'},
   el('a',{href:'/',className:'fp-brand','aria-label':'Water System — início'},el('img',{src:'/fama-piscinas-mark.png',alt:'',width:34,height:34}),el('span',null,'Fama',el('span',{className:'fp-brand-light'},'System'))),
   el('nav',{'aria-label':'Navegação principal'},el('a',{href:'#recursos'},'Recursos'),el('a',{href:'#planos','aria-current':'page'},'Planos'),el('a',{href:'/manual'},'Manual')),
   el('a',{href:'/entrar',className:'fp-login'},'Acessar sistema'))),
  el('section',{className:'fp-intro fp-shell','aria-labelledby':'fp-title'},
   el('div',null,el('p',{className:'fp-eyebrow'},'GESTÃO PARA EMPRESAS DE PISCINAS'),el('h1',{id:'fp-title'},'Sua empresa,',el('br',null),'com a rotina em dia.')),
   el('div',{className:'fp-intro-aside'},el('p',null,'Clientes, orçamentos e serviços no mesmo sistema. Escolha o plano que acompanha o tamanho da sua operação.'),el('a',{href:contact,target:'_blank',rel:'noopener noreferrer'},'Fale com a Fama'))),
  el('section',{id:'planos',className:'fp-plans fp-shell','aria-labelledby':'fp-plans-title'},
   el('div',{className:'fp-plans-head'},el('div',null,el('h2',{id:'fp-plans-title'},'Planos e preços'),el('p',null,'Escolha o período de contratação.')),
    el('div',{className:'fp-cycles',role:'group','aria-label':'Período de contratação'},Object.entries(CYCLES).map(([code,data])=>el('button',{key:code,type:'button','aria-pressed':cycle===code,onClick:()=>setCycle(code)},data.label,data.discount>0&&el('span',null,`−${data.discount}%`))))),
   !plans?el('p',{role:'status',className:'fp-loading'},'Carregando os planos atuais…'):el('div',{className:'fp-grid'},available.map(code=>{
    const plan=plans[code],total=cycleTotal(plan.priceCents,cycle),features=realFeatures(plan),previous=(plan.highlights||[]).find(t=>/^Tudo do\s/i.test(t));
    return el('article',{className:'fp-card'+(code==='profissional'?' fp-card-pro':''),key:code},
     el('div',{className:'fp-card-top'},el('span',{className:'fp-plan-label'},code==='inicial'?'O ESSENCIAL':code==='intermediario'?'PARA SUA EQUIPE':'OPERAÇÃO AVANÇADA'),el('h3',null,plan.name),el('p',{className:'fp-plan-description'},descriptions[code])),
     el('div',{className:'fp-price'},el('span',{className:'fp-currency'},'R$'),el('strong',null,money(total/CYCLES[cycle].months).replace(/^R\$\s*/,'')),el('span',{className:'fp-per'},'/mês')),
     el('p',{className:'fp-billing'},cycle==='monthly'?'Pagamento mensal.':`${money(total)} a cada ${CYCLES[cycle].months} meses.`),
     el('a',{className:'fp-cta',href:`/assinar/${code}?cycle=${cycle}`},`Contratar ${plan.name}`),
     el('div',{className:'fp-limits'},el('span',null,`${number(plan.limits?.users||0)} usuários`),el('span',null,`${number(plan.limits?.customers||0)} clientes`)),
     el('div',{className:'fp-features'},el('p',{className:'fp-features-label'},previous||'Inclui no plano'),el('ul',null,features.slice(0,4).map(feature=>el('li',{key:feature},el('span',{'aria-hidden':true,className:'fp-check'},'✓'),shortFeature(feature)))),el('a',{href:'#recursos',className:'fp-all-features'},'Ver todos os recursos')));
   })),
   el('div',{className:'fp-terms-row'},el('p',null,'Ativação após a confirmação do pagamento.'),el('a',{href:'/termos'},'Condições de contratação'))),
  el('section',{className:'fp-compare fp-shell',id:'recursos','aria-labelledby':'fp-compare-title'},
   el('div',{className:'fp-section-heading'},el('p',{className:'fp-eyebrow'},'O QUE ESTÁ INCLUÍDO'),el('h2',{id:'fp-compare-title'},'Compare os recursos.')),
   el('div',{className:'fp-table-scroll',tabIndex:0,'aria-label':'Comparação dos planos. Deslize para ver todas as colunas.'},
    el('table',null,el('caption',{className:'fp-sr-only'},'Recursos e limites atuais dos planos Water System'),el('thead',null,el('tr',null,el('th',{scope:'col'},'Recursos'),available.map(code=>el('th',{scope:'col',key:code},plans[code].name)))),el('tbody',null,
     ['users','customers'].map(key=>el('tr',{key},el('th',{scope:'row'},key==='users'?'Usuários':'Clientes cadastrados'),available.map(code=>el('td',{key:code},number(plans[code].limits?.[key]||0))))),
     rows.map(feature=>el('tr',{key:feature},el('th',{scope:'row'},feature),available.map(code=>el('td',{key:code},effectiveFeatures(plans,code).includes(feature)?el('span',{className:'fp-table-yes','aria-label':'Incluído'},'✓'):el('span',{className:'fp-table-no','aria-label':'Não incluído'},'—')))))))),
   fullRows.length>7&&el('button',{type:'button',className:'fp-expand','aria-expanded':expanded,onClick:()=>setExpanded(!expanded)},expanded?'Recolher comparação':`Mostrar todos os ${fullRows.length} recursos`),
   el('p',{className:'fp-integration-note'},'Integrações financeiras e fiscais exigem configuração. O acesso a cada área também depende das permissões do usuário.')),
  el('section',{className:'fp-help'},el('div',{className:'fp-shell fp-help-inner'},el('div',null,el('h2',null,'Precisa de ajuda para escolher?'),el('p',null,'Conte como sua empresa trabalha. A gente ajuda a encontrar o plano.')),el('a',{href:contact,target:'_blank',rel:'noopener noreferrer',className:'fp-help-link'},'Conversar no WhatsApp'))),
  el('footer',{className:'fp-shell fp-footer'},el('p',null,`© ${new Date().getFullYear()} Water System`),el('nav',{'aria-label':'Informações legais'},el('a',{href:'/manual'},'Manual'),el('a',{href:'/termos'},'Termos de Uso'),el('a',{href:'/privacidade'},'Privacidade')))
 );
}
