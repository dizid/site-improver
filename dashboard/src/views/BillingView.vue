<template>
  <div class="billing-page">
    <header class="page-header">
      <div class="header-content">
        <router-link to="/" class="back-link">&larr; Dashboard</router-link>
        <h1>Billing & Usage</h1>
      </div>
    </header>

    <main class="billing-content">
      <!-- Loading State -->
      <div v-if="loading" class="loading-state">
        <div class="spinner spinner-md">
          <div class="spinner-circle"></div>
        </div>
        <span>Loading billing info...</span>
      </div>

      <!-- Error State -->
      <div v-else-if="error" class="error-banner">
        {{ error }}
        <button @click="fetchData" class="btn btn-sm btn-primary">Retry</button>
      </div>

      <template v-else>
        <!-- Current Plan Card -->
        <section class="billing-card">
          <div class="card-header">
            <h2>Current Plan</h2>
            <span v-if="subscription.status" :class="['status-badge', `status-${subscription.status}`]">
              {{ subscription.status }}
            </span>
          </div>
          <div class="card-body">
            <div class="plan-info">
              <div class="plan-name">{{ currentPlan?.name || 'Free' }}</div>
              <div class="plan-price">
                <span class="price-amount">${{ currentPlan?.price || 0 }}</span>
                <span class="price-period">/month</span>
              </div>
            </div>
            <div class="plan-features" v-if="currentPlan">
              <div class="feature">
                <span class="feature-value">{{ currentPlan.limits?.leads || 'Unlimited' }}</span>
                <span class="feature-label">Leads / month</span>
              </div>
              <div class="feature">
                <span class="feature-value">{{ currentPlan.limits?.pipeline || 'Unlimited' }}</span>
                <span class="feature-label">Pipeline runs / month</span>
              </div>
              <div class="feature">
                <span class="feature-value">{{ currentPlan.limits?.emails || 'Unlimited' }}</span>
                <span class="feature-label">Emails / month</span>
              </div>
            </div>
            <div class="plan-actions">
              <button
                v-if="!stripeConfigured"
                class="btn btn-secondary"
                disabled
              >
                Stripe not configured
              </button>
              <template v-else>
                <button
                  v-if="subscription.status === 'active'"
                  class="btn btn-secondary"
                  @click="openBillingPortal"
                  :disabled="portalLoading"
                >
                  {{ portalLoading ? 'Loading...' : 'Manage Subscription' }}
                </button>
                <button
                  v-else
                  class="btn btn-primary"
                  @click="showPlans = true"
                >
                  Upgrade Plan
                </button>
              </template>
            </div>
          </div>
        </section>

        <!-- Usage Card -->
        <section class="billing-card">
          <div class="card-header">
            <h2>Usage This Month</h2>
            <span class="billing-period">{{ billingPeriod }}</span>
          </div>
          <div class="card-body">
            <div class="usage-meters">
              <div class="usage-meter">
                <div class="meter-header">
                  <span class="meter-label">Pipeline Runs</span>
                  <span class="meter-value">{{ usage.pipeline?.used || 0 }} / {{ usage.pipeline?.limit || '∞' }}</span>
                </div>
                <div class="meter-bar">
                  <div
                    class="meter-fill"
                    :style="{ width: getUsagePercent(usage.pipeline) + '%' }"
                    :class="{ 'meter-warning': getUsagePercent(usage.pipeline) > 80 }"
                  ></div>
                </div>
              </div>
              <div class="usage-meter">
                <div class="meter-header">
                  <span class="meter-label">Emails Sent</span>
                  <span class="meter-value">{{ usage.emails?.used || 0 }} / {{ usage.emails?.limit || '∞' }}</span>
                </div>
                <div class="meter-bar">
                  <div
                    class="meter-fill"
                    :style="{ width: getUsagePercent(usage.emails) + '%' }"
                    :class="{ 'meter-warning': getUsagePercent(usage.emails) > 80 }"
                  ></div>
                </div>
              </div>
              <div class="usage-meter">
                <div class="meter-header">
                  <span class="meter-label">Leads Discovered</span>
                  <span class="meter-value">{{ usage.leads?.used || 0 }} / {{ usage.leads?.limit || '∞' }}</span>
                </div>
                <div class="meter-bar">
                  <div
                    class="meter-fill"
                    :style="{ width: getUsagePercent(usage.leads) + '%' }"
                    :class="{ 'meter-warning': getUsagePercent(usage.leads) > 80 }"
                  ></div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Spending Card -->
        <section class="billing-card">
          <div class="card-header">
            <h2>Spending</h2>
          </div>
          <div class="card-body">
            <div class="spending-summary">
              <div class="spending-item">
                <span class="spending-label">Base subscription</span>
                <span class="spending-value">${{ currentPlan?.price || 0 }}</span>
              </div>
              <div class="spending-item" v-if="spending.overages > 0">
                <span class="spending-label">Overages</span>
                <span class="spending-value">${{ (spending.overages / 100).toFixed(2) }}</span>
              </div>
              <div class="spending-item spending-total">
                <span class="spending-label">Estimated total</span>
                <span class="spending-value">${{ ((currentPlan?.price || 0) + (spending.overages / 100)).toFixed(2) }}</span>
              </div>
            </div>

            <div class="spending-cap">
              <div class="cap-header">
                <h3>Spending Cap</h3>
                <span class="cap-status" :class="{ 'cap-active': spendingCap.capCents > 0 }">
                  {{ spendingCap.capCents > 0 ? 'Active' : 'Not set' }}
                </span>
              </div>
              <p class="cap-description">
                Set a maximum monthly spend to prevent unexpected charges from overages.
              </p>
              <div class="cap-input-group">
                <span class="cap-currency">$</span>
                <input
                  type="number"
                  v-model="newCapDollars"
                  :placeholder="spendingCap.capDollars || '100'"
                  min="0"
                  step="10"
                  class="cap-input"
                />
                <button
                  class="btn btn-sm btn-primary"
                  @click="updateSpendingCap"
                  :disabled="capLoading"
                >
                  {{ capLoading ? 'Saving...' : 'Set Cap' }}
                </button>
              </div>
              <div v-if="spendingCap.percentUsed" class="cap-progress">
                <span>{{ spendingCap.percentUsed.toFixed(1) }}% of cap used</span>
              </div>
            </div>
          </div>
        </section>

        <!-- Available Plans -->
        <section v-if="showPlans" class="billing-card plans-card">
          <div class="card-header">
            <h2>Available Plans</h2>
            <button class="btn btn-ghost btn-sm" @click="showPlans = false">&times;</button>
          </div>
          <div class="card-body">
            <div class="plans-grid">
              <div
                v-for="plan in plans"
                :key="plan.id"
                :class="['plan-option', { 'plan-current': plan.id === subscription.planId }]"
              >
                <div class="plan-option-header">
                  <h3>{{ plan.name }}</h3>
                  <div class="plan-option-price">
                    <span class="price">${{ plan.price }}</span>
                    <span class="period">/mo</span>
                  </div>
                </div>
                <ul class="plan-option-features">
                  <li>{{ plan.limits?.leads || 'Unlimited' }} leads/month</li>
                  <li>{{ plan.limits?.pipeline || 'Unlimited' }} pipeline runs/month</li>
                  <li>{{ plan.limits?.emails || 'Unlimited' }} emails/month</li>
                </ul>
                <button
                  v-if="plan.id !== subscription.planId"
                  class="btn btn-primary btn-block"
                  @click="checkout(plan.id)"
                  :disabled="checkoutLoading"
                >
                  {{ checkoutLoading ? 'Loading...' : 'Select Plan' }}
                </button>
                <button
                  v-else
                  class="btn btn-secondary btn-block"
                  disabled
                >
                  Current Plan
                </button>
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
const subscription = ref({});
const usage = ref({});
const spending = ref({});
const spendingCap = ref({});
const plans = ref([]);
const showPlans = ref(false);
const stripeConfigured = ref(true);

// Loading states
const portalLoading = ref(false);
const checkoutLoading = ref(false);
const capLoading = ref(false);

// Form state
const newCapDollars = ref('');

// Computed
const currentPlan = computed(() => {
  return plans.value.find(p => p.id === subscription.value.planId) || plans.value[0];
});

const billingPeriod = computed(() => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), 1);
  const end = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return `${start.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} - ${end.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`;
});

// Methods
function getUsagePercent(metric) {
  if (!metric || !metric.limit || metric.limit === 'unlimited') return 0;
  return Math.min(100, (metric.used / metric.limit) * 100);
}

async function fetchData() {
  loading.value = true;
  error.value = null;

  try {
    const [plansData, subscriptionData, usageData, spendingData, capData] = await Promise.all([
      api.get('/api/billing/plans'),
      api.get('/api/billing/subscription').catch(() => ({})),
      api.get('/api/billing/usage').catch(() => ({})),
      api.get('/api/billing/spending').catch(() => ({})),
      api.get('/api/billing/spending-cap').catch(() => ({}))
    ]);

    plans.value = plansData || [];
    subscription.value = subscriptionData || {};
    usage.value = usageData || {};
    spending.value = spendingData || {};
    spendingCap.value = capData || {};
    newCapDollars.value = capData?.capDollars || '';
  } catch (err) {
    error.value = err.message;
    if (err.message.includes('not configured')) {
      stripeConfigured.value = false;
    }
  } finally {
    loading.value = false;
  }
}

async function openBillingPortal() {
  portalLoading.value = true;
  try {
    const { url } = await api.get('/api/billing/portal');
    window.location.href = url;
  } catch (err) {
    error.value = `Failed to open billing portal: ${err.message}`;
  } finally {
    portalLoading.value = false;
  }
}

async function checkout(planId) {
  checkoutLoading.value = true;
  try {
    const { url } = await api.post('/api/billing/checkout', { planId });
    window.location.href = url;
  } catch (err) {
    error.value = `Failed to start checkout: ${err.message}`;
  } finally {
    checkoutLoading.value = false;
  }
}

async function updateSpendingCap() {
  if (!newCapDollars.value && newCapDollars.value !== 0) return;

  capLoading.value = true;
  try {
    const result = await api.post('/api/billing/spending-cap', {
      capDollars: parseFloat(newCapDollars.value)
    });
    spendingCap.value = result;
  } catch (err) {
    error.value = `Failed to update spending cap: ${err.message}`;
  } finally {
    capLoading.value = false;
  }
}

// Lifecycle
onMounted(fetchData);
</script>

<style scoped>
.billing-page {
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

.billing-content {
  max-width: 1000px;
  margin: 0 auto;
  padding: 2rem;
}

/* Cards */
.billing-card {
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

/* Status Badge */
.status-badge {
  font-size: 0.75rem;
  padding: 0.25rem 0.75rem;
  border-radius: 9999px;
  font-weight: 500;
  text-transform: capitalize;
}

.status-active {
  background: rgba(16, 185, 129, 0.2);
  color: var(--accent-green);
}

.status-canceled,
.status-past_due {
  background: rgba(239, 68, 68, 0.2);
  color: var(--accent-red);
}

.status-trialing {
  background: rgba(59, 130, 246, 0.2);
  color: var(--accent-blue);
}

/* Plan Info */
.plan-info {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 1.5rem;
}

.plan-name {
  font-size: 1.5rem;
  font-weight: 600;
  color: var(--text-primary);
}

.plan-price {
  text-align: right;
}

.price-amount {
  font-size: 2rem;
  font-weight: 700;
  color: var(--text-primary);
}

.price-period {
  color: var(--text-muted);
  font-size: 0.875rem;
}

/* Plan Features */
.plan-features {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1rem;
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  margin-bottom: 1.5rem;
}

.feature {
  text-align: center;
}

.feature-value {
  display: block;
  font-size: 1.25rem;
  font-weight: 600;
  color: var(--text-primary);
}

.feature-label {
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* Usage Meters */
.usage-meters {
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
}

.usage-meter {
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
}

.meter-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.meter-label {
  font-size: 0.875rem;
  color: var(--text-secondary);
}

.meter-value {
  font-size: 0.875rem;
  font-weight: 500;
  color: var(--text-primary);
}

.meter-bar {
  height: 8px;
  background: var(--bg-secondary);
  border-radius: 4px;
  overflow: hidden;
}

.meter-fill {
  height: 100%;
  background: linear-gradient(90deg, var(--accent-blue), var(--accent-cyan));
  border-radius: 4px;
  transition: width 0.3s ease;
}

.meter-fill.meter-warning {
  background: linear-gradient(90deg, var(--accent-orange), var(--accent-red));
}

/* Spending */
.spending-summary {
  margin-bottom: 2rem;
}

.spending-item {
  display: flex;
  justify-content: space-between;
  padding: 0.75rem 0;
  border-bottom: 1px solid var(--border-color);
}

.spending-item:last-child {
  border-bottom: none;
}

.spending-label {
  color: var(--text-secondary);
}

.spending-value {
  font-weight: 500;
  color: var(--text-primary);
}

.spending-total {
  font-weight: 600;
}

.spending-total .spending-value {
  font-size: 1.25rem;
  color: var(--accent-green);
}

/* Spending Cap */
.spending-cap {
  padding: 1rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
}

.cap-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 0.5rem;
}

.cap-header h3 {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0;
}

.cap-status {
  font-size: 0.75rem;
  color: var(--text-muted);
}

.cap-status.cap-active {
  color: var(--accent-green);
}

.cap-description {
  font-size: 0.8125rem;
  color: var(--text-muted);
  margin-bottom: 1rem;
}

.cap-input-group {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.cap-currency {
  color: var(--text-muted);
  font-weight: 500;
}

.cap-input {
  flex: 1;
  max-width: 120px;
  padding: 0.5rem 0.75rem;
  background: var(--bg-input);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-md);
  color: var(--text-primary);
  font-size: 0.875rem;
}

.cap-input:focus {
  outline: none;
  border-color: var(--accent-blue);
}

.cap-progress {
  margin-top: 0.75rem;
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* Plans Grid */
.plans-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
  gap: 1rem;
}

.plan-option {
  padding: 1.5rem;
  background: var(--bg-secondary);
  border-radius: var(--radius-md);
  border: 2px solid transparent;
  transition: all 0.2s ease;
}

.plan-option:hover {
  border-color: var(--accent-blue);
}

.plan-option.plan-current {
  border-color: var(--accent-green);
}

.plan-option-header {
  margin-bottom: 1rem;
}

.plan-option-header h3 {
  font-size: 1rem;
  font-weight: 600;
  color: var(--text-primary);
  margin: 0 0 0.5rem;
}

.plan-option-price .price {
  font-size: 1.5rem;
  font-weight: 700;
  color: var(--text-primary);
}

.plan-option-price .period {
  color: var(--text-muted);
}

.plan-option-features {
  list-style: none;
  padding: 0;
  margin: 0 0 1.5rem;
}

.plan-option-features li {
  padding: 0.5rem 0;
  color: var(--text-secondary);
  font-size: 0.875rem;
  border-bottom: 1px solid var(--border-color);
}

.plan-option-features li:last-child {
  border-bottom: none;
}

.btn-block {
  width: 100%;
}

/* Billing Period */
.billing-period {
  font-size: 0.75rem;
  color: var(--text-muted);
}

/* Responsive */
@media (max-width: 768px) {
  .billing-content {
    padding: 1rem;
  }

  .plan-features {
    grid-template-columns: 1fr;
  }

  .plan-info {
    flex-direction: column;
    align-items: flex-start;
    gap: 1rem;
  }

  .plans-grid {
    grid-template-columns: 1fr;
  }
}
</style>
