"use client";

import { useEffect } from "react";

const modulesByLabel: Record<string, string> = {
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
  "usuários e empresas": "members",
  "usuarios e empresas": "members",
  "usuários e permissões": "members",
  "usuarios e permissoes": "members",
};

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
}

function getModuleItems() {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      '.main-sidebar button[data-sidebar="menu-button"]',
    ),
  );

  return buttons.flatMap((button) => {
    const candidates = [
      ...Array.from(button.querySelectorAll("span")).map((span) =>
        normalize(String(span.textContent ?? "")),
      ),
      normalize(String(button.textContent ?? "")),
    ];

    const label = candidates.find((candidate) => Boolean(modulesByLabel[candidate]));
    if (!label) return [];

    return [{ button, module: modulesByLabel[label] }];
  });
}

function setVisible(button: HTMLButtonElement, visible: boolean) {
  const container =
    button.closest<HTMLElement>('[data-sidebar="menu-item"]') ??
    button.closest<HTMLElement>("li") ??
    button;

  container.hidden = !visible;
  if (visible) {
    container.removeAttribute("aria-hidden");
    container.style.removeProperty("display");
    container.style.removeProperty("visibility");
    container.style.removeProperty("pointer-events");
  } else {
    container.setAttribute("aria-hidden", "true");
    container.style.setProperty("display", "none", "important");
    container.style.setProperty("visibility", "hidden", "important");
    container.style.setProperty("pointer-events", "none", "important");
  }
}

export function ModuleAccessGuard() {
  useEffect(() => {
    let permissions = new Set<string>();
    let activeOrganizationId = "";
    let disposed = false;
    let loading = false;
    let refreshTimer: number | null = null;
    let observer: MutationObserver | null = null;

    function applyPermissions() {
      const items = getModuleItems();
      if (!items.length) return;

      for (const item of items) {
        setVisible(item.button, permissions.has(item.module));
      }

      const activeDenied = items.find(
        (item) =>
          item.button.getAttribute("data-active") === "true" &&
          !permissions.has(item.module),
      );

      if (activeDenied) {
        const firstAllowed = items.find((item) => permissions.has(item.module));
        if (firstAllowed && firstAllowed.button !== activeDenied.button) {
          window.setTimeout(() => firstAllowed.button.click(), 0);
        }
      }
    }

    async function loadPermissions(organizationId: string) {
      if (!organizationId || organizationId === "__new__" || disposed || loading) return;
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
        if (!response.ok) {
          throw new Error(payload?.error ?? "Não foi possível carregar as permissões.");
        }
        if (disposed || activeOrganizationId !== organizationId) return;

        permissions = new Set(
          Array.isArray(payload.permissions) ? payload.permissions.map(String) : [],
        );
        applyPermissions();
      } catch (error) {
        console.error("module_access_guard_failed", error);
      } finally {
        loading = false;
      }
    }

    function currentOrganizationId() {
      return document.querySelector<HTMLSelectElement>(".company-switcher")?.value ?? "";
    }

    function refresh() {
      const organizationId = currentOrganizationId();
      if (organizationId) void loadPermissions(organizationId);
    }

    function bindSwitcher() {
      const select = document.querySelector<HTMLSelectElement>(".company-switcher");
      if (!select) return null;

      const onChange = () => {
        permissions = new Set();
        activeOrganizationId = select.value;
        window.setTimeout(() => void loadPermissions(select.value), 0);
      };

      select.addEventListener("change", onChange);
      void loadPermissions(select.value);
      return () => select.removeEventListener("change", onChange);
    }

    let unbind: (() => void) | null = null;
    const tryBind = () => {
      if (unbind) return;
      unbind = bindSwitcher();
    };

    tryBind();

    const onFocus = () => refresh();
    const onVisibility = () => {
      if (document.visibilityState === "visible") refresh();
    };

    window.addEventListener("focus", onFocus);
    document.addEventListener("visibilitychange", onVisibility);
    refreshTimer = window.setInterval(refresh, 4000);

    observer = new MutationObserver(() => {
      tryBind();
      if (permissions.size || activeOrganizationId) applyPermissions();
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      disposed = true;
      observer?.disconnect();
      if (refreshTimer !== null) window.clearInterval(refreshTimer);
      window.removeEventListener("focus", onFocus);
      document.removeEventListener("visibilitychange", onVisibility);
      unbind?.();
    };
  }, []);

  return null;
}
