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

function quickOpenLabel(record) {
  const text = `${record.category || ''} ${record.service || ''}`.toLowerCase();
  if (text.includes('instagram')) return 'Abrir Instagram';
  if (text.includes('hostinger') || text.includes('hospedagem')) return 'Abrir Hostinger';
  if (text.includes('shopify') || text.includes('e-commerce')) return 'Abrir Shopify';
  if (text.includes('webflow')) return 'Abrir Webflow';
  if (text.includes('godaddy')) return 'Abrir GoDaddy';
  if (text.includes('tasjeel')) return 'Abrir Tasjeel';
  if (text.includes('e-mail') || text.includes('email')) return 'Abrir e-mail';
  if (text.includes('site') || text.includes('domínio') || text.includes('dominio')) return 'Abrir site';
  return 'Abrir acesso';
}

function quickValue(label, value, kind = '') {
  if (!value) return '';
  return `
    <div class="quick-field ${kind}">
      <span>${esc(label)}</span>
      <strong>${esc(value)}</strong>
    </div>`;
}

renderList = function renderListQuick() {
  const records = filteredRecords();
  els.resultCount.textContent = `${records.length} ${records.length === 1 ? 'acesso' : 'acessos'}`;
  els.emptyState.classList.toggle('hidden', records.length !== 0);
  els.recordsList.classList.toggle('hidden', records.length === 0);

  els.recordsList.innerHTML = records.map(r => {
    const login = r.username || r.email || '';
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
          ${r.username ? quickValue('Login', r.username) : ''}
          ${r.email && r.email !== r.username ? quickValue('E-mail', r.email) : ''}
          ${r.password ? quickValue('Senha', r.password, 'password-visible') : ''}
          ${r.phone ? quickValue('Telefone', r.phone) : ''}
          ${r.recoveryEmail ? quickValue('Recuperação', r.recoveryEmail) : ''}
          ${r.twoFactor ? quickValue('2FA / backup', r.twoFactor) : ''}
          ${hasCard ? quickValue('Titular', r.cardHolder) : ''}
          ${r.cardNumber ? quickValue('Cartão', r.cardNumber, 'password-visible') : ''}
          ${r.cardExpiry ? quickValue('Validade', r.cardExpiry) : ''}
          ${r.cardPurpose ? quickValue('Finalidade', r.cardPurpose) : ''}
        </div>

        ${r.url ? `<div class="quick-url"><span>Link</span><strong>${esc(r.url)}</strong></div>` : ''}
        ${r.notes ? `<div class="quick-notes">${esc(r.notes)}</div>` : ''}

        <div class="card-actions">
          ${url ? `<button class="quick-btn primary" data-quick-action="open" data-url="${esc(url)}" type="button">${esc(quickOpenLabel(r))} ↗</button>` : ''}
          ${login ? `<button class="quick-btn" data-quick-action="copy-login" data-id="${esc(r.id)}" type="button">Copiar login</button>` : ''}
          ${r.password ? `<button class="quick-btn" data-quick-action="copy-password" data-id="${esc(r.id)}" type="button">Copiar senha</button>` : ''}
        </div>
      </article>`;
  }).join('');
};

els.recordsList.addEventListener('click', async (event) => {
  const actionButton = event.target.closest('[data-quick-action]');
  const card = event.target.closest('.access-card');
  if (!actionButton && !card) return;

  event.preventDefault();
  event.stopImmediatePropagation();

  if (actionButton) {
    const action = actionButton.dataset.quickAction;
    const record = state.records.find(item => item.id === actionButton.dataset.id);

    if (action === 'open') {
      const url = quickSafeUrl(actionButton.dataset.url);
      if (url) window.open(url, '_blank', 'noopener,noreferrer');
      return;
    }
    if (!record) return;
    if (action === 'edit') return openEditor(record);
    if (action === 'copy-login') return copyText(record.username || record.email, 'Login copiado');
    if (action === 'copy-password') return copyText(record.password, 'Senha copiada');
    return;
  }

  const url = quickSafeUrl(card.dataset.quickUrl);
  if (url) window.open(url, '_blank', 'noopener,noreferrer');
}, true);
