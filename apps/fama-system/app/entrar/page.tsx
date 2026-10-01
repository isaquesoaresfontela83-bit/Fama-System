import { AccessGate } from "../access-gate";
import { getFamaUser } from "../system-auth";
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar | Fama System" };

export default async function LoginPage() {
  if (await getFamaUser()) redirect("/");
  return <AccessGate />;
}
