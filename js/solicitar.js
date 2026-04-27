import { database } from './firebase-config.js';
import { ref, get, push, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const state = {
    produtos: [],
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
                        <th>Codigo</th>
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
                                <td>${escapeHtml(produto.codigo || produto.id)}</td>
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
                        <span>${escapeHtml(item.codigo)} | ${item.quantidade} x ${escapeHtml(formatBRL(item.precoUnitario))}</span>
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
    let quantidade = Math.floor(Number(input.value || 0));

    if (quantidade <= 0) {
        showAlert('Informe uma quantidade maior que zero.', 'warning');
        input.focus();
        return;
    }

    if (quantidade > estoque) {
        quantidade = estoque;
        showAlert('Quantidade ajustada ao estoque disponivel.', 'warning');
    }

    input.value = quantidade;
    if (quantidade > 0) state.carrinho.set(produtoId, quantidade);
    else state.carrinho.delete(produtoId);

    renderProdutos();
    renderCarrinho();
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

async function enviarSolicitacao() {
    const itens = getCarrinhoItens();
    if (!itens.length) return;

    const submitBtn = getById('enviarSolicitacaoBtn');
    const originalHtml = submitBtn?.innerHTML;

    try {
        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Enviando...';
        }

        const now = new Date().toISOString();
        const solicitanteCpf = sessionStorage.getItem('userCPF') || '';
        const solicitanteNome = sessionStorage.getItem('userName') || 'Usuario';
        const total = itens.reduce((sum, item) => sum + item.subtotal, 0);
        const quantidadeItens = itens.reduce((sum, item) => sum + item.quantidade, 0);
        const solicitacaoRef = push(ref(database, 'solicitacoes'));
        const solicitacaoId = solicitacaoRef.key;

        const payload = {
            id: solicitacaoId,
            solicitanteCpf,
            solicitanteNome,
            status: 'solicitado',
            statusLabel: 'Aguardando separacao',
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
            criadoEm: now,
            atualizadoEm: now,
            itens
        };

        await update(ref(database), {
            [`solicitacoes/${solicitacaoId}`]: payload,
            [`usuariosSolicitacoes/${solicitanteCpf}/${solicitacaoId}`]: resumoUsuario
        });

        state.carrinho.clear();
        renderProdutos();
        renderCarrinho();
        showAlert('Solicitacao enviada. Aguarde a separacao dos itens.', 'success');
    } catch (error) {
        console.error('Erro ao enviar solicitacao:', error);
        showAlert(`Erro ao enviar solicitacao: ${error.message}`, 'danger');
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
        await carregarProdutos();
        renderProdutos();
        renderCarrinho();

        getById('solicitarBusca')?.addEventListener('input', (event) => {
            state.filtro = event.target.value || '';
            renderProdutos();
        });

        produtosContainer.addEventListener('click', handleAddToCart);
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
