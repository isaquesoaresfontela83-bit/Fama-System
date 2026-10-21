# Fama System + Fama Control em VPS

Destino escolhido: Oracle Cloud Always Free, sujeito à aprovação do cadastro e à disponibilidade de capacidade. Esta preparação não cria uma conta Oracle, não provisiona um servidor e não altera os domínios atuais.

## Estrutura

Coloque os dois projetos atuais em diretórios irmãos chamados `system` e `control`. Execute os comandos desta pasta (`system/deployment/vps`). O Compose compila cada aplicação com Next.js/Node.js, conserva bancos SQLite e arquivos de backup em volumes distintos e conecta os serviços internos com autenticação. O serviço Python é executado via ASGI; o Baileys utiliza seu processo Node.js persistente. O Caddy termina o HTTPS. Nenhum desses serviços depende de uma conta Cloudflare para executar.

O login e os dados que já estão no Supabase continuam vinculados ao projeto Supabase configurado. Esta migração muda a hospedagem; não substitui contas nem políticas de acesso. O banco SQLite da VPS substitui os bancos D1 locais. Os identificadores antigos das integrações são preservados para manter as configurações salvas compatíveis; a interface da versão VPS apresenta os nomes do armazenamento local.

## Antes da instalação

1. Provisionar uma VM **Always Free elegível**, com Ubuntu e arquitetura compatível. Validar a estimativa de custo em zero e os limites da conta antes de criar a VM. Não ativar recursos pagos ou upgrade de conta.
2. Instalar Docker Engine e o plugin Docker Compose pela documentação oficial do Docker para Ubuntu. Só publicar as portas 80 e 443; restringir SSH à administração. Os bancos, Python, Baileys e o modelo não têm portas públicas no Compose.
3. Obter backups SQL atuais dos dois bancos D1 e preservar as configurações de cada aplicação. Usar a **mesma chave de criptografia original** para ler os registros importados. Um banco local vazio não recupera clientes, contas ou configurações.
4. Preparar os apontamentos DNS dos domínios para o novo IP. O HTTPS do Caddy depende desses apontamentos. Manter o sistema atual atendendo enquanto a nova instalação é validada.

## Configuração e importação

```sh
python3 prepare-env.py
```

Preencha `.env`, `system.env` e `control.env` no servidor, incluindo as credenciais dos provedores já utilizados e o e-mail de administração dos certificados. Esses arquivos são privados e não entram no repositório. Não troque chaves de criptografia de dados existentes por chaves novas.

```sh
python3 restore-sql.py /caminho/system.sql /caminho/novo/system.sqlite
python3 restore-sql.py /caminho/control.sql /caminho/novo/control.sqlite
docker compose build
docker compose create system control
```

Copie os arquivos restaurados para `/data/fama.sqlite` nos volumes de cada container, com proprietário UID/GID 1000 e modo 600, antes de iniciar. O importador verifica integridade e referências e recusa sobrescrever um banco existente. O processo de inicialização recusa criar bancos vazios por padrão.

```sh
docker compose up -d
docker compose ps
docker compose logs --tail=80 system control python baileys
```

Para uma instalação **descartável de testes**, `FAMA_ALLOW_EMPTY_DATABASE=true` permite criar o esquema vazio explicitamente. Desative essa opção após a preparação. Não use essa opção como substituto da migração de dados.

## IA e WhatsApp

O núcleo Fama IA que consulta os registros permanece disponível conforme as permissões da aplicação. A geração de texto pelo Python vem pausada. Para executá-la na própria VPS, instale o modelo opcional e só então ative a geração:

```sh
docker compose --profile local-model up -d ollama
docker compose exec ollama ollama pull qwen2.5:1.5b
```

Depois configure `FAMA_AI_GENERATIVE_ENABLED=true` e recrie `python`, `system` e `control`. Teste a resposta e o uso real de CPU/RAM antes de disponibilizar o modelo aos usuários. A preparação não afirma que esse modelo tem a capacidade do modelo grande anteriormente selecionado no Workers AI.

O Baileys mantém sessões em um volume privado. As sessões existentes precisam ser migradas com sua chave original, ou vinculadas novamente por QR. A migração da hospedagem não emparelha um WhatsApp sem a aprovação do titular no celular.

## Validação e troca

Verificar os dois logins, seleção de empresas, permissões, leitura/gravação de registros, orçamentos/PDF, planos e cobranças, agenda, notificações, backups e a aba Gerenciar APIs. Comparar contagens e campos representativos dos bancos antes e depois da importação, incluindo valores criptografados. Configurar callbacks dos provedores para o destino efetivamente utilizado, quando necessário.

Só trocar o tráfego de produção após os dois sistemas passarem pela validação. Guardar um backup fora da VPS e um plano de retorno à instalação anterior. Os volumes locais não protegem contra a perda da própria máquina.

## Limites desta preparação

As verificações locais e de compilação são registradas no relatório da migração. Docker, ARM64, desempenho sob carga, dados reais, credenciais dos provedores e HTTPS devem ser validados na VM real. Enquanto não houver conta Oracle validada, VM criada e dados importados, a migração não está publicada.
