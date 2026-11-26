import React, { useState, useRef, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { money } from '../utils/storage';
import { getMonthlySpending, normalizeBudgetSettings } from '../utils/budgetConstraints';
import { BellIcon, ChevronDownIcon, MenuIcon } from './Icons';

export default function Navbar({ title, eyebrow, subtitle }) {
  const { currentUser, isAdmin } = useAuth();
  const [notifOpen, setNotifOpen] = useState(false);
  const popRef = useRef(null);

  useEffect(() => {
    const handleOutside = (e) => {
      if (popRef.current && !popRef.current.contains(e.target)) {
        setNotifOpen(false);
      }
    };
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const getGreeting = () => {
    const h = new Date().getHours();
    const timeGreeting = h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
    if (currentUser?.name) {
      return `${timeGreeting}, ${currentUser.name.split(' ')[0]}`;
    }
    return timeGreeting;
  };

  const displayName = isAdmin
    ? 'Admin'
    : currentUser?.name
    ? currentUser.name.split(' ')[0]
    : 'User';
  const avatar = isAdmin
    ? 'A'
    : currentUser?.name
    ? currentUser.name.trim().charAt(0).toUpperCase()
    : 'U';
  const defaultEyebrow = isAdmin ? 'ADMIN MODULE' : 'PERSONAL FINANCE';

  // Derive real alerts from user data (no dummy data)
  const alerts = [];
  if (!isAdmin && currentUser) {
    const budgets = currentUser.budgets || {};
    const txs = currentUser.transactions || [];
    const settings = normalizeBudgetSettings(currentUser.budgetSettings);
    const { byCategory: spent, total: monthlyTotal } = getMonthlySpending(txs);

    if (settings.overallMonthlyLimit > 0) {
      if (monthlyTotal > settings.overallMonthlyLimit) {
        alerts.push({
          title: 'Overall monthly cap exceeded',
          detail: `Spent ${money(monthlyTotal)} of ${money(settings.overallMonthlyLimit)}`
        });
      } else if (
        Math.round((monthlyTotal / settings.overallMonthlyLimit) * 100) >=
        settings.alertThresholdPct
      ) {
        alerts.push({
          title: 'Approaching overall monthly cap',
          detail: `Spent ${money(monthlyTotal)} of ${money(settings.overallMonthlyLimit)}`
        });
      }
    }

    Object.entries(budgets).forEach(([cat, lim]) => {
      const limitNum = Number(lim);
      const s = spent[cat] || 0;
      if (limitNum > 0 && s > limitNum) {
        alerts.push({
          title: `${cat} budget exceeded`,
          detail: `Spent ${money(s)} of ${money(limitNum)}`
        });
      } else if (limitNum > 0 && Math.round((s / limitNum) * 100) >= settings.alertThresholdPct) {
        alerts.push({
          title: `${cat} budget near limit`,
          detail: `Spent ${money(s)} of ${money(limitNum)}`
        });
      }
    });

    (currentUser.recurring || []).slice(0, 2).forEach((r) => {
      alerts.push({
        title: `Upcoming: ${r.name}`,
        detail: `${money(r.amount)} · Due ${r.date}`
      });
    });
  }

  const todayFormatted = new Date().toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });

  const handleOpenMobileMenu = () => {
    window.dispatchEvent(new CustomEvent('toggle-mobile-sidebar'));
  };

  return (
    <header className="topbar">
      <div className="topbar-left">
        <button
          type="button"
          className="mobile-menu-btn"
          aria-label="Open menu"
          onClick={handleOpenMobileMenu}
        >
          <MenuIcon size={20} />
        </button>

        <div>
          <span className="eyebrow">{eyebrow || defaultEyebrow}</span>
          <h1 id="pageGreeting">{title || getGreeting()}</h1>
          {subtitle && (
            <p className="muted" style={{ marginTop: '2px' }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div className="top-actions" ref={popRef}>
        <span className="date-pill">{todayFormatted}</span>

        <button
          className="icon-btn"
          aria-label="Notifications"
          type="button"
          onClick={() => setNotifOpen((prev) => !prev)}
        >
          <BellIcon size={18} />
          {alerts.length > 0 && <span className="notif-dot" />}
        </button>

        {notifOpen && (
          <div className="notif-popover">
            <div className="notif-popover-head">
              <span>Notifications</span>
              <span className="tx-pill">{alerts.length}</span>
            </div>
            <div className="notif-list">
              {alerts.length > 0 ? (
                alerts.map((a, idx) => (
                  <div key={idx} className="notif-item">
                    <strong>{a.title}</strong>
                    <span>{a.detail}</span>
                  </div>
                ))
              ) : (
                <div className="notif-item">
                  <strong>All caught up</strong>
                  <span>No budget alerts or pending reminders right now.</span>
                </div>
              )}
            </div>
          </div>
        )}

        <Link className="user-chip" to={isAdmin ? '/admin/dashboard' : '/profile'}>
          <span className="avatar" id="topAvatar">
            {avatar}
          </span>
          <span className="user-chip-name" id="topUserName">
            {displayName}
          </span>
          <span className="user-chip-chevron" style={{ color: 'var(--muted)', display: 'flex' }}>
            <ChevronDownIcon size={14} />
          </span>
        </Link>
      </div>
    </header>
  );
}
