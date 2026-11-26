export const DEFAULT_BUDGET_SETTINGS = {
  enforcementMode: 'strict', // 'strict' | 'warn' | 'track'
  overallMonthlyLimit: 0,
  alertThresholdPct: 80
};

export const ENFORCEMENT_MODES = [
  {
    id: 'strict',
    label: 'Strict Block',
    shortLabel: 'Strict Block',
    description: 'Block saving any expense that exceeds a category or monthly cap.'
  },
  {
    id: 'warn',
    label: 'Warn & Confirm',
    shortLabel: 'Warn & Confirm',
    description: 'Show an over-limit warning and require explicit override confirmation.'
  },
  {
    id: 'track',
    label: 'Track Only',
    shortLabel: 'Track Only',
    description: 'Allow expenses freely while displaying status badges and alerts.'
  }
];

export function normalizeBudgetSettings(raw) {
  const src = raw && typeof raw === 'object' ? raw : {};
  const validModes = ['strict', 'warn', 'track'];
  const enforcementMode = validModes.includes(src.enforcementMode)
    ? src.enforcementMode
    : DEFAULT_BUDGET_SETTINGS.enforcementMode;
  const overallMonthlyLimit = Math.max(0, Number(src.overallMonthlyLimit) || 0);
  const rawThreshold = Number(src.alertThresholdPct);
  const alertThresholdPct =
    Number.isFinite(rawThreshold) && rawThreshold >= 50 && rawThreshold <= 99
      ? Math.round(rawThreshold)
      : DEFAULT_BUDGET_SETTINGS.alertThresholdPct;

  return {
    enforcementMode,
    overallMonthlyLimit,
    alertThresholdPct
  };
}

export function getMonthKey(dateStr) {
  if (typeof dateStr === 'string' && /^\d{4}-\d{2}/.test(dateStr.trim())) {
    return dateStr.trim().slice(0, 7);
  }
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  return `${y}-${m}`;
}

export function formatMonthLabel(monthKey) {
  if (!monthKey || !/^\d{4}-\d{2}$/.test(monthKey)) return 'Current Month';
  const [y, m] = monthKey.split('-').map(Number);
  const d = new Date(y, m - 1, 1);
  return d.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

export function getMonthlySpending(transactions = [], monthKey = getMonthKey(), excludeTxId = null) {
  const byCategory = {};
  let total = 0;

  transactions.forEach((t) => {
    if (!t || t.type !== 'expense') return;
    if (excludeTxId !== null && excludeTxId !== undefined && t.id === excludeTxId) return;
    if (getMonthKey(t.date) !== monthKey) return;

    const amt = Number(t.amount || 0);
    const cat = t.category || 'Other';
    byCategory[cat] = (byCategory[cat] || 0) + amt;
    total += amt;
  });

  return { byCategory, total, monthKey };
}

export function formatCurrencyValue(n) {
  return '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

/**
 * Evaluate whether adding or updating an expense violates category or overall monthly budget limits.
 */
export function checkExpenseBudgetConstraint({
  transactions = [],
  budgets = {},
  budgetSettings,
  expense,
  excludeTxId = null
}) {
  const settings = normalizeBudgetSettings(budgetSettings);
  const mode = settings.enforcementMode;
  const threshold = settings.alertThresholdPct;

  const amount = Math.max(0, Number(expense?.amount || 0));
  const category = expense?.category || 'Other';
  const monthKey = getMonthKey(expense?.date);
  const monthLabel = formatMonthLabel(monthKey);

  const existingTx =
    excludeTxId !== null && excludeTxId !== undefined
      ? transactions.find((t) => t.id === excludeTxId)
      : null;

  const { byCategory, total } = getMonthlySpending(transactions, monthKey, excludeTxId);

  const isSameEditMonth =
    existingTx && existingTx.type === 'expense' && getMonthKey(existingTx.date) === monthKey;
  const isSameEditCategory =
    isSameEditMonth && (existingTx.category || 'Other') === category;
  const isAmountNotIncreased = existingTx && amount <= Number(existingTx.amount || 0);

  // 1. Category budget check
  const catLimit = Number(budgets?.[category] || 0);
  let categoryCheck = null;
  if (catLimit > 0 && category) {
    const spentBefore = byCategory[category] || 0;
    const projected = spentBefore + amount;
    const exceededBy = Math.max(0, projected - catLimit);
    const remainingBefore = catLimit - spentBefore;
    const remainingAfter = catLimit - projected;
    const pctAfter = Math.round((projected / catLimit) * 100);
    // Do not block harmless edits (e.g., fixing note or lowering amount) in the same category/month
    const rawViolated = projected > catLimit;
    const violated = rawViolated && !(isSameEditCategory && isAmountNotIncreased);
    const nearLimit = !rawViolated && pctAfter >= threshold;

    categoryCheck = {
      hasLimit: true,
      category,
      limit: catLimit,
      spentBefore,
      projected,
      remainingBefore,
      remainingAfter,
      exceededBy,
      pctAfter,
      violated,
      rawViolated,
      nearLimit
    };
  }

  // 2. Overall monthly limit check
  const overallLimit = settings.overallMonthlyLimit;
  let overallCheck = null;
  if (overallLimit > 0) {
    const spentBefore = total;
    const projected = spentBefore + amount;
    const exceededBy = Math.max(0, projected - overallLimit);
    const remainingBefore = overallLimit - spentBefore;
    const remainingAfter = overallLimit - projected;
    const pctAfter = Math.round((projected / overallLimit) * 100);
    const rawViolated = projected > overallLimit;
    const violated = rawViolated && !(isSameEditMonth && isAmountNotIncreased);
    const nearLimit = !rawViolated && pctAfter >= threshold;

    overallCheck = {
      hasLimit: true,
      limit: overallLimit,
      spentBefore,
      projected,
      remainingBefore,
      remainingAfter,
      exceededBy,
      pctAfter,
      violated,
      rawViolated,
      nearLimit
    };
  }

  const violations = [];
  if (categoryCheck?.violated) {
    violations.push({
      scope: 'category',
      label: `${category} monthly budget`,
      limit: categoryCheck.limit,
      spentBefore: categoryCheck.spentBefore,
      projected: categoryCheck.projected,
      exceededBy: categoryCheck.exceededBy,
      remainingBefore: categoryCheck.remainingBefore
    });
  }
  if (overallCheck?.violated) {
    violations.push({
      scope: 'overall',
      label: 'Overall monthly spending limit',
      limit: overallCheck.limit,
      spentBefore: overallCheck.spentBefore,
      projected: overallCheck.projected,
      exceededBy: overallCheck.exceededBy,
      remainingBefore: overallCheck.remainingBefore
    });
  }

  const hasViolation = violations.length > 0;
  const isNearLimit = Boolean(
    !hasViolation && (categoryCheck?.nearLimit || overallCheck?.nearLimit)
  );
  const allowed = !(hasViolation && mode === 'strict');
  const requiresOverride = hasViolation && mode === 'warn';

  let headline = '';
  let summary = '';
  if (hasViolation) {
    const primary = violations[0];
    headline =
      mode === 'strict'
        ? `Blocked: ${primary.label} exceeded`
        : `Budget warning: ${primary.label} exceeded`;
    summary = violations
      .map(
        (v) =>
          `${v.label} (${monthLabel}): projected ${formatCurrencyValue(
            v.projected
          )} exceeds ${formatCurrencyValue(v.limit)} limit by ${formatCurrencyValue(
            v.exceededBy
          )}.`
      )
      .join(' ');
  }

  return {
    allowed,
    requiresOverride,
    hasViolation,
    isNearLimit,
    mode,
    monthKey,
    monthLabel,
    categoryCheck,
    overallCheck,
    violations,
    headline,
    summary
  };
}
