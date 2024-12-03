// postprocess.js

export class PostProcess {
    constructor(device, presentationFormat, canvas) {
        this.device = device;
        this.presentationFormat = presentationFormat;
        this.canvas = canvas;

        // Initialize variables
        this.postProcessUniformBuffer = null;
        this.postProcessPipeline = null;
        this.postProcessBindGroup = null;
        this.sceneTexture = null;
        this.sampler = null;
        this.effectMode = 0; // 0: No effect, 1: Grayscale, 2: Invert

        // Initialize resources
        this.createResources();
    }

    createResources() {
        // Create the uniform buffer
        const uniformBufferSize = 16; // 4 bytes for effectMode, 4 bytes padding, 8 bytes for canvasSize
        this.postProcessUniformBuffer = this.device.createBuffer({
            size: uniformBufferSize,
            usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
        });

        // Create the sampler
        this.sampler = this.device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
        });

        // Create the scene texture
        this.createSceneTexture();

        // Create the post-processing pipeline
        this.createPostProcessPipeline();

        // Create the bind group
        this.createBindGroup();
    }

    createSceneTexture() {
        if (this.sceneTexture) {
            this.sceneTexture.destroy();
        }

        this.sceneTexture = this.device.createTexture({
            size: [this.canvas.width, this.canvas.height],
            format: this.presentationFormat, // Use presentationFormat
            usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
        });  
    }

    createPostProcessPipeline() {
        const shaderCode = `
        struct Uniforms {
            effectMode : u32,
            padding : u32,
            canvasSize : vec2<f32>,
        };
        @binding(0) @group(0) var<uniform> uniforms : Uniforms;
        @binding(1) @group(0) var mySampler: sampler;
        @binding(2) @group(0) var myTexture: texture_2d<f32>;

        @vertex
        fn vertexMain(@builtin(vertex_index) VertexIndex : u32) -> @builtin(position) vec4<f32> {
            var pos = array<vec2<f32>, 6>(
                vec2<f32>(-1.0, -1.0),
                vec2<f32>( 1.0, -1.0),
                vec2<f32>(-1.0,  1.0),
                vec2<f32>(-1.0,  1.0),
                vec2<f32>( 1.0, -1.0),
                vec2<f32>( 1.0,  1.0)
            );
            return vec4<f32>(pos[VertexIndex], 0.0, 1.0);
        }

        @fragment
        fn fragmentMain(@builtin(position) FragCoord : vec4<f32>) -> @location(0) vec4<f32> {
            let uv = FragCoord.xy / uniforms.canvasSize;
            var color = textureSample(myTexture, mySampler, uv);

            switch uniforms.effectMode {
                case 1u: { // Grayscale
                    let gray = dot(color.rgb, vec3<f32>(0.299, 0.587, 0.114));
                    color = vec4<f32>(vec3<f32>(gray), color.a);
                }
                case 2u: { // Invert
                    color = vec4<f32>(vec3<f32>(1.0) - color.rgb, color.a); // Corrected line
                }
                default: { /* No effect */ }
            }

            return color;
        }
        `;

        const shaderModule = this.device.createShaderModule({ code: shaderCode });

        this.postProcessPipeline = this.device.createRenderPipeline({
            layout: 'auto',
            vertex: {
                module: shaderModule,
                entryPoint: 'vertexMain',
            },
            fragment: {
                module: shaderModule,
                entryPoint: 'fragmentMain',
                targets: [{ format: this.presentationFormat }],
            },
            primitive: {
                topology: 'triangle-list',
            },
        });
    }

    createBindGroup() {
        this.postProcessBindGroup = this.device.createBindGroup({
            layout: this.postProcessPipeline.getBindGroupLayout(0),
            entries: [
                { binding: 0, resource: { buffer: this.postProcessUniformBuffer } },
                { binding: 1, resource: this.sampler },
                { binding: 2, resource: this.sceneTexture.createView() },
            ],
        });
    }

    updateUniforms() {
        // Update effect mode
        this.device.queue.writeBuffer(
            this.postProcessUniformBuffer,
            0,
            new Uint32Array([this.effectMode])
        );

        // Update canvas size
        const canvasSize = new Float32Array([this.canvas.width, this.canvas.height]);
        this.device.queue.writeBuffer(this.postProcessUniformBuffer, 8, canvasSize);
    }

    renderSceneToTexture(renderSceneFunction) {
        // Update uniforms before rendering
    this.updateUniforms();
        const commandEncoder = this.device.createCommandEncoder();

        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: this.sceneTexture.createView(),
                clearValue: { r: 0.1, g: 0.1, b: 0.1, a: 1.0 },
                loadOp: 'clear',
                storeOp: 'store',
            }],
            depthStencilAttachment: {
                view: this.depthTexture.createView(),
                depthClearValue: 1.0,
                depthLoadOp: 'clear',
                depthStoreOp: 'store',
            },
        });

        // Call the provided renderSceneFunction to render the 3D scene
        renderSceneFunction(passEncoder);

        passEncoder.end();

        // Apply post-processing
        this.renderPostProcess(commandEncoder);

        this.device.queue.submit([commandEncoder.finish()]);
    }

    renderPostProcess(commandEncoder) {
        const textureView = this.context.getCurrentTexture().createView();
        const passEncoder = commandEncoder.beginRenderPass({
            colorAttachments: [{
                view: textureView,
                loadOp: 'clear',
                storeOp: 'store',
            }],
        });

        passEncoder.setPipeline(this.postProcessPipeline);
        passEncoder.setBindGroup(0, this.postProcessBindGroup);
        passEncoder.draw(6);
        passEncoder.end();
    }

    setEffectMode(mode) {
        this.effectMode = mode;
        console.log('Effect mode set to:', this.effectMode);
        this.updateUniforms();
    }
    

    resize() {
        this.createSceneTexture();
        this.updateUniforms();
        this.createBindGroup(); // Recreate bind group with new texture view
    }

    setDepthTexture(depthTexture) {
        this.depthTexture = depthTexture;
    }

    setContext(context) {
        this.context = context;
    }
}
