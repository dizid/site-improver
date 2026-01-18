<template>
  <div class="team-page">
    <header class="page-header">
      <div class="header-content">
        <router-link to="/" class="back-link">&larr; Dashboard</router-link>
        <h1>Team Management</h1>
      </div>
    </header>

    <main class="team-content">
      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <div class="spinner spinner-md">
          <div class="spinner-circle"></div>
        </div>
        <span>Loading team...</span>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-banner">
        {{ error }}
        <button @click="fetchData" class="btn btn-sm btn-primary">Retry</button>
      </div>

      <template v-else>
        <!-- Team Info Card -->
        <section class="team-card">
          <div class="card-header">
            <h2>Team Settings</h2>
          </div>
          <div class="card-body">
            <div class="team-name-section">
              <label for="team-name">Team Name</label>
              <div class="team-name-input">
                <input
                  id="team-name"
                  type="text"
                  v-model="teamName"
                  placeholder="My Team"
                  class="form-input"
                />
                <button
                  class="btn btn-primary"
                  @click="updateTeamName"
                  :disabled="saving || teamName === team.name"
                >
                  {{ saving ? 'Saving...' : 'Save' }}
                </button>
              </div>
            </div>
            <div class="team-info">
              <p><strong>Plan:</strong> {{ team.plan || 'Free' }}</p>
              <p><strong>Created:</strong> {{ formatDate(team.createdAt) }}</p>
            </div>
          </div>
        </section>

        <!-- Members Card -->
        <section class="team-card">
          <div class="card-header">
            <h2>Team Members</h2>
            <span class="member-count">{{ members.length }} member{{ members.length !== 1 ? 's' : '' }}</span>
          </div>
          <div class="card-body">
            <div class="members-list">
              <div v-for="member in members" :key="member.id" class="member-row">
                <div class="member-info">
                  <div class="member-avatar">{{ getInitials(member.name || member.email) }}</div>
                  <div class="member-details">
                    <div class="member-name">{{ member.name || member.email }}</div>
                    <div class="member-email">{{ member.email }}</div>
                  </div>
                </div>
                <div class="member-role">
                  <select
                    :value="member.role"
                    @change="updateMemberRole(member.id, $event.target.value)"
                    :disabled="member.role === 'owner' || !canManageRoles"
                    class="role-select"
                  >
                    <option value="owner" :disabled="member.role !== 'owner'">Owner</option>
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
                <div class="member-actions">
                  <button
                    v-if="member.role !== 'owner' && canManageRoles"
                    class="btn btn-sm btn-danger"
                    @click="removeMember(member.id)"
                    title="Remove member"
                  >
                    &times;
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Invite Card -->
        <section class="team-card" v-if="canInvite">
          <div class="card-header">
            <h2>Invite Team Member</h2>
          </div>
          <div class="card-body">
            <form @submit.prevent="sendInvite" class="invite-form">
              <div class="invite-fields">
                <div class="form-field">
                  <label for="invite-email">Email Address</label>
                  <input
                    id="invite-email"
                    type="email"
                    v-model="inviteEmail"
                    placeholder="colleague@company.com"
                    class="form-input"
                    required
                  />
                </div>
                <div class="form-field">
                  <label for="invite-role">Role</label>
                  <select id="invite-role" v-model="inviteRole" class="form-select">
                    <option value="admin">Admin</option>
                    <option value="member">Member</option>
                    <option value="viewer">Viewer</option>
                  </select>
                </div>
              </div>
              <button
                type="submit"
                class="btn btn-primary"
                :disabled="inviting || !inviteEmail"
              >
                {{ inviting ? 'Sending...' : 'Send Invitation' }}
              </button>
            </form>

            <div v-if="inviteSuccess" class="success-message">
              Invitation sent to {{ lastInvitedEmail }}
            </div>
          </div>
        </section>

        <!-- Pending Invitations Card -->
        <section v-if="invitations.length > 0" class="team-card">
          <div class="card-header">
            <h2>Pending Invitations</h2>
            <span class="invite-count">{{ invitations.length }}</span>
          </div>
          <div class="card-body">
            <div class="invitations-list">
              <div v-for="invite in invitations" :key="invite.id" class="invitation-row">
                <div class="invitation-info">
                  <div class="invitation-email">{{ invite.email }}</div>
                  <div class="invitation-meta">
                    <span :class="['role-badge', `role-${invite.role}`]">{{ invite.role }}</span>
                    <span class="expires">Expires {{ formatDate(invite.expiresAt) }}</span>
                  </div>
                </div>
                <button
                  class="btn btn-sm btn-ghost"
                  @click="revokeInvite(invite.id)"
                  title="Revoke invitation"
                >
                  Revoke
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- Roles Info -->
        <section class="team-card roles-info">
          <div class="card-header">
            <h2>Role Permissions</h2>
          </div>
          <div class="card-body">
            <div class="roles-grid">
              <div class="role-card">
                <h3>Owner</h3>
                <ul>
                  <li>Full access to all features</li>
                  <li>Manage billing & subscription</li>
                  <li>Delete team</li>
                  <li>Transfer ownership</li>
                </ul>
              </div>
              <div class="role-card">
                <h3>Admin</h3>
                <ul>
                  <li>Manage team members</li>
                  <li>Invite new members</li>
                  <li>Change settings</li>
                  <li>All lead operations</li>
                </ul>
              </div>
              <div class="role-card">
                <h3>Member</h3>
                <ul>
                  <li>Process leads</li>
                  <li>Send emails</li>
                  <li>View all data</li>
                  <li>Cannot change settings</li>
                </ul>
              </div>
              <div class="role-card">
                <h3>Viewer</h3>
                <ul>
                  <li>View leads & stats</li>
                  <li>View previews</li>
                  <li>Cannot process or send</li>
                  <li>Read-only access</li>
                </ul>
              </div>
            </div>
          </div>
        </section>
      </template>
    </main>
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { api } from '../api.js';

// State
const loading = ref(true);
const error = ref(null);
const team = ref({});
const members = ref([]);
const invitations = ref([]);
const currentUserRole = ref('member');

// Form state
const teamName = ref('');
const inviteEmail = ref('');
const inviteRole = ref('member');

// Loading states
const saving = ref(false);
const inviting = ref(false);
const inviteSuccess = ref(false);
const lastInvitedEmail = ref('');

// Computed
const canManageRoles = computed(() => {
  return ['owner', 'admin'].includes(currentUserRole.value);
});

const canInvite = computed(() => {
  return ['owner', 'admin'].includes(currentUserRole.value);
});

// Methods
function getInitials(name) {
  if (!name) return '?';
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(date) {
  if (!date) return 'N/A';
  return new Date(date).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

async function fetchData() {
  loading.value = true;
  error.value = null;

  try {
    const [teamData, membersData, invitationsData] = await Promise.all([
      api.get('/api/team'),
      api.get('/api/team/members').catch(() => []),
      api.get('/api/team/invitations').catch(() => [])
    ]);

    team.value = teamData || {};
    teamName.value = teamData?.name || '';
    members.value = membersData || [];
    invitations.value = invitationsData || [];

    // Find current user's role
    const currentUser = members.value.find(m => m.isCurrentUser);
    currentUserRole.value = currentUser?.role || 'member';
  } catch (err) {
    error.value = err.message;
  } finally {
    loading.value = false;
  }
}

async function updateTeamName() {
  if (!teamName.value || teamName.value === team.value.name) return;

  saving.value = true;
  try {
    const updated = await api.patch('/api/team', { name: teamName.value });
    team.value = updated;
  } catch (err) {
    error.value = `Failed to update team name: ${err.message}`;
  } finally {
    saving.value = false;
  }
}

async function updateMemberRole(userId, newRole) {
  try {
    await api.patch(`/api/team/members/${userId}`, { role: newRole });
    await fetchData();
  } catch (err) {
    error.value = `Failed to update role: ${err.message}`;
  }
}

async function removeMember(userId) {
  if (!confirm('Are you sure you want to remove this team member?')) return;

  try {
    await api.delete(`/api/team/members/${userId}`);
    await fetchData();
  } catch (err) {
    error.value = `Failed to remove member: ${err.message}`;
  }
}

async function sendInvite() {
  if (!inviteEmail.value) return;

  inviting.value = true;
  inviteSuccess.value = false;

  try {
    await api.post('/api/team/invite', {
      email: inviteEmail.value,
      role: inviteRole.value
    });

    lastInvitedEmail.value = inviteEmail.value;
    inviteEmail.value = '';
    inviteSuccess.value = true;

    // Refresh invitations
    const invitationsData = await api.get('/api/team/invitations').catch(() => []);
    invitations.value = invitationsData;

    // Hide success message after 5 seconds
    setTimeout(() => {
      inviteSuccess.value = false;
    }, 5000);
  } catch (err) {
    error.value = `Failed to send invitation: ${err.message}`;
  } finally {
    inviting.value = false;
  }
}

async function revokeInvite(invitationId) {
  if (!confirm('Are you sure you want to revoke this invitation?')) return;

  try {
    await api.delete(`/api/team/invitations/${invitationId}`);
    invitations.value = invitations.value.filter(i => i.id !== invitationId);
  } catch (err) {
    error.value = `Failed to revoke invitation: ${err.message}`;
  }
}

// Lifecycle
onMounted(fetchData);
</script>

<style scoped>
.team-page {
  min-height: 100vh;
  background: var(--bg-primary);
}

.page-header {
  background: var(--bg-secondary);
  border-bottom: 1px solid var(--border-color);
  padding: 1rem 2rem;
}

.header-content {
  max-width: 1000px;
  margin: 0 auto;
}

.back-link {
  color: var(--text-muted);
  text-decoration: none;
  font-size: 0.875rem;
  display: inline-block;
  margin-bottom: 0.5rem;
}

.back-link:hover {
  color: var(--text-primary);
}

.page-header h1 {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
}

.team-content {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
}

/* Cards */
.team-card {
  background: var(--bg-card);
  border-radius: var(--radius-lg);
  border: 1px solid var(--border-color);
  margin-bottom: 1.5rem;
  overflow: hidden;
}

.card-header {
  padding: 1rem 1.5rem;
  border-bottom: 1px solid var(--border-color);
  background: var(--bg-secondary);
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.card-header h2 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-secondary);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin: 0;
}

.card-body {
  padding: 1.5rem;
}

.member-count,
.invite-count {
  font-size: 0.75rem;
  color: var(--text-muted);
  background: var(--bg-card);
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
}

/* Team Name Section */
.team-name-section {
  margin-bottom: 1.5rem;
}

.team-name-section label {
  display: block;
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  margin-bottom: 0.5rem;
}

.team-name-input {
  display: flex;
  gap: 0.75rem;
}

.form-input {
  flex: 1;
  padding: 0.75rem 1rem;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  color: var(--text-primary);
}

.form-input:focus {
  outline: none;
  border-color: var(--accent-blue);
}

.team-info {
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.team-info p {
  margin: 0.5rem 0;
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.team-info p:first-child {
  margin-top: 0;
}

.team-info p:last-child {
  margin-bottom: 0;
}

/* Members List */
.members-list {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.member-row {
  display: flex;
  align-items: center;
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.member-info {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  flex: 1;
}

.member-avatar {
  width: 40px;
  height: 40px;
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  color: white;
  font-weight: 600;
  font-size: 0.875rem;
}

.member-details {
  flex: 1;
}

.member-name {
  font-weight: 500;
  color: var(--text-primary);
}

.member-email {
  font-size: 0.8125rem;
  color: var(--text-muted);
}

.member-role {
  min-width: 120px;
}

.role-select {
  width: 100%;
  padding: 0.5rem 0.75rem;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-sm);
  font-size: 0.8125rem;
  color: var(--text-primary);
}

.role-select:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.member-actions {
  min-width: 40px;
}

/* Invite Form */
.invite-form {
  display: flex;
  flex-direction: column;
  gap: 1rem;
}

.invite-fields {
  display: grid;
  grid-template-columns: 2fr 1fr;
  gap: 1rem;
}

.form-field {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.form-field label {
  font-size: 0.75rem;
  font-weight: 500;
  color: var(--text-muted);
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.form-select {
  padding: 0.75rem 1rem;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  font-size: 0.875rem;
  color: var(--text-primary);
}

.form-select:focus {
  outline: none;
  border-color: var(--accent-blue);
}

.success-message {
  margin-top: 1rem;
  padding: 0.75rem 1rem;
  background: rgba(16, 185, 129, 0.1);
  border: 1px solid rgba(16, 185, 129, 0.3);
  border-radius: var(--radius-md);
  color: var(--accent-green);
  font-size: 0.875rem;
}

/* Invitations List */
.invitations-list {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.invitation-row {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.invitation-email {
  font-weight: 500;
  color: var(--text-primary);
  margin-bottom: 0.25rem;
}

.invitation-meta {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  font-size: 0.8125rem;
}

.role-badge {
  padding: 0.125rem 0.5rem;
  border-radius: 9999px;
  font-size: 0.6875rem;
  font-weight: 500;
  text-transform: uppercase;
}

.role-owner { background: rgba(139, 92, 246, 0.2); color: var(--accent-purple); }
.role-admin { background: rgba(59, 130, 246, 0.2); color: var(--accent-blue); }
.role-member { background: rgba(16, 185, 129, 0.2); color: var(--accent-green); }
.role-viewer { background: rgba(107, 114, 128, 0.2); color: var(--text-muted); }

.expires {
  color: var(--text-muted);
}

/* Roles Info */
.roles-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 1rem;
}

.role-card {
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.role-card h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.75rem;
}

.role-card ul {
  margin: 0;
  padding: 0 0 0 1.25rem;
}

.role-card li {
  font-size: 0.8125rem;
  color: var(--text-secondary);
  margin-bottom: 0.375rem;
}

.role-card li:last-child {
  margin-bottom: 0;
}

/* Responsive */
@media (max-width: 768px) {
  .team-content {
    padding: 1rem;
  }

  .invite-fields {
    grid-template-columns: 1fr;
  }

  .member-row {
    flex-wrap: wrap;
  }

  .member-role {
    width: 100%;
    margin-top: 0.5rem;
  }

  .roles-grid {
    grid-template-columns: 1fr;
  }
}
</style>
