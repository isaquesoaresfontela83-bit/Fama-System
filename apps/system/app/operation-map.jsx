'use client';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ArrowRight, Clock3, ExternalLink, LocateFixed, MapPin } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { searchDeviceLocation } from '@/lib/device-location';
import { wazeMapUrl, wazeNavigationUrl } from '@/lib/waze';
export function OperationMap({ onOpenAgenda, onOpenOrders, style }) {
    const [position, setPosition] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const [frameError, setFrameError] = useState(false);
    const mounted = useRef(false), revision = useRef(0);
    const stopSearch = useRef(null);
    const locate = useCallback(() => {
        const current = ++revision.current;
        stopSearch.current?.();
        setError('');
        setPosition(null);
        if (!navigator.geolocation) {
            setLoading(false);
            setError('Localização indisponível neste navegador.');
            return;
        }
        setLoading(true);
        stopSearch.current = searchDeviceLocation(navigator.geolocation, {
            onPosition(next) {
                if (!mounted.current || revision.current !== current)
                    return;
                setFrameError(false);
                setPosition(next);
            },
            onComplete() {
                if (mounted.current && revision.current === current)
                    setLoading(false);
            },
            onError(message) {
                if (!mounted.current || revision.current !== current)
                    return;
                setLoading(false);
                setError(message);
            },
        });
    }, []);
    useEffect(() => {
        mounted.current = true;
        locate();
        return () => { mounted.current = false; revision.current++; stopSearch.current?.(); };
    }, [locate]);
    const src = useMemo(() => wazeMapUrl(position, { overview: true }), [position]);
    const external = useMemo(() => { const url = new URL(wazeNavigationUrl(position) || 'https://www.waze.com/live-map'); url.searchParams.delete('navigate'); return url.toString(); }, [position]);
    const coordinates = position ? `${position.latitude.toFixed(5)}, ${position.longitude.toFixed(5)}` : '';
    const ready = position && !loading && !error;
    const approximate = position && (position.accuracy === null || position.accuracy > 100);
    return <section className="surface operation-map-card" style={style}>
    <div className="panel-heading operation-map-heading">
      <div className="operation-map-title"><span className="operation-map-symbol"><MapPin /></span><div><small>WAZE · LOCALIZAÇÃO DO DISPOSITIVO</small><h2>Mapa operacional</h2></div></div>
      <Button type="button" size="sm" variant="outline" className="operation-map-locate" onClick={locate} disabled={loading} aria-label={approximate ? 'Melhorar precisão da localização' : position ? 'Atualizar localização' : 'Obter localização atual'}><LocateFixed className={loading ? 'spin-icon' : undefined}/>{loading ? 'Localizando…' : error ? 'Tentar localização' : approximate ? 'Melhorar precisão' : position ? 'Atualizar' : 'Localizar'}</Button>
    </div>
    <div className="operation-map operation-map-real" data-map-provider="waze">
      <iframe title={position ? approximate ? 'Mapa operacional do Waze na localização aproximada do dispositivo' : 'Mapa operacional do Waze na sua localização atual' : 'Mapa operacional do Waze no Brasil'} src={src} loading="eager" referrerPolicy="no-referrer" onError={() => setFrameError(true)}/>
    </div>
    {frameError && <p className="operation-map-load-error" role="status">Não foi possível carregar o mapa. Você pode abri-lo pelo botão abaixo.</p>}
    <div className="operation-map-details">
      <div className="operation-location-row">
        <div className="operation-location-status" role="status" aria-live="polite"><i className={loading ? 'locating' : ready ? approximate ? 'approximate' : 'located' : ''} aria-hidden="true"/><div><strong>{position ? loading ? 'Refinando localização…' : error ? 'Última localização obtida' : approximate ? 'Localização aproximada' : 'Sua posição atual' : 'Mapa do Brasil'}</strong><small className={position && !error ? 'operation-coordinates' : undefined}>{error || coordinates || (loading ? 'Obtendo uma leitura atual do dispositivo…' : 'Permita a localização para centralizar o mapa.')}</small></div></div>
        {position && <div className="operation-position-meta">{position.accuracy !== null ? <span title="Margem de erro informada pelo dispositivo"><LocateFixed />±{Math.ceil(position.accuracy).toLocaleString('pt-BR')} m</span> : <span>Margem desconhecida</span>}<span title="Horário da última atualização"><Clock3 />{new Date(position.timestamp).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></div>}
      </div>
      {ready && approximate && <p className="operation-accuracy-hint">A posição fornecida pelo aparelho é aproximada. No celular, ative a localização precisa para o navegador e mantenha a localização do aparelho ligada. Depois, toque em Melhorar precisão.</p>}
      <div className="operation-map-actions">
        <small className="operation-map-provider">Mapa e trânsito: Waze</small>
        <div><Button size="sm" variant="outline" asChild><a href={external} target="_blank" rel="noopener noreferrer"><ExternalLink />Abrir no Waze</a></Button>{(onOpenAgenda || onOpenOrders) && <Button size="sm" variant="ghost" onClick={onOpenAgenda || onOpenOrders}>{onOpenAgenda ? 'Agenda' : 'Ordens'}<ArrowRight /></Button>}</div>
      </div>
    </div>
  </section>;
}
