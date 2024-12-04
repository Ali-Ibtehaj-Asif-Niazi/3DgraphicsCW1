// webgpu.js

export async function initWebGPU(canvas) {
    const adapter = await navigator.gpu.requestAdapter();
    const device = await adapter.requestDevice();

    const context = canvas.getContext('webgpu');
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();
    context.configure({
        device: device,
        format: presentationFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    return { device, context, presentationFormat };
}
