/**
 * Live API isolation smoke test.
 *
 * Env:
 *   API_URL          Base API URL (default http://localhost:5000/api/v1)
 *   SMOKE_PASSWORD   Shared password for seeded demo accounts (default ChangeMeAdmin1!)
 *
 * Expects seedDemo (or seed:tenants) data: alpha / beta / gamma with admin+student.
 *
 * Usage:
 *   node scripts/isolationSmoke.js
 *   API_URL=https://api.example.com/api/v1 node scripts/isolationSmoke.js
 */
import 'dotenv/config';

const API = (process.env.API_URL || process.env.SMOKE_API_URL || 'http://localhost:5000/api/v1').replace(
  /\/$/,
  '',
);
const PASSWORD = process.env.SMOKE_PASSWORD || process.env.ADMIN_SEED_PASSWORD || 'ChangeMeAdmin1!';

const TENANTS = ['alpha', 'beta', 'gamma'];

let fails = 0;
let passes = 0;

function ok(label) {
  passes += 1;
  console.log(`PASS  ${label}`);
}

function fail(label, detail) {
  fails += 1;
  console.error(`FAIL  ${label}${detail ? ` — ${detail}` : ''}`);
}

async function req(method, path, { tenant, token, body, cookie } = {}) {
  const headers = { Accept: 'application/json' };
  if (tenant) headers['x-tenant'] = tenant;
  if (token) headers.Authorization = `Bearer ${token}`;
  if (cookie) headers.Cookie = Array.isArray(cookie) ? cookie.join('; ') : cookie;
  if (body !== undefined) headers['Content-Type'] = 'application/json';

  const res = await fetch(`${API}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let json = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    json = { raw: text };
  }
  const setCookie = res.headers.getSetCookie?.() || [];
  return { status: res.status, json, cookie: setCookie };
}

async function login(slug, identifier) {
  const res = await req('POST', '/auth/login', {
    tenant: slug,
    body: { identifier, password: PASSWORD },
  });
  if (res.status !== 200 || !res.json?.data?.accessToken) {
    throw new Error(`login ${slug}/${identifier} → ${res.status}`);
  }
  return {
    token: res.json.data.accessToken,
    cookie: res.cookie,
    user: res.json.data.user,
  };
}

function expectDenied(res, label) {
  if (res.status === 200) fail(label, `got 200 (leak?)`);
  else if ([403, 404, 401].includes(res.status)) ok(label);
  else fail(label, `unexpected status ${res.status}`);
}

async function collectPeerIds(slug, token) {
  const list = await req('GET', '/materials?limit=50', { tenant: slug, token });
  const items = list.json?.data?.items || [];
  const materialId = items[0]?.id || items[0]?._id || null;

  const users = await req('GET', '/tenant-admin/users?limit=50', { tenant: slug, token });
  const userItems = users.json?.data?.items || [];
  const student = userItems.find((u) => u.role === 'student') || userItems[0];
  const userId = student?.id || student?._id || null;

  const invites = await req('GET', '/invites', { tenant: slug, token });
  const inviteItems = invites.json?.data?.items || [];
  const inviteId = inviteItems[0]?.id || inviteItems[0]?._id || null;

  const taxonomy = await req('GET', '/taxonomy/universities', { tenant: slug, token });
  const uniId = taxonomy.json?.data?.items?.[0]?.id || null;
  let campusId = null;
  let departmentId = null;
  let courseId = null;
  if (uniId) {
    const campuses = await req('GET', `/taxonomy/universities/${uniId}/campuses`, {
      tenant: slug,
      token,
    });
    campusId = campuses.json?.data?.items?.[0]?.id || null;
    if (campusId) {
      const depts = await req('GET', `/taxonomy/campuses/${campusId}/departments`, {
        tenant: slug,
        token,
      });
      departmentId = depts.json?.data?.items?.[0]?.id || null;
      if (departmentId) {
        const courses = await req('GET', `/taxonomy/departments/${departmentId}/courses`, {
          tenant: slug,
          token,
        });
        courseId = courses.json?.data?.items?.[0]?.id || null;
      }
    }
  }

  return { materialId, userId, inviteId, uniId, campusId, departmentId, courseId };
}

async function crossTenantAttacks(attackerSlug, attacker, victimIds) {
  const t = attacker.token;
  const slug = attackerSlug;

  if (victimIds.materialId) {
    expectDenied(
      await req('GET', `/materials/${victimIds.materialId}`, { tenant: slug, token: t }),
      `${slug} GET foreign material`,
    );
    expectDenied(
      await req('PATCH', `/materials/${victimIds.materialId}`, {
        tenant: slug,
        token: t,
        body: { title: 'smoke-leak' },
      }),
      `${slug} PATCH foreign material`,
    );
    expectDenied(
      await req('DELETE', `/materials/${victimIds.materialId}`, { tenant: slug, token: t }),
      `${slug} DELETE foreign material`,
    );
    expectDenied(
      await req('GET', `/materials/${victimIds.materialId}/file-url`, { tenant: slug, token: t }),
      `${slug} file-url foreign material`,
    );
  } else {
    fail(`${slug} victim material id missing`, 'seed materials first');
  }

  if (victimIds.userId) {
    expectDenied(
      await req('PATCH', `/tenant-admin/users/${victimIds.userId}/active`, {
        tenant: slug,
        token: attacker.adminToken,
        body: { isActive: false },
      }),
      `${slug} deactivate foreign user`,
    );
  }

  if (victimIds.inviteId) {
    expectDenied(
      await req('POST', `/invites/${victimIds.inviteId}/revoke`, {
        tenant: slug,
        token: attacker.adminToken,
      }),
      `${slug} revoke foreign invite`,
    );
  }

  if (victimIds.campusId) {
    const depts = await req('GET', `/taxonomy/campuses/${victimIds.campusId}/departments`, {
      tenant: slug,
      token: t,
    });
    const items = depts.json?.data?.items || [];
    if (depts.status === 200 && items.length === 0) ok(`${slug} taxonomy foreign campus empty`);
    else if (depts.status === 200 && items.length > 0) fail(`${slug} taxonomy foreign campus leak`);
    else ok(`${slug} taxonomy foreign campus denied (${depts.status})`);
  }
}

async function listIsolation(slug, token, foreignTitlePrefix) {
  for (const sort of ['latest', 'popular', 'top_rated']) {
    const res = await req('GET', `/materials?sort=${sort}`, { tenant: slug, token });
    if (res.status !== 200) {
      fail(`${slug} list sort=${sort}`, `status ${res.status}`);
      continue;
    }
    const titles = (res.json?.data?.items || []).map((m) => m.title);
    const leak = titles.find((t) => String(t).startsWith(foreignTitlePrefix));
    if (leak) fail(`${slug} list sort=${sort}`, `saw ${leak}`);
    else ok(`${slug} list sort=${sort} isolated`);
  }
}

async function main() {
  console.log(`isolationSmoke → ${API}`);
  console.log('---');

  const health = await req('GET', '/health');
  if (health.status === 200) ok('health');
  else fail('health', `status ${health.status}`);

  const sessions = {};
  for (const slug of TENANTS) {
    try {
      const student = await login(slug, `student@${slug}.edu`);
      const admin = await login(slug, `admin@${slug}.edu`);
      sessions[slug] = { ...student, adminToken: admin.token };
      ok(`login ${slug}`);
    } catch (err) {
      fail(`login ${slug}`, err.message);
    }
  }

  const ids = {};
  for (const slug of TENANTS) {
    if (!sessions[slug]) continue;
    try {
      ids[slug] = await collectPeerIds(slug, sessions[slug].adminToken);
      ok(`collect ids ${slug}`);
    } catch (err) {
      fail(`collect ids ${slug}`, err.message);
    }
  }

  // Alpha attacks Beta; Beta attacks Gamma; Gamma attacks Alpha
  const pairs = [
    ['alpha', 'beta'],
    ['beta', 'gamma'],
    ['gamma', 'alpha'],
  ];
  for (const [attacker, victim] of pairs) {
    if (!sessions[attacker] || !ids[victim]) continue;
    await crossTenantAttacks(attacker, sessions[attacker], ids[victim]);
    await listIsolation(attacker, sessions[attacker].token, `${victim}-`);
  }

  console.log('---');
  console.log(`Result: ${passes} PASS, ${fails} FAIL`);
  process.exit(fails > 0 ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
