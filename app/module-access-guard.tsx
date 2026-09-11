"use client";

import { useEffect } from "react";

const labels: Record<string, string> = {
  "visão geral": "dashboard",
  crm: "crm",
  "orçamentos": "quotes",
  agenda: "agenda",
  "ordens de serviço": "orders",
  garantias: "warranties",
  "clientes e piscinas": "customers",
  contratos: "contracts",
  estoque: "inventory",
  financeiro: "finance",
  equipe: "team",
};

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
}

function moduleButtons() {
  return Array.from(document.querySelectorAll<HTMLButtonElement>(".main-sidebar button"))
    .map((button) => {
      const span = button.querySelector("span");
      const label = normalize(String(span?.textContent ?? button.textContent ?? ""));
      return { button, label };
    })
    .filter((item) => Boolean(labels[item.label]));
}

function hideButton(button: HTMLButtonElement, hidden: boolean) {
  const container = button.closest("li") ?? button;
  if (container instanceof HTMLElement) {
    container.hidden = hidden;
    container.setAttribute("aria-hidden", hidden ? "true" : "false");
  }
}

export function ModuleAccessGuard() {
  useEffect(() => {
    let permissions = new Set<string>();
    let activeOrganizationId = "";
    let observer: MutationObserver | null = null;
    let refreshTimer: number | null = null;
    let disposed = false;
    let loading = false;

    function applyPermissions() {
      const items = moduleButtons();
      if (!items.length) return;

      for (const item of items) {
        hideButton(item.button, !permissions.has(labels[item.label]));
      }

      const active = items.find((item) =>
        item.button.getAttribute("data-active") === "true" ||
        item.button.getAttribute("aria-current") === "page",
      );

      if (active && !permissions.has(labels[active.label])) {
        const firstAllowed = items.find((item) => permissions.has(labels[item.label]));
        firstAllowed?.button.click();
        return;
      }

      if (!active && !permissions.has("dashboard")) {
        const firstAllowed = items.find((item) => permissions.has(labels[item.label]));
        firstAllowed?.button.click();
      }
    }

    async function loadPermissions(organizationId: string) {
      if (!organizationId || disposed || loading) return;
      loading = true;
      activeOrganizationId = organizationId;

      try {
        const response = await fetch("/api/access", {
          headers: { "x-organization-id": organizationId },
          cache: "no-store",
        });

        if (response.status === 401) {
          window.location.assign("/api/auth/logout");
          return;
        }

        const payload = await response.json().catch(() => ({}));
        if (!response.ok) throw new Error(payload?.error ?? "Não foi possível carregar as permissões.");
        if (activeOrganizationId !== organizationId || disposed) return;

        permissions = new Set(
          Array.isArray(payload.permissions) ? payload.permissions.map(String) : [],
        );
        applyPermissions();
      } catch (error) {
        console.error("module_access_guard_failed", error);
        permissions = new Set();
        applyPermissions();
      } finally {
        loading = false;
      }
    }

    function currentOrganizationId() {
      return document.querySelector<HTMLSelectElement>(".company-switcher")?.value ?? "";
    }

    function refreshCurrentPermissions() {
      const value = currentOrganizationId();
      if (!value || value === "__new__") return;
      void loadPermissions(value);
    }

    function bindSwitcher() {
      const select = document.querySelector<HTMLSelectElement>(".company-switcher");
      if (!select) return false;

      const onChange = () => {
        const value = select.value;
        if (!value || value === "__new__") return;
        window.setTimeout(() => void loadPermissions(value), 0);
      };

      select.addEventListener("change", onChange);
      void loadPermissions(select.value);
      return () => select.removeEventListener("change", onChange);
    }

    const onFocus = () => refreshCurrentPermissions();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refreshCurrentPermissions();
    };

    let unbind: (() => void) | false = false;
    const tryBind = () => {
      if (unbind) return;
      const result = bindSwitcher();
      if (result) unbind = result;
    };

    tryBind();
    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);

    refreshTimer = window.setInterval(refreshCurrentPermissions, 10000);

    observer = new MutationObserver(() => {
      tryBind();
      if (activeOrganizationId) applyPermissions();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      disposed = true;
      observer?.disconnect();
      if (refreshTimer !== null) window.clearInterval(refreshTimer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      if (unbind) unbind();
    };
  }, []);

  return null;
}
