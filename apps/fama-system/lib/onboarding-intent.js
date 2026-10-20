import { isPlanCode } from "@/lib/plans";
export function onboardingIntent(values) {
    const plan = isPlanCode(values.plan) ? values.plan : "inicial";
    const checkout = typeof values.checkout === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(values.checkout) ? values.checkout : "";
    return { plan, checkout };
}
export function onboardingPath(values) {
    const intent = onboardingIntent(values);
    const query = new URLSearchParams();
    if (isPlanCode(values.plan))
        query.set("plan", intent.plan);
    if (intent.checkout)
        query.set("checkout", intent.checkout);
    return query.size ? `/?${query}` : "/";
}
