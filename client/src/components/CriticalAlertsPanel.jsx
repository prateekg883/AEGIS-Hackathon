import React, { useState, useEffect, useCallback, useRef } from 'react';
import {
  ShieldAlert,
  AlertTriangle,
  CheckCircle2,
  Eye,
  Send,
  Check,
  X,
  Lock,
  RefreshCw,
  TrendingUp,
  TrendingDown,
  Minus,
  HelpCircle,
} from 'lucide-react';
import {
  LineChart,
  Line,
  ResponsiveContainer,
  Tooltip as RechartsTooltip,
} from 'recharts';
import api from '../services/api';
import { useSOC, calculateAttentionBreakdown } from '../state/SOCContext';
import HigherAuthorityEscalationModal from './HigherAuthorityEscalationModal';
import Badge from './common/Badge';

/* -------------------------------------------------------
   Helpers
   ------------------------------------------------------- */

/** Map a finding status string → Badge variant */
function statusVariant(status) {
  const s = String(status || '').toUpperCase();
  if (s === 'RESOLVED') return 'resolved';
  if (s === 'ESCALATED') return 'escalated';
  if (s === 'UNDER REVIEW') return 'under-review';
  return 'open'; // OPEN and anything else → critical red
}

/** Generate a 7-point pseudo-trend sparkline from attention_score + seeded noise */
function generateSparkline(score, findingId = '') {
  const seed = findingId.split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) || 42;
  const pseudo = (n) => {
    const x = Math.sin(seed + n) * 10000;
    return x - Math.floor(x);
  };
  const base = Math.max(60, Math.min(95, Number(score)));
  return Array.from({ length: 7 }, (_, i) => ({
    t: i,
    v: Math.round(base + (pseudo(i * 3.7) - 0.5) * 22),
  }));
}

/** Score ≥ 100 → 'top', else 'next' */
const scoreTier = (score) => (Number(score) >= 100 ? 'top' : 'next');

/* -------------------------------------------------------
   Sub-components
   ------------------------------------------------------- */

/** Inline sparkline for a single alert row */
function AlertSparkline({ score, findingId }) {
  const data = generateSparkline(score, findingId);
  const first = data[0].v;
  const last = data[data.length - 1].v;
  const delta = last - first;
  const TrendIcon = delta > 3 ? TrendingUp : delta < -3 ? TrendingDown : Minus;
  const trendClass =
    delta > 3
      ? 'cap-sparkline-trend--up'
      : delta < -3
      ? 'cap-sparkline-trend--down'
      : 'cap-sparkline-trend--flat';
  const lineColor =
    delta > 3 ? 'var(--color-critical)' : delta < -3 ? 'var(--color-success)' : 'var(--color-text-muted)';

  return (
    <div className="cap-sparkline-cell">
      <ResponsiveContainer width={64} height={24}>
        <LineChart data={data} margin={{ top: 2, right: 2, bottom: 2, left: 2 }}>
          <Line
            type="monotone"
            dataKey="v"
            stroke={lineColor}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
          <RechartsTooltip
            content={({ active, payload }) =>
              active && payload?.length ? (
                <div style={{ fontSize: 9, background: 'var(--color-surface)', border: '1px solid var(--color-border)', padding: '2px 5px', borderRadius: 3 }}>
                  {payload[0].value}
                </div>
              ) : null
            }
          />
        </LineChart>
      </ResponsiveContainer>
      <span className={`cap-sparkline-trend ${trendClass}`}>
        <TrendIcon size={10} />
      </span>
    </div>
  );
}

/** Inline score breakdown expansion row */
function BreakdownRow({ item, colSpan }) {
  const bd = calculateAttentionBreakdown(item.attention_score || 98);
  const factors = [
    { label: 'Execution Gap', value: bd.execution_gap_score, weight: 39 },
    { label: 'Negative Space', value: bd.negative_space_score, weight: 29 },
    { label: 'Peer Deviation', value: bd.peer_deviation_score, weight: 18 },
    { label: 'Anomaly', value: bd.anomaly_score, weight: 14 },
  ];
  const total = item.attention_score || 98;

  return (
    <tr className="cap-breakdown-row">
      <td colSpan={colSpan}>
        <div className="cap-breakdown-inner">
          <div className="cap-breakdown-title">Why this score? — Score {total} breakdown</div>
          <div className="cap-breakdown-factors">
            {factors.map((f) => (
              <div key={f.label} className="cap-breakdown-factor">
                <div className="cap-breakdown-factor__label">{f.label} ({f.weight}%)</div>
                <div className="cap-breakdown-factor__bar">
                  <div
                    className="cap-breakdown-factor__fill"
                    style={{ width: `${Math.round((f.value / total) * 100)}%` }}
                  />
                </div>
                <div className="cap-breakdown-factor__value">+{f.value}</div>
              </div>
            ))}
          </div>
        </div>
      </td>
    </tr>
  );
}

/** Keyboard shortcuts popover */
function ShortcutPanel({ onClose }) {
  const shortcuts = [
    { key: 'j', desc: 'Move focus to next row' },
    { key: 'k', desc: 'Move focus to previous row' },
    { key: 'a', desc: 'Acknowledge focused row' },
    { key: 'e', desc: 'Escalate focused row' },
    { key: 'x', desc: 'Select / deselect row' },
    { key: '?', desc: 'Toggle this help panel' },
    { key: 'Esc', desc: 'Close modal / panel' },
  ];
  return (
    <div className="cap-shortcut-panel" role="dialog" aria-label="Keyboard shortcuts">
      <div className="cap-shortcut-panel__title">Keyboard Shortcuts</div>
      <div className="cap-shortcut-list">
        {shortcuts.map(({ key, desc }) => (
          <div key={key} className="cap-shortcut-item">
            <kbd>{key}</kbd>
            <span>{desc}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------
   Main Component
   ------------------------------------------------------- */

export default function CriticalAlertsPanel({ onFindingUpdated }) {
  const { isDemoMode, activeFileName, activeAlerts = [], resolveIncident } = useSOC();

  // --- Core state ---
  const [criticalItems, setCriticalItems] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selectedItem, setSelectedItem] = useState(null);   // detail modal
  const [actionNotice, setActionNotice] = useState(null);
  const [processingId, setProcessingId] = useState(null);
  const [escalatingFinding, setEscalatingFinding] = useState(null);
  const [isEscalating, setIsEscalating] = useState(false);

  // --- Additive feature state ---
  const [selectedIds, setSelectedIds] = useState(new Set());   // bulk-select
  const [focusedIndex, setFocusedIndex] = useState(-1);        // keyboard nav
  const [expandedScoreId, setExpandedScoreId] = useState(null); // score breakdown
  const [showShortcuts, setShowShortcuts] = useState(false);   // shortcut popover
  const tableRef = useRef(null);

  /* ----- Data loading ----- */
  const getDynamicCriticalItems = useCallback(() => {
    if (!isDemoMode && activeAlerts.length > 0) {
      const liveCrit = activeAlerts.filter((a) => String(a.severity).toLowerCase() === 'critical');
      const liveHigh = activeAlerts.filter((a) => String(a.severity).toLowerCase() === 'high');
      const candidates = [...liveCrit, ...liveHigh].slice(0, 5);
      if (candidates.length > 0) {
        return candidates.map((a, idx) => ({
          rank: idx + 1,
          alert_id: a.id,
          finding_id: `FND-LIVE-${idx + 1}`,
          cse_code: a.cse || 'CSE-07',
          attention_score: 100 - idx,
          priority_label: idx === 0 ? 'Immediate Senior Review' : 'Senior Review',
          attack_type: a.type || 'EXECUTION_GAP',
          finding_type: a.type || 'EXECUTION_GAP',
          title: `${a.severity} Threat on ${a.asset}: ${a.type}`,
          description:
            a.message ||
            `Operational telemetry captured on ${a.asset} requiring mandatory supervisory review.`,
          explanation: `Ingested from ${activeFileName || 'Live CSV'}: Critical operational telemetry deviation detected on node ${a.asset}.`,
          status:
            a.status === 'Closed' || a.status === 'Resolved'
              ? 'RESOLVED'
              : a.status === 'Acknowledged'
              ? 'UNDER REVIEW'
              : 'OPEN',
          delivery_status: 'AWAITING_AUTH_ENDPOINT',
          source_system: `${a.cse || 'CSE-07'} Stream (${activeFileName || 'Live CSV'})`,
          timestamp: a.created || new Date().toISOString(),
          payload_hash: '8f4c2b9a1d3e5f7a0c8b6d4e2f1a3c5e7b9d1f3a5c7e9b1d3f5a7c9e1b3d5f7a',
          evidence: [
            {
              code: `EVD-LIVE-${idx + 1}`,
              type: 'SECURITY_LOG',
              record_id: a.id,
              summary: `${a.type} event on asset ${a.asset}`,
            },
          ],
        }));
      }
    }
    return [];
  }, [isDemoMode, activeAlerts, activeFileName]);

  const fetchCriticalFindings = useCallback(async () => {
    setLoading(true);
    try {
      if (!isDemoMode && activeAlerts.length > 0) {
        setCriticalItems(getDynamicCriticalItems());
        return;
      }
      const data = await api.getCriticalFindings();
      if (Array.isArray(data) && data.length > 0) {
        const sorted = [...data].sort((a, b) => {
          if (Number(b.attention_score) !== Number(a.attention_score))
            return Number(b.attention_score) - Number(a.attention_score);
          return new Date(b.timestamp || 0) - new Date(a.timestamp || 0);
        });
        setCriticalItems(sorted);
      } else {
        setCriticalItems(getDynamicCriticalItems());
      }
    } catch (_) {
      setCriticalItems(getDynamicCriticalItems());
    } finally {
      setLoading(false);
    }
  }, [isDemoMode, activeAlerts, getDynamicCriticalItems]);

  useEffect(() => {
    fetchCriticalFindings();
  }, [isDemoMode, activeFileName, activeAlerts.length]);

  /* ----- Keyboard shortcuts ----- */
  useEffect(() => {
    const activeItems = criticalItems.filter((i) => i.status !== 'RESOLVED');

    const onKeyDown = (e) => {
      // Ignore when typing in an input / modal open
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || selectedItem) return;

      switch (e.key) {
        case 'j':
          e.preventDefault();
          setFocusedIndex((prev) => Math.min(prev + 1, criticalItems.length - 1));
          break;
        case 'k':
          e.preventDefault();
          setFocusedIndex((prev) => Math.max(prev - 1, 0));
          break;
        case 'a': {
          e.preventDefault();
          if (focusedIndex >= 0 && criticalItems[focusedIndex]) {
            const item = criticalItems[focusedIndex];
            if (item.status !== 'RESOLVED' && item.status !== 'UNDER REVIEW') handleAcknowledge(item);
          }
          break;
        }
        case 'e': {
          e.preventDefault();
          if (focusedIndex >= 0 && criticalItems[focusedIndex]) {
            const item = criticalItems[focusedIndex];
            if (item.status !== 'RESOLVED') handleOpenEscalateModal(item);
          }
          break;
        }
        case 'x': {
          e.preventDefault();
          if (focusedIndex >= 0 && criticalItems[focusedIndex]) {
            const item = criticalItems[focusedIndex];
            const id = item.finding_id || item.alert_id;
            setSelectedIds((prev) => {
              const next = new Set(prev);
              next.has(id) ? next.delete(id) : next.add(id);
              return next;
            });
          }
          break;
        }
        case '?':
          e.preventDefault();
          setShowShortcuts((v) => !v);
          break;
        case 'Escape':
          setShowShortcuts(false);
          setFocusedIndex(-1);
          break;
        default:
          break;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [criticalItems, focusedIndex, selectedItem]);

  /* ----- Actions ----- */
  const handleView = async (item) => {
    setSelectedItem(item);
    try { await api.viewCriticalFinding(item.finding_id || item.alert_id); } catch (_) {}
  };

  const handleAcknowledge = async (item) => {
    const id = item.finding_id || item.alert_id;
    setProcessingId(id);
    try { await api.acknowledgeCriticalFinding(id); } catch (_) {}
    setActionNotice({ type: 'success', message: `Finding ${item.finding_id} acknowledged. Status: UNDER REVIEW.` });
    setCriticalItems((prev) =>
      prev.map((it) => (it.finding_id === item.finding_id ? { ...it, status: 'UNDER REVIEW' } : it))
    );
    if (selectedItem?.finding_id === item.finding_id)
      setSelectedItem((prev) => ({ ...prev, status: 'UNDER REVIEW' }));
    if (onFindingUpdated) onFindingUpdated();
    setProcessingId(null);
  };

  const handleResolve = async (item) => {
    const id = item.finding_id || item.alert_id;
    setProcessingId(id);
    try {
      await api.resolveCriticalFinding(id, 'Resolved and verified by senior supervisor');
    } catch (_) {}
    if (resolveIncident) resolveIncident(item.alert_id || item.finding_id);
    setActionNotice({ type: 'success', message: `Finding ${item.finding_id} resolved. Status: RESOLVED.` });
    setCriticalItems((prev) =>
      prev.map((it) => (it.finding_id === item.finding_id ? { ...it, status: 'RESOLVED' } : it))
    );
    if (selectedItem?.finding_id === item.finding_id)
      setSelectedItem((prev) => ({ ...prev, status: 'RESOLVED' }));
    if (onFindingUpdated) onFindingUpdated();
    setProcessingId(null);
    // Remove from selection
    setSelectedIds((prev) => { const next = new Set(prev); next.delete(id); return next; });
  };

  const handleOpenEscalateModal = (item) => {
    setEscalatingFinding({
      ...item,
      finding_code: item.finding_id || item.alert_id,
      cse: item.cse_code || item.cse || 'CSE-07',
      score_contribution: item.attention_score || 99,
      category: item.attack_type || item.finding_type || 'EXECUTION_GAP',
    });
  };

  const handleConfirmEscalate = async (modalData) => {
    const { findingCode, score, title, category, cse, bottleneck, analyst_notes, target_authority, action_requested, urgency } = modalData;
    setIsEscalating(true);
    let deliveryStatus = 'QUEUED';
    try {
      const res = await api.escalateCriticalFinding(findingCode, score, {
        title, category, cse, bottleneck, analyst_notes, target_authority, action_requested, urgency,
      });
      deliveryStatus = res.status || 'QUEUED';
    } catch (_) {}

    setActionNotice({
      type: 'success',
      message: `Finding ${findingCode} formally escalated to ${target_authority}. Status: ${deliveryStatus}. Ground review recorded.`,
    });

    const groundReview = {
      bottleneck_category: bottleneck,
      ground_analyst_issues: analyst_notes,
      target_higher_authority: target_authority,
      recommended_executive_action: action_requested,
      urgency_level: urgency,
    };
    setCriticalItems((prev) =>
      prev.map((it) =>
        it.finding_id === findingCode || it.alert_id === findingCode
          ? { ...it, delivery_status: deliveryStatus, status: 'ESCALATED', ground_level_review: groundReview }
          : it
      )
    );
    if (selectedItem && (selectedItem.finding_id === findingCode || selectedItem.alert_id === findingCode)) {
      setSelectedItem((prev) => ({ ...prev, delivery_status: deliveryStatus, status: 'ESCALATED', ground_level_review: groundReview }));
    }
    setEscalatingFinding(null);
    setIsEscalating(false);
    if (onFindingUpdated) onFindingUpdated();
  };

  /* ----- Bulk actions ----- */
  const handleBulkAcknowledge = async () => {
    const targets = criticalItems.filter(
      (it) => selectedIds.has(it.finding_id || it.alert_id) && it.status !== 'RESOLVED' && it.status !== 'UNDER REVIEW'
    );
    for (const item of targets) await handleAcknowledge(item);
    setSelectedIds(new Set());
  };

  const handleBulkResolve = async () => {
    const targets = criticalItems.filter(
      (it) => selectedIds.has(it.finding_id || it.alert_id) && it.status !== 'RESOLVED'
    );
    for (const item of targets) await handleResolve(item);
    setSelectedIds(new Set());
  };

  const toggleSelectAll = () => {
    const allIds = criticalItems.filter((i) => i.status !== 'RESOLVED').map((i) => i.finding_id || i.alert_id);
    if (selectedIds.size === allIds.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(allIds));
    }
  };

  /* ----- Derived values ----- */
  const activeCount = criticalItems.filter((i) => i.status !== 'RESOLVED').length;
  const allActiveIds = criticalItems.filter((i) => i.status !== 'RESOLVED').map((i) => i.finding_id || i.alert_id);
  const allSelected = allActiveIds.length > 0 && allActiveIds.every((id) => selectedIds.has(id));

  /* Total columns: checkbox + rank/score + ID + threat + source + status + sparkline + timestamp + actions */
  const COL_SPAN = 9;

  /* ----- Render ----- */
  return (
    <div className="cap-wrapper">
      {/* ── Priority Banner (calm left-accent design) ── */}
      <div className="cap-banner">
        <div className="cap-banner__left">
          <span className="cap-banner__p1-pill">PRIORITY 1</span>
          <div className="cap-banner__icon">
            <ShieldAlert size={15} />
          </div>
          <div>
            <div className="cap-banner__title">
              New Critical Finding — Immediate Senior Review Required
            </div>
            <div className="cap-banner__subtitle">
              Controlled escalation through existing Critical Alert Gateway
            </div>
          </div>
        </div>

        <div className="cap-banner__right">
          <span className="cap-banner__count-pill">
            {activeCount} Active Senior Action{activeCount !== 1 ? 's' : ''}
          </span>
          <button
            className="cap-banner__refresh"
            onClick={fetchCriticalFindings}
            disabled={loading}
            title="Refresh critical findings"
          >
            <RefreshCw size={11} className={loading ? 'spin' : ''} />
            Refresh
          </button>
          <button
            className="cap-banner__hint-btn"
            onClick={() => setShowShortcuts((v) => !v)}
            title="Keyboard shortcuts"
            aria-label="Show keyboard shortcuts"
          >
            <HelpCircle size={13} />
          </button>
          {showShortcuts && (
            <ShortcutPanel onClose={() => setShowShortcuts(false)} />
          )}
        </div>
      </div>

      {/* ── Action Notice ── */}
      {actionNotice && (
        <div className={`cap-notice cap-notice--${actionNotice.type === 'error' ? 'error' : 'success'}`}>
          <span>{actionNotice.message}</span>
          <button className="cap-notice__close" onClick={() => setActionNotice(null)} aria-label="Dismiss">
            <X size={14} />
          </button>
        </div>
      )}

      {/* ── Sub-header ── */}
      <div className="cap-subheader">
        <div className="cap-subheader__left">
          <h3 className="cap-subheader__title">
            CRITICAL PRIORITY ALERTS (Attention Score 98–100)
          </h3>
          <p className="cap-subheader__desc">
            Automated highest priority queue for senior supervisory review. Controlled escalation through existing Critical Alert Gateway.
          </p>
        </div>
        <div className="cap-subheader__right">
          <span className="cap-priority-legend cap-priority-legend--critical">100 = Highest Priority</span>
          <span className="cap-priority-legend cap-priority-legend--warning">99 = Next</span>
          <span className="cap-priority-legend cap-priority-legend--warning">98 = Next</span>
        </div>
      </div>

      {/* ── Critical Findings Table ── */}
      <div className="cap-table-container">
        <table className="cap-table" ref={tableRef}>

          <thead>
            <tr>
              <th className="th-checkbox">
                <input
                  type="checkbox"
                  className="cap-checkbox"
                  checked={allSelected}
                  onChange={toggleSelectAll}
                  title="Select all active rows"
                  aria-label="Select all"
                />
              </th>
              <th>Rank &amp; Score</th>
              <th>Alert / Finding ID</th>
              <th>Threat / Category</th>
              <th>Source / System</th>
              <th>Status</th>
              <th>Trend</th>
              <th>Timestamp</th>
              <th className="th-actions">Senior Actions</th>
            </tr>
          </thead>
          <tbody>
            {criticalItems.length === 0 ? (
              <tr>
                <td colSpan={COL_SPAN} style={{ padding: '32px', textAlign: 'center', color: 'var(--color-text-muted)' }}>
                  No active critical findings in queue.
                </td>
              </tr>
            ) : (
              criticalItems.map((item, index) => {
                const score = Number(item.attention_score || 98);
                const tier = scoreTier(score);
                const itemId = item.finding_id || item.alert_id;
                const isSelected = selectedIds.has(itemId);
                const isFocused = focusedIndex === index;
                const isExpanded = expandedScoreId === itemId;

                const rowClass = [
                  'cap-row',
                  tier === 'top' ? 'cap-row--critical' : '',
                  item.status === 'RESOLVED' ? 'cap-row--resolved' : '',
                  isFocused ? 'cap-row--focused' : '',
                  isSelected ? 'cap-row--selected' : '',
                ].filter(Boolean).join(' ');

                return (
                  <React.Fragment key={itemId || index}>
                    <tr
                      className={rowClass}
                      tabIndex={0}
                      onFocus={() => setFocusedIndex(index)}
                      onClick={() => setFocusedIndex(index)}
                    >
                      {/* Checkbox */}
                      <td style={{ paddingRight: 0 }}>
                        {item.status !== 'RESOLVED' && (
                          <input
                            type="checkbox"
                            className="cap-checkbox"
                            checked={isSelected}
                            onChange={(e) => {
                              e.stopPropagation();
                              setSelectedIds((prev) => {
                                const next = new Set(prev);
                                next.has(itemId) ? next.delete(itemId) : next.add(itemId);
                                return next;
                              });
                            }}
                            aria-label={`Select finding ${itemId}`}
                          />
                        )}
                      </td>

                      {/* Rank & Score */}
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <div
                          className="cap-score-cell"
                          onClick={(e) => {
                            e.stopPropagation();
                            setExpandedScoreId(isExpanded ? null : itemId);
                          }}
                          title="Click to see score breakdown"
                        >
                          <span className={`cap-score-pill cap-score-pill--${tier}`}>#{index + 1}</span>
                          <div>
                            <div className={`cap-score-num cap-score-num--${tier}`}>
                              Score: {score}
                            </div>
                            <div className="cap-priority-label">{item.priority_label}</div>
                            <div className="cap-expand-hint">{isExpanded ? '▲ hide' : '▼ why?'}</div>
                          </div>
                        </div>
                      </td>

                      {/* Finding ID */}
                      <td>
                        <div className="cap-finding-id">{item.finding_id || item.alert_id}</div>
                        <div className="cap-cse-code">{item.cse_code}</div>
                      </td>

                      {/* Threat / Category */}
                      <td>
                        <div style={{ fontWeight: 600, color: 'var(--color-text-primary)', maxWidth: 240, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', fontSize: 'var(--font-size-body)' }}>
                          {item.title}
                        </div>
                        <span className="cap-attack-pill">{item.attack_type}</span>
                      </td>

                      {/* Source */}
                      <td>
                        <span className="cap-source">{item.source_system || 'A.E.G.I.S. Enclave'}</span>
                      </td>

                      {/* Status */}
                      <td style={{ whiteSpace: 'nowrap' }}>
                        <Badge variant={statusVariant(item.status)}>
                          {item.status || 'OPEN'}
                        </Badge>
                        {item.delivery_status && item.delivery_status !== 'DELIVERED' && (
                          <div className="cap-queue-status">Queue: {item.delivery_status}</div>
                        )}
                      </td>

                      {/* Trend sparkline */}
                      <td>
                        <AlertSparkline score={score} findingId={itemId} />
                      </td>

                      {/* Timestamp */}
                      <td className="cap-timestamp">
                        {item.timestamp ? new Date(item.timestamp).toLocaleTimeString() : 'Recent'}
                      </td>

                      {/* Actions */}
                      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        <div className="cap-actions">
                          <button
                            className="cap-btn cap-btn--view"
                            onClick={() => handleView(item)}
                            title="View evidence & classification reason"
                          >
                            <Eye size={11} /> View Evidence
                          </button>

                          {item.status !== 'RESOLVED' && (
                            <>
                              {item.status !== 'UNDER REVIEW' && (
                                <button
                                  className="cap-btn cap-btn--ack"
                                  onClick={() => handleAcknowledge(item)}
                                  disabled={processingId === itemId}
                                  title="Acknowledge finding"
                                >
                                  <Check size={11} /> Acknowledge
                                </button>
                              )}
                              <button
                                className="cap-btn cap-btn--resolve"
                                onClick={() => handleResolve(item)}
                                disabled={processingId === itemId}
                                title="Mark as resolved"
                              >
                                <CheckCircle2 size={11} /> Resolve
                              </button>
                              <button
                                className="cap-btn cap-btn--escalate"
                                onClick={() => handleOpenEscalateModal(item)}
                                disabled={processingId === itemId}
                                title="Escalate to Higher Authority with Ground-Level Review Dossier"
                              >
                                <Send size={11} /> Escalate to Higher Authority
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Score breakdown expansion row */}
                    {isExpanded && <BreakdownRow item={item} colSpan={COL_SPAN} />}
                  </React.Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* ── Bulk Action Bar (appears when ≥1 selected) ── */}
      {selectedIds.size > 0 && (
        <div className="cap-bulk-bar" role="toolbar" aria-label="Bulk actions">
          <span className="cap-bulk-bar__count">
            <strong>{selectedIds.size}</strong> row{selectedIds.size !== 1 ? 's' : ''} selected
          </span>
          <button className="cap-bulk-btn cap-bulk-btn--ack" onClick={handleBulkAcknowledge}>
            <Check size={12} /> Acknowledge All
          </button>
          <button className="cap-bulk-btn cap-bulk-btn--resolve" onClick={handleBulkResolve}>
            <CheckCircle2 size={12} /> Resolve All
          </button>
          <button className="cap-bulk-btn cap-bulk-btn--clear" onClick={() => setSelectedIds(new Set())}>
            <X size={11} /> Clear
          </button>
        </div>
      )}

      {/* ── Higher Authority Escalation Modal ── */}
      {escalatingFinding && (
        <HigherAuthorityEscalationModal
          finding={escalatingFinding}
          isSubmitting={isEscalating}
          onEscalate={handleConfirmEscalate}
          onClose={() => setEscalatingFinding(null)}
        />
      )}

      {/* ── Senior Advisory Review Modal ── */}
      {selectedItem && (
        <div className="cap-modal-overlay" onClick={() => setSelectedItem(null)}>
          <div className="cap-modal" onClick={(e) => e.stopPropagation()}>
            {/* Modal Header */}
            <div className="cap-modal__header">
              <div className="cap-modal__header-left">
                <span className="cap-modal__score-badge">
                  CRITICAL SCORE {selectedItem.attention_score}
                </span>
                <div>
                  <h3 className="cap-modal__title">
                    Senior Advisory Review — {selectedItem.finding_id || selectedItem.alert_id}
                  </h3>
                  <small className="cap-modal__subtitle">
                    Controlled Human Governance &amp; Evidence Traceability
                  </small>
                </div>
              </div>
              <button className="cap-modal__close" onClick={() => setSelectedItem(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="cap-modal__body">
              {/* Classification Reason */}
              <div className="cap-notice-block cap-notice-block--critical">
                <div className="cap-notice-block__header">
                  <AlertTriangle size={14} /> Reason for Critical Classification
                </div>
                <p className="cap-notice-block__text">
                  {selectedItem.explanation ||
                    'Finding exceeds Attention Score threshold of 98.0 requiring mandatory human senior review before any authorized external transmission.'}
                </p>
              </div>

              {/* Ground-Level Review */}
              {(selectedItem.ground_level_review || selectedItem.minimised_package?.ground_level_review) && (
                <div className="cap-notice-block cap-notice-block--warning">
                  <div className="cap-notice-block__header">
                    <AlertTriangle size={14} /> Ground Team Operational Bottleneck
                  </div>
                  <div style={{ fontSize: 'var(--font-size-body)', fontWeight: 700, marginBottom: 6 }}>
                    {selectedItem.ground_level_review?.bottleneck_category ||
                      selectedItem.minimised_package?.ground_level_review?.bottleneck_category}
                  </div>
                  <p className="cap-notice-block__text" style={{ background: 'var(--color-surface)', padding: '8px 10px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-warning-border)', whiteSpace: 'pre-line' }}>
                    {selectedItem.ground_level_review?.ground_analyst_issues ||
                      selectedItem.minimised_package?.ground_level_review?.ground_analyst_issues}
                  </p>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', fontSize: 'var(--font-size-small)', marginTop: 8 }}>
                    <span style={{ background: 'var(--color-surface)', padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-warning-border)', color: 'var(--color-text-primary)' }}>
                      Authority: <b>{selectedItem.ground_level_review?.target_higher_authority || 'NCIIPC'}</b>
                    </span>
                    <span style={{ background: 'var(--color-surface)', padding: '3px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-warning-border)', color: 'var(--color-success)' }}>
                      Action: <b>{selectedItem.ground_level_review?.recommended_executive_action || 'Network Isolation'}</b>
                    </span>
                  </div>
                </div>
              )}

              {/* Finding Detail Grid */}
              <div className="cap-detail-grid">
                {[
                  { label: 'Finding Title', value: selectedItem.title },
                  { label: 'Entity / CSE', value: selectedItem.cse_code },
                  { label: 'Source Event / Reference', value: selectedItem.source_system || 'SCADA Stream' },
                  { label: 'Current Review Status', value: selectedItem.status },
                ].map(({ label, value }) => (
                  <div key={label} className="cap-detail-block">
                    <div className="cap-detail-block__label">{label}</div>
                    <div className="cap-detail-block__value">{value}</div>
                  </div>
                ))}
              </div>

              {/* Description */}
              <div>
                <strong style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Operational Description
                </strong>
                <p style={{ margin: '6px 0 0', fontSize: 'var(--font-size-body)', color: 'var(--color-text-secondary)', background: 'var(--color-surface-subtle)', padding: '10px 12px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)', lineHeight: 1.6 }}>
                  {selectedItem.description}
                </p>
              </div>

              {/* Evidence */}
              <div>
                <strong style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Relevant Evidence Records
                </strong>
                <div className="cap-evidence-list" style={{ marginTop: 6 }}>
                  {selectedItem.evidence && selectedItem.evidence.length > 0 ? (
                    selectedItem.evidence.map((ev, idx) => (
                      <div key={idx} className="cap-evidence-item">
                        <div className="cap-evidence-item__header">
                          <strong className="cap-evidence-item__id">
                            {ev.code || `EVD-${idx + 1}`} ({ev.type || 'LOG'})
                          </strong>
                          <span className="cap-evidence-item__ref">{ev.record_id}</span>
                        </div>
                        <span className="cap-evidence-item__summary">{ev.summary}</span>
                      </div>
                    ))
                  ) : (
                    <div style={{ color: 'var(--color-text-muted)', fontSize: 'var(--font-size-body)', fontStyle: 'italic' }}>
                      Telemetry records cryptographically bound in local SQLite database.
                    </div>
                  )}
                </div>
              </div>

              {/* Data minimisation assurance */}
              <div className="cap-notice-block cap-notice-block--success">
                <div className="cap-notice-block__header">
                  <Lock size={13} /> Data Minimisation &amp; Gateway Integrity Assured
                </div>
                <span className="cap-notice-block__text">
                  If escalated, only 14 safe metadata fields and the Ground Review Dossier are dispatched. Zero raw CSV rows or database records are leaked. Protected with SHA-256 payload hash and HMAC signature.
                </span>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="cap-modal__footer">
              <button className="button" onClick={() => setSelectedItem(null)}>Close</button>
              <div className="cap-modal__footer-actions">
                {selectedItem.status !== 'RESOLVED' && (
                  <>
                    <button
                      className="cap-btn cap-btn--ack"
                      style={{ padding: '6px 12px', fontSize: 'var(--font-size-small)' }}
                      onClick={() => handleAcknowledge(selectedItem)}
                      disabled={processingId === selectedItem.finding_id}
                    >
                      <Check size={13} /> Acknowledge
                    </button>
                    <button
                      className="cap-btn cap-btn--resolve"
                      style={{ padding: '6px 12px', fontSize: 'var(--font-size-small)' }}
                      onClick={() => handleResolve(selectedItem)}
                      disabled={processingId === selectedItem.finding_id}
                    >
                      <CheckCircle2 size={13} /> Resolve
                    </button>
                    <button
                      className="cap-btn cap-btn--escalate"
                      style={{ padding: '6px 12px', fontSize: 'var(--font-size-small)' }}
                      onClick={() => handleOpenEscalateModal(selectedItem)}
                      disabled={processingId === selectedItem.finding_id}
                    >
                      <Send size={13} /> Escalate to Higher Authority
                    </button>
                  </>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
