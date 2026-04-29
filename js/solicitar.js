import { database } from './firebase-config.js';
import { ref, get, push, update, runTransaction } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const state = {
    produtos: [],
    solicitantes: [],
    filtro: '',
    carrinho: new Map()
};

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

function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

function formatCPF(cpf) {
    const digits = onlyDigits(cpf);
    if (digits.length !== 11) return cpf || '';
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function parseStockQuantity(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
}

function renderSolicitanteSelect() {
    const select = getById('solicitanteSelect');
    if (!select) return;

    const currentUserCpf = sessionStorage.getItem('userCPF') || '';
    const selectedCpf = select.value || currentUserCpf;

    if (!state.solicitantes.length) {
        select.innerHTML = '<option value="">Nenhum usuário cadastrado</option>';
        return;
    }

    select.innerHTML = state.solicitantes.map((user) => `
        <option value="${escapeHtml(user.cpf)}" ${user.cpf === selectedCpf ? 'selected' : ''}>
            ${escapeHtml(user.nome || 'Usuário')} - ${escapeHtml(formatCPF(user.cpf))}
        </option>
    `).join('');
}

function getSolicitanteSelecionado() {
    const selectedCpf = getById('solicitanteSelect')?.value || sessionStorage.getItem('userCPF') || '';
    return state.solicitantes.find((user) => user.cpf === selectedCpf) || {
        cpf: selectedCpf,
        nome: sessionStorage.getItem('userName') || 'Usuário'
    };
}

function showAlert(message, type = 'info') {
    const alert = getById('solicitarAlert');
    if (!alert) return;
    alert.className = `alert alert-${type} mt-3`;
    alert.textContent = message;
    alert.classList.remove('d-none');
}

function getProdutoById(produtoId) {
    return state.produtos.find((produto) => produto.id === produtoId);
}

function getCarrinhoItens() {
    return Array.from(state.carrinho.entries())
        .map(([produtoId, quantidade]) => {
            const produto = getProdutoById(produtoId);
            const precoUnitario = Number(produto?.preco || 0);
            return {
                produtoId,
                codigo: produto?.codigo || produtoId,
                nome: produto?.nome || 'Produto',
                quantidade,
                estoque: parseStockQuantity(produto?.quantidade),
                precoUnitario,
                subtotal: quantidade * precoUnitario
            };
        })
        .filter((item) => item.quantidade > 0);
}

function renderProdutos() {
    const container = getById('solicitarProdutos');
    if (!container) return;

    const filtro = state.filtro.toLowerCase();
    const produtos = state.produtos.filter((produto) => {
        const searchable = `${produto.codigo || ''} ${produto.nome || ''}`.toLowerCase();
        return searchable.includes(filtro);
    });

    if (!produtos.length) {
        container.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-box-open"></i>
                <h2>Nenhum produto encontrado</h2>
                <p>Confira o estoque ou tente outra busca.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="table-responsive">
            <table class="table align-middle">
                <thead>
                    <tr>
                        <th>Produto</th>
                        <th>Estoque</th>
                        <th>Valor</th>
                        <th>Qtd.</th>
                    </tr>
                </thead>
                <tbody>
                    ${produtos.map((produto) => {
                        const estoque = Number(produto.quantidade || 0);
                        const quantidade = state.carrinho.get(produto.id) || 0;
                        return `
                            <tr>
                                <td>${escapeHtml(produto.nome || '-')}</td>
                                <td>${estoque}</td>
                                <td>${escapeHtml(formatBRL(produto.preco || 0))}</td>
                                <td>
                                    <div class="order-add-control">
                                        <input class="form-control order-qty-input"
                                               type="number"
                                               min="1"
                                               max="${estoque}"
                                               step="1"
                                               value="${quantidade || 1}"
                                               data-qty-produto-id="${escapeHtml(produto.id)}"
                                               ${estoque <= 0 ? 'disabled' : ''}>
                                        <button class="btn btn-primary order-add-btn"
                                                type="button"
                                                data-add-produto-id="${escapeHtml(produto.id)}"
                                                title="Adicionar ao carrinho"
                                                ${estoque <= 0 ? 'disabled' : ''}>
                                            <i class="fas fa-plus"></i>
                                        </button>
                                    </div>
                                </td>
                            </tr>
                        `;
                    }).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderCarrinho() {
    const container = getById('solicitarCarrinho');
    const submitBtn = getById('enviarSolicitacaoBtn');
    if (!container || !submitBtn) return;

    const itens = getCarrinhoItens();
    const total = itens.reduce((sum, item) => sum + item.subtotal, 0);
    submitBtn.disabled = itens.length === 0;

    if (!itens.length) {
        container.innerHTML = `
            <div class="empty-cart">
                <i class="fas fa-cart-shopping"></i>
                <p class="mb-0">Selecione as quantidades no estoque.</p>
            </div>
        `;
        return;
    }

    container.innerHTML = `
        <div class="order-cart-list">
            ${itens.map((item) => `
                <div class="order-cart-item">
                    <div>
                        <strong>${escapeHtml(item.nome)}</strong>
                        <span>${escapeHtml(formatBRL(item.precoUnitario))} cada</span>
                    </div>
                    <div class="order-cart-controls" aria-label="Quantidade de ${escapeHtml(item.nome)}">
                        <button class="btn btn-outline-secondary order-cart-step"
                                type="button"
                                data-cart-decrease-id="${escapeHtml(item.produtoId)}"
                                title="Diminuir quantidade">
                            <i class="fas fa-minus"></i>
                        </button>
                        <input class="form-control order-cart-qty-input"
                               type="number"
                               min="1"
                               max="${item.estoque}"
                               step="1"
                               value="${item.quantidade}"
                               data-cart-qty-id="${escapeHtml(item.produtoId)}"
                               aria-label="Quantidade">
                        <button class="btn btn-outline-secondary order-cart-step"
                                type="button"
                                data-cart-increase-id="${escapeHtml(item.produtoId)}"
                                title="Aumentar quantidade"
                                ${item.quantidade >= item.estoque ? 'disabled' : ''}>
                            <i class="fas fa-plus"></i>
                        </button>
                    </div>
                    <strong>${escapeHtml(formatBRL(item.subtotal))}</strong>
                </div>
            `).join('')}
        </div>
        <div class="order-total-row mt-3">
            <span>Total</span>
            <strong>${escapeHtml(formatBRL(total))}</strong>
        </div>
    `;
}

function handleAddToCart(event) {
    const button = event.target.closest('[data-add-produto-id]');
    if (!button) return;

    const produtoId = button.getAttribute('data-add-produto-id');
    const produto = getProdutoById(produtoId);
    const estoque = Number(produto?.quantidade || 0);
    const input = document.querySelector(`[data-qty-produto-id="${CSS.escape(produtoId)}"]`);
    const quantidadeAtual = Number(state.carrinho.get(produtoId) || 0);
    let quantidade = Math.floor(Number(input.value || 0));

    if (quantidade <= 0) {
        showAlert('Informe uma quantidade maior que zero.', 'warning');
        input.focus();
        return;
    }

    if (quantidadeAtual + quantidade > estoque) {
        quantidade = Math.max(0, estoque - quantidadeAtual);
        showAlert('Quantidade ajustada ao estoque disponível.', 'warning');
    }

    if (quantidade <= 0) {
        showAlert('Este item já atingiu a quantidade disponível em estoque.', 'warning');
        input.value = 1;
        return;
    }

    state.carrinho.set(produtoId, quantidadeAtual + quantidade);
    input.value = 1;

    renderProdutos();
    renderCarrinho();
}

function updateCartQuantity(produtoId, quantidade) {
    const produto = getProdutoById(produtoId);
    const estoque = parseStockQuantity(produto?.quantidade);
    let normalizedQuantity = Math.floor(Number(quantidade || 0));

    if (normalizedQuantity <= 0) {
        state.carrinho.delete(produtoId);
    } else {
        if (normalizedQuantity > estoque) {
            normalizedQuantity = estoque;
            showAlert('Quantidade ajustada ao estoque disponível.', 'warning');
        }
        state.carrinho.set(produtoId, normalizedQuantity);
    }

    renderProdutos();
    renderCarrinho();
}

function handleCartControls(event) {
    const decreaseButton = event.target.closest('[data-cart-decrease-id]');
    const increaseButton = event.target.closest('[data-cart-increase-id]');

    if (decreaseButton || increaseButton) {
        const produtoId = (decreaseButton || increaseButton).getAttribute(decreaseButton ? 'data-cart-decrease-id' : 'data-cart-increase-id');
        const currentQuantity = Number(state.carrinho.get(produtoId) || 0);
        updateCartQuantity(produtoId, currentQuantity + (increaseButton ? 1 : -1));
    }
}

function handleCartQuantityChange(event) {
    const input = event.target.closest('[data-cart-qty-id]');
    if (!input) return;
    updateCartQuantity(input.getAttribute('data-cart-qty-id'), input.value);
}

async function carregarProdutos() {
    const snapshot = await get(ref(database, 'produtos'));
    state.produtos = Object.entries(snapshot.val() || {})
        .map(([id, produto]) => ({
            id,
            codigo: produto?.codigo || id,
            nome: produto?.nome || '',
            quantidade: Number(produto?.quantidade || 0),
            preco: Number(produto?.preco || 0),
            descricao: produto?.descricao || ''
        }))
        .sort((a, b) => String(a.nome).localeCompare(String(b.nome)));
}

async function carregarSolicitantes() {
    const [usuariosSnapshot, loginSnapshot] = await Promise.all([
        get(ref(database, 'usuarios')),
        get(ref(database, 'login'))
    ]);

    const usuarios = usuariosSnapshot.val() || {};
    const login = loginSnapshot.val() || {};
    const cpfs = new Set([...Object.keys(usuarios), ...Object.keys(login)]);
    const currentUserCpf = sessionStorage.getItem('userCPF') || '';

    state.solicitantes = Array.from(cpfs)
        .map((cpf) => ({
            cpf,
            ...(login?.[cpf] || {}),
            ...(usuarios?.[cpf] || {})
        }))
        .filter((user) => user.cpf)
        .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' }));

    if (currentUserCpf && !state.solicitantes.some((user) => user.cpf === currentUserCpf)) {
        state.solicitantes.unshift({
            cpf: currentUserCpf,
            nome: sessionStorage.getItem('userName') || 'Usuário'
        });
    }
}

async function getLatestCartItems() {
    await carregarProdutos();

    return getCarrinhoItens().map((item) => {
        const produto = getProdutoById(item.produtoId);
        return {
            ...item,
            estoqueAtual: parseStockQuantity(produto?.quantidade)
        };
    });
}

async function reserveStockForRequest(itens) {
    const reservedItems = [];

    for (const item of itens) {
        const quantityRef = ref(database, `produtos/${item.produtoId}/quantidade`);
        const quantitySnapshot = await get(quantityRef);
        const latestStock = parseStockQuantity(quantitySnapshot.val());

        if (!quantitySnapshot.exists()) {
            throw new Error(`Produto não encontrado no estoque: ${item.nome}.`);
        }

        if (latestStock < item.quantidade) {
            throw new Error(`Estoque insuficiente para ${item.nome}. Disponível: ${latestStock}. Solicitado: ${item.quantidade}.`);
        }

        const result = await runTransaction(quantityRef, (currentValue) => {
            const currentStock = currentValue === null || currentValue === undefined
                ? latestStock
                : parseStockQuantity(currentValue);
            if (currentStock < item.quantidade) return;
            return currentStock - item.quantidade;
        }, { applyLocally: false });

        if (!result.committed) {
            const updatedSnapshot = await get(quantityRef);
            const updatedStock = parseStockQuantity(updatedSnapshot.val());
            throw new Error(`Estoque insuficiente para ${item.nome}. Disponível: ${updatedStock}. Solicitado: ${item.quantidade}.`);
        }

        reservedItems.push(item);
    }

    return reservedItems;
}

async function rollbackReservedStock(itens) {
    await Promise.all((itens || []).map((item) => {
        const quantityRef = ref(database, `produtos/${item.produtoId}/quantidade`);
        return runTransaction(quantityRef, (currentValue) => parseStockQuantity(currentValue) + Number(item.quantidade || 0), { applyLocally: false });
    }));
}

async function enviarSolicitacao() {
    const submitBtn = getById('enviarSolicitacaoBtn');
    const originalHtml = submitBtn?.innerHTML;
    let reservedItems = [];

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Enviando...';
        }

        const itens = await getLatestCartItems();
        if (!itens.length) return;

        const insufficientItem = itens.find((item) => item.estoqueAtual < item.quantidade);
        if (insufficientItem) {
            throw new Error(`Estoque insuficiente para ${insufficientItem.nome}. Disponível: ${insufficientItem.estoqueAtual}. Solicitado: ${insufficientItem.quantidade}.`);
        }

        const now = new Date().toISOString();
        const solicitante = getSolicitanteSelecionado();
        const solicitanteCpf = solicitante.cpf || sessionStorage.getItem('userCPF') || '';
        const solicitanteNome = solicitante.nome || sessionStorage.getItem('userName') || 'Usuário';
        const total = itens.reduce((sum, item) => sum + item.subtotal, 0);
        const quantidadeItens = itens.reduce((sum, item) => sum + item.quantidade, 0);
        const solicitacaoRef = push(ref(database, 'solicitacoes'));
        const solicitacaoId = solicitacaoRef.key;
        reservedItems = await reserveStockForRequest(itens);

        const payload = {
            id: solicitacaoId,
            solicitanteCpf,
            solicitanteNome,
            status: 'solicitado',
            statusLabel: 'Aguardando separação',
            itens,
            total,
            quantidadeItens,
            criadoEm: now,
            atualizadoEm: now
        };

        const resumoUsuario = {
            id: solicitacaoId,
            status: payload.status,
            statusLabel: payload.statusLabel,
            total,
            quantidadeItens,
            solicitanteCpf,
            solicitanteNome,
            criadoEm: now,
            atualizadoEm: now,
            itens
        };

        await update(ref(database), {
            [`solicitacoes/${solicitacaoId}`]: payload,
            [`usuariosSolicitacoes/${solicitanteCpf}/${solicitacaoId}`]: resumoUsuario
        });

        state.carrinho.clear();
        await carregarProdutos();
        renderProdutos();
        renderCarrinho();
        showAlert('Solicitação enviada. Aguarde a separação dos itens.', 'success');
    } catch (error) {
        if (reservedItems.length) {
            await rollbackReservedStock(reservedItems).catch((rollbackError) => {
                console.error('Erro ao devolver estoque reservado:', rollbackError);
            });
        }
        console.error('Erro ao enviar solicitação:', error);
        showAlert(`Erro ao enviar solicitação: ${error.message}`, 'danger');
    } finally {
        if (submitBtn) {
            submitBtn.disabled = getCarrinhoItens().length === 0;
            submitBtn.innerHTML = originalHtml;
        }
    }
}

export async function initPage() {
    const produtosContainer = getById('solicitarProdutos');
    if (!produtosContainer) return;

    produtosContainer.innerHTML = `
        <div class="text-center py-4">
            <div class="spinner-border text-primary"></div>
            <p class="mt-2">Carregando estoque...</p>
        </div>
    `;

    try {
        await Promise.all([carregarProdutos(), carregarSolicitantes()]);
        renderSolicitanteSelect();
        renderProdutos();
        renderCarrinho();

        getById('solicitarBusca')?.addEventListener('input', (event) => {
            state.filtro = event.target.value || '';
            renderProdutos();
        });

        produtosContainer.addEventListener('click', handleAddToCart);
        getById('solicitarCarrinho')?.addEventListener('click', handleCartControls);
        getById('solicitarCarrinho')?.addEventListener('change', handleCartQuantityChange);
        getById('enviarSolicitacaoBtn')?.addEventListener('click', enviarSolicitacao);
    } catch (error) {
        console.error('Erro ao carregar solicitar:', error);
        produtosContainer.innerHTML = `
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
