// src/db/tenants.js
// Tenant and user management
import crypto from 'crypto';
import logger from '../logger.js';
import { getFirestore, isFirebaseEnabled } from '../firebase.js';

const log = logger.child('tenants');

// In-memory store for local development (replace with persistent store in production)
const tenantStore = new Map();
const userStore = new Map();
const invitationStore = new Map();

// Roles and permissions
export const ROLES = {
  OWNER: 'owner',      // Full access, can delete tenant, manage billing
  ADMIN: 'admin',      // Full access except delete tenant
  MEMBER: 'member',    // Can use features, limited settings
  VIEWER: 'viewer'     // Read-only access
};

export const PERMISSIONS = {
  [ROLES.OWNER]: ['*'],
  [ROLES.ADMIN]: ['read', 'write', 'delete', 'invite', 'settings'],
  [ROLES.MEMBER]: ['read', 'write', 'delete'],
  [ROLES.VIEWER]: ['read']
};

// ==================== TENANT FUNCTIONS ====================

/**
 * Generate a unique tenant ID
 */
function generateTenantId() {
  return `tenant_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Create a new tenant
 */
export async function createTenant(data) {
  const tenantId = generateTenantId();
  const timestamp = new Date().toISOString();

  const tenant = {
    id: tenantId,
    name: data.name,
    slug: data.slug || data.name.toLowerCase().replace(/[^a-z0-9]/g, '-'),
    plan: data.plan || 'free',
    stripeCustomerId: data.stripeCustomerId || null,
    settings: data.settings || {},
    createdAt: timestamp,
    updatedAt: timestamp
  };

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    await db.collection('tenants').doc(tenantId).set(tenant);
    log.info('Tenant created in Firebase', { tenantId, name: tenant.name });
  } else {
    tenantStore.set(tenantId, tenant);
    log.info('Tenant created locally', { tenantId, name: tenant.name });
  }

  return tenant;
}

/**
 * Get tenant by ID
 */
export async function getTenant(tenantId) {
  if (isFirebaseEnabled()) {
    const db = getFirestore();
    const doc = await db.collection('tenants').doc(tenantId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  } else {
    return tenantStore.get(tenantId) || null;
  }
}

/**
 * Get tenant by slug
 */
export async function getTenantBySlug(slug) {
  if (isFirebaseEnabled()) {
    const db = getFirestore();
    const snapshot = await db.collection('tenants').where('slug', '==', slug).limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } else {
    for (const tenant of tenantStore.values()) {
      if (tenant.slug === slug) return tenant;
    }
    return null;
  }
}

/**
 * Update tenant
 */
export async function updateTenant(tenantId, updates) {
  const timestamp = new Date().toISOString();
  const updateData = { ...updates, updatedAt: timestamp };

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    await db.collection('tenants').doc(tenantId).update(updateData);
    return getTenant(tenantId);
  } else {
    const tenant = tenantStore.get(tenantId);
    if (!tenant) throw new Error(`Tenant not found: ${tenantId}`);
    const updated = { ...tenant, ...updateData };
    tenantStore.set(tenantId, updated);
    return updated;
  }
}

/**
 * Delete tenant (soft delete - marks as deleted)
 */
export async function deleteTenant(tenantId) {
  return updateTenant(tenantId, { status: 'deleted', deletedAt: new Date().toISOString() });
}

// ==================== USER FUNCTIONS ====================

/**
 * Generate a unique user ID
 */
function generateUserId() {
  return `user_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
}

/**
 * Create a user in a tenant
 */
export async function createUser(data) {
  const userId = data.id || generateUserId();
  const timestamp = new Date().toISOString();

  const user = {
    id: userId,
    tenantId: data.tenantId,
    email: data.email,
    name: data.name || data.email.split('@')[0],
    role: data.role || ROLES.MEMBER,
    authProviderId: data.authProviderId || null, // Clerk user ID
    settings: data.settings || {},
    createdAt: timestamp,
    updatedAt: timestamp
  };

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    await db.collection('users').doc(userId).set(user);
    log.info('User created in Firebase', { userId, email: user.email, tenantId: user.tenantId });
  } else {
    userStore.set(userId, user);
    log.info('User created locally', { userId, email: user.email, tenantId: user.tenantId });
  }

  return user;
}

/**
 * Get user by ID
 */
export async function getUser(userId) {
  if (isFirebaseEnabled()) {
    const db = getFirestore();
    const doc = await db.collection('users').doc(userId).get();
    if (!doc.exists) return null;
    return { id: doc.id, ...doc.data() };
  } else {
    return userStore.get(userId) || null;
  }
}

/**
 * Get user by auth provider ID (Clerk user ID)
 */
export async function getUserByAuthId(authProviderId) {
  if (isFirebaseEnabled()) {
    const db = getFirestore();
    const snapshot = await db.collection('users').where('authProviderId', '==', authProviderId).limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } else {
    for (const user of userStore.values()) {
      if (user.authProviderId === authProviderId) return user;
    }
    return null;
  }
}

/**
 * Get user by email
 */
export async function getUserByEmail(email) {
  const normalizedEmail = email.toLowerCase();

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    const snapshot = await db.collection('users').where('email', '==', normalizedEmail).limit(1).get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } else {
    for (const user of userStore.values()) {
      if (user.email.toLowerCase() === normalizedEmail) return user;
    }
    return null;
  }
}

/**
 * Get all users for a tenant
 */
export async function getTenantUsers(tenantId) {
  if (isFirebaseEnabled()) {
    const db = getFirestore();
    const snapshot = await db.collection('users').where('tenantId', '==', tenantId).get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } else {
    return Array.from(userStore.values()).filter(u => u.tenantId === tenantId);
  }
}

/**
 * Update user
 */
export async function updateUser(userId, updates) {
  const timestamp = new Date().toISOString();
  const updateData = { ...updates, updatedAt: timestamp };

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    await db.collection('users').doc(userId).update(updateData);
    return getUser(userId);
  } else {
    const user = userStore.get(userId);
    if (!user) throw new Error(`User not found: ${userId}`);
    const updated = { ...user, ...updateData };
    userStore.set(userId, updated);
    return updated;
  }
}

/**
 * Delete user
 */
export async function deleteUser(userId) {
  if (isFirebaseEnabled()) {
    const db = getFirestore();
    await db.collection('users').doc(userId).delete();
    log.info('User deleted from Firebase', { userId });
  } else {
    userStore.delete(userId);
    log.info('User deleted locally', { userId });
  }
}

// ==================== INVITATION FUNCTIONS ====================

/**
 * Generate invitation token
 */
function generateInvitationToken() {
  return crypto.randomBytes(32).toString('hex');
}

/**
 * Create an invitation
 */
export async function createInvitation(data) {
  const invitationId = `inv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
  const timestamp = new Date().toISOString();
  const token = generateInvitationToken();

  // Invitations expire in 7 days by default
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const invitation = {
    id: invitationId,
    tenantId: data.tenantId,
    email: data.email.toLowerCase(),
    role: data.role || ROLES.MEMBER,
    token,
    invitedBy: data.invitedBy,
    status: 'pending',
    expiresAt,
    createdAt: timestamp
  };

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    await db.collection('invitations').doc(invitationId).set(invitation);
    log.info('Invitation created in Firebase', { invitationId, email: invitation.email });
  } else {
    invitationStore.set(invitationId, invitation);
    log.info('Invitation created locally', { invitationId, email: invitation.email });
  }

  return invitation;
}

/**
 * Get invitation by token
 */
export async function getInvitationByToken(token) {
  if (isFirebaseEnabled()) {
    const db = getFirestore();
    const snapshot = await db.collection('invitations')
      .where('token', '==', token)
      .where('status', '==', 'pending')
      .limit(1)
      .get();
    if (snapshot.empty) return null;
    const doc = snapshot.docs[0];
    return { id: doc.id, ...doc.data() };
  } else {
    for (const inv of invitationStore.values()) {
      if (inv.token === token && inv.status === 'pending') return inv;
    }
    return null;
  }
}

/**
 * Accept invitation (creates user and marks invitation as accepted)
 */
export async function acceptInvitation(token, userData) {
  const invitation = await getInvitationByToken(token);

  if (!invitation) {
    throw new Error('Invalid or expired invitation');
  }

  if (new Date(invitation.expiresAt) < new Date()) {
    throw new Error('Invitation has expired');
  }

  // Create user
  const user = await createUser({
    tenantId: invitation.tenantId,
    email: invitation.email,
    role: invitation.role,
    ...userData
  });

  // Mark invitation as accepted
  const timestamp = new Date().toISOString();
  if (isFirebaseEnabled()) {
    const db = getFirestore();
    await db.collection('invitations').doc(invitation.id).update({
      status: 'accepted',
      acceptedAt: timestamp,
      userId: user.id
    });
  } else {
    const inv = invitationStore.get(invitation.id);
    inv.status = 'accepted';
    inv.acceptedAt = timestamp;
    inv.userId = user.id;
  }

  log.info('Invitation accepted', { invitationId: invitation.id, userId: user.id });
  return user;
}

/**
 * Get pending invitations for a tenant
 */
export async function getTenantInvitations(tenantId) {
  if (isFirebaseEnabled()) {
    const db = getFirestore();
    const snapshot = await db.collection('invitations')
      .where('tenantId', '==', tenantId)
      .where('status', '==', 'pending')
      .get();
    return snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
  } else {
    return Array.from(invitationStore.values())
      .filter(i => i.tenantId === tenantId && i.status === 'pending');
  }
}

/**
 * Revoke invitation
 */
export async function revokeInvitation(invitationId) {
  const timestamp = new Date().toISOString();

  if (isFirebaseEnabled()) {
    const db = getFirestore();
    await db.collection('invitations').doc(invitationId).update({
      status: 'revoked',
      revokedAt: timestamp
    });
  } else {
    const inv = invitationStore.get(invitationId);
    if (inv) {
      inv.status = 'revoked';
      inv.revokedAt = timestamp;
    }
  }

  log.info('Invitation revoked', { invitationId });
}

// ==================== PERMISSION CHECKS ====================

/**
 * Check if user has permission
 */
export function hasPermission(userRole, permission) {
  const rolePerms = PERMISSIONS[userRole] || [];
  return rolePerms.includes('*') || rolePerms.includes(permission);
}

/**
 * Check if user can perform action on tenant
 */
export async function canAccessTenant(userId, tenantId) {
  const user = await getUser(userId);
  if (!user) return false;
  return user.tenantId === tenantId;
}

export default {
  // Roles
  ROLES,
  PERMISSIONS,

  // Tenant functions
  createTenant,
  getTenant,
  getTenantBySlug,
  updateTenant,
  deleteTenant,

  // User functions
  createUser,
  getUser,
  getUserByAuthId,
  getUserByEmail,
  getTenantUsers,
  updateUser,
  deleteUser,

  // Invitation functions
  createInvitation,
  getInvitationByToken,
  acceptInvitation,
  getTenantInvitations,
  revokeInvitation,

  // Permission functions
  hasPermission,
  canAccessTenant
};
