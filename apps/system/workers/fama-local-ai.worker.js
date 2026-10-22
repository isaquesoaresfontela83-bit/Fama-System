import { pipeline, env } from '@huggingface/transformers';
import { isLocalModelDownload, localAiModels, localAiRuntimeStem } from '../lib/fama-ai-local';
import { createLocalAiCache, localAiStorageWarning } from '../lib/fama-ai-storage';
import { installLocalAiFiles } from '../lib/fama-ai-downloads';
import { localAiDevicePolicy, localAiLightModeMessage } from '../lib/fama-ai-device';
// These workers have no app credentials and can download only fixed model assets.
const origin = self.location.origin;
const download = globalThis.fetch.bind(globalThis);
const storage = createLocalAiCache(origin, download);
globalThis.fetch = (input, init) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    const method = init?.method ?? (input instanceof Request ? input.method : 'GET');
    if (!isLocalModelDownload(url, origin, method) || init?.body || (input instanceof Request && input.body))
        return Promise.reject(new Error('Somente downloads de modelos locais são permitidos.'));
    return storage.fetch(new URL(url, origin).href, { method: method.toUpperCase(), credentials: 'omit', referrerPolicy: 'no-referrer', signal: init?.signal });
};
// Transformers 4 captures fetch at module load; use the guarded cache explicitly.
env.fetch = globalThis.fetch;
env.allowLocalModels = false;
env.useBrowserCache = true;
// This app owns the versioned WASM cache and the embedded ONNX factory.
env.useWasmCache = false;
env.useCustomCache = true;
env.customCache = storage.modelCache;
if (env.backends.onnx.wasm) {
    env.backends.onnx.wasm.numThreads = 1;
    env.backends.onnx.wasm.proxy = false;
    env.backends.onnx.wasm.wasmPaths = { wasm: new URL(`/fama-ai-runtime/${localAiRuntimeStem()}.wasm`, origin).href };
}
let generator = null;
let transcriber = null;
const saved = { language: false, speech: false };
let running = false;
const languagePipeline = pipeline;
const speechPipeline = pipeline;
self.onmessage = async (event) => {
    const { id, kind, operation, cacheOnly, restoreRuntime, messages, audio } = event.data;
    if (running) {
        self.postMessage({ id, type: 'error', message: 'Aguarde a tarefa local terminar.' });
        return;
    }
    running = true;
    try {
        const model = localAiModels[kind];
        if (!model || !['install', 'load', 'generate', 'transcribe'].includes(operation))
            throw new Error('Tarefa local inválida.');
        if (!localAiDevicePolicy()[kind]) {
            self.postMessage({ id, type: 'error', message: kind === 'language' ? localAiLightModeMessage : 'Use as consultas por texto neste aparelho. A transcrição local requer mais memória.' });
            return;
        }
        if (operation === 'generate' && (kind !== 'language' || !Array.isArray(messages) || !messages.length || messages.length > 3 || messages.some(message => !message || !['system', 'user'].includes(message.role) || typeof message.content !== 'string') || messages.reduce((total, message) => total + message.content.length, 0) > 6000))
            throw new Error('Pergunta local inválida ou grande demais.');
        if (operation === 'transcribe' && (kind !== 'speech' || !(audio instanceof Float32Array) || audio.length < 1600 || audio.length > 480_000))
            throw new Error('Grave uma frase de até 30 segundos.');
        if (operation === 'install') {
            await installLocalAiFiles(kind, origin, storage, (file, progress) => self.postMessage({ id, type: 'progress', file, progress }));
            saved[kind] = true;
            self.postMessage({ id, type: 'done', saved: true, installed: true });
            return;
        }
        const progress_callback = (progress) => self.postMessage({ id, type: 'progress', progress: Number.isFinite(progress.progress) ? Math.round(progress.progress) : null, file: progress.file?.split('/').at(-1), status: progress.status });
        if ((kind === 'language' && !generator) || (kind === 'speech' && !transcriber)) {
            storage.begin(kind, cacheOnly === true, restoreRuntime === true);
            if (kind === 'language')
                generator = await languagePipeline('text-generation', model.id, { revision: model.revision, device: 'webgpu', dtype: 'q4f16', progress_callback });
            else
                transcriber = await speechPipeline('automatic-speech-recognition', model.id, { revision: model.revision, device: 'wasm', dtype: 'q8', progress_callback });
            saved[kind] = await storage.complete();
        }
        let text = '';
        if (operation === 'generate') {
            if (!generator || !messages)
                throw new Error('Pergunta local inválida.');
            // Apply the chat template directly to disable Qwen's thinking tokens.
            const templateOptions = { tokenize: false, add_generation_prompt: true, enable_thinking: false };
            const prompt = generator.tokenizer.apply_chat_template(messages, templateOptions);
            const output = await generator(prompt, { max_new_tokens: 128, do_sample: false, return_full_text: false, repetition_penalty: 1.12 });
            const first = output[0];
            const result = Array.isArray(first) ? first[0] : first;
            text = typeof result?.generated_text === 'string' ? result.generated_text : '';
        }
        if (operation === 'transcribe') {
            if (kind !== 'speech' || !transcriber || !(audio instanceof Float32Array) || audio.length < 1600 || audio.length > 480_000)
                throw new Error('Grave uma frase de até 30 segundos.');
            const output = await transcriber(audio, { language: 'portuguese', task: 'transcribe', chunk_length_s: 20, stride_length_s: 3 });
            text = (Array.isArray(output) ? output[0]?.text : output.text) ?? '';
        }
        self.postMessage({ id, type: 'done', text: text.trim().slice(0, operation === 'transcribe' ? 2000 : 6000), saved: saved[kind], warning: saved[kind] ? undefined : localAiStorageWarning });
    }
    catch (cause) {
        if (operation === 'install') {
            self.postMessage({ id, type: 'error', message: cause instanceof Error ? cause.message : 'Não foi possível salvar a IA. Confira a conexão e o espaço disponível.' });
            return;
        }
        self.postMessage({ id, type: 'error', message: cacheOnly ? 'Não consegui abrir os arquivos salvos. Abra Voz e inteligência local e tente preparar novamente; os arquivos disponíveis serão reutilizados.' : kind === 'speech' ? 'Não foi possível preparar ou transcrever a voz local. Confira a conexão do download e tente uma frase curta.' : 'O modelo local não conseguiu iniciar ou responder. Confira memória, compatibilidade do dispositivo e o download. As consultas internas continuam disponíveis.' });
    }
    finally {
        running = false;
    }
};
