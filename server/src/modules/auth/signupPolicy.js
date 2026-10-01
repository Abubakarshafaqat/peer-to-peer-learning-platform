/**
 * Signup policy helpers: domain / invite / both / closed.
 * Tenant is always from x-tenant resolution — never from the body.
 */
import { getSignupMode } from '../../models/Tenant.js';
import { AppError } from '../../utils/AppError.js';
import {
  findInviteByPlainCode,
  redeemInviteAtomic,
} from '../invites/invite.service.js';

/**
 * Exact domain match only (case-insensitive).
 * "evil-fuuast.edu.pk" and "fuuast.edu.pk.evil.com" do not match "fuuast.edu.pk".
 * Subdomains match only if explicitly listed in the whitelist.
 */
export function emailDomainAllowed(email, whitelist = []) {
  const domain = String(email || '')
    .split('@')[1]
    ?.trim()
    .toLowerCase();
  if (!domain) return false;
  const list = (whitelist || []).map((d) => String(d).trim().toLowerCase()).filter(Boolean);
  return list.includes(domain);
}

/**
 * Resolve whether signup is allowed and how (domain vs invite).
 * Returns { via: 'domain'|'invite', invite? } or throws.
 */
export async function assertAndResolveSignup(tenant, email, inviteCode) {
  const mode = getSignupMode(tenant);

  if (mode === 'closed') {
    throw new AppError('Signups are closed for this tenant', 403, { code: 'SIGNUP_CLOSED' });
  }

  const domainOk = emailDomainAllowed(email, tenant.domainWhitelist || []);
  const hasInviteInput = Boolean(String(inviteCode || '').trim());

  if (mode === 'domain') {
    if (!domainOk) {
      throw new AppError('Email domain is not allowed for this university', 403, {
        code: 'DOMAIN_NOT_ALLOWED',
      });
    }
    return { via: 'domain', invite: null };
  }

  if (mode === 'invite') {
    if (!hasInviteInput) {
      throw new AppError('Valid invite code is required', 403, { code: 'INVITE_REQUIRED' });
    }
    const invite = await redeemInviteCodeOrThrow(inviteCode);
    return { via: 'invite', invite };
  }

  if (mode === 'both') {
    if (hasInviteInput) {
      const invite = await redeemInviteCodeOrThrow(inviteCode);
      return { via: 'invite', invite };
    }
    if (domainOk) {
      return { via: 'domain', invite: null };
    }
    throw new AppError('Email domain not allowed and invite code missing/invalid', 403, {
      code: 'SIGNUP_NOT_ALLOWED',
    });
  }

  throw new AppError('Invalid signup mode', 500);
}

async function redeemInviteCodeOrThrow(plainCode) {
  // Include inactive so we can return precise expired/revoked/exhausted errors
  let found = await findInviteByPlainCode(plainCode, { includeInactive: true });
  if (!found) {
    throw new AppError('Invalid or expired invite code', 403, { code: 'INVITE_INVALID' });
  }

  if (found.revokedAt) {
    throw new AppError('Invite has been revoked', 403, { code: 'INVITE_REVOKED' });
  }
  if (found.expiresAt && found.expiresAt.getTime() <= Date.now()) {
    throw new AppError('Invite has expired', 403, { code: 'INVITE_EXPIRED' });
  }
  if (found.usedCount >= found.maxUses) {
    throw new AppError('Invite has no remaining uses', 403, { code: 'INVITE_EXHAUSTED' });
  }

  const redeemed = await redeemInviteAtomic(found._id);
  if (!redeemed) {
    throw new AppError('Invite has no remaining uses', 403, { code: 'INVITE_EXHAUSTED' });
  }
  return redeemed;
}
