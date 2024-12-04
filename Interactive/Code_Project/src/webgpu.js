// webgpu.js

export async function initWebGPU(canvas) {
    // Request a GPU adapter
    const adapter = await navigator.gpu.requestAdapter();

    // Request a logical device from the adapter
    const device = await adapter.requestDevice();

    // Get the WebGPU rendering context from the canvas
    const context = canvas.getContext('webgpu');

    // Get the preferred canvas format
    const presentationFormat = navigator.gpu.getPreferredCanvasFormat();

    // Configure the canvas context
    context.configure({
        device: device,
        format: presentationFormat,
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // Return the initialized device, context, and presentation format
    return { device, context, presentationFormat };
}
