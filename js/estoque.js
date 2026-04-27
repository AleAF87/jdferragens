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

function formatBRL(value) {
    return new Intl.NumberFormat('pt-BR', {
        style: 'currency',
        currency: 'BRL'
    }).format(Number(value || 0));
}

export async function initPage() {
    const content = document.getElementById('estoque-content');
    if (!content) return;

    try {
        const snapshot = await get(ref(database, 'produtos'));
        const products = Object.entries(snapshot.val() || {}).map(([id, product]) => ({ id, ...product }));

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
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
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
