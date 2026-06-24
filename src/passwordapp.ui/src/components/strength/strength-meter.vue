<template>
  <div v-if="password" class="password-strength mt-1">
    <div class="d-flex align-items-center gap-2">
      <div class="progress flex-grow-1" style="height: 6px;">
        <div
          class="progress-bar"
          role="progressbar"
          :class="barClass"
          :style="{ width: strength.percent + '%' }"
          :aria-valuenow="strength.percent"
          aria-valuemin="0"
          aria-valuemax="100"></div>
      </div>
      <Tag :severity="strength.variant" :value="strength.label" />
      <small class="text-muted">~{{ strength.bits }} bits</small>
    </div>
    <small v-if="strength.warning" class="text-danger d-block mt-1">{{ strength.warning }}</small>
  </div>
</template>

<script>
import { estimatePasswordStrength } from '@/components/utils/strength.js';

export default {
  name: 'PasswordStrength',
  props: {
    password: { type: String, default: '' },
  },
  computed: {
    strength() {
      return estimatePasswordStrength(this.password);
    },
    barClass() {
      return {
        'bg-danger': this.strength.variant === 'danger',
        'bg-warning': this.strength.variant === 'warn',
        'bg-info': this.strength.variant === 'info',
        'bg-success': this.strength.variant === 'success',
      };
    },
  },
};
</script>
