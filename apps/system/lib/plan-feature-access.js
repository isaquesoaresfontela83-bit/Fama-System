import { readActivePlanFeatures } from "./plan-policy-server";
import { RequestError } from "./request-error";
import { minimumPlanForFeature, planIncludesFeature, planNames } from "./plan-features";
export async function assertPlanFeature(plan, feature) {
    const features = await readActivePlanFeatures(plan);
    if (features !== undefined && !planIncludesFeature(plan, feature, features))
        throw new RequestError("Este recurso está desativado na configuração do seu plano. Entre em contato com a administração.", 403);
    if (planIncludesFeature(plan, feature, features))
        return;
    const labels = { finance: "O financeiro", assistant: "A Fama IA", freight: "O cálculo automático de frete", invoices: "O módulo de notas fiscais" };
    const label = labels[feature] ?? "Este recurso";
    throw new RequestError(`${label} está disponível a partir do plano ${planNames[minimumPlanForFeature(feature)]}. Acesse Planos e pagamentos para fazer upgrade.`, 403);
}
