// utils.js

export async function loadTexture(device, url) {
    try {
        // Fetch the image from the URL
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        // Create an ImageBitmap from the fetched image
        const blob = await response.blob();
        const imageData = await createImageBitmap(blob);

        // Create a GPU texture with the image dimensions
        const texture = device.createTexture({
            size: [imageData.width, imageData.height],
            format: 'rgba8unorm',
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT,
        });

        // Copy the image data into the GPU texture
        device.queue.copyExternalImageToTexture(
            { source: imageData },
            { texture: texture },
            [imageData.width, imageData.height]
        );

        return texture;
    } catch (error) {
        console.error('Error loading texture:', url, error);
        // The error can be handled by returning a default texture
        // but for now I don't need to do that because I have tested 
        // all my textures and they work correctly
    }
}