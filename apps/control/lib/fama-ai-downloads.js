import { localAiModels, localAiRuntimeStem } from './fama-ai-local';
import { localAiStorageWarning, releaseLocalAiResponse } from './fama-ai-storage';
/** Stream public files to storage; do not allocate an inference model at startup. */
export async function installLocalAiFiles(kind, origin, storage, progress) {
    const model = localAiModels[kind];
    const prefix = `https://huggingface.co/${model.id}/resolve/${model.revision}/`;
    storage.begin(kind);
    await storage.checkWritable();
    const get = async (file, optional = false) => {
        const response = await storage.installFile(prefix + file, percent => progress(file.split('/').at(-1), percent));
        if (response.status !== 200 && !optional)
            throw new Error('Não foi possível concluir o download. Verifique a conexão e tente novamente.');
        if (file !== 'config.json')
            releaseLocalAiResponse(response);
        return response;
    };
    const config = await (await get('config.json')).json();
    for (const file of ['tokenizer.json', 'tokenizer_config.json'])
        await get(file);
    if (kind === 'speech')
        await get('preprocessor_config.json');
    await get('generation_config.json', true);
    const names = kind === 'language' ? ['model_q4f16.onnx'] : ['encoder_model_quantized.onnx', 'decoder_model_merged_quantized.onnx'];
    const custom = (config['transformers.js_config'] ?? {});
    const external = custom.device_config?.[kind === 'language' ? 'webgpu' : 'wasm']?.use_external_data_format ?? custom.use_external_data_format;
    for (const name of names) {
        await get(`onnx/${name}`);
        const base = name.replace(/_(q4f16|quantized)\.onnx$/, '');
        const count = Number(typeof external === 'object' ? external[name] ?? external[base] ?? 0 : external ?? 0);
        if (!Number.isInteger(count) || count < 0 || count > 32)
            throw new Error('Configuração do modelo inválida.');
        for (let index = 0; index < count; index++)
            await get(`onnx/${name}_data${index ? `_${index}` : ''}`);
    }
    const stem = localAiRuntimeStem();
    for (const extension of ['mjs', 'wasm'])
        releaseLocalAiResponse(await storage.installFile(`${origin}/fama-ai-runtime/${stem}.${extension}`, percent => progress(`${stem}.${extension}`, percent)));
    if (!await storage.complete())
        throw new Error(localAiStorageWarning);
}
