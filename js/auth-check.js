import { auth, database } from './firebase-config.js';
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

function formatCPF(cpf) {
    if (!cpf) return '';
    return String(cpf).replace(/\D/g, '').padStart(11, '0').slice(-11);
}

function clearUserData() {
    sessionStorage.removeItem('userCPF');
    sessionStorage.removeItem('userName');
    sessionStorage.removeItem('currentUserLevel');
    localStorage.removeItem('userCPF');
    localStorage.removeItem('userName');
}

export function checkAuth(requiredLevel = 1) {
    return new Promise((resolve, reject) => {
        onAuthStateChanged(auth, async (user) => {
            if (!user) {
                window.location.href = 'index.html';
                return;
            }

            try {
                const userCPF = formatCPF(sessionStorage.getItem('userCPF') || localStorage.getItem('userCPF'));
                if (!userCPF) throw new Error('CPF não encontrado.');

                const [usuarioSnapshot, loginSnapshot] = await Promise.all([
                    get(ref(database, `usuarios/${userCPF}`)),
                    get(ref(database, `login/${userCPF}`))
                ]);

                const loginData = loginSnapshot.exists() ? (loginSnapshot.val() || {}) : {};
                const userData = usuarioSnapshot.exists() ? (usuarioSnapshot.val() || {}) : loginData;
                const status = String(loginData.status || userData.status || 'ativo').trim().toLowerCase();

                if (status !== 'ativo') throw new Error(`Cadastro com status ${status}.`);

                userData.nome = userData.nome || loginData.nome || user.email?.split('@')[0] || 'Usuário';
                userData.email = userData.email || loginData.email || user.email || '';

                const userLevel = Number(userData.nivel || 5);
                sessionStorage.setItem('currentUserLevel', String(userLevel));
                sessionStorage.setItem('userCPF', userCPF);
                sessionStorage.setItem('userName', userData.nome);

                if (userLevel > requiredLevel) {
                    throw new Error(`Nível insuficiente: ${userLevel} > ${requiredLevel}.`);
                }

                resolve({ user, userData, cpf: userCPF });
            } catch (error) {
                console.error('Erro ao verificar autenticação:', error);
                if (!String(error.message || '').includes('Nível insuficiente')) {
                    alert('Erro ao verificar permissões: ' + error.message);
                    clearUserData();
                    window.location.href = 'index.html';
                }
                reject(error);
            }
        });
    });
}

export async function loadNavbar() {
    let navbarElement = document.getElementById('navbar');
    if (!navbarElement) {
        navbarElement = document.createElement('div');
        navbarElement.id = 'navbar';
        document.body.insertBefore(navbarElement, document.body.firstChild);
    }

    if (navbarElement.innerHTML.trim()) return true;

    try {
        const response = await fetch('components/navbar.html');
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        navbarElement.innerHTML = await response.text();
        return true;
    } catch (error) {
        console.error('Erro ao carregar navbar:', error);
        navbarElement.innerHTML = `
            <nav class="navbar navbar-dark bg-primary fixed-top">
                <div class="container-fluid">
                    <a class="navbar-brand" href="dashboard.html">JD Ferragens</a>
                    <button class="btn btn-outline-light btn-sm" onclick="sessionStorage.clear(); localStorage.clear(); location.href='index.html'">Sair</button>
                </div>
            </nav>
        `;
        return false;
    }
}
