import Link from "next/link";
import { notFound } from "next/navigation";

import { ThemeToggle } from "@/app/theme-toggle";
import { CheckoutClient } from "./checkout-client";
import { getPlanSnapshot, isBillingCycle, isPlanCode } from "@/lib/plans";

export const metadata = { title: "Assinar plano | Fama System" };

export default async function SubscribePlanPage({ params, searchParams }: { params: { plan: string }; searchParams?: { cycle?: string } }) {
  if (!isPlanCode(params.plan)) notFound();
  const plan = await getPlanSnapshot(params.plan);
  const initialCycle = isBillingCycle(searchParams?.cycle) ? searchParams.cycle : "monthly";
  return (
    <main className="plans-public-page checkout-public-page">
      <nav className="public-nav">
        <Link className="public-brand plans-brand" href="/planos">
          <span className="brand-mark" aria-hidden="true"><img src="/fama-piscinas-mark.png" alt="" /></span>
          <div><strong>Fama System</strong><small>Assinatura com Pix</small></div>
        </Link>
        <div className="public-nav-actions">
          <Link href="/planos" className="public-manual-link">Voltar aos planos</Link>
          <ThemeToggle />
        </div>
      </nav>
      <CheckoutClient planCode={params.plan} plan={plan} initialCycle={initialCycle} />
    </main>
  );
}
