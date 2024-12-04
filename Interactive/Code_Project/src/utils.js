export async function loadTexture(device, url) {
    try {
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const blob = await response.blob();
        const imageData = await createImageBitmap(blob);

        const texture = device.createTexture({
            size: [imageData.width, imageData.height],
            format: 'rgba8unorm',
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });

        device.queue.copyExternalImageToTexture(
            { source: imageData },
            { texture: texture },
            [imageData.width, imageData.height]
        );

        return texture;
    } catch (error) {
        console.error('Error loading texture:', url, error);
        // Handle the error, perhaps by returning a default texture
    }
}