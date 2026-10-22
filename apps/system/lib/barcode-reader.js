export const inventoryBarcodeOptions = {
    tryHarder: true, tryRotate: true, tryInvert: true, tryDownscale: true,
    maxNumberOfSymbols: 1, returnErrors: false,
};
let engine;
export async function barcodeEngine() {
    if (!engine)
        engine = import("zxing-wasm/reader").then(async (module) => {
            await module.prepareZXingModule({ overrides: { locateFile: () => "/barcode-runtime/zxing-reader-3.0.1.wasm" }, fireImmediately: true });
            return module;
        }).catch(error => { engine = undefined; throw error; });
    return engine;
}
export async function readInventoryBarcode(image) {
    const barcodeModule = await barcodeEngine();
    const results = await barcodeModule.readBarcodes(image, inventoryBarcodeOptions);
    return results.find(result => result.isValid && result.text.trim())?.text.trim() ?? "";
}
