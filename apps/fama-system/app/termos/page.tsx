import Link from "next/link";

export const metadata = { title: "Termos de Uso | Fama System" };

export default function TermsPage() {
  return <main className="legal-page"><article className="legal-document">
    <header><Link href="/" className="legal-brand">Fama System</Link><span>Versão de 24 de setembro de 2026</span></header>
    <h1>Termos de Uso</h1>
    <p>Estes Termos regulam o acesso e o uso do Fama System, plataforma de gestão para empresas de piscinas, manutenção, contratos, CRM, financeiro, cobranças, suporte e automações internas. Ao criar uma conta, criar uma empresa, contratar um plano, conectar integrações ou continuar usando o sistema, o usuário declara que leu, compreendeu e aceitou estas regras.</p>

    <h2>1. Quem pode usar</h2>
    <p>O Fama System deve ser usado por pessoas autorizadas pela empresa contratante. O responsável pela contratação declara que possui poderes para representar a empresa, cadastrar usuários, aceitar políticas, contratar planos e administrar dados operacionais, financeiros e comerciais.</p>

    <h2>2. Conta, senha e acesso</h2>
    <p>Cada pessoa deve usar sua própria conta. É proibido compartilhar senha, emprestar acesso, vender acesso não autorizado, tentar entrar em conta de terceiros ou contornar controles de segurança. A empresa deve manter dados de login atualizados, remover usuários que saírem da equipe e usar senhas fortes.</p>

    <h2>3. Empresa única e separação de ambientes</h2>
    <p>Cada empresa possui ambiente separado, com dados, clientes, orçamentos, contratos, agenda, financeiro, equipe e permissões isolados. O nome da empresa pode ser reservado para evitar duplicidade. Caso exista empresa com nome igual ou similar, o sistema pode impedir o cadastro ou solicitar ajuste.</p>

    <h2>4. Planos, contratação e ativação</h2>
    <p>O acesso pode depender de plano pago, teste ou autorização administrativa. Quando houver pagamento antes da criação da empresa, o ambiente só será liberado após confirmação do pagamento ou aprovação manual no Fama Control. Valores, limites, usuários, recursos, suporte e vencimentos podem variar conforme o plano contratado.</p>

    <h2>5. Pagamentos, Pix e cobranças</h2>
    <p>O sistema pode gerar cobranças, Pix, links de pagamento, QR Code, boletos ou registros por provedores integrados, como Asaas ou outros gateways configurados. A empresa é responsável por conferir valor, vencimento, cliente, descrição, juros, descontos, status e confirmação antes de entregar acesso, produto ou serviço.</p>
    <p>Pagamentos por Pix, boleto ou cartão podem depender de confirmação do provedor financeiro. Comprovantes enviados pelo cliente não substituem a confirmação bancária quando houver integração automática. Em cobranças manuais, a aprovação pode ser feita por administrador autorizado.</p>

    <h2>6. Financeiro, bancos e integrações</h2>
    <p>Funcionalidades de saldo, extrato, conciliação, envio de Pix, criação de clientes, cobranças e sincronização automática dependem de chaves, permissões e disponibilidade do provedor conectado. A empresa deve conectar somente contas próprias ou contas que esteja autorizada a administrar.</p>
    <p>Ao cadastrar chave de API, token ou credencial de integração, a empresa autoriza o Fama System a executar as ações técnicas necessárias para exibir dados, sincronizar movimentações, criar cobranças e, quando habilitado, iniciar pagamentos. A empresa deve revisar cada operação financeira antes de confirmar.</p>

    <h2>7. Orçamentos, juros e cálculos</h2>
    <p>O sistema pode calcular orçamento, mão de obra, deslocamento, urgência, descontos, juros de cartão, parcelas e total final. Esses cálculos são ferramentas de apoio. A empresa deve conferir taxas, impostos, regras do adquirente, margem, condições comerciais e obrigações legais antes de enviar a proposta ao cliente.</p>

    <h2>8. CRM, agenda, garantias e contratos</h2>
    <p>Registros de atendimento, leads, clientes, garantias, contratos, serviços, técnicos, visitas e documentos servem para organização operacional. A empresa continua responsável por cumprir prazos combinados, condições comerciais, obrigações legais e comunicações com seus clientes.</p>

    <h2>9. IA e automações</h2>
    <p>Recursos de IA podem gerar sugestões, resumos, mensagens, cronogramas, lembretes e análises. A IA pode errar, omitir contexto ou interpretar dados de forma incompleta. Antes de enviar mensagens, cronogramas, propostas, cobranças ou decisões para clientes e técnicos, a empresa deve revisar o conteúdo.</p>

    <h2>10. WhatsApp, mensagens e comunicação</h2>
    <p>Quando houver integração ou apoio para comunicação por WhatsApp, e-mail ou outros canais, a empresa deve respeitar consentimento dos destinatários, horários adequados, regras anti-spam, políticas das plataformas e legislação aplicável. O Fama System não garante entrega de mensagens por serviços de terceiros.</p>

    <h2>11. Suporte e feedback</h2>
    <p>A aba de suporte pode ser usada para reportar erros, melhorias e solicitações. O envio de feedback autoriza o uso das informações necessárias para análise técnica, correção e melhoria do sistema. Dados sensíveis não devem ser enviados em excesso no campo de suporte.</p>

    <h2>12. Dados cadastrados pela empresa</h2>
    <p>A empresa é responsável pela origem, exatidão, atualização e base legal dos dados que inserir, incluindo dados de clientes, funcionários, técnicos, fornecedores, pagamentos, contratos, garantias, documentos e observações. Não devem ser cadastradas informações ilícitas, excessivas, discriminatórias ou sem finalidade profissional legítima.</p>

    <h2>13. Segurança e uso aceitável</h2>
    <p>É proibido explorar falhas, tentar acessar dados de outra empresa, burlar autenticação, remover auditoria, inserir malware, sobrecarregar o serviço, coletar dados indevidamente, usar automações abusivas ou praticar fraude. Atividades suspeitas podem gerar bloqueio, suspensão, auditoria ou encerramento do acesso.</p>

    <h2>14. Disponibilidade e backups</h2>
    <p>São adotadas medidas razoáveis para continuidade e segurança, mas nenhum sistema é livre de interrupções, falhas de rede, indisponibilidade de terceiros ou manutenção. A empresa deve exportar e guardar cópias periódicas de informações críticas, principalmente dados financeiros, contratos e documentos importantes.</p>

    <h2>15. Arquivos, documentos e restauração</h2>
    <p>Documentos anexados e registros excluídos podem ficar disponíveis para recuperação por prazo limitado, quando tecnicamente possível. A restauração não é garantida para todos os tipos de dados, arquivos, integrações ou exclusões permanentes.</p>

    <h2>16. Suspensão, cancelamento e inadimplência</h2>
    <p>O acesso pode ser suspenso por falta de pagamento, risco de segurança, violação destes Termos, ordem legal, uso indevido ou tentativa de fraude. O encerramento não elimina obrigações anteriores, débitos, registros de auditoria ou retenções necessárias para segurança, defesa de direitos e cumprimento legal.</p>

    <h2>17. Limitação de responsabilidade</h2>
    <p>O Fama System organiza processos e automatiza rotinas, mas não substitui assessoria jurídica, contábil, fiscal, técnica, bancária ou financeira. A empresa é responsável por decisões comerciais, cobranças, pagamentos, mensagens, execução dos serviços e relacionamento com clientes.</p>

    <h2>18. Privacidade</h2>
    <p>O tratamento de dados pessoais segue a <Link href="/privacidade">Política de Privacidade</Link>. Incidentes, suspeitas de acesso indevido ou solicitações de titulares devem ser comunicados pelo <Link href="/privacidade/solicitar">Canal de Privacidade</Link>.</p>

    <h2>19. Alterações destes Termos</h2>
    <p>Estes Termos podem ser atualizados quando houver mudanças no sistema, planos, integrações, segurança, legislação ou operação. Quando a alteração for relevante, o sistema poderá exigir novo aceite antes da continuidade de uso.</p>

    <footer><Link href="/">Voltar ao Fama System</Link><Link href="/privacidade">Política de Privacidade</Link><Link href="/privacidade/solicitar">Canal de Privacidade</Link></footer>
  </article></main>;
}
