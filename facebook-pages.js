const FACEBOOK_PAGE_BY_CLIENT = {
  'Nomad': 'https://www.facebook.com/bynomad.io',
  'Dubai Cash': 'https://www.facebook.com/dubaicash.fy',
  'Pure Essence': 'https://www.facebook.com/pureessenceandco',
  'Prime Pay': 'https://www.facebook.com/primetech.software'
};

const originalRenderSocialPlatformFacebookPages = renderSocialPlatform;
renderSocialPlatform = function renderSocialPlatformFacebookPages(record, social, index) {
  if (!social) return '';

  const platform = String(social.platform || '').trim().toLowerCase();
  if (platform !== 'facebook') {
    return originalRenderSocialPlatformFacebookPages(record, social, index);
  }

  const pageUrl = FACEBOOK_PAGE_BY_CLIENT[record.client];
  if (!pageUrl) return '';

  // Atualiza também o objeto original do registro.
  // Assim o botão de copiar lê a URL completa da página,
  // e não o endereço genérico https://www.facebook.com/.
  social.url = pageUrl;

  if (Array.isArray(record.socials) && record.socials[index]) {
    record.socials[index].url = pageUrl;
  }

  return originalRenderSocialPlatformFacebookPages(record, social, index);
};
