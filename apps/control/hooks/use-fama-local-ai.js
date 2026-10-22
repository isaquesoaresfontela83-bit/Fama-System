'use client';
import { createContext, createElement, useContext, useCallback, useEffect, useRef, useState } from 'react';
import { cleanLocalNarrative, localAssistantMessages } from '@/lib/fama-ai-local';
import { inspectLocalAiInstallation, protectLocalAiStorage, readLocalAiAutomatic, readLocalAiEnabled, writeLocalAiAutomatic, writeLocalAiEnabled } from '@/lib/fama-ai-storage';
import { localAiDevicePolicy, localAiLightModeMessage } from '@/lib/fama-ai-device';
const LocalAiContext = createContext(null);
export function FamaLocalAiProvider({ children, prepareOnOpen = true }) {
    const local = useFamaLocalAiRuntime(true, prepareOnOpen);
    return createElement(LocalAiContext.Provider, { value: local }, children);
}
export function useFamaLocalAi() {
    const shared = useContext(LocalAiContext);
    const fallback = useFamaLocalAiRuntime(shared === null, false);
    return shared ?? fallback;
}
function useFamaLocalAiRuntime(runtimeActive, prepareOnOpen) {
    const [models, setModels] = useState({ language: { status: 'idle' }, speech: { status: 'idle' } });
    const modelsRef = useRef(models);
    const [enabled, setEnabledState] = useState(false);
    const [automatic, setAutomaticState] = useState(true);
    const [preparingAutomatic, setPreparingAutomatic] = useState(false);
    const autoRunning = useRef(false);
    const autoEpoch = useRef(0);
    const protectionRequested = useRef(false);
    const [generating, setGenerating] = useState(false);
    const [voice, setVoice] = useState('idle');
    const voiceRef = useRef(voice);
    voiceRef.current = voice;
    const [seconds, setSeconds] = useState(0);
    const [error, setError] = useState('');
    const [speaking, setSpeaking] = useState(false);
    const [localVoiceAvailable, setLocalVoiceAvailable] = useState(false);
    const runtimes = useRef({});
    const nextId = useRef(0);
    const mounted = useRef(true);
    const epoch = useRef({ language: 0, speech: 0 });
    const loading = useRef({ language: false, speech: false });
    const recorder = useRef(null);
    const stream = useRef(null);
    const recordTimer = useRef(null);
    const recordingSince = useRef(0);
    const setModel = useCallback((kind, patch) => {
        if (mounted.current) {
            modelsRef.current = { ...modelsRef.current, [kind]: { ...modelsRef.current[kind], ...patch } };
            setModels(current => ({ ...current, [kind]: { ...current[kind], ...patch } }));
        }
    }, []);
    const setEnabled = useCallback((value) => { const allowed = value && localAiDevicePolicy().language; writeLocalAiEnabled(allowed); if (mounted.current)
        setEnabledState(allowed); }, []);
    const terminate = useCallback((kind) => {
        autoEpoch.current++;
        epoch.current[kind]++;
        loading.current[kind] = false;
        const runtime = runtimes.current[kind];
        if (runtime) {
            clearTimeout(runtime.idleTimer);
            for (const task of runtime.pending.values()) {
                clearTimeout(task.timer);
                task.reject(new Error('Tarefa cancelada.'));
            }
            runtime.pending.clear();
            runtime.worker.terminate();
            delete runtimes.current[kind];
        }
        setModel(kind, { status: modelsRef.current[kind].saved ? 'saved' : 'idle', restoring: false, progress: undefined, file: undefined, error: undefined });
        if (mounted.current) {
            if (kind === 'language')
                setGenerating(false);
            else
                setVoice('idle');
        }
    }, [setModel]);
    const task = useCallback((kind, operation, payload = {}, transfer = []) => {
        let runtime = runtimes.current[kind];
        if (!runtime) {
            const worker = new Worker(new URL('../workers/fama-local-ai.worker.js', import.meta.url), { type: 'module' });
            runtime = { worker, pending: new Map() };
            runtimes.current[kind] = runtime;
            const instance = runtime;
            worker.onmessage = (event) => {
                const result = event.data;
                const pending = instance.pending.get(result.id);
                if (!pending || runtimes.current[kind] !== instance)
                    return;
                if (result.type === 'progress') {
                    setModel(kind, { progress: result.progress ?? undefined, file: result.file });
                    return;
                }
                clearTimeout(pending.timer);
                instance.pending.delete(result.id);
                if (result.type === 'done') {
                    const release = pending.operation === 'install' || kind === 'speech' && pending.operation === 'transcribe' && localAiDevicePolicy().mobile;
                    setModel(kind, { status: release ? result.saved ? 'saved' : 'idle' : 'ready', saved: result.saved === true, legacy: false, partial: false, restoring: false, warning: result.warning, progress: 100, error: undefined });
                    if (release) {
                        worker.terminate();
                        delete runtimes.current[kind];
                    }
                    else if (!instance.pending.size) {
                        const releaseWhenIdle = () => {
                            instance.idleTimer = setTimeout(() => {
                                if (runtimes.current[kind] !== instance || instance.pending.size)
                                    return;
                                if (kind === 'speech' && voiceRef.current !== 'idle') {
                                    releaseWhenIdle();
                                    return;
                                }
                                terminate(kind);
                            }, 30_000);
                        };
                        releaseWhenIdle();
                    }
                    pending.resolve(result.text ?? '');
                }
                else {
                    const message = result.message || 'O dispositivo não concluiu a tarefa.';
                    if (!instance.pending.size) {
                        clearTimeout(instance.idleTimer);
                        worker.terminate();
                        delete runtimes.current[kind];
                    }
                    setModel(kind, { status: 'error', error: message });
                    pending.reject(new Error(message));
                }
            };
            worker.onerror = () => {
                if (runtimes.current[kind] !== instance)
                    return;
                const failure = new Error('Não foi possível iniciar o processamento neste dispositivo.');
                for (const pending of instance.pending.values()) {
                    clearTimeout(pending.timer);
                    pending.reject(failure);
                }
                clearTimeout(instance.idleTimer);
                instance.pending.clear();
                worker.terminate();
                delete runtimes.current[kind];
                setModel(kind, { status: 'error', error: failure.message });
            };
        }
        const instance = runtime;
        const id = ++nextId.current;
        clearTimeout(instance.idleTimer);
        return new Promise((resolve, reject) => {
            const timer = setTimeout(() => {
                if (runtimes.current[kind] !== instance)
                    return;
                terminate(kind);
                setModel(kind, { status: 'error', error: 'O processamento local demorou mais que o esperado. Os resultados do núcleo Fama continuam disponíveis.' });
            }, operation === 'install' ? 1_800_000 : operation === 'load' ? payload.cacheOnly ? 60_000 : 600_000 : 45_000);
            instance.pending.set(id, { operation, resolve, reject, timer });
            try {
                instance.worker.postMessage({ id, kind, operation, ...payload }, transfer);
            }
            catch {
                clearTimeout(timer);
                instance.pending.delete(id);
                reject(new Error('O dispositivo não conseguiu iniciar a tarefa local.'));
            }
        });
    }, [setModel, terminate]);
    const checkDevice = useCallback((kind) => {
        const policy = localAiDevicePolicy();
        if (policy[kind])
            return true;
        const message = kind === 'language' ? localAiLightModeMessage : 'Este aparelho tem pouca memória para a transcrição local. Digite sua pergunta; as consultas e a leitura de respostas continuam disponíveis.';
        setModel(kind, { status: 'unsupported', error: message });
        if (kind === 'language')
            setEnabled(false);
        return false;
    }, [setEnabled, setModel]);
    const install = useCallback(async (kind) => {
        if (!checkDevice(kind))
            return false;
        if (loading.current[kind])
            return false;
        const state = modelsRef.current[kind];
        if (state.status === 'ready' || state.saved && !state.legacy)
            return true;
        if (voiceRef.current !== 'idle' || Object.values(runtimes.current).some(runtime => runtime.pending.size))
            return false;
        const attempt = epoch.current[kind];
        loading.current[kind] = true;
        try {
            if (kind === 'language') {
                const gpu = navigator.gpu;
                const adapter = await gpu?.requestAdapter().catch(() => null);
                if (!mounted.current || attempt !== epoch.current[kind])
                    return false;
                if (!adapter?.features.has('shader-f16')) {
                    setModel(kind, { status: 'unsupported', error: 'Este aparelho usará o núcleo Fama para conversar. A voz local pode funcionar sem WebGPU.' });
                    return false;
                }
            }
            setModel(kind, { status: 'loading', error: undefined, warning: undefined, progress: undefined, restoring: state.saved === true });
            await task(kind, 'install');
            return mounted.current && attempt === epoch.current[kind];
        }
        catch (cause) {
            if (mounted.current && attempt === epoch.current[kind])
                setModel(kind, { status: 'error', error: cause instanceof Error ? cause.message : 'A preparação automática não foi concluída.' });
            return false;
        }
        finally {
            if (attempt === epoch.current[kind])
                loading.current[kind] = false;
        }
    }, [checkDevice, setModel, task]);
    const prepareAutomatically = useCallback(async () => {
        if (autoRunning.current || !mounted.current)
            return;
        autoRunning.current = true;
        const attempt = autoEpoch.current;
        setPreparingAutomatic(true);
        if (!protectionRequested.current) {
            protectionRequested.current = true;
            void protectLocalAiStorage();
        }
        try {
            await install('speech');
            if (!mounted.current || attempt !== autoEpoch.current)
                return;
            await install('language');
        }
        finally {
            autoRunning.current = false;
            if (mounted.current)
                setPreparingAutomatic(false);
        }
    }, [install]);
    const load = useCallback(async (kind, savedOnly = false) => {
        if (!checkDevice(kind))
            return false;
        if (kind === 'language' && voiceRef.current !== 'idle')
            return false;
        if (loading.current[kind])
            return false;
        if (modelsRef.current[kind].status === 'ready')
            return true;
        const other = kind === 'language' ? 'speech' : 'language';
        if (runtimes.current[other])
            terminate(other);
        if (savedOnly && !modelsRef.current[kind].saved) {
            setError('O modelo local precisa ser preparado em Voz e inteligência local. As consultas do núcleo Fama continuam disponíveis.');
            return false;
        }
        const attempt = epoch.current[kind];
        loading.current[kind] = true;
        try {
            setError('');
            if (!protectionRequested.current) {
                protectionRequested.current = true;
                void protectLocalAiStorage();
            }
            if (kind === 'language') {
                const gpu = navigator.gpu;
                const adapter = await gpu?.requestAdapter().catch(() => null);
                if (!mounted.current || attempt !== epoch.current[kind])
                    return false;
                if (!adapter?.features.has('shader-f16')) {
                    setModel(kind, { status: 'unsupported', error: 'Este dispositivo não oferece a aceleração necessária. O núcleo Fama continua disponível.' });
                    return false;
                }
            }
            const state = modelsRef.current[kind];
            const cacheOnly = savedOnly || state.saved === true && !state.legacy && state.status !== 'error';
            setModel(kind, { status: 'loading', restoring: state.saved === true, error: undefined, warning: undefined, progress: undefined, file: undefined });
            await task(kind, 'load', { cacheOnly, restoreRuntime: cacheOnly && state.legacy === true });
            return mounted.current && attempt === epoch.current[kind];
        }
        catch (cause) {
            if (mounted.current && attempt === epoch.current[kind])
                setError(cause instanceof Error ? cause.message : 'Não foi possível preparar o modelo.');
            return false;
        }
        finally {
            if (attempt === epoch.current[kind])
                loading.current[kind] = false;
        }
    }, [checkDevice, setModel, task, terminate]);
    const generate = useCallback(async (question, answer, history) => {
        const attempt = epoch.current.language;
        setGenerating(true);
        setError('');
        try {
            if (!await load('language', true) || !mounted.current || attempt !== epoch.current.language)
                return '';
            const text = await task('language', 'generate', { messages: localAssistantMessages(question, answer, history) });
            if (!mounted.current || attempt !== epoch.current.language)
                return '';
            const clean = cleanLocalNarrative(text, answer.text);
            if (!clean)
                setError('A sugestão local não passou pela conferência. Consulte os resultados dos registros abaixo.');
            return clean;
        }
        catch (cause) {
            if (mounted.current && attempt === epoch.current.language)
                setError(cause instanceof Error ? cause.message : 'O modelo local não respondeu.');
            return '';
        }
        finally {
            if (mounted.current && attempt === epoch.current.language)
                setGenerating(false);
        }
    }, [load, task]);
    const releaseMicrophone = useCallback(() => {
        if (recordTimer.current)
            clearInterval(recordTimer.current);
        recordTimer.current = null;
        stream.current?.getTracks().forEach(track => track.stop());
        stream.current = null;
    }, []);
    const stopVoice = useCallback((discard = false) => {
        const current = recorder.current;
        if (discard) {
            if (voiceRef.current !== 'idle')
                terminate('speech');
            if (current)
                current.onstop = null;
        }
        if (current?.state === 'recording')
            current.stop();
        if (discard) {
            recorder.current = null;
            if (mounted.current)
                setVoice('idle');
        }
        releaseMicrophone();
    }, [releaseMicrophone, terminate]);
    const startVoice = useCallback(async (onText) => {
        if (voiceRef.current !== 'idle')
            return;
        if ([...(runtimes.current.language?.pending.values() ?? [])].some(pending => pending.operation === 'generate' || pending.operation === 'load'))
            terminate('language');
        const attempt = epoch.current.speech;
        voiceRef.current = 'preparing';
        setError('');
        setSeconds(0);
        setVoice('preparing');
        try {
            if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined')
                throw new Error('A gravação de voz não está disponível neste navegador.');
            if (!await load('speech', true)) {
                if (mounted.current && attempt === epoch.current.speech)
                    setVoice('idle');
                return;
            }
            if (!mounted.current || attempt !== epoch.current.speech)
                return;
            const audioStream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1, echoCancellation: true, noiseSuppression: true }, video: false });
            if (!mounted.current || attempt !== epoch.current.speech) {
                audioStream.getTracks().forEach(track => track.stop());
                return;
            }
            stream.current = audioStream;
            const current = new MediaRecorder(audioStream);
            recorder.current = current;
            const chunks = [];
            current.ondataavailable = event => { if (event.data.size)
                chunks.push(event.data); };
            current.onstop = async () => {
                releaseMicrophone();
                recorder.current = null;
                if (!mounted.current || attempt !== epoch.current.speech)
                    return;
                setVoice('transcribing');
                let context = null;
                try {
                    const blob = new Blob(chunks, { type: current.mimeType });
                    chunks.length = 0;
                    if (blob.size > 5_000_000)
                        throw new Error('A gravação ficou muito grande. Dite uma frase curta.');
                    context = new AudioContext();
                    const audio = await context.decodeAudioData(await blob.arrayBuffer());
                    const length = Math.min(Math.ceil(audio.duration * 16000), 480_000);
                    const offline = new OfflineAudioContext(1, Math.max(length, 1), 16000);
                    const source = offline.createBufferSource();
                    source.buffer = audio;
                    source.connect(offline.destination);
                    source.start();
                    const mono = new Float32Array((await offline.startRendering()).getChannelData(0));
                    if (!mounted.current || attempt !== epoch.current.speech)
                        return;
                    const text = await task('speech', 'transcribe', { audio: mono }, [mono.buffer]);
                    if (mounted.current && attempt === epoch.current.speech) {
                        if (text.trim())
                            onText(text);
                        else
                            setError('Não identifiquei uma frase. Tente novamente mais perto do microfone.');
                    }
                }
                catch (cause) {
                    if (mounted.current && attempt === epoch.current.speech)
                        setError(cause instanceof Error ? cause.message : 'Não foi possível transcrever.');
                }
                finally {
                    await context?.close().catch(() => undefined);
                    if (mounted.current && attempt === epoch.current.speech)
                        setVoice('idle');
                }
            };
            current.start();
            recordingSince.current = Date.now();
            setVoice('recording');
            recordTimer.current = setInterval(() => { const elapsed = Math.floor((Date.now() - recordingSince.current) / 1000); setSeconds(elapsed); if (elapsed >= 20)
                stopVoice(); }, 500);
        }
        catch (cause) {
            releaseMicrophone();
            if (mounted.current && attempt === epoch.current.speech) {
                setVoice('idle');
                setError(cause instanceof DOMException && cause.name === 'NotAllowedError' ? 'Permita o microfone nas configurações deste site para ditar a pergunta.' : cause instanceof Error ? cause.message : 'O microfone não iniciou.');
            }
        }
    }, [load, releaseMicrophone, stopVoice, task, terminate, voice]);
    const stopSpeaking = useCallback(() => { if (typeof window !== 'undefined')
        window.speechSynthesis?.cancel(); if (mounted.current)
        setSpeaking(false); }, []);
    const speak = useCallback((text) => {
        stopSpeaking();
        const synthesis = window.speechSynthesis;
        const selected = synthesis?.getVoices().find(item => item.localService && /^pt(-|_)/i.test(item.lang));
        if (!selected) {
            setError('Nenhuma voz local em português disponível. Instale uma voz de português nas configurações do dispositivo.');
            return;
        }
        const utterance = new SpeechSynthesisUtterance(text.slice(0, 4500));
        utterance.lang = 'pt-BR';
        utterance.voice = selected;
        utterance.rate = 1;
        utterance.onend = utterance.onerror = () => { if (mounted.current)
            setSpeaking(false); };
        setSpeaking(true);
        synthesis.speak(utterance);
    }, [stopSpeaking]);
    const cancel = useCallback(() => {
        stopVoice(true);
        stopSpeaking();
        terminate('language');
        terminate('speech');
        if (mounted.current) {
            setGenerating(false);
            setVoice('idle');
            setError('');
        }
    }, [stopVoice, stopSpeaking, terminate]);
    const setAutomatic = useCallback((value) => {
        writeLocalAiAutomatic(value);
        setAutomaticState(value);
        if (value) {
            void protectLocalAiStorage();
            void prepareAutomatically();
        }
        else
            cancel();
    }, [cancel, prepareAutomatically]);
    const releaseMemory = useCallback(() => {
        stopVoice(true);
        stopSpeaking();
        for (const kind of ['language', 'speech'])
            if (modelsRef.current[kind].status === 'ready')
                terminate(kind);
    }, [stopVoice, stopSpeaking, terminate]);
    useEffect(() => {
        if (!runtimeActive)
            return;
        mounted.current = true;
        let active = true;
        const policy = localAiDevicePolicy();
        setEnabledState(readLocalAiEnabled() && policy.language);
        if (!policy.language) {
            writeLocalAiEnabled(false);
            checkDevice('language');
        }
        if (!policy.speech)
            checkDevice('speech');
        setAutomaticState(readLocalAiAutomatic());
        const inspections = ['language', 'speech'].map(kind => {
            return inspectLocalAiInstallation(kind, window.location.origin).then(installation => {
                if (!active || !mounted.current || modelsRef.current[kind].status !== 'idle' && modelsRef.current[kind].status !== 'unsupported')
                    return;
                setModel(kind, { saved: installation.saved, legacy: installation.legacy, partial: installation.partial, status: modelsRef.current[kind].status === 'unsupported' ? 'unsupported' : installation.saved ? 'saved' : 'idle' });
            });
        });
        void Promise.all(inspections).then(() => { if (active && mounted.current && prepareOnOpen && readLocalAiAutomatic())
            void prepareAutomatically(); });
        if (!navigator.gpu)
            setModel('language', { status: 'unsupported' });
        const synthesis = window.speechSynthesis;
        const voices = () => setLocalVoiceAvailable(Boolean(synthesis?.getVoices().some(item => item.localService && /^pt(-|_)/i.test(item.lang))));
        voices();
        synthesis?.addEventListener('voiceschanged', voices);
        const hidden = () => {
            if (document.hidden) {
                stopVoice(true);
                stopSpeaking();
                return;
            }
            if (!prepareOnOpen || !readLocalAiAutomatic() || autoRunning.current)
                return;
            void Promise.all(['language', 'speech'].map(async (kind) => {
                if (loading.current[kind] || modelsRef.current[kind].status === 'ready')
                    return;
                const installation = await inspectLocalAiInstallation(kind, window.location.origin);
                if (active && mounted.current)
                    setModel(kind, { saved: installation.saved, legacy: installation.legacy, partial: installation.partial, status: localAiDevicePolicy()[kind] ? installation.saved ? 'saved' : 'idle' : 'unsupported' });
            })).then(() => { if (active && mounted.current && readLocalAiAutomatic())
                void prepareAutomatically(); });
        };
        const online = () => { if (active && prepareOnOpen && readLocalAiAutomatic())
            void prepareAutomatically(); };
        document.addEventListener('visibilitychange', hidden);
        window.addEventListener('online', online);
        return () => { active = false; mounted.current = false; cancel(); synthesis?.removeEventListener('voiceschanged', voices); document.removeEventListener('visibilitychange', hidden); window.removeEventListener('online', online); };
    }, [runtimeActive, prepareOnOpen, prepareAutomatically, cancel, checkDevice, setModel, stopSpeaking, stopVoice]);
    return { models, enabled, setEnabled, automatic, setAutomatic, preparingAutomatic, prepareAutomatically, releaseMemory, generating, voice, seconds, error, speaking, localVoiceAvailable, load, generate, startVoice, stopVoice, speak, stopSpeaking, cancel, terminate, clearError: () => setError('') };
}
