"use client";
import { useEffect, useRef, useState } from "react";
import { ScanLine, Camera, ImagePlus, Flashlight, Focus, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { barcodeEngine, readInventoryBarcode } from "@/lib/barcode-reader";
/** One reading per session; native detection and ZXing share the same camera. */
export function InventoryCamera({ onRead, onClose }) {
    const photoInput = useRef(null);
    const video = useRef(null);
    const acceptRef = useRef(null);
    const photoBusy = useRef(false);
    const [readingPhoto, setReadingPhoto] = useState(false);
    const trackRef = useRef(null);
    const [error, setError] = useState("");
    const [notice, setNotice] = useState("");
    const [ready, setReady] = useState(false);
    const [devices, setDevices] = useState([]);
    const [deviceId, setDeviceId] = useState(() => {
        try {
            return typeof window !== "undefined" ? window.localStorage?.getItem("fama-inventory-camera") ?? "" : "";
        }
        catch {
            return "";
        }
    });
    const [retry, setRetry] = useState(0);
    const [torchAvailable, setTorchAvailable] = useState(false);
    const [torch, setTorch] = useState(false);
    const [zoomRange, setZoomRange] = useState(null);
    const [zoom, setZoom] = useState(1);
    const [adjusting, setAdjusting] = useState(false);
    useEffect(() => {
        let disposed = false;
        let accepted = false;
        let stream;
        let timer;
        setError("");
        setNotice("");
        setReady(false);
        setTorchAvailable(false);
        setTorch(false);
        setZoomRange(null);
        function stop() {
            if (timer)
                clearTimeout(timer);
            stream?.getTracks().forEach(track => track.stop());
            if (trackRef.current && stream?.getTracks().includes(trackRef.current))
                trackRef.current = null;
        }
        function receive(raw) {
            const code = raw.trim();
            if (!code || disposed || accepted)
                return;
            accepted = true;
            stop();
            onRead(code);
        }
        acceptRef.current = receive;
        async function start() {
            try {
                if (!navigator.mediaDevices?.getUserMedia)
                    throw new Error("unsupported");
                const camera = deviceId ? { deviceId: { exact: deviceId } } : { facingMode: { ideal: "environment" } };
                try {
                    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: { ...camera, width: { ideal: 1920 }, height: { ideal: 1080 } } });
                }
                catch (cause) {
                    if (disposed)
                        return;
                    if (!(cause instanceof Error) || !["OverconstrainedError", "ConstraintNotSatisfiedError"].includes(cause.name))
                        throw cause;
                    if (deviceId) {
                        try {
                            window.localStorage.removeItem("fama-inventory-camera");
                        }
                        catch { /* Optional preference. */ }
                        setDeviceId("");
                        return;
                    }
                    stream = await navigator.mediaDevices.getUserMedia({ audio: false, video: camera });
                }
                if (disposed) {
                    stop();
                    return;
                }
                const track = stream.getVideoTracks()[0];
                trackRef.current = track;
                const caps = (track.getCapabilities?.() ?? {});
                if (caps.focusMode?.includes("continuous")) {
                    try {
                        await track.applyConstraints({ advanced: [{ focusMode: "continuous" }] });
                    }
                    catch { /* Optional camera capability. */ }
                }
                if (disposed) {
                    stop();
                    return;
                }
                setTorchAvailable(!!caps.torch);
                if (caps.zoom && caps.zoom.max > caps.zoom.min) {
                    const initialZoom = Math.min(caps.zoom.max, Math.max(caps.zoom.min, 1));
                    try {
                        await track.applyConstraints({ advanced: [{ zoom: initialZoom }] });
                    }
                    catch { /* Show the actual zoom if reset is unsupported. */ }
                    if (disposed) {
                        stop();
                        return;
                    }
                    setZoomRange({ ...caps.zoom, step: caps.zoom.step || 0.1 });
                    setZoom(track.getSettings().zoom ?? initialZoom);
                }
                try {
                    const cameras = (await navigator.mediaDevices.enumerateDevices()).filter(device => device.kind === "videoinput");
                    if (!disposed)
                        setDevices(cameras);
                }
                catch { /* Camera remains usable without the device list. */ }
                if (disposed) {
                    stop();
                    return;
                }
                const preview = video.current;
                preview.srcObject = stream;
                await preview.play();
                const [{ BrowserMultiFormatReader }, { DecodeHintType }] = await Promise.all([import("@zxing/browser"), import("@zxing/library")]);
                if (disposed) {
                    stop();
                    return;
                }
                let wasmReady = false;
                try {
                    await barcodeEngine();
                    wasmReady = true;
                }
                catch {
                    setNotice("Leitor alternativo ativo. Se não reconhecer, tente ler por foto.");
                }
                if (disposed) {
                    stop();
                    return;
                }
                const reader = new BrowserMultiFormatReader(new Map([[DecodeHintType.TRY_HARDER, true]]));
                let native;
                const DetectorApi = window.BarcodeDetector;
                if (DetectorApi) {
                    try {
                        const formats = await DetectorApi.getSupportedFormats();
                        if (formats.length)
                            native = new DetectorApi({ formats });
                    }
                    catch { /* ZXing works independently of the native detector. */ }
                }
                if (disposed) {
                    stop();
                    return;
                }
                setReady(true);
                const frame = document.createElement("canvas");
                let attempt = 0;
                async function scan() {
                    if (disposed || accepted)
                        return;
                    // Do not scan stale or hidden camera frames.
                    if (photoBusy.current || document.visibilityState === "hidden" || preview.readyState < 2 || !preview.videoWidth) {
                        timer = setTimeout(() => void scan(), 250);
                        return;
                    }
                    let found = "";
                    if (native) {
                        try {
                            found = (await native.detect(preview))[0]?.rawValue ?? "";
                        }
                        catch {
                            native = undefined;
                        }
                    }
                    if (disposed || accepted)
                        return;
                    if (!found) {
                        // Alternate the whole frame, central crop, and inverted image.
                        // Cropping keeps narrow product labels readable without digital zoom.
                        const crop = attempt % 3 === 1;
                        const sx = crop ? preview.videoWidth * 0.15 : 0;
                        const sy = crop ? preview.videoHeight * 0.25 : 0;
                        const width = crop ? preview.videoWidth * 0.7 : preview.videoWidth;
                        const height = crop ? preview.videoHeight * 0.5 : preview.videoHeight;
                        frame.width = Math.min(1920, width);
                        frame.height = Math.round(height * frame.width / width);
                        const context = frame.getContext("2d", { willReadFrequently: true });
                        if (context) {
                            context.filter = attempt % 3 === 2 ? "invert(1)" : "none";
                            context.drawImage(preview, sx, sy, width, height, 0, 0, frame.width, frame.height);
                            if (wasmReady) {
                                try {
                                    found = await readInventoryBarcode(context.getImageData(0, 0, frame.width, frame.height));
                                }
                                catch {
                                    wasmReady = false;
                                    if (!disposed)
                                        setNotice("Leitor alternativo ativo. Você também pode ler por foto.");
                                }
                            }
                            if (!found)
                                try {
                                    found = reader.decodeFromCanvas(frame).getText();
                                }
                                catch { /* No code in this frame. */ }
                        }
                    }
                    attempt++;
                    if (found)
                        receive(found);
                    if (!disposed && !accepted)
                        timer = setTimeout(() => void scan(), 100);
                }
                void scan();
            }
            catch (cause) {
                stop();
                if (disposed)
                    return;
                setReady(false);
                const name = cause instanceof Error ? cause.name : "";
                setError(name === "NotAllowedError" ? "Permita o acesso à câmera nas configurações do navegador e tente novamente." : name === "NotFoundError" ? "Nenhuma câmera encontrada neste aparelho." : name === "NotReadableError" ? "A câmera está em uso. Feche outros aplicativos e tente novamente." : "Não foi possível abrir a câmera. Use HTTPS e confira a permissão de câmera do navegador.");
            }
        }
        void start();
        return () => { disposed = true; if (acceptRef.current === receive)
            acceptRef.current = null; stop(); };
    }, [onRead, deviceId, retry]);
    async function readPhoto(file) {
        if (!file || photoBusy.current)
            return;
        const accept = acceptRef.current;
        photoBusy.current = true;
        setReadingPhoto(true);
        setNotice("");
        try {
            const code = await readInventoryBarcode(file);
            if (acceptRef.current !== accept)
                return;
            if (code)
                accept?.(code);
            else
                setNotice("Não encontrei um código na foto. Fotografe a etiqueta inteira, com as barras nítidas e sem reflexos.");
        }
        catch {
            if (acceptRef.current === accept)
                setNotice("Não foi possível analisar a foto. Tente uma imagem JPG ou PNG nítida.");
        }
        finally {
            photoBusy.current = false;
            if (acceptRef.current === accept)
                setReadingPhoto(false);
        }
    }
    async function adjustCamera(value) {
        const track = trackRef.current;
        if (!track || adjusting)
            return;
        setAdjusting(true);
        try {
            await track.applyConstraints({ advanced: [value] });
            if (trackRef.current !== track)
                return;
            if ("torch" in value)
                setTorch(value.torch);
            else
                setZoom(value.zoom);
            setNotice("");
        }
        catch {
            if (trackRef.current === track)
                setNotice("Este aparelho não conseguiu aplicar o ajuste. Tente outra câmera.");
        }
        finally {
            setAdjusting(false);
        }
    }
    return <div className="inventory-camera" role="region" aria-label="Leitor de código de barras pela câmera">
    <div className="inventory-reader-heading"><span className="inventory-reader-icon"><ScanLine /></span><div><small>FAMA · LEITOR</small><strong>Enquadre o código</strong></div><Button type="button" variant="ghost" className="inventory-reader-close" aria-label="Fechar câmera" onClick={onClose}><X /></Button></div>
    <div className="inventory-camera-preview" hidden={!!error}><video ref={video} autoPlay muted playsInline aria-label="Imagem da câmera"/><div className="inventory-camera-guide" aria-hidden="true"><i /><i /><i /><i /><span /></div><span className="inventory-live-badge"><i />{ready ? "Câmera ativa" : "Conectando"}</span><span className="inventory-frame-hint"><ScanLine />Mantenha todas as barras visíveis</span></div>
    {error ? <><p role="alert">{error}</p><Button type="button" variant="outline" onClick={() => setRetry(value => value + 1)}>Tentar novamente</Button></> : <>
      <p className="inventory-reader-guidance" role="status"><Focus />{ready ? "Posicione o código inteiro dentro da área, sem reflexos. Afaste um pouco o celular se a imagem estiver desfocada." : "Preparando a câmera e o leitor…"}</p>
    </>}
    <div className="inventory-reader-controls">
    {devices.length > 1 && <label className="inventory-camera-control"><span><Camera />Câmera</span><select aria-label="Escolher câmera" value={deviceId} onChange={event => {
                const selected = event.target.value;
                try {
                    if (selected)
                        window.localStorage.setItem("fama-inventory-camera", selected);
                    else
                        window.localStorage.removeItem("fama-inventory-camera");
                }
                catch { /* Camera works without saved preferences. */ }
                setDeviceId(selected);
            }}><option value="">Traseira automática</option>{devices.map((device, index) => <option key={device.deviceId} value={device.deviceId}>{device.label || `Câmera ${index + 1}`}</option>)}</select></label>}
    {ready && torchAvailable && <Button type="button" variant="outline" className="inventory-torch-button" disabled={adjusting} aria-pressed={torch} onClick={() => void adjustCamera({ torch: !torch })}><Flashlight />{torch ? "Desligar lanterna" : "Ligar lanterna"}</Button>}
    {ready && zoomRange && <label className="inventory-camera-control inventory-zoom-control"><span><Focus />Aproximação<b>{zoom.toFixed(1)}×</b></span>{zoom > 3 && <small>Zoom alto pode reduzir a nitidez. Prefira aproximar a etiqueta com a imagem focada.</small>}<input aria-label="Zoom da câmera" type="range" min={zoomRange.min} max={zoomRange.max} step={zoomRange.step} value={zoom} disabled={adjusting} onChange={event => void adjustCamera({ zoom: Number(event.target.value) })}/></label>}
    </div>
    <div className="inventory-photo-option"><span>Outra forma de ler</span><Button type="button" variant="outline" disabled={readingPhoto} onClick={() => photoInput.current?.click()}><ImagePlus /><span><strong>Ler uma foto</strong><small>Tire uma foto ou escolha uma imagem</small></span></Button>
      <input ref={photoInput} className="sr-only" aria-label="Ler código de uma foto" type="file" accept="image/*" capture="environment" disabled={readingPhoto} onChange={event => { const file = event.target.files?.[0]; event.target.value = ""; void readPhoto(file); }}/>
    </div>
    {readingPhoto && <p role="status">Analisando o código da foto…</p>}
    {notice && <p role="status">{notice}</p>}
    <small className="inventory-reader-privacy">A imagem é analisada no seu aparelho.</small>
  </div>;
}
