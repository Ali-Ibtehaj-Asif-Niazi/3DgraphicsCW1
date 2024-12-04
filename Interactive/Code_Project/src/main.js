// main.js
import { mat4 } from 'gl-matrix';
import { PostProcess } from './postprocess.js'; // Adjust the path if necessary
import { shaderCode } from './shaderCode.js';
import { initWebGPU } from './webgpu.js';
import { loadOBJ } from './modelLoader.js';
import { loadTexture } from './utils.js';

const laptopObjPath = './models/laptop.obj';
const materials = [
    'laptop1.mtl',
    'laptop2.mtl',
    'laptop3.mtl',
];
// Define an array of objects to showcase
const objects = [
    { objPath: laptopObjPath, mtlPath: './models/laptop.mtl' },
    { objPath: './models/camera.obj', mtlPath: './models/camera.mtl' },
    { objPath: './models/headphones.obj', mtlPath: './models/headphones.mtl' },
    { objPath: './models/cup.obj', mtlPath: './models/cup.mtl' },
];

let currentObjectIndex = 0;

// Settings object for GUI controls
const settings = {
    lightPosX: 5.0,
    lightPosY: 5.0,
    lightPosZ: 5.0,
    lightIntensity: 1.0,
};

// Initialize dat.GUI
const gui = new dat.GUI();

// Add sliders to control light position and intensity
gui.add(settings, 'lightPosX', -10.0, 10.0).name('Light Position X');
gui.add(settings, 'lightPosY', -10.0, 10.0).name('Light Position Y');
gui.add(settings, 'lightPosZ', -10.0, 10.0).name('Light Position Z');
gui.add(settings, 'lightIntensity', 0.0, 10.0).name('Light Intensity');

async function main() {
    const canvas = document.getElementById('gpuCanvas');
    const { device, context, presentationFormat } = await initWebGPU(canvas);

    const pipeline = device.createRenderPipeline({
        layout: 'auto',
        vertex: {
            module: device.createShaderModule({ code: shaderCode }),
            entryPoint: 'vertexMain',
            buffers: [
                { arrayStride: 3 * 4, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
                { arrayStride: 3 * 4, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
                { arrayStride: 2 * 4, attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x2' }] },
            ]
        },
        fragment: {
            module: device.createShaderModule({ code: shaderCode }),
            entryPoint: 'fragmentMain',
            targets: [{ format: presentationFormat }],
        },
        primitive: { topology: 'triangle-list' },
        depthStencil: {
            depthWriteEnabled: true,
            depthCompare: 'less',
            format: 'depth24plus',
        }
    });

    // Create depth texture
    let depthTexture = device.createTexture({
        size: [canvas.width, canvas.height],
        format: 'depth24plus',
        usage: GPUTextureUsage.RENDER_ATTACHMENT,
    });

    // Initialize PostProcess
    const postProcess = new PostProcess(device, presentationFormat, canvas);
    postProcess.setDepthTexture(depthTexture);
    postProcess.setContext(context);

    // Update the uniform buffer size
    const uniformBufferSize = 256; // 60 floats * 4 bytes
    const uniformBuffer = device.createBuffer({
        size: uniformBufferSize,
        usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
    });

    const sampler = device.createSampler({
        magFilter: 'linear',
        minFilter: 'linear',
    });

    // Add rotation and zoom variables
    let rotationX = 0;
    let rotationY = 0;
    let zoom = 5;

    function createBuffer(device, data, usage) {
        const buffer = device.createBuffer({
            size: data.byteLength,
            usage: usage | GPUBufferUsage.COPY_DST,
        });
        device.queue.writeBuffer(buffer, 0, data);
        return buffer;
    }

    async function loadObject(objectIndex, mtlPath = null) {
        const object = objects[objectIndex];
        const objPath = object.objPath;
        const mtlFilePath = mtlPath || object.mtlPath;
    
        const { materialGroups, materials } = await loadOBJ(objPath, mtlFilePath);
    
        // Load textures for each material
        const textures = await Promise.all(materials.map(async (material) => {
            if (material.texture) {
                return await loadTexture(device, material.texture);
            } else {
                // Create a default 1x1 white texture
                const texture = device.createTexture({
                    size: [1, 1, 1],
                    format: 'rgba8unorm',
                    usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
                });
                const whitePixel = new Uint8Array([255, 255, 255, 255]);
                device.queue.writeTexture(
                    { texture: texture },
                    whitePixel,
                    { bytesPerRow: 4 },
                    [1, 1]
                );
                return texture;
            }
        }));
    
        // Prepare buffers and bind groups for each material group
        const materialData = materialGroups.map((group, index) => {
            if (!group) return null; // Skip empty groups
    
            const positionBuffer = createBuffer(device, new Float32Array(group.positions), GPUBufferUsage.VERTEX);
            const normalBuffer = createBuffer(device, new Float32Array(group.normals), GPUBufferUsage.VERTEX);
            const texCoordBuffer = createBuffer(device, new Float32Array(group.texCoords), GPUBufferUsage.VERTEX);
            const indexBuffer = createBuffer(device, new Uint32Array(group.indices), GPUBufferUsage.INDEX);
    
            const bindGroup = device.createBindGroup({
                layout: pipeline.getBindGroupLayout(0),
                entries: [
                    { binding: 0, resource: { buffer: uniformBuffer } },
                    { binding: 1, resource: sampler },
                    { binding: 2, resource: textures[index].createView() },
                ]
            });
    
            return {
                positionBuffer,
                normalBuffer,
                texCoordBuffer,
                indexBuffer,
                bindGroup,
                indicesLength: group.indices.length,
            };
        });
    
        return materialData.filter((data) => data !== null); // Filter out null entries
    }    

    let materialDataArray = await loadObject(currentObjectIndex);

    function renderScene(passEncoder) {
        passEncoder.setPipeline(pipeline);
    
        for (const data of materialDataArray) {
            passEncoder.setBindGroup(0, data.bindGroup);
            passEncoder.setVertexBuffer(0, data.positionBuffer);
            passEncoder.setVertexBuffer(1, data.normalBuffer);
            passEncoder.setVertexBuffer(2, data.texCoordBuffer);
            passEncoder.setIndexBuffer(data.indexBuffer, 'uint32');
            passEncoder.drawIndexed(data.indicesLength);
        }
    }

    function render() {
        const commandEncoder = device.createCommandEncoder();
        const textureView = context.getCurrentTexture().createView();

        const renderPassDescriptor = {
            colorAttachments: [{
                view: textureView,
                clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
            depthStencilAttachment: {
                view: depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            }
        }; 

        const passEncoder = commandEncoder.beginRenderPass(renderPassDescriptor);
        passEncoder.setPipeline(pipeline);

        for (const data of materialDataArray) {
            passEncoder.setBindGroup(0, data.bindGroup);
            passEncoder.setVertexBuffer(0, data.positionBuffer);
            passEncoder.setVertexBuffer(1, data.normalBuffer);
            passEncoder.setVertexBuffer(2, data.texCoordBuffer);
            passEncoder.setIndexBuffer(data.indexBuffer, 'uint32');
            passEncoder.drawIndexed(data.indicesLength);
        }

        passEncoder.end();

        device.queue.submit([commandEncoder.finish()]);
        // Render the scene to texture and apply post-processing
        postProcess.renderSceneToTexture(renderScene);
    }

    let isRotating = false; // Indicates whether the object is rotating automatically
    
    // Update the rotation status display
    function updateRotationStatus() {
        const statusElement = document.getElementById('rotationStatus');
        statusElement.textContent = `Rotation (Press R): ${isRotating ? 'On' : 'Off'}`;
    }
    // Add event listener for key presses
    window.addEventListener('keydown', (e) => {
        if (e.key === 'r' || e.key === 'R') {
            isRotating = !isRotating; // Toggle rotation state
            updateRotationStatus(); // Update the display
        }
    });


    // Camera position and rotation variables
    let cameraPosition = [0, 0, zoom]; // [x, y, z]
    let cameraRotation = [0, 0];       // [rotationX, rotationY]

    let isPanning = false;
    let lastPanPosition = { x: 0, y: 0 };

    canvas.addEventListener('mousedown', (e) => {
        if (e.button === 2) { // Right mouse button
            isPanning = true;
            lastPanPosition.x = e.clientX;
            lastPanPosition.y = e.clientY;
        }
    });

    canvas.addEventListener('mousemove', (e) => {
        if (isPanning) {
            const deltaX = e.clientX - lastPanPosition.x;
            const deltaY = e.clientY - lastPanPosition.y;

            const panSpeed = 0.005; // Adjust pan speed as needed

            // Update camera position based on mouse movement
            cameraPosition[0] -= deltaX * panSpeed;
            cameraPosition[1] += deltaY * panSpeed;

            lastPanPosition.x = e.clientX;
            lastPanPosition.y = e.clientY;
        } else if (e.buttons === 1) { // Left mouse button for rotation
            rotationY += e.movementX * 0.01;
            rotationX += e.movementY * 0.01;
        }
    });

    canvas.addEventListener('mouseup', (e) => {
        if (e.button === 2) { // Right mouse button
            isPanning = false;
        }
    });

    // Prevent context menu from appearing on right-click
    canvas.addEventListener('contextmenu', (e) => {
        e.preventDefault();
    });

    canvas.addEventListener('wheel', (e) => {
        zoom += e.deltaY * 0.01;
        zoom = Math.max(1, Math.min(zoom, 20));
        cameraPosition[2] = zoom; // Update camera Z position
    });

    // Modify the `updateUniformBuffer` function
    function updateUniformBuffer() {
        const aspect = canvas.width / canvas.height;
        const projectionMatrix = mat4.perspective(mat4.create(), Math.PI / 4, aspect, 0.1, 100.0);

        // Create the view matrix
        const viewMatrix = mat4.create();

        // Apply camera rotation
        mat4.rotateX(viewMatrix, viewMatrix, cameraRotation[0]);
        mat4.rotateY(viewMatrix, viewMatrix, cameraRotation[1]);

        // Apply camera translation
        mat4.translate(viewMatrix, viewMatrix, [-cameraPosition[0], -cameraPosition[1], -cameraPosition[2]]);

        const modelMatrix = mat4.create();
        mat4.rotate(modelMatrix, modelMatrix, rotationX, [1, 0, 0]);
        mat4.rotate(modelMatrix, modelMatrix, rotationY, [0, 1, 0]);

        const mvpMatrix = mat4.create();
        mat4.multiply(mvpMatrix, projectionMatrix, viewMatrix);
        mat4.multiply(mvpMatrix, mvpMatrix, modelMatrix);

        const normalMatrix = mat4.create();
        mat4.invert(normalMatrix, modelMatrix);
        mat4.transpose(normalMatrix, normalMatrix);

        // Camera and light positions
        const cameraPos = [...cameraPosition, 1.0];
        const lightPosition = [settings.lightPosX, settings.lightPosY, settings.lightPosZ, 1.0];

        // Create uniform data buffer
        const uniformData = new Float32Array(60); // Adjusted size to include lightIntensity
        uniformData.set(modelMatrix, 0);
        uniformData.set(mvpMatrix, 16);
        uniformData.set(normalMatrix, 32);
        uniformData.set(cameraPos, 48);
        uniformData.set(lightPosition, 52);
        uniformData[56] = settings.lightIntensity; // Add light intensity at offset 56

        device.queue.writeBuffer(uniformBuffer, 0, uniformData);
    }
    

    function resizeCanvas() {
        // Update postProcess
        postProcess.setDepthTexture(depthTexture);
        postProcess.resize();
        const devicePixelRatio = window.devicePixelRatio || 1;
        canvas.width = canvas.clientWidth * devicePixelRatio;
        canvas.height = canvas.clientHeight * devicePixelRatio;

        // Update depth texture size
        depthTexture.destroy();
        depthTexture = device.createTexture({
            size: [canvas.width, canvas.height],
            format: 'depth24plus',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });

        // Update postProcess
        postProcess.setDepthTexture(depthTexture);
        postProcess.resize();
    }


    // Call resizeCanvas initially and add event listener
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);

    // Add event listeners for rotation and zoom
    canvas.addEventListener('mousemove', (e) => {
        if (e.buttons === 1) {
            rotationY += e.movementX * 0.01;
            rotationX += e.movementY * 0.01;
        }
    });

    canvas.addEventListener('wheel', (e) => {
        zoom += e.deltaY * 0.01;
        zoom = Math.max(1, Math.min(zoom, 20));
    });

    // Add event listeners for next and previous buttons
    document.getElementById('nextButton').addEventListener('click', async () => {
        currentObjectIndex = (currentObjectIndex + 1) % objects.length;
        materialDataArray = await loadObject(currentObjectIndex);
    });

    document.getElementById('prevButton').addEventListener('click', async () => {
        currentObjectIndex = (currentObjectIndex - 1 + objects.length) % objects.length;
        materialDataArray = await loadObject(currentObjectIndex);
    });



    // Initial effect mode (0: No effect)
    let effectMode = 0;

    // Event listeners for buttons
    document.getElementById('noEffectButton').addEventListener('click', () => {
        effectMode = 0;
        postProcess.setEffectMode(effectMode);
    });

    document.getElementById('grayscaleButton').addEventListener('click', () => {
        effectMode = 1;
        postProcess.setEffectMode(effectMode);
    });

    document.getElementById('invertButton').addEventListener('click', () => {
        effectMode = 2;
        postProcess.setEffectMode(effectMode);
    });

    // Reference to the material selector
    const materialSelector = document.getElementById('materialSelector');

    // Event listener for material change
    materialSelector.addEventListener('change', async (event) => {
        const selectedMaterial = event.target.value;
        await changeMaterial(selectedMaterial);
    });

    async function changeMaterial(mtlFileName) {
        // Build the full path to the material file
        const mtlPath = `./models/${mtlFileName}`;
    
        // Reload the object with the new material
        materialDataArray = await loadObject(currentObjectIndex, mtlPath);
    }
    

    function frame() {
        if (isRotating) {
            rotationY += 0.01; // Adjust rotation speed as needed
        }
        updateUniformBuffer();
        render();
        requestAnimationFrame(frame);
    }    

    frame();
}

main();
