import { database } from './firebase-config.js';
import { ref, get, update } from "https://www.gstatic.com/firebasejs/9.23.0/firebase-database.js";

const state = {
    actorCpf: '',
    actorLevel: 5,
    targetCpf: '',
    targetData: null,
    usersForSearch: []
};

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

function onlyDigits(value) {
    return String(value || '').replace(/\D/g, '');
}

function normalizeText(value) {
    return String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .toLowerCase();
}

function formatCPF(cpf) {
    const digits = onlyDigits(cpf).padStart(11, '0').slice(-11);
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, '$1.$2.$3-$4');
}

function formatPhone(value) {
    const digits = onlyDigits(value).slice(0, 11);
    if (digits.length <= 2) return digits;
    if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
    if (digits.length <= 10) return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

function formatCep(value) {
    const digits = onlyDigits(value).slice(0, 8);
    if (digits.length <= 5) return digits;
    return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

function getLevelLabel(level) {
    const normalized = String(level || '5');
    if (normalized === '1') return 'Administrador';
    if (normalized === '2') return 'Moderador';
    if (normalized === '3') return 'Vendedor';
    if (normalized === '4') return 'Reserva';
    return 'Cliente';
}

function getTargetCpf() {
    const params = new URLSearchParams(window.location.search || '');
    const queryCpf = onlyDigits(params.get('cpf') || '');
    const storedCpf = onlyDigits(sessionStorage.getItem('selectedProfileCpf') || '');

    if (state.actorLevel === 1 && queryCpf.length === 11) return queryCpf;
    if (state.actorLevel === 1 && storedCpf.length === 11) return storedCpf;
    return state.actorCpf;
}

async function loadUser(cpf) {
    const [usuarioSnapshot, loginSnapshot] = await Promise.all([
        get(ref(database, `usuarios/${cpf}`)),
        get(ref(database, `login/${cpf}`))
    ]);

    const usuario = usuarioSnapshot.exists() ? usuarioSnapshot.val() : {};
    const login = loginSnapshot.exists() ? loginSnapshot.val() : {};

    return {
        ...login,
        ...usuario,
        cpf,
        status: login.status || usuario.status || 'ativo',
        nivel: Number(usuario.nivel || login.nivel || 5),
        endereco: usuario.endereco || {}
    };
}

async function loadUsersForSearch() {
    if (state.actorLevel !== 1) {
        state.usersForSearch = [];
        return;
    }

    const [usuariosSnapshot, loginSnapshot] = await Promise.all([
        get(ref(database, 'usuarios')),
        get(ref(database, 'login'))
    ]);

    const usuarios = usuariosSnapshot.val() || {};
    const login = loginSnapshot.val() || {};

    state.usersForSearch = Object.entries(login)
        .map(([cpf, loginData]) => ({
            cpf,
            ...(usuarios?.[cpf] || {}),
            ...loginData
        }))
        .sort((a, b) => String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR', { sensitivity: 'base' }));
}

function renderPerfilShell(content) {
    content.innerHTML = `
        ${state.actorLevel === 1 ? `
            <div class="card mb-4">
                <div class="card-header">
                    <h5 class="mb-0">Selecionar usuario</h5>
                </div>
                <div class="card-body">
                    <label for="perfilSearchInput" class="form-label">Buscar por CPF, nome ou e-mail</label>
                    <div class="profile-search-wrap">
                        <input id="perfilSearchInput" type="search" class="form-control" autocomplete="off" placeholder="Digite para pesquisar">
                        <div id="perfilSearchSuggestions" class="profile-search-suggestions d-none"></div>
                    </div>
                </div>
            </div>
        ` : ''}

        <div id="perfilAlert" class="alert d-none"></div>

        <form id="perfilForm" class="row g-3">
            <div class="col-12">
                <div class="profile-selected-bar">
                    <div>
                        <span class="section-label">Perfil selecionado</span>
                        <h2 id="perfilSelectedName">Carregando...</h2>
                    </div>
                    <span id="perfilStatusBadge" class="badge text-bg-primary">Status</span>
                </div>
            </div>

            <div class="col-12 col-lg-4">
                <label class="form-label" for="perfilCpf">CPF</label>
                <input id="perfilCpf" class="form-control" disabled>
            </div>
            <div class="col-12 col-lg-8">
                <label class="form-label" for="perfilNome">Nome completo</label>
                <input id="perfilNome" class="form-control">
            </div>
            <div class="col-12 col-lg-4">
                <label class="form-label" for="perfilEmail">E-mail</label>
                <input id="perfilEmail" class="form-control" type="email">
            </div>
            <div class="col-12 col-lg-4">
                <label class="form-label" for="perfilWhatsapp">WhatsApp</label>
                <input id="perfilWhatsapp" class="form-control" inputmode="numeric">
            </div>
            <div class="col-12 col-lg-4">
                <label class="form-label" for="perfilNascimento">Data de nascimento</label>
                <input id="perfilNascimento" class="form-control" type="date">
            </div>

            <div class="col-12 col-lg-3">
                <label class="form-label" for="perfilNivel">Nivel</label>
                <select id="perfilNivel" class="form-select">
                    <option value="1">1 - Administrador</option>
                    <option value="2">2 - Moderador</option>
                    <option value="3">3 - Vendedor</option>
                    <option value="4">4 - Reserva</option>
                    <option value="5">5 - Cliente</option>
                </select>
            </div>
            <div class="col-12 col-lg-3">
                <label class="form-label" for="perfilStatus">Status</label>
                <select id="perfilStatus" class="form-select">
                    <option value="ativo">Ativo</option>
                    <option value="pendente">Pendente</option>
                    <option value="reprovado">Reprovado</option>
                    <option value="desativado">Desativado</option>
                </select>
            </div>

            <div class="col-12 col-lg-3">
                <label class="form-label" for="perfilCep">CEP</label>
                <input id="perfilCep" class="form-control" inputmode="numeric">
            </div>
            <div class="col-12 col-lg-7">
                <label class="form-label" for="perfilEndereco">Endereco</label>
                <input id="perfilEndereco" class="form-control">
            </div>
            <div class="col-12 col-lg-2">
                <label class="form-label" for="perfilNumero">Numero</label>
                <input id="perfilNumero" class="form-control">
            </div>
            <div class="col-12 col-lg-4">
                <label class="form-label" for="perfilComplemento">Complemento</label>
                <input id="perfilComplemento" class="form-control">
            </div>
            <div class="col-12 col-lg-4">
                <label class="form-label" for="perfilBairro">Bairro</label>
                <input id="perfilBairro" class="form-control">
            </div>
            <div class="col-12 col-lg-3">
                <label class="form-label" for="perfilCidade">Cidade</label>
                <input id="perfilCidade" class="form-control">
            </div>
            <div class="col-12 col-lg-1">
                <label class="form-label" for="perfilEstado">UF</label>
                <input id="perfilEstado" class="form-control" maxlength="2">
            </div>

            <div class="col-12 d-flex flex-column flex-md-row gap-2 justify-content-end">
                <button id="perfilReprovarBtn" type="button" class="btn btn-outline-danger d-none">
                    <i class="fas fa-ban me-2"></i>Reprovar
                </button>
                <button id="perfilAprovarBtn" type="button" class="btn btn-outline-primary d-none">
                    <i class="fas fa-check me-2"></i>Aprovar
                </button>
                <button id="perfilSalvarBtn" type="submit" class="btn btn-primary">
                    <i class="fas fa-save me-2"></i>Salvar alteracoes
                </button>
            </div>
        </form>
    `;
}

function showAlert(message, type = 'info') {
    const alert = getById('perfilAlert');
    if (!alert) return;
    alert.className = `alert alert-${type}`;
    alert.textContent = message;
}

function applyPermissions() {
    const isAdmin = state.actorLevel === 1;
    const isSelf = state.targetCpf === state.actorCpf;

    ['perfilNome', 'perfilEmail', 'perfilNivel', 'perfilStatus'].forEach((id) => {
        const input = getById(id);
        if (input) input.disabled = !isAdmin;
    });

    const canEditBasic = isAdmin || isSelf;
    [
        'perfilWhatsapp',
        'perfilNascimento',
        'perfilCep',
        'perfilEndereco',
        'perfilNumero',
        'perfilComplemento',
        'perfilBairro',
        'perfilCidade',
        'perfilEstado'
    ].forEach((id) => {
        const input = getById(id);
        if (input) input.disabled = !canEditBasic;
    });

    const isPending = String(state.targetData?.status || '').toLowerCase() === 'pendente';
    getById('perfilAprovarBtn')?.classList.toggle('d-none', !(isAdmin && isPending));
    getById('perfilReprovarBtn')?.classList.toggle('d-none', !(isAdmin && isPending));
}

function fillForm(userData) {
    state.targetData = userData;
    state.targetCpf = userData.cpf;
    sessionStorage.setItem('selectedProfileCpf', userData.cpf);

    getById('perfilSelectedName').textContent = userData.nome || 'Usuario';
    getById('perfilStatusBadge').textContent = String(userData.status || 'ativo').toUpperCase();
    getById('perfilCpf').value = formatCPF(userData.cpf || '');
    getById('perfilNome').value = userData.nome || '';
    getById('perfilEmail').value = userData.email || '';
    getById('perfilWhatsapp').value = formatPhone(userData.whatsapp || '');
    getById('perfilNascimento').value = String(userData.dataNascimento || '').slice(0, 10);
    getById('perfilNivel').value = String(userData.nivel || 5);
    getById('perfilStatus').value = String(userData.status || 'ativo').toLowerCase();

    const endereco = userData.endereco || {};
    getById('perfilCep').value = formatCep(endereco.cep || '');
    getById('perfilEndereco').value = endereco.logradouro || '';
    getById('perfilNumero').value = endereco.numero || '';
    getById('perfilComplemento').value = endereco.complemento || '';
    getById('perfilBairro').value = endereco.bairro || '';
    getById('perfilCidade').value = endereco.cidade || '';
    getById('perfilEstado').value = String(endereco.estado || '').toUpperCase();

    applyPermissions();
}

function collectForm() {
    return {
        cpf: state.targetCpf,
        nome: String(getById('perfilNome')?.value || '').trim(),
        email: String(getById('perfilEmail')?.value || '').trim(),
        whatsapp: onlyDigits(getById('perfilWhatsapp')?.value || ''),
        dataNascimento: String(getById('perfilNascimento')?.value || '').trim(),
        nivel: Number(getById('perfilNivel')?.value || 5),
        status: String(getById('perfilStatus')?.value || 'ativo').toLowerCase(),
        endereco: {
            cep: onlyDigits(getById('perfilCep')?.value || ''),
            logradouro: String(getById('perfilEndereco')?.value || '').trim(),
            numero: String(getById('perfilNumero')?.value || '').trim(),
            complemento: String(getById('perfilComplemento')?.value || '').trim(),
            bairro: String(getById('perfilBairro')?.value || '').trim(),
            cidade: String(getById('perfilCidade')?.value || '').trim(),
            estado: String(getById('perfilEstado')?.value || '').trim().toUpperCase()
        }
    };
}

async function saveProfile(overrideStatus = null) {
    const formData = collectForm();
    const now = new Date().toISOString();
    const status = overrideStatus || formData.status;
    const updates = {
        ...state.targetData,
        ...formData,
        status,
        atualizadoEm: now,
        atualizadoPor: state.actorCpf
    };

    if (overrideStatus) {
        updates.analisadoEm = now;
        updates.analisadoPorCpf = state.actorCpf;
        updates.analisadoPorNome = sessionStorage.getItem('userName') || 'Administrador';
    }

    await update(ref(database), {
        [`usuarios/${state.targetCpf}`]: updates,
        [`login/${state.targetCpf}`]: {
            cpf: state.targetCpf,
            nome: updates.nome,
            email: updates.email,
            uid: state.targetData.uid || '',
            provider: state.targetData.provider || 'google',
            criadoEm: state.targetData.criadoEm || now,
            status,
            nivel: updates.nivel,
            atualizadoEm: now,
            ...(overrideStatus ? {
                analisadoEm: now,
                analisadoPorCpf: state.actorCpf,
                analisadoPorNome: sessionStorage.getItem('userName') || 'Administrador'
            } : {})
        }
    });

    state.targetData = updates;
    fillForm(updates);
}

function renderSearchSuggestions(query) {
    const box = getById('perfilSearchSuggestions');
    if (!box) return;

    const normalized = normalizeText(query);
    const digits = onlyDigits(query);
    const matches = state.usersForSearch
        .filter((user) => {
            const haystack = normalizeText(`${user.nome || ''} ${user.email || ''} ${user.cpf || ''}`);
            return normalized && haystack.includes(normalized) || digits && onlyDigits(user.cpf).includes(digits);
        })
        .slice(0, 8);

    if (!matches.length) {
        box.classList.add('d-none');
        box.innerHTML = '';
        return;
    }

    box.innerHTML = matches.map((user) => `
        <button type="button" class="profile-search-option" data-profile-cpf="${escapeHtml(user.cpf)}">
            <strong>${escapeHtml(user.nome || 'Usuario')}</strong>
            <span>${escapeHtml(formatCPF(user.cpf))} | ${escapeHtml(user.email || '-')} | ${escapeHtml(getLevelLabel(user.nivel))}</span>
        </button>
    `).join('');
    box.classList.remove('d-none');
}

function bindEvents() {
    getById('perfilWhatsapp')?.addEventListener('input', (event) => {
        event.target.value = formatPhone(event.target.value);
    });

    getById('perfilCep')?.addEventListener('input', (event) => {
        event.target.value = formatCep(event.target.value);
    });

    getById('perfilForm')?.addEventListener('submit', async (event) => {
        event.preventDefault();
        try {
            await saveProfile();
            showAlert('Perfil salvo com sucesso.', 'success');
        } catch (error) {
            console.error('Erro ao salvar perfil:', error);
            showAlert('Nao foi possivel salvar: ' + error.message, 'danger');
        }
    });

    getById('perfilAprovarBtn')?.addEventListener('click', async () => {
        try {
            await saveProfile('ativo');
            showAlert('Usuario aprovado com sucesso.', 'success');
        } catch (error) {
            console.error('Erro ao aprovar:', error);
            showAlert('Nao foi possivel aprovar: ' + error.message, 'danger');
        }
    });

    getById('perfilReprovarBtn')?.addEventListener('click', async () => {
        if (!confirm('Deseja reprovar este cadastro?')) return;
        try {
            await saveProfile('reprovado');
            showAlert('Usuario reprovado.', 'success');
        } catch (error) {
            console.error('Erro ao reprovar:', error);
            showAlert('Nao foi possivel reprovar: ' + error.message, 'danger');
        }
    });

    getById('perfilSearchInput')?.addEventListener('input', (event) => {
        renderSearchSuggestions(event.target.value || '');
    });

    getById('perfilSearchSuggestions')?.addEventListener('click', async (event) => {
        const option = event.target.closest('[data-profile-cpf]');
        if (!option) return;

        const cpf = option.getAttribute('data-profile-cpf');
        const userData = await loadUser(cpf);
        fillForm(userData);
        getById('perfilSearchSuggestions')?.classList.add('d-none');
        getById('perfilSearchInput').value = userData.nome || '';
    });
}

export async function initPage() {
    const content = getById('perfil-content');
    if (!content) return;

    try {
        state.actorCpf = sessionStorage.getItem('userCPF') || '';
        state.actorLevel = Number(sessionStorage.getItem('currentUserLevel') || 5);

        renderPerfilShell(content);
        bindEvents();
        await loadUsersForSearch();

        const userData = await loadUser(getTargetCpf());
        fillForm(userData);
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
