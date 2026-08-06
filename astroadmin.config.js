export default {
  preview: {
    url: process.env.PREVIEW_URL || 'http://localhost:4321',
    // collection -> path to preview it at ({slug} is substituted)
    routes: {
      blog: '/blog/{slug}',
      faq: '/faq',
      pages: '/{slug}',
    },
  },
  auth: {
    username: process.env.ADMIN_USERNAME || 'admin',
    passwordHash: process.env.ADMIN_PASSWORD_HASH,
    // password: process.env.ADMIN_PASSWORD,       // plaintext fallback, local/dev only
  },
};
