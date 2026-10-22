# Fama System e Fama Control: hospedagem híbrida

Versão conjunta 15.7.0. As interfaces React são compiladas como sites estáticos; os endpoints protegidos continuam em Node.js na Render; login e dados operacionais permanecem no Supabase. O banco auxiliar passa para esquemas PostgreSQL privados no mesmo projeto Supabase. O Control arquiva backups criptografados em um bucket Supabase privado quando configurado.

## Desvantagens aceitas

- Um backend gratuito da Render pode suspender após 15 minutos sem tráfego; o despertar leva cerca de um minuto. As telas estáticas continuam disponíveis, mas as ações que precisam do servidor aguardam.
- As 750 horas gratuitas mensais são compartilhadas pelos serviços do workspace. Duas APIs não podem ficar ligadas o mês inteiro sem exceder essa cota. Não há tentativa de contornar a suspensão com pings.
- O disco da Render é descartável. Este destino não usa bancos SQLite nem arquivos de sessão Baileys locais. A persistência depende da disponibilidade e das cotas do Supabase.
- A geração de texto Python vem desativada e não há processo Ollama nem Baileys gratuito contínuo nesta configuração. A IA executada no dispositivo continua disponível conforme as funções já existentes.
- Há mais configurações e serviços para manter. Não há garantia de disponibilidade contínua para produção nos planos gratuitos.

## Preparação dos dados

Preservar uma cópia atual de cada banco D1 e suas chaves originais de criptografia. Se a exportação recebida for SQL, usar primeiro o importador SQLite em `deployment/vps/restore-sql.py`, que não sobrescreve arquivos existentes.

Configurar `FAMA_POSTGRES_URL` usando a conexão do Supabase, preferencialmente o pooler em modo sessão para redes IPv4. Manter TLS com validação de certificado. Não colocar conexão, senha, chave secreta ou chave de criptografia no site estático. Recomenda-se usuário PostgreSQL dedicado com acesso somente ao esquema da respectiva aplicação.

Em cada checkout, com as variáveis do ambiente carregadas de forma privada:

```sh
node scripts/migrate-hybrid-runtime.mjs /caminho/copia-atual.sqlite
```

Usar `FAMA_POSTGRES_SCHEMA=fama_system_runtime` no System e `fama_control_runtime` no Control. O importador usa transação, compara todos os registros com a origem, preserva os valores criptografados, protege o esquema contra os papéis públicos e recusa sobrescrever esquemas com tabelas. `--empty-test` existe somente para testes descartáveis e não substitui dados reais. O início da API recusa um esquema sem marcador de importação.

No Control, manter `SUPABASE_SECRET_KEY` exclusivamente no backend. Para arquivar backups, criar um bucket **privado** e informar `FAMA_BACKUP_BUCKET`; não tornar seus objetos públicos. A opção de snapshot auxiliar PostgreSQL verifica a restauração em tabelas temporárias, sem sobrescrever tabelas reais.

## Compilação e serviços

```sh
npm ci --ignore-scripts --no-audit --no-fund
npm run test:hybrid
npm run build:hybrid-static
npm run build:hybrid-api
```

Criar uma API Docker gratuita por projeto com `deployment/hybrid/Dockerfile`; o modelo `render-api.json` omite valores secretos. Copiar as configurações atuais para o ambiente do servidor e preencher os campos de `backend.env.example`. Usar o mesmo segredo de ponte nos dois e URLs HTTPS reais dos respectivos backends. Não criar uma nova base operacional Supabase nem trocar suas políticas existentes.

Depois de receber a URL real da API:

```sh
node scripts/configure-hybrid.mjs --api https://URL-REAL-DA-API
# No checkout Control, adicionar --control.
```

O script gera `deployment/hybrid/render-static.json`, uma configuração Blueprint em JSON/YAML válido. O site estático publica `hybrid-dist`. As regras encaminham `/api/*` para a API real e preservam a origem do navegador; não usar redirecionamento HTTP para esses endpoints. Os cookies continuam HttpOnly/Secure e as verificações de origem usam `FAMA_PUBLIC_URL`, que deve ser o domínio real da interface correspondente. Conferir no serviço publicado o transporte dos cookies pelo proxy, inclusive alternância de contas, MFA e recuperação de senha.

Os caminhos excepcionais de configuração Asaas e atualização do leitor são encaminhados ao backend; suas dependências `/_next/*` também. Demais telas públicas, login, recuperação, propostas e interfaces operacionais são servidas pelo pacote estático.

## Validação antes da troca de domínio

Conferir os dois logins, MFA, confirmação e recuperação, alternância de contas, isolamento de empresas, contratos, orçamentos/PDF, planos, cobranças, agenda, notificações, Gerenciar APIs e backups. Comparar registros importados, contagens e campos criptografados com as cópias originais. Despertar a Render após suspensão e confirmar que configurações continuam salvas. Não ativar geração Python nem WhatsApp Baileys até existir serviço persistente apropriado.

Os testes locais não substituem validação dos cookies, limites de memória, credenciais, banco e rede na hospedagem real. Só trocar `famasystem.online` e `control.famasystem.online` depois de os dois destinos passarem pela validação. Guardar as versões e os dados atuais para retorno. Este arquivo não comprova publicação.
