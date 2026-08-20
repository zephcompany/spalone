const STORAGE_KEY = 'spalone_x_zeph_vault_v1';
const SALT_KEY = 'spalone_x_zeph_salt_v1';
const VERIFIER_KEY = 'spalone_x_zeph_verifier_v1';
const AUTO_LOCK_MS = 15 * 60 * 1000;
const INITIAL_VAULT_URL = 'initial-vault.json?v=1';

const state = {
  records: [],
  selectedId: null,
  key: null,
  masterPassword: null,
  autoLockTimer: null,
  revealed: new Set(),
};

const $ = (id) => document.getElementById(id);
const els = {
  lockScreen: $('lockScreen'), app: $('app'), unlockForm: $('unlockForm'), masterPassword: $('masterPassword'),
  confirmPassword: $('confirmPassword'), confirmWrap: $('confirmWrap'), masterLabel: $('masterLabel'),
  lockDescription: $('lockDescription'), unlockButton: $('unlockButton'), lockError: $('lockError'),
  newBtn: $('newBtn'), emptyNewBtn: $('emptyNewBtn'), exportBtn: $('exportBtn'), importInput: $('importInput'), lockBtn: $('lockBtn'),
  searchInput: $('searchInput'), categoryFilter: $('categoryFilter'), sortFilter: $('sortFilter'), recordsList: $('recordsList'),
  emptyState: $('emptyState'), resultCount: $('resultCount'), detailsEmpty: $('detailsEmpty'), detailsContent: $('detailsContent'),
  statTotal: $('statTotal'), statSites: $('statSites'), statEmails: $('statEmails'), statSocial: $('statSocial'),
  editorBackdrop: $('editorBackdrop'), editorTitle: $('editorTitle'), closeEditorBtn: $('closeEditorBtn'), recordForm: $('recordForm'),
  deleteBtn: $('deleteBtn'), cancelBtn: $('cancelBtn'), recordId: $('recordId'), service: $('service'), category: $('category'),
  client: $('client'), url: $('url'), username: $('username'), email: $('email'), password: $('password'), phone: $('phone'),
  recoveryEmail: $('recoveryEmail'), twoFactor: $('twoFactor'), cardHolder: $('cardHolder'), cardNumber: $('cardNumber'),
  cardExpiry: $('cardExpiry'), cardPurpose: $('cardPurpose'), notes: $('notes'), toast: $('toast')
};

function bytesToB64(bytes) {
  let binary = '';
  bytes.forEach(b => binary += String.fromCharCode(b));
  return btoa(binary);
}
function b64ToBytes(b64) {
  const binary = atob(b64);
  return Uint8Array.from(binary, c => c.charCodeAt(0));
}
function randomBytes(length = 16) { return crypto.getRandomValues(new Uint8Array(length)); }

async function deriveKey(password, saltBytes) {
  const material = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt: saltBytes, iterations: 250000, hash: 'SHA-256' },
    material,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

async function encryptObject(obj, key) {
  const iv = randomBytes(12);
  const data = new TextEncoder().encode(JSON.stringify(obj));
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, data);
  return { iv: bytesToB64(iv), data: bytesToB64(new Uint8Array(encrypted)) };
}

async function decryptObject(payload, key) {
  const decrypted = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: b64ToBytes(payload.iv) },
    key,
    b64ToBytes(payload.data)
  );
  return JSON.parse(new TextDecoder().decode(decrypted));
}

async function makeVerifier(key) { return encryptObject({ ok: 'SPALONE_X_ZEPH' }, key); }

function isFirstRun() { return !localStorage.getItem(SALT_KEY) || !localStorage.getItem(VERIFIER_KEY); }

async function bootstrapInitialVault() {
  const forceBase = new URLSearchParams(window.location.search).get('base') === '1';
  if (!isFirstRun() && !forceBase) return;
  try {
    const response = await fetch(INITIAL_VAULT_URL, { cache: 'no-store' });
    if (!response.ok) return;
    const payload = await response.json();
    if (payload.app !== 'SPALONE X ZEPH' || !payload.salt || !payload.verifier || !payload.vault) return;
    localStorage.setItem(SALT_KEY, payload.salt);
    localStorage.setItem(VERIFIER_KEY, JSON.stringify(payload.verifier));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.vault));
    if (forceBase) history.replaceState({}, '', window.location.pathname + window.location.hash);
  } catch (_) {
    // Se não houver cofre inicial, o sistema segue normalmente e cria um novo.
  }
}

function configureLockScreen() {
  const first = isFirstRun();
  els.confirmWrap.classList.toggle('hidden', !first);
  els.confirmPassword.required = first;
  els.masterLabel.textContent = first ? 'Nova senha mestre' : 'Senha mestre';
  els.lockDescription.textContent = first
    ? 'Crie uma senha mestre para proteger os acessos neste navegador.'
    : 'Digite sua senha mestre para abrir o cofre.';
  els.unlockButton.textContent = first ? 'Criar cofre' : 'Desbloquear';
}

async function handleUnlock(event) {
  event.preventDefault();
  els.lockError.textContent = '';
  const password = els.masterPassword.value;
  if (password.length < 6) return showLockError('Use uma senha mestre com pelo menos 6 caracteres.');

  try {
    if (isFirstRun()) {
      if (password !== els.confirmPassword.value) return showLockError('As senhas não coincidem.');
      const salt = randomBytes(16);
      const key = await deriveKey(password, salt);
      localStorage.setItem(SALT_KEY, bytesToB64(salt));
      localStorage.setItem(VERIFIER_KEY, JSON.stringify(await makeVerifier(key)));
      state.key = key;
      state.masterPassword = password;
      state.records = [];
      await persist();
    } else {
      const salt = b64ToBytes(localStorage.getItem(SALT_KEY));
      const key = await deriveKey(password, salt);
      const verifier = JSON.parse(localStorage.getItem(VERIFIER_KEY));
      const check = await decryptObject(verifier, key);
      if (check.ok !== 'SPALONE_X_ZEPH') throw new Error('invalid');
      state.key = key;
      state.masterPassword = password;
      await loadVault();
    }
    openApp();
  } catch (error) {
    showLockError('Senha mestre incorreta ou cofre inválido.');
  }
}

function showLockError(msg) { els.lockError.textContent = msg; }

async function loadVault() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) { state.records = []; return; }
  const vault = await decryptObject(JSON.parse(raw), state.key);
  state.records = Array.isArray(vault.records) ? vault.records : [];
}

async function persist() {
  if (!state.key) return;
  const payload = await encryptObject({ records: state.records, updatedAt: new Date().toISOString() }, state.key);
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function openApp() {
  els.lockScreen.classList.add('hidden');
  els.app.classList.remove('hidden');
  els.masterPassword.value = '';
  els.confirmPassword.value = '';
  render();
  resetAutoLock();
}

function lockApp() {
  state.key = null;
  state.masterPassword = null;
  state.records = [];
  state.selectedId = null;
  state.revealed.clear();
  clearTimeout(state.autoLockTimer);
  closeEditor();
  els.app.classList.add('hidden');
  els.lockScreen.classList.remove('hidden');
  configureLockScreen();
}

function resetAutoLock() {
  if (!state.key) return;
  clearTimeout(state.autoLockTimer);
  state.autoLockTimer = setTimeout(lockApp, AUTO_LOCK_MS);
}
['click','keydown','mousemove','touchstart'].forEach(evt => document.addEventListener(evt, resetAutoLock, { passive: true }));

function uid() { return crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(16).slice(2)}`; }
function esc(value = '') { return String(value).replace(/[&<>'"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c])); }
function normalize(value = '') { return value.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, ''); }
function initials(text = '') { return text.split(/\s+/).filter(Boolean).slice(0,2).map(x => x[0]).join('').toUpperCase() || 'AC'; }
function maskSecret(value = '') { return value ? '••••••••••••' : '—'; }
function maskCard(value = '') { const d = value.replace(/\D/g,''); return d ? `•••• •••• •••• ${d.slice(-4)}` : '—'; }

function filteredRecords() {
  const q = normalize(els.searchInput.value.trim());
  const cat = els.categoryFilter.value;
  let records = state.records.filter(r => {
    const hay = normalize([r.service,r.category,r.client,r.url,r.username,r.email,r.phone,r.notes].join(' '));
    return (!q || hay.includes(q)) && (cat === 'all' || r.category === cat);
  });
  const sort = els.sortFilter.value;
  records.sort((a,b) => {
    if (sort === 'name') return (a.service || '').localeCompare(b.service || '', 'pt-BR');
    if (sort === 'category') return (a.category || '').localeCompare(b.category || '', 'pt-BR');
    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  });
  return records;
}

function render() {
  renderStats();
  renderList();
  renderDetails();
}

function renderStats() {
  els.statTotal.textContent = state.records.length;
  els.statSites.textContent = state.records.filter(r => ['Site','Hospedagem','Domínio','E-commerce'].includes(r.category)).length;
  els.statEmails.textContent = state.records.filter(r => r.category === 'E-mail').length;
  els.statSocial.textContent = state.records.filter(r => ['Instagram','WhatsApp'].includes(r.category)).length;
}

function renderList() {
  const records = filteredRecords();
  els.resultCount.textContent = `${records.length} ${records.length === 1 ? 'item' : 'itens'}`;
  els.emptyState.classList.toggle('hidden', records.length !== 0);
  els.recordsList.classList.toggle('hidden', records.length === 0);
  els.recordsList.innerHTML = records.map(r => `
    <article class="record-row ${state.selectedId === r.id ? 'active' : ''}" data-id="${r.id}">
      <div class="record-icon">${esc(initials(r.service))}</div>
      <div class="record-main"><strong>${esc(r.service)}</strong><span>${esc(r.client || 'Sem cliente definido')}</span></div>
      <div class="record-sub"><span>${esc(r.username || r.email || 'Sem login')}</span><small>${esc(r.url || r.phone || '')}</small></div>
      <div class="badge">${esc(r.category)}</div>
      <div class="row-actions">
        <button class="icon-btn" data-action="copy" data-id="${r.id}" title="Copiar login">⧉</button>
        <button class="icon-btn" data-action="edit" data-id="${r.id}" title="Editar">✎</button>
      </div>
    </article>
  `).join('');
}

function renderDetails() {
  const r = state.records.find(x => x.id === state.selectedId);
  els.detailsEmpty.classList.toggle('hidden', !!r);
  els.detailsContent.classList.toggle('hidden', !r);
  if (!r) return;
  const passRevealed = state.revealed.has(`password:${r.id}`);
  const cardRevealed = state.revealed.has(`card:${r.id}`);
  els.detailsContent.innerHTML = `
    <div class="detail-wrap">
      <div class="detail-header">
        <div><p class="eyebrow">${esc(r.category)}</p><h3>${esc(r.service)}</h3><p>${esc(r.client || 'Sem cliente definido')}</p></div>
        <div class="record-icon">${esc(initials(r.service))}</div>
      </div>
      <div class="detail-section">
        <div class="detail-section-title">ACESSO</div>
        ${detailItem('Usuário', r.username)}
        ${detailItem('E-mail', r.email, 'copy')}
        ${detailItem('Senha', passRevealed ? r.password : maskSecret(r.password), r.password ? 'secret-password' : '')}
        ${detailItem('URL', r.url, r.url ? 'open' : '')}
      </div>
      <div class="detail-section">
        <div class="detail-section-title">RECUPERAÇÃO</div>
        ${detailItem('Telefone', r.phone, 'copy')}
        ${detailItem('E-mail rec.', r.recoveryEmail, 'copy')}
        ${detailItem('2FA / backup', r.twoFactor)}
      </div>
      ${(r.cardHolder || r.cardNumber || r.cardExpiry || r.cardPurpose) ? `
      <div class="detail-section">
        <div class="detail-section-title">CARTÃO</div>
        ${detailItem('Titular', r.cardHolder)}
        ${detailItem('Número', cardRevealed ? r.cardNumber : maskCard(r.cardNumber), r.cardNumber ? 'secret-card' : '')}
        ${detailItem('Validade', r.cardExpiry)}
        ${detailItem('Finalidade', r.cardPurpose)}
      </div>` : ''}
      ${r.notes ? `<div class="detail-section"><div class="detail-section-title">OBSERVAÇÕES</div><div class="note-box">${esc(r.notes)}</div></div>` : ''}
      <div class="detail-actions">
        <button class="btn secondary" data-detail-action="copy-password">Copiar senha</button>
        <button class="btn primary" data-detail-action="edit">Editar acesso</button>
      </div>
    </div>`;
}

function detailItem(label, value, action = '') {
  const v = value || '—';
  const isMasked = String(v).includes('••••');
  let btn = '';
  if (action === 'copy' && value) btn = `<button class="icon-btn" data-copy-value="${esc(value)}" title="Copiar">⧉</button>`;
  if (action === 'open') btn = `<button class="icon-btn" data-open-url="${esc(value)}" title="Abrir">↗</button>`;
  if (action === 'secret-password') btn = `<button class="icon-btn" data-secret="password" title="Mostrar/ocultar">👁</button>`;
  if (action === 'secret-card') btn = `<button class="icon-btn" data-secret="card" title="Mostrar/ocultar">👁</button>`;
  return `<div class="detail-item"><label>${esc(label)}</label><div class="detail-value ${isMasked ? 'masked' : ''}">${esc(v)}</div>${btn}</div>`;
}

function openEditor(record = null) {
  els.recordForm.reset();
  if (record) {
    els.editorTitle.textContent = 'Editar login';
    els.deleteBtn.classList.remove('hidden');
    Object.keys(record).forEach(key => { if (els[key] && key !== 'id') els[key].value = record[key] || ''; });
    els.recordId.value = record.id;
  } else {
    els.editorTitle.textContent = 'Novo login';
    els.deleteBtn.classList.add('hidden');
    els.recordId.value = '';
  }
  els.editorBackdrop.classList.remove('hidden');
  setTimeout(() => els.service.focus(), 30);
}
function closeEditor() { els.editorBackdrop.classList.add('hidden'); }

async function saveRecord(event) {
  event.preventDefault();
  const now = new Date().toISOString();
  const record = {
    id: els.recordId.value || uid(),
    service: els.service.value.trim(), category: els.category.value, client: els.client.value.trim(),
    url: els.url.value.trim(), username: els.username.value.trim(), email: els.email.value.trim(),
    password: els.password.value, phone: els.phone.value.trim(), recoveryEmail: els.recoveryEmail.value.trim(),
    twoFactor: els.twoFactor.value.trim(), cardHolder: els.cardHolder.value.trim(), cardNumber: els.cardNumber.value.trim(),
    cardExpiry: els.cardExpiry.value.trim(), cardPurpose: els.cardPurpose.value.trim(), notes: els.notes.value.trim(),
    updatedAt: now,
  };
  const index = state.records.findIndex(r => r.id === record.id);
  if (index >= 0) record.createdAt = state.records[index].createdAt || now;
  else record.createdAt = now;
  if (index >= 0) state.records[index] = record; else state.records.unshift(record);
  state.selectedId = record.id;
  await persist();
  closeEditor();
  render();
  toast('Acesso salvo');
}

async function deleteCurrent() {
  const id = els.recordId.value;
  if (!id) return;
  const record = state.records.find(r => r.id === id);
  if (!record || !confirm(`Excluir o acesso “${record.service}”?`)) return;
  state.records = state.records.filter(r => r.id !== id);
  if (state.selectedId === id) state.selectedId = null;
  await persist();
  closeEditor(); render(); toast('Acesso excluído');
}

async function copyText(text, msg = 'Copiado') {
  if (!text) return toast('Nada para copiar');
  try { await navigator.clipboard.writeText(text); }
  catch { const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
  toast(msg);
}

function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.remove('hidden');
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => els.toast.classList.add('hidden'), 1800);
}

async function exportVault() {
  if (!state.key) return;
  const exportPayload = {
    app: 'SPALONE X ZEPH', version: 1,
    exportedAt: new Date().toISOString(),
    salt: localStorage.getItem(SALT_KEY),
    verifier: JSON.parse(localStorage.getItem(VERIFIER_KEY)),
    vault: JSON.parse(localStorage.getItem(STORAGE_KEY)),
  };
  const blob = new Blob([JSON.stringify(exportPayload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `spalone-x-zeph-backup-${new Date().toISOString().slice(0,10)}.json`;
  a.click(); URL.revokeObjectURL(url);
  toast('Backup exportado');
}

async function importVault(file) {
  if (!file) return;
  try {
    const payload = JSON.parse(await file.text());
    if (payload.app !== 'SPALONE X ZEPH' || !payload.salt || !payload.verifier || !payload.vault) throw new Error('invalid');
    if (!confirm('Importar este backup substituirá o cofre atual deste navegador. Continuar?')) return;
    localStorage.setItem(SALT_KEY, payload.salt);
    localStorage.setItem(VERIFIER_KEY, JSON.stringify(payload.verifier));
    localStorage.setItem(STORAGE_KEY, JSON.stringify(payload.vault));
    toast('Backup importado. Desbloqueie com a senha do backup.');
    setTimeout(lockApp, 500);
  } catch { toast('Arquivo de backup inválido'); }
  finally { els.importInput.value = ''; }
}

els.unlockForm.addEventListener('submit', handleUnlock);
els.newBtn.addEventListener('click', () => openEditor());
els.emptyNewBtn.addEventListener('click', () => openEditor());
els.closeEditorBtn.addEventListener('click', closeEditor);
els.cancelBtn.addEventListener('click', closeEditor);
els.editorBackdrop.addEventListener('click', (e) => { if (e.target === els.editorBackdrop) closeEditor(); });
els.recordForm.addEventListener('submit', saveRecord);
els.deleteBtn.addEventListener('click', deleteCurrent);
els.lockBtn.addEventListener('click', lockApp);
els.exportBtn.addEventListener('click', exportVault);
els.importInput.addEventListener('change', e => importVault(e.target.files?.[0]));
[els.searchInput, els.categoryFilter, els.sortFilter].forEach(el => el.addEventListener('input', renderList));

els.recordsList.addEventListener('click', async (e) => {
  const actionBtn = e.target.closest('[data-action]');
  if (actionBtn) {
    e.stopPropagation();
    const r = state.records.find(x => x.id === actionBtn.dataset.id);
    if (!r) return;
    if (actionBtn.dataset.action === 'edit') openEditor(r);
    if (actionBtn.dataset.action === 'copy') await copyText(r.username || r.email, 'Login copiado');
    return;
  }
  const row = e.target.closest('.record-row');
  if (row) { state.selectedId = row.dataset.id; renderList(); renderDetails(); }
});

els.detailsContent.addEventListener('click', async (e) => {
  const r = state.records.find(x => x.id === state.selectedId);
  if (!r) return;
  const copyBtn = e.target.closest('[data-copy-value]');
  if (copyBtn) return copyText(copyBtn.dataset.copyValue);
  const openBtn = e.target.closest('[data-open-url]');
  if (openBtn) return window.open(openBtn.dataset.openUrl, '_blank', 'noopener,noreferrer');
  const secretBtn = e.target.closest('[data-secret]');
  if (secretBtn) {
    const key = `${secretBtn.dataset.secret}:${r.id}`;
    state.revealed.has(key) ? state.revealed.delete(key) : state.revealed.add(key);
    return renderDetails();
  }
  const action = e.target.closest('[data-detail-action]')?.dataset.detailAction;
  if (action === 'edit') openEditor(r);
  if (action === 'copy-password') copyText(r.password, 'Senha copiada');
});

document.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-toggle-input]');
  if (!btn) return;
  const input = $(btn.dataset.toggleInput);
  input.type = input.type === 'password' ? 'text' : 'password';
});

document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !els.editorBackdrop.classList.contains('hidden')) closeEditor();
  if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k' && !els.app.classList.contains('hidden')) {
    e.preventDefault(); els.searchInput.focus();
  }
});

bootstrapInitialVault().finally(configureLockScreen);
