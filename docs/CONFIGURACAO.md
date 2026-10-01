# Configuração dos servidores

Os modelos ficam em `config/env/fama-system.dev.vars.example` e `config/env/fama-control.dev.vars.example`. O inventário `inventario-do-ambiente.json` registra os nomes presentes na hospedagem atual; `null` indica valor omitido na entrega, não ausência de configuração.

| Variável | Uso | Aplicação |
| --- | --- | --- |
| `DATA_BACKEND` | `supabase` para o backend atual; `d1` preserva o fluxo legado/auxiliar. | Ambos |
| `SUPABASE_URL` | URL do projeto Supabase da instalação. | Ambos |
| `SUPABASE_AUTH_ENABLED` | Habilita login Supabase; use `true`. | Ambos |
| `SUPABASE_PUBLISHABLE_KEY` | Chave publicável para as chamadas de Auth. | Ambos |
| `SUPABASE_SECRET_KEY` | Chave administrativa do Supabase, somente no servidor. Obrigatória no Control; no System o acesso direto é alternativa à ponte privada. | Ambos |
| `SUPABASE_STORAGE_BUCKET` | Bucket privado; o padrão é `fama-documents`. | Ambos |
| `PLATFORM_OWNER_EMAIL` | E-mail do administrador da plataforma. | Ambos |
| `PLATFORM_OWNER_USER_ID` | UUID do administrador no Supabase Auth. | Ambos |
| `FAMA_DATA_ENCRYPTION_KEY` | Chave de 32 bytes, representada como 64 caracteres hexadecimais ou base64. Mantenha a chave apropriada ao banco compartilhado. | Ambos |
| `FAMA_DATA_BRIDGE_SECRET` | Segredo idêntico nos dois servidores para a ponte privada. | Ambos |
| `FAMA_ASAAS_ENVIRONMENT` | `sandbox` em testes; `production` para a conta real configurada. | System |
| `FAMA_ASAAS_API_KEY` | Credencial de assinatura da plataforma. | System |
| `FAMA_ASAAS_WEBHOOK_TOKEN` | Validação das notificações do Asaas. | System |
| `OPENAI_API_KEY` | Ativa a API de IA, conforme a implementação em `app/api/fama-ai/route.ts`. | System, opcional |
| `FAMA_AI_MODEL` | Modelo de IA opcional; o código contém seu fallback. | System, opcional |
| `META_WHATSAPP_TOKEN` | Credencial da WhatsApp Cloud API. | System, opcional |
| `META_WHATSAPP_PHONE_NUMBER_ID` | Identificador do número configurado na Meta. | System, opcional |
| `META_WHATSAPP_VERIFY_TOKEN` | Verificação do webhook da Meta. | System, opcional |
| `FAMA_LAUNCH_CHECK_TOKEN` | Acesso restrito e temporário à manutenção de lançamento. | System, manutenção |
| `FAMA_LAUNCH_CHECK_EXPIRES_AT` | Vencimento ISO da manutenção; o endpoint limita a janela. Deixe vazio no uso normal. | System, manutenção |

O inventário também preserva `PLUGGY_CLIENT_ID`, `PLUGGY_CLIENT_SECRET` e `FAMA_SESSION_SECRET`, cadastradas no ambiente do System. A conferência das fontes atuais não encontrou consumo direto desses nomes nos módulos em execução. A presença no ambiente e a menção em documentação antiga não comprovam que uma integração esteja ativa. Não configure serviços apenas porque aparece um campo no modelo.

## Chaves próprias e ponte privada

O Control realiza operações administrativas do Supabase no servidor. O System usa acesso Supabase direto quando recebe `SUPABASE_SECRET_KEY`; sem essa chave, usa a ponte em `/api/internal/data` do Control, protegida por `FAMA_DATA_BRIDGE_SECRET`. Os endereços da ponte e dos planos/suporte estão fixos nas fontes atuais e devem ser ajustados para uma cópia independente.

Configure as credenciais no runtime da hospedagem. Arquivos `.dev.vars` servem ao desenvolvimento local e não criam segredos automaticamente na produção. As chaves administrativas e de integração nunca devem usar prefixos que as exponham ao navegador.

Para gerar material aleatório de 32 bytes no seu terminal, sem gravá-lo no repositório:

```bash
node -e 'process.stdout.write(require("node:crypto").randomBytes(32).toString("hex") + "\n")'
```

Use gerações independentes para a chave de criptografia, o segredo de ponte e os tokens de webhook. Ao conectar uma cópia a um banco já existente, preserve a chave de criptografia desse banco.

## Integrações por empresa

As credenciais de financeiro e emissão fiscal cadastradas pela empresa são tratadas pelas APIs e armazenadas conforme as regras de criptografia do sistema. A chave Asaas de mensalidade da plataforma é uma configuração diferente das credenciais financeiras de cada empresa.

Há recursos de mensagens por links WhatsApp que não dependem da Cloud API. A sincronização nativa de todos os provedores financeiros não está implementada apenas por um provedor aparecer no cadastro. Consulte os READMEs originais e os códigos para distinguir campos de configuração, importação manual e integração efetiva.
