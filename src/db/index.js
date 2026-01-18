// src/db/index.js
// Database module exports

// Original database functions
export {
  getDeployments,
  getDeployment,
  saveDeployment,
  updateDeployment,
  deleteDeployment,
  getLeads,
  getLead,
  saveLead,
  updateLead,
  deleteLead,
  getEmails,
  getEmail,
  saveEmail,
  updateEmail,
  deleteEmail,
  getAnalytics,
  saveAnalytics,
  updateAnalytics
} from '../db.js';

// Tenant-aware database operations
export {
  getTenantId,
  getDeployments as getTenantDeployments,
  getDeployment as getTenantDeployment,
  saveDeployment as saveTenantDeployment,
  updateDeployment as updateTenantDeployment,
  deleteDeployment as deleteTenantDeployment,
  getLeads as getTenantLeads,
  getLead as getTenantLead,
  saveLead as saveTenantLead,
  updateLead as updateTenantLead,
  deleteLead as deleteTenantLead,
  getEmails as getTenantEmails,
  getEmail as getTenantEmail,
  saveEmail as saveTenantEmail,
  updateEmail as updateTenantEmail,
  deleteEmail as deleteTenantEmail,
  getAnalytics as getTenantAnalytics,
  saveAnalytics as saveTenantAnalytics
} from './tenantDb.js';

// Tenant and user management
export {
  ROLES,
  PERMISSIONS,
  createTenant,
  getTenant,
  getTenantBySlug,
  updateTenant,
  deleteTenant,
  createUser,
  getUser,
  getUserByAuthId,
  getUserByEmail,
  getTenantUsers,
  updateUser,
  deleteUser,
  createInvitation,
  getInvitationByToken,
  acceptInvitation,
  getTenantInvitations,
  revokeInvitation,
  hasPermission,
  canAccessTenant
} from './tenants.js';
