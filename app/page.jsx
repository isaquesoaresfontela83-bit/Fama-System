import { FamaSystemApp } from "./cloriva-app";
import { AccessGate } from "./access-gate";
import { CompanyOnboarding } from "./company-onboarding";
import { famaSignInPath, famaSignOutPath, getFamaUser } from "./fama-auth";
import { getUserOrganizations, isPlatformAdmin } from "@/lib/tenant";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function Home() {
  const user = await getFamaUser();
  if (!user) return <AccessGate signInPath={famaSignInPath("/")} />;
  const organizations = await getUserOrganizations(user);
  if (!organizations.length) return <CompanyOnboarding displayName={user.displayName} email={user.email} signOutPath={famaSignOutPath("/")} />;
  return <FamaSystemApp organizations={organizations} currentUser={{ id: user.id, displayName: user.displayName, email: user.email, isPlatformAdmin: isPlatformAdmin(user) }} signOutPath={famaSignOutPath("/")} />;
}
