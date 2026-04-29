import { database } from './firebase-config.js';
import { ref, get, update, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const dashboardState = {
    solicitacoes: [],
    pendingUsers: [],
    unsubscribeSolicitacoes: null,
    unsubscribePendentes: null
};

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function getLevelLabel(level) {
    const normalized = String(level || '5');
    if (normalized === '1') return 'Administrador';
    if (normalized === '2') return 'Moderador';
    if (normalized === '3') return 'Vendedor';
    if (normalized === '4') return 'Reserva';
    return 'Cliente';
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
    if (solicitacao?.status === 'separando') return 'Separando';
    if (solicitacao?.status === 'cancelado') return 'Cancelado';
    return 'Aguardando separação';
}

function renderSolicitacaoModal(solicitacao) {
    const itens = solicitacao?.itens || [];
    return `
        <div class="modal fade" id="solicitacaoDetalheModal" tabindex="-1" aria-hidden="true">
            <div class="modal-dialog modal-lg modal-dialog-centered modal-dialog-scrollable">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">Detalhes da solicitação</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Fechar"></button>
                    </div>
                    <div class="modal-body">
                        <div class="d-flex justify-content-between gap-3 flex-wrap mb-3">
                            <div>
                                <span class="section-label">Solicitante</span>
                                <h3 class="h5 mb-2">${escapeHtml(solicitacao?.solicitanteNome || sessionStorage.getItem('userName') || 'Usuário')}</h3>
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
                <h2>Nenhuma solicitação enviada</h2>
                <p>Quando você solicitar itens do estoque, os cards aparecerão aqui.</p>
            </div>
        `;
    }

    return `
        <div class="dashboard-request-grid">
            ${solicitacoes.map((solicitacao) => `
                <article class="dashboard-request-card ${getStatusClass(solicitacao.status)}"
                         data-request-id="${escapeHtml(solicitacao.id)}">
                    <span>${escapeHtml(formatDate(solicitacao.criadoEm))}</span>
                    <strong>${escapeHtml(getStatusLabel(solicitacao))}</strong>
                    <small>${Number(solicitacao.quantidadeItens || 0)} item(ns) | ${escapeHtml(formatBRL(solicitacao.total || 0))}</small>
                    ${solicitacao.status === 'solicitado' ? `
                        <button class="btn btn-sm btn-outline-danger mt-2" type="button" data-cancel-request="${escapeHtml(solicitacao.id)}">
                            <i class="fas fa-ban me-1"></i>Cancelar
                        </button>
                    ` : ''}
                </article>
            `).join('')}
        </div>
    `;
}

function renderPendingUsers(pendingUsers = []) {
    if (!pendingUsers.length) {
        return `
            <div class="empty-state compact-empty-state">
                <i class="fas fa-user-check"></i>
                <h2>Nenhum usuário pendente</h2>
                <p>Novas solicitações de acesso aparecerão aqui.</p>
            </div>
        `;
    }

    return `
        <div class="dashboard-request-grid">
            ${pendingUsers.map((user) => `
                <button class="dashboard-request-card is-warning"
                        type="button"
                        data-pending-user-cpf="${escapeHtml(user.cpf)}">
                    <span>${escapeHtml(formatDate(user.criadoEm || user.atualizadoEm))}</span>
                    <strong>${escapeHtml(user.nome || 'Usuário sem nome')}</strong>
                    <small>${escapeHtml(user.email || '-')} | CPF ${escapeHtml(user.cpf)}</small>
                </button>
            `).join('')}
        </div>
    `;
}

async function getPendingUsersForApproval() {
    const [loginSnapshot, usuariosSnapshot] = await Promise.all([
        get(ref(database, 'login')),
        get(ref(database, 'usuarios'))
    ]);

    const login = loginSnapshot.val() || {};
    const usuarios = usuariosSnapshot.val() || {};

    return Object.entries(login)
        .filter(([, data]) => String(data?.status || '').toLowerCase() === 'pendente')
        .map(([cpf, data]) => ({
            cpf,
            ...(usuarios?.[cpf] || {}),
            ...data
        }))
        .sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')));
}

function renderUserRequestsSection() {
    const container = document.getElementById('dashboardSolicitacoesList');
    if (!container) return;
    container.innerHTML = renderSolicitacoesCards(dashboardState.solicitacoes);
}

function renderPendingUsersSection() {
    const container = document.getElementById('dashboardPendingUsersList');
    if (!container) return;
    container.innerHTML = renderPendingUsers(dashboardState.pendingUsers);
}

function bindRealtimeDashboard(userCpf, userLevel) {
    if (dashboardState.unsubscribeSolicitacoes) dashboardState.unsubscribeSolicitacoes();
    if (dashboardState.unsubscribePendentes) dashboardState.unsubscribePendentes();

    dashboardState.unsubscribeSolicitacoes = onValue(ref(database, `usuariosSolicitacoes/${userCpf}`), (snapshot) => {
        dashboardState.solicitacoes = Object.values(snapshot.val() || {})
            .filter((solicitacao) => solicitacao.status !== 'cancelado')
            .sort((a, b) => String(b.criadoEm || '').localeCompare(String(a.criadoEm || '')));
        renderUserRequestsSection();
    });

    if (Number(userLevel || 5) === 1) {
        dashboardState.unsubscribePendentes = onValue(ref(database, 'login'), async () => {
            dashboardState.pendingUsers = await getPendingUsersForApproval();
            renderPendingUsersSection();
        });
    }
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

async function cancelarSolicitacao(solicitacao) {
    if (!solicitacao || solicitacao.status !== 'solicitado') {
        alert('Esta solicitação já está em separação e não pode ser cancelada pelo solicitante.');
        return false;
    }

    const confirmed = confirm('Deseja cancelar esta solicitação? Os itens voltarão para o estoque.');
    if (!confirmed) return false;

    const now = new Date().toISOString();
    const stockUpdates = await buildStockReturnUpdates(solicitacao.itens || []);
    const cancelData = {
        status: 'cancelado',
        statusLabel: 'Cancelado',
        canceladoPorCpf: sessionStorage.getItem('userCPF') || '',
        canceladoPorNome: sessionStorage.getItem('userName') || 'Usuário',
        canceladoEm: now,
        atualizadoEm: now
    };

    await update(ref(database), {
        ...stockUpdates,
        [`solicitacoes/${solicitacao.id}`]: {
            ...solicitacao,
            ...cancelData
        },
        [`usuariosSolicitacoes/${solicitacao.solicitanteCpf}/${solicitacao.id}`]: {
            ...solicitacao,
            ...cancelData
        }
    });

    return true;
}

export async function initPage() {
    const dashboardContent = document.getElementById('dashboard-content');
    if (!dashboardContent) return;

    const userCPF = sessionStorage.getItem('userCPF') || '';
    const storedName = sessionStorage.getItem('userName') || 'Usuário';
    let userData = {
        nome: storedName,
        cpf: userCPF,
        email: '',
        nivel: sessionStorage.getItem('currentUserLevel') || '5',
        status: 'ativo'
    };

    try {
        if (userCPF) {
            const [usuarioSnapshot, loginSnapshot] = await Promise.all([
                get(ref(database, `usuarios/${userCPF}`)),
                get(ref(database, `login/${userCPF}`))
            ]);

            userData = {
                ...userData,
                ...(loginSnapshot.exists() ? loginSnapshot.val() : {}),
                ...(usuarioSnapshot.exists() ? usuarioSnapshot.val() : {}),
                cpf: userCPF
            };

        }

        dashboardContent.innerHTML = `
            <div class="dashboard-user-card">
                <div class="dashboard-user-column">
                    <span>Nome</span>
                    <strong>${escapeHtml(userData.nome || storedName)}</strong>
                </div>
                <div class="dashboard-user-column">
                    <span>Nível de acesso</span>
                    <strong>${escapeHtml(getLevelLabel(userData.nivel))}</strong>
                </div>
            </div>
            <div class="mt-4">
                <div class="page-header">
                    <div>
                        <span class="section-label">Minhas solicitações</span>
                        <h1>Pedidos de itens</h1>
                    </div>
                </div>
                <div id="dashboardSolicitacoesList">
                    <div class="text-center py-4">
                        <div class="spinner-border text-primary"></div>
                        <p class="mt-2">Carregando solicitações...</p>
                    </div>
                </div>
            </div>
            ${Number(userData.nivel || 5) === 1 ? `
                <div class="mt-4">
                    <div class="page-header">
                        <div>
                            <span class="section-label">Aprovações</span>
                            <h1>Usuários pendentes</h1>
                        </div>
                    </div>
                    <div id="dashboardPendingUsersList">
                        <div class="text-center py-4">
                            <div class="spinner-border text-primary"></div>
                            <p class="mt-2">Carregando usuários pendentes...</p>
                        </div>
                    </div>
                </div>
            ` : ''}
            ${renderSolicitacaoModal(null)}
        `;

        bindRealtimeDashboard(userCPF, userData.nivel);

        dashboardContent.onclick = async (event) => {
            const pendingUserCard = event.target.closest('[data-pending-user-cpf]');
            if (pendingUserCard) {
                const cpf = pendingUserCard.getAttribute('data-pending-user-cpf');
                sessionStorage.setItem('selectedProfileCpf', cpf);
                if (window.app?.loadPage) {
                    await window.app.loadPage(`perfil.html?cpf=${encodeURIComponent(cpf)}`);
                    return;
                }
                window.location.href = `perfil.html?cpf=${encodeURIComponent(cpf)}`;
                return;
            }

            const cancelButton = event.target.closest('[data-cancel-request]');
            if (cancelButton) {
                event.stopPropagation();
                const solicitacao = dashboardState.solicitacoes.find((item) => item.id === cancelButton.getAttribute('data-cancel-request'));
                try {
                    cancelButton.disabled = true;
                    cancelButton.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Cancelando...';
                    const canceled = await cancelarSolicitacao(solicitacao);
                    if (canceled) await initPage();
                    else {
                        cancelButton.disabled = false;
                        cancelButton.innerHTML = '<i class="fas fa-ban me-1"></i>Cancelar';
                    }
                } catch (error) {
                    console.error('Erro ao cancelar solicitação:', error);
                    alert('Não foi possível cancelar: ' + error.message);
                    cancelButton.disabled = false;
                    cancelButton.innerHTML = '<i class="fas fa-ban me-1"></i>Cancelar';
                }
                return;
            }

            const card = event.target.closest('[data-request-id]');
            if (!card) return;

            const requestId = card.getAttribute('data-request-id');
            const solicitacao = dashboardState.solicitacoes.find((item) => item.id === requestId);
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
                <h4 class="alert-heading">Erro ao carregar dados do usuário</h4>
                <p class="mb-0">${escapeHtml(error.message || 'Erro desconhecido.')}</p>
            </div>
        `;
    }
}

if (!window.location.pathname.includes('app.html')) {
    document.addEventListener('DOMContentLoaded', initPage);
}
