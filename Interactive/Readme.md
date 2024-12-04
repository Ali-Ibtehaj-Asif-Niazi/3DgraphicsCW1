# Interactive Visualiser

## Contents
- [Frameworks/Tools Used](#frameworks-tools-used)
- [Resources used](#resources-used)
- [How to Run the Code](#how-to-run-the-code)
- [How Objects Were Exported from Blender](#how-objects-were-exported-from-blender)
- [How Object Geometry Was Rendered Using WebGPU](#how-object-geometry-was-rendered-using-webgpu)
- [How Materials and Textures Were Rendered](#how-materials-and-textures-were-rendered)
- [How the Camera Is Setup](#how-the-camera-is-setup)
- [How the Lights Are Set](#how-the-lights-are-set)
- [Framebuffer Effects](#framebuffer-effects)
- [Keystroke Interactions](#keystroke-interactions)

---

## Frameworks/Tools Used
- **Operating System:** Windows 11
- **Browser:** Google Chrome
- **Node.js:** Version `v22.9.0`
- **Blender:** For 3D object creation and export
- **WebGPU:** For rendering object geometry and handling GPU-based graphics processing
- **dat.GUI:** Used for UI controls
- **Vite:** A build tool for running and building the application
- **http-server:** A simple HTTP server for serving static files
- **gl-matrix:** Library for vector and matrix operations, version `^3.4.3`
---

## Resources used
- [Load and Parse 3D .OBJ files for the Web](https://medium.com/@carmencincotti/load-and-parse-3d-obj-files-for-the-web-e7a4b15ce15d)
- [WebGPU Samples](https://webgpu.github.io/webgpu-samples/)
- [WEbGPU C++ guide](https://eliemichel.github.io/LearnWebGPU/basic-3d-rendering/texturing/loading-from-file.html) documentation
    - [Loading 3D Mesh from file](https://eliemichel.github.io/LearnWebGPU/basic-3d-rendering/3d-meshes/loading-from-file.html)
    - [Loading Textures from file](https://eliemichel.github.io/LearnWebGPU/basic-3d-rendering/texturing/loading-from-file.html)
    - [Some interaction](https://eliemichel.github.io/LearnWebGPU/basic-3d-rendering/some-interaction/index.html)
- [WebGPU Fundamentals](https://webgpufundamentals.org/)
## How to Run the Code

This project uses **Vite**, a fast and efficient frontend build tool, as the development server. Vite offers a more convenient and faster experience compared to traditional tools like the VSCode Live Server.

### Steps to Run the Code:
1. Ensure you have **Node.js** version `22` or above installed on your system.  
   - You can verify your Node.js version by running the following command in your terminal:
     ```
     node -v
     ```
2. Navigate to the project directory (e.g., the `Code_Project` folder) in your terminal.

3. Install the necessary dependencies by running:
    ```
    npm install
    ```
4. Start the development server by running:
    ```
    npm run dev
    ```
5. Open your browser and go to the following URL to view the rendered output:
    ```
    http://localhost:5173/
    ```
---

## How Objects Were Exported from Blender
I explored two types of export formats from Blender to use with WebGPU:

1. **`.gltf` and `.glb` Formats**:  
   Initially, I tried exporting objects in the `.gltf` format. However, I found it very difficult to use with WebGPU because there are no pre-built frameworks or scripts in WebGPU to handle `.gltf` or `.glb` files. Using `.gltf` would require creating a custom parser, which is complex and essentially a project on its own.

2. **`.obj` Format**:  
   Switching to the `.obj` export format worked seamlessly. The `.obj` format provides geometry data in a human-readable format that is compatible with WebGPU. Additionally, Blender’s `.obj` export also generates an accompanying `.mtl` (material library) file, which is essential for assigning specific materials and textures to parts of the model in WebGPU. This made the process significantly easier and more efficient.

I took help from [this guide](https://medium.com/@carmencincotti/load-and-parse-3d-obj-files-for-the-web-e7a4b15ce15d), provided in the lecture slides, to properly export the `.obj` file.

---

### Steps to Export Objects from Blender:

1. **Set the Object's Origin**:  
   - Right-click the object, then navigate to **Set Origin > Origin to Geometry**.  
   - This ensures the object's origin point is correctly set relative to its geometry.  
   ![alt text](/Interactive/Incremental%20Work/setorigin.png)

2. **Move the Object to the Scene Center**:  
   - Right-click the object, then navigate to **Snap > Cursor to Selection**.  
   - This places the object at the center of the scene for better alignment.  
   ![alt text](/Interactive/Incremental%20Work/snapcursor.png)

3. **Recalculate Normals**:  
   - Enter **Edit Mode** (by pressing `TAB`), then navigate to **Mesh > Normals > Recalculate Outside**.  
   - This ensures the normals of the geometry are correctly oriented, which is crucial for accurate lighting and shading in WebGPU.  
   ![alt text](/Interactive/Incremental%20Work/normals.png)

4. **Export the Object as `.obj`**:  
   - Navigate to **File > Export > Wavefront (.obj)**.  
   - Use the following export settings under the **Geometry** section:
     - ✅ **UV Coordinates**  
     - ✅ **Normals**  
     - ✅ **Triangulate Mesh**  
     - ✅ **Apply Modifiers**  
   ![alt text](/Interactive/Incremental%20Work/exportsetting.png)

---

### Output Files:
After exporting, you will have:  
- An `.obj` file containing the geometry data, including vertices, faces, and normals, which is compatible with WebGPU.  
- An `.mtl` file containing material properties such as diffuse colors, specular highlights, and texture mappings. This file helps WebGPU apply specific materials and textures to the correct parts of the model.  

With these files, the object is ready to be rendered in the browser using WebGPU. 🎉

---


## How Object Geometry Was Rendered Using WebGPU

The process of rendering object geometry in WebGPU involves parsing `.obj` files, creating GPU buffers for storing geometry data, and passing this data to shaders for rendering. Below is a detailed breakdown:

---

### **Loading Geometry Data**
The `.obj` files are parsed using the `loadOBJ` function in `modelLoader.js`. This function extracts:
- **Vertices (`v`)**: Represent positions in 3D space.
- **Normals (`vn`)**: Used for lighting calculations.
- **Texture Coordinates (`vt`)**: Map textures to the object surface.
- **Faces (`f`)**: Define how vertices are connected to form triangles.
- **Materials (`usemtl`)**: Associates specific parts of the geometry with a material defined in the `.mtl` file. Each material is stored in `materialGroups`, ensuring correct mapping of textures and material properties.

The parsed data is organized into `materialGroups`, which group geometry by materials for efficient rendering. This function is used in the `main.js` file as follows:

```javascript
const { materialGroups, materials } = await loadOBJ(objPath, mtlFilePath);
```

---

### **Creating Buffers**
After parsing the geometry data, it is stored in GPU buffers. These buffers are used by WebGPU to efficiently process and render the object.

1. **Position Buffer**:  
   Stores the vertex positions in 3D space (`x`, `y`, `z`).
   ```javascript
   const positionBuffer = createBuffer(device, new Float32Array(group.positions), GPUBufferUsage.VERTEX);
   ```
2. **Normal Buffer**:  
   Stores the normals of each vertex (`nx`, `ny`, `nz`), which are required for lighting calculations.
   ```javascript
   const normalBuffer = createBuffer(device, new Float32Array(group.normals), GPUBufferUsage.VERTEX);
   ```
3. **Texture Coordinate Buffer**:  
   Stores the texture coordinates (`u`, `v`), which map 2D textures onto the 3D surface.
   ```javascript
   const texCoordBuffer = createBuffer(device, new Float32Array(group.texCoords), GPUBufferUsage.VERTEX);
   ```
4. **Index Buffer**:  
   Defines how vertices are connected to form triangles, using indices to reference vertex positions.
   ```javascript
   const indexBuffer = createBuffer(device, new Uint32Array(group.indices), GPUBufferUsage.INDEX);
   ```

These buffers are created with specific usage flags (`VERTEX` or `INDEX`) to indicate their purpose.

#### **The `createBuffer` Function**
The `createBuffer` function initializes a GPU buffer and transfers data to it.

```javascript
function createBuffer(device, data, usage) {
    const buffer = device.createBuffer({
        size: data.byteLength,
        usage: usage | GPUBufferUsage.COPY_DST,
    });
    device.queue.writeBuffer(buffer, 0, data);
    return buffer;
}
```

- **Buffer Creation:** Allocates GPU memory for the given data size.
- **Data Transfer:** Copies the CPU data into the GPU buffer using `device.queue.writeBuffer`.
- **Usage Flags:** Specifies the intended use of the buffer, such as `VERTEX` for vertex data or `INDEX` for indices.

This function is used consistently for all geometry buffers, ensuring the data is correctly prepared for rendering.

---

### **Rendering Pipeline**

The rendering pipeline in `main.js` defines how geometry data flows through the GPU, specifying shaders and configurations necessary for rendering. Below is a breakdown of its components:

#### **Pipeline Configuration**
The rendering pipeline is created using `device.createRenderPipeline`. It includes:
- **Vertex Shader**: Processes vertex data and transforms it into clip space.
- **Fragment Shader**: Computes the color of each pixel, applying lighting and textures.
- **Buffers**: Defines the layout of vertex attributes (positions, normals, and texture coordinates).
- **Primitive Topology**: Specifies that the geometry consists of triangles.
- **Depth Testing**: Ensures correct rendering of overlapping objects.

```javascript
const pipeline = device.createRenderPipeline({
    vertex: {
        module: device.createShaderModule({ code: shaderCode }),
        entryPoint: 'vertexMain',
        buffers: [
            // Position buffer
            { arrayStride: 3 * 4, attributes: [{ shaderLocation: 0, offset: 0, format: 'float32x3' }] },
            // Normal buffer
            { arrayStride: 3 * 4, attributes: [{ shaderLocation: 1, offset: 0, format: 'float32x3' }] },
            // Texture coordinate buffer
            { arrayStride: 2 * 4, attributes: [{ shaderLocation: 2, offset: 0, format: 'float32x2' }] },
        ],
    },
    fragment: {
        module: device.createShaderModule({ code: shaderCode }),
        entryPoint: 'fragmentMain',
        targets: [{ format: presentationFormat }],
    },
    primitive: {
        topology: 'triangle-list', // Specifies triangles as the basic geometric primitive
    },
    depthStencil: {
        depthWriteEnabled: true, // Enables writing to the depth buffer
        depthCompare: 'less', // Ensures closer objects are rendered in front
        format: 'depth24plus', // Specifies the depth buffer format
    },
});
```

---

### **Drawing Geometry**

To render the 3D object, the prepared buffers are bound to the rendering pipeline, and the `drawIndexed` method is used to execute the rendering. This process involves sending data from the GPU buffers to the pipeline and triggering the GPU to draw the geometry.

#### **Rendering the Scene**
The `renderScene` function in `main.js` is responsible for binding buffers and drawing the geometry. It takes a `passEncoder` object as input, which represents the GPU rendering pass.

```javascript
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
```

#### **Steps in `renderScene`**
1. **Set the Pipeline**:  
   Assigns the rendering pipeline to the `passEncoder`, ensuring that the correct shaders, buffers, and configurations are used.
   ```javascript
   passEncoder.setPipeline(pipeline);
   ```

2. **Bind Resources**:  
   For each material group in `materialDataArray`, the associated resources are bound:
   - **Uniform Buffers and Textures**: Contained in the `bindGroup`.
   - **Vertex Buffers**: Positions, normals, and texture coordinates are bound to their respective slots.
   - **Index Buffer**: Specifies how vertices are connected to form triangles.
   ```javascript
   passEncoder.setBindGroup(0, data.bindGroup);
   passEncoder.setVertexBuffer(0, data.positionBuffer);
   passEncoder.setVertexBuffer(1, data.normalBuffer);
   passEncoder.setVertexBuffer(2, data.texCoordBuffer);
   passEncoder.setIndexBuffer(data.indexBuffer, 'uint32');
   ```

3. **Draw Indexed Geometry**:  
   The `drawIndexed` method renders the object by processing the indices.
   ```javascript
   passEncoder.drawIndexed(data.indicesLength);
   ```

---
### **Screenshot**
![alt text](/Interactive/Incremental%20Work/notexture.png)

### **Key Details**
- **Material Groups**: Each material group is rendered with its corresponding textures and shaders, ensuring the object is drawn correctly.
- **Index Buffer**: Allows efficient reuse of vertices, reducing memory usage and improving performance.
- **Binding Points**: Resources like vertex buffers and textures are assigned specific binding points in the pipeline for proper communication with the GPU.

The `renderScene` function efficiently sends data from buffers to the GPU pipeline and ensures accurate rendering of each material group with its associated transformations and data.



## How Materials and Textures Were Rendered

Rendering materials and textures in WebGPU involves parsing `.mtl` files, loading textures, and binding these resources to the rendering pipeline. Below is a detailed breakdown of the process:

---

### **Parsing Material Data**
The `.mtl` files are parsed using the `parseMTL` function in `modelLoader.js`. This function extracts:
- **Material Names (`newmtl`)**: Identifies different materials.
- **Diffuse Texture (`map_Kd`)**: Specifies the texture file to use for the material.

Parsed materials are stored in an array for further processing.

```javascript
function parseMTL(mtlText) {
    const materials = [];
    let currentMaterial = null;

    for (const line of mtlText.split('\n')) {
        const parts = line.trim().split(/\s+/);
        switch (parts[0]) {
            case 'newmtl':
                currentMaterial = { name: parts[1] };
                materials.push(currentMaterial);
                break;
            case 'map_Kd':
                currentMaterial.texture = parts[1];
                break;
        }
    }

    return materials;
}
```

This parsed material data is used in `loadOBJ` to associate materials with geometry groups.

---

### **Loading Textures**
Once the material data is parsed, the textures specified in the `.mtl` file are loaded into GPU memory using the `loadTexture` function in `utils.js`.

#### **Steps in Texture Loading**
1. **Fetch Texture File**:
   - The texture file is fetched using the URL specified in the `.mtl` file.
   - If the fetch fails, an error is logged.
   ```javascript
   const response = await fetch(url);
   const blob = await response.blob();
   const imageData = await createImageBitmap(blob);
   ```

2. **Create GPU Texture**:
   - A GPU texture is created with the size and format matching the loaded image.
   - The image data is then copied into the GPU texture.
   ```javascript
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
   ```

3. **Fallback for Missing Textures**:
   - If a texture is not specified, a default 1x1 white texture is created as a placeholder.
   ```javascript
   const whitePixel = new Uint8Array([255, 255, 255, 255]);
   device.queue.writeTexture(
       { texture: texture },
       whitePixel,
       { bytesPerRow: 4 },
       [1, 1]
   );
   ```

---

### **Binding Textures to the Pipeline**
Textures are bound to the pipeline using `BindGroups`, which group related resources like uniform buffers and samplers.

#### **Creating BindGroups**
For each material group, a `BindGroup` is created to associate the uniform buffer, texture, and sampler with the rendering pipeline.

```javascript
const bindGroup = device.createBindGroup({
    layout: pipeline.getBindGroupLayout(0),
    entries: [
        { binding: 0, resource: { buffer: uniformBuffer } },
        { binding: 1, resource: sampler },
        { binding: 2, resource: textures[index].createView() },
    ],
});
```

#### **Key BindGroup Components**
1. **Uniform Buffer**: Contains transformation matrices and lighting information.
2. **Sampler**: Specifies how the texture is sampled (e.g., filtering).
3. **Texture View**: Provides access to the loaded texture.

---

### **Using Textures in Shaders**
The fragment shader samples the texture using the provided UV coordinates and combines it with lighting calculations to produce the final pixel color.

#### **Fragment Shader Code**
```wgsl
@binding(1) @group(0) var mySampler: sampler;
@binding(2) @group(0) var myTexture: texture_2d<f32>;

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    let texColor = textureSample(myTexture, mySampler, input.texCoord);
    let finalColor = texColor.rgb * (ambient + diffuse) + vec3<f32>(specular);
    return vec4<f32>(finalColor, texColor.a);
}
```

---
### **Screenshot**
![alt text](/Interactive/Incremental%20Work/addingtexture.png)

### **Key Details**
- **Material Groups**: Each material group corresponds to a specific texture and set of rendering parameters.
- **Fallback Handling**: Missing textures are replaced with a default white texture to ensure rendering continuity.
- **Shader Integration**: Textures are sampled and combined with lighting in the fragment shader to produce realistic visuals.

This structured approach ensures that materials and textures are accurately loaded, managed, and rendered, providing flexibility for rendering complex 3D objects.



## How the Camera Is Setup

The camera in the project is set up as an **exploration camera**. This camera allows movement and rotation using mouse controls and adjusts its view dynamically based on user interactions. Below is a detailed breakdown:

---

### **Camera Position and Rotation**
The camera's position and rotation are controlled using the following variables in `main.js`:
- **`cameraPosition`**: Represents the camera's position in 3D space `[x, y, z]`.
- **`cameraRotation`**: Stores the rotation angles `[rotationX, rotationY]` around the X and Y axes.

```javascript
let cameraPosition = [0, 0, zoom]; // Initial camera position
let cameraRotation = [0, 0];       // Initial camera rotation
```

The camera's initial position places it at a distance (`zoom`) along the Z-axis, looking at the origin.

---

### **Camera Transformation Matrices**
The camera transformations are calculated using the **view matrix** and **projection matrix**:
1. **View Matrix**: Defines the camera's position and orientation in the scene.
   - Rotations are applied using `mat4.rotateX` and `mat4.rotateY`.
   - The camera is translated to its position using `mat4.translate`.

2. **Projection Matrix**: Defines how 3D points are projected onto the 2D screen.
   - Uses a perspective projection with a field of view (`fov`), aspect ratio, near, and far clipping planes.

The combined transformations result in the **Model-View-Projection (MVP) Matrix** used for rendering.

```javascript
function updateUniformBuffer() {
    const aspect = canvas.width / canvas.height;
    const projectionMatrix = mat4.perspective(mat4.create(), Math.PI / 4, aspect, 0.1, 100.0);

    const viewMatrix = mat4.create();
    mat4.rotateX(viewMatrix, viewMatrix, cameraRotation[0]);
    mat4.rotateY(viewMatrix, viewMatrix, cameraRotation[1]);
    mat4.translate(viewMatrix, viewMatrix, [-cameraPosition[0], -cameraPosition[1], -cameraPosition[2]]);

    const mvpMatrix = mat4.create();
    mat4.multiply(mvpMatrix, projectionMatrix, viewMatrix);
    device.queue.writeBuffer(uniformBuffer, 0, new Float32Array(mvpMatrix));
}
```

---

### **Mouse Controls for Camera Movement**
Mouse events allow the user to interact with the camera dynamically:
1. **Rotation**:  
   - Holding the left mouse button and dragging rotates the camera.
   - Movements along the X and Y axes update `cameraRotation`.

   ```javascript
   canvas.addEventListener('mousemove', (e) => {
       if (e.buttons === 1) { // Left mouse button
           cameraRotation[0] += e.movementY * 0.01;
           cameraRotation[1] += e.movementX * 0.01;
       }
   });
   ```

2. **Zoom**:  
   - The mouse wheel adjusts the `zoom` variable, which moves the camera closer or farther along the Z-axis.
   ```javascript
   canvas.addEventListener('wheel', (e) => {
       zoom += e.deltaY * 0.01;
       zoom = Math.max(1, Math.min(zoom, 20));
       cameraPosition[2] = zoom;
   });
   ```

3. **Panning**:  
   - Holding the right mouse button allows the user to pan the camera horizontally and vertically.
   - The camera's position (`cameraPosition`) is updated based on mouse movement.

   ```javascript
   canvas.addEventListener('mousedown', (e) => {
       if (e.button === 2) { // Right mouse button
           isPanning = true;
           lastPanPosition = { x: e.clientX, y: e.clientY };
       }
   });

   canvas.addEventListener('mousemove', (e) => {
       if (isPanning) {
           const deltaX = e.clientX - lastPanPosition.x;
           const deltaY = e.clientY - lastPanPosition.y;

           const panSpeed = 0.005;
           cameraPosition[0] -= deltaX * panSpeed;
           cameraPosition[1] += deltaY * panSpeed;

           lastPanPosition = { x: e.clientX, y: e.clientY };
       }
   });

   canvas.addEventListener('mouseup', (e) => {
       if (e.button === 2) {
           isPanning = false;
       }
   });
   ```

4. **Prevent Default Context Menu**:
   - Right-click functionality is customized for panning, so the default browser context menu is disabled.
   ```javascript
   canvas.addEventListener('contextmenu', (e) => e.preventDefault());
   ```

---

### **Key Details**
- **Dynamic Interaction**: The camera responds smoothly to user inputs, providing an intuitive way to explore the scene.
- **Zoom Constraints**: Limits ensure the camera stays within a usable range (`1` to `20` units).
- **Efficient Matrices**: Combining view and projection matrices into an MVP matrix optimizes rendering and ensures accurate perspective.

This setup allows users to freely navigate and explore the 3D scene using intuitive mouse interactions while maintaining a realistic perspective.



## How the Lights Are Set

Lighting in the project is implemented dynamically, allowing the user to adjust the light's position and intensity using a graphical user interface (GUI). Below is a detailed explanation of how the lighting system is set up and controlled.

---

### **Light Properties**
The light source is represented by the following properties stored in a `settings` object:
- **`lightPosX`**, **`lightPosY`**, **`lightPosZ`**: Define the position of the light in 3D space.
- **`lightIntensity`**: Controls the brightness of the light.

```javascript
const settings = {
    lightPosX: 5.0,
    lightPosY: 5.0,
    lightPosZ: 5.0,
    lightIntensity: 1.0,
};
```

These properties are passed to the shader via a uniform buffer, enabling real-time updates during rendering.

---

### **Integrating Lighting in the Shader**
The fragment shader incorporates the light properties to compute lighting effects such as ambient, diffuse, and specular lighting. These effects simulate realistic illumination on the object's surface.

#### **Fragment Shader Code**
```wgsl
struct Uniforms {
    ...
    lightPosition : vec4<f32>,
    lightIntensity : f32,
    ...
};
@binding(0) @group(0) var<uniform> uniforms : Uniforms;

@fragment
fn fragmentMain(input: VertexOutput) -> @location(0) vec4<f32> {
    let lightDir = normalize(uniforms.lightPosition.xyz - input.worldPos);
    let diffuse = uniforms.lightIntensity * max(dot(normal, lightDir), 0.0);
    let finalColor = texColor.rgb * (ambient + diffuse);
    return vec4<f32>(finalColor, texColor.a);
}
```

- **`lightPosition`**: Determines the direction of the light relative to each vertex.
- **`lightIntensity`**: Scales the brightness of the light's diffuse and specular components.

---

### **Dynamic Light Adjustment with GUI**
A `dat.GUI` interface allows the user to adjust light properties dynamically. The changes are reflected in real time, providing an interactive experience.

#### **Setting Up the GUI**
Sliders are added to control the light's position and intensity:

```javascript
const gui = new dat.GUI();
gui.add(settings, 'lightPosX', -10.0, 10.0).name('Light Position X');
gui.add(settings, 'lightPosY', -10.0, 10.0).name('Light Position Y');
gui.add(settings, 'lightPosZ', -10.0, 10.0).name('Light Position Z');
gui.add(settings, 'lightIntensity', 0.0, 10.0).name('Light Intensity');
```

- **`lightPosX`, `lightPosY`, `lightPosZ`**: Sliders range from `-10.0` to `10.0`, allowing the light to be positioned anywhere within the scene.
- **`lightIntensity`**: Ranges from `0.0` to `10.0`, enabling complete control over the light's brightness.

---
### **Screenshot**
![alt text](/Interactive/Incremental%20Work/datgui.png)

### **Updating Light Properties**
The updated light properties are passed to the GPU via a uniform buffer. This ensures that the rendering pipeline reflects the latest values set through the GUI.

#### **Uniform Buffer Update**
The light's position and intensity are written to the uniform buffer in the `updateUniformBuffer` function:

```javascript
function updateUniformBuffer() {
    const lightPosition = [settings.lightPosX, settings.lightPosY, settings.lightPosZ, 1.0];
    uniformData.set(lightPosition, 52); // Offset for light position
    uniformData[56] = settings.lightIntensity; // Offset for light intensity
    device.queue.writeBuffer(uniformBuffer, 0, uniformData);
}
```

- **`uniformData[52:55]`**: Stores the light's position.
- **`uniformData[56]`**: Stores the light's intensity.

---

### **Key Details**
- **Real-Time Control**: Adjustments made in the GUI are immediately reflected in the rendering output.
- **Flexible Positioning**: The sliders allow precise control of the light's position, enabling users to explore different illumination angles.
- **Interactive Feedback**: Changes to the light's intensity provide immediate visual feedback, enhancing the user experience.

This setup ensures that lighting remains dynamic and interactive, enabling users to experiment with various configurations to achieve the desired visual effects.


## Framebuffer Effects

Framebuffer effects allow the application to apply post-processing techniques to the rendered scene. These effects, such as grayscale and inverted colors, are applied to the output of the rendering pipeline before it is displayed on the screen. Below is a detailed breakdown of how framebuffer effects are implemented in the project:

---

### **Framebuffer Setup**
The `PostProcess` class manages framebuffer effects. It creates a **scene texture** to which the 3D scene is rendered. This texture is then processed to apply the desired effects.

#### **Scene Texture Creation**
A texture is created to store the rendered output of the 3D scene. This texture acts as the input for post-processing.

```javascript
this.sceneTexture = this.device.createTexture({
    size: [this.canvas.width, this.canvas.height],
    format: this.presentationFormat,
    usage: GPUTextureUsage.RENDER_ATTACHMENT | GPUTextureUsage.TEXTURE_BINDING,
});
```

---

### **Uniform Buffer for Effects**
A uniform buffer stores the selected effect mode (`effectMode`) and the canvas size. This data is passed to the fragment shader during post-processing.

```javascript
this.postProcessUniformBuffer = this.device.createBuffer({
    size: 16, // Effect mode (4 bytes) + padding (4 bytes) + canvas size (8 bytes)
    usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST,
});
```

The effect mode determines which post-processing effect is applied:
- **0**: No effect.
- **1**: Grayscale.
- **2**: Inverted colors.

---

### **Post-Processing Shader**
The shader processes the scene texture based on the selected effect mode. It samples the texture using UV coordinates and applies the corresponding effect.

#### **Shader Code**
```wgsl
struct Uniforms {
    effectMode : u32,
    padding : u32,
    canvasSize : vec2<f32>,
};
@binding(0) @group(0) var<uniform> uniforms : Uniforms;
@binding(1) @group(0) var mySampler: sampler;
@binding(2) @group(0) var myTexture: texture_2d<f32>;

@fragment
fn fragmentMain(@builtin(position) FragCoord : vec4<f32>) -> @location(0) vec4<f32> {
    let uv = FragCoord.xy / uniforms.canvasSize;
    var color = textureSample(myTexture, mySampler, uv);

    switch uniforms.effectMode {
        case 1u: { // Grayscale
            let gray = dot(color.rgb, vec3<f32>(0.299, 0.587, 0.114));
            color = vec4<f32>(vec3<f32>(gray), color.a);
        }
        case 2u: { // Invert Colors
            color = vec4<f32>(vec3<f32>(1.0) - color.rgb, color.a);
        }
        default: { /* No effect */ }
    }

    return color;
}
```

#### **Effect Breakdown**
1. **Grayscale**: Computes a weighted sum of the RGB components to produce a single intensity value.
   ```javascript
   let gray = dot(color.rgb, vec3<f32>(0.299, 0.587, 0.114));
   color = vec4<f32>(vec3<f32>(gray), color.a);
   ```
   ![alt text](/Interactive/Incremental%20Work/grey.png)

2. **Inverted Colors**: Subtracts the color from `1.0` to produce the inverse color.
   ```javascript
   color = vec4<f32>(vec3<f32>(1.0) - color.rgb, color.a);
   ```
   ![alt text](/Interactive/Incremental%20Work/invert.png)

---

### **Effect Selection**
Users can toggle between effects using buttons in the GUI. Each button sets the `effectMode` and updates the uniform buffer.

#### **Effect Buttons**
```javascript
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
```

---

### **Rendering with Framebuffer Effects**
The `PostProcess` class handles rendering the scene texture to the screen after applying the selected effect.

#### **Render Scene to Texture**
The 3D scene is rendered to the `sceneTexture`:
```javascript
postProcess.renderSceneToTexture(renderSceneFunction);
```

#### **Post-Process Rendering**
The processed texture is rendered to the screen using a full-screen quad:
```javascript
passEncoder.setPipeline(this.postProcessPipeline);
passEncoder.setBindGroup(0, this.postProcessBindGroup);
passEncoder.draw(6); // Full-screen quad
```

---

### **Key Details**
- **Real-Time Effects**: Changes to the effect mode are applied immediately, providing instant feedback.
- **Flexible Shader Design**: The switch-case structure in the fragment shader allows easy addition of new effects.
- **Performance Optimization**: Rendering the scene to a texture ensures that effects are applied efficiently without re-rendering the 3D geometry.

This system enables dynamic post-processing effects, enhancing the visual appeal and interactivity of the application.


## Keystroke Interactions

Keystroke interactions allow users to dynamically interact with the rendered scene using keyboard inputs. These interactions enable functionalities such as toggling rotation, navigating objects, and changing settings. Below is a detailed explanation of how keystroke interactions are implemented.

---

### **Key Interactions**
The application listens for `keydown` events to detect user input and trigger specific actions.

#### **Toggling Rotation**
The `R` key is used to toggle the automatic rotation of the object.

```javascript
let isRotating = false; // Indicates whether the object is rotating automatically

window.addEventListener('keydown', (e) => {
    if (e.key === 'r' || e.key === 'R') {
        isRotating = !isRotating; // Toggle rotation state
        updateRotationStatus(); // Update the rotation status display
    }
});

function updateRotationStatus() {
    const statusElement = document.getElementById('rotationStatus');
    statusElement.textContent = `Rotation (Press R): ${isRotating ? 'On' : 'Off'}`;
}
```

- **`isRotating`**: A boolean flag to track whether rotation is enabled.
- **Visual Feedback**: The `rotationStatus` element updates to reflect the current rotation state.

---

### **Navigation Between Objects**
The application allows users to navigate through different objects using the `Next` and `Previous` buttons, which are linked to key interactions.

```javascript
document.getElementById('nextButton').addEventListener('click', async () => {
    currentObjectIndex = (currentObjectIndex + 1) % objects.length;
    materialDataArray = await loadObject(currentObjectIndex);
});

document.getElementById('prevButton').addEventListener('click', async () => {
    currentObjectIndex = (currentObjectIndex - 1 + objects.length) % objects.length;
    materialDataArray = await loadObject(currentObjectIndex);
});
```

- **`currentObjectIndex`**: Tracks the index of the currently displayed object.
- **Object Cycling**: The `%` operator ensures that navigation loops through the available objects.

---

### **Rotation During Animation**
When rotation is toggled, the object rotates continuously during the animation frame updates. The rotation logic is controlled by the `isRotating` flag in the `frame` function.

```javascript
function frame() {
    if (isRotating) {
        rotationY += 0.01; // Adjust rotation speed as needed
    }
    updateUniformBuffer();
    render();
    requestAnimationFrame(frame);
}
```

- **`rotationY`**: Incremented on each frame to rotate the object around the Y-axis.
- **Dynamic Updates**: The rotation state is checked on every frame, ensuring smooth toggling.

---

### **Key Details**
- **Immediate Feedback**: Rotation status updates instantly upon pressing `R`.
- **Flexible Navigation**: Users can switch between objects seamlessly using keyboard shortcuts or buttons.
- **Smooth Animation**: Continuous rotation integrates smoothly with the rendering pipeline.

This system enhances user interactivity, making the application more engaging and intuitive.
