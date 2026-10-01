"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowDownLeft,
  ArrowUpRight,
  Banknote,
  BellRing,
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  FileText,
  FileUp,
  KeyRound,
  Link2,
  Plus,
  QrCode,
  RefreshCw,
  Send,
  ShieldCheck,
  Sparkles,
  Truck,
} from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  NativeSelect,
  NativeSelectOption,
} from "@/components/ui/native-select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type {
  BankAccount,
  BankMovement,
  Purchase,
  Quote,
  Supplier,
  Transaction,
} from "@/app/data-model";
import { defaultCompanySettings } from "@/lib/company-settings";
import { fiscalPortalSettings, type FiscalInvoice, type FiscalPortalSettings } from "@/lib/fiscal-portal";
import { FiscalPortalPanel } from "./fiscal-portal-panel";

export type FinanceTab = "visao" | "contas" | "cobrancas" | "notas" | "asaas" | "bancos" | "compras";
type Payload = {
  suppliers: Supplier[];
  purchases: Purchase[];
  bankAccounts: BankAccount[];
  bankMovements: BankMovement[];
  fiscalInvoices: FiscalInvoice[];
  fiscalSettings?: FiscalPortalSettings;
};
const empty: Payload = {
  suppliers: [],
  purchases: [],
  bankAccounts: [],
  bankMovements: [],
  fiscalInvoices: [],
};
type AsaasConnection = {
  id: string;
  institution: string;
  status: string;
  lastSyncedAt: string;
  environment: "sandbox" | "production";
};
type AsaasState = {
  encryptionConfigured: boolean;
  connections: AsaasConnection[];
};
type AsaasPayment = {
  id: string;
  customer: string;
  description: string;
  status: string;
  billingType: string;
  valueCents: number;
  dueDate: string;
  invoiceUrl: string;
};
type AsaasCustomer = {
  id: string;
  name: string;
  email: string;
  mobilePhone: string;
  cpfCnpj: string;
};
type AsaasTransfer = {
  id: string;
  status: string;
  valueCents: number;
  dateCreated: string;
  description: string;
};
type AsaasControl = {
  loading: boolean;
  balanceCents: number;
  status: string;
  customers: AsaasCustomer[];
  payments: AsaasPayment[];
  transfers: AsaasTransfer[];
  lastPixCopyPaste: string;
  lastPixQrCode: string;
  lastPaymentUrl: string;
};
type FinanceConnection = {
  id: string;
  provider: "asaas" | "mercado_pago" | "pagbank";
  providerLabel: string;
  institution: string;
  status: string;
  lastSyncedAt: string;
  primary: boolean;
};
type ConnectionsState = {
  encryptionConfigured: boolean;
  connections: FinanceConnection[];
};
const money = (cents: number) =>
  new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" }).format(
    cents / 100,
  );
const date = (value: string) =>
  value
    ? new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" }).format(
        new Date(`${value.slice(0, 10)}T12:00:00Z`),
      )
    : "—";

export function FinanceWorkspace({
  organizationId,
  transactions,
  tab,
  onTabChange,
  onStatus,
  onOpenEntry,
  onReconciled,
  onPurchasePayable,
  quotes = [],
}: {
  organizationId: string;
  transactions: Transaction[];
  tab: FinanceTab;
  onTabChange: (tab: FinanceTab) => void;
  onStatus: (item: Transaction, status: Transaction["status"]) => void;
  onOpenEntry: (type: "receita" | "despesa") => void;
  onReconciled: (transactionId: string, created?: Transaction) => void;
  onPurchasePayable: (record: Transaction) => void;
  quotes?: Quote[];
}) {
  const [data, setData] = useState<Payload>(empty);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState("");
  const [supplierOpen, setSupplierOpen] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [purchaseOpen, setPurchaseOpen] = useState(false);
  const [fiscalOpen, setFiscalOpen] = useState(false);
  const [fiscalSelected, setFiscalSelected] = useState<FiscalInvoice | null>(null);
  const [asaasOpen, setAsaasOpen] = useState(false);
  const [csvAccount, setCsvAccount] = useState("");
  const [autoSyncing, setAutoSyncing] = useState(false);
  const [lastAutoSyncAt, setLastAutoSyncAt] = useState("");
  const [gatewayOpen, setGatewayOpen] = useState(false);
  const [aiQuestion, setAiQuestion] = useState("");
  const [aiAnswer, setAiAnswer] = useState("");
  const [aiBusy, setAiBusy] = useState(false);
  const [aiConfigured, setAiConfigured] = useState(false);
  const autoSyncStartedRef = useRef("");
  const [asaas, setAsaas] = useState<AsaasState>({
    encryptionConfigured: false,
    connections: [],
  });
  const [asaasControl, setAsaasControl] = useState<AsaasControl>({
    loading: false,
    balanceCents: 0,
    status: "",
    customers: [],
    payments: [],
    transfers: [],
    lastPixCopyPaste: "",
    lastPixQrCode: "",
    lastPaymentUrl: "",
  });
  const [financeConnections, setFinanceConnections] = useState<ConnectionsState>({
    encryptionConfigured: false,
    connections: [],
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    try {
      const response = await fetch("/api/finance", {
        cache: "no-store",
        headers: { "x-organization-id": organizationId },
      });
      const payload = (await response.json()) as Partial<Payload> & {
        error?: string;
      };
      if (!response.ok)
        throw new Error(
          payload.error || "Não foi possível carregar o financeiro.",
        );
      setData({
        suppliers: payload.suppliers ?? [],
        purchases: payload.purchases ?? [],
        bankAccounts: payload.bankAccounts ?? [],
        bankMovements: payload.bankMovements ?? [],
        fiscalInvoices: payload.fiscalInvoices ?? [],
        fiscalSettings: payload.fiscalSettings,
      });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Falha ao carregar os dados financeiros.",
      );
    } finally {
      setLoading(false);
    }
  }, [organizationId]);
  const refreshAsaasControl = useCallback(async (options?: { silent?: boolean }) => {
    if (!asaas.connections.length) return;
    setAsaasControl((current) => ({ ...current, loading: true }));
    try {
      const response = await fetch("/api/asaas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId,
        },
        body: JSON.stringify({ action: "dashboard", connectionId: asaas.connections[0]?.id }),
      });
      const payload = (await response.json()) as Partial<AsaasControl> & { error?: string };
      if (!response.ok) throw new Error(payload.error || "Não foi possível carregar o painel Asaas.");
      setAsaasControl((current) => ({
        ...current,
        loading: false,
        balanceCents: payload.balanceCents ?? 0,
        status: payload.status ?? "",
        customers: payload.customers ?? [],
        payments: payload.payments ?? [],
        transfers: payload.transfers ?? [],
      }));
    } catch (error) {
      setAsaasControl((current) => ({ ...current, loading: false }));
      if (!options?.silent) toast.error(error instanceof Error ? error.message : "Falha ao carregar a Asaas.");
    }
  }, [asaas.connections, organizationId]);
  const refreshAsaas = useCallback(async () => {
    try {
      const response = await fetch("/api/asaas", {
        cache: "no-store",
        headers: { "x-organization-id": organizationId },
      });
      const payload = (await response.json()) as Partial<AsaasState>;
      if (response.ok)
        setAsaas({
          encryptionConfigured: Boolean(payload.encryptionConfigured),
          connections: payload.connections ?? [],
        });
    } catch {
      /* A integração continua indisponível sem expor detalhes sensíveis. */
    }
  }, [organizationId]);
  const refreshFinanceConnections = useCallback(async () => {
    try {
      const response = await fetch("/api/finance-connections", {
        cache: "no-store",
        headers: { "x-organization-id": organizationId },
      });
      const payload = (await response.json()) as Partial<ConnectionsState>;
      if (response.ok)
        setFinanceConnections({
          encryptionConfigured: Boolean(payload.encryptionConfigured),
          connections: payload.connections ?? [],
        });
    } catch {
      /* O financeiro continua funcionando mesmo sem carregar integrações extras. */
    }
  }, [organizationId]);
  const refreshAiStatus = useCallback(async () => {
    try {
      const response = await fetch("/api/fama-ai", { cache: "no-store" });
      const payload = (await response.json()) as { configured?: boolean };
      if (response.ok) setAiConfigured(Boolean(payload.configured));
    } catch {
      setAiConfigured(false);
    }
  }, []);
  useEffect(() => {
    // Initial tenant load intentionally hydrates remote state.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    void refresh();
    void refreshAsaas();
    void refreshFinanceConnections();
    void refreshAiStatus();
  }, [refresh, refreshAsaas, refreshFinanceConnections, refreshAiStatus]);
  useEffect(() => {
    if (tab !== "bancos" || !asaas.connections.length) return;
    const timer = window.setTimeout(() => void refreshAsaasControl({ silent: true }), 0);
    return () => window.clearTimeout(timer);
  }, [asaas.connections.length, refreshAsaasControl, tab]);

  const receivable = transactions.filter(
    (item) => item.type === "receita" && item.status !== "pago",
  );
  const payable = transactions.filter(
    (item) => item.type === "despesa" && item.status !== "pago",
  );
  const overdue = transactions.filter((item) => item.status === "atrasado");
  const totalIn = receivable.reduce((sum, item) => sum + item.amountCents, 0);
  const totalOut = payable.reduce((sum, item) => sum + item.amountCents, 0);
  const balanceForAccount = (account: BankAccount) => {
    const movements = data.bankMovements.filter(
      (item) => item.accountId === account.id,
    );
    return account.provider === "asaas"
      ? (account.currentBalanceCents ?? 0)
      : account.openingBalanceCents +
          movements.reduce((sum, item) => sum + item.amountCents, 0);
  };
  const bankBalance = data.bankAccounts.reduce(
    (sum, account) => sum + balanceForAccount(account),
    0,
  );
  const primaryFinanceConnection = financeConnections.connections.find((connection) => connection.primary);
  const connectedProviderLabels = [
    ...asaas.connections.map((connection) => `${connection.institution}${connection.environment === "production" ? "" : " Sandbox"}`),
    ...financeConnections.connections.map((connection) => connection.providerLabel),
  ];
  const pendingBankMovements = data.bankMovements.filter(
    (item) => item.status === "pendente",
  ).length;
  const projectedBalance = bankBalance + totalIn - totalOut;
  const nextDue = [...receivable, ...payable].sort((a, b) =>
    a.dueDate.localeCompare(b.dueDate),
  )[0];
  const overdueValue = overdue.reduce((sum, item) => sum + item.amountCents, 0);
  const aiSuggestions = [
    "O que devo cobrar primeiro hoje?",
    "Faça um diagnóstico do meu caixa desta semana.",
    "Quais riscos financeiros preciso resolver agora?",
    "Como organizar a conciliação bancária pendente?",
  ];
  const aiContext = () => ({
    bankBalance: money(bankBalance),
    receivable: money(totalIn),
    payable: money(totalOut),
    overdue: overdue.length,
    overdueValue: money(overdueValue),
    pendingBankMovements,
    projectedBalance: money(projectedBalance),
    primaryProvider: primaryFinanceConnection?.providerLabel ?? "não definido",
    connectedProviders: connectedProviderLabels,
    nextDue: nextDue ? {
      description: nextDue.description,
      type: nextDue.type,
      value: money(nextDue.amountCents),
      dueDate: date(nextDue.dueDate),
      status: nextDue.status,
    } : null,
    providers: financeConnections.connections.map((connection) => ({
      provider: connection.providerLabel,
      primary: connection.primary,
      status: connection.status,
    })),
    bankAccounts: data.bankAccounts.map((account) => ({
      name: account.name,
      institution: account.institution,
      balance: money(balanceForAccount(account)),
      provider: account.provider || "manual",
    })),
    openReceivables: receivable.slice(0, 8).map((item) => ({
      description: item.description,
      value: money(item.amountCents),
      dueDate: date(item.dueDate),
      status: item.status,
    })),
    openPayables: payable.slice(0, 8).map((item) => ({
      description: item.description,
      value: money(item.amountCents),
      dueDate: date(item.dueDate),
      status: item.status,
    })),
  });
  const lastSyncLabel = lastAutoSyncAt
    ? new Intl.DateTimeFormat("pt-BR", {
        dateStyle: "short",
        timeStyle: "short",
      }).format(new Date(lastAutoSyncAt))
    : "";
  const filtered = (items: Transaction[]) =>
    items.filter((item) =>
      `${item.description} ${item.category}`
        .toLocaleLowerCase("pt-BR")
        .includes(query.toLocaleLowerCase("pt-BR")),
    );

  async function submit(action: string, event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    try {
      const values = Object.fromEntries(new FormData(form).entries());
      const response = await fetch("/api/finance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId,
        },
        body: JSON.stringify({ action, ...values }),
      });
      const payload = (await response.json()) as {
        error?: string;
        payable?: Transaction;
        imported?: number;
        fiscalInvoice?: FiscalInvoice;
      };
      if (!response.ok)
        throw new Error(payload.error || "Não foi possível salvar.");
      if (payload.payable) {
        onPurchasePayable(payload.payable);
        toast.success("Compra registrada e conta a pagar criada.");
      } else if (payload.imported !== undefined)
        toast.success(
          `${payload.imported} movimentações importadas para conciliação.`,
        );
      else toast.success("Registro salvo.");
      if (payload.fiscalInvoice) setFiscalSelected(payload.fiscalInvoice);
      form.reset();
      setSupplierOpen(false);
      setAccountOpen(false);
      setPurchaseOpen(false);
      setFiscalOpen(false);
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Não foi possível salvar.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function importCsv(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const file = new FormData(form).get("statement") as File | null;
    if (!file || !csvAccount)
      return toast.error("Selecione a conta bancária e um arquivo CSV.");
    setBusy(true);
    try {
      const response = await fetch("/api/finance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId,
        },
        body: JSON.stringify({
          action: "importStatement",
          accountId: csvAccount,
          csv: await file.text(),
        }),
      });
      const payload = (await response.json()) as {
        error?: string;
        imported?: number;
      };
      if (!response.ok)
        throw new Error(
          payload.error || "Não foi possível importar o extrato.",
        );
      toast.success(`${payload.imported ?? 0} movimentações importadas.`);
      form.reset();
      await refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao importar o extrato.",
      );
    } finally {
      setBusy(false);
    }
  }

  const syncAsaas = useCallback(async (connectionId: string, options?: { silent?: boolean }) => {
    const response = await fetch("/api/asaas", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-organization-id": organizationId,
      },
      body: JSON.stringify({ action: "sync", connectionId }),
    });
    const payload = (await response.json()) as {
      error?: string;
      imported?: number;
      truncated?: boolean;
    };
    if (!response.ok)
      throw new Error(
        payload.error || "Não foi possível sincronizar a conta Asaas.",
      );
    const imported = payload.imported ?? 0;
    if (!options?.silent)
      toast.success(
        imported
          ? `${imported} novas movimentações da Asaas importadas.`
          : "Conta Asaas sincronizada; não há novas movimentações.",
      );
    if (payload.truncated && !options?.silent)
      toast.message(
        "O volume é grande; sincronize novamente para buscar mais movimentações.",
      );
    await Promise.all([refresh(), refreshAsaas()]);
    return { imported, truncated: Boolean(payload.truncated) };
  }, [organizationId, refresh, refreshAsaas]);

  useEffect(() => {
    if (!asaas.encryptionConfigured || !asaas.connections.length) return;
    const autoSyncKey = `${organizationId}:${asaas.connections.map((connection) => connection.id).join("|")}`;
    if (autoSyncStartedRef.current === autoSyncKey) return;
    autoSyncStartedRef.current = autoSyncKey;
    let cancelled = false;
    setAutoSyncing(true);
    Promise.allSettled(
      asaas.connections.map((connection) =>
        syncAsaas(connection.id, { silent: true }),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const successful = results.filter(
          (result) => result.status === "fulfilled",
        );
        if (!successful.length) return;
        const imported = results.reduce((sum, result) => {
          if (result.status !== "fulfilled") return sum;
          return sum + result.value.imported;
        }, 0);
        setLastAutoSyncAt(new Date().toISOString());
        if (imported > 0)
          toast.success(
            `${imported} movimentações novas foram sincronizadas automaticamente.`,
          );
      })
      .catch(() => {
        if (!cancelled)
          toast.error("Não foi possível sincronizar a Asaas automaticamente.");
      })
      .finally(() => {
        if (!cancelled) setAutoSyncing(false);
      });
    return () => {
      cancelled = true;
    };
  }, [asaas.connections, asaas.encryptionConfigured, organizationId, syncAsaas]);

  async function connectAsaas(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!asaas.encryptionConfigured)
      return toast.error(
        "A chave de criptografia do servidor precisa ser configurada antes de conectar contas.",
      );
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    setBusy(true);
    try {
      const response = await fetch("/api/asaas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId,
        },
        body: JSON.stringify({ action: "connect", ...values }),
      });
      const payload = (await response.json()) as {
        error?: string;
        imported?: number;
      };
      if (!response.ok)
        throw new Error(
          payload.error || "Não foi possível conectar a conta Asaas.",
        );
      toast.success(
        `Conta Asaas conectada com segurança${payload.imported ? `; ${payload.imported} movimentações importadas` : ""}.`,
      );
      form.reset();
      setAsaasOpen(false);
      await Promise.all([refresh(), refreshAsaas()]);
      await refreshAsaasControl({ silent: true });
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Não foi possível conectar a conta Asaas.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function asaasAction(action: "createCustomer" | "createPixCharge" | "sendPix", event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!asaas.connections.length) return toast.error("Conecte uma conta Asaas antes.");
    const form = event.currentTarget;
    const values = Object.fromEntries(new FormData(form).entries());
    setBusy(true);
    try {
      const response = await fetch("/api/asaas", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId,
        },
        body: JSON.stringify({ action, connectionId: asaas.connections[0]?.id, ...values }),
      });
      const payload = (await response.json()) as {
        error?: string;
        pixCopyPaste?: string;
        pixQrCode?: string;
        payment?: AsaasPayment;
        transfer?: AsaasTransfer;
      };
      if (!response.ok) throw new Error(payload.error || "Não foi possível concluir a ação na Asaas.");
      if (action === "createPixCharge") {
        setAsaasControl((current) => ({ ...current, lastPixCopyPaste: payload.pixCopyPaste ?? "", lastPixQrCode: payload.pixQrCode ?? "", lastPaymentUrl: payload.payment?.invoiceUrl ?? "" }));
        toast.success("Cobrança criada na Asaas.");
      } else if (action === "sendPix") {
        toast.success(`Pix enviado para processamento${payload.transfer?.status ? `: ${payload.transfer.status}` : ""}.`);
      } else {
        toast.success("Cliente criado na Asaas.");
      }
      form.reset();
      await Promise.all([refreshAsaasControl({ silent: true }), syncAllBanks()]);
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha na ação Asaas.");
    } finally {
      setBusy(false);
    }
  }

  async function copyText(text: string, success: string) {
    await navigator.clipboard?.writeText(text);
    toast.success(success);
  }

  async function syncExistingConnection(connectionId: string) {
    setBusy(true);
    try {
      await syncAsaas(connectionId);
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Falha ao sincronizar a conta Asaas.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function syncAllBanks() {
    if (!asaas.connections.length) {
      toast.message("Nenhuma conexão Asaas disponível para sincronizar automaticamente.");
      return;
    }
    setBusy(true);
    setAutoSyncing(true);
    try {
      const results = await Promise.allSettled(
        asaas.connections.map((connection) =>
          syncAsaas(connection.id, { silent: true }),
        ),
      );
      const imported = results.reduce((sum, result) => {
        if (result.status !== "fulfilled") return sum;
        return sum + result.value.imported;
      }, 0);
      const failed = results.filter((result) => result.status === "rejected").length;
      setLastAutoSyncAt(new Date().toISOString());
      if (failed) toast.error(`${failed} conexão não sincronizou. Confira a chave ou status da conta.`);
      toast.success(
        imported
          ? `${imported} movimentações novas sincronizadas.`
          : "Bancos sincronizados; não há novas movimentações.",
      );
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao sincronizar bancos.");
    } finally {
      setAutoSyncing(false);
      setBusy(false);
    }
  }

  async function connectFinanceGateway(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setBusy(true);
    try {
      const values = Object.fromEntries(new FormData(form).entries());
      const response = await fetch("/api/finance-connections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId,
        },
        body: JSON.stringify({ action: "connect", ...values }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(payload.error || "Não foi possível salvar a conexão.");
      toast.success("Conexão financeira salva com segurança.");
      form.reset();
      setGatewayOpen(false);
      await refreshFinanceConnections();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao salvar conexão.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function setPrimaryConnection(connection: FinanceConnection) {
    setBusy(true);
    try {
      const response = await fetch("/api/finance-connections", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId,
        },
        body: JSON.stringify({
          action: "setPrimary",
          provider: connection.provider,
          connectionId: connection.id,
        }),
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok)
        throw new Error(payload.error || "Não foi possível definir principal.");
      toast.success(`${connection.providerLabel} definido como principal.`);
      await refreshFinanceConnections();
    } catch (error) {
      toast.error(
        error instanceof Error
          ? error.message
          : "Falha ao definir conexão principal.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function askFamaAi(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const question = aiQuestion.trim();
    if (question.length < 3) {
      toast.error("Escreva uma pergunta para a IA.");
      return;
    }
    setAiBusy(true);
    setAiAnswer("");
    try {
      const response = await fetch("/api/fama-ai", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId,
        },
        body: JSON.stringify({
          question,
          mode: "finance",
          context: aiContext(),
        }),
      });
      const payload = (await response.json()) as { answer?: string; error?: string };
      if (!response.ok)
        throw new Error(payload.error || "A IA não conseguiu responder agora.");
      setAiAnswer(payload.answer || "Não consegui gerar uma resposta agora.");
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Não foi possível usar a IA.";
      setAiAnswer(message);
      toast.error(message);
    } finally {
      setAiBusy(false);
    }
  }

  async function reconcile(movement: BankMovement, transactionId: string) {
    const action = transactionId ? "reconcile" : "createAndReconcile";
    const response = await fetch("/api/finance", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
        "x-organization-id": organizationId,
      },
      body: JSON.stringify({
        action,
        movementId: movement.id,
        ...(transactionId ? { transactionId } : {}),
      }),
    });
    const payload = (await response.json()) as {
      error?: string;
      transactionId?: string;
      transaction?: Transaction;
    };
    if (!response.ok)
      return toast.error(payload.error || "Não foi possível conciliar.");
    toast.success(
      transactionId
        ? "Movimentação conciliada e lançamento baixado."
        : "Lançamento criado e movimentação conciliada.",
    );
    if (payload.transactionId)
      onReconciled(
        payload.transactionId,
        action === "createAndReconcile" ? payload.transaction : undefined,
      );
    await refresh();
  }

  async function shareReminder(item: Transaction) {
    const isLate = item.status === "atrasado";
    const text = `Olá! ${isLate ? "Consta uma cobrança em aberto" : "Passando para lembrar da cobrança"}: ${item.description}.\n\nValor: ${money(item.amountCents)}\nVencimento: ${date(item.dueDate)}\n\nSe já realizou o pagamento, por favor desconsidere.`;
    try {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, "_blank", "noopener,noreferrer");
      await navigator.clipboard?.writeText(text);
      toast.success("Mensagem de cobrança pronta para WhatsApp.");
    } catch {
      toast.message("WhatsApp aberto com o texto de cobrança.");
    }
  }

  async function updateFiscalInvoice(invoice: FiscalInvoice, status: FiscalInvoice["status"]) {
    setBusy(true);
    try {
      const response = await fetch("/api/finance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId,
        },
        body: JSON.stringify({
          action: "updateFiscalInvoice",
          id: invoice.id,
          status,
        }),
      });
      const payload = (await response.json()) as { error?: string; status?: string };
      if (!response.ok)
        throw new Error(payload.error || "Não foi possível atualizar a nota.");
      toast.success(payload.status === "cancelando" ? "Cancelamento solicitado. Atualize o status para acompanhar." : "Nota atualizada.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao atualizar a nota fiscal.");
    } finally {
      setBusy(false);
    }
  }

  async function issueFiscalInvoice(invoice: FiscalInvoice, action = "issueFiscalInvoice") {
    setBusy(true);
    try {
      const response = await fetch("/api/finance", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-organization-id": organizationId,
        },
        body: JSON.stringify({
          action,
          id: invoice.id,
        }),
      });
      const payload = (await response.json()) as { error?: string; officialNumber?: string; accessKey?: string; status?: string; errorMessage?: string };
      if (!response.ok)
        throw new Error(payload.error || "Não foi possível emitir a nota fiscal.");
      if (payload.status === "erro") toast.error(payload.errorMessage || "O provedor fiscal informou uma falha na emissão. Confira o painel fiscal.");
      else toast.success(payload.status === "cancelada" ? "Cancelamento confirmado." : payload.officialNumber ? `Nota fiscal emitida: ${payload.officialNumber}.` : action === "refreshFiscalInvoice" ? "Status fiscal atualizado." : "Nota fiscal enviada para emissão na Notaas.");
      await refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Falha ao emitir a nota fiscal.");
    } finally {
      setBusy(false);
    }
  }

  const matchedTransactions = useMemo(
    () => transactions.filter((item) => item.status !== "pago"),
    [transactions],
  );
  const dre = useMemo(() => {
    const revenue = transactions.filter((item) => item.type === "receita").reduce((sum, item) => sum + item.amountCents, 0);
    const expenses = transactions.filter((item) => item.type === "despesa").reduce((sum, item) => sum + item.amountCents, 0);
    const categories = [...new Set(transactions.filter((item) => item.type === "despesa").map((item) => item.category || "Sem categoria"))].map((category) => ({ category, amount: transactions.filter((item) => item.type === "despesa" && (item.category || "Sem categoria") === category).reduce((sum, item) => sum + item.amountCents, 0) })).sort((a, b) => b.amount - a.amount).slice(0, 5);
    return { revenue, expenses, result: revenue - expenses, categories };
  }, [transactions]);
  const commissionBase = useMemo(() => quotes.filter((item) => item.status === "aprovado").reduce((sum, item) => sum + item.totalCents, 0), [quotes]);
  const estimatedCommission = Math.round(commissionBase * 0.05);
  const tabs: [FinanceTab, string][] = [
    ["visao", "Resumo"],
    ["contas", "Pagar e receber"],
    ["cobrancas", "Cobranças"],
    ["notas", "Notas fiscais"],
    ["asaas", "Asaas/Pix"],
    ["bancos", "Bancos e conciliação"],
    ["compras", "Compras e fornecedores"],
  ];
  return (
    <div className="finance-workspace">
      <div
        className="finance-tabs"
        role="tablist"
        aria-label="Áreas financeiras"
      >
        {tabs.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            aria-selected={tab === id}
            className={tab === id ? "active" : ""}
            onClick={() => onTabChange(id)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "visao" && (
        <>
          <section className="surface finance-charge-entry">
            <div>
              <small>COBRANÇA RÁPIDA</small>
              <h2>Crie cobrança Pix, boleto ou link Asaas</h2>
              <p>Gere QR Code, Pix copia e cola e link de pagamento direto pelo financeiro, sem entrar em Bancos.</p>
            </div>
            <div>
              <Button onClick={() => onTabChange("cobrancas")}>
                <QrCode />
                Criar cobrança agora
              </Button>
              <Button variant="outline" onClick={() => onTabChange("asaas")}>
                <Link2 />
                Abrir painel Asaas
              </Button>
            </div>
          </section>
          <section className="finance-overview-hero">
            <div className="finance-balance-card">
              <small>SALDO BANCÁRIO ATUAL</small>
              <strong>{loading ? "Carregando..." : money(bankBalance)}</strong>
              <span>
                {data.bankAccounts.length
                  ? `${data.bankAccounts.length} conta${data.bankAccounts.length > 1 ? "s" : ""} cadastrada${data.bankAccounts.length > 1 ? "s" : ""}`
                  : "Conecte Asaas ou cadastre uma conta manual"}
              </span>
              <span>
                {connectedProviderLabels.length
                  ? `Provedores: ${connectedProviderLabels.join(", ")}`
                  : "Sem provedor conectado"}
              </span>
              <p className="finance-sync-note">
                {autoSyncing
                  ? "Sincronizando Asaas automaticamente..."
                  : lastSyncLabel
                    ? `Atualizado automaticamente em ${lastSyncLabel}`
                    : "A sincronização automática roda ao abrir o Financeiro."}
              </p>
              <div>
                <Button onClick={() => onTabChange("bancos")}>
                  <Banknote />
                  Ver bancos
                </Button>
                <Button variant="outline" onClick={() => void syncAllBanks()} disabled={busy || autoSyncing || !asaas.connections.length}>
                  <RefreshCw />
                  Sincronizar tudo
                </Button>
                <Button variant="outline" onClick={() => onTabChange("contas")}>
                  Conferir contas
                </Button>
              </div>
            </div>
            <div className="finance-insight-grid">
              <article>
                <small>PREVISÃO APÓS CONTAS</small>
                <strong className={projectedBalance < 0 ? "negative" : "positive"}>
                  {money(projectedBalance)}
                </strong>
                <span>Saldo + recebimentos − pagamentos em aberto</span>
              </article>
              <article>
                <small>PRÓXIMO VENCIMENTO</small>
                <strong>{nextDue ? date(nextDue.dueDate) : "—"}</strong>
                <span>
                  {nextDue
                    ? `${nextDue.type === "receita" ? "Receber" : "Pagar"} · ${money(nextDue.amountCents)}`
                    : "Nenhuma conta em aberto"}
                </span>
              </article>
              <article>
                <small>CONCILIAÇÃO</small>
                <strong>{pendingBankMovements}</strong>
                <span>movimento{pendingBankMovements === 1 ? "" : "s"} pendente{pendingBankMovements === 1 ? "" : "s"} no extrato</span>
              </article>
            </div>
          </section>
          <div className="finance-kpis">
            <article>
              <small>A RECEBER</small>
              <strong>{money(totalIn)}</strong>
              <span>{receivable.length} títulos em aberto</span>
            </article>
            <article>
              <small>A PAGAR</small>
              <strong>{money(totalOut)}</strong>
              <span>{payable.length} contas em aberto</span>
            </article>
            <article>
              <small>EM ATRASO</small>
              <strong>{overdue.length}</strong>
              <span>
                {money(
                  overdue.reduce((sum, item) => sum + item.amountCents, 0),
                )}
              </span>
            </article>
            <article>
              <small>CONTAS BANCÁRIAS</small>
              <strong>{money(bankBalance)}</strong>
              <span>{pendingBankMovements} movimentos a conciliar</span>
            </article>
          </div>
          <section className={`finance-feedback-strip ${overdue.length || pendingBankMovements || projectedBalance < 0 ? "warning" : "ok"}`}>
            <article><ShieldCheck /><div><strong>Segurança</strong><span>Chaves ficam criptografadas e não voltam para o navegador.</span></div></article>
            <article><BellRing /><div><strong>Alertas</strong><span>{overdue.length ? `${overdue.length} cobrança${overdue.length === 1 ? "" : "s"} vencida${overdue.length === 1 ? "" : "s"}` : "Nenhuma cobrança vencida agora"}</span></div></article>
            <article><Sparkles /><div><strong>IA</strong><span>{projectedBalance < 0 ? "Caixa projetado negativo, priorize cobranças." : "Resumo financeiro pronto para decisão."}</span></div></article>
          </section>
          <div className="finance-management-grid">
            <section className="surface finance-snapshot finance-dre-card">
              <div className="panel-heading"><div><small>GESTÃO GERENCIAL</small><h2>DRE simplificada</h2></div><Badge variant={dre.result >= 0 ? "secondary" : "destructive"}>{dre.result >= 0 ? "Resultado positivo" : "Atenção"}</Badge></div>
              <div className="dre-summary"><div><small>Receitas</small><strong>{money(dre.revenue)}</strong></div><div><small>Despesas</small><strong>{money(dre.expenses)}</strong></div><div><small>Resultado</small><strong className={dre.result >= 0 ? "positive" : "negative"}>{money(dre.result)}</strong></div></div>
              <div className="dre-categories">{dre.categories.map((item) => <div key={item.category}><span>{item.category}</span><strong>{money(item.amount)}</strong></div>)}{!dre.categories.length && <p className="finance-empty">Cadastre despesas para formar o DRE.</p>}</div>
            </section>
            <section className="surface finance-snapshot commission-card">
              <div className="panel-heading"><div><small>VENDAS E EQUIPE</small><h2>Comissões estimadas</h2></div><Badge variant="secondary">5%</Badge></div>
              <p className="finance-help">Base calculada sobre orçamentos aprovados. O pagamento deve ser conferido antes do fechamento.</p>
              <div className="commission-highlight"><strong>{money(estimatedCommission)}</strong><span>estimativa atual</span></div>
              <div className="commission-meta"><span>Vendas aprovadas <strong>{money(commissionBase)}</strong></span><span>Regra <strong>5% por venda</strong></span></div>
            </section>
          </div>
          <div className="finance-shortcuts">
            <Button onClick={() => onOpenEntry("receita")}>
              <ArrowUpRight />
              Nova conta a receber
            </Button>
            <Button variant="outline" onClick={() => onOpenEntry("despesa")}>
              <ArrowDownLeft />
              Nova conta a pagar
            </Button>
            <Button variant="outline" onClick={() => onTabChange("bancos")}>
              <Banknote />
              Importar extrato
            </Button>
            <Button variant="outline" onClick={() => onTabChange("compras")}>
              <Truck />
              Nova ordem de compra
            </Button>
            <Button variant="outline" onClick={() => onTabChange("notas")}>
              <FileText />
              Emitir nota fiscal
            </Button>
          </div>
          <section className="surface finance-snapshot">
            <div className="panel-heading">
              <div>
                <small>AGENDA FINANCEIRA</small>
                <h2>Próximos vencimentos</h2>
              </div>
              <Badge variant="secondary">
                {receivable.length + payable.length} em aberto
              </Badge>
            </div>
            <TransactionTable
              items={[...receivable, ...payable]
                .sort((a, b) => a.dueDate.localeCompare(b.dueDate))
                .slice(0, 8)}
              onStatus={onStatus}
            />
          </section>
        </>
      )}
      {tab === "contas" && (
        <section className="surface finance-snapshot">
          <div className="panel-heading">
            <div>
              <small>CONTAS A PAGAR E RECEBER</small>
              <h2>Fluxo financeiro</h2>
            </div>
            <div className="finance-shortcuts">
              <Button size="sm" onClick={() => onOpenEntry("receita")}>
                <Plus />
                Receber
              </Button>
              <Button
                size="sm"
                variant="outline"
                onClick={() => onOpenEntry("despesa")}
              >
                <Plus />
                Pagar
              </Button>
            </div>
          </div>
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Filtrar por descrição ou categoria"
          />
          <TransactionTable
            items={filtered(transactions)}
            onStatus={onStatus}
          />
        </section>
      )}
      {tab === "cobrancas" && (
        <section className="surface finance-snapshot">
          <div className="panel-heading">
            <div>
              <small>RECEBIMENTOS E INADIMPLÊNCIA</small>
              <h2>Cobranças de clientes</h2>
            </div>
            <Button onClick={() => onOpenEntry("receita")}>
              <Plus />
              Nova cobrança
            </Button>
          </div>
          <p className="finance-help">
            Acompanhe valores, vencimentos e situação. Para emitir cobrança
            real com Pix, boleto, QR Code, copia e cola ou link de pagamento,
            use o painel Asaas nesta mesma tela.
          </p>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente / cobrança</TableHead>
                <TableHead>Vencimento</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Situação</TableHead>
                <TableHead>Lembrete</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {receivable
                .filter(
                  (item) =>
                    !query ||
                    `${item.description} ${item.category}`
                      .toLowerCase()
                      .includes(query.toLowerCase()),
                )
                .map((item) => (
                  <TableRow key={item.id}>
                    <TableCell>
                      <strong>{item.description}</strong>
                      <small className="block-muted">{item.category}</small>
                    </TableCell>
                    <TableCell>{date(item.dueDate)}</TableCell>
                    <TableCell>{money(item.amountCents)}</TableCell>
                    <TableCell>
                      <Badge
                        variant={
                          item.status === "atrasado"
                            ? "destructive"
                            : "secondary"
                        }
                      >
                        {item.status === "atrasado" ? "Atrasada" : "Pendente"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => void shareReminder(item)}
                      >
                        <BellRing />
                        Lembrar
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
            </TableBody>
          </Table>
          {!receivable.length && (
            <p className="finance-empty">Nenhuma cobrança pendente.</p>
          )}
        </section>
      )}
      {tab === "notas" && (
        <section className="surface finance-snapshot">
          <div className="panel-heading">
            <div>
              <small>FISCAL POR EMPRESA</small>
              <h2>Notas fiscais</h2>
            </div>
            <Button onClick={() => setFiscalOpen((value) => !value)}>
              <Plus />
              Preparar nota fiscal
            </Button>
          </div>
          <p className="finance-help">
            Prepare os dados, emita no portal oficial e guarde o PDF ou XML aqui. Não precisa de chave de API. A validade fiscal vem do documento emitido pelo portal autorizado.
          </p>
          {fiscalOpen && (
            <form
              className="finance-form"
              onSubmit={(event) => void submit("fiscalInvoice", event)}
            >
              <NativeSelect name="type" defaultValue="nfse" aria-label="Tipo de nota">
                <NativeSelectOption value="nfse">NFS-e serviço</NativeSelectOption>
                <NativeSelectOption value="nfe">NF-e produto</NativeSelectOption>
              </NativeSelect>
              <Input name="customerName" required placeholder="Cliente / razão social" />
              <Input name="customerDocument" inputMode="numeric" placeholder="CPF/CNPJ do cliente" />
              <Input name="customerEmail" type="email" placeholder="E-mail do cliente" />
              <Input name="city" placeholder="Município da prestação" />
              <Input name="issueDate" type="date" defaultValue={new Date().toISOString().slice(0, 10)} required aria-label="Data / competência" />
              <Input name="amount" required inputMode="decimal" placeholder="Valor da nota (R$)" />
              <Textarea name="serviceDescription" required placeholder="Descrição do serviço ou produto" />
              <Input name="notes" placeholder="Observações fiscais" />
              <Button disabled={busy}>Preparar emissão</Button>
            </form>
          )}
          {!data.fiscalInvoices.length && (
            <p className="finance-empty">
              Nenhuma nota fiscal cadastrada ainda.
            </p>
          )}
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Cliente / descrição</TableHead>
                <TableHead>Tipo</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Valor</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ações</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.fiscalInvoices.map((invoice) => (
                <TableRow key={invoice.id}>
                  <TableCell>
                    <strong>{invoice.customerName}</strong>
                    <small className="block-muted">
                      {invoice.serviceDescription}
                    </small>
                    {(invoice.officialNumber || invoice.accessKey) && (
                      <small className="block-muted">
                        {invoice.officialNumber ? `NF ${invoice.officialNumber}` : ""}
                        {invoice.officialNumber && invoice.accessKey ? " · " : ""}
                        {invoice.accessKey ? `Chave ${invoice.accessKey}` : ""}
                      </small>
                    )}
                    {(invoice.xmlUrl || invoice.pdfUrl) && (
                      <small className="block-muted">
                        {invoice.pdfUrl && <a href={invoice.pdfUrl} target="_blank" rel="noreferrer">PDF</a>}
                        {invoice.pdfUrl && invoice.xmlUrl ? " · " : ""}
                        {invoice.xmlUrl && <a href={invoice.xmlUrl} target="_blank" rel="noreferrer">XML</a>}
                      </small>
                    )}
                  </TableCell>
                  <TableCell>{invoice.type === "nfse" ? "NFS-e" : "NF-e"}</TableCell>
                  <TableCell>{date(invoice.issueDate)}</TableCell>
                  <TableCell>{money(invoice.amountCents)}</TableCell>
                  <TableCell>
                    <Badge variant={invoice.status === "cancelada" ? "destructive" : invoice.status === "emitida" ? "secondary" : "outline"}>
                      {{ rascunho: "Rascunho", registrada: "Nota registrada", processando: "Processando", emitida: "Emitida", cancelada: "Cancelada", cancelando: "Cancelando", erro: "Revisar emissão" }[invoice.status] ?? invoice.status}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="finance-row-actions">
                      {(invoice.status === "rascunho" || (invoice.provider.startsWith("portal_") && ["registrada", "cancelada"].includes(invoice.status))) && <Button size="sm" variant="outline" disabled={busy} onClick={() => setFiscalSelected(invoice)}><ExternalLink />{invoice.status === "rascunho" ? "Emitir no portal" : "Documento / consulta"}</Button>}
                      {data.fiscalSettings?.apiEnabled && !invoice.provider.startsWith("portal_") && <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || invoice.status !== "rascunho"}
                        onClick={() => void issueFiscalInvoice(invoice)}
                      >
                        <Check />
                        Enviar pela Notaas
                      </Button>
                      </>}
                      {invoice.provider === "notaas" && <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || !invoice.providerReference}
                        onClick={() => void issueFiscalInvoice(invoice, "refreshFiscalInvoice")}
                      >
                        Atualizar status
                      </Button>
                      </>}
                      {!["registrada", "cancelada"].includes(invoice.status) && <>
                      <Button
                        size="sm"
                        variant="outline"
                        disabled={busy || !["rascunho", "emitida"].includes(invoice.status)}
                        onClick={() => void updateFiscalInvoice(invoice, "cancelada")}
                      >
                        {invoice.status === "rascunho" ? "Descartar rascunho" : "Cancelar"}
                      </Button>
                      </>}
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
          {fiscalSelected && <FiscalPortalPanel key={`${organizationId}:${fiscalSelected.id}`} invoice={fiscalSelected} settings={data.fiscalSettings || fiscalPortalSettings(defaultCompanySettings)} organizationId={organizationId} onClose={() => setFiscalSelected(null)} onSaved={refresh} />}
        </section>
      )}
      {(tab === "bancos" || tab === "asaas" || tab === "cobrancas") && (
        <div className="finance-columns">
          <section className="surface finance-snapshot">
            <div className="panel-heading">
              <div>
                <small>CONTA DIGITAL ASAAS</small>
                <h2>Saldo e conciliação</h2>
              </div>
              {autoSyncing ? (
                <Badge variant="secondary">Sincronizando...</Badge>
              ) : lastSyncLabel ? (
                <Badge variant="secondary">Auto: {lastSyncLabel}</Badge>
              ) : null}
              <div className="finance-shortcuts">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setAsaasOpen((value) => !value)}
                >
                  <KeyRound />
                  Conectar Asaas
                </Button>
                <Button
                  size="sm"
                  onClick={() => setAccountOpen((value) => !value)}
                >
                  <Plus />
                  Conta manual
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy || autoSyncing || !asaas.connections.length}
                  onClick={() => void syncAllBanks()}
                >
                  <RefreshCw />
                  Sincronizar tudo
                </Button>
              </div>
            </div>
            <div className="bank-provider-summary">
              <article>
                <small>Asaas</small>
                <strong>{asaas.connections.length || "0"}</strong>
                <span>sincronização automática de saldo e extrato</span>
              </article>
              <article>
                <small>Mercado Pago / PagBank</small>
                <strong>{financeConnections.connections.length || "0"}</strong>
                <span>conexão segura salva; sincronização nativa em implantação</span>
              </article>
              <article>
                <small>Principal</small>
                <strong>{primaryFinanceConnection?.providerLabel ?? "Asaas/manual"}</strong>
                <span>provedor preferencial para visão financeira</span>
              </article>
            </div>
            <div className="finance-help">
              <ShieldCheck /> A senha do Asaas nunca é solicitada. A chave de
              API é enviada diretamente ao servidor, criptografada e isolada por
              empresa.
            </div>
            {!asaas.encryptionConfigured && (
              <p className="finance-help">
                A conexão ficará disponível quando a chave de criptografia do
                servidor for configurada.
              </p>
            )}
            {asaasOpen && (
              <form
                className="finance-form"
                onSubmit={(event) => void connectAsaas(event)}
              >
                <NativeSelect
                  name="environment"
                  defaultValue="sandbox"
                  aria-label="Ambiente Asaas"
                >
                  <NativeSelectOption value="sandbox">
                    Sandbox (testes)
                  </NativeSelectOption>
                  <NativeSelectOption value="production">
                    Produção (valores reais)
                  </NativeSelectOption>
                </NativeSelect>
                <Input
                  name="apiKey"
                  type="password"
                  autoComplete="off"
                  required
                  minLength={30}
                  placeholder="Chave de API Asaas ($aact_...)"
                />
                <small>
                  A chave não será exibida novamente nem enviada ao navegador
                  após o cadastro.
                </small>
                <Button disabled={busy || !asaas.encryptionConfigured}>
                  <Link2 />
                  Validar e conectar
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    window.open(
                  "https://www.asaas.com/",
                      "_blank",
                      "noopener,noreferrer",
                    )
                  }
                >
                  <ExternalLink />
                  Criar conta no Asaas
                </Button>
                <small>
                  O cadastro, a senha, a selfie e os documentos são concluídos
                  no ambiente oficial do Asaas. Depois, gere a chave de API e
                  volte para conectar.
                </small>
              </form>
            )}
            {asaas.connections.map((connection) => (
              <article className="bank-account-row" key={connection.id}>
                <span className="bank-icon">
                  <Link2 />
                </span>
                <div>
                  <strong>{connection.institution}</strong>
                  <small>
                    {connection.status === "APPROVED"
                      ? "Conta aprovada"
                      : `Cadastro: ${connection.status}`}{" "}
                    ·{" "}
                    {connection.environment === "production"
                      ? "Produção"
                      : "Sandbox"}{" "}
                    · Última sincronização:{" "}
                    {connection.lastSyncedAt
                      ? new Intl.DateTimeFormat("pt-BR", {
                          dateStyle: "short",
                          timeStyle: "short",
                        }).format(new Date(connection.lastSyncedAt))
                      : "ainda não sincronizado"}
                  </small>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void syncExistingConnection(connection.id)}
                >
                  <RefreshCw />
                  Sincronizar
                </Button>
              </article>
            ))}
            <section className="finance-asaas-control">
                <div className="panel-heading">
                  <div>
                    <small>CONTROLE ASAAS</small>
                    <h2>Pix, clientes e cobranças</h2>
                  </div>
                  <div className="finance-shortcuts">
                    <Badge variant={asaasControl.status === "APPROVED" ? "default" : "secondary"}>
                      {asaasControl.status || "Conectada"}
                    </Badge>
                    <Button size="sm" variant="outline" onClick={() => void refreshAsaasControl()} disabled={busy || asaasControl.loading}>
                      <RefreshCw />
                      Atualizar Asaas
                    </Button>
                  </div>
                </div>
                {!asaas.connections.length && (
                  <div className="finance-help asaas-control-empty">
                    <ShieldCheck />
                    <span>
                      O checkout do site já pode usar a Asaas da plataforma, mas
                      o financeiro desta empresa precisa de uma conexão Asaas
                      própria para controlar saldo, clientes, cobranças e Pix de
                      saída. Use o botão <strong>Conectar Asaas</strong> acima
                      para vincular a conta desta empresa.
                    </span>
                  </div>
                )}
                <div className="asaas-control-grid">
                  <article>
                    <small>Saldo Asaas</small>
                    <strong>{asaasControl.loading ? "Atualizando..." : money(asaasControl.balanceCents)}</strong>
                    <span>{asaas.connections.length ? "Saldo direto da API Asaas" : "Aguardando conexão"}</span>
                  </article>
                  <article>
                    <small>Cobranças recentes</small>
                    <strong>{asaasControl.payments.length}</strong>
                    <span>{asaas.connections.length ? "Pix, boleto ou cartão emitidos" : "Conecte para carregar"}</span>
                  </article>
                  <article>
                    <small>Clientes Asaas</small>
                    <strong>{asaasControl.customers.length}</strong>
                    <span>{asaas.connections.length ? "Últimos clientes carregados" : "Conecte para gerenciar"}</span>
                  </article>
                </div>
                <div className="asaas-action-grid">
                  <form className="finance-form" onSubmit={(event) => void asaasAction("createCustomer", event)}>
                    <strong>Novo cliente Asaas</strong>
                    <Input name="name" required placeholder="Nome do cliente" />
                    <Input name="email" type="email" placeholder="E-mail" />
                    <Input name="mobilePhone" inputMode="tel" placeholder="WhatsApp" />
                    <Input name="cpfCnpj" inputMode="numeric" placeholder="CPF/CNPJ opcional" />
                    <Button disabled={busy || !asaas.connections.length}><Plus />Criar cliente</Button>
                  </form>
                  <form className="finance-form" onSubmit={(event) => void asaasAction("createPixCharge", event)}>
                    <strong>Gerar cobrança</strong>
                    <NativeSelect name="customer" required defaultValue="">
                      <NativeSelectOption value="" disabled>Selecione o cliente Asaas</NativeSelectOption>
                      {asaasControl.customers.map((customer) => (
                        <NativeSelectOption key={customer.id} value={customer.id}>{customer.name}</NativeSelectOption>
                      ))}
                    </NativeSelect>
                    <NativeSelect name="billingType" defaultValue="PIX" aria-label="Forma da cobrança">
                      <NativeSelectOption value="PIX">Pix com QR Code</NativeSelectOption>
                      <NativeSelectOption value="BOLETO">Boleto</NativeSelectOption>
                      <NativeSelectOption value="UNDEFINED">Link Asaas: Pix, boleto ou cartão</NativeSelectOption>
                    </NativeSelect>
                    <Input name="description" placeholder="Descrição da cobrança" defaultValue="Cobrança Fama System" />
                    <Input name="value" required inputMode="decimal" placeholder="Valor (R$)" />
                    <Input name="dueDate" required type="date" aria-label="Vencimento" />
                    <Button disabled={busy || !asaas.connections.length || !asaasControl.customers.length}><QrCode />Gerar cobrança</Button>
                    {asaasControl.lastPixQrCode && <img className="asaas-payment-qr" src={`data:image/png;base64,${asaasControl.lastPixQrCode}`} alt="QR Code Pix gerado" />}
                    {asaasControl.lastPixCopyPaste && (
                      <Textarea readOnly value={asaasControl.lastPixCopyPaste} aria-label="Pix copia e cola gerado" />
                    )}
                    {asaasControl.lastPixCopyPaste && <Button type="button" variant="outline" onClick={() => void copyText(asaasControl.lastPixCopyPaste, "Pix copia e cola copiado.")}><Copy />Copiar Pix copia e cola</Button>}
                    {asaasControl.lastPaymentUrl && <Button type="button" variant="outline" onClick={() => void copyText(asaasControl.lastPaymentUrl, "Link de pagamento copiado.")}><Copy />Copiar link de pagamento</Button>}
                    {asaasControl.lastPaymentUrl && <a className="finance-payment-link" href={asaasControl.lastPaymentUrl} target="_blank" rel="noreferrer">Abrir cobrança no Asaas</a>}
                  </form>
                  <form className="finance-form asaas-danger-form" onSubmit={(event) => void asaasAction("sendPix", event)}>
                    <strong>Enviar Pix pela Asaas</strong>
                    <small>Use só para pagamentos reais. O envio exige confirmação escrita e fica registrado na Asaas.</small>
                    <NativeSelect name="pixAddressKeyType" defaultValue="EVP">
                      <NativeSelectOption value="EVP">Chave aleatória</NativeSelectOption>
                      <NativeSelectOption value="CPF">CPF</NativeSelectOption>
                      <NativeSelectOption value="CNPJ">CNPJ</NativeSelectOption>
                      <NativeSelectOption value="EMAIL">E-mail</NativeSelectOption>
                      <NativeSelectOption value="PHONE">Telefone</NativeSelectOption>
                    </NativeSelect>
                    <Input name="pixAddressKey" required placeholder="Chave Pix de destino" />
                    <Input name="value" required inputMode="decimal" placeholder="Valor (R$)" />
                    <Input name="description" placeholder="Descrição do Pix" />
                    <Input name="confirmation" required placeholder="Digite ENVIAR PIX para confirmar" />
                    <Button variant="destructive" disabled={busy || !asaas.connections.length}><Send />Enviar Pix</Button>
                  </form>
                </div>
                <div className="asaas-live-lists">
                  <div>
                    <strong>Cobranças recentes</strong>
                    {asaasControl.payments.map((payment) => (
                      <p key={payment.id}><span>{payment.description}</span><b>{money(payment.valueCents)}</b><small>{payment.status} · {date(payment.dueDate)}</small></p>
                    ))}
                    {!asaasControl.payments.length && <small>Nenhuma cobrança carregada ainda.</small>}
                  </div>
                  <div>
                    <strong>Pix enviados</strong>
                    {asaasControl.transfers.map((transfer) => (
                      <p key={transfer.id}><span>{transfer.description}</span><b>{money(transfer.valueCents)}</b><small>{transfer.status} · {transfer.dateCreated ? date(transfer.dateCreated) : "sem data"}</small></p>
                    ))}
                    {!asaasControl.transfers.length && <small>Nenhum Pix enviado carregado ainda.</small>}
                  </div>
                </div>
              </section>
            <section className="finance-provider-panel">
              <div className="panel-heading">
                <div>
                  <small>OUTRAS CONEXÕES</small>
                  <h2>Mercado Pago e PagBank</h2>
                </div>
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => setGatewayOpen((value) => !value)}
                >
                  <CreditCard />
                  Adicionar
                </Button>
              </div>
              <p>
                Use um provedor como principal ou mantenha vários ativos ao
                mesmo tempo. As chaves ficam criptografadas no servidor. Nesta
                versão, Mercado Pago e PagBank ficam cadastrados como conexão
                segura/principal; a sincronização automática de extrato já está
                ativa para Asaas.
              </p>
              {gatewayOpen && (
                <form
                  className="finance-form"
                  onSubmit={(event) => void connectFinanceGateway(event)}
                >
                  <NativeSelect name="provider" defaultValue="mercado_pago">
                    <NativeSelectOption value="mercado_pago">
                      Mercado Pago
                    </NativeSelectOption>
                    <NativeSelectOption value="pagbank">
                      PagBank / PagSeguro
                    </NativeSelectOption>
                  </NativeSelect>
                  <Input
                    name="label"
                    placeholder="Nome da conexão (ex.: Mercado Pago principal)"
                  />
                  <Input
                    name="credential"
                    type="password"
                    autoComplete="off"
                    required
                    minLength={20}
                    placeholder="Access token, app token ou chave do provedor"
                  />
                  <Button disabled={busy || !financeConnections.encryptionConfigured}>
                    <ShieldCheck />
                    Salvar conexão segura
                  </Button>
                  {!financeConnections.encryptionConfigured && (
                    <small>
                      Configure a criptografia do servidor antes de salvar novas
                      chaves financeiras.
                    </small>
                  )}
                </form>
              )}
              {financeConnections.connections.map((connection) => (
                <article className="bank-account-row" key={connection.id}>
                  <span className="bank-icon">
                    <CreditCard />
                  </span>
                  <div>
                    <strong>{connection.institution}</strong>
                    <small>
                      {connection.providerLabel} · {connection.status}
                      {connection.primary ? " · Principal" : ""}
                      {" · "}sincronização nativa em implantação
                    </small>
                  </div>
                  <Button
                    size="sm"
                    variant={connection.primary ? "secondary" : "outline"}
                    disabled={busy || connection.primary}
                    onClick={() => void setPrimaryConnection(connection)}
                  >
                    {connection.primary ? "Principal" : "Usar principal"}
                  </Button>
                </article>
              ))}
              {!financeConnections.connections.length && (
                <p className="finance-empty">
                  Nenhum provedor extra conectado ainda.
                </p>
              )}
            </section>
            {accountOpen && (
              <form
                className="finance-form"
                onSubmit={(event) => void submit("bankAccount", event)}
              >
                <Input
                  name="name"
                  required
                  placeholder="Nome da conta (ex.: Caixa)"
                />
                <Input name="institution" placeholder="Instituição" />
                <NativeSelect name="accountType" defaultValue="corrente">
                  <NativeSelectOption value="corrente">
                    Conta corrente
                  </NativeSelectOption>
                  <NativeSelectOption value="poupanca">
                    Poupança
                  </NativeSelectOption>
                  <NativeSelectOption value="caixa">Caixa</NativeSelectOption>
                  <NativeSelectOption value="cartao">Cartão</NativeSelectOption>
                </NativeSelect>
                <Input
                  name="openingBalance"
                  inputMode="decimal"
                  placeholder="Saldo inicial (R$)"
                />
                <Button disabled={busy}>Salvar conta</Button>
              </form>
            )}
            {!data.bankAccounts.length && (
              <p className="finance-empty">
                Conecte sua conta Asaas ou cadastre uma conta manual.
              </p>
            )}
            {data.bankAccounts.map((account) => {
              const movements = data.bankMovements.filter(
                (item) => item.accountId === account.id,
              );
              const balance = balanceForAccount(account);
              return (
                <article className="bank-account-row" key={account.id}>
                  <span className="bank-icon">
                    <Banknote />
                  </span>
                  <div>
                    <strong>{account.name}</strong>
                    <small>
                      {account.institution || account.accountType} ·{" "}
                      {account.provider === "asaas" ? "Asaas" : "Manual"} ·{" "}
                      {
                        movements.filter((item) => item.status === "pendente")
                          .length
                      }{" "}
                      pendentes
                    </small>
                  </div>
                  <b>{money(balance)}</b>
                </article>
              );
            })}
            <form
              className="finance-import"
              onSubmit={(event) => void importCsv(event)}
            >
              <div>
                <FileUp />
                <strong>Importar extrato CSV</strong>
              </div>
              <p>
                Colunas aceitas: Data, Descrição e Valor; ou Data, Descrição,
                Crédito e Débito. Até 500 linhas.
              </p>
              <NativeSelect
                value={csvAccount}
                onChange={(event) => setCsvAccount(event.target.value)}
                required
              >
                <NativeSelectOption value="">
                  Selecione a conta
                </NativeSelectOption>
                {data.bankAccounts.map((account) => (
                  <NativeSelectOption key={account.id} value={account.id}>
                    {account.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
              <Input
                type="file"
                name="statement"
                accept=".csv,text/csv"
                required
              />
              <Button
                variant="outline"
                disabled={busy || !data.bankAccounts.length}
              >
                <FileUp />
                Importar extrato
              </Button>
            </form>
          </section>
          <section className="surface finance-snapshot">
            <div className="finance-ai-panel">
              <div className="panel-heading">
                <div>
                  <small>IA FAMA</small>
                  <h2>Assistente financeiro</h2>
                </div>
                <Sparkles />
              </div>
              <p>
                Pergunte sobre caixa, cobranças, vencimentos, conciliação ou
                próximos passos. A IA usa apenas um resumo operacional seguro.
              </p>
              <div className="finance-ai-insights">
                <span>Saldo projetado: <strong className={projectedBalance < 0 ? "negative" : "positive"}>{money(projectedBalance)}</strong></span>
                <span>Vencidos: <strong>{overdue.length}</strong></span>
                <span>Conciliação: <strong>{pendingBankMovements}</strong></span>
              </div>
              <div className="finance-ai-suggestions">
                {aiSuggestions.map((suggestion) => (
                  <button
                    type="button"
                    key={suggestion}
                    onClick={() => setAiQuestion(suggestion)}
                    disabled={!aiConfigured || aiBusy}
                  >
                    {suggestion}
                  </button>
                ))}
              </div>
              <form onSubmit={(event) => void askFamaAi(event)}>
                <Textarea
                  value={aiQuestion}
                  onChange={(event) => setAiQuestion(event.target.value)}
                  minLength={3}
                  maxLength={1200}
                  placeholder="Ex.: O que devo cobrar primeiro hoje?"
                  disabled={!aiConfigured || aiBusy}
                />
                <Button disabled={!aiConfigured || aiBusy}>
                  <Sparkles />
                  {aiBusy ? "Pensando..." : "Perguntar à IA"}
                </Button>
              </form>
              {!aiConfigured && (
                <small>
                  A IA está instalada no sistema. Falta configurar a chave
                  OPENAI_API_KEY no servidor para ativar as respostas.
                </small>
              )}
              {aiAnswer && <div className="finance-ai-answer">{aiAnswer}</div>}
            </div>
            <div className="panel-heading">
              <div>
                <small>CONCILIAÇÃO</small>
                <h2>Movimentações do extrato</h2>
              </div>
              <Button
                size="icon"
                variant="ghost"
                aria-label="Atualizar"
                onClick={() => void refresh()}
              >
                <RefreshCw />
              </Button>
            </div>
            {loading ? (
              <p className="finance-empty">Carregando…</p>
            ) : !data.bankMovements.length ? (
              <p className="finance-empty">
                Sincronize a Asaas ou importe um CSV para começar a conciliação.
              </p>
            ) : (
              <div className="reconciliation-list">
                {data.bankMovements.map((movement) => {
                  const account = data.bankAccounts.find(
                    (entry) => entry.id === movement.accountId,
                  );
                  const sign = movement.amountCents > 0 ? 1 : -1;
                  const candidates = matchedTransactions.filter(
                    (item) =>
                      item.type === (sign > 0 ? "receita" : "despesa") &&
                      item.amountCents === Math.abs(movement.amountCents),
                  );
                  return (
                    <article className="reconciliation-row" key={movement.id}>
                      <div>
                        <small>
                          {account?.name || "Conta"} · {date(movement.postedAt)}
                        </small>
                        <strong>{movement.description}</strong>
                        <b
                          className={
                            sign > 0 ? "money-receita" : "money-despesa"
                          }
                        >
                          {sign < 0 ? "−" : "+"}
                          {money(Math.abs(movement.amountCents))}
                        </b>
                      </div>
                      {movement.status === "conciliado" ? (
                        <Badge>
                          <Check />
                          Conciliado
                        </Badge>
                      ) : (
                        <div className="reconcile-controls">
                          <NativeSelect
                            defaultValue=""
                            aria-label={`Lançamento correspondente a ${movement.description}`}
                            onChange={(event) =>
                              void reconcile(movement, event.target.value)
                            }
                          >
                            <NativeSelectOption value="">
                              Vincular lançamento…
                            </NativeSelectOption>
                            {candidates.map((item) => (
                              <NativeSelectOption key={item.id} value={item.id}>
                                {item.description} · {date(item.dueDate)}
                              </NativeSelectOption>
                            ))}
                          </NativeSelect>
                          {candidates.length === 0 && (
                            <>
                              <small>Sem lançamento com valor exato.</small>
                              <Button
                                type="button"
                                size="sm"
                                variant="outline"
                                onClick={() => void reconcile(movement, "")}
                              >
                                <Plus />
                                Criar lançamento e conciliar
                              </Button>
                            </>
                          )}
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        </div>
      )}
      {tab === "compras" && (
        <div className="finance-columns">
          <section className="surface finance-snapshot">
            <div className="panel-heading">
              <div>
                <small>FORNECEDORES</small>
                <h2>Cadastro e relacionamento</h2>
              </div>
              <Button
                size="sm"
                onClick={() => setSupplierOpen((value) => !value)}
              >
                <Plus />
                Fornecedor
              </Button>
            </div>
            {supplierOpen && (
              <form
                className="finance-form"
                onSubmit={(event) => void submit("supplier", event)}
              >
                <Input name="name" required placeholder="Nome do fornecedor" />
                <Input
                  name="document"
                  placeholder="CPF/CNPJ"
                  inputMode="numeric"
                />
                <Input name="phone" placeholder="Telefone" />
                <Input name="email" type="email" placeholder="E-mail" />
                <Input name="notes" placeholder="Observações" />
                <Button disabled={busy}>Salvar fornecedor</Button>
              </form>
            )}
            {!data.suppliers.length && (
              <p className="finance-empty">
                Cadastre fornecedores para registrar as compras.
              </p>
            )}
            {data.suppliers.map((supplier) => (
              <article className="supplier-row" key={supplier.id}>
                <span className="supplier-avatar">
                  <Truck />
                </span>
                <div>
                  <strong>{supplier.name}</strong>
                  <small>
                    {supplier.document ||
                      supplier.email ||
                      supplier.phone ||
                      "Contato não informado"}
                  </small>
                </div>
                <small>
                  {
                    data.purchases.filter(
                      (item) => item.supplierId === supplier.id,
                    ).length
                  }{" "}
                  compras
                </small>
              </article>
            ))}
          </section>
          <section className="surface finance-snapshot">
            <div className="panel-heading">
              <div>
                <small>ENTRADAS E DESPESAS</small>
                <h2>Compras registradas</h2>
              </div>
              <Button
                size="sm"
                onClick={() => setPurchaseOpen((value) => !value)}
                disabled={!data.suppliers.length}
              >
                <Plus />
                Compra
              </Button>
            </div>
            {purchaseOpen && (
              <form
                className="finance-form"
                onSubmit={(event) => void submit("purchase", event)}
              >
                <NativeSelect name="supplierId" required defaultValue="">
                  <NativeSelectOption value="" disabled>
                    Selecione o fornecedor
                  </NativeSelectOption>
                  {data.suppliers.map((supplier) => (
                    <NativeSelectOption key={supplier.id} value={supplier.id}>
                      {supplier.name}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <Input
                  name="invoiceNumber"
                  placeholder="Número da nota / referência"
                />
                <Input
                  type="date"
                  name="purchaseDate"
                  aria-label="Data da compra"
                />
                <Input type="date" name="dueDate" aria-label="Vencimento" />
                <Input
                  name="amount"
                  required
                  inputMode="decimal"
                  placeholder="Valor total (R$)"
                />
                <Input name="notes" placeholder="Observações" />
                <Button disabled={busy}>Registrar e gerar conta a pagar</Button>
              </form>
            )}
            {!data.purchases.length && (
              <p className="finance-empty">
                As compras cadastradas e suas parcelas aparecem aqui.
              </p>
            )}
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fornecedor / nota</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Vencimento</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {data.purchases.map((purchase) => (
                  <TableRow key={purchase.id}>
                    <TableCell>
                      <strong>{purchase.supplierName}</strong>
                      <small className="block-muted">
                        {purchase.invoiceNumber
                          ? `NF ${purchase.invoiceNumber}`
                          : "Sem nota informada"}
                      </small>
                    </TableCell>
                    <TableCell>{date(purchase.purchaseDate)}</TableCell>
                    <TableCell>{date(purchase.dueDate)}</TableCell>
                    <TableCell>{money(purchase.amountCents)}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">
                        {transactions.find(
                          (item) => item.id === purchase.payableId,
                        )?.status === "pago"
                          ? "Pago"
                          : "A pagar"}
                      </Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </section>
        </div>
      )}
      {loading && tab !== "bancos" && (
        <p className="finance-empty">
          Carregando contas bancárias, compras e fornecedores…
        </p>
      )}
    </div>
  );
}

function TransactionTable({
  items,
  onStatus,
}: {
  items: Transaction[];
  onStatus: (item: Transaction, status: Transaction["status"]) => void;
}) {
  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead>Descrição</TableHead>
          <TableHead>Categoria</TableHead>
          <TableHead>Vencimento</TableHead>
          <TableHead>Tipo</TableHead>
          <TableHead>Valor</TableHead>
          <TableHead>Status</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {items.map((item) => (
          <TableRow key={item.id}>
            <TableCell>
              <strong>{item.description}</strong>
            </TableCell>
            <TableCell>{item.category || "—"}</TableCell>
            <TableCell>{date(item.dueDate)}</TableCell>
            <TableCell>
              <Badge variant="outline">
                {item.type === "receita" ? "A receber" : "A pagar"}
              </Badge>
            </TableCell>
            <TableCell>
              <strong>{money(item.amountCents)}</strong>
            </TableCell>
            <TableCell>
              <NativeSelect
                aria-label={`Status de ${item.description}`}
                value={item.status}
                onChange={(event) =>
                  onStatus(item, event.target.value as Transaction["status"])
                }
              >
                <NativeSelectOption value="pendente">
                  Pendente
                </NativeSelectOption>
                <NativeSelectOption value="atrasado">
                  Atrasado
                </NativeSelectOption>
                <NativeSelectOption value="pago">Pago</NativeSelectOption>
              </NativeSelect>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}
