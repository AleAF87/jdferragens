import { checkAuth, loadNavbar } from './auth-check.js';

function collapseNavbar() {
    const collapseEl = document.getElementById('mainNavbar');
    if (!collapseEl || typeof bootstrap === 'undefined') return;
    const instance = bootstrap.Collapse.getInstance(collapseEl) || new bootstrap.Collapse(collapseEl, { toggle: false });
    instance.hide();
}

async function setupLogout() {
    const logoutBtn = document.getElementById('navLogout');
    if (!logoutBtn) return;

    logoutBtn.addEventListener('click', async (event) => {
        event.preventDefault();
        logoutBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Saindo...';

        const { auth } = await import('./firebase-config.js');
        const { signOut } = await import("https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js");
        await signOut(auth).catch(() => {});

        sessionStorage.clear();
        localStorage.clear();
        window.location.href = 'index.html';
    });
}

function setupDirectNavigation() {
    document.addEventListener('click', (event) => {
        const link = event.target.closest('a[href$=".html"]');
        if (!link || link.hasAttribute('data-ignore-spa')) return;
        collapseNavbar();
    });
}

function updateNavbarState() {
    const greeting = document.getElementById('userGreeting');
    if (greeting) greeting.textContent = sessionStorage.getItem('userName') || 'Usuario';

    const userLevel = Number(sessionStorage.getItem('currentUserLevel') || 3);
    document.querySelectorAll('[data-max-level]').forEach((element) => {
        const maxLevel = Number(element.getAttribute('data-max-level') || 3);
        element.classList.toggle('d-none', userLevel > maxLevel);
    });
    document.querySelectorAll('[data-min-level]').forEach((element) => {
        const minLevel = Number(element.getAttribute('data-min-level') || 1);
        element.classList.toggle('d-none', userLevel < minLevel);
    });

    const currentPage = location.pathname.split('/').pop();
    document.querySelectorAll('a[href$=".html"]').forEach((link) => {
        link.classList.toggle('active', link.getAttribute('href') === currentPage);
    });
}

document.addEventListener('DOMContentLoaded', async () => {
    if (window.location.pathname.includes('app.html')) return;

    try {
        const pageRequirements = {
            'dashboard.html': 3,
            'estoque.html': 2,
            'solicitar.html': 3,
            'cadastro.html': 2,
            'solicitacoes.html': 2,
            'perfil.html': 3
        };
        const currentPage = location.pathname.split('/').pop();

        await checkAuth(pageRequirements[currentPage] || 3);
        await loadNavbar();
        updateNavbarState();
        setupLogout();
        setupDirectNavigation();
    } catch (error) {
        console.error('Erro na pagina protegida:', error);
    }
});
