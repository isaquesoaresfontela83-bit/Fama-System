export const localAiLightModeMessage = 'Modo leve neste aparelho: use a Fama IA para consultar e planejar com os registros do sistema. O modelo grande fica reservado para computadores com mais memória.';
/** GPU feature support alone does not establish that a large model fits in memory. */
export function localAiDevicePolicy(device = typeof navigator === 'undefined' ? {} : navigator) {
    const mobile = device.userAgentData?.mobile === true || /Android|iPhone|iPad|iPod|Mobile/i.test(device.userAgent ?? '') || /Macintosh/i.test(device.userAgent ?? '') && (device.maxTouchPoints ?? 0) > 1;
    const memory = typeof device.deviceMemory === 'number' && Number.isFinite(device.deviceMemory) && device.deviceMemory > 0 ? device.deviceMemory : undefined;
    return { mobile, language: !mobile && (memory === undefined || memory >= 8), speech: memory === undefined || memory >= 4 };
}
