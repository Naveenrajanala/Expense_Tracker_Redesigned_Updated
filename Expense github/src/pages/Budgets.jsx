import React, { useState, useEffect } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import { useAuth } from '../context/AuthContext';
import { saveUser, money } from '../utils/storage';
import {
  ENFORCEMENT_MODES,
  formatMonthLabel,
  getMonthKey,
  getMonthlySpending,
  normalizeBudgetSettings
} from '../utils/budgetConstraints';
import {
  AlertCircleIcon,
  CheckCircleIcon,
  CloseIcon,
  PieChartIcon,
  ShieldIcon
} from '../components/Icons';

export default function Budgets() {
  const { currentUser, refreshUser } = useAuth();

  const currentMonthKey = getMonthKey();
  const [selectedMonth, setSelectedMonth] = useState(currentMonthKey);
  const [category, setCategory] = useState('Food');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState(null);

  const savedSettings = normalizeBudgetSettings(currentUser?.budgetSettings);
  const [enforcementMode, setEnforcementMode] = useState(savedSettings.enforcementMode);
  const [overallMonthlyLimit, setOverallMonthlyLimit] = useState(
    savedSettings.overallMonthlyLimit > 0 ? String(savedSettings.overallMonthlyLimit) : ''
  );
  const [alertThresholdPct, setAlertThresholdPct] = useState(
    String(savedSettings.alertThresholdPct)
  );
  const [settingsMessage, setSettingsMessage] = useState('');

  useEffect(() => {
    const s = normalizeBudgetSettings(currentUser?.budgetSettings);
    setEnforcementMode(s.enforcementMode);
    setOverallMonthlyLimit(s.overallMonthlyLimit > 0 ? String(s.overallMonthlyLimit) : '');
    setAlertThresholdPct(String(s.alertThresholdPct));
  }, [currentUser?.email]);

  const budgets = currentUser?.budgets || {};
  const transactions = currentUser?.transactions || [];

  // Collect available months from expense transactions plus current month
  const monthOptionsSet = new Set([currentMonthKey]);
  transactions
    .filter((t) => t.type === 'expense' && t.date)
    .forEach((t) => monthOptionsSet.add(getMonthKey(t.date)));
  const monthOptions = Array.from(monthOptionsSet).sort((a, b) => b.localeCompare(a));

  const { byCategory: spent, total: totalMonthSpent } = getMonthlySpending(
    transactions,
    selectedMonth
  );

  const categories = Object.keys(budgets);
  const totalBudgeted = categories.reduce((sum, cat) => sum + Number(budgets[cat] || 0), 0);
  const totalSpentInBudgets = categories.reduce((sum, cat) => sum + (spent[cat] || 0), 0);
  const exceededCount =
    categories.filter((cat) => (spent[cat] || 0) > Number(budgets[cat] || 0)).length +
    (savedSettings.overallMonthlyLimit > 0 && totalMonthSpent > savedSettings.overallMonthlyLimit
      ? 1
      : 0);

  const activeModeMeta =
    ENFORCEMENT_MODES.find((m) => m.id === savedSettings.enforcementMode) || ENFORCEMENT_MODES[0];

  const handleSubmit = (e) => {
    e.preventDefault();
    const numAmount = Number(amount);
    if (!Number.isFinite(numAmount) || numAmount <= 0) {
      setMessage({ type: 'error', text: 'Enter a valid monthly limit greater than ₹0.' });
      return;
    }

    const updatedBudgets = {
      ...budgets,
      [category]: numAmount
    };

    saveUser({
      ...currentUser,
      budgets: updatedBudgets
    });

    refreshUser();
    const currentCatSpent = spent[category] || 0;
    if (currentCatSpent > numAmount) {
      setMessage({
        type: 'warning',
        text: `Budget saved, but ${category} spending in ${formatMonthLabel(
          selectedMonth
        )} (${money(currentCatSpent)}) already exceeds ${money(numAmount)}.`
      });
    } else {
      setMessage({ type: 'success', text: 'Budget saved successfully.' });
    }
    setAmount('');
    setTimeout(() => setMessage(null), 4000);
  };

  const handleSaveConstraints = (e) => {
    e.preventDefault();
    const parsedOverall = overallMonthlyLimit.trim() === '' ? 0 : Number(overallMonthlyLimit);
    if (!Number.isFinite(parsedOverall) || parsedOverall < 0) {
      return;
    }

    const nextSettings = normalizeBudgetSettings({
      enforcementMode,
      overallMonthlyLimit: parsedOverall,
      alertThresholdPct: Number(alertThresholdPct)
    });

    saveUser({
      ...currentUser,
      budgetSettings: nextSettings
    });

    refreshUser();
    setSettingsMessage('Budget constraint policy updated.');
    setTimeout(() => setSettingsMessage(''), 3500);
  };

  const handleDeleteBudget = (cat) => {
    if (window.confirm(`Delete budget for ${cat}?`)) {
      const updatedBudgets = { ...budgets };
      delete updatedBudgets[cat];
      saveUser({
        ...currentUser,
        budgets: updatedBudgets
      });
      refreshUser();
    }
  };

  const selectedCatCurrentSpent = spent[category] || 0;
  const selectedCatExistingLimit = Number(budgets[category] || 0);

  return (
    <div className="app-page">
      <Sidebar role="user" />
      <main className="main">
        <Navbar
          title="Budget Management"
          eyebrow="BUDGET PLANNER"
          subtitle="Set monthly spending caps, enforce over-budget constraints, and track utilization."
        />

        <section className="kpi-strip cols-4">
          <div className="kpi-mini-card dark">
            <span>Total Category Budgets</span>
            <strong>{money(totalBudgeted)}</strong>
          </div>
          <div className="kpi-mini-card">
            <span>Spent in {formatMonthLabel(selectedMonth)}</span>
            <strong>
              {money(
                savedSettings.overallMonthlyLimit > 0 ? totalMonthSpent : totalSpentInBudgets
              )}
            </strong>
          </div>
          <div className="kpi-mini-card">
            <span>Exceeded Limits</span>
            <strong style={{ color: exceededCount > 0 ? 'var(--danger)' : 'var(--success)' }}>
              {exceededCount}
            </strong>
          </div>
          <div className="kpi-mini-card">
            <span>Active Constraint</span>
            <strong style={{ fontSize: '18px' }}>{activeModeMeta.shortLabel}</strong>
          </div>
        </section>

        <section className="feature-grid">
          <div style={{ display: 'grid', gap: '18px' }}>
            {/* Expense Constraint Policy Card */}
            <div className="panel">
              <div className="panel-head" style={{ marginBottom: '10px' }}>
                <div>
                  <span className="eyebrow">EXPENSE GUARDRAILS</span>
                  <h2>Limit-exceeding constraint</h2>
                </div>
                <span className={`status-badge ${savedSettings.enforcementMode === 'strict' ? 'over' : savedSettings.enforcementMode === 'warn' ? 'warn' : 'ok'}`}>
                  <ShieldIcon size={12} />
                  {activeModeMeta.shortLabel}
                </span>
              </div>
              <p className="muted" style={{ marginTop: '4px', marginBottom: '16px' }}>
                Control what happens when a new or edited expense exceeds your monthly budget.
              </p>

              <form id="constraintForm" className="form-stack" onSubmit={handleSaveConstraints}>
                <div className="constraint-mode-grid" role="radiogroup" aria-label="Budget constraint mode">
                  {ENFORCEMENT_MODES.map((modeOption) => {
                    const active = enforcementMode === modeOption.id;
                    return (
                      <label
                        key={modeOption.id}
                        className={`constraint-mode-option ${active ? 'active' : ''}`}
                      >
                        <input
                          type="radio"
                          name="enforcementMode"
                          value={modeOption.id}
                          checked={active}
                          onChange={() => setEnforcementMode(modeOption.id)}
                        />
                        <div>
                          <strong>{modeOption.label}</strong>
                          <small>{modeOption.description}</small>
                        </div>
                      </label>
                    );
                  })}
                </div>

                <label>
                  Overall Monthly Spending Cap (₹) <span className="muted" style={{ fontWeight: 500 }}>(optional)</span>
                  <input
                    id="overallMonthlyLimit"
                    type="number"
                    min="0"
                    placeholder="Leave empty or 0 for category-only limits"
                    value={overallMonthlyLimit}
                    onChange={(e) => setOverallMonthlyLimit(e.target.value)}
                  />
                </label>

                <label>
                  Near-Limit Alert Threshold
                  <select
                    id="alertThresholdPct"
                    value={alertThresholdPct}
                    onChange={(e) => setAlertThresholdPct(e.target.value)}
                  >
                    <option value="70">70% of monthly cap</option>
                    <option value="80">80% of monthly cap (Default)</option>
                    <option value="90">90% of monthly cap</option>
                  </select>
                </label>

                <button className="primary-btn" type="submit">
                  Save constraint policy <span>→</span>
                </button>

                {settingsMessage && (
                  <p id="constraintMessage" className="form-message message-success">
                    <CheckCircleIcon size={16} />
                    {settingsMessage}
                  </p>
                )}
              </form>
            </div>

            {/* Category Budget Planner Card */}
            <div className="panel">
              <span className="eyebrow">CATEGORY CAPS</span>
              <h2>Set monthly budgets</h2>
              <p className="muted" style={{ marginTop: '6px' }}>
                Create or update spending limits for each expense category.
              </p>

              <form id="budgetForm" className="form-stack" onSubmit={handleSubmit}>
                <label>
                  Category
                  <select
                    id="budgetCategory"
                    value={category}
                    onChange={(e) => setCategory(e.target.value)}
                  >
                    <option value="Food">Food</option>
                    <option value="Travel">Travel</option>
                    <option value="Shopping">Shopping</option>
                    <option value="Bills">Bills</option>
                    <option value="Education">Education</option>
                    <option value="Health">Health</option>
                    <option value="Entertainment">Entertainment</option>
                    <option value="Other">Other</option>
                  </select>
                </label>

                <label>
                  Monthly limit (₹)
                  <input
                    id="budgetAmount"
                    type="number"
                    min="1"
                    placeholder="e.g. 5000"
                    required
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                </label>

                <div className="budget-hint-row">
                  <span>
                    {formatMonthLabel(selectedMonth)} spent: <strong>{money(selectedCatCurrentSpent)}</strong>
                  </span>
                  {selectedCatExistingLimit > 0 && (
                    <span>
                      Current cap: <strong>{money(selectedCatExistingLimit)}</strong>
                    </span>
                  )}
                </div>

                <button className="primary-btn" type="submit">
                  Save budget <span>→</span>
                </button>

                {message && (
                  <p
                    id="budgetMessage"
                    className={`form-message ${
                      message.type === 'error'
                        ? 'message-error'
                        : message.type === 'warning'
                        ? 'message-warning'
                        : 'message-success'
                    }`}
                  >
                    {message.type === 'success' ? (
                      <CheckCircleIcon size={16} />
                    ) : (
                      <AlertCircleIcon size={16} />
                    )}
                    {message.text}
                  </p>
                )}
              </form>
            </div>
          </div>

          <div className="panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">TRACKING</span>
                <h2>Budget status</h2>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                <select
                  aria-label="Filter budget status month"
                  className="fintech-select"
                  style={{ width: 'auto', padding: '7px 12px', fontSize: '12.5px' }}
                  value={selectedMonth}
                  onChange={(e) => setSelectedMonth(e.target.value)}
                >
                  {monthOptions.map((mk) => (
                    <option key={mk} value={mk}>
                      {formatMonthLabel(mk)}
                    </option>
                  ))}
                </select>
                <span className="pill">{categories.length} active</span>
              </div>
            </div>

            {savedSettings.overallMonthlyLimit > 0 && (
              <div className="feature-item" style={{ marginBottom: '14px', borderColor: 'var(--line-strong)' }}>
                {(() => {
                  const lim = savedSettings.overallMonthlyLimit;
                  const p = Math.min(100, lim ? (totalMonthSpent / lim) * 100 : 0);
                  const isOver = totalMonthSpent > lim;
                  const isNear = !isOver && p >= savedSettings.alertThresholdPct;
                  const remaining = lim - totalMonthSpent;

                  return (
                    <>
                      <div className="feature-item-head">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '14px' }}>Overall Monthly Cap</strong>
                          {isOver ? (
                            <span className="status-badge over">Exceeded!</span>
                          ) : isNear ? (
                            <span className="status-badge warn">Near limit</span>
                          ) : (
                            <span className="status-badge ok">On track</span>
                          )}
                        </div>
                        <span className="tabular-nums">
                          {money(totalMonthSpent)} / {money(lim)}
                        </span>
                      </div>

                      <div className="progress">
                        <i
                          style={{
                            width: `${p}%`,
                            background: isOver ? '#dc2626' : isNear ? '#d97706' : undefined
                          }}
                        />
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginTop: '7px',
                          fontSize: '11.5px',
                          color: 'var(--muted)'
                        }}
                      >
                        <span>{Math.round(p)}% used across all categories</span>
                        <span>
                          {remaining >= 0
                            ? `${money(remaining)} remaining`
                            : `${money(Math.abs(remaining))} over limit`}
                        </span>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            <div id="budgetList">
              {categories.length ? (
                categories.map((cat) => {
                  const lim = Number(budgets[cat]) || 0;
                  const v = spent[cat] || 0;
                  const p = Math.min(100, lim ? (v / lim) * 100 : 0);
                  const isOver = v > lim;
                  const isNear = !isOver && p >= savedSettings.alertThresholdPct;
                  const remaining = lim - v;

                  return (
                    <div key={cat} className="feature-item">
                      <div className="feature-item-head">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                          <strong style={{ fontSize: '14px' }}>{cat}</strong>
                          {isOver ? (
                            <span className="status-badge over">Exceeded!</span>
                          ) : isNear ? (
                            <span className="status-badge warn">Near limit</span>
                          ) : (
                            <span className="status-badge ok">On track</span>
                          )}
                        </div>

                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="tabular-nums">
                            {money(v)} / {money(lim)}
                          </span>
                          <button
                            type="button"
                            className="tx-action-btn"
                            title="Remove budget"
                            aria-label={`Remove ${cat} budget`}
                            onClick={() => handleDeleteBudget(cat)}
                          >
                            <CloseIcon size={13} />
                          </button>
                        </div>
                      </div>

                      <div className="progress">
                        <i
                          style={{
                            width: `${p}%`,
                            background: isOver
                              ? '#dc2626'
                              : isNear
                              ? '#d97706'
                              : undefined
                          }}
                        />
                      </div>

                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          marginTop: '7px',
                          fontSize: '11.5px',
                          color: 'var(--muted)'
                        }}
                      >
                        <span>{Math.round(p)}% used</span>
                        <span>
                          {remaining >= 0
                            ? `${money(remaining)} remaining`
                            : `${money(Math.abs(remaining))} over limit`}
                        </span>
                      </div>
                    </div>
                  );
                })
              ) : (
                <div className="empty-state">
                  <div className="empty-state-icon">
                    <PieChartIcon size={20} />
                  </div>
                  <strong>No category budgets set yet</strong>
                  <span>Choose a category on the left to set your first monthly cap.</span>
                </div>
              )}
            </div>
          </div>
        </section>

        <Footer />
      </main>
    </div>
  );
}
