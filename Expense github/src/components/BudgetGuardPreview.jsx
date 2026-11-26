import React from 'react';
import { money } from '../utils/storage';
import { ENFORCEMENT_MODES } from '../utils/budgetConstraints';
import { AlertCircleIcon, CheckCircleIcon, ShieldIcon } from './Icons';

function GuardRow({ title, check, enteredAmount }) {
  const pct = Math.min(100, Math.max(0, check.pctAfter));
  const fillColor = check.rawViolated
    ? '#dc2626'
    : check.nearLimit
    ? '#d97706'
    : undefined;

  return (
    <div className="budget-guard-row">
      <div className="budget-guard-row-head">
        <strong>{title}</strong>
        <span className="tabular-nums">
          {enteredAmount > 0 ? (
            <>
              {money(check.spentBefore)} + {money(enteredAmount)} ={' '}
              <b style={{ color: check.rawViolated ? 'var(--danger)' : 'var(--ink)' }}>
                {money(check.projected)}
              </b>{' '}
              / {money(check.limit)}
            </>
          ) : (
            <>
              {money(check.spentBefore)} / {money(check.limit)}
            </>
          )}
        </span>
      </div>

      <div className="progress" style={{ marginTop: '6px', height: '7px' }}>
        <i style={{ width: `${pct}%`, background: fillColor }} />
      </div>

      <div className="budget-guard-row-meta">
        <span>{check.pctAfter}% of cap</span>
        <span style={{ color: check.rawViolated ? 'var(--danger)' : undefined, fontWeight: check.rawViolated ? 700 : 600 }}>
          {check.rawViolated
            ? `Over limit by ${money(check.exceededBy)}`
            : `${money(check.remainingAfter)} remaining`}
        </span>
      </div>
    </div>
  );
}

/**
 * Compact live budget utilization and constraint check card for expense forms and edit modals.
 */
export default function BudgetGuardPreview({ constraint, amount = 0 }) {
  if (!constraint) return null;
  const { categoryCheck, overallCheck, hasViolation, isNearLimit, mode, monthLabel } = constraint;

  if (!categoryCheck && !overallCheck) return null;

  const modeMeta = ENFORCEMENT_MODES.find((m) => m.id === mode) || ENFORCEMENT_MODES[0];
  const stateClass = hasViolation ? 'over' : isNearLimit ? 'warn' : 'ok';
  const enteredAmount = Math.max(0, Number(amount || 0));

  return (
    <div className={`budget-guard-card ${stateClass}`} aria-live="polite">
      <div className="budget-guard-head">
        <span className="budget-guard-title">
          {hasViolation ? (
            <AlertCircleIcon size={15} />
          ) : isNearLimit ? (
            <AlertCircleIcon size={15} />
          ) : (
            <CheckCircleIcon size={15} />
          )}
          <span>Budget Check · {monthLabel}</span>
        </span>
        <span className={`status-badge ${stateClass}`}>
          <ShieldIcon size={11} />
          {modeMeta.shortLabel}
        </span>
      </div>

      {categoryCheck && (
        <GuardRow
          title={`${categoryCheck.category} Limit`}
          check={categoryCheck}
          enteredAmount={enteredAmount}
        />
      )}

      {overallCheck && (
        <GuardRow
          title="Overall Monthly Cap"
          check={overallCheck}
          enteredAmount={enteredAmount}
        />
      )}
    </div>
  );
}
