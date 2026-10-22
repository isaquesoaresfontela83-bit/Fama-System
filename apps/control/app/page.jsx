import { ControlApp } from "./control-app";
import { AccessGate } from "./access-gate";
import { RestrictedAccess } from "./restricted-access";
import { appSignOutPath, getFamaUser } from "./system-auth";
import { isPlatformAdmin } from "@/lib/tenant";
export const dynamic = "force-dynamic";
export default async function Home() {
    const user = await getFamaUser();
    if (!user) {
        return <AccessGate />;
    }
    const signOutPath = appSignOutPath("/");
    if (!isPlatformAdmin(user))
        return <RestrictedAccess signOutPath={signOutPath}/>;
    return <ControlApp displayName={user.displayName} email={user.email} signOutPath={signOutPath} systemUrl="https://famasystem.online"/>;
}
