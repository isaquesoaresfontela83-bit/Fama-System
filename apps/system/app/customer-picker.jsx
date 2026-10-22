'use client';
import { useEffect,useId,useState } from 'react';
import { Input } from '@/components/ui/input';
import { NativeSelect,NativeSelectOption } from '@/components/ui/native-select';
import { recordNotes } from '@/lib/record-edit-fields';
import { normalizeSearch } from '@/lib/workspace-insights';
import { requestJson } from '@/lib/client-request';
export function CustomerPicker({customers:fullCustomers=[],organizationId,initialId='',initialName='',onSelect}) {
    const id=useId(),[query,setQuery]=useState(''),[selectedId,setSelectedId]=useState(initialId);
    const [optionsData,setOptionsData]=useState([]),[error,setError]=useState(''),[loading,setLoading]=useState(false);
    useEffect(()=>{
        if(fullCustomers.length || !organizationId)return;
        const abort=new AbortController();setLoading(true);setError('');setOptionsData([]);
        requestJson('/api/customers/options',{headers:{'x-organization-id':organizationId},signal:abort.signal,cache:'no-store'}).then(value=>{if(!abort.signal.aborted)setOptionsData(value.customers || []);}).catch(cause=>{if(!abort.signal.aborted)setError(cause.message);}).finally(()=>{if(!abort.signal.aborted)setLoading(false);});
        return()=>abort.abort();
    },[organizationId,fullCustomers.length]);
    const customers=fullCustomers.length ? fullCustomers : optionsData,selected=customers.find(customer=>customer.id===selectedId),legacy=!initialId && Boolean(initialName);
    const digits=query.replace(/\D/g,'');
    const options=customers.filter(customer=>customer.id===selectedId || normalizeSearch([customer.name,customer.phone,customer.email,customer.address].join(' ')).includes(normalizeSearch(query)) || (digits.length>=3 && String(customer.phone || '').replace(/\D/g,'').includes(digits)));
    return <div className="customer-picker span-2"><label htmlFor={id+'-search'}>Buscar cliente cadastrado</label><Input id={id+'-search'} type="search" value={query} placeholder="Nome, telefone ou endereço…" onChange={event=>setQuery(event.target.value)}/><label htmlFor={id}>Cliente *</label><NativeSelect id={id} name="customerId" required={!legacy} disabled={loading} value={selectedId} onChange={event=>{const value=event.target.value;setSelectedId(value);onSelect?.(customers.find(customer=>customer.id===value) || null);}}><NativeSelectOption value="">{legacy?`${initialName} · registro anterior`:'Selecione um cliente'}</NativeSelectOption>{options.map(customer=><NativeSelectOption key={customer.id} value={customer.id}>{customer.name}{customer.phone?` · ${customer.phone}`:''}{customer.address?` · ${customer.address}`:''}</NativeSelectOption>)}</NativeSelect><input type="hidden" name="clientName" value={selected?.name || (legacy?initialName:'')}/>{selected && <div className="customer-picker-summary"><strong>{selected.name}</strong><span>{[selected.phone,selected.email].filter(Boolean).join(' · ') || 'Contato não informado'}</span><span>{selected.address || 'Endereço não informado'}</span><span>{selected.poolType || 'Piscina'}{selected.poolVolume?` · ${selected.poolVolume.toLocaleString('pt-BR')} litros`:''}</span></div>}{error && <p role="alert">{error}</p>}{loading && <p role="status">Carregando clientes…</p>}{!loading&&!error&&!customers.length&&<p>Cadastre o cliente na aba Clientes para selecioná-lo aqui.</p>}{query&&!options.length&&<p>Nenhum cliente encontrado.</p>}</div>;
}
export function CustomerProfile({customer,history}) {
    const [tab,setTab]=useState('general'),details=recordNotes(customer.notes);
    const entries=tab==='contact'?[['Telefone',customer.phone],['E-mail',customer.email],['Endereço',customer.address],['Responsável',details.details.responsible]]:tab==='pool'?[['Tipo',customer.poolType],['Formato',details.details.poolShape],['Volume',customer.poolVolume?`${customer.poolVolume.toLocaleString('pt-BR')} litros`:''],['Comprimento',details.details.poolLength],['Largura',details.details.poolWidth],['Profundidade',details.details.poolDepth],['Filtro',details.details.filterType],['Bomba',details.details.pump],['Frequência',details.details.frequency],['Histórico de problemas',details.details.problemHistory]]:[['Nome',customer.name],['CPF/CNPJ',details.details.clientDocument],['Situação',customer.status],['Plano / serviço',customer.plan],['Dia de cobrança',details.details.billingDay],['Observações',details.text]];
    return <section className="customer-profile" aria-label="Perfil do cliente"><nav aria-label="Dados do cliente">{[['general','Geral'],['contact','Contato'],['pool','Piscina'],['history','Histórico']].map(([key,label])=><button key={key} type="button" aria-pressed={tab===key} onClick={()=>setTab(key)}>{label}</button>)}</nav>{tab==='history'?history:<dl>{entries.map(([label,value])=><div key={label}><dt>{label}</dt><dd>{value || 'Não informado'}</dd></div>)}</dl>}</section>;
}
