import { cycles, plans, featureGroups, cycleTotal } from './catalog.js';

const icons = {
 arrow: 'M4 12h16M14 6l6 6-6 6',
 up: 'M12 20V4M6 10l6-6 6 6',
 down: 'm5 9 7 7 7-7',
 grid: 'M3 3h7v7H3zM14 3h7v7h-7zM3 14h7v7H3zM14 14h7v7h-7z',
 calendar: 'M4 5h16a1 1 0 0 1 1 1v14H3V6a1 1 0 0 1 1-1ZM7 3v4M17 3v4M3 10h18',
 wallet: 'M3 6h17v14H3V6ZM3 6l13-3v3M16 11h5v5h-5a2.5 2.5 0 0 1 0-5Z',
 file: 'M5 3h9l5 5v13H5zM14 3v6h5M8 13h8M8 17h8',
 users: 'M13 7a3 3 0 1 1-6 0 3 3 0 0 1 6 0ZM3 20v-2c0-3 3-5 7-5s7 2 7 5v2M17 4a3 3 0 0 1 0 6M19 14c2 1 3 2 3 4v2',
 building: 'M4 21V5l9-3v19M13 9h7v12M2 21h20M7 8h3M7 12h3M7 16h3M16 13h1M16 17h1',
 box: 'M3 7l9-4 9 4v10l-9 4-9-4V7Zm0 0 9 4 9-4M12 11v10M7.5 5l9 4',
 tool: 'M15 5a5 5 0 0 0-6 6L3 17a2.8 2.8 0 0 0 4 4l6-6a5 5 0 0 0 6-6l-3 3-4-4 3-3Z',
 layers: 'M3 8l9-5 9 5-9 5-9-5ZM3 13l9 5 9-5M3 18l9 5 9-5',
 sparkles: 'm12 2 2.8 7.2L22 12l-7.2 2.8L12 22l-2.8-7.2L2 12l7.2-2.8L12 2ZM20 2v4M18 4h4',
 check: 'm5 12 4.5 4.5L19 7',
 login: 'M13 3h7v18h-7M3 12h12M10 7l5 5-5 5',
 menu: 'M4 6h16M4 12h16M4 18h16',
 moon: 'M20.8 13.2A9 9 0 0 1 10.8 3.2a9 9 0 1 0 10 10Z',
 sun: 'M16 12a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM12 2v2M12 20v2M2 12h2M20 12h2M5 5l1.5 1.5M17.5 17.5 19 19M5 19l1.5-1.5M17.5 6.5 19 5',
 play: 'm8 5 11 7-11 7V5Z',
};

const themeToggle = document.querySelector('#theme-toggle');
const themeStorageKey = 'fama-system-theme-v2';
const systemTheme = matchMedia('(prefers-color-scheme: dark)');
let themePreference;
try {
 themePreference = localStorage.getItem(themeStorageKey);
} catch {}

const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
const number = new Intl.NumberFormat('pt-BR');
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const billingSwitch = document.querySelector('.billing-switch');
const billingButtons = [...document.querySelectorAll('[data-cycle]')];
const demoButtons = [...document.querySelectorAll('[data-demo]')];
const menuToggle = document.querySelector('#menu-toggle');
const mobileNavigation = document.querySelector('#mobile-navigation');
let selectedCycle = 'monthly';
let selectedDemo = 'overview';
let expandedComparison = false;
let chartFrame = 0;

function escapeHtml(value) {
 return String(value).replace(/[&<>"']/g, character => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
 })[character]);
}

function icon(name) {
 return '<i data-icon="' + name + '"></i>';
}

function renderIcons() {
 document.querySelectorAll('[data-icon]').forEach(node => {
  const canvas = document.createElement('canvas');
  canvas.className = 'icon';
  canvas.dataset.glyph = node.dataset.icon;
  canvas.setAttribute('aria-hidden', 'true');
  node.replaceWith(canvas);
 });
 document.querySelectorAll('canvas[data-glyph]').forEach(canvas => {
  canvas.width = canvas.height = 48;
  const context = canvas.getContext('2d');
  if (!context) return;
  context.scale(2, 2);
  context.strokeStyle = getComputedStyle(canvas).color;
  context.lineWidth = 1.7;
  context.lineCap = context.lineJoin = 'round';
  context.stroke(new Path2D(icons[canvas.dataset.glyph]));
 });
}

function applyTheme(theme) {
 const dark = theme === 'dark';
 document.documentElement.dataset.theme = theme;
 document.documentElement.style.colorScheme = theme;
 themeToggle.setAttribute('aria-pressed', String(dark));
 const label = dark ? 'Ativar tema claro' : 'Ativar tema escuro';
 themeToggle.setAttribute('aria-label', label);
 themeToggle.title = label;
 themeToggle.innerHTML = icon(dark ? 'sun' : 'moon');
 renderIcons();
 paintChart();
}

themeToggle.addEventListener('click', () => {
 themePreference = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark';
 try {
  localStorage.setItem(themeStorageKey, themePreference);
 } catch {}
 applyTheme(themePreference);
});

systemTheme.addEventListener('change', event => {
 if (themePreference === 'light' || themePreference === 'dark') return;
 applyTheme(event.matches ? 'dark' : 'light');
});

window.addEventListener('storage', event => {
 if (event.key !== themeStorageKey && event.key !== null) return;
 themePreference = event.newValue;
 const dark = themePreference === 'dark' ||
  (themePreference !== 'light' && systemTheme.matches);
 applyTheme(dark ? 'dark' : 'light');
});

function checkoutUrl(planCode) {
 return 'https://famasystem.online/assinar/' + planCode + '?cycle=' + selectedCycle;
}

function billingDescription(plan) {
 const cycle = cycles[selectedCycle];
 if (cycle.months === 1) return 'Pagamento mensal.';
 return money.format(cycleTotal(plan.priceCents, selectedCycle) / 100) + ' a cada ' + cycle.months + ' meses.';
}

function renderPlanCards() {
 document.querySelector('#pricing-grid').innerHTML = plans.map((plan, index) => {
  const featured = index === 1;
  return `
   <article class="plan-card reveal ${featured ? 'featured' : ''}" aria-labelledby="plan-${plan.code}">
    <div class="plan-topline"><span class="feature-icon">${icon(plan.icon)}</span><span class="plan-label">${escapeHtml(plan.label)}</span></div>
    <h3 id="plan-${plan.code}">${escapeHtml(plan.name)}</h3>
    <p class="plan-description">${escapeHtml(plan.description)}</p>
    <div class="price-row"><span class="price-currency">R$</span><strong class="price-number" data-price="${plan.code}">${money.format(plan.priceCents / 100).replace(/^R\$\s*/, "").replace(/,00$/, "")}</strong><span class="price-frequency">/mês</span></div>
    <p class="price-billing" data-billing="${plan.code}">${billingDescription(plan)}</p>
    <a class="button plan-cta ${featured ? '' : 'button-outline'}" data-checkout="${plan.code}" href="${checkoutUrl(plan.code)}">Escolher ${escapeHtml(plan.name)}${icon('arrow')}</a>
    <p class="plan-limits"><span>${icon('users')}Até ${plan.users} usuários</span><span>${icon('building')}${number.format(plan.customers)} clientes</span></p>
    <p class="plan-features-title">${escapeHtml(plan.featureTitle)}</p>
    <ul class="plan-features">${plan.features.map(feature => '<li>' + icon('check') + '<span>' + escapeHtml(feature) + '</span></li>').join('')}</ul>
    <a class="plan-more" href="#recursos">Ver todos os recursos ${icon('down')}</a>
   </article>`;
 }).join('');
}

function positionBillingIndicator() {
 const active = billingButtons.find(button => button.dataset.cycle === selectedCycle);
 const indicator = billingSwitch.querySelector('.billing-indicator');
 indicator.style.width = active.offsetWidth + 'px';
 indicator.style.transform = 'translateX(' + (active.offsetLeft - parseFloat(getComputedStyle(indicator).left)) + 'px)';
}

function selectCycle(code) {
 if (!Object.hasOwn(cycles, code)) return;
 selectedCycle = code;
 billingButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.cycle === code)));
 const cycle = cycles[code];
 for (const plan of plans) {
  const price = document.querySelector('[data-price="' + plan.code + '"]');
  const monthlyCents = cycleTotal(plan.priceCents, code) / cycle.months;
  price.textContent = money.format(monthlyCents / 100).replace(/^R\$\s*/, '').replace(/,00$/, '');
  document.querySelector('[data-billing="' + plan.code + '"]').textContent = billingDescription(plan);
  document.querySelector('[data-checkout="' + plan.code + '"]').href = checkoutUrl(plan.code);
  if (!reducedMotion.matches) {
   price.animate([
    { opacity: 0.3, transform: 'translateY(5px)' },
    { opacity: 1, transform: 'translateY(0)' },
   ], { duration: 350, easing: 'cubic-bezier(.22,1,.36,1)' });
  }
 }
 positionBillingIndicator();
 document.querySelector('#billing-status').textContent = 'Período ' + cycle.name.toLocaleLowerCase('pt-BR') + ' selecionado. ' +
  plans.map(plan => plan.name + ', ' + money.format(cycleTotal(plan.priceCents, code) / cycle.months / 100) + ' por mês').join('. ') +
  (cycle.months > 1 ? '. Cobrança a cada ' + cycle.months + ' meses.' : '.');
}

function renderComparison() {
 document.querySelectorAll('.comparison-table thead th').forEach((heading, index) => {
  if (index > 0) heading.textContent = plans[index - 1].name;
 });
 const rows = [
  '<tr><th scope="row">Usuários</th>' + plans.map(plan => '<td>Até ' + plan.users + '</td>').join('') + '</tr>',
  '<tr><th scope="row">Clientes cadastrados</th>' + plans.map(plan => '<td>' + number.format(plan.customers) + '</td>').join('') + '</tr>',
 ];
 featureGroups.forEach((group, groupIndex) => {
  if (!expandedComparison && groupIndex > 0) return;
  rows.push('<tr class="comparison-group"><th colspan="4" scope="rowgroup">' + escapeHtml(group.title) + '</th></tr>');
  const features = expandedComparison ? group.features : group.features.slice(0, 6);
  for (const feature of features) {
   rows.push('<tr><th scope="row">' + escapeHtml(feature) + '</th>' + plans.map((plan, planIndex) => '<td>' + (
    (group.availability?.[feature]?.[planIndex] ?? planIndex >= group.minimum)
     ? '<span class="table-check" role="img" aria-label="Incluído">' + icon('check') + '</span>'
     : '<span class="table-no" aria-label="Não incluído">—</span>'
   ) + '</td>').join('') + '</tr>');
  }
 });
 document.querySelector('#comparison-body').innerHTML = rows.join('');
 const button = document.querySelector('#comparison-toggle');
 button.setAttribute('aria-expanded', String(expandedComparison));
 button.innerHTML = (expandedComparison ? 'Recolher comparação' : 'Ver todos os ' + featureGroups.reduce((count, group) => count + group.features.length, 0) + ' recursos') + icon(expandedComparison ? 'up' : 'down');
 renderIcons();
}

function metric(label, value, change, note) {
 return '<article class="demo-metric"><span>' + label + '</span><strong>' + value +
  '</strong><small><b>' + change + '</b>' + note + '</small></article>';
}

function demoTable(headings, rows) {
 return '<table class="demo-table"><thead><tr>' + headings.map(heading => '<th scope="col">' + heading + '</th>').join('') +
  '</tr></thead><tbody>' + rows.map(row => '<tr>' + row.map(cell => '<td>' + cell + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
}

function badge(label, pending = false) {
 return '<span class="demo-status' + (pending ? ' pending' : '') + '">' + label + '</span>';
}

const demoViews = {
 overview: {
  title: 'Visão geral',
  subtitle: 'Sua operação e os próximos atendimentos, em um só lugar.',
  body: () => `
   <div class="demo-metrics">
    ${metric('Receita no período', 'R$ 24.850', '+12,4%', 'no período')}
    ${metric('Serviços registrados', '48', '+8', 'no período')}
    ${metric('Orçamentos em aberto', '12', 'Em análise', 'propostas')}
   </div>
   <div class="demo-widgets">
    <section class="demo-panel"><div class="demo-panel-head"><h4>Desempenho financeiro</h4><span>Receitas · Despesas</span></div><canvas class="demo-chart" role="img" aria-label="Gráfico ilustrativo de receitas e despesas crescentes no período"></canvas></section>
    <section class="demo-panel"><h4>Agenda de hoje</h4><div class="demo-agenda">
     <div><time>09:00</time><span><strong>Limpeza e manutenção</strong><small>Residencial Vila Azul</small></span></div>
     <div><time>10:30</time><span><strong>Tratamento de água</strong><small>Clube Sol Nascente</small></span></div>
     <div><time>14:00</time><span><strong>Instalação de bomba</strong><small>Ana Ribeiro</small></span></div>
    </div></section>
   </div>`,
 },
 agenda: {
  title: 'Agenda',
  subtitle: 'Cada visita com data, equipe e serviço definidos.',
  body: () => `
   <div class="demo-metrics">
    ${metric('Atendimentos hoje', '8', 'Organizados', 'na agenda')}
    ${metric('Equipe em campo', '4', 'Em atendimento', 'técnicos')}
    ${metric('Serviços concluídos', '3', 'Hoje', 'finalizados')}
   </div>
   <section class="demo-panel" style="margin-top:12px"><h4 style="margin-bottom:10px">Próximos atendimentos</h4>${demoTable(
    ['Horário', 'Atendimento', 'Responsável', 'Status'],
    [
     ['09:00', 'Limpeza · Vila Azul', 'Marcos', badge('Concluído')],
     ['10:30', 'Tratamento · Sol Nascente', 'Lucas', badge('Em andamento', true)],
     ['14:00', 'Instalação · Ana Ribeiro', 'Marcos', badge('Agendado', true)],
    ]
   )}</section>`,
 },
 finance: {
  title: 'Financeiro',
  subtitle: 'Acompanhe recebimentos, despesas e o saldo da operação.',
  body: () => `
   <div class="demo-metrics">
    ${metric('Receitas do período', 'R$ 24.850', '+12,4%', 'no período')}
    ${metric('Despesas do período', 'R$ 11.420', 'Registradas', 'no financeiro')}
    ${metric('Saldo do período', 'R$ 13.430', 'Positivo', 'no período')}
   </div>
   <section class="demo-panel" style="margin-top:12px"><h4 style="margin-bottom:10px">Movimentações recentes</h4>${demoTable(
    ['Descrição', 'Tipo', 'Valor', 'Status'],
    [
     ['Manutenção · Sol Nascente', 'Receita', 'R$ 3.480', badge('Recebido')],
     ['Insumos para tratamento', 'Despesa', 'R$ 1.240', badge('Pago')],
     ['Revisão · Mirante', 'Receita', 'R$ 1.280', badge('A receber', true)],
    ]
   )}</section>`,
 },
};

function renderDemo(code) {
 selectedDemo = code;
 const view = demoViews[code];
 demoButtons.forEach(button => {
  const selected = button.dataset.demo === code;
  button.setAttribute('aria-selected', String(selected));
  button.tabIndex = selected ? 0 : -1;
 });
 const panel = document.querySelector('#product-content');
 panel.setAttribute('aria-labelledby', 'tab-' + code);
 document.querySelector('#app-crumb').textContent = view.title;
 panel.innerHTML = '<div class="demo-view-content"><div class="app-heading"><div><h3>' + view.title +
  '</h3><p>' + view.subtitle + '</p></div><span class="app-date">' + icon('calendar') +
  'Novembro, 2026</span></div>' + view.body() + '</div>';
 renderIcons();
 animateChart();
}

function paintChart(progress = 1) {
 const canvas = document.querySelector('.demo-chart');
 if (!canvas) return;
 const { width, height } = canvas.getBoundingClientRect();
 const scale = Math.min(devicePixelRatio || 1, 2);
 canvas.width = Math.round(width * scale);
 canvas.height = Math.round(height * scale);
 const context = canvas.getContext('2d');
 if (!context) return;
 context.scale(scale, scale);
 const left = 20, right = width - 6, top = 8, bottom = height - 18;
 context.font = '6px system-ui';
 context.textBaseline = 'middle';
 const dark = document.documentElement.dataset.theme === 'dark';
 context.fillStyle = dark ? '#94adc6' : '#8a9db2';
 for (let line = 0; line <= 3; line++) {
  const y = top + (bottom - top) * line / 3;
  context.lineWidth = 1;
  context.strokeStyle = dark ? '#243a52' : '#edf2f8';
  context.beginPath();
  context.moveTo(left, y);
  context.lineTo(right, y);
  context.stroke();
  context.fillText(String((3 - line) * 10) + 'k', 0, y);
 }
 ['21 out.', '2 nov.', '10 nov.', '19 nov.'].forEach((label, index) => {
  const labelWidth = context.measureText(label).width;
  context.fillText(label, left + (right - left - labelWidth) * index / 3, height - 4);
 });
 function curve(values, color, fill) {
  const points = values.map((value, index) => [
   left + (right - left) * index / (values.length - 1),
   bottom - (bottom - top) * value / 30,
  ]);
  context.save();
  context.beginPath();
  context.rect(left - 1, 0, (right - left + 5) * progress, height);
  context.clip();
  context.beginPath();
  context.moveTo(...points[0]);
  for (let index = 1; index < points.length; index++) {
   const previous = points[index - 1], next = points[index];
   const middle = (previous[0] + next[0]) / 2;
   context.bezierCurveTo(middle, previous[1], middle, next[1], next[0], next[1]);
  }
  context.lineWidth = 1.6;
  context.strokeStyle = color;
  context.stroke();
  if (fill) {
   context.lineTo(right, bottom);
   context.lineTo(left, bottom);
   context.closePath();
   const gradient = context.createLinearGradient(0, top, 0, bottom);
   gradient.addColorStop(0, '#458df437');
   gradient.addColorStop(1, '#458df404');
   context.fillStyle = gradient;
   context.fill();
  }
  context.restore();
 }
 curve([7, 10, 9, 14, 17, 16, 23, 25], dark ? '#66a8ff' : '#367aec', true);
 curve([4, 6, 6, 8, 10, 9, 12, 13], '#88b8e7', false);
}

function animateChart() {
 cancelAnimationFrame(chartFrame);
 if (selectedDemo !== 'overview') return;
 if (reducedMotion.matches) {
  paintChart();
  return;
 }
 const start = performance.now();
 function frame(now) {
  const progress = Math.min(1, (now - start) / 850);
  paintChart(1 - (1 - progress) ** 3);
  if (progress < 1) chartFrame = requestAnimationFrame(frame);
 }
 chartFrame = requestAnimationFrame(frame);
}

function setMenu(open) {
 menuToggle.setAttribute('aria-expanded', String(open));
 mobileNavigation.hidden = !open;
}

function initScrollAnimations() {
 if (reducedMotion.matches || !('IntersectionObserver' in window)) return;
 const observer = new IntersectionObserver(entries => {
  for (const entry of entries) {
   if (!entry.isIntersecting) continue;
   entry.target.classList.remove('reveal-pending');
   observer.unobserve(entry.target);
  }
 }, { threshold: 0.08 });
 document.querySelectorAll('.reveal').forEach(element => {
  if (element.getBoundingClientRect().top > innerHeight) element.classList.add('reveal-pending');
  observer.observe(element);
 });
 reducedMotion.addEventListener('change', event => {
  if (!event.matches) return;
  document.querySelectorAll('.reveal-pending').forEach(element => element.classList.remove('reveal-pending'));
  observer.disconnect();
 });
}

billingButtons.forEach(button => button.addEventListener('click', () => selectCycle(button.dataset.cycle)));
demoButtons.forEach(button => button.addEventListener('click', () => renderDemo(button.dataset.demo)));
document.querySelector('.app-tabs').addEventListener('keydown', event => {
 const keys = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'];
 if (!keys.includes(event.key)) return;
 event.preventDefault();
 const current = demoButtons.findIndex(button => button.dataset.demo === selectedDemo);
 let next = current;
 if (event.key === 'Home') next = 0;
 else if (event.key === 'End') next = demoButtons.length - 1;
 else if (event.key === 'ArrowDown' || event.key === 'ArrowRight') next = (current + 1) % demoButtons.length;
 else next = (current + demoButtons.length - 1) % demoButtons.length;
 renderDemo(demoButtons[next].dataset.demo);
 demoButtons[next].focus();
});
document.querySelector('#comparison-toggle').addEventListener('click', () => {
 expandedComparison = !expandedComparison;
 renderComparison();
});
menuToggle.addEventListener('click', () => setMenu(mobileNavigation.hidden));
mobileNavigation.addEventListener('click', event => {
 if (event.target.closest('a')) setMenu(false);
});
document.addEventListener('keydown', event => {
 if (event.key === 'Escape' && !mobileNavigation.hidden) {
  setMenu(false);
  menuToggle.focus();
 }
});

function refreshResponsiveLayout() {
 positionBillingIndicator();
 paintChart();
 const mobile = matchMedia('(max-width:600px)').matches;
 document.querySelector('.app-tabs').setAttribute('aria-orientation', mobile ? 'horizontal' : 'vertical');
 if (innerWidth > 820) setMenu(false);
}
window.addEventListener('resize', refreshResponsiveLayout);
window.addEventListener('pageshow', refreshResponsiveLayout);
window.addEventListener('beforeprint', () => {
 document.querySelectorAll('.reveal-pending').forEach(element => element.classList.remove('reveal-pending'));
});

renderPlanCards();
applyTheme(document.documentElement.dataset.theme || 'light');
renderComparison();
renderDemo('overview');
refreshResponsiveLayout();
initScrollAnimations();
