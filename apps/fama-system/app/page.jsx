import { FamaSystemApp } from "./cloriva-app";
import { CompanyOnboarding } from "./company-onboarding";
import { appSignOutPath, getFamaUser } from "./system-auth";
import { LegalConsentGate } from "./legal-consent-gate";
import { hasCurrentLegalConsent } from "@/lib/security";
import { getUserOrganizations, isPlatformAdmin } from "@/lib/tenant";
import PlansPage from "./planos/page";
import { getPlanCatalog } from "@/lib/plans";
import { onboardingIntent } from "@/lib/onboarding-intent";
export const dynamic = "force-dynamic";
export default async function Home({ searchParams } = {}) {
    const user = await getFamaUser();
    if (!user) {
        return <PlansPage />;
    }
    const signOutPath = appSignOutPath("/");
    const currentUser = { id: user.id, displayName: user.displayName, email: user.email, isPlatformAdmin: isPlatformAdmin(user) };
    if (!await hasCurrentLegalConsent(user)) {
        return <LegalConsentGate currentUser={currentUser} displayName={user.displayName} signOutPath={signOutPath}/>;
    }
    const organizations = await getUserOrganizations(user);
    if (!organizations.length) {
        const intent = onboardingIntent(await searchParams ?? {});
        return <CompanyOnboarding currentUser={currentUser} displayName={user.displayName} email={user.email} signOutPath={signOutPath} plans={await getPlanCatalog()} initialPlan={intent.plan} initialCheckoutId={intent.checkout}/>;
    }
    return <FamaSystemApp organizations={organizations} currentUser={currentUser} signOutPath={signOutPath}/>;
}
