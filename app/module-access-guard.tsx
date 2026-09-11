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

const orderedModules = [
  "dashboard",
  "crm",
  "quotes",
  "agenda",
  "orders",
  "warranties",
  "customers",
  "contracts",
  "inventory",
  "finance",
  "team",
] as const;

function normalize(value: string) {
  return value.replace(/\s+/g, " ").trim().toLocaleLowerCase("pt-BR");
}

function moduleItems() {
  const buttons = Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      '.main-sidebar button[data-sidebar="menu-button"]',
    ),
  );

  return buttons
    .map((button, index) => {
      const spanTexts = Array.from(button.querySelectorAll("span"))
        .map((span) => normalize(String(span.textContent ?? "")))
        .filter(Boolean);
      const fullText = normalize(String(button.textContent ?? ""));
      const byLabel = spanTexts
        .map((value) => labels[value])
        .find(Boolean) ?? labels[fullText];
      const module = byLabel ?? orderedModules[index] ?? null;
      return { button, module };
    })
    .filter(
      (item): item is { button: HTMLButtonElement; module: string } =>
        Boolean(item.module) && orderedModules.includes(item.module as (typeof orderedModules)[number]),
    );
}

function setItemVisible(button: HTMLButtonElement, visible: boolean) {
  const container = button.closest<HTMLElement>('[data-sidebar="menu-item"]') ??
    button.closest<HTMLElement>("li") ??
    button;

  if (visible) {
    container.hidden = false;
    container.removeAttribute("aria-hidden");
    container.style.removeProperty("display");
    container.style.removeProperty("visibility");
    container.style.removeProperty("pointer-events");
  } else {
    container.hidden = true;
    container.setAttribute("aria-hidden", "true");
    container.style.setProperty("display", "none", "important");
    container.style.setProperty("visibility", "hidden", "important");
    container.style.setProperty("pointer-events", "none", "important");
  }
}

function updateGroupVisibility() {
  for (const group of Array.from(
    document.querySelectorAll<HTMLElement>('.main-sidebar [data-sidebar="group"]'),
  )) {
    const operationalItems = Array.from(
      group.querySelectorAll<HTMLElement>('[data-sidebar="menu-item"]'),
    ).filter((item) => {
      const button = item.querySelector<HTMLButtonElement>('[data-sidebar="menu-button"]');
      if (!button) return false;
      const text = normalize(String(button.textContent ?? ""));
      return Boolean(labels[text]) || orderedModules.some((module) => text.includes(module));
    });

    if (!operationalItems.length) continue;
    const hasVisible = operationalItems.some(
      (item) => !item.hidden && item.style.display !== "none",
    );
    group.style.setProperty("display", hasVisible ? "" : "none", hasVisible ? "" : "important");
    if (hasVisible) group.style.removeProperty("display");
  }
}

function signatureOf(values: Set<string>) {
  return [...values].sort().join("|");
}

export function ModuleAccessGuard() {
  useEffect(() => {
    let permissions = new Set<string>();
    let activeOrganizationId = "";
    let observer: MutationObserver | null = null;
    let refreshTimer: number | null = null;
    let disposed = false;
    let loading = false;
    let firstLoaded = false;
    let lastSignature = "";

    function applyPermissions() {
      const items = moduleItems();
      if (!items.length) return;

      for (const item of items) {
        setItemVisible(item.button, permissions.has(item.module));
      }

      updateGroupVisibility();

      const active = items.find((item) => item.button.getAttribute("data-active") === "true");
      if (active && !permissions.has(active.module)) {
        const firstAllowed = items.find((item) => permissions.has(item.module));
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
        if (!response.ok) {
          throw new Error(payload?.error ?? "Não foi possível carregar as permissões.");
        }
        if (activeOrganizationId !== organizationId || disposed) return;

        const next = new Set<string>(
          Array.isArray(payload.permissions) ? payload.permissions.map(String) : [],
        );
        const nextSignature = signatureOf(next);

        if (firstLoaded && nextSignature !== lastSignature) {
          window.location.reload();
          return;
        }

        permissions = next;
        lastSignature = nextSignature;
        firstLoaded = true;
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
        firstLoaded = false;
        lastSignature = "";
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
    refreshTimer = window.setInterval(refreshCurrentPermissions, 4000);

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
