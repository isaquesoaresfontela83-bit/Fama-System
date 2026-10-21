'use client';
import { useEffect, useRef, useState } from 'react';
import { Search } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { ClientRequestError, requestJson } from '@/lib/client-request';
import { formatRegistrationDocument, lookupProviders, taxDocumentCode } from '@/lib/registration-lookup';
export function CustomerContactFields({ organizationId, requireDocument = false, initialValues = {} }) {
    const [fields, setFields] = useState(() => ({ clientDocument: formatRegistrationDocument(initialValues.clientDocument || ''), name: initialValues.name || '', phone: initialValues.phone || '', email: initialValues.email || '', address: initialValues.address || '' }));
    const [cep, setCep] = useState('');
    const [loaded, setLoaded] = useState(null), [error, setError] = useState(''), [busy, setBusy] = useState(null);
    const controller = useRef(null), revision = useRef(0), mounted = useRef(true), locked = useRef(false);
    const result = loaded?.organizationId === organizationId ? loaded.result : null;
    useEffect(() => { mounted.current = true; return () => { mounted.current = false; controller.current?.abort(); }; }, [organizationId]);
    function clearLookup() { revision.current++; controller.current?.abort(); setLoaded(null); setError(''); setBusy(null); locked.current = false; }
    function update(key, value) {
        if (key === 'clientDocument')
            clearLookup();
        setFields(current => ({ ...current, [key]: key === 'clientDocument' ? formatRegistrationDocument(value) : value }));
    }
    async function consult(type) {
        if (locked.current)
            return;
        const version = ++revision.current, abort = new AbortController();
        controller.current?.abort();
        controller.current = abort;
        locked.current = true;
        setBusy(type);
        setError('');
        setLoaded(null);
        try {
            const value = await requestJson('/api/registration-lookup', { method: 'POST', headers: { 'Content-Type': 'application/json', 'x-organization-id': organizationId }, body: JSON.stringify({ type, value: type === 'cep' ? cep : fields.clientDocument }), signal: abort.signal }, 25_000);
            if (!abort.signal.aborted && revision.current === version && mounted.current)
                setLoaded({ organizationId, result: value });
        }
        catch (reason) {
            if (!abort.signal.aborted && revision.current === version && mounted.current) {
                if (reason instanceof ClientRequestError && [401, 402, 403].includes(reason.status || 0))
                    setLoaded(null);
                setError(reason instanceof Error ? reason.message : 'Não foi possível consultar.');
            }
        }
        finally {
            if (revision.current === version && mounted.current) {
                setBusy(null);
                locked.current = false;
            }
        }
    }
    function apply() {
        if (!result)
            return;
        setFields(current => result.type === 'cep' ? { ...current, address: result.address } : { ...current, name: result.name || current.name, phone: result.phone || current.phone, email: result.email || current.email, address: result.address || current.address });
        if (result.type === 'cnpj' && result.cep)
            setCep(result.cep);
        setLoaded(null);
    }
    const cnpj = taxDocumentCode(fields.clientDocument), cnpjReady = /^[A-Z0-9]{12}[0-9]{2}$/.test(cnpj);
    return <>
    <div className="form-field span-2"><Label htmlFor="customer-document">{requireDocument ? 'CPF/CNPJ *' : 'CPF/CNPJ'}</Label><div className="registration-lookup-action"><Input id="customer-document" name="clientDocument" value={fields.clientDocument} onChange={event => update('clientDocument', event.target.value)} placeholder="CPF ou CNPJ" maxLength={18} required={requireDocument} autoCapitalize="characters"/><Button type="button" variant="outline" disabled={Boolean(busy) || !cnpjReady} onClick={() => void consult('cnpj')}><Search aria-hidden="true"/>{busy === 'cnpj' ? 'Consultando…' : 'Consultar CNPJ'}</Button></div></div>

    <div className="form-field"><Label htmlFor="customer-name">Nome *</Label><Input id="customer-name" name="name" value={fields.name} onChange={event => update('name', event.target.value)} required maxLength={200}/></div>
    <div className="form-field"><Label htmlFor="customer-phone">Telefone *</Label><Input id="customer-phone" name="phone" value={fields.phone} onChange={event => update('phone', event.target.value)} required maxLength={80} inputMode="tel"/></div>
    <div className="form-field"><Label htmlFor="customer-email">E-mail</Label><Input id="customer-email" name="email" value={fields.email} onChange={event => update('email', event.target.value)} type="email" maxLength={254}/></div>
    <div className="form-field"><Label htmlFor="customer-cep">CEP</Label><div className="registration-lookup-action"><Input id="customer-cep" value={cep} onChange={event => { clearLookup(); setCep(event.target.value.replace(/[^0-9-]/g, '').slice(0, 9)); }} placeholder="00000-000" inputMode="numeric" maxLength={9}/><Button type="button" variant="outline" disabled={Boolean(busy) || !/^[0-9]{8}$/.test(cep.replace(/-/g, ''))} onClick={() => void consult('cep')}><Search aria-hidden="true"/>{busy === 'cep' ? 'Consultando…' : 'Consultar CEP'}</Button></div></div>
    {error && <p className="span-2 registration-lookup-error" role="alert">{error}</p>}
    {result && <div className="span-2 registration-lookup-result" role="status"><strong>{result.type !== 'cep' ? result.name : 'Endereço encontrado'}</strong>{result.tradeName && <p>{result.tradeName}</p>}<p>{result.address}</p>{result.phone && <p>{result.phone}</p>}{result.email && <p>{result.email}</p>}{result.situation && <p>Situação: {result.situation}</p>}<small>Fonte: {lookupProviders.find(provider => provider.id === result.provider)?.label} · Consultado em {new Date(result.consultedAt).toLocaleString('pt-BR', { timeZone: 'America/Sao_Paulo' })}{result.cached ? ' · consulta reutilizada' : ''}</small><Button type="button" variant="outline" onClick={apply}>{result.type === 'cep' ? 'Usar endereço' : 'Usar dados no cadastro'}</Button><small>Confira os dados antes de salvar o cliente.</small></div>}
    <div className="form-field span-2"><Label htmlFor="customer-address">Endereço</Label><Input id="customer-address" name="address" value={fields.address} onChange={event => update('address', event.target.value)} maxLength={600}/><small>Complete o número e o complemento após consultar o CEP.</small></div>
    <p className="span-2 registration-lookup-help">Consulte o CEP para preencher o endereço e o CNPJ para preencher os dados da empresa. Confira os dados antes de salvar.</p>
  </>;
}
