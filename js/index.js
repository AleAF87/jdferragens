import { database, auth } from './firebase-config.js';
import { ref, get } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";
import { provider } from './firebase-config.js';

function showAlert(element, message) {
    element.textContent = message;
    element.classList.remove('d-none');
    setTimeout(() => element.classList.add('d-none'), 5000);
}

document.addEventListener('DOMContentLoaded', () => {
    const googleLoginBtn = document.getElementById('googleLoginBtn');
    const errorAlert = document.getElementById('errorAlert');
    const infoAlert = document.getElementById('infoAlert');

    googleLoginBtn.addEventListener('click', async () => {
        const originalHtml = googleLoginBtn.innerHTML;

        try {
            googleLoginBtn.disabled = true;
            googleLoginBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Entrando...';

            const credential = await signInWithPopup(auth, provider);
            const googleUser = credential.user;

            const snapshot = await get(ref(database, 'login'));
            const loginEntries = Object.entries(snapshot.val() || {});
            const matchedEntry = loginEntries.find(([, data]) => {
                const uid = String(data?.uid || '');
                const email = String(data?.email || '').toLowerCase();
                return uid === googleUser.uid || email === String(googleUser.email || '').toLowerCase();
            });

            if (!matchedEntry) {
                await signOut(auth).catch(() => {});
                showAlert(infoAlert, 'Cadastro não encontrado. Faça seu cadastro com Google e aguarde aprovação.');
                return;
            }

            const [cpf, loginData] = matchedEntry;
            const status = String(loginData.status || '').trim().toLowerCase();

            if (status !== 'ativo') {
                await signOut(auth).catch(() => {});
                const statusMessage = status === 'pendente'
                    ? 'Seu cadastro está aguardando aprovação do administrador.'
                    : `Cadastro com status "${status}". Entre em contato com o administrador.`;
                showAlert(infoAlert, statusMessage);
                return;
            }

            sessionStorage.setItem('userCPF', cpf);
            sessionStorage.setItem('userName', loginData.nome || googleUser.displayName || 'Usuário');
            localStorage.setItem('userCPF', cpf);
            localStorage.setItem('userName', loginData.nome || googleUser.displayName || 'Usuário');
            window.location.href = 'app.html';
        } catch (error) {
            console.error('Erro ao entrar com Google:', error);
            showAlert(errorAlert, `Erro ao entrar com Google: ${error.message}`);
        } finally {
            googleLoginBtn.disabled = false;
            googleLoginBtn.innerHTML = originalHtml;
        }
    });
});
