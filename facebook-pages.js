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

  const patchedSocial = {
    ...social,
    url: pageUrl
  };

  return originalRenderSocialPlatformFacebookPages(record, patchedSocial, index);
};
