const cloudinaryConfig = {
    cloudName: 'dm2yqgi18',
    uploadPreset: 'jd_anexos',
    apiKey: '175315593378336',
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

export async function deletarImagemCloudinary() {
    throw new Error('Remocao fisica no Cloudinary exige backend seguro. A imagem sera removida do produto no Firebase.');
}

export default cloudinaryConfig;
