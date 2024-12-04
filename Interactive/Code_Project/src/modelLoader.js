export async function loadOBJ(objUrl, mtlUrl) {
    const [objResponse, mtlResponse] = await Promise.all([
        fetch(objUrl),
        fetch(mtlUrl)
    ]);
    const [objText, mtlText] = await Promise.all([
        objResponse.text(),
        mtlResponse.text()
    ]);

    const materials = parseMTL(mtlText);
    const materialNameToIndex = {};
    materials.forEach((mat, index) => {
        materialNameToIndex[mat.name] = index;
    });

    const positions = [];
    const normals = [];
    const texCoords = [];
    const materialGroups = []; // Array to hold groups of indices per material

    // Temporary arrays
    const tempPositions = [];
    const tempNormals = [];
    const tempTexCoords = [];

    let currentMaterialIndex = -1;

    const lines = objText.split('\n');
    for (const line of lines) {
        const parts = line.trim().split(/\s+/);
        switch (parts[0]) {
            case 'v':
                tempPositions.push([
                    parseFloat(parts[1]),
                    parseFloat(parts[2]),
                    parseFloat(parts[3])
                ]);
                break;
            case 'vn':
                tempNormals.push([
                    parseFloat(parts[1]),
                    parseFloat(parts[2]),
                    parseFloat(parts[3])
                ]);
                break;
            case 'vt':
                tempTexCoords.push([
                    parseFloat(parts[1]),
                    1 - parseFloat(parts[2]) // Flip Y coordinate
                ]);
                break;
            case 'usemtl':
                currentMaterialIndex = materialNameToIndex[parts[1]];
                if (currentMaterialIndex === undefined) {
                    console.warn(`Material ${parts[1]} not found.`);
                    currentMaterialIndex = -1;
                }
                if (!materialGroups[currentMaterialIndex]) {
                    materialGroups[currentMaterialIndex] = {
                        indices: [],
                        positions: [],
                        normals: [],
                        texCoords: [],
                    };
                }
                break;
            case 'f':
                if (currentMaterialIndex === -1) {
                    console.warn('Face without material, skipping.');
                    continue;
                }
                const group = materialGroups[currentMaterialIndex];
                for (let i = 1; i <= 3; i++) {
                    const indices = parts[i].split('/');
                    const v = parseInt(indices[0]) - 1;
                    const vt = indices[1] !== undefined && indices[1] !== '' ? parseInt(indices[1]) - 1 : null;
                    const vn = indices[2] !== undefined && indices[2] !== '' ? parseInt(indices[2]) - 1 : null;

                    group.positions.push(...tempPositions[v]);

                    // Handle texture coordinates
                    if (vt !== null && tempTexCoords[vt]) {
                        group.texCoords.push(...tempTexCoords[vt]);
                    } else {
                        // Default texture coordinates if missing
                        group.texCoords.push(0, 0);
                    }

                    // Handle normals
                    if (vn !== null && tempNormals[vn]) {
                        group.normals.push(...tempNormals[vn]);
                    } else {
                        // Default normal if missing
                        group.normals.push(0, 0, 1);
                    }

                    group.indices.push(group.indices.length);
                }
                break;
        }
    }

    return {
        materialGroups,
        materials,
    };
}

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