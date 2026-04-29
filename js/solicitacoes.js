import { database } from './firebase-config.js';
import { ref, get, update, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

let solicitacoes = [];
let unsubscribeSolicitacoes = null;

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

function formatDate(value) {
    if (!value) return '-';
    return new Intl.DateTimeFormat('pt-BR', {
        dateStyle: 'short',
        timeStyle: 'short'
    }).format(new Date(value));
}

function getStatusBadge(status) {
    if (status === 'pronto_retirar') return '<span class="badge text-bg-success">Pronto para retirar</span>';
    if (status === 'separando') return '<span class="badge text-bg-warning">Separando</span>';
    if (status === 'cancelado') return '<span class="badge text-bg-secondary">Cancelado</span>';
    return '<span class="badge text-bg-primary">Aguardando separação</span>';
}

function getSeparationButton(solicitacao) {
    const canToggle = ['solicitado', 'separando'].includes(solicitacao.status);
    const isSeparating = solicitacao.status === 'separando';
    const icon = isSeparating ? 'fa-pause' : 'fa-box-open';
    const label = isSeparating ? 'Pausar separação' : 'Iniciar separação';
    const style = isSeparating ? 'btn-outline-warning' : 'btn-outline-primary';

    return `
        <button class="btn ${style} me-2" data-action="toggle-separation" data-id="${escapeHtml(solicitacao.id)}" ${!canToggle ? 'disabled' : ''}>
            <i class="fas ${icon} me-2"></i>${label}
        </button>
    `;
}

function renderItensTable(itens = []) {
    return `
        <div class="table-responsive">
            <table class="table table-sm align-middle mb-0">
                <thead>
                    <tr>
                        <th>Código</th>
                        <th>Produto</th>
                        <th>Qtd.</th>
                        <th>Unitário</th>
                        <th>Subtotal</th>
                    </tr>
                </thead>
                <tbody>
                    ${itens.map((item) => `
                        <tr>
                            <td>${escapeHtml(item.codigo)}</td>
                            <td>${escapeHtml(item.nome)}</td>
                            <td>${Number(item.quantidade || 0)}</td>
                            <td>${escapeHtml(formatBRL(item.precoUnitario || 0))}</td>
                            <td>${escapeHtml(formatBRL(item.subtotal || 0))}</td>
                        </tr>
                    `).join('')}
                </tbody>
            </table>
        </div>
    `;
}

function renderSolicitacoes() {
    const content = getById('solicitacoesContent');
    if (!content) return;

    if (!solicitacoes.length) {
        content.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-clipboard-check"></i>
                <h2>Nenhuma solicitação pendente</h2>
                <p>Os pedidos enviados pelos usuários aparecerão aqui.</p>
            </div>
        `;
        return;
    }

    content.innerHTML = `
        <div class="request-board">
            ${solicitacoes.map((solicitacao) => `
                <article class="request-card">
                    <div class="request-card-header">
                        <div>
                            <span class="section-label">${escapeHtml(formatDate(solicitacao.criadoEm))}</span>
                            <h2>${escapeHtml(solicitacao.solicitanteNome || 'Usuário')}</h2>
                            <p class="mb-0 text-muted">CPF: ${escapeHtml(solicitacao.solicitanteCpf || '-')}</p>
                        </div>
                        ${getStatusBadge(solicitacao.status)}
                    </div>

                    ${renderItensTable(solicitacao.itens || [])}

                    <div class="order-total-row mt-3">
                        <span>Total</span>
                        <strong>${escapeHtml(formatBRL(solicitacao.total || 0))}</strong>
                    </div>

                    <div class="d-flex justify-content-end mt-3">
                        ${getSeparationButton(solicitacao)}
                        <button class="btn btn-primary me-2" data-action="ready" data-id="${escapeHtml(solicitacao.id)}" ${solicitacao.status !== 'separando' ? 'disabled' : ''}>
                            <i class="fas fa-check me-2"></i>Pronto
                        </button>
                        <button class="btn btn-outline-danger" data-action="cancel" data-id="${escapeHtml(solicitacao.id)}" ${!['solicitado', 'separando'].includes(solicitacao.status) ? 'disabled' : ''}>
                            <i class="fas fa-ban me-2"></i>Cancelar
                        </button>
                    </div>
                </article>
            `).join('')}
        </div>
    `;
}

async function carregarSolicitacoes() {
    const snapshot = await get(ref(database, 'solicitacoes'));
    solicitacoes = Object.values(snapshot.val() || {})
        .filter((solicitacao) => solicitacao.status !== 'cancelado')
        .sort((a, b) => String(a.criadoEm || '').localeCompare(String(b.criadoEm || '')));
}

async function alternarSeparacao(solicitacaoId) {
    const solicitacao = solicitacoes.find((item) => item.id === solicitacaoId);
    if (!solicitacao || !['solicitado', 'separando'].includes(solicitacao.status)) return;

    const now = new Date().toISOString();
    const operadorCpf = sessionStorage.getItem('userCPF') || '';
    const operadorNome = sessionStorage.getItem('userName') || 'Vendedor';
    const isSeparating = solicitacao.status === 'separando';
    const statusData = isSeparating
        ? {
            status: 'solicitado',
            statusLabel: 'Aguardando separação',
            separacaoPausadaPorCpf: operadorCpf,
            separacaoPausadaPorNome: operadorNome,
            separacaoPausadaEm: now,
            atualizadoEm: now
        }
        : {
            status: 'separando',
            statusLabel: 'Separando',
            separacaoIniciadaPorCpf: operadorCpf,
            separacaoIniciadaPorNome: operadorNome,
            separacaoIniciadaEm: now,
            atualizadoEm: now
        };

    await update(ref(database), {
        [`solicitacoes/${solicitacaoId}`]: {
            ...solicitacao,
            ...statusData
        },
        [`usuariosSolicitacoes/${solicitacao.solicitanteCpf}/${solicitacaoId}`]: {
            id: solicitacaoId,
            status: statusData.status,
            statusLabel: statusData.statusLabel,
            total: Number(solicitacao.total || 0),
            quantidadeItens: Number(solicitacao.quantidadeItens || 0),
            itens: solicitacao.itens || [],
            solicitanteCpf: solicitacao.solicitanteCpf,
            solicitanteNome: solicitacao.solicitanteNome,
            criadoEm: solicitacao.criadoEm || now,
            ...(isSeparating ? { separacaoPausadaEm: now } : { separacaoIniciadaEm: now }),
            atualizadoEm: now
        }
    });

    await carregarSolicitacoes();
    renderSolicitacoes();
}

async function marcarPronto(solicitacaoId) {
    const solicitacao = solicitacoes.find((item) => item.id === solicitacaoId);
    if (!solicitacao || solicitacao.status !== 'separando') return;

    const now = new Date().toISOString();
    const operadorCpf = sessionStorage.getItem('userCPF') || '';
    const operadorNome = sessionStorage.getItem('userName') || 'Vendedor';
    const statusData = {
        status: 'pronto_retirar',
        statusLabel: 'Pronto para retirar',
        separadoPorCpf: operadorCpf,
        separadoPorNome: operadorNome,
        prontoEm: now,
        atualizadoEm: now
    };

    const pdvPayload = {
        id: solicitacaoId,
        solicitacaoId,
        solicitanteCpf: solicitacao.solicitanteCpf,
        solicitanteNome: solicitacao.solicitanteNome,
        itens: solicitacao.itens || [],
        total: Number(solicitacao.total || 0),
        quantidadeItens: Number(solicitacao.quantidadeItens || 0),
        status: 'aguardando_pagamento',
        origem: 'solicitacao_separada',
        separadoPorCpf: operadorCpf,
        separadoPorNome: operadorNome,
        criadoEm: now,
        atualizadoEm: now
    };

    await update(ref(database), {
        [`solicitacoes/${solicitacaoId}`]: {
            ...solicitacao,
            ...statusData
        },
        [`usuariosSolicitacoes/${solicitacao.solicitanteCpf}/${solicitacaoId}`]: {
            id: solicitacaoId,
            status: statusData.status,
            statusLabel: statusData.statusLabel,
            total: Number(solicitacao.total || 0),
            quantidadeItens: Number(solicitacao.quantidadeItens || 0),
            itens: solicitacao.itens || [],
            solicitanteCpf: solicitacao.solicitanteCpf,
            solicitanteNome: solicitacao.solicitanteNome,
            criadoEm: solicitacao.criadoEm || now,
            prontoEm: now,
            atualizadoEm: now
        },
        [`pdvPedidosSeparados/${solicitacaoId}`]: pdvPayload
    });

    await carregarSolicitacoes();
    renderSolicitacoes();
}

async function buildStockReturnUpdates(itens = []) {
    const productsSnapshot = await get(ref(database, 'produtos'));
    const products = productsSnapshot.val() || {};
    const updates = {};

    itens.forEach((item) => {
        const currentStock = Number(products?.[item.produtoId]?.quantidade || 0);
        updates[`produtos/${item.produtoId}/quantidade`] = currentStock + Number(item.quantidade || 0);
    });

    return updates;
}

async function cancelarSolicitacao(solicitacaoId) {
    const solicitacao = solicitacoes.find((item) => item.id === solicitacaoId);
    if (!solicitacao || !['solicitado', 'separando'].includes(solicitacao.status)) return false;

    const confirmed = confirm('Deseja cancelar esta solicitação? Os itens voltarão para o estoque.');
    if (!confirmed) return false;

    const now = new Date().toISOString();
    const operadorCpf = sessionStorage.getItem('userCPF') || '';
    const operadorNome = sessionStorage.getItem('userName') || 'Vendedor';
    const stockUpdates = await buildStockReturnUpdates(solicitacao.itens || []);
    const statusData = {
        status: 'cancelado',
        statusLabel: 'Cancelado',
        canceladoPorCpf: operadorCpf,
        canceladoPorNome: operadorNome,
        canceladoEm: now,
        atualizadoEm: now
    };

    await update(ref(database), {
        ...stockUpdates,
        [`solicitacoes/${solicitacaoId}`]: {
            ...solicitacao,
            ...statusData
        },
        [`usuariosSolicitacoes/${solicitacao.solicitanteCpf}/${solicitacaoId}`]: {
            id: solicitacaoId,
            status: statusData.status,
            statusLabel: statusData.statusLabel,
            total: Number(solicitacao.total || 0),
            quantidadeItens: Number(solicitacao.quantidadeItens || 0),
            itens: solicitacao.itens || [],
            solicitanteCpf: solicitacao.solicitanteCpf,
            solicitanteNome: solicitacao.solicitanteNome,
            criadoEm: solicitacao.criadoEm || now,
            canceladoEm: now,
            atualizadoEm: now
        }
    });

    await carregarSolicitacoes();
    renderSolicitacoes();
    return true;
}

export async function initPage() {
    const content = getById('solicitacoesContent');
    if (!content) return;

    try {
        if (unsubscribeSolicitacoes) unsubscribeSolicitacoes();

        unsubscribeSolicitacoes = onValue(ref(database, 'solicitacoes'), (snapshot) => {
            solicitacoes = Object.values(snapshot.val() || {})
                .filter((solicitacao) => solicitacao.status !== 'cancelado')
                .sort((a, b) => String(a.criadoEm || '').localeCompare(String(b.criadoEm || '')));
            renderSolicitacoes();
        });

        content.onclick = async (event) => {
            const button = event.target.closest('[data-action]');
            if (!button) return;

            const originalHtml = button.innerHTML;
            const action = button.getAttribute('data-action');
            try {
                button.disabled = true;
                button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Salvando...';
                const solicitacaoId = button.getAttribute('data-id');
                if (action === 'toggle-separation') await alternarSeparacao(solicitacaoId);
                if (action === 'ready') await marcarPronto(solicitacaoId);
                if (action === 'cancel') {
                    const canceled = await cancelarSolicitacao(solicitacaoId);
                    if (!canceled) {
                        button.disabled = false;
                        button.innerHTML = originalHtml;
                    }
                }
            } catch (error) {
                console.error('Erro ao atualizar solicitação:', error);
                button.disabled = false;
                button.innerHTML = originalHtml;
                alert('Não foi possível atualizar a solicitação: ' + error.message);
            }
        };
    } catch (error) {
        console.error('Erro ao carregar solicitações:', error);
        content.innerHTML = `
            <div class="alert alert-danger mb-0">
                <h4 class="alert-heading">Erro ao carregar solicitações</h4>
                <p class="mb-0">${escapeHtml(error.message || 'Erro desconhecido.')}</p>
            </div>
        `;
    }
}

if (!window.location.pathname.includes('app.html')) {
    document.addEventListener('DOMContentLoaded', initPage);
}
