import Link from "next/link";

export const metadata = { title: "Privacidade | Fama System" };

export default function PrivacyPage() {
  return <main className="legal-page"><article className="legal-document">
    <header><Link href="/" className="legal-brand">Fama System</Link><span>Versão de 24 de setembro de 2026</span></header>
    <h1>Política de Privacidade</h1>
    <p>Esta Política explica como o Fama System trata dados pessoais e dados operacionais da empresa. Para dados da conta, pagamento do plano, segurança e administração da plataforma, o Fama System pode atuar como controlador. Para dados de clientes, técnicos, fornecedores e registros inseridos pela empresa, em regra a empresa é controladora e o Fama System atua como operador.</p>

    <h2>1. Dados da conta e da empresa</h2>
    <p>Podemos tratar nome, e-mail, telefone, senha protegida, identificadores de sessão, empresa, plano, status de pagamento, permissões, usuários convidados, preferências, idioma, tema, aceite de políticas, logs de acesso e trilhas de auditoria.</p>

    <h2>2. Dados operacionais</h2>
    <p>O sistema pode armazenar leads, clientes, endereços, contatos, piscinas, visitas, técnicos, agenda, produtos, estoque, garantias, contratos, orçamentos, propostas, ordens de serviço, anexos, fotos, observações e histórico de alterações.</p>

    <h2>3. Dados financeiros e bancários</h2>
    <p>Quando a empresa usa o financeiro, podemos tratar valores, vencimentos, status, cobranças, Pix, QR Code, link de pagamento, comprovantes, extratos, saldo, conciliações, categorias, fornecedores, compras e movimentações. Dados vindos de provedores como Asaas, Mercado Pago, PagBank ou outros dependem da integração autorizada pela empresa.</p>

    <h2>4. Chaves de API e integrações</h2>
    <p>Chaves, tokens e credenciais de integrações são usados para executar a conexão solicitada, como consultar saldo, importar movimentações, criar cobranças, gerar Pix, conferir pagamentos ou iniciar operações permitidas. Sempre que tecnicamente suportado, esses dados são armazenados com proteção adicional e não são exibidos novamente no navegador.</p>

    <h2>5. Finalidades do tratamento</h2>
    <p>Usamos dados para autenticar usuários, criar e separar empresas, operar os módulos contratados, gerar documentos, processar pagamentos, sincronizar integrações, controlar permissões, fornecer suporte, prevenir fraude, registrar auditoria, recuperar registros, melhorar funcionalidades e cumprir obrigações legais.</p>

    <h2>6. Bases legais</h2>
    <p>O tratamento pode ocorrer para execução de contrato, procedimentos preliminares, cumprimento de obrigação legal ou regulatória, exercício regular de direitos, proteção do crédito, prevenção à fraude, legítimo interesse com avaliação de necessidade e, quando aplicável, consentimento.</p>

    <h2>7. Compartilhamento</h2>
    <p>Dados podem ser compartilhados com fornecedores necessários à operação, como hospedagem, banco de dados, autenticação, armazenamento, processamento de pagamentos, mensageria, suporte, segurança e provedores financeiros conectados pela empresa. O compartilhamento é limitado à finalidade contratada ou exigida por lei.</p>

    <h2>8. Provedores financeiros</h2>
    <p>Ao conectar uma conta financeira ou gerar cobrança por provedor externo, a empresa também se sujeita aos termos e políticas desse provedor. O Fama System pode receber de volta identificadores de cliente, cobrança, pagamento, status, saldo, link de pagamento, Pix copia e cola e dados mínimos necessários para conciliação.</p>

    <h2>9. IA e automações</h2>
    <p>Recursos de IA podem usar dados do próprio sistema para produzir resumos, sugestões, mensagens, cronogramas e análises. As respostas podem conter erros e devem ser revisadas pela empresa. Não use a IA para inserir dados sensíveis desnecessários, segredos, senhas, documentos excessivos ou informações sem autorização.</p>

    <h2>10. Segurança</h2>
    <p>São adotadas medidas como HTTPS, autenticação, limitação de tentativas, separação por empresa, controle de permissões, auditoria, armazenamento privado, criptografia adicional de campos sensíveis e proteção de credenciais de integração. Nenhum sistema elimina todos os riscos; usuários devem proteger senha, dispositivos e acessos.</p>

    <h2>11. Retenção</h2>
    <p>Os dados são mantidos pelo tempo necessário para prestar o serviço, cumprir obrigações legais, manter segurança, permitir auditoria, resolver disputas e preservar direitos. Registros excluídos podem permanecer em área de recuperação por até 30 dias. Logs, consentimentos e auditorias podem seguir prazos próprios.</p>

    <h2>12. Direitos dos titulares</h2>
    <p>O titular pode solicitar confirmação de tratamento, acesso, correção, anonimização, bloqueio, eliminação, portabilidade quando aplicável, informação sobre compartilhamento, revisão de decisões, oposição e revogação de consentimento. A resposta pode depender de confirmação de identidade e da análise da empresa controladora dos dados.</p>

    <h2>13. Responsabilidade da empresa contratante</h2>
    <p>A empresa deve informar seus próprios clientes e funcionários sobre o uso do sistema, manter base legal adequada, cadastrar apenas dados necessários, responder pedidos de titulares quando for controladora e orientar sua equipe sobre uso correto da plataforma.</p>

    <h2>14. Cookies e armazenamento local</h2>
    <p>Usamos cookies e armazenamento local essenciais para sessão, segurança, autenticação, tema e funcionamento do sistema. Não usamos cookies publicitários nesta versão.</p>

    <h2>15. Transferência internacional</h2>
    <p>Fornecedores de infraestrutura, segurança, autenticação, pagamentos ou comunicação podem processar dados em outros países. Quando isso ocorre, adotamos salvaguardas técnicas e contratuais compatíveis com a legislação aplicável.</p>

    <h2>16. Incidentes</h2>
    <p>Suspeitas de acesso indevido, vazamento, perda de dispositivo, uso indevido de conta, credencial exposta ou operação financeira suspeita devem ser comunicadas rapidamente pelo Canal de Privacidade ou suporte interno, para análise e contenção.</p>

    <h2>17. Alterações desta Política</h2>
    <p>Esta Política pode ser atualizada para refletir novas funções, integrações, regras financeiras, requisitos legais ou melhorias de segurança. Quando a alteração for relevante, o sistema poderá solicitar novo aceite.</p>

    <h2>18. Contato</h2>
    <p>Use o <Link href="/privacidade/solicitar">Canal de Privacidade</Link>. Usuários autenticados também podem acompanhar solicitações na área Privacidade e segurança do sistema.</p>

    <footer><Link href="/">Voltar ao Fama System</Link><Link href="/termos">Termos de Uso</Link><Link href="/privacidade/solicitar">Fazer solicitação</Link></footer>
  </article></main>;
}
