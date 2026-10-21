'use client';
import { useEffect, useState } from 'react';
import { CircleDollarSign, Eye, EyeOff, FileText, Link, List, QrCode, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { requestJson } from '@/lib/client-request';
import { formatCurrency as money } from '@/lib/utils';
export function DashboardBalance({ organizationId, ledgerBalanceCents, receivable, payable, onFinanceTab }) {
    const [hidden, setHidden] = useState(false);
    const [reload, setReload] = useState(0);
    const [balance, setBalance] = useState(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    useEffect(() => {
        const controller = new AbortController();
        setLoading(true);
        setError('');
        setBalance(null);
        async function load() {
            try {
                const account = await requestJson('/api/asaas', { headers: { 'x-organization-id': organizationId }, cache: 'no-store', signal: controller.signal }, 25000);
                const connection = account.connections?.[0];
                if (!connection)
                    return;
                const result = await requestJson('/api/asaas', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-organization-id': organizationId }, body: JSON.stringify({ action: 'dashboard', connectionId: connection.id }), signal: controller.signal }, 25000);
                if (!Number.isSafeInteger(result.balanceCents))
                    throw new Error('O saldo recebido é inválido.');
                if (!controller.signal.aborted)
                    setBalance({ organizationId, cents: result.balanceCents, sandbox: connection.environment !== 'production' });
            }
            catch (reason) {
                if (!controller.signal.aborted)
                    setError(reason instanceof Error ? reason.message : 'Não foi possível atualizar o saldo.');
            }
            finally {
                if (!controller.signal.aborted)
                    setLoading(false);
            }
        }
        void load();
        return () => controller.abort();
    }, [organizationId, reload]);
    const connected = balance?.organizationId === organizationId ? balance : null;
    return <section className="surface dashboard-balance" aria-label="Saldo e atalhos financeiros">
    <div className="dashboard-balance-value">
      <div className="dashboard-balance-label"><CircleDollarSign /><h2>{connected ? 'Saldo disponível' : 'Saldo registrado'}</h2><Button variant="ghost" size="icon-sm" title={hidden ? 'Mostrar saldo' : 'Ocultar saldo'} aria-label={hidden ? 'Mostrar saldo' : 'Ocultar saldo'} aria-pressed={hidden} onClick={() => setHidden(value => !value)}>{hidden ? <EyeOff /> : <Eye />}</Button></div>
      <strong className="dashboard-balance-amount">{hidden ? '••••••' : money(connected?.cents ?? ledgerBalanceCents)}</strong>
      <div className="dashboard-balance-source"><span>{connected ? connected.sandbox ? 'Asaas · homologação' : 'Asaas' : 'Receitas e despesas pagas'}</span><Button variant="ghost" size="icon-sm" disabled={loading} title="Atualizar saldo" aria-label="Atualizar saldo" onClick={() => setReload(value => value + 1)}><RefreshCw className={loading ? 'spin-icon' : ''}/></Button></div>
      {error && <small role="status" className="dashboard-balance-error">Saldo bancário indisponível. <span title={error}>Exibindo os lançamentos registrados.</span></small>}
    </div>
    <dl className="dashboard-balance-totals"><div><dt>A receber</dt><dd>{hidden ? '••••' : money(receivable)}</dd></div><div><dt>A pagar</dt><dd>{hidden ? '••••' : money(payable)}</dd></div><div><dt>Previsão de caixa</dt><dd>{hidden ? '••••' : money((connected?.cents ?? ledgerBalanceCents) + receivable - payable)}</dd></div></dl>
    <div className="dashboard-bank-actions">
      <Button variant="outline" onClick={() => onFinanceTab('asaas')}><QrCode /><span>PIX</span></Button>
      <Button variant="outline" onClick={() => onFinanceTab('cobrancas')}><FileText /><span>Cobranças</span></Button>
      <Button variant="outline" onClick={() => onFinanceTab('cobrancas')}><Link /><span>Link de pagamento</span></Button>
      <Button variant="outline" onClick={() => onFinanceTab('bancos')}><List /><span>Extrato</span></Button>
    </div>
  </section>;
}
