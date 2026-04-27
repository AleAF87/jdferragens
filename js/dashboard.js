import { database } from './firebase-config.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function getLevelLabel(level) {
    const normalized = String(level || '3');
    if (normalized === '1') return 'Administrador';
    if (normalized === '2') return 'Operador';
    return 'Usuario';
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

function getStatusClass(status) {
    if (status === 'pronto_retirar') return 'is-ready';
    if (status === 'separando') return 'is-warning';
    return 'is-open';
}

function getStatusLabel(solicitacao) {
    if (solicitacao?.status === 'pronto_retirar') return 'Pronto para retirar';
    return solicitacao?.statusLabel || 'Aguardando separacao';
}

function renderSolicitacaoModal(solicitacao) {
    const itens = solicitacao?.itens || [];
    return `
        <div class="modal fade" id="solicitacaoDetalheModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Detalhes da solicitacao</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
                    </div>
                    <div class="modal-body">
                        <div class="d-flex justify-content-between gap-3 flex-wrap mb-3">
                            <div>
                                <span class="section-label">Status</span>
                                <h3 class="h5 mb-0">${escapeHtml(getStatusLabel(solicitacao))}</h3>
                            </div>
                            <div class="text-end">
                                <span class="section-label">Total</span>
                                <h3 class="h5 mb-0">${escapeHtml(formatBRL(solicitacao?.total || 0))}</h3>
                            </div>
                        </div>
                        <div class="table-responsive">
                            <table class="table align-middle">
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
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-outline-secondary" data-bs-dismiss="modal">Fechar</button>
                    </div>
                </div>
            </div>
        </div>
    `;
}

function renderSolicitacoesCards(solicitacoes = []) {
    if (!solicitacoes.length) {
        return `
            <div class="empty-state compact-empty-state">
                <i class="fas fa-cart-shopping"></i>
                <h2>Nenhuma solicitacao enviada</h2>
                <p>Quando voce solicitar itens do estoque, os cards aparecerao aqui.</p>
            </div>
        `;
    }

    return `
        <div class="dashboard-request-grid">
            ${solicitacoes.map((solicitacao) => `
                <button class="dashboard-request-card ${getStatusClass(solicitacao.status)}"
                        type="button"
                        data-request-id="${escapeHtml(solicitacao.id)}">
                    <span>${escapeHtml(formatDate(solicitacao.criadoEm))}</span>
                    <strong>${escapeHtml(getStatusLabel(solicitacao))}</strong>
                    <small>${Number(solicitacao.quantidadeItens || 0)} item(ns) | ${escapeHtml(formatBRL(solicitacao.total || 0))}</small>
                </button>
            `).join('')}
        </div>
    `;
}

export async function initPage() {
    const dashboardContent = document.getElementById('dashboard-content');
    if (!dashboardContent) return;

    const userCPF = sessionStorage.getItem('userCPF') || '';
    const storedName = sessionStorage.getItem('userName') || 'Usuario';
    let userData = {
        nome: storedName,
        cpf: userCPF,
        email: '',
        nivel: sessionStorage.getItem('currentUserLevel') || '3',
        status: 'ativo'
    };

    try {
        let solicitacoes = [];
        if (userCPF) {
            const [usuarioSnapshot, loginSnapshot, solicitacoesSnapshot] = await Promise.all([
                get(ref(database, `usuarios/${userCPF}`)),
                get(ref(database, `login/${userCPF}`)),
                get(ref(database, `usuariosSolicitacoes/${userCPF}`))
            ]);

            userData = {
                ...userData,
                ...(loginSnapshot.exists() ? loginSnapshot.val() : {}),
                ...(usuarioSnapshot.exists() ? usuarioSnapshot.val() : {}),
                cpf: userCPF
            };

            solicitacoes = Object.values(solicitacoesSnapshot.val() || {})
                .sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')));
        }

        dashboardContent.innerHTML = `
            <div class="dashboard-user-card">
                <div class="dashboard-user-column">
                    <span>Nome</span>
                    <strong>${escapeHtml(userData.nome || storedName)}</strong>
                </div>
                <div class="dashboard-user-column">
                    <span>Nivel de acesso</span>
                    <strong>${escapeHtml(getLevelLabel(userData.nivel))}</strong>
                </div>
            </div>
            <div class="mt-4">
                <div class="page-header">
                    <div>
                        <span class="section-label">Minhas solicitacoes</span>
                        <h1>Pedidos de itens</h1>
                    </div>
                </div>
                ${renderSolicitacoesCards(solicitacoes)}
            </div>
            ${renderSolicitacaoModal(null)}
        `;

        dashboardContent.onclick = (event) => {
            const card = event.target.closest('[data-request-id]');
            if (!card) return;

            const requestId = card.getAttribute('data-request-id');
            const solicitacao = solicitacoes.find((item) => item.id === requestId);
            const oldModal = document.getElementById('solicitacaoDetalheModal');
            if (oldModal) oldModal.remove();

            dashboardContent.insertAdjacentHTML('beforeend', renderSolicitacaoModal(solicitacao));
            const modal = document.getElementById('solicitacaoDetalheModal');
            if (modal && window.bootstrap) {
                window.bootstrap.Modal.getOrCreateInstance(modal).show();
            }
        };
    } catch (error) {
        console.error('Erro ao carregar dados do dashboard:', error);
        dashboardContent.innerHTML = `
            <div class="alert alert-danger mb-0">
                <h4 class="alert-heading">Erro ao carregar dados do usuario</h4>
                <p class="mb-0">${escapeHtml(error.message || 'Erro desconhecido.')}</p>
            </div>
        `;
    }
}

if (!window.location.pathname.includes('app.html')) {
    document.addEventListener('DOMContentLoaded', initPage);
}
