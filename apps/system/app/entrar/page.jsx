import { AccessGate } from "../access-gate";
import { getFamaUser } from "../system-auth";
import { redirect } from "next/navigation";
import { onboardingPath } from "@/lib/onboarding-intent";
export const dynamic = "force-dynamic";
export const metadata = { title: "Entrar | Fama System" };
export default async function LoginPage(props) {
    const { searchParams } = props ?? {};
    const values = await searchParams ?? {};
    const addingAccount = values.add_account === '1';
    const user = await getFamaUser();
    if (user && !addingAccount)
        redirect(onboardingPath(values));
    return <AccessGate initialMode={addingAccount ? 'login' : values.signup === "1" ? "signup" : "login"} addingAccount={addingAccount} reconnectingAccount={addingAccount && values.reconnect === '1'} initialEmail={String(values.email ?? '').slice(0, 254)} currentAccountName={user?.displayName}/>;
}
