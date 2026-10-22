"use client";
import { useCallback, useState } from "react";
import { ScanLine, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { InventoryCamera } from "./inventory-camera";
export function InventoryBarcodeField({ initialValue = "" }) {
    const [code, setCode] = useState(initialValue);
    const [cameraOpen, setCameraOpen] = useState(false);
    const [scanned, setScanned] = useState(false);
    const acceptScan = useCallback((value) => {
        setCode(value);
        setScanned(true);
        setCameraOpen(false);
    }, []);
    return <div className="form-field span-2 stock-barcode-field">
    <Label htmlFor="sku">SKU / código de barras</Label>
    <div className="stock-barcode-input"><ScanLine /><Input id="sku" name="sku" value={code} onChange={event => { setCode(event.target.value); setScanned(false); }} placeholder="Escaneie ou digite o código do produto" autoComplete="off"/></div>
    <Button type="button" variant="outline" className="stock-register-scan" disabled={cameraOpen} onClick={() => setCameraOpen(true)}><ScanLine />Escanear código com a câmera</Button>
    {cameraOpen && <InventoryCamera onRead={acceptScan} onClose={() => setCameraOpen(false)}/>}
    {scanned && <small className="stock-code-success" role="status"><CheckCircle2 />Código preenchido. Complete os dados e salve o item.</small>}
  </div>;
}
