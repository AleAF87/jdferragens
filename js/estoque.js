import { database } from './firebase-config.js';
import { ref, get, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { uploadImagemCloudinary } from './cloudinary-config.js';

let products = [];
let selectedProduct = null;
let pendingImages = [];
let removedImageKeys = new Set();

function getById(id) {
    return document.getElementById(id);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function formatBRL(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(Number(value || 0));
}

function parseNumber(value) {
    const raw = String(value || '').trim().replace(/\./g, '').replace(',', '.');
    const parsed = Number(raw);
    return Number.isFinite(parsed) ? parsed : 0;
}

function normalizeImages(product) {
    const imagens = product?.imagens;
    if (Array.isArray(imagens)) return imagens.filter(Boolean);
    if (imagens && typeof imagens === 'object') return Object.values(imagens).filter(Boolean);

    const linkProd = product?.link_prod;
    if (Array.isArray(linkProd)) {
        return linkProd.filter(Boolean).map((url, index) => ({ url, publicId: `link_${index}` }));
    }
    if (linkProd && typeof linkProd === 'object') {
        return Object.entries(linkProd).map(([key, url]) => ({ url, publicId: key }));
    }

    return [];
}

function getImageKey(image, index) {
    return image?.publicId || image?.url || `image_${index}`;
}

function revokePendingPreviews() {
    pendingImages.forEach((item) => {
        if (item.previewUrl) URL.revokeObjectURL(item.previewUrl);
    });
    pendingImages = [];
}

async function loadProducts() {
    const snapshot = await get(ref(database, 'produtos'));
    products = Object.entries(snapshot.val() || {})
        .filter(([id]) => id !== 'link_prod')
        .map(([id, product]) => ({ id, ...product }))
        .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' }));
}

function renderProducts() {
    const content = getById('estoque-content');
    if (!content) return;

    if (!products.length) {
        content.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <h2>Nenhum produto cadastrado</h2>
                <p>Os produtos salvos em cadastro aparecerao aqui.</p>
            </div>
        `;
        return;
    }

    content.innerHTML = `
        <div class="table-responsive">
            <table class="table align-middle">
                <thead>
                    <tr>
                        <th>Codigo</th>
                        <th>Produto</th>
                        <th>Quantidade</th>
                        <th>Preco</th>
                        <th>Descricao</th>
                        <th class="text-end">Acoes</th>
                    </tr>
                </thead>
                <tbody>
                    ${products.map((product) => `
                        <tr>
                            <td>${escapeHtml(product.codigo || product.id)}</td>
                            <td>${escapeHtml(product.nome || '-')}</td>
                            <td>${escapeHtml(product.quantidade ?? 0)}</td>
                            <td>${escapeHtml(formatBRL(product.preco || 0))}</td>
                            <td>${escapeHtml(product.descricao || '-')}</td>
                            <td class="text-end">
                                <button class="btn btn-sm btn-outline-primary" type="button" data-edit-product="${escapeHtml(product.id)}">
                                    <i class="fas fa-pen me-1"></i>Editar
                                </button>
                            </td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
        ${renderEditModal()}
    `;
}

function renderEditModal() {
    return `
        <div class="modal fade" id="produtoEditModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-xl modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Editar item do estoque</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
                    </div>
                    <div class="modal-body">
                        <form id="produtoEditForm" class="row g-3">
                            <div class="col-12 col-lg-3">
                                <label class="form-label" for="editProdutoCodigo">Codigo</label>
                                <input id="editProdutoCodigo" class="form-control" disabled>
                            </div>
                            <div class="col-12 col-lg-5">
                                <label class="form-label" for="editProdutoNome">Produto</label>
                                <input id="editProdutoNome" class="form-control" required>
                            </div>
                            <div class="col-12 col-lg-2">
                                <label class="form-label" for="editProdutoQuantidade">Quantidade</label>
                                <input id="editProdutoQuantidade" class="form-control" type="number" min="0" step="1">
                            </div>
                            <div class="col-12 col-lg-2">
                                <label class="form-label" for="editProdutoPreco">Preco</label>
                                <input id="editProdutoPreco" class="form-control" type="number" min="0" step="0.01">
                            </div>
                            <div class="col-12">
                                <label class="form-label" for="editProdutoDescricao">Descricao</label>
                                <textarea id="editProdutoDescricao" class="form-control" rows="3"></textarea>
                            </div>
                            <div class="col-12">
                                <div class="d-flex flex-column flex-md-row justify-content-between gap-2 align-items-md-center">
                                    <div>
                                        <label class="form-label mb-1">Imagens</label>
                                        <div class="form-text">As imagens novas serao enviadas para a pasta Cloudinary produtos ao salvar.</div>
                                    </div>
                                    <div>
                                        <input id="produtoImagemInput" type="file" class="d-none" multiple accept=".jpg,.jpeg,.png,.webp">
                                        <button id="addProdutoImagemBtn" type="button" class="btn btn-outline-primary">
                                            <i class="fas fa-plus me-2"></i>Adicionar imagem
                                        </button>
                                    </div>
                                </div>
                                <div id="produtoImagesGrid" class="product-image-grid mt-3"></div>
                            </div>
                        </form>
                        <div id="produtoEditAlert" class="alert mt-3 d-none"></div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Cancelar</button>
                        <button id="saveProdutoBtn" type="button" class="btn btn-primary">
                            <i class="fas fa-save me-2"></i>Salvar
                        </button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function showEditAlert(message, type = 'info') {
    const alert = getById('produtoEditAlert');
    if (!alert) return;
    alert.className = `alert alert-${type} mt-3`;
    alert.textContent = message;
}

function renderImages() {
    const grid = getById('produtoImagesGrid');
    if (!grid || !selectedProduct) return;

    const savedImages = normalizeImages(selectedProduct)
        .map((image, index) => ({ image, index, key: getImageKey(image, index) }))
        .filter((item) => !removedImageKeys.has(item.key));

    grid.innerHTML = `
        ${savedImages.map(({ image, key }) => `
            <article class="product-image-card">
                <img src="${escapeHtml(image.url || image.secure_url || image)}" alt="Imagem do produto">
                <div class="product-image-card-actions">
                    <a class="btn btn-sm btn-light" href="${escapeHtml(image.url || image.secure_url || image)}" target="_blank" rel="noopener noreferrer" title="Abrir imagem">
                        <i class="fas fa-eye"></i>
                    </a>
                    <button class="btn btn-sm btn-outline-danger" type="button" data-remove-saved-image="${escapeHtml(key)}" title="Remover imagem">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </article>
        `).join('')}
        ${pendingImages.map((item, index) => `
            <article class="product-image-card is-pending">
                <img src="${escapeHtml(item.previewUrl)}" alt="Imagem pendente">
                <div class="product-image-card-actions">
                    <span class="badge text-bg-warning">Pendente</span>
                    <button class="btn btn-sm btn-outline-danger" type="button" data-remove-pending-image="${index}" title="Remover imagem pendente">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </article>
        `).join('')}
        ${(!savedImages.length && !pendingImages.length) ? '<div class="text-muted">Nenhuma imagem cadastrada.</div>' : ''}
    `;
}

function openEditModal(productId) {
    selectedProduct = products.find((product) => product.id === productId);
    if (!selectedProduct) return;

    revokePendingPreviews();
    removedImageKeys = new Set();

    getById('editProdutoCodigo').value = selectedProduct.codigo || selectedProduct.id;
    getById('editProdutoNome').value = selectedProduct.nome || '';
    getById('editProdutoQuantidade').value = Number(selectedProduct.quantidade || 0);
    getById('editProdutoPreco').value = Number(selectedProduct.preco || 0);
    getById('editProdutoDescricao').value = selectedProduct.descricao || '';
    showEditAlert('', 'info');
    getById('produtoEditAlert')?.classList.add('d-none');
    renderImages();

    const modal = getById('produtoEditModal');
    if (modal && window.bootstrap) {
        window.bootstrap.Modal.getOrCreateInstance(modal).show();
    }
}

function bindEvents() {
    const content = getById('estoque-content');
    if (!content) return;

    content.onclick = async (event) => {
        const editButton = event.target.closest('[data-edit-product]');
        if (editButton) {
            openEditModal(editButton.getAttribute('data-edit-product'));
            return;
        }

        const addImageButton = event.target.closest('#addProdutoImagemBtn');
        if (addImageButton) {
            getById('produtoImagemInput')?.click();
            return;
        }

        const removeSavedButton = event.target.closest('[data-remove-saved-image]');
        if (removeSavedButton) {
            removedImageKeys.add(removeSavedButton.getAttribute('data-remove-saved-image'));
            renderImages();
            return;
        }

        const removePendingButton = event.target.closest('[data-remove-pending-image]');
        if (removePendingButton) {
            const index = Number(removePendingButton.getAttribute('data-remove-pending-image'));
            const item = pendingImages[index];
            if (item?.previewUrl) URL.revokeObjectURL(item.previewUrl);
            pendingImages.splice(index, 1);
            renderImages();
            return;
        }

        const saveButton = event.target.closest('#saveProdutoBtn');
        if (saveButton) await saveSelectedProduct(saveButton);
    };

    content.onchange = (event) => {
        if (event.target?.id !== 'produtoImagemInput') return;
        const files = Array.from(event.target.files || []);
        pendingImages.push(...files.map((file) => ({
            file,
            previewUrl: URL.createObjectURL(file)
        })));
        event.target.value = '';
        renderImages();
    };
}

function closeEditModal() {
    const modal = getById('produtoEditModal');
    if (modal && window.bootstrap) {
        const instance = window.bootstrap.Modal.getInstance(modal) || window.bootstrap.Modal.getOrCreateInstance(modal);
        instance.hide();
    }

    setTimeout(() => {
        document.querySelectorAll('.modal-backdrop').forEach((backdrop) => backdrop.remove());
        document.body.classList.remove('modal-open');
        document.body.style.removeProperty('overflow');
        document.body.style.removeProperty('padding-right');
    }, 150);
}

async function uploadPendingImages() {
    const uploaded = [];

    for (const item of pendingImages) {
        const result = await uploadImagemCloudinary(item.file, 'produtos');
        uploaded.push(result);
    }

    return uploaded;
}

async function saveSelectedProduct(button) {
    if (!selectedProduct) return;

    const originalHtml = button.innerHTML;

    try {
        button.disabled = true;
        button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Salvando...';

        const existingImages = normalizeImages(selectedProduct)
            .map((image, index) => ({ image, key: getImageKey(image, index) }))
            .filter((item) => !removedImageKeys.has(item.key))
            .map((item) => item.image);

        const uploadedImages = await uploadPendingImages();
        const imagens = [...existingImages, ...uploadedImages];

        const updates = {
            codigo: selectedProduct.codigo || selectedProduct.id,
            nome: String(getById('editProdutoNome')?.value || '').trim(),
            quantidade: Math.max(0, Math.floor(Number(getById('editProdutoQuantidade')?.value || 0))),
            preco: parseNumber(getById('editProdutoPreco')?.value || 0),
            descricao: String(getById('editProdutoDescricao')?.value || '').trim(),
            imagens,
            atualizadoEm: new Date().toISOString(),
            atualizadoPor: sessionStorage.getItem('userCPF') || ''
        };

        if (!updates.nome) {
            showEditAlert('Informe o nome do produto.', 'warning');
            return;
        }

        await update(ref(database, `produtos/${selectedProduct.id}`), updates);

        revokePendingPreviews();
        removedImageKeys = new Set();
        closeEditModal();
        await loadProducts();
        renderProducts();
        bindEvents();
    } catch (error) {
        console.error('Erro ao salvar produto:', error);
        showEditAlert(`Erro ao salvar produto: ${error.message}`, 'danger');
    } finally {
        button.disabled = false;
        button.innerHTML = originalHtml;
    }
}

export async function initPage() {
    const content = getById('estoque-content');
    if (!content) return;

    try {
        await loadProducts();
        renderProducts();
        bindEvents();
    } catch (error) {
        console.error('Erro ao carregar estoque:', error);
        content.innerHTML = `
            <div class="alert alert-danger mb-0">
                <h4 class="alert-heading">Erro ao carregar estoque</h4>
                <p class="mb-0">${escapeHtml(error.message || 'Erro desconhecido.')}</p>
            </div>
        `;
    }
}

if (!window.location.pathname.includes('app.html')) {
    document.addEventListener('DOMContentLoaded', initPage);
}
