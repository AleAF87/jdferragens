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

export async function initPage() {
    const content = document.getElementById('perfil-content');
    if (!content) return;

    const userCPF = sessionStorage.getItem('userCPF') || '';
    const baseData = {
        nome: sessionStorage.getItem('userName') || 'Usuario',
        cpf: userCPF,
        email: '',
        nivel: sessionStorage.getItem('currentUserLevel') || '3',
        status: 'ativo'
    };

    try {
        const [usuarioSnapshot, loginSnapshot] = await Promise.all([
            userCPF ? get(ref(database, `usuarios/${userCPF}`)) : Promise.resolve(null),
            userCPF ? get(ref(database, `login/${userCPF}`)) : Promise.resolve(null)
        ]);

        const userData = {
            ...baseData,
            ...(loginSnapshot?.exists() ? loginSnapshot.val() : {}),
            ...(usuarioSnapshot?.exists() ? usuarioSnapshot.val() : {}),
            cpf: userCPF
        };

        content.innerHTML = `
            <div class="row g-3">
                <div class="col-12 col-lg-6">
                    <label class="form-label">Nome</label>
                    <input class="form-control" value="${escapeHtml(userData.nome || '')}" disabled>
                </div>
                <div class="col-12 col-lg-6">
                    <label class="form-label">CPF</label>
                    <input class="form-control" value="${escapeHtml(userData.cpf || '')}" disabled>
                </div>
                <div class="col-12 col-lg-6">
                    <label class="form-label">E-mail</label>
                    <input class="form-control" value="${escapeHtml(userData.email || '')}" disabled>
                </div>
                <div class="col-12 col-lg-3">
                    <label class="form-label">Nivel</label>
                    <input class="form-control" value="${escapeHtml(userData.nivel || '')}" disabled>
                </div>
                <div class="col-12 col-lg-3">
                    <label class="form-label">Status</label>
                    <input class="form-control" value="${escapeHtml(userData.status || '')}" disabled>
                </div>
            </div>
        `;
    } catch (error) {
        console.error('Erro ao carregar perfil:', error);
        content.innerHTML = `
            <div class="alert alert-danger mb-0">
                <h4 class="alert-heading">Erro ao carregar perfil</h4>
                <p class="mb-0">${escapeHtml(error.message || 'Erro desconhecido.')}</p>
            </div>
        `;
    }
}

if (!window.location.pathname.includes('app.html')) {
    document.addEventListener('DOMContentLoaded', initPage);
}
