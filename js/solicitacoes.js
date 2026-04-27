import { database } from './firebase-config.js';
import { ref, get, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

let solicitacoes = [];

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
    return '<span class="badge text-bg-primary">Aguardando separacao</span>';
}

function renderItensTable(itens = []) {
    return `
        <div class="table-responsive">
            <table class="table table-sm align-middle mb-0">
                <thead>
                    <tr>
                        <th>Codigo</th>
                        <th>Produto</th>
                        <th>Qtd.</th>
                        <th>Unitario</th>
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
                <h2>Nenhuma solicitacao pendente</h2>
                <p>Os pedidos enviados pelos usuarios aparecerao aqui.</p>
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
                            <h2>${escapeHtml(solicitacao.solicitanteNome || 'Usuario')}</h2>
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
                        <button class="btn btn-primary" data-action="ready" data-id="${escapeHtml(solicitacao.id)}" ${solicitacao.status === 'pronto_retirar' ? 'disabled' : ''}>
                            <i class="fas fa-check me-2"></i>Pronto
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

async function marcarPronto(solicitacaoId) {
    const solicitacao = solicitacoes.find((item) => item.id === solicitacaoId);
    if (!solicitacao || solicitacao.status === 'pronto_retirar') return;

    const now = new Date().toISOString();
    const operadorCpf = sessionStorage.getItem('userCPF') || '';
    const operadorNome = sessionStorage.getItem('userName') || 'Operador';
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
            criadoEm: solicitacao.criadoEm || now,
            prontoEm: now,
            atualizadoEm: now
        },
        [`pdvPedidosSeparados/${solicitacaoId}`]: pdvPayload
    });

    await carregarSolicitacoes();
    renderSolicitacoes();
}

export async function initPage() {
    const content = getById('solicitacoesContent');
    if (!content) return;

    try {
        await carregarSolicitacoes();
        renderSolicitacoes();

        content.addEventListener('click', async (event) => {
            const button = event.target.closest('[data-action="ready"]');
            if (!button) return;

            const originalHtml = button.innerHTML;
            try {
                button.disabled = true;
                button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Salvando...';
                await marcarPronto(button.getAttribute('data-id'));
            } catch (error) {
                console.error('Erro ao marcar solicitacao pronta:', error);
                button.disabled = false;
                button.innerHTML = originalHtml;
                alert('Nao foi possivel marcar como pronto: ' + error.message);
            }
        });
    } catch (error) {
        console.error('Erro ao carregar solicitacoes:', error);
        content.innerHTML = `
            <div class="alert alert-danger mb-0">
                <h4 class="alert-heading">Erro ao carregar solicitacoes</h4>
                <p class="mb-0">${escapeHtml(error.message || 'Erro desconhecido.')}</p>
            </div>
        `;
    }
}

if (!window.location.pathname.includes('app.html')) {
    document.addEventListener('DOMContentLoaded', initPage);
}
