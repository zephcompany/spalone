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

function quickCopyIcon(recordId, field, label) {
  return `
    <button class="field-copy" data-quick-action="copy-field" data-id="${esc(recordId)}" data-field="${esc(field)}" type="button" aria-label="Copiar ${esc(label)}" title="Copiar ${esc(label)}">
      <svg viewBox="0 0 24 24" aria-hidden="true">
        <rect x="8" y="8" width="11" height="11" rx="2"></rect>
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2"></path>
      </svg>
    </button>`;
}

function quickValue(label, value, recordId, field, kind = '') {
  if (!value) return '';
  return `
    <div class="quick-field ${kind}">
      <div class="quick-field-content">
        <span>${esc(label)}</span>
        <strong>${esc(value)}</strong>
      </div>
      ${field ? quickCopyIcon(recordId, field, label) : ''}
    </div>`;
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
    <button type="button" class="category-chip ${option.value === 'all' ? 'active' : ''}" data-category-value="${esc(option.value)}">
      ${esc(option.label)}
    </button>
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
  if (document.getElementById('spalone-refined-layout-v9')) return;

  const style = document.createElement('style');
  style.id = 'spalone-refined-layout-v9';
  style.textContent = `
    @media (min-width: 901px) {
      .overview > div:first-child {
        max-width: none !important;
        min-width: 0 !important;
        flex: 1 1 auto !important;
      }

      .overview h1 {
        white-space: nowrap !important;
        font-size: clamp(28px, 3vw, 43px) !important;
        line-height: 1.04 !important;
      }
    }

    .card-top {
      width: 100% !important;
      max-width: none !important;
      display: grid !important;
      grid-template-columns: minmax(0, 1fr) auto !important;
      align-items: start !important;
      justify-content: initial !important;
      gap: 14px !important;
      margin: 0 0 15px !important;
      padding: 0 !important;
      text-align: left !important;
    }

    .card-top > div:first-child {
      width: 100% !important;
      max-width: none !important;
      min-width: 0 !important;
      margin: 0 !important;
      padding: 0 !important;
      text-align: left !important;
      justify-self: stretch !important;
    }

    .card-category,
    .card-top h3,
    .card-top p {
      width: auto !important;
      max-width: none !important;
      margin-left: 0 !important;
      margin-right: 0 !important;
      padding-left: 0 !important;
      padding-right: 0 !important;
      text-align: left !important;
    }

    .card-edit {
      align-self: start !important;
      justify-self: end !important;
      margin: 0 !important;
      padding: 8px 12px !important;
      min-height: 32px !important;
      line-height: 1 !important;
    }

    .card-actions {
      display: none !important;
      margin: 0 !important;
      padding: 0 !important;
      border: 0 !important;
    }

    .count-pill {
      display: inline-flex !important;
      align-items: center !important;
      justify-content: center !important;
      min-height: 30px !important;
      height: 30px !important;
      padding: 0 11px !important;
      margin: 0 !important;
      line-height: 1 !important;
      box-sizing: border-box !important;
      white-space: nowrap !important;
    }

    @media (max-width: 900px) {
      .overview h1 {
        white-space: normal !important;
      }
    }
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
        </div>

        ${r.notes ? `<div class="quick-notes">${esc(r.notes)}</div>` : ''}
      </article>`;
  }).join('');
};

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
    const record = state.records.find(item => item.id === actionButton.dataset.id);
    if (!record) return;

    if (action === 'edit') return openEditor(record);
    if (action === 'copy-field') {
      const field = actionButton.dataset.field;
      const value = record[field];
      if (!value) return;
      return copyText(value, 'Copiado');
    }
    return;
  }

  const url = quickSafeUrl(card.dataset.quickUrl);
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}, true);
