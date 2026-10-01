import { FamaSystemApp } from "./cloriva-app";
import { CompanyOnboarding } from "./company-onboarding";
import { appSignOutPath, getFamaUser } from "./system-auth";
import { LegalConsentGate } from "./legal-consent-gate";
import { hasCurrentLegalConsent } from "@/lib/security";
import { getUserOrganizations, isPlatformAdmin } from "@/lib/tenant";
import PlansPage from "./planos/page";

export const dynamic = "force-dynamic";

export default async function Home() {
  const user = await getFamaUser();
  if (!user) {
    return <PlansPage />;
  }

  const signOutPath = appSignOutPath("/");
  if (!await hasCurrentLegalConsent(user)) {
    return <LegalConsentGate displayName={user.displayName} signOutPath={signOutPath} />;
  }

  const organizations = await getUserOrganizations(user);
  if (!organizations.length) {
    return <CompanyOnboarding displayName={user.displayName} email={user.email} signOutPath={signOutPath} />;
  }

  return <FamaSystemApp
    organizations={organizations}
    currentUser={{
      id: user.id,
      displayName: user.displayName,
      email: user.email,
      isPlatformAdmin: isPlatformAdmin(user),
    }}
    signOutPath={signOutPath}
  />;
}
