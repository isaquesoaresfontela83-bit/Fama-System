import { env } from "cloudflare:workers";
import { hasFeaturePermission } from "@/lib/permissions";
import { assertRateLimit } from "@/lib/security";
import { RequestError, requireTenant, tenantError } from "@/lib/tenant";

type RuntimeEnvironment = {
  OPENAI_API_KEY?: string;
  FAMA_AI_MODEL?: string;
};

function runtime() {
  return env as unknown as RuntimeEnvironment;
}

function clean(value: unknown) {
  return String(value ?? "").trim();
}

function safeContext(value: unknown) {
  const raw = typeof value === "object" && value !== null ? value as Record<string, unknown> : {};
  const allowed = [
    "bankBalance",
    "receivable",
    "payable",
    "overdue",
    "overdueValue",
    "pendingBankMovements",
    "projectedBalance",
    "primaryProvider",
    "connectedProviders",
    "nextDue",
    "providers",
    "bankAccounts",
    "openReceivables",
    "openPayables",
  ];
  return Object.fromEntries(allowed.map((key) => [key, raw[key]]).filter(([, item]) => item !== undefined));
}

function systemPrompt() {
  return [
    "Você é a IA interna do Fama System, um ERP para empresas de piscinas.",
    "Responda sempre em português do Brasil, com foco operacional e financeiro.",
    "Use somente o contexto resumido fornecido. Se algo não estiver no contexto, diga que precisa ser conferido no sistema.",
    "Não invente saldos, datas, clientes, bancos, tokens, chaves, dados pessoais ou números bancários.",
    "Nunca revele nem peça segredos, tokens, chaves de API, senhas, CPF/CNPJ completos ou dados bancários sensíveis.",
    "Quando a pergunta envolver decisão, responda com: Diagnóstico, Prioridade de hoje, Próximos passos e Riscos.",
    "Se houver inadimplência, contas vencidas, saldo projetado negativo ou conciliação pendente, priorize esses alertas.",
    "Seja curto, direto e acionável. Evite texto genérico.",
  ].join("\n");
}

export async function GET() {
  return Response.json({ configured: Boolean(clean(runtime().OPENAI_API_KEY)) });
}

export async function POST(request: Request) {
  try {
    const { user, organization } = await requireTenant(request);
    if (!hasFeaturePermission(organization.role, organization.permissions, "finance")) throw new RequestError("Seu perfil não possui acesso ao assistente financeiro.", 403);
    await assertRateLimit(request, "fama_ai", user.id, 12, 60);
    const apiKey = clean(runtime().OPENAI_API_KEY);
    if (!apiKey) throw new RequestError("A IA do sistema está pronta, mas a chave OPENAI_API_KEY ainda não foi configurada no servidor.", 503);
    const body = (await request.json()) as { question?: unknown; context?: unknown; mode?: unknown };
    const question = clean(body.question).slice(0, 1200);
    if (question.length < 3) throw new RequestError("Escreva uma pergunta para a IA.", 400);
    const mode = clean(body.mode).slice(0, 40) || "finance";
    const context = JSON.stringify(safeContext(body.context)).slice(0, 7000);
    const model = clean(runtime().FAMA_AI_MODEL) || "gpt-5-mini";

    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        input: [
          {
            role: "system",
            content: systemPrompt(),
          },
          {
            role: "user",
            content: `Modo de análise: ${mode}\n\nContexto seguro do sistema:\n${context}\n\nPergunta do usuário:\n${question}`,
          },
        ],
      }),
    });
    const payload = (await response.json().catch(() => ({}))) as {
      error?: { message?: string };
      output_text?: string;
      output?: Array<{ content?: Array<{ text?: string }> }>;
    };
    if (!response.ok) throw new RequestError(payload.error?.message || "A IA não conseguiu responder agora.", response.status);
    const answer = payload.output_text || payload.output?.flatMap((item) => item.content ?? []).map((item) => item.text ?? "").join("\n").trim();
    return Response.json({ answer: answer || "Não consegui gerar uma resposta agora." });
  } catch (error) {
    return tenantError(error, "Não foi possível usar a IA do sistema.");
  }
}
