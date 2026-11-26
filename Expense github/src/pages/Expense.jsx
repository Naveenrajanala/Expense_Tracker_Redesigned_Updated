import React, { useState } from 'react';
import Sidebar from '../components/Sidebar';
import Navbar from '../components/Navbar';
import Footer from '../components/Footer';
import BudgetGuardPreview from '../components/BudgetGuardPreview';
import { useAuth } from '../context/AuthContext';
import { addTransaction, updateTransaction, deleteTransaction, money } from '../utils/storage';
import { checkExpenseBudgetConstraint } from '../utils/budgetConstraints';
import {
  AlertCircleIcon,
  ArrowDownRightIcon,
  CheckCircleIcon,
  CloseIcon,
  EditIcon,
  TrashIcon
} from '../components/Icons';

export default function Expense() {
  const { currentUser, refreshUser } = useAuth();

  const today = new Date().toISOString().split('T')[0];
  const [amount, setAmount] = useState('');
  const [category, setCategory] = useState('');
  const [note, setNote] = useState('');
  const [date, setDate] = useState(today);
  const [account, setAccount] = useState('cash');
  const [message, setMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [pendingOverride, setPendingOverride] = useState(false);

  // Editing state
  const [editingTx, setEditingTx] = useState(null);
  const [editError, setEditError] = useState('');
  const [editPendingOverride, setEditPendingOverride] = useState(false);

  const accounts = currentUser?.accounts || [
    { id: 'cash', name: 'Cash', type: 'Cash' },
    { id: 'bank', name: 'Bank Account', type: 'Bank' }
  ];

  const allTransactions = currentUser?.transactions || [];
  const budgets = currentUser?.budgets || {};
  const budgetSettings = currentUser?.budgetSettings;

  const expenses = allTransactions
    .filter((t) => t.type === 'expense')
    .slice()
    .reverse();

  const totalExpense = expenses.reduce((s, t) => s + Number(t.amount || 0), 0);

  const catTotals = {};
  expenses.forEach((t) => {
    const c = t.category || 'Other';
    catTotals[c] = (catTotals[c] || 0) + Number(t.amount || 0);
  });
  const topCat = Object.entries(catTotals).sort((a, b) => b[1] - a[1])[0]?.[0] || '—';

  const getAccountName = (accVal) => {
    const found = accounts.find((a) => a.id === accVal || a.name === accVal);
    return found ? found.name : accVal || 'Cash';
  };

  const addConstraint = checkExpenseBudgetConstraint({
    transactions: allTransactions,
    budgets,
    budgetSettings,
    expense: { amount: Number(amount || 0), category, date }
  });

  const editConstraint = editingTx
    ? checkExpenseBudgetConstraint({
        transactions: allTransactions,
        budgets,
        budgetSettings,
        expense: {
          amount: Number(editingTx.amount || 0),
          category: editingTx.category,
          date: editingTx.date
        },
        excludeTxId: editingTx.id
      })
    : null;

  const saveNewExpense = () => {
    addTransaction(currentUser.email, {
      type: 'expense',
      amount: Number(amount),
      category,
      note: note.trim(),
      date,
      account
    });

    refreshUser();
    setMessage('Expense saved successfully.');
    setErrorMessage('');
    setPendingOverride(false);
    setAmount('');
    setCategory('');
    setNote('');
    setDate(today);

    setTimeout(() => {
      setMessage('');
    }, 4000);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!amount || !category || !note) return;

    setMessage('');
    if (!addConstraint.allowed) {
      setPendingOverride(false);
      setErrorMessage(addConstraint.summary);
      return;
    }

    if (addConstraint.requiresOverride && !pendingOverride) {
      setErrorMessage('');
      setPendingOverride(true);
      return;
    }

    saveNewExpense();
  };

  const handleEditClick = (t) => {
    setEditError('');
    setEditPendingOverride(false);
    setEditingTx({
      id: t.id,
      amount: t.amount,
      category: t.category || '',
      note: t.note || '',
      date: t.date || today,
      account: t.account || 'cash'
    });
  };

  const saveUpdatedExpense = () => {
    updateTransaction(currentUser.email, {
      id: editingTx.id,
      type: 'expense',
      amount: Number(editingTx.amount),
      category: editingTx.category,
      note: editingTx.note.trim(),
      date: editingTx.date,
      account: editingTx.account
    });
    refreshUser();
    setEditError('');
    setEditPendingOverride(false);
    setEditingTx(null);
  };

  const handleUpdate = (e) => {
    e.preventDefault();
    if (!editingTx) return;

    if (editConstraint && !editConstraint.allowed) {
      setEditPendingOverride(false);
      setEditError(editConstraint.summary);
      return;
    }

    if (editConstraint && editConstraint.requiresOverride && !editPendingOverride) {
      setEditError('');
      setEditPendingOverride(true);
      return;
    }

    saveUpdatedExpense();
  };

  const handleDelete = (id) => {
    if (window.confirm('Delete this expense?')) {
      deleteTransaction(currentUser.email, id);
      refreshUser();
    }
  };

  const isAddBlocked = !addConstraint.allowed;
  const isEditBlocked = Boolean(editConstraint && !editConstraint.allowed);

  return (
    <div className="app-page">
      <Sidebar role="user" />
      <main className="main">
        <Navbar
          title="Expense Management"
          eyebrow="MONEY OUT"
          subtitle="Categorize daily spending and monitor where your money goes."
        />

        <section className="kpi-strip">
          <div className="kpi-mini-card dark">
            <span>Total Recorded Expenses</span>
            <strong>{money(totalExpense)}</strong>
          </div>
          <div className="kpi-mini-card">
            <span>Expense Entries</span>
            <strong>{expenses.length}</strong>
          </div>
          <div className="kpi-mini-card">
            <span>Top Spending Category</span>
            <strong>{topCat}</strong>
          </div>
        </section>

        <section className="form-layout">
          <div className="panel intro-panel expense-intro">
            <div>
              <span className="eyebrow">MONEY OUT</span>
              <h2>Add expense</h2>
              <p>
                Record everyday spending so your dashboard, budgets, and reports reflect
                accurate category insights.
              </p>
            </div>

            <div className="intro-highlights">
              <div className="intro-stat-box">
                <small>Latest Expense</small>
                <strong>{expenses[0] ? money(expenses[0].amount) : '₹0'}</strong>
              </div>
              <div className="intro-stat-box">
                <small>Highest Category</small>
                <strong>{topCat}</strong>
              </div>
            </div>

            <div className="big-symbol">↘</div>
          </div>

          <div className="panel form-panel">
            <div className="panel-head">
              <div>
                <span className="eyebrow">NEW ENTRY</span>
                <h2>Expense details</h2>
              </div>
            </div>

            <form id="expenseForm" className="form-stack" onSubmit={handleSubmit}>
              <label>
                Amount (₹)
                <input
                  id="expenseAmount"
                  type="number"
                  min="1"
                  placeholder="0.00"
                  required
                  value={amount}
                  onChange={(e) => {
                    setAmount(e.target.value);
                    setErrorMessage('');
                    setPendingOverride(false);
                  }}
                />
              </label>

              <label>
                Category
                <select
                  id="expenseCategory"
                  required
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value);
                    setErrorMessage('');
                    setPendingOverride(false);
                  }}
                >
                  <option value="">Choose category</option>
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

              {(category || Number(amount) > 0) && (
                <BudgetGuardPreview constraint={addConstraint} amount={amount} />
              )}

              <label>
                Account
                <select
                  id="transactionAccount"
                  value={account}
                  onChange={(e) => setAccount(e.target.value)}
                >
                  {accounts.map((acc) => (
                    <option key={acc.id} value={acc.id}>
                      {acc.name}
                    </option>
                  ))}
                </select>
              </label>

              <label>
                Note
                <input
                  id="expenseNote"
                  type="text"
                  placeholder="What did you spend on?"
                  required
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                />
              </label>

              <label>
                Date
                <input
                  id="expenseDate"
                  type="date"
                  required
                  value={date}
                  onChange={(e) => {
                    setDate(e.target.value);
                    setErrorMessage('');
                    setPendingOverride(false);
                  }}
                />
              </label>

              {message && (
                <p id="expenseMessage" className="form-message message-success">
                  <CheckCircleIcon size={16} />
                  {message}
                </p>
              )}

              {(errorMessage || isAddBlocked) && (
                <p id="expenseConstraintError" className="form-message message-error">
                  <AlertCircleIcon size={16} />
                  <span>{errorMessage || addConstraint.summary}</span>
                </p>
              )}

              {pendingOverride && addConstraint.requiresOverride && (
                <div className="form-message message-warning override-box">
                  <div className="override-text">
                    <AlertCircleIcon size={16} />
                    <span>{addConstraint.summary} Save anyway?</span>
                  </div>
                  <div className="override-actions">
                    <button
                      type="button"
                      className="danger-confirm-btn"
                      onClick={saveNewExpense}
                    >
                      Override &amp; Save
                    </button>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => setPendingOverride(false)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <button
                className="primary-btn"
                type="submit"
                disabled={isAddBlocked}
                title={isAddBlocked ? 'Blocked by strict budget constraint' : undefined}
              >
                {isAddBlocked ? 'Blocked by budget limit' : 'Save expense'} <span>→</span>
              </button>
            </form>
          </div>
        </section>

        {/* Expenses List with Edit & Delete */}
        <section className="panel" style={{ marginTop: '20px' }}>
          <div className="panel-head">
            <div>
              <span className="eyebrow">HISTORY</span>
              <h2>Recorded expenses ({expenses.length})</h2>
            </div>
          </div>

          <div className="transaction-list">
            {expenses.length ? (
              expenses.map((t) => (
                <div key={t.id} className="transaction-row">
                  <span className="tx-icon expense">
                    <ArrowDownRightIcon size={19} />
                  </span>
                  <div>
                    <div className="tx-title">{t.note || t.category || 'Expense'}</div>
                    <div className="tx-meta">
                      <span>{t.date || 'No date'}</span>
                      {t.category && <span className="tx-pill expense">{t.category}</span>}
                      {t.account && (
                        <span className="tx-pill">{getAccountName(t.account)}</span>
                      )}
                    </div>
                  </div>
                  <div className="actions-cell">
                    <strong className="tx-amount expense">− {money(t.amount)}</strong>
                    <button
                      type="button"
                      className="edit-btn"
                      onClick={() => handleEditClick(t)}
                    >
                      <EditIcon size={14} /> Edit
                    </button>
                    <button
                      type="button"
                      className="delete-btn"
                      onClick={() => handleDelete(t.id)}
                    >
                      <TrashIcon size={14} /> Delete
                    </button>
                  </div>
                </div>
              ))
            ) : (
              <div className="empty-state">
                <div className="empty-state-icon">
                  <ArrowDownRightIcon size={20} />
                </div>
                <strong>No expense records yet</strong>
                <span>Log your first purchase above to start tracking your spending.</span>
              </div>
            )}
          </div>
        </section>

        {/* Edit Modal */}
        {editingTx && (
          <div className="modal-overlay" onClick={() => setEditingTx(null)}>
            <div className="modal-box" onClick={(e) => e.stopPropagation()}>
              <div className="modal-header">
                <h3>Edit Expense</h3>
                <button
                  type="button"
                  className="modal-close-btn"
                  aria-label="Close modal"
                  onClick={() => setEditingTx(null)}
                >
                  <CloseIcon size={18} />
                </button>
              </div>

              <form onSubmit={handleUpdate} className="form-stack">
                <label>
                  Amount (₹)
                  <input
                    type="number"
                    min="1"
                    required
                    value={editingTx.amount}
                    onChange={(e) => {
                      setEditingTx({ ...editingTx, amount: e.target.value });
                      setEditError('');
                      setEditPendingOverride(false);
                    }}
                  />
                </label>
                <label>
                  Category
                  <select
                    required
                    value={editingTx.category}
                    onChange={(e) => {
                      setEditingTx({ ...editingTx, category: e.target.value });
                      setEditError('');
                      setEditPendingOverride(false);
                    }}
                  >
                    <option value="">Choose category</option>
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

                <BudgetGuardPreview constraint={editConstraint} amount={editingTx.amount} />

                <label>
                  Account
                  <select
                    value={editingTx.account}
                    onChange={(e) =>
                      setEditingTx({ ...editingTx, account: e.target.value })
                    }
                  >
                    {accounts.map((acc) => (
                      <option key={acc.id} value={acc.id}>
                        {acc.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Note
                  <input
                    type="text"
                    required
                    value={editingTx.note}
                    onChange={(e) =>
                      setEditingTx({ ...editingTx, note: e.target.value })
                    }
                  />
                </label>
                <label>
                  Date
                  <input
                    type="date"
                    required
                    value={editingTx.date}
                    onChange={(e) => {
                      setEditingTx({ ...editingTx, date: e.target.value });
                      setEditError('');
                      setEditPendingOverride(false);
                    }}
                  />
                </label>

                {(editError || isEditBlocked) && (
                  <p className="form-message message-error">
                    <AlertCircleIcon size={16} />
                    <span>{editError || editConstraint?.summary}</span>
                  </p>
                )}

                {editPendingOverride && editConstraint?.requiresOverride && (
                  <div className="form-message message-warning override-box">
                    <div className="override-text">
                      <AlertCircleIcon size={16} />
                      <span>{editConstraint.summary} Update anyway?</span>
                    </div>
                    <div className="override-actions">
                      <button
                        type="button"
                        className="danger-confirm-btn"
                        onClick={saveUpdatedExpense}
                      >
                        Override &amp; Update
                      </button>
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => setEditPendingOverride(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}

                <div style={{ display: 'flex', gap: '10px', marginTop: '10px' }}>
                  <button
                    className="primary-btn"
                    type="submit"
                    style={{ flex: 1 }}
                    disabled={isEditBlocked}
                  >
                    {isEditBlocked ? 'Blocked by budget limit' : 'Update expense'} <span>✓</span>
                  </button>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => setEditingTx(null)}
                  >
                    Cancel
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <Footer />
      </main>
    </div>
  );
}
