"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
export function PlanAnnouncement({ scope, organizationId }) {
    const [notice, setNotice] = useState(null);
    useEffect(() => { let active = true; async function read() { try {
        const response = await fetch("/api/billing/notice", { headers: { "x-organization-id": organizationId }, cache: "no-store", signal: AbortSignal.timeout(5000) });
        if (!response.ok)
            return;
        const payload = await response.json();
        if (!active)
            return;
        if (!payload.notice?.text) {
            setNotice(null);
            return;
        }
        const age = Date.now() - Date.parse(payload.notice.effectiveAt);
        if (!Number.isFinite(age) || age > 7 * 86400000)
            return;
        const key = scope + ":plan-notice:" + payload.revision;
        try {
            if (sessionStorage.getItem(key))
                return;
        }
        catch { }
        setNotice({ ...payload.notice, revision: payload.revision });
    }
    catch { /* The operational workspace stays usable if the notice is unavailable. */ } } void read(); const timer = setInterval(() => { if (document.visibilityState === "visible")
        void read(); }, 300000); return () => { active = false; clearInterval(timer); }; }, [scope, organizationId]);
    if (!notice)
        return null;
    return <aside className="plan-announcement" role="status"><div><strong>Atualização dos planos · {new Date(notice.effectiveAt).toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" })}</strong><p>{notice.text}</p></div><Button type="button" variant="outline" size="sm" onClick={() => { try {
        sessionStorage.setItem(scope + ":plan-notice:" + notice.revision, "seen");
    }
    catch { } setNotice(null); }}>Entendi</Button></aside>;
}
