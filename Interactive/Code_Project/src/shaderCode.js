export const shaderCode = `
    // WGSL shader code
    
    struct Uniforms {
        modelMatrix : mat4x4<f32>,
        modelViewProjectionMatrix : mat4x4<f32>,
        normalMatrix : mat4x4<f32>,
        cameraPosition : vec4<f32>,
        lightPosition : vec4<f32>,
        lightIntensity : f32, // Add light intensity
        padding : vec3<f32>,  // Padding to align to 16 bytes
    };
    @binding(0) @group(0) var<uniform> uniforms : Uniforms;
    @binding(1) @group(0) var mySampler: sampler;
    @binding(2) @group(0) var myTexture: texture_2d<f32>;

    struct VertexInput {
        @location(0) position : vec3<f32>,
        @location(1) normal : vec3<f32>,
        @location(2) texCoord : vec2<f32>,
    };

    struct VertexOutput {
        @builtin(position) position : vec4<f32>,
        @location(0) normal : vec3<f32>,
        @location(1) texCoord : vec2<f32>,
        @location(2) worldPos : vec3<f32>,
    };

    @vertex
    fn vertexMain(input: VertexInput) -> VertexOutput {
        var output: VertexOutput;
        output.position = uniforms.modelViewProjectionMatrix * vec4<f32>(input.position, 1.0);
        output.normal = (uniforms.normalMatrix * vec4<f32>(input.normal, 0.0)).xyz;
        output.texCoord = input.texCoord;
        output.worldPos = (uniforms.modelMatrix * vec4<f32>(input.position, 1.0)).xyz;
        return output;
    }

    @fragment
    fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
        let normal = normalize(input.normal);
        let lightDir = normalize(uniforms.lightPosition.xyz - input.worldPos);
        let viewDir = normalize(uniforms.cameraPosition.xyz - input.worldPos);
        let reflectDir = reflect(-lightDir, normal);

        let ambientStrength = 0.2;
        let ambient = ambientStrength;

        let diffuseStrength = 0.7 * uniforms.lightIntensity;
        let diffuse = diffuseStrength * max(dot(normal, lightDir), 0.0);

        let specularStrength = 0.5 * uniforms.lightIntensity;
        let shininess = 32.0;
        let specular = specularStrength * pow(max(dot(viewDir, reflectDir), 0.0), shininess);

        let texColor = textureSample(myTexture, mySampler, input.texCoord);

        let finalColor = texColor.rgb * (ambient + diffuse) + vec3<f32>(specular);

        return vec4<f32>(finalColor, texColor.a);
    }
    `
;