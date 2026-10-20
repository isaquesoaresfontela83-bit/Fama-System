"use client";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "sonner";

export function DocumentScanner({ organizationId, entity, recordId, onSaved }) {
  const [open, setOpen] = useState(false);
  const [token, setToken] = useState("");
  const [pages, setPages] = useState([]);
  const [busy, setBusy] = useState(false);
  const [name, setName] = useState("Documento digitalizado");
  const [connection, setConnection] = useState("");
  const [step, setStep] = useState(1);
  const [system, setSystem] = useState("windows");
  const [error, setError] = useState("");
  const [connected, setConnected] = useState(false);
  useEffect(() => {
    const agent = navigator.userAgent;
    setSystem(/CrOS/.test(agent) ? "chromeos" : /Android|iPhone|iPad/.test(agent) || (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1) ? "mobile" : /Mac/.test(agent) ? "mac" : /Linux/.test(agent) ? "linux" : "windows");
  }, []);
  const limited = system === "chromeos" || system === "mobile";
  function connectionFailure(error) {
    setConnected(false);
    setError(error instanceof TypeError || error?.name === "TimeoutError"
      ? "O Fama ainda não encontrou o programa de conexão. Abra o Fama Scanner neste computador, deixe-o aberto e tente novamente. Se o navegador pedir acesso à rede local, escolha Permitir."
      : error.message);
  }
  async function checkConnection() {
    setBusy(true); setConnection(""); setError("");
    try {
      const response = await fetch("http://127.0.0.1:17843/status", { method: "POST", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(10000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao conectar.");
      if (!result.available) throw new Error("O programa foi encontrado, mas falta preparar a digitalizadora. Volte ao passo 1 e configure o scanner no NAPS2.");
      setConnection("Programa conectado. Agora coloque a folha na digitalizadora.");
      setConnected(true); setStep(3);
    } catch (error) { connectionFailure(error); }
    finally { setBusy(false); }
  }
  async function scan() {
    setBusy(true); setError("");
    try {
      const response = await fetch("http://127.0.0.1:17843/scan", { method: "POST", headers: { Authorization: `Bearer ${token}` }, signal: AbortSignal.timeout(120000) });
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || "Falha ao digitalizar.");
      if (!/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(result.image) || result.image.length > 20 * 1024 * 1024) throw new Error("Imagem inválida recebida do conector.");
      setPages(current => [...current, result.image]);
      toast.success("Página digitalizada. Confira a prévia antes de salvar.");
    } catch (error) { connectionFailure(error); setStep(2); }
    finally { setBusy(false); }
  }
  async function save() {
    setBusy(true); setError("");
    try {
      const { jsPDF } = await import("jspdf");
      const pdf = new jsPDF();
      pages.forEach((image, index) => {
        if (index) pdf.addPage();
        const size = pdf.getImageProperties(image);
        const ratio = Math.min(190 / size.width, 277 / size.height);
        pdf.addImage(image, "JPEG", 10, 10, size.width * ratio, size.height * ratio);
      });
      const blob = pdf.output("blob");
      if (blob.size > 10 * 1024 * 1024) throw new Error("PDF acima de 10 MB. Salve menos páginas por documento.");
      const data = new FormData();
      data.set("entity", entity); data.set("entityId", recordId);
      data.set("file", new File([blob], `${name.trim().replace(/[^\p{L}\p{N} _-]/gu, "").slice(0, 80) || "Documento"}.pdf`, { type: "application/pdf" }));
      const response = await fetch("/api/attachments", { method: "POST", headers: { "x-organization-id": organizationId }, body: data });
      const result = await response.json();
      if (!response.ok || !result.attachment) throw new Error(result.error || "Falha ao salvar PDF.");
      onSaved(result.attachment); setPages([]); setOpen(false); setToken(""); setConnected(false); setStep(1); setConnection(""); toast.success("Digitalização anexada ao registro.");
    } catch (error) { setError(error.message); }
    finally { setBusy(false); }
  }
  return <div className="scanner-flow">
    <Button type="button" variant="outline" onClick={() => setOpen(!open)} disabled={busy}>{open ? "Fechar digitalização" : "Digitalizar documento"}</Button>
    {open && <section className="scanner-panel" aria-label="Digitalização de documentos">
      <div className="scanner-heading"><strong>Do papel para o Fama</strong><p>Use a digitalizadora e guarde o documento neste registro.</p></div>
      <label className="scanner-label">Você está usando
        <select value={system} disabled={busy} onChange={e => { setSystem(e.target.value); setConnected(false); setStep(1); setError(""); }}>
          <option value="windows">Computador Windows</option><option value="mac">Mac</option><option value="linux">Computador Linux</option><option value="chromeos">Chromebook</option><option value="mobile">Celular ou tablet</option>
        </select>
      </label>
      {limited ? <div className="scanner-notice">
        <strong>{system === "chromeos" ? "No Chromebook, use o aplicativo de digitalização" : "A conexão direta precisa de um computador"}</strong>
        <p>{system === "chromeos" ? "Esta conexão do Fama ainda não aciona o scanner diretamente no Chromebook. Você pode digitalizar pelo próprio ChromeOS e anexar o PDF aqui." : "Esta versão conecta a digitalizadora pelo Windows, Mac ou Linux. No celular, você pode anexar um PDF já digitalizado."}</p>
        {system === "chromeos" && <ol><li>Conecte e ligue a digitalizadora.</li><li>Abra as Configurações do Chromebook e procure por “Digitalizar”.</li><li>Se o equipamento aparecer, digitalize e salve em PDF.</li><li>Volte aqui e use “Escolher arquivo” e “Anexar”, logo abaixo.</li></ol>}
        <small>Se o equipamento não aparecer, será necessário um computador com driver compatível.</small>
      </div> : <>
        <ol className="scanner-steps" aria-label="Etapas">{["Preparar", "Conectar", "Digitalizar"].map((label, index) => <li key={label} aria-current={step === index + 1 ? "step" : undefined}><span>{index + 1}</span>{label}</li>)}</ol>
        {step === 1 && <div className="scanner-stage">
          <h3>Prepare o computador uma vez</h3>
          <p>O Fama precisa de um pequeno programa aberto neste computador para conversar com sua digitalizadora.</p>
          <ol><li>Ligue a digitalizadora e conecte-a ao computador.</li><li>Baixe o Fama Scanner e abra o programa seguindo as instruções do seu computador.</li><li>Quando aparecer um código de conexão, avance para o próximo passo.</li></ol>
          <Button asChild variant="outline"><a href="/downloads/fama-scanner.py" download>Baixar Fama Scanner</a></Button>
          <details><summary>Como abrir o programa pela primeira vez</summary>
            <p>Este download ainda é um programa em Python, não um instalador automático. Você pode precisar de ajuda para preparar o computador uma única vez.</p>
            <ol><li>Instale <a href="https://www.python.org/downloads/" target="_blank" rel="noreferrer">Python 3</a>.</li>
            <li>{system === "windows" ? "Se o scanner já funciona no Windows, experimente sem instalar outro programa. Caso não funcione, instale o " : "Instale o programa de digitalização: "}<a href="https://www.naps2.com/download" target="_blank" rel="noreferrer">NAPS2</a>. Nele, escolha sua digitalizadora, crie um perfil chamado <strong>Fama</strong> e faça uma digitalização de teste.</li>
            <li>Abra a pasta onde baixou o Fama Scanner e execute <code>{system === "windows" ? "python fama-scanner.py" : "python3 fama-scanner.py"}</code> no terminal. Deixe a janela aberta.</li></ol>
          </details>
          <Button type="button" onClick={() => { setStep(2); setError(""); }}>Já abri o programa →</Button>
        </div>}
        {step === 2 && <div className="scanner-stage">
          <h3>Conecte ao Fama</h3><p>Copie o código que aparece na janela do Fama Scanner e cole abaixo. Esse código não é a senha da sua conta.</p>
          <label className="scanner-label">Código de conexão<Input type="password" value={token} onChange={e => { setToken(e.target.value.trim()); setConnected(false); setError(""); }} placeholder="Cole o código aqui" autoComplete="off"/></label>
          <Button type="button" onClick={checkConnection} disabled={busy || !token}>{busy ? "Procurando o programa…" : "Conectar digitalizadora"}</Button>
          <button type="button" className="scanner-back" disabled={busy} onClick={() => { setStep(1); setError(""); }}>← Voltar às instruções</button>
        </div>}
        {step === 3 && <div className="scanner-stage">
          <p className="scanner-connected" role="status">{connection}</p>
          <h3>{pages.length ? "Quer adicionar outra folha?" : "Coloque a folha na digitalizadora"}</h3>
          <p>Posicione o documento no vidro, feche a tampa e clique abaixo. Confira se o texto ficou legível antes de salvar.</p>
          <Button type="button" onClick={scan} disabled={busy || !connected || pages.length >= 20}>{busy ? "Aguarde…" : pages.length ? "Digitalizar outra folha" : "Digitalizar agora"}</Button>
          <button type="button" className="scanner-back" disabled={busy} onClick={() => { setStep(2); setConnected(false); }}>Trocar conexão</button>
        </div>}
      </>}
      {error && <div className="scanner-error" role="alert"><strong>Não foi possível continuar</strong><p>{error}</p></div>}
      {!!pages.length && <div className="scanner-stage">
        <h3>Confira seu documento · {pages.length} folha(s)</h3>
        <div className="scanner-pages">{pages.map((image, index) => <div key={index}><img src={image} alt={`Prévia da página ${index + 1}`}/><Button type="button" variant="outline" disabled={busy} onClick={() => setPages(current => current.filter((_, i) => i !== index))}>Remover folha {index + 1}</Button></div>)}</div>
        <label className="scanner-label">Nome do documento<Input value={name} onChange={e => setName(e.target.value)}/></label>
        <Button type="button" disabled={busy} onClick={save}>{busy ? "Aguarde…" : "Salvar documento neste registro"}</Button>
        <small>As folhas serão reunidas em um PDF. Limite: 20 folhas e 10 MB. As páginas ainda não salvas são perdidas ao fechar este registro.</small>
      </div>}
    </section>}
  </div>;
}
