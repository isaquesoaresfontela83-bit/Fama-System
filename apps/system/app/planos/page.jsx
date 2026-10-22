import { PlansView } from "../plans-view";
import { getPlanCatalog } from "@/lib/plans";
export const metadata = { title: "Planos e valores | Fama System" };
export default async function PlansPage() { return <PlansView plans={await getPlanCatalog()}/>; }
