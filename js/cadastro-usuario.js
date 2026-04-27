import { auth, database, provider } from './firebase-config.js';
import { ref, get, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";
import { signInWithPopup, signOut } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-auth.js";

const state = {
    googleUser: null,
    validationMessage: ''
};

function getById(id) {
    return document.getElementById(id);
}

function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

function formatCPF(cpf) {
    const digits = onlyDigits(cpf).padStart(11, '0').slice(-11);
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatCEP(value) {
    const digits = onlyDigits(value).slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function formatWhatsapp(value) {
    const digits = onlyDigits(value).slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function isValidCPF(cpf) {
    const digits = onlyDigits(cpf);
    if (digits.length !== 11 || /^(\d)\1{10}$/.test(digits)) return false;

    const calcDigit = (factor) => {
        let total = 0;
        for (let i = 0; i < factor - 1; i += 1) {
            total += Number(digits[i]) * (factor - i);
        }
        const remainder = (total * 10) % 11;
        return remainder === 10 ? 0 : remainder;
    };

    return calcDigit(10) === Number(digits[9]) && calcDigit(11) === Number(digits[10]);
}

function escapeHtml(value) {
    return String(value ?? '')
        .replaceAll('&', '&amp;')
        .replaceAll('<', '&lt;')
        .replaceAll('>', '&gt;')
        .replaceAll('"', '&quot;')
        .replaceAll("'", '&#039;');
}

function showAlert(message, type = 'info') {
    const alert = getById('signupAlert');
    if (!alert) return;
    alert.className = `alert alert-${type} mt-4`;
    alert.innerHTML = message;
    alert.classList.remove('d-none');
}

function setInvalidFields(ids = []) {
    document.querySelectorAll('.is-invalid').forEach((field) => field.classList.remove('is-invalid'));
    ids.forEach((id) => getById(id)?.classList.add('is-invalid'));
}

function setFormEnabled(enabled) {
    const fieldset = getById('userSignupFieldset');
    const submitBtn = getById('submitSignupBtn');
    if (fieldset) fieldset.disabled = !enabled;
    if (submitBtn) submitBtn.disabled = !enabled;
}

function fillGoogleFields(user) {
    const nameInput = getById('cadastroNome');
    const emailInput = getById('cadastroEmail');

    if (nameInput && !nameInput.value) nameInput.value = user.displayName || '';
    if (emailInput) emailInput.value = user.email || '';

    const accountBox = getById('googleAccountBox');
    if (accountBox) {
        accountBox.innerHTML = `
            <div>
                <span class="section-label">Conta vinculada</span>
                <p class="mb-0"><strong>${escapeHtml(user.displayName || 'Usuario Google')}</strong></p>
                <p class="mb-0 text-muted">${escapeHtml(user.email || '')}</p>
            </div>
            <button id="changeGoogleAccountBtn" type="button" class="btn btn-outline-secondary">
                <i class="fas fa-rotate me-2"></i>Trocar conta
            </button>
        `;

        getById('changeGoogleAccountBtn')?.addEventListener('click', async () => {
            await signOut(auth).catch(() => {});
            location.reload();
        });
    }
}

async function signInGoogle() {
    const button = getById('googleSignupBtn');
    const originalHtml = button?.innerHTML;

    try {
        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Conectando...';
        }

        const credential = await signInWithPopup(auth, provider);
        state.googleUser = credential.user;
        fillGoogleFields(state.googleUser);
        setFormEnabled(true);
        showAlert('Conta Google vinculada. Complete os dados e envie para aprovacao.', 'success');
    } catch (error) {
        console.error('Erro no cadastro com Google:', error);
        showAlert(`Nao foi possivel entrar com Google: ${escapeHtml(error.message)}`, 'danger');
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = originalHtml;
        }
    }
}

async function buscarCep() {
    const cepInput = getById('cadastroCep');
    const cep = onlyDigits(cepInput?.value || '');
    if (cep.length !== 8) {
        showAlert('Informe um CEP valido com 8 numeros.', 'warning');
        return;
    }

    const button = getById('buscarCepBtn');
    const originalHtml = button?.innerHTML;

    try {
        if (button) {
            button.disabled = true;
            button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
        }

        const response = await fetch(`https://viacep.com.br/ws/${cep}/json/`);
        const data = await response.json();
        if (data.erro) {
            showAlert('CEP nao encontrado. Preencha o endereco manualmente.', 'warning');
            return;
        }

        getById('cadastroEndereco').value = data.logradouro || '';
        getById('cadastroBairro').value = data.bairro || '';
        getById('cadastroCidade').value = data.localidade || '';
        getById('cadastroEstado').value = data.uf || '';
        getById('cadastroNumero')?.focus();
    } catch (error) {
        console.error('Erro ao buscar CEP:', error);
        showAlert('Nao foi possivel consultar o CEP agora.', 'danger');
    } finally {
        if (button) {
            button.disabled = false;
            button.innerHTML = originalHtml;
        }
    }
}

function collectFormData() {
    const cpf = onlyDigits(getById('cadastroCpf')?.value || '');
    const nome = String(getById('cadastroNome')?.value || '').trim();
    const whatsapp = onlyDigits(getById('cadastroWhatsapp')?.value || '');
    const email = state.googleUser?.email || getById('cadastroEmail')?.value || '';

    const errors = [];
    const invalidFieldIds = [];

    if (!state.googleUser) errors.push('Entre com sua conta Google antes de enviar.');
    if (!isValidCPF(cpf)) {
        errors.push('Informe um CPF valido.');
        invalidFieldIds.push('cadastroCpf');
    }
    if (!nome) {
        errors.push('Informe o nome completo.');
        invalidFieldIds.push('cadastroNome');
    }
    if (!email) errors.push('A conta Google precisa ter um e-mail.');
    if (whatsapp && (whatsapp.length < 10 || whatsapp.length > 11)) {
        errors.push('Informe um WhatsApp valido.');
        invalidFieldIds.push('cadastroWhatsapp');
    }

    if (errors.length) {
        const validationMessage = `
            <div class="fw-semibold mb-2">Confira os campos:</div>
            <ul class="mb-0 ps-3">${errors.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>
        `;
        state.validationMessage = validationMessage;
        setInvalidFields(invalidFieldIds);
        showAlert(validationMessage, 'danger');
        getById(invalidFieldIds[0])?.focus();
        const error = new Error(errors.join(' '));
        error.name = 'ValidationError';
        throw error;
    }

    state.validationMessage = '';
    setInvalidFields([]);

    return {
        cpf,
        nome,
        email,
        dataNascimento: String(getById('cadastroNascimento')?.value || '').trim(),
        whatsapp,
        endereco: {
            cep: onlyDigits(getById('cadastroCep')?.value || ''),
            logradouro: String(getById('cadastroEndereco')?.value || '').trim(),
            numero: String(getById('cadastroNumero')?.value || '').trim(),
            complemento: String(getById('cadastroComplemento')?.value || '').trim(),
            bairro: String(getById('cadastroBairro')?.value || '').trim(),
            cidade: String(getById('cadastroCidade')?.value || '').trim(),
            estado: String(getById('cadastroEstado')?.value || '').trim().toUpperCase()
        }
    };
}

async function ensureCpfAvailable(cpf, googleUid) {
    const [loginSnapshot, userSnapshot] = await Promise.all([
        get(ref(database, `login/${cpf}`)),
        get(ref(database, `usuarios/${cpf}`))
    ]);

    if (!loginSnapshot.exists() && !userSnapshot.exists()) return;

    const loginData = loginSnapshot.val() || {};
    const userData = userSnapshot.val() || {};
    const existingUid = loginData.uid || userData.uid || '';

    if (existingUid && existingUid === googleUid) {
        throw new Error('Voce ja possui uma solicitacao cadastrada. Aguarde a aprovacao do administrador.');
    }

    throw new Error(`O CPF ${formatCPF(cpf)} ja possui cadastro no sistema.`);
}

async function submitSignup(event) {
    event.preventDefault();

    const submitBtn = getById('submitSignupBtn');
    const originalHtml = submitBtn?.innerHTML;

    try {
        const formData = collectFormData();

        if (submitBtn) {
            submitBtn.disabled = true;
            submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Enviando...';
        }

        await ensureCpfAvailable(formData.cpf, state.googleUser.uid);

        const now = new Date().toISOString();
        const userPayload = {
            cpf: formData.cpf,
            nome: formData.nome,
            email: formData.email,
            whatsapp: formData.whatsapp,
            dataNascimento: formData.dataNascimento,
            endereco: formData.endereco,
            uid: state.googleUser.uid,
            provider: 'google',
            status: 'pendente',
            nivel: 5,
            tipoCadastro: 'usuario-google',
            criadoEm: now,
            atualizadoEm: now
        };

        const loginPayload = {
            cpf: formData.cpf,
            nome: formData.nome,
            email: formData.email,
            uid: state.googleUser.uid,
            provider: 'google',
            status: 'pendente',
            nivel: 5,
            criadoEm: now,
            atualizadoEm: now
        };

        await update(ref(database), {
            [`usuarios/${formData.cpf}`]: userPayload,
            [`login/${formData.cpf}`]: loginPayload
        });

        sessionStorage.clear();
        localStorage.clear();
        await signOut(auth).catch(() => {});

        showAlert(`
            <h4 class="alert-heading">Cadastro enviado com sucesso</h4>
            <p>Sua solicitacao foi registrada e esta aguardando aprovacao do administrador.</p>
            <a href="index.html" class="btn btn-primary mt-2" data-ignore-spa="true">Voltar ao login</a>
        `, 'success');

        getById('userSignupForm')?.reset();
        setFormEnabled(false);
    } catch (error) {
        console.error('Erro ao enviar cadastro:', error);
        if (error.name === 'ValidationError') {
            showAlert(state.validationMessage || escapeHtml(error.message), 'danger');
        } else {
            showAlert(escapeHtml(error.message || 'Nao foi possivel enviar o cadastro.'), 'danger');
        }
        if (submitBtn) submitBtn.disabled = false;
    } finally {
        if (submitBtn) submitBtn.innerHTML = originalHtml;
    }
}

function bindEvents() {
    getById('googleSignupBtn')?.addEventListener('click', signInGoogle);
    getById('buscarCepBtn')?.addEventListener('click', buscarCep);
    getById('userSignupForm')?.addEventListener('submit', submitSignup);

    getById('cadastroCpf')?.addEventListener('input', (event) => {
        event.target.value = onlyDigits(event.target.value).slice(0, 11);
    });

    getById('cadastroWhatsapp')?.addEventListener('input', (event) => {
        event.target.value = formatWhatsapp(event.target.value);
    });

    getById('cadastroCep')?.addEventListener('input', (event) => {
        event.target.value = formatCEP(event.target.value);
    });
}

document.addEventListener('DOMContentLoaded', () => {
    setFormEnabled(false);
    bindEvents();
});
