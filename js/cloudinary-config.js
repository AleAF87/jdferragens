const cloudinaryConfig = {
    cloudName: 'dm2yqgi18',
    uploadPreset: 'jd_anexos',
    apiKey: '175315593378336',
    apiSecret: 'HuSVguSlnraby1fVORRS5JdLkd0',
    folder: 'produtos'
};

export async function uploadImagemCloudinary(file, folder = cloudinaryConfig.folder) {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('upload_preset', cloudinaryConfig.uploadPreset);
    formData.append('folder', folder || cloudinaryConfig.folder);

    const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/auto/upload`, {
        method: 'POST',
        body: formData
    });

    if (!response.ok) {
        throw new Error('Erro no upload da imagem para o Cloudinary.');
    }

    const data = await response.json();
    return {
        url: data.secure_url,
        publicId: data.public_id,
        width: data.width,
        height: data.height,
        format: data.format,
        nome: file.name,
        tamanho: file.size,
        tipo: file.type,
        criadoEm: new Date().toISOString()
    };
}

async function gerarAssinatura(publicId, timestamp) {
    const payload = `public_id=${publicId}&timestamp=${timestamp}${cloudinaryConfig.apiSecret}`;
    const encoded = new TextEncoder().encode(payload);
    const digest = await crypto.subtle.digest('SHA-1', encoded);
    return Array.from(new Uint8Array(digest))
        .map((byte) => byte.toString(16).padStart(2, '0'))
        .join('');
}

export async function deletarImagemCloudinary(publicId) {
    if (!publicId) return true;

    const timestamp = Math.floor(Date.now() / 1000);
    const signature = await gerarAssinatura(publicId, timestamp);
    const resourceTypes = ['image', 'raw'];

    for (const resourceType of resourceTypes) {
        const formData = new FormData();
        formData.append('public_id', publicId);
        formData.append('timestamp', timestamp);
        formData.append('api_key', cloudinaryConfig.apiKey);
        formData.append('signature', signature);

        const response = await fetch(`https://api.cloudinary.com/v1_1/${cloudinaryConfig.cloudName}/${resourceType}/destroy`, {
            method: 'POST',
            body: formData
        });

        if (!response.ok) continue;

        const data = await response.json();
        if (data.result === 'ok' || data.result === 'not found') {
            return true;
        }
    }

    throw new Error('Falha ao excluir imagem no Cloudinary.');
}

export default cloudinaryConfig;
