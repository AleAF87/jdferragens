import { database } from './firebase-config.js';
import { ref, set, push } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

function showAlert(message, type = 'success') {
    const alert = document.getElementById('cadastroAlert');
    if (!alert) return;
    alert.className = `alert alert-${type} mt-3`;
    alert.textContent = message;
    alert.classList.remove('d-none');
}

export function initPage() {
    const form = document.getElementById('cadastroProdutoForm');
    if (!form) return;

    form.addEventListener('submit', async (event) => {
        event.preventDefault();

        const formData = new FormData(form);
        const product = {
            codigo: String(formData.get('codigo') || '').trim(),
            nome: String(formData.get('nome') || '').trim(),
            quantidade: Number(formData.get('quantidade') || 0),
            preco: Number(formData.get('preco') || 0),
            descricao: String(formData.get('descricao') || '').trim(),
            atualizadoEm: new Date().toISOString(),
            atualizadoPor: sessionStorage.getItem('userCPF') || ''
        };

        if (!product.codigo || !product.nome) {
            showAlert('Informe código e produto para continuar.', 'danger');
            return;
        }

        try {
            const productRef = push(ref(database, 'produtos'));
            await set(productRef, product);
            form.reset();
            showAlert('Produto salvo com sucesso.');
        } catch (error) {
            console.error('Erro ao salvar produto:', error);
            showAlert(`Erro ao salvar produto: ${error.message}`, 'danger');
        }
    });
}

if (!window.location.pathname.includes('app.html')) {
    document.addEventListener('DOMContentLoaded', initPage);
}
