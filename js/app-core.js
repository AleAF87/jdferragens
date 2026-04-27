import { checkAuth, loadNavbar } from './auth-check.js';

class AppCore {
    constructor() {
        this.currentPage = null;
        this.pageRequirements = {
            'dashboard.html': 5,
            'estoque.html': 3,
            'solicitar.html': 5,
            'cadastro.html': 3,
            'solicitacoes.html': 3,
            'solicitacoes-canceladas.html': 3,
            'perfil.html': 5
        };
    }

    normalizePageUrl(pageUrl = '') {
        return String(pageUrl).split('#')[0].split('?')[0];
    }

    async init() {
        try {
            await checkAuth(5);
            await loadNavbar();
            this.setupNavbar();
            this.applyNavbarPermissions();
            await this.loadPage('dashboard.html');
        } catch (error) {
            this.showError(error);
        }
    }

    collapseNavbar() {
        const collapseEl = document.getElementById('mainNavbar');
        if (!collapseEl || typeof bootstrap === 'undefined') return;
        const instance = bootstrap.Collapse.getInstance(collapseEl) || new bootstrap.Collapse(collapseEl, { toggle: false });
        instance.hide();
    }

    setupNavbar() {
        document.addEventListener('click', (event) => {
            const link = event.target.closest('a[href$=".html"]');
            if (!link || link.hasAttribute('data-ignore-spa')) return;
            event.preventDefault();
            this.collapseNavbar();
            this.loadPage(link.getAttribute('href'));
        });

        const userGreeting = document.getElementById('userGreeting');
        if (userGreeting) userGreeting.textContent = sessionStorage.getItem('userName') || 'Usuario';

        const logoutBtn = document.getElementById('navLogout');
        if (logoutBtn) {
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
    }

    applyNavbarPermissions() {
        const userLevel = Number(sessionStorage.getItem('currentUserLevel') || 5);

        document.querySelectorAll('[data-max-level]').forEach((element) => {
            const maxLevel = Number(element.getAttribute('data-max-level') || 5);
            element.classList.toggle('d-none', userLevel > maxLevel);
        });

        document.querySelectorAll('[data-min-level]').forEach((element) => {
            const minLevel = Number(element.getAttribute('data-min-level') || 1);
            element.classList.toggle('d-none', userLevel < minLevel);
        });
    }

    async loadPage(pageUrl) {
        const normalizedPageUrl = this.normalizePageUrl(pageUrl);
        if (this.currentPage === normalizedPageUrl) return;

        const contentDiv = document.getElementById('app-content');
        if (!contentDiv) return;

        try {
            if (this.pageRequirements[normalizedPageUrl]) await checkAuth(this.pageRequirements[normalizedPageUrl]);
            contentDiv.innerHTML = this.getLoadingHTML(normalizedPageUrl);

            const response = await fetch(normalizedPageUrl);
            if (!response.ok) throw new Error(`HTTP ${response.status}`);
            const html = await response.text();
            contentDiv.innerHTML = this.extractContent(html);

            await this.loadPageScript(normalizedPageUrl);
            this.currentPage = normalizedPageUrl;
            this.updateActiveNav(normalizedPageUrl);
        } catch (error) {
            console.error(`Erro ao carregar ${normalizedPageUrl}:`, error);
            contentDiv.innerHTML = this.getErrorHTML(error, normalizedPageUrl);
        }
    }

    extractContent(html) {
        const doc = new DOMParser().parseFromString(html, 'text/html');
        doc.querySelector('#navbar')?.remove();
        return doc.querySelector('main')?.outerHTML || doc.querySelector('.container-fluid')?.outerHTML || doc.body.innerHTML;
    }

    async loadPageScript(pageUrl) {
        const scripts = {
            'dashboard.html': './dashboard.js',
            'estoque.html': './estoque.js',
            'solicitar.html': './solicitar.js',
            'cadastro.html': './cadastro.js',
            'solicitacoes.html': './solicitacoes.js',
            'solicitacoes-canceladas.html': './solicitacoes-canceladas.js',
            'perfil.html': './perfil.js'
        };

        const modulePath = scripts[pageUrl];
        if (!modulePath) return;

        const pageModule = await import(modulePath);
        if (pageModule.initPage) await pageModule.initPage();
    }

    updateActiveNav(pageUrl) {
        document.querySelectorAll('a[href$=".html"]').forEach((link) => {
            const isActive = link.getAttribute('href') === pageUrl;
            link.classList.toggle('active', isActive);
        });
    }

    getLoadingHTML(pageUrl) {
        const pageName = pageUrl.replace('.html', '');
        return `
            <div class="container-fluid">
                <div class="card mt-4">
                    <div class="card-body text-center py-5">
                        <div class="spinner-border text-primary mb-3"></div>
                        <h4>Carregando ${pageName}...</h4>
                    </div>
                </div>
            </div>
        `;
    }

    getErrorHTML(error, pageUrl) {
        return `
            <div class="container-fluid">
                <div class="alert alert-danger mt-4">
                    <h4>Erro ao carregar pagina</h4>
                    <p>Nao foi possivel carregar <strong>${pageUrl}</strong>.</p>
                    <small>${error.message}</small>
                </div>
            </div>
        `;
    }

    showError(error) {
        const contentDiv = document.getElementById('app-content');
        if (!contentDiv) return;
        contentDiv.innerHTML = `
            <div class="alert alert-danger m-4">
                <h4>Erro de autenticacao</h4>
                <p>${error.message}</p>
                <a href="index.html" class="btn btn-primary">Voltar ao login</a>
            </div>
        `;
    }
}

if (window.location.pathname.includes('app.html')) {
    document.addEventListener('DOMContentLoaded', () => {
        window.app = new AppCore();
        window.app.init();
    });
}

export default AppCore;
