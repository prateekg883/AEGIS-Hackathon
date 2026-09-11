import { useEffect, useState } from 'react';
import { useInvestigation } from '../state/InvestigationContext';
import { api } from '../services/api';
import { ArrowRight, CheckCircle2, XCircle, HelpCircle, FileText, AlertTriangle } from 'lucide-react';

const Badge = ({ children, type = 'neutral' }) => {
  const tone = (value = '') => String(value).toLowerCase().replaceAll(' ', '-');
  return <span className={`badge ${tone(type)}`}>{children}</span>;
};

export default function EvidenceInvestigationDrawer() {
  const { investigatingFindingId, closeInvestigation } = useInvestigation();
  const [finding, setFinding] = useState(null);
  const [loading, setLoading] = useState(false);
  const [records, setRecords] = useState({ alert: null, caseRec: null, investigation: null, escalation: null });

  useEffect(() => {
    if (!investigatingFindingId) {
      setFinding(null);
      return;
    }

    let active = true;
    setLoading(true);

    const fetchDetails = async () => {
      try {
        const [detail, explanationPayload, allAlerts, allCases, allInvestigations, allEscalations] = await Promise.all([
          api.getFindingById(investigatingFindingId),
          api.getFindingExplanation(investigatingFindingId),
          api.getAlerts(),
          api.getCases(),
          api.getInvestigations(),
          api.getEscalations(),
        ]);

        if (!active) return;

        const backendExp = explanationPayload && explanationPayload.explanation ? explanationPayload : null;
        const enrichedFinding = {
          ...detail,
          explanation: backendExp ? (backendExp.reason || backendExp.explanation?.interpretation || detail.explanation) : detail.explanation,
          expected: backendExp ? (backendExp.expected_value || detail.expected) : detail.expected,
          observed: backendExp ? (backendExp.explanation?.fact || detail.observed) : detail.observed,
          impact: backendExp ? (backendExp.manual_verification_guidance?.join(' ') || detail.impact) : detail.impact,
          rule: backendExp ? (backendExp.rule_code || detail.rule) : detail.rule,
        };

        setFinding(enrichedFinding);

        const alertId = enrichedFinding.alertIds?.[0];
        const caseId = enrichedFinding.caseIds?.[0];
        const investigationId = enrichedFinding.investigationIds?.[0];
        const escalationId = enrichedFinding.escalationIds?.[0];

        setRecords({
          alert: allAlerts.find(a => a.id === alertId) || null,
          caseRec: allCases.find(c => c.id === caseId) || null,
          investigation: allInvestigations.find(i => i.id === investigationId) || null,
          escalation: allEscalations.find(e => e.id === escalationId) || null,
        });

      } catch (err) {
        console.error("Error loading investigation details:", err);
      } finally {
        if (active) setLoading(false);
      }
    };

    fetchDetails();

    return () => { active = false; };
  }, [investigatingFindingId]);

  // Handle Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        closeInvestigation();
      }
    };
    if (investigatingFindingId) {
      document.addEventListener('keydown', handleKeyDown);
    }
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [investigatingFindingId, closeInvestigation]);

  if (!investigatingFindingId) return null;

  const renderChainNode = (label, id, record) => {
    const isFound = !!record;
    return (
      <div className={!isFound ? "gap" : ""}>
        <span>{label}</span>
        <b>{id || 'No Reference'}</b>
        <small style={{ display: 'flex', alignItems: 'center', gap: '4px', justifyContent: 'center' }}>
          {isFound ? <CheckCircle2 size={12} color="#16a34a" /> : (!id ? <HelpCircle size={12} color="#94a3b8" /> : <XCircle size={12} color="#dc2626" />)}
          {isFound ? 'Found' : (!id ? 'Not Available' : 'Missing')}
        </small>
      </div>
    );
  };

  return (
    <div className="drawer-backdrop" onClick={closeInvestigation} style={{ zIndex: 100 }}>
      <div 
        className="drawer" 
        onClick={(e) => e.stopPropagation()} 
        style={{ width: '600px', overflowY: 'auto' }}
      >
        <button className="drawer-close" onClick={closeInvestigation}>X</button>
        
        {loading || !finding ? (
          <div style={{ padding: '40px 0', textAlign: 'center', color: '#64748b' }}>Loading investigation details...</div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
            {/* HEADER */}
            <div>
              <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', gap: '6px', color: finding.severity.toUpperCase() === 'CRITICAL' ? '#dc2626' : '#d97706' }}>
                <span className={`signal ${finding.severity.toLowerCase()}`}></span>
                {finding.severity.toUpperCase()} FINDING
              </div>
              <h2 style={{ fontSize: '22px', marginBottom: '12px' }}>{finding.title}</h2>
              <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                <Badge type={finding.severity}>{finding.severity}</Badge>
                <Badge type={finding.status}>{finding.status}</Badge>
                <span style={{ fontSize: '11px', color: '#64748b' }}>ID: {finding.id}</span>
                <span style={{ fontSize: '11px', color: '#64748b' }}>CSE: {finding.cse}</span>
              </div>
            </div>

            {/* WHY IS THIS FLAGGED? */}
            <div className="card" style={{ padding: '20px' }}>
              <div className="section-title">
                <div>
                  <div className="eyebrow">DIAGNOSTIC CONTEXT</div>
                  <h2 style={{ fontSize: '13px' }}>Why is this flagged?</h2>
                </div>
              </div>
              <div className="trace" style={{ marginTop: '0', paddingTop: '0', borderTop: 'none', gap: '16px' }}>
                <div>
                  <span style={{ minWidth: '120px' }}>Trigger Condition</span>
                  <b style={{ textAlign: 'left', flex: 1, color: '#1e293b' }}>{finding.rule || 'Supervisory rule matched'}</b>
                </div>
                <div>
                  <span style={{ minWidth: '120px' }}>Expected Behaviour</span>
                  <b style={{ textAlign: 'left', flex: 1, color: '#475569', fontWeight: 'normal' }}>{finding.expected}</b>
                </div>
                <div>
                  <span style={{ minWidth: '120px' }}>Observed Evidence</span>
                  <b style={{ textAlign: 'left', flex: 1, color: '#dc2626', fontWeight: 'normal' }}>{finding.observed}</b>
                </div>
              </div>
            </div>

            {/* EVIDENCE CHAIN */}
            <div className="card" style={{ padding: '20px' }}>
              <div className="section-title">
                <div>
                  <div className="eyebrow">TRACEABILITY</div>
                  <h2 style={{ fontSize: '13px' }}>Evidence Chain</h2>
                </div>
              </div>
              <div className="signal-flow" style={{ background: 'transparent', margin: '15px 0 0 0', padding: 0 }}>
                {renderChainNode('Alert', finding.alertIds?.[0], records.alert)}
                <ArrowRight size={14} color="#cbd5e1" />
                {renderChainNode('Case', finding.caseIds?.[0], records.caseRec)}
                <ArrowRight size={14} color="#cbd5e1" />
                {renderChainNode('Investigation', finding.investigationIds?.[0], records.investigation)}
                <ArrowRight size={14} color="#cbd5e1" />
                {renderChainNode('Escalation', finding.escalationIds?.[0], records.escalation)}
              </div>
            </div>

            {/* FACT VS INTERPRETATION */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
              <div className="prose-block" style={{ borderTop: 'none', padding: '16px', background: '#f8fafc', borderRadius: '8px', border: '1px solid #e2e8f0' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#1e3a5f' }}><FileText size={12} /> Fact</h3>
                <ul style={{ margin: '8px 0 0', paddingLeft: '16px', fontSize: '11px', color: '#475569', display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {records.alert && <li>Alert severity: {records.alert.severity}</li>}
                  {records.alert && <li>Alert closed: {records.alert.closed || 'N/A'}</li>}
                  {records.caseRec && <li>Case status: {records.caseRec.status}</li>}
                  {records.investigation && <li>Investigation status: {records.investigation.status}</li>}
                  <li>Escalation evidence: {records.escalation ? 'Present' : 'Not Found'}</li>
                </ul>
              </div>
              <div className="prose-block" style={{ borderTop: 'none', padding: '16px', background: '#fffbeb', borderRadius: '8px', border: '1px solid #fde68a' }}>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '6px', color: '#d97706' }}><AlertTriangle size={12} /> Interpretation</h3>
                <p style={{ fontSize: '11px', lineHeight: '1.6', marginTop: '8px', color: '#475569' }}>
                  {finding.impact || "Observed behaviour appears inconsistent with the expected supervisory process."}
                </p>
                {!finding.impact && !records.escalation && (
                  <p style={{ fontSize: '11px', lineHeight: '1.6', marginTop: '8px', color: '#475569' }}>
                    Escalation evidence could not be verified from the available records.
                  </p>
                )}
              </div>
            </div>

            {/* MANUAL VERIFICATION */}
            <div className="callout" style={{ marginTop: 'auto', background: '#fff9ed', borderColor: '#eadcbf', flexDirection: 'column', alignItems: 'flex-start', padding: '20px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '8px' }}>
                <AlertTriangle size={16} color="#d97706" />
                <b style={{ color: '#92400e', fontSize: '12px', margin: 0 }}>Manual verification required</b>
              </div>
              <p style={{ color: '#78350f', marginBottom: '16px', fontSize: '12px' }}>
                Verify the missing or inconsistent evidence with the relevant CSE/SOC records. The system requires human judgement to document a definitive compliance conclusion.
              </p>
              <div style={{ display: 'flex', gap: '10px' }}>
                <button className="button ghost" onClick={() => window.location.href = '/evidence'} style={{ fontSize: '11px', color: '#1e3a5f', borderColor: '#1e3a5f' }}>
                  View Raw Evidence
                </button>
                <button className="button primary" onClick={closeInvestigation} style={{ fontSize: '11px' }}>
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
