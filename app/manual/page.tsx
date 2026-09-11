import { redirect } from "next/navigation";
import { readFamaControlSession } from "@/lib/fama-control-session";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 rounded-3xl border border-[#2a507c] bg-[#0d284c] p-5 shadow-xl sm:p-7">
      <h2 className="text-2xl font-black tracking-tight text-white">{title}</h2>
      <div className="mt-4 space-y-3 text-sm leading-7 text-[#c2d4e6]">{children}</div>
    </section>
  );
}

export default async function ManualControlPage() {
  const session = await readFamaControlSession();
  if (!session) redirect("/");

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_12%_0,#06405d_0,transparent_27%),linear-gradient(180deg,#071a2d,#041020)] text-[#edf7ff]">
      <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
        <header className="mb-6 rounded-3xl border border-[#2a507c] bg-[#0d284c] p-6 shadow-2xl sm:p-8">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <div className="text-xs font-black tracking-[.16em] text-[#74def5]">FAMA CONTROL</div>
              <h1 className="mt-2 text-3xl font-black tracking-tight sm:text-4xl">Manual administrativo completo</h1>
              <p className="mt-3 max-w-3xl text-sm leading-7 text-[#b8cadb]">Guia do proprietário para empresas, usuários, permissões, auditoria, backups, segurança e privacidade.</p>
              <p className="mt-2 text-xs text-[#87a1ba]">Sessão administrativa: {session.user.email}</p>
            </div>
            <a href="/" className="rounded-xl border border-[#355f8b] bg-[#0e3159] px-4 py-2 text-sm font-extrabold hover:bg-[#164472]">← Voltar ao Control</a>
          </div>
        </header>

        <div className="grid gap-6 lg:grid-cols-[270px_1fr]">
          <aside className="lg:sticky lg:top-5 lg:self-start">
            <nav className="rounded-3xl border border-[#2a507c] bg-[#0d284c] p-4 shadow-xl">
              <strong className="text-sm text-white">Índice</strong>
              <div className="mt-3 grid gap-1 text-sm text-[#b8cadb]">
                {[
                  ["acesso", "1. Acesso e segurança"],
                  ["overview", "2. Visão geral"],
                  ["empresas", "3. Empresas"],
                  ["usuarios", "4. Usuários e permissões"],
                  ["auditoria", "5. Auditoria"],
                  ["backup", "6. Backup e lixeira"],
                  ["seguranca", "7. Segurança e limites"],
                  ["lgpd", "8. Privacidade / LGPD"],
                  ["rotina", "9. Rotina do proprietário"],
                  ["problemas", "10. Solução de problemas"],
                ].map(([id, label]) => <a key={id} href={`#${id}`} className="rounded-lg px-2 py-1.5 hover:bg-[#12335d] hover:text-white">{label}</a>)}
              </div>
            </nav>
          </aside>

          <div className="space-y-5">
            <Section id="acesso" title="1. Acesso e segurança">
              <ol className="list-decimal space-y-2 pl-5">
                <li>Acesse o Fama Control e entre com o e-mail e a senha administrativa cadastrados.</li>
                <li>O login é validado pelo Supabase Auth e, em seguida, o backend confirma se a conta está autorizada para o Fama Control.</li>
                <li>A sessão administrativa é armazenada em cookie protegido e renovada automaticamente enquanto a autenticação for válida.</li>
                <li>Ao terminar, use <strong>Sair</strong>, principalmente em computador compartilhado.</li>
              </ol>
              <p><strong>Nunca compartilhe a conta do proprietário.</strong> Para outras pessoas, crie usuários próprios no painel.</p>
            </Section>

            <Section id="overview" title="2. Visão geral">
              <p>A Visão geral resume a quantidade de empresas ativas, vínculos de usuários, estado do backend e tipo de autenticação.</p>
              <p>Em <strong>Ações rápidas</strong> você pode criar empresa, criar usuário, gerar backup global e abrir a auditoria sem navegar por outras abas.</p>
              <p>Use essa tela como primeira verificação quando entrar no Control: empresas ativas, usuários esperados e backend online.</p>
            </Section>

            <Section id="empresas" title="3. Empresas">
              <p>A aba Empresas centraliza o ciclo de vida de cada organização cadastrada.</p>
              <ul className="list-disc space-y-2 pl-5">
                <li><strong>Nova empresa:</strong> cria uma nova organização administrável.</li>
                <li><strong>Suspender:</strong> interrompe o acesso operacional daquela empresa sem apagar seus registros.</li>
                <li><strong>Reativar:</strong> devolve a empresa ao estado ativo.</li>
                <li><strong>Enviar para lixeira:</strong> retira a empresa da operação ativa para posterior recuperação, quando suportado pelo backend.</li>
              </ul>
              <div className="rounded-2xl border border-[#7e622b] bg-[#3b2c12] p-4 text-[#ffe3a8]"><strong>Antes de suspender ou excluir:</strong> confirme o nome da empresa, usuários vinculados e se existe operação em andamento.</div>
            </Section>

            <Section id="usuarios" title="4. Usuários, perfis e permissões individuais">
              <p>A aba Usuários é o ponto principal para controlar quem pode acessar cada função.</p>
              <ol className="list-decimal space-y-2 pl-5">
                <li>Clique em <strong>+ Novo usuário</strong>.</li>
                <li>Informe nome, e-mail e uma senha temporária com pelo menos 8 caracteres.</li>
                <li>Selecione a empresa correta e defina o perfil: Administrador, Usuário ou Técnico.</li>
                <li>Depois do cadastro, marque ou desmarque os módulos clicando nas caixas: Visão geral, CRM, Orçamentos, Agenda, Ordens de serviço, Garantias, Clientes e piscinas, Contratos, Estoque, Financeiro e Equipe.</li>
                <li>Clique em <strong>Salvar acessos</strong> para registrar as permissões daquele usuário.</li>
              </ol>
              <p>O <strong>Proprietário</strong> aparece como acesso total e suas permissões administrativas ficam protegidas contra alteração acidental no painel.</p>
              <p><strong>Alterar senha:</strong> localize o usuário, clique em Alterar senha e informe a nova senha. <strong>Remover vínculo:</strong> retira o usuário da empresa selecionada.</p>
              <div className="rounded-2xl border border-[#315b86] bg-[#0e2d53] p-4"><strong>Regra recomendada:</strong> dê somente os módulos necessários para o trabalho de cada pessoa e revise esses acessos regularmente.</div>
            </Section>

            <Section id="auditoria" title="5. Auditoria">
              <p>A Auditoria lista eventos recentes com data, tipo de evento, entidade afetada, empresa e usuário responsável.</p>
              <p>Use <strong>↻ Atualizar</strong> para recarregar os eventos. Consulte esta aba quando precisar entender quem executou uma alteração, investigar comportamento inesperado ou conferir operações administrativas.</p>
              <p>Não use a auditoria como substituto de backup: ela é histórico de eventos, enquanto o backup preserva estados/dados recuperáveis conforme as funções do backend.</p>
            </Section>

            <Section id="backup" title="6. Backup e lixeira">
              <ul className="list-disc space-y-2 pl-5">
                <li><strong>Backup global:</strong> cria um ponto de backup abrangente da administração.</li>
                <li><strong>Backup da empresa:</strong> cria backup relacionado à empresa indicada.</li>
                <li><strong>Exportar JSON atual:</strong> baixa uma exportação dos dados administrativos disponíveis.</li>
                <li><strong>Lixeira:</strong> lista empresas e snapshots recuperáveis e oferece ação de restauração quando disponível.</li>
              </ul>
              <p>Crie backup antes de alterações grandes, exclusões, reorganização de usuários ou mudanças de estrutura.</p>
              <p>Após restaurar algo, volte às abas correspondentes e confira se o estado esperado foi recuperado.</p>
            </Section>

            <Section id="seguranca" title="7. Segurança, saúde técnica e limites">
              <p>A aba Segurança mostra informações retornadas pelo backend sobre saúde técnica e contas Auth, quando disponíveis.</p>
              <p>A área de Limites mostra contadores administrativos. <strong>Limpar limites</strong> deve ser usado apenas quando você entender por que o limite foi atingido; não use repetidamente para mascarar abuso, loop ou erro.</p>
              <ul className="list-disc space-y-2 pl-5">
                <li>Revise contas desconhecidas ou vínculos inesperados.</li>
                <li>Troque senhas imediatamente se houver suspeita de comprometimento.</li>
                <li>Remova usuários que não precisam mais de acesso.</li>
                <li>Evite acessar o Fama Control em dispositivos públicos.</li>
              </ul>
            </Section>

            <Section id="lgpd" title="8. Privacidade / LGPD">
              <p>A aba Privacidade lista solicitações administrativas relacionadas a privacidade, com tipo, data, detalhes e status.</p>
              <p>Use <strong>↻ Atualizar</strong> antes de avaliar uma solicitação. Mantenha registro interno da decisão e trate dados pessoais somente na medida necessária para a operação.</p>
              <p>Evite exportar ou compartilhar dados pessoais sem finalidade operacional legítima e autorização adequada.</p>
            </Section>

            <Section id="rotina" title="9. Rotina recomendada do proprietário">
              <ol className="list-decimal space-y-2 pl-5">
                <li><strong>Diariamente:</strong> confira Visão geral e falhas aparentes.</li>
                <li><strong>Ao contratar alguém:</strong> crie usuário próprio, escolha empresa, perfil e somente os módulos necessários.</li>
                <li><strong>Ao trocar função:</strong> revise as permissões imediatamente.</li>
                <li><strong>Ao desligar alguém:</strong> remova o vínculo ou desative o acesso e revise a senha se houve compartilhamento indevido.</li>
                <li><strong>Semanalmente:</strong> revise Auditoria e usuários ativos.</li>
                <li><strong>Antes de mudança grande:</strong> crie backup.</li>
                <li><strong>Periodicamente:</strong> valide Segurança, limites e solicitações de privacidade.</li>
              </ol>
            </Section>

            <Section id="problemas" title="10. Solução de problemas">
              <div className="space-y-3">
                <p><strong>“Este e-mail não está autorizado”:</strong> a autenticação pode ter sido aceita, mas a conta não está habilitada como administradora do Control.</p>
                <p><strong>“Sessão expirada”:</strong> volte à tela inicial e entre novamente.</p>
                <p><strong>Dados não carregam:</strong> atualize a página, confira Segurança/saúde técnica e tente novamente.</p>
                <p><strong>Permissão não salvou:</strong> marque/desmarque novamente, use Salvar acessos e recarregue para confirmar persistência.</p>
                <p><strong>Usuário não aparece no Auth ao trocar senha:</strong> confirme o e-mail e se a conta de autenticação foi criada corretamente.</p>
                <p><strong>Backup/restauração falhou:</strong> não repita operações destrutivas; confira Auditoria e o estado do backend antes de tentar de novo.</p>
              </div>
              <div className="rounded-2xl border border-[#2d7756] bg-[#0f3328] p-4 text-[#b7f5d5]">Em caso de dúvida, primeiro preserve os dados: evite excluir, faça backup e registre o que aconteceu antes de corrigir.</div>
            </Section>
          </div>
        </div>
      </div>
    </main>
  );
}
