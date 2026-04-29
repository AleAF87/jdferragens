import { database } from './firebase-config.js';
import { ref, onValue } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

let unsubscribeCanceladas = null;

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

function renderItens(itens = []) {
    return `
        <div class="table-responsive mt-3">
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

function renderCanceladas(canceladas) {
    const content = getById('solicitacoesCanceladasContent');
    if (!content) return;

    if (!canceladas.length) {
        content.innerHTML = `
            <div class="empty-state">
                <i class="fas fa-ban"></i>
                <h2>Nenhuma solicitação cancelada</h2>
                <p>Quando houver cancelamentos, eles aparecerão aqui em ordem cronológica.</p>
            </div>
        `;
        return;
    }

    content.innerHTML = `
        <div class="request-board">
            ${canceladas.map((solicitacao) => `
                <article class="request-card">
                    <div class="request-card-header">
                        <div>
                            <span class="section-label">Criada em ${escapeHtml(formatDate(solicitacao.criadoEm))}</span>
                            <h2>${escapeHtml(solicitacao.solicitanteNome || 'Usuário')}</h2>
                            <p class="mb-0 text-muted">CPF: ${escapeHtml(solicitacao.solicitanteCpf || '-')}</p>
                        </div>
                        <div class="text-end">
                            <span class="badge text-bg-secondary mb-2">Cancelada</span>
                            <div class="text-muted small">Cancelada em ${escapeHtml(formatDate(solicitacao.canceladoEm || solicitacao.atualizadoEm))}</div>
                            <div class="text-muted small">Por ${escapeHtml(solicitacao.canceladoPorNome || '-')}</div>
                        </div>
                    </div>
                    ${renderItens(solicitacao.itens || [])}
                    <div class="order-total-row mt-3">
                        <span>Total</span>
                        <strong>${escapeHtml(formatBRL(solicitacao.total || 0))}</strong>
                    </div>
                </article>
            `).join('')}
        </div>
    `;
}

export function initPage() {
    const content = getById('solicitacoesCanceladasContent');
    if (!content) return;

    if (unsubscribeCanceladas) unsubscribeCanceladas();

    unsubscribeCanceladas = onValue(ref(database, 'solicitacoes'), (snapshot) => {
        const canceladas = Object.values(snapshot.val() || {})
            .filter((solicitacao) => solicitacao.status === 'cancelado')
            .sort((a, b) => String(a.criadoEm || '').localeCompare(String(b.criadoEm || '')));
        renderCanceladas(canceladas);
    }, (error) => {
        console.error('Erro ao carregar solicitações canceladas:', error);
        content.innerHTML = `
            <div class="alert alert-danger mb-0">
                <h4 class="alert-heading">Erro ao carregar canceladas</h4>
                <p class="mb-0">${escapeHtml(error.message || 'Erro desconhecido.')}</p>
            </div>
        `;
    });
}

if (!window.location.pathname.includes('app.html')) {
    document.addEventListener('DOMContentLoaded', initPage);
}
