import { useEffect, useState } from 'react';
import { useInvestigation } from '../state/InvestigationContext';
import { api } from '../services/api';
import { ArrowRight, CheckCircle2, XCircle, HelpCircle, FileText, AlertTriangle } from 'lucide-react';
import Badge from './common/Badge';

export default function EvidenceInvestigationDrawer() {
  const { investigatingFindingId, closeInvestigation } = useInvestigation();
  const [finding,  setFinding]  = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [records,  setRecords]  = useState({ alert: null, caseRec: null, investigation: null, escalation: null });

  useEffect(() => {
    if (!investigatingFindingId) { setFinding(null); return; }

    let active = true;
    setLoading(true);

    const fetchDetails = async () => {
      try {
        const [detail, explanationPayload, allAlerts, allCases, allInvestigations, allEscalations] =
          await Promise.all([
            api.getFindingById(investigatingFindingId),
            api.getFindingExplanation(investigatingFindingId),
            api.getAlerts(),
            api.getCases(),
            api.getInvestigations(),
            api.getEscalations(),
          ]);

        if (!active) return;

        const backendExp = explanationPayload?.explanation ? explanationPayload : null;
        const enrichedFinding = {
          ...detail,
          explanation: backendExp ? (backendExp.reason || backendExp.explanation?.interpretation || detail.explanation) : detail.explanation,
          expected:    backendExp ? (backendExp.expected_value || detail.expected) : detail.expected,
          observed:    backendExp ? (backendExp.explanation?.fact || detail.observed) : detail.observed,
          impact:      backendExp ? (backendExp.manual_verification_guidance?.join(' ') || detail.impact) : detail.impact,
          rule:        backendExp ? (backendExp.rule_code || detail.rule) : detail.rule,
        };

        setFinding(enrichedFinding);

        setRecords({
          alert:         allAlerts.find(a => a.id === enrichedFinding.alertIds?.[0])         || null,
          caseRec:       allCases.find(c => c.id === enrichedFinding.caseIds?.[0])           || null,
          investigation: allInvestigations.find(i => i.id === enrichedFinding.investigationIds?.[0]) || null,
          escalation:    allEscalations.find(e => e.id === enrichedFinding.escalationIds?.[0]) || null,
        });
      } catch (err) {
        console.error('Error loading investigation details:', err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchDetails();
    return () => { active = false; };
  }, [investigatingFindingId]);

  useEffect(() => {
    const onKeyDown = (e) => { if (e.key === 'Escape') closeInvestigation(); };
    if (investigatingFindingId) document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [investigatingFindingId, closeInvestigation]);

  if (!investigatingFindingId) return null;

  const sevIsCritical = finding && String(finding.severity).toLowerCase() === 'critical';

  const renderChainNode = (label, id, record) => {
    const isFound = !!record;
    return (
      <div className={!isFound ? 'gap' : ''}>
        <span>{label}</span>
        <b>{id || 'No Reference'}</b>
        <small style={{ display: 'flex', alignItems: 'center', gap: 4, justifyContent: 'center' }}>
          {isFound
            ? <CheckCircle2 size={12} style={{ color: 'var(--color-success)' }} />
            : (!id ? <HelpCircle size={12} style={{ color: 'var(--color-text-muted)' }} />
                   : <XCircle size={12} style={{ color: 'var(--color-critical)' }} />)
          }
          {isFound ? 'Found' : (!id ? 'Not Available' : 'Missing')}
        </small>
      </div>
    );
  };

  return (
    <div className="drawer-backdrop" onClick={closeInvestigation} style={{ zIndex: 100 }}>
      <div className="drawer" onClick={(e) => e.stopPropagation()} style={{ width: 600, overflowY: 'auto' }}>
        <button className="drawer-close" onClick={closeInvestigation}>×</button>

        {loading || !finding ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: 'var(--color-text-muted)', fontSize: 'var(--font-size-body)' }}>
            Loading investigation details…
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>

            {/* Header */}
            <div>
              <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: 6, color: sevIsCritical ? 'var(--color-critical)' : 'var(--color-warning)', marginBottom: 6 }}>
                <span className={`signal ${finding.severity.toLowerCase()}`} />
                {finding.severity.toUpperCase()} FINDING
              </div>
              <h2 style={{ fontSize: 'var(--font-size-2xl)', marginBottom: 12 }}>{finding.title}</h2>
              <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                <Badge variant={finding.severity.toLowerCase()}>{finding.severity}</Badge>
                <Badge variant={String(finding.status).toLowerCase().replace(/\s+/g, '-')}>{finding.status}</Badge>
                <span style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)' }}>ID: {finding.id}</span>
                <span style={{ fontSize: 'var(--font-size-small)', color: 'var(--color-text-muted)' }}>CSE: {finding.cse}</span>
              </div>
            </div>

            {/* Why flagged */}
            <div className="card" style={{ padding: 20 }}>
              <div className="section-title">
                <div>
                  <div className="eyebrow">DIAGNOSTIC CONTEXT</div>
                  <h2 style={{ fontSize: 'var(--font-size-h4)' }}>Why is this flagged?</h2>
                </div>
              </div>
              <div className="trace" style={{ marginTop: 0, paddingTop: 0, borderTop: 'none', gap: 16 }}>
                <div>
                  <span style={{ minWidth: 120, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-small)' }}>Trigger Condition</span>
                  <b style={{ textAlign: 'left', flex: 1, color: 'var(--color-text-primary)', fontWeight: 600 }}>{finding.rule || 'Supervisory rule matched'}</b>
                </div>
                <div>
                  <span style={{ minWidth: 120, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-small)' }}>Expected Behaviour</span>
                  <b style={{ textAlign: 'left', flex: 1, color: 'var(--color-text-secondary)', fontWeight: 400 }}>{finding.expected}</b>
                </div>
                <div>
                  <span style={{ minWidth: 120, color: 'var(--color-text-muted)', fontSize: 'var(--font-size-small)' }}>Observed Evidence</span>
                  <b style={{ textAlign: 'left', flex: 1, color: 'var(--color-critical)', fontWeight: 400 }}>{finding.observed}</b>
                </div>
              </div>
            </div>

            {/* Evidence chain */}
            <div className="card" style={{ padding: 20 }}>
              <div className="section-title">
                <div>
                  <div className="eyebrow">TRACEABILITY</div>
                  <h2 style={{ fontSize: 'var(--font-size-h4)' }}>Evidence Chain</h2>
                </div>
              </div>
              <div className="signal-flow" style={{ background: 'transparent', margin: '15px 0 0', padding: 0 }}>
                {renderChainNode('Alert',         finding.alertIds?.[0],         records.alert)}
                <ArrowRight size={14} style={{ color: 'var(--color-border)' }} />
                {renderChainNode('Case',          finding.caseIds?.[0],          records.caseRec)}
                <ArrowRight size={14} style={{ color: 'var(--color-border)' }} />
                {renderChainNode('Investigation', finding.investigationIds?.[0], records.investigation)}
                <ArrowRight size={14} style={{ color: 'var(--color-border)' }} />
                {renderChainNode('Escalation',   finding.escalationIds?.[0],    records.escalation)}
              </div>
            </div>

            {/* Fact / Interpretation */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
              <div style={{ padding: 16, background: 'var(--color-surface-subtle)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-border)' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-navy)', fontSize: 'var(--font-size-small)', margin: '0 0 8px' }}>
                  <FileText size={12} /> Fact
                </h3>
                <ul style={{ margin: 0, paddingLeft: 16, fontSize: 'var(--font-size-small)', color: 'var(--color-text-secondary)', display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {records.alert       && <li>Alert severity: {records.alert.severity}</li>}
                  {records.alert       && <li>Alert closed: {records.alert.closed || 'N/A'}</li>}
                  {records.caseRec     && <li>Case status: {records.caseRec.status}</li>}
                  {records.investigation && <li>Investigation status: {records.investigation.status}</li>}
                  <li>Escalation evidence: {records.escalation ? 'Present' : 'Not Found'}</li>
                </ul>
              </div>
              <div style={{ padding: 16, background: 'var(--color-warning-bg)', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-warning-border)' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: 6, color: 'var(--color-warning)', fontSize: 'var(--font-size-small)', margin: '0 0 8px' }}>
                  <AlertTriangle size={12} /> Interpretation
                </h3>
                <p style={{ fontSize: 'var(--font-size-small)', lineHeight: 'var(--line-height-loose)', margin: '8px 0 0', color: 'var(--color-text-secondary)' }}>
                  {finding.impact || 'Observed behaviour appears inconsistent with the expected supervisory process.'}
                </p>
                {!finding.impact && !records.escalation && (
                  <p style={{ fontSize: 'var(--font-size-small)', lineHeight: 'var(--line-height-loose)', marginTop: 8, color: 'var(--color-text-muted)' }}>
                    Escalation evidence could not be verified from the available records.
                  </p>
                )}
              </div>
            </div>

            {/* Manual verification callout */}
            <div className="callout" style={{ flexDirection: 'column', alignItems: 'flex-start', padding: 20 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 8 }}>
                <AlertTriangle size={16} style={{ color: 'var(--color-warning)', flexShrink: 0 }} />
                <b style={{ color: 'var(--color-text-heading)', fontSize: 'var(--font-size-body)', margin: 0 }}>Manual verification required</b>
              </div>
              <p style={{ color: 'var(--color-text-secondary)', marginBottom: 16, fontSize: 'var(--font-size-body)' }}>
                Verify the missing or inconsistent evidence with the relevant CSE/SOC records. The system requires human judgement to document a definitive compliance conclusion.
              </p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="button ghost" onClick={() => window.location.href = '/evidence'} style={{ fontSize: 'var(--font-size-small)' }}>
                  View Raw Evidence
                </button>
                <button className="button primary" onClick={closeInvestigation} style={{ fontSize: 'var(--font-size-small)' }}>
                  Mark Reviewed
                </button>
              </div>
            </div>

          </div>
        )}
      </div>
    </div>
  );
}
