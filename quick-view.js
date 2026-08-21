
const BASE_VERSION_KEY_V3 = 'spalone_x_zeph_base_version_v3';
const BASE_VAULT_URL_V3 = 'initial-vault.json?v=3';

function upgradeSocialCategoryOptions() {
  document.querySelectorAll('#categoryFilter option, #category option').forEach(option => {
    if (option.value === 'Instagram' || option.textContent.trim() === 'Instagram') {
      option.value = 'Redes Sociais';
      option.textContent = 'Redes Sociais';
    }
  });
  const oldFilters = document.querySelector('.quick-category-filters');
  if (oldFilters) oldFilters.remove();
}

function socialRecordKey(record = {}) {
  const cat = normalize(record.category || '');
  if (['instagram', 'redes sociais'].includes(cat)) return `social:${normalize(record.client || record.service || '')}`;
  return `${normalize(record.service || '')}|${normalize(record.client || '')}`;
}

async function syncBaseVaultV3(password) {
  if (!password) return;
  try {
    const response = await fetch(BASE_VAULT_URL_V3, { cache: 'no-store' });
    if (!response.ok) return;
    const payload = await response.json();
    const remoteVersion = Number(payload.version || 1);
    const localVersion = Number(localStorage.getItem(BASE_VERSION_KEY_V3) || 0);
    if (remoteVersion <= localVersion) return;

    const baseKey = await deriveKey(password, b64ToBytes(payload.salt));
    const check = await decryptObject(payload.verifier, baseKey);
    if (check.ok !== 'SPALONE_X_ZEPH') return;
    const baseVault = await decryptObject(payload.vault, baseKey);
    const baseRecords = Array.isArray(baseVault.records) ? baseVault.records : [];

    const localByKey = new Map(state.records.map(r => [socialRecordKey(r), r]));
    const merged = baseRecords.map(base => {
      const key = socialRecordKey(base);
      const local = localByKey.get(key);
      if (!local) return base;
      localByKey.delete(key);
      return { ...local, ...base, id: local.id || base.id, createdAt: local.createdAt || base.createdAt };
    });
    merged.push(...localByKey.values());
    state.records = merged;
    await persist();
    localStorage.setItem(BASE_VERSION_KEY_V3, String(remoteVersion));
    renderStats();
    renderList();
  } catch (_) {}
}

const originalOpenAppV3 = openApp;
openApp = function openAppV3() {
  const password = state.masterPassword;
  originalOpenAppV3();
  syncBaseVaultV3(password);
};

filteredRecords = function filteredRecordsV3() {
  const q = normalize(els.searchInput.value.trim());
  const cat = els.categoryFilter.value;
  let records = state.records.filter(r => {
    const hay = normalize([r.service,r.category,r.client,r.url,r.username,r.email,r.phone,r.notes,JSON.stringify(r.socials || [])].join(' '));
    return (!q || hay.includes(q)) && (cat === 'all' || r.category === cat);
  });
  const sort = els.sortFilter.value;
  records.sort((a,b) => {
    if (sort === 'name') return (a.service || '').localeCompare(b.service || '', 'pt-BR');
    if (sort === 'category') return (a.category || '').localeCompare(b.category || '', 'pt-BR');
    return new Date(b.updatedAt || 0) - new Date(a.updatedAt || 0);
  });
  return records;
};

renderStats = function renderStatsV3() {
  els.statTotal.textContent = state.records.length;
  els.statSites.textContent = state.records.filter(r => ['Site','Hospedagem','Domínio','E-commerce'].includes(r.category)).length;
  els.statEmails.textContent = state.records.filter(r => r.category === 'E-mail').length;
  els.statSocial.textContent = state.records.filter(r => ['Redes Sociais','Instagram','WhatsApp'].includes(r.category)).length;
};

upgradeSocialCategoryOptions();
function quickSafeUrl(value = '') {
  if (!value) return '';
  try {
    const raw = /^https?:\/\//i.test(value) ? value : `https://${value}`;
    const url = new URL(raw);
    return ['http:', 'https:'].includes(url.protocol) ? url.href : '';
  } catch (_) {
    return '';
  }
}

function quickCopyIcon(recordId, field, label, socialIndex = '') {
  const socialAttr = socialIndex === '' ? '' : ` data-social-index="${socialIndex}"`;
  return `
    <button class="field-copy" data-quick-action="copy-field" data-id="${esc(recordId)}" data-field="${esc(field)}"${socialAttr} type="button" aria-label="Copiar ${esc(label)}" title="Copiar ${esc(label)}">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="8" y="8" width="11" height="11" rx="2"></rect>
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path>
      </svg>
    </button>`;
}

function quickValue(label, value, recordId, field, kind = '', socialIndex = '') {
  if (!value) return '';
  const isLink = field === 'url';
  const openAttrs = isLink ? ` data-quick-action="open-field" data-url="${esc(quickSafeUrl(value))}"` : '';
  return `
    <div class="quick-field ${kind} ${isLink ? 'clickable-link' : ''}"${openAttrs}>
      <div class="quick-field-content">
        <span>${esc(label)}</span>
        <strong>${esc(value)}</strong>
      </div>
      ${field ? quickCopyIcon(recordId, field, label, socialIndex) : ''}
    </div>`;
}

function renderSocialPlatform(record, social, index) {
  if (!social) return '';
  const title = social.platform || 'Rede social';
  return `
    <section class="social-platform">
      <div class="social-platform-title">${esc(title)}</div>
      <div class="quick-fields social-fields">
        ${social.username ? quickValue('Usuário', social.username, record.id, 'username', '', index) : ''}
        ${social.email ? quickValue('E-mail', social.email, record.id, 'email', '', index) : ''}
        ${social.emailAlt ? quickValue('E-mail alternativo', social.emailAlt, record.id, 'emailAlt', '', index) : ''}
        ${social.password ? quickValue('Senha', social.password, record.id, 'password', 'password-visible', index) : ''}
        ${social.url ? quickValue('Link', social.url, record.id, 'url', 'link-field', index) : ''}
      </div>
    </section>`;
}

function setupQuickCategoryFilters() {
  const toolbar = document.querySelector('.toolbar');
  if (!toolbar || document.querySelector('.quick-category-filters')) return;
  const wrap = document.createElement('div');
  wrap.className = 'quick-category-filters';
  const options = Array.from(els.categoryFilter.options).map(option => ({
    value: option.value,
    label: option.value === 'all' ? 'Todos' : option.textContent.trim()
  }));
  wrap.innerHTML = options.map(option => `
    <button type="button" class="category-chip ${option.value === 'all' ? 'active' : ''}" data-category-value="${esc(option.value)}">${esc(option.label)}</button>
  `).join('');
  toolbar.parentNode.insertBefore(wrap, toolbar);
  wrap.addEventListener('click', (event) => {
    const button = event.target.closest('[data-category-value]');
    if (!button) return;
    els.categoryFilter.value = button.dataset.categoryValue;
    wrap.querySelectorAll('.category-chip').forEach(item => item.classList.toggle('active', item === button));
    renderList();
  });
}

function syncQuickCategoryFilter() {
  const wrap = document.querySelector('.quick-category-filters');
  if (!wrap) return;
  wrap.querySelectorAll('.category-chip').forEach(button => {
    button.classList.toggle('active', button.dataset.categoryValue === els.categoryFilter.value);
  });
}

function installRefinedLayout() {
  if (document.getElementById('spalone-refined-layout-v10')) return;
  const style = document.createElement('style');
  style.id = 'spalone-refined-layout-v10';
  style.textContent = `
    @media (min-width: 901px) {
      .overview > div:first-child { max-width:none!important; min-width:0!important; flex:1 1 auto!important; }
      .overview h1 { white-space:nowrap!important; font-size:clamp(28px,3vw,43px)!important; line-height:1.04!important; }
    }
    .card-top { width:100%!important; display:grid!important; grid-template-columns:minmax(0,1fr) auto!important; align-items:start!important; gap:14px!important; margin:0 0 15px!important; padding:0!important; text-align:left!important; }
    .card-top>div:first-child { width:100%!important; min-width:0!important; margin:0!important; padding:0!important; text-align:left!important; }
    .card-category,.card-top h3,.card-top p { margin-left:0!important; margin-right:0!important; padding-left:0!important; padding-right:0!important; text-align:left!important; }
    .card-edit { align-self:start!important; justify-self:end!important; margin:0!important; padding:8px 12px!important; min-height:32px!important; line-height:1!important; }
    .card-actions { display:none!important; }
    .count-pill { display:inline-flex!important; align-items:center!important; justify-content:center!important; height:30px!important; min-height:30px!important; padding:0 12px!important; margin:0!important; line-height:1!important; box-sizing:border-box!important; white-space:nowrap!important; }
    .social-platform { margin-top:12px; padding-top:12px; border-top:1px solid rgba(255,255,255,.055); }
    .social-platform:first-child { margin-top:0; padding-top:0; border-top:0; }
    .social-platform-title { margin:0 0 8px; color:#969696; font-size:10px; font-weight:600; letter-spacing:.08em; text-transform:uppercase; }
    .social-fields { gap:7px!important; }
    .social-fields .quick-field { min-height:64px!important; }
    .clickable-link { cursor:pointer; }
    .clickable-link:hover { border-color:rgba(255,255,255,.13)!important; }
    @media (max-width:900px) { .overview h1 { white-space:normal!important; } }
  `;
  document.head.appendChild(style);
}

renderList = function renderListQuick() {
  const records = filteredRecords();
  els.resultCount.textContent = `${records.length} ${records.length === 1 ? 'acesso' : 'acessos'}`;
  els.emptyState.classList.toggle('hidden', records.length !== 0);
  els.recordsList.classList.toggle('hidden', records.length === 0);
  syncQuickCategoryFilter();

  els.recordsList.innerHTML = records.map(r => {
    const url = quickSafeUrl(r.url);
    const hasCard = r.cardHolder || r.cardNumber || r.cardExpiry || r.cardPurpose;
    const isSocial = r.category === 'Redes Sociais' && Array.isArray(r.socials) && r.socials.length;
    const fields = isSocial ? r.socials.map((social, index) => renderSocialPlatform(r, social, index)).join('') : `
      <div class="quick-fields">
        ${r.username ? quickValue('Login', r.username, r.id, 'username') : ''}
        ${r.email && r.email !== r.username ? quickValue('E-mail', r.email, r.id, 'email') : ''}
        ${r.password ? quickValue('Senha', r.password, r.id, 'password', 'password-visible') : ''}
        ${r.url ? quickValue('Link', r.url, r.id, 'url', 'link-field') : ''}
        ${r.phone ? quickValue('Telefone', r.phone, r.id, 'phone') : ''}
        ${r.recoveryEmail ? quickValue('Recuperação', r.recoveryEmail, r.id, 'recoveryEmail') : ''}
        ${r.twoFactor ? quickValue('2FA / backup', r.twoFactor, r.id, 'twoFactor') : ''}
        ${hasCard && r.cardHolder ? quickValue('Titular', r.cardHolder, r.id, 'cardHolder') : ''}
        ${r.cardNumber ? quickValue('Cartão', r.cardNumber, r.id, 'cardNumber', 'password-visible') : ''}
        ${r.cardExpiry ? quickValue('Validade', r.cardExpiry, r.id, 'cardExpiry') : ''}
        ${r.cardPurpose ? quickValue('Finalidade', r.cardPurpose, r.id, 'cardPurpose') : ''}
      </div>`;

    return `
      <article class="record-row access-card" data-id="${esc(r.id)}" data-quick-url="${esc(url)}">
        <div class="card-top">
          <div>
            <span class="card-category">${esc(r.category || 'Outro')}</span>
            <h3>${esc(r.service || 'Acesso')}</h3>
            ${r.client ? `<p>${esc(r.client)}</p>` : ''}
          </div>
          <button class="card-edit" data-quick-action="edit" data-id="${esc(r.id)}" type="button">Editar</button>
        </div>
        ${fields}
        ${r.notes ? `<div class="quick-notes">${esc(r.notes)}</div>` : ''}
      </article>`;
  }).join('');
};


let preservedSocialEdit = null;
els.recordForm.addEventListener('submit', () => {
  const id = els.recordId.value;
  const current = state.records.find(r => r.id === id);
  preservedSocialEdit = current && Array.isArray(current.socials) ? { id, socials: current.socials } : null;
  if (!preservedSocialEdit) return;
  setTimeout(async () => {
    const updated = state.records.find(r => r.id === preservedSocialEdit.id);
    if (!updated) return;
    updated.socials = preservedSocialEdit.socials;
    await persist();
    renderStats();
    renderList();
  }, 120);
}, true);

installRefinedLayout();
setupQuickCategoryFilters();
const quickPanelTitle = document.querySelector('.panel-head h3');
if (quickPanelTitle) quickPanelTitle.textContent = 'Clique no card para abrir ou copie os dados pelo ícone';

els.recordsList.addEventListener('click', async (event) => {
  const actionButton = event.target.closest('[data-quick-action]');
  const card = event.target.closest('.access-card');
  if (!actionButton && !card) return;
  event.preventDefault();
  event.stopImmediatePropagation();

  if (actionButton) {
    const action = actionButton.dataset.quickAction;
    if (action === 'open-field') {
      const url = quickSafeUrl(actionButton.dataset.url);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    const record = state.records.find(item => item.id === actionButton.dataset.id);
    if (!record) return;
    if (action === 'edit') return openEditor(record);
    if (action === 'copy-field') {
      const field = actionButton.dataset.field;
      const socialIndex = actionButton.dataset.socialIndex;
      const source = socialIndex !== undefined ? record.socials?.[Number(socialIndex)] : record;
      const value = source?.[field];
      if (value) return copyText(value, 'Copiado');
    }
    return;
  }

  const clickableLink = event.target.closest('.clickable-link');
  if (clickableLink?.dataset.url) {
    const url = quickSafeUrl(clickableLink.dataset.url);
    if (url) window.open(url, '_blank', 'noopener,noreferrer');
    return;
  }

  const url = quickSafeUrl(card.dataset.quickUrl);
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}, true);
