<template>
  <Teleport to="body">
    <div v-if="!ui.onboardingComplete" class="modal-overlay onboarding-overlay" @click.self="skip">
      <div class="modal onboarding-modal">
        <div class="onboarding-header">
          <h2>{{ steps[currentStep].title }}</h2>
          <button @click="skip" class="modal-close" aria-label="Skip onboarding">&times;</button>
        </div>

        <div class="onboarding-body">
          <div class="onboarding-illustration" :class="`step-${currentStep}`">
            <div class="illustration-icon" v-html="steps[currentStep].icon"></div>
          </div>
          <p class="onboarding-description">{{ steps[currentStep].description }}</p>
          <p class="onboarding-hint">{{ steps[currentStep].hint }}</p>
        </div>

        <div class="onboarding-footer">
          <div class="step-dots">
            <span
              v-for="(_, index) in steps"
              :key="index"
              :class="['dot', { active: index === currentStep, completed: index < currentStep }]"
              @click="currentStep = index"
            ></span>
          </div>
          <div class="onboarding-actions">
            <button v-if="currentStep > 0" class="btn btn-ghost" @click="currentStep--">
              Back
            </button>
            <button class="btn btn-ghost" @click="skip">
              Skip
            </button>
            <button v-if="currentStep < steps.length - 1" class="btn btn-primary" @click="currentStep++">
              Next
            </button>
            <button v-else class="btn btn-primary" @click="complete">
              Get Started
            </button>
          </div>
        </div>
      </div>
    </div>
  </Teleport>
</template>

<script setup>
import { ref } from 'vue';
import { useUiStore } from '../../stores/ui.js';

const ui = useUiStore();
const currentStep = ref(0);

const steps = [
  {
    title: 'Welcome to Site Improver',
    description: 'Transform outdated business websites into modern, conversion-optimized pages in seconds. Paste any URL and watch the magic happen.',
    hint: 'Start by entering a business website URL in the "Process Website" section.',
    icon: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5"/><path d="M2 12l10 5 10-5"/></svg>'
  },
  {
    title: 'Find Leads in Your Area',
    description: 'Search for businesses by industry and location. We will find companies with outdated websites that need your help.',
    hint: 'Try searching for "plumbers" in "Denver, CO" to see it in action.',
    icon: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/><path d="M11 8v6"/><path d="M8 11h6"/></svg>'
  },
  {
    title: 'Review Before Sending',
    description: 'Every outreach email is queued for your approval. Preview exactly what gets sent, make edits, then approve or reject.',
    hint: 'Check the "Emails" section to manage your outreach queue.',
    icon: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>'
  },
  {
    title: 'Track Your Pipeline',
    description: 'Monitor every lead from discovery to conversion. The pipeline view shows exactly where each prospect stands in your workflow.',
    hint: 'Use the Pipeline Status section to see leads at every stage.',
    icon: '<svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><path d="M22 12h-4l-3 9L9 3l-3 9H2"/></svg>'
  }
];

function skip() {
  ui.completeOnboarding();
}

function complete() {
  ui.completeOnboarding();
}
</script>

<style scoped>
.onboarding-overlay {
  backdrop-filter: blur(4px);
}

.onboarding-modal {
  max-width: 520px;
  width: 90%;
  background: var(--bg-card);
  border: 1px solid var(--border-color);
  border-radius: var(--radius-xl);
  overflow: hidden;
}

.onboarding-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1.5rem 1.5rem 0;
}

.onboarding-header h2 {
  font-size: 1.25rem;
  font-weight: 700;
  background: linear-gradient(135deg, var(--accent-blue), var(--accent-purple));
  -webkit-background-clip: text;
  -webkit-text-fill-color: transparent;
  background-clip: text;
}

.onboarding-body {
  padding: 1.5rem;
  text-align: center;
}

.onboarding-illustration {
  margin: 0 auto 1.25rem;
  width: 80px;
  height: 80px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, rgba(59, 130, 246, 0.15), rgba(139, 92, 246, 0.15));
  border: 1px solid rgba(59, 130, 246, 0.2);
}

.illustration-icon {
  color: var(--accent-blue);
}

.onboarding-description {
  color: var(--text-primary);
  font-size: 0.95rem;
  line-height: 1.6;
  margin-bottom: 0.75rem;
}

.onboarding-hint {
  color: var(--text-muted);
  font-size: 0.85rem;
  font-style: italic;
}

.onboarding-footer {
  padding: 1rem 1.5rem 1.5rem;
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.step-dots {
  display: flex;
  gap: 0.5rem;
}

.dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--border-color);
  cursor: pointer;
  transition: all var(--transition-fast);
}

.dot.active {
  background: var(--accent-blue);
  transform: scale(1.2);
}

.dot.completed {
  background: var(--accent-green);
}

.onboarding-actions {
  display: flex;
  gap: 0.5rem;
}
</style>
