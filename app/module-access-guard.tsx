"use client";

import { useEffect } from "react";

const OPERATIONAL_MODULES = [
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

const modulesByLabel: Record<string, string> = {
  "visão geral": "dashboard",
  "visao geral": "dashboard",
  crm: "crm",
  "orçamentos": "quotes",
  orcamentos: "quotes",
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
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .toLocaleLowerCase("pt-BR");
}

function menuButtons() {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>(
      'button[data-sidebar="menu-button"]',
    ),
  ).filter((button) => button.closest('[data-sidebar="sidebar"]'));
}

function moduleFromButton(button: HTMLButtonElement) {
  const cached = button.dataset.famaModule;
  if (cached) return cached;

  const candidates = [
    button.getAttribute("aria-label") ?? "",
    button.getAttribute("title") ?? "",
    ...Array.from(button.querySelectorAll("span")).map(
      (span) => span.textContent ?? "",
    ),
    button.textContent ?? "",
  ].map(normalize);

  for (const candidate of candidates) {
    if (modulesByLabel[candidate]) return modulesByLabel[candidate];
  }

  return "";
}

function getModuleItems() {
  const buttons = menuButtons();
  let operationalIndex = 0;

  return buttons.flatMap((button) => {
    let module = moduleFromButton(button);

    // Fallback estrutural: os 11 primeiros botões da navegação do Fama System
    // são sempre os módulos operacionais, na ordem definida em cloriva-app.tsx.
    // Isto evita depender do texto, tooltip, sidebar recolhida ou versão mobile.
    if (!module && operationalIndex < OPERATIONAL_MODULES.length) {
      module = OPERATIONAL_MODULES[operationalIndex];
    }

    if (OPERATIONAL_MODULES.includes(module as (typeof OPERATIONAL_MODULES)[number])) {
      const expected = OPERATIONAL_MODULES[operationalIndex];
      if (!module || module !== expected) {
        // Se o texto não estiver disponível, a posição continua sendo a fonte estável.
        module = expected;
      }
      operationalIndex += 1;
    } else if (!module && operationalIndex < OPERATIONAL_MODULES.length) {
      operationalIndex += 1;
    }

    if (!module) return [];
    button.dataset.famaModule = module;
    return [{ button, module }];
  });
}

function setVisible(button: HTMLButtonElement, visible: boolean) {
  const container =
    button.closest<HTMLElement>('[data-sidebar="menu-item"]') ??
    button.closest<HTMLElement>("li") ??
    button;

  container.hidden = !visible;
  button.disabled = !visible;
  button.setAttribute("aria-disabled", visible ? "false" : "true");

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

function hideEmptyGroups() {
  const groups = Array.from(
    document.querySelectorAll<HTMLElement>('[data-sidebar="group"]'),
  );

  for (const group of groups) {
    const items = Array.from(
      group.querySelectorAll<HTMLElement>('[data-sidebar="menu-item"]'),
    );
    if (!items.length) continue;
    const anyVisible = items.some((item) => item.style.display !== "none" && !item.hidden);
    group.style.setProperty("display", anyVisible ? "" : "none", anyVisible ? "" : "important");
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
      hideEmptyGroups();

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

    const blockDeniedClick = (event: MouseEvent) => {
      const target = event.target instanceof Element ? event.target : null;
      const button = target?.closest<HTMLButtonElement>('button[data-sidebar="menu-button"]');
      if (!button) return;
      const module = button.dataset.famaModule || moduleFromButton(button);
      if (module && !permissions.has(module)) {
        event.preventDefault();
        event.stopPropagation();
        event.stopImmediatePropagation();
      }
    };

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
    document.addEventListener("click", blockDeniedClick, true);
    refreshTimer = window.setInterval(refresh, 2500);

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
      document.removeEventListener("click", blockDeniedClick, true);
      unbind?.();
    };
  }, []);

  return null;
}
