"use client";
import { useEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
export function SupportIndicator({ organizationId, scope, open, onOpen }) {
    const [unread, setUnread] = useState(0);
    const openRef = useRef(open);
    openRef.current = open;
    useEffect(() => {
        let stopped = false, busy = false, initial = true;
        const controller = new AbortController();
        const seenKey = scope + ":support-seen";
        let lastCount = 0;
        async function refresh() {
            if (stopped || busy || document.visibilityState !== "visible")
                return;
            busy = true;
            try {
                const response = await fetch("/api/support", { headers: { "x-organization-id": organizationId }, cache: "no-store", signal: controller.signal });
                if (!response.ok)
                    return;
                const data = await response.json();
                if (stopped)
                    return;
                let seen = {};
                try {
                    seen = JSON.parse(sessionStorage.getItem(seenKey) ?? "{}");
                }
                catch { }
                const tickets = data.tickets ?? [];
                let count = 0;
                for (const ticket of tickets) {
                    const message = ticket.messages?.filter(message => message.authorKind === "admin").at(-1);
                    if (!message)
                        continue;
                    if (openRef.current)
                        seen[ticket.id] = message.createdAt;
                    else if (!seen[ticket.id] || message.createdAt > seen[ticket.id])
                        count++;
                }
                if (openRef.current)
                    try {
                        sessionStorage.setItem(seenKey, JSON.stringify(seen));
                    }
                    catch { }
                if (!initial && count > lastCount)
                    toast.info("Nova resposta do suporte.");
                initial = false;
                lastCount = count;
                setUnread(count);
            }
            catch { /* Keep the last verified unread count during a temporary failure. */ }
            finally {
                busy = false;
            }
        }
        void refresh();
        const timer = setInterval(() => void refresh(), 30000);
        window.addEventListener("fama:support-updated", refresh);
        return () => { stopped = true; controller.abort(); clearInterval(timer); window.removeEventListener("fama:support-updated", refresh); };
    }, [organizationId, scope]);
    useEffect(() => { if (open)
        window.dispatchEvent(new Event("fama:support-updated")); }, [open]);
    return <Button variant="outline" size="icon" className="workspace-alert-trigger" onClick={onOpen} aria-label={"Abrir suporte" + (unread ? ", " + unread + " chamado(s) com novas respostas" : "")} title="Suporte Fama"><MessageCircle />{unread > 0 && <b>{unread > 99 ? "99+" : unread}</b>}</Button>;
}
