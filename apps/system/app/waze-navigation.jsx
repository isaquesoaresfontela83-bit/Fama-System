'use client';
import { useState } from 'react';
import { ExternalLink, Navigation } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { wazeMapUrl, wazeNavigationUrl } from '@/lib/waze';

export function WazeLink({ destination, compact = false, className = '' }) {
    const href = wazeNavigationUrl(destination);
    if (!href)
        return null;
    return <Button variant="outline" size="sm" asChild><a className={`waze-link ${className}`} href={href} target="_blank" rel="noopener noreferrer" aria-label="Abrir navegação no Waze"><Navigation aria-hidden="true"/>{compact ? 'Waze' : 'Ir com Waze'}</a></Button>;
}

export function WazeNavigation({ point, address, label }) {
    const [opened, setOpened] = useState(false), [failedUrl, setFailedUrl] = useState('');
    const mapUrl = wazeMapUrl(point);
    const destination = { ...point, address: address || point?.address };
    const canNavigate = Boolean(wazeNavigationUrl(destination));
    return <section id="planning-waze" className="ops-panel waze-panel planning-anchor">
      <header className="ops-panel-heading"><h2><Navigation />Waze · trânsito e navegação</h2><WazeLink destination={destination}/></header>
      <div className="waze-destination"><strong>{label || (point ? 'Local selecionado' : 'Escolha um destino')}</strong><p>{address || point?.address || 'Selecione um atendimento, localize um CEP ou confirme um ponto no mapa acima.'}</p>
      {point?.source === 'cep' && <small>O CEP mostra uma região aproximada. Para navegar, confira o endereço no Waze ou confirme a entrada em Ajustar ponto.</small>}
      <div className="waze-actions">{mapUrl && <Button type="button" variant="outline" size="sm" aria-expanded={opened} aria-controls="planning-waze-map" onClick={() => setOpened(value => !value)}>{opened ? 'Ocultar mapa do Waze' : 'Ver trânsito no Waze'}</Button>}{!canNavigate && <small>Adicione um endereço ou selecione uma localização para abrir a navegação.</small>}</div></div>
      {opened && mapUrl && <div id="planning-waze-map" className="waze-map"><iframe key={mapUrl} title="Mapa oficial do Waze com trânsito no local selecionado" src={mapUrl} loading="lazy" referrerPolicy="no-referrer" onError={() => setFailedUrl(mapUrl)}/>{failedUrl === mapUrl && <p role="status">Não foi possível carregar o mapa. Use Ir com Waze para abrir a navegação.</p>}{canNavigate && <a href={wazeNavigationUrl(destination)} target="_blank" rel="noopener noreferrer"><ExternalLink aria-hidden="true"/>Abrir no Waze</a>}</div>}
      <p className="waze-note">No celular, Ir com Waze abre o aplicativo quando instalado. O trânsito e as rotas são consultados no próprio Waze.</p>
    </section>;
}
