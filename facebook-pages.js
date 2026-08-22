const FACEBOOK_PAGE_BY_CLIENT = {
  'Nomad': 'https://www.facebook.com/bynomad.io',
  'Dubai Cash': 'https://www.facebook.com/dubaicash.fy',
  'Pure Essence': 'https://www.facebook.com/pureessenceandco',
  'Prime Pay': 'https://www.facebook.com/primepaymentstech/'
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

  social.url = pageUrl;

  if (Array.isArray(record.socials) && record.socials[index]) {
    record.socials[index].url = pageUrl;
  }

  return originalRenderSocialPlatformFacebookPages(record, social, index);
};
