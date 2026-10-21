import { getSupabaseFactors, prepareAccountSignIn, setSupabaseSession, supabaseAuthRequest } from "@/app/system-auth";
export async function POST(request) {
    try {
        const body = await request.json();
        const session = {
            access_token: String(body.accessToken ?? ""),
            refresh_token: String(body.refreshToken ?? ""),
            expires_in: Number(body.expiresIn ?? 3600),
        };
        if (!session.access_token || !session.refresh_token)
            return Response.json({ error: "Sessão inválida." }, { status: 400 });
        const user = await supabaseAuthRequest("/auth/v1/user", { method: "GET" }, session.access_token);
        session.user = user;
        await prepareAccountSignIn(user.email);
        const factors = await getSupabaseFactors(session.access_token);
        const verified = factors.find((factor) => factor.status === "verified" && factor.factor_type === "totp");
        await setSupabaseSession(session, Boolean(verified));
        return Response.json({ authenticated: !verified, requiresMfa: Boolean(verified), factorId: verified?.id ?? null });
    }
    catch (error) {
        console.error("auth_session_failed", error);
        return Response.json({ error: "O link de acesso é inválido ou expirou." }, { status: 401 });
    }
}

export async function GET() {
    try {
        const { getFamaUser, appSignOutPath } = await import('@/app/system-auth');
        const { isPlatformAdmin, getUserOrganizations } = await import('@/lib/tenant');
        const { hasCurrentLegalConsent } = await import('@/lib/security');
        const { getPlanCatalog } = await import('@/lib/plans');
        const user = await getFamaUser();
        if (!user) return Response.json({authenticated:false},{status:401,headers:{'Cache-Control':'private,no-store'}});
        const currentUser={id:user.id,displayName:user.displayName,email:user.email,isPlatformAdmin:isPlatformAdmin(user)};
        const consent=await hasCurrentLegalConsent(user);
        const organizations=consent ? await getUserOrganizations(user) : [];
        return Response.json({authenticated:true,currentUser,consent,organizations,signOutPath:appSignOutPath('/'),plans:consent && !organizations.length ? await getPlanCatalog() : undefined}, {headers:{'Cache-Control':'private,no-store','Vary':'Cookie'}});
    } catch { return Response.json({error:'Não foi possível verificar o acesso agora.'},{status:503,headers:{'Cache-Control':'no-store'}}); }
}
