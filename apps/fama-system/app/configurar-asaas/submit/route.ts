import { redirect } from "next/navigation";

import { AsaasError } from "@/lib/asaas";
import { savePlatformBillingConfig } from "@/lib/billing";
import { requiredText } from "@/lib/database";
import { requirePlatformAdmin } from "@/lib/tenant";

export async function POST(request: Request) {
  try {
    await requirePlatformAdmin();
    const formData = await request.formData();
    const apiKey = requiredText(formData.get("apiKey"), "Chave Asaas");
    const environment = formData.get("environment");
    await savePlatformBillingConfig({ apiKey, environment });
  } catch (error) {
    if (error instanceof AsaasError) redirect(`/configurar-asaas?asaas=error&message=${encodeURIComponent(error.message)}`);
    redirect("/configurar-asaas?asaas=error");
  }
  redirect("/configurar-asaas?asaas=saved");
}
