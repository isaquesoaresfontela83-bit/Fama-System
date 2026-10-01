# Fama System

Plataforma SaaS multiempresa para gestão de negócios de piscinas. Reúne CRM, orçamentos e contratos em PDF, agenda, ordens de serviço, garantias, clientes e piscinas, estoque, financeiro, equipe e controle de usuários, com temas claro e escuro persistidos por usuário.

## Multiempresa e segurança

- A autenticação é feita por **Entrar com ChatGPT** na infraestrutura do ChatGPT Sites.
- Cada empresa possui um `organization_id` próprio em todos os registros operacionais.
- Toda API valida no servidor a identidade autenticada, a empresa informada e a participação do usuário.
- Proprietários e administradores podem convidar usuários e excluir registros com confirmação.
- O administrador da plataforma controla apenas situação e quantidade de usuários das empresas; não recebe acesso automático aos dados internos.
- Visitantes não autenticados visualizam somente a página pública de apresentação.

## Perfis de acesso

- `owner`: proprietário da empresa; administra usuários e registros.
- `admin`: administra usuários comuns e registros.
- `member`: utiliza os módulos operacionais.
- `technician`: utiliza os módulos operacionais como técnico.

## Estrutura principal

- `app/`: interface Next/Vinext e rotas de API.
- `db/schema.ts`: modelo completo do banco D1.
- `drizzle/`: migrações versionadas do banco.
- `lib/tenant.ts`: autorização e isolamento multiempresa.
- `lib/quote-pdf.ts` e `lib/contract-pdf.ts`: geração dos documentos.
- `.openai/hosting.json`: configuração do projeto no ChatGPT Sites.

## Desenvolvimento

Requer Node.js 22.13 ou superior.

```bash
npm install
npm run dev
```

Comandos disponíveis:

- `npm run dev`: inicia o ambiente local.
- `npm run build`: gera o Worker e os recursos de produção.
- `npm run db:generate`: gera uma nova migração a partir de `db/schema.ts`.
- `npm run lint`: verifica a qualidade do código.
- `npm test`: executa a compilação e os testes automatizados existentes.

## Variável de ambiente

Configure `PLATFORM_OWNER_EMAIL` no ambiente de hospedagem com o e-mail autenticado do responsável pela plataforma. O valor não deve ser incluído no repositório.

## Publicação

O projeto foi preparado para o ChatGPT Sites com banco D1. Na publicação, as migrações em `drizzle/` devem ser aplicadas antes da nova versão do Worker começar a receber tráfego.

## Fama IA

A **Fama IA interna** é um assistente de gestão com interpretação por regras locais. Não usa modelo generativo, chave OpenAI, API de IA externa ou requisições de rede para responder. O motor em `lib/fama-ai.ts` analisa exclusivamente os registros que a interface já recebeu pelos mecanismos autenticados existentes do sistema. Não altera a infraestrutura de autenticação ou banco de dados.

Na gestão operacional, o assistente usa agenda, CRM, orçamentos, ordens de serviço, clientes, estoque, financeiro, equipe, garantias e contratos da empresa ativa. No Fama Control, usa as empresas e os usuários carregados e as listas administrativas disponíveis. Um módulo não carregado é informado como indisponível, sem inventar registros ou buscar dados de outra empresa.

Consultas disponíveis incluem **agenda de hoje**, **agenda amanhã**, **agenda da semana** (próximos 7 dias), **agenda em 05/10/2026**, **conflitos na agenda**, **estoque baixo**, **resumo financeiro**, **garantias vencidas**, **empresas suspensas** e **resumo da gestão**. Escolha um módulo e use **buscar: nome** para filtrar. A agenda considera o fuso do navegador e identifica compromissos com o mesmo técnico no mesmo instante; como o cadastro não informa duração, não calcula sobreposições entre horários diferentes.

Os totais consideram os registros carregados; as listas exibem até 20 itens. Os botões abrem os módulos e formulários existentes, inclusive **Novo agendamento**, sem executar alterações silenciosas. A conversa permanece apenas na memória do componente e é descartada ao sair da área, trocar de empresa ou clicar em **Nova conversa**. As perguntas e os registros não são enviados a provedores externos.

### Configuração no Fama Control

Administradores da plataforma têm a aba **Configurar IA**. Ela permite ligar ou desligar o assistente, habilitar funções por módulo, editar o nome e a mensagem inicial, definir de 5 a 100 itens por resposta, controlar a abertura de módulos e formulários, ativar a detecção de conflitos e cadastrar até 30 respostas fixas para perguntas exatas. A prévia usa o rascunho e listas vazias; **Salvar configuração** aplica as mudanças ao sistema. **Restaurar padrão no rascunho** exige salvar para aplicar.

As preferências são globais e são armazenadas em `public.fama_ai_settings`, no banco já utilizado pelo Fama Control. A leitura contém apenas opções e mensagens compartilhadas com os usuários, sem registros operacionais. A gravação passa pela sessão autenticada e pela ação `ai_settings_save`, que valida o administrador no servidor. Usuários comuns e proprietários de empresas não recebem permissão para editar a configuração global. As atualizações usam revisão para impedir que dois administradores sobrescrevam a mesma versão e registram o número da revisão na auditoria.

As interfaces carregam as preferências pelo endpoint interno `/api/ai-settings`, atualizam ao receber foco e a cada minuto, e notificam outras abas do mesmo navegador ao salvar. Uma mudança de revisão descarta a conversa anterior. Sem configuração disponível, o assistente fica indisponível até a leitura funcionar; não assume que todas as funções estão permitidas. As configurações controlam o assistente e não substituem a autorização das APIs de gestão.

Para disponibilizar esta versão, aplique `supabase/migrations/20261001210000_fama_ai_settings.sql`, publique a Edge Function `fama-control` com o arquivo compartilhado em `supabase/functions/_shared/fama-ai-settings.ts` e publique a interface atualizada. Essas alterações de implantação não são feitas automaticamente ao compilar. Nenhuma chave ou API de provedor de IA é necessária.
