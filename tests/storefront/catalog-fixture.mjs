// Loopback-only browser-test fixtures. Never imported by the application.
import http from 'node:http';

const services = ['Deepwoken progression', 'Custom build', 'Boss carry'].map((name, index) => ({
  slug: ['deepwoken-progression', 'custom-build', 'boss-carry'][index],
  data: { name, game: 'Deepwoken', category: 'Roblox services', initials: 'BS', shortDescription: 'Plan your next adventure with the BirdShop team.', description: 'A local QA fixture.', available: true, featured: true, customOnly: index !== 0, image: null },
  packages: index === 0 ? [{ id: "standard", name: "Standard", enabled: true, cents: 3500, scope: "QA fixed service package", includes: ["Progression planning", "Private service chat"] }] : [],
}));
const products = ['Digital key', 'Game credit', 'Sold-out key'].map((name, index) => ({
  id: String(index), slug: 'qa-key-' + index, name, category: 'Digital products', platform: 'PC', region: 'Global',
  price: 10 + index * 5, old_price: null, badge: index === 0 ? 'Popular' : null, stock: index === 2 ? 0 : 10,
  delivery: 'Digital delivery', description: 'A local QA fixture.', short_description: 'Digital delivery after verified payment.',
  code_format: 'Digital code', initials: 'BS', gallery: [], is_visible: true, sort_order: index, inventory_mode: 'keys',
}));

http.createServer((request, response) => {
  response.setHeader('Access-Control-Allow-Origin', '*');
  response.setHeader('Access-Control-Allow-Headers', '*');
  response.setHeader('Content-Type', 'application/json');
  if (request.method === 'OPTIONS') { response.end(); return; }
  const url = new URL(request.url, 'http://127.0.0.1');
  // Test-only authenticated users. Tokens are accepted only by this loopback stub.
  if (url.pathname === '/auth/v1/user') {
    let claims;
    try {
      const token = request.headers.authorization?.replace(/^Bearer /, '');
      claims = JSON.parse(Buffer.from(token.split('.')[1], 'base64url').toString());
    } catch { /* The normal unsigned test client has no session. */ }
    if (!claims?.qa_visual_repair) {
      response.statusCode = 401;
      response.end(JSON.stringify({ message: 'No local test session', code: 'bad_jwt' }));
      return;
    }
    response.end(JSON.stringify({ id: claims.sub, email: claims.email, aud: 'authenticated', role: 'authenticated',
      email_confirmed_at: '2026-11-01T00:00:00Z', created_at: '2026-11-01T00:00:00Z', app_metadata: {}, user_metadata: {}, identities: [] }));
    return;
  }
  // A successful local stub exercises the real server action without sending email.
  if (url.pathname === '/auth/v1/otp') { response.end('{}'); return; }
  let value = url.pathname === '/rest/v1/products' ? products
    : url.pathname === '/rest/v1/birdshop_services' ? services
    : url.pathname === '/rest/v1/birdshop_referrers' && url.searchParams.get('contact_email') === 'eq.qa-dashboard@example.test'
      ? [{ id: 'qa-referrer', code: 'BSQATEST01', kind: 'customer', status: 'approved', display_name: 'QA referral customer' }]
    : url.pathname === '/rest/v1/birdshop_referral_rewards'
      ? ['pending_review', 'approved', 'paid'].map(status => ({ amount_cents: 50, status, created_at: '2026-11-10T12:00:00Z' })) : [];
  if (url.searchParams.has('slug')) {
    value = value.filter(row => row.slug === url.searchParams.get('slug').replace(/^eq\./, ''));
  }
  response.setHeader('Content-Range', `0-${Math.max(0, value.length - 1)}/${value.length}`);
  const single = request.headers.accept?.includes('application/vnd.pgrst.object+json');
  response.end(JSON.stringify(single ? value[0] ?? null : value));
}).listen(54321, '127.0.0.1');
