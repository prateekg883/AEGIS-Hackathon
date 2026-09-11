import { createContext, useContext, useState, useEffect } from 'react';
import {
  alerts as initialAlerts,
  cases as initialCases,
  investigations as initialInvestigations,
  escalations as initialEscalations,
  findings as initialFindings,
  cseEntities as initialCseEntities,
  evidence as initialEvidence,
  assets as initialAssets
} from '../data/mockDataV2';

const SOCContext = createContext();

// Helper function to compute balanced breakdown scores whose sum EXACTLY equals total score
export function calculateAttentionBreakdown(totalScore) {
  const s = Math.max(0, Math.round(Number(totalScore) || 0));
  if (s === 0) {
    return { execution_gap_score: 0, negative_space_score: 0, peer_deviation_score: 0, anomaly_score: 0 };
  }
  // AEGIS weight distribution: Execution Gap ~39%, Negative Space ~29%, Peer Deviation ~18%, Anomaly ~14%
  const exec = Math.round(s * 0.39);
  const neg = Math.round(s * 0.29);
  const peer = Math.round(s * 0.18);
  const anomaly = Math.max(0, s - (exec + neg + peer));
  return {
    execution_gap_score: exec,
    negative_space_score: neg,
    peer_deviation_score: peer,
    anomaly_score: anomaly
  };
}

export function SOCProvider({ children }) {
  const [alerts, setAlerts] = useState([]);
  const [cases, setCases] = useState([]);
  const [investigations, setInvestigations] = useState([]);
  const [escalations, setEscalations] = useState([]);
  const [findings, setFindings] = useState([]);
  const [evidence, setEvidence] = useState([]);
  const [assets, setAssets] = useState([]);
  const [cseEntities, setCseEntities] = useState([]);
  const [isDemoMode, setIsDemoMode] = useState(true);
  const [activeFileName, setActiveFileName] = useState('');

  // Initialize data
  const loadScenario = () => {
    setAlerts(JSON.parse(JSON.stringify(initialAlerts)));
    setCases(JSON.parse(JSON.stringify(initialCases)));
    setInvestigations(JSON.parse(JSON.stringify(initialInvestigations)));
    setEscalations(JSON.parse(JSON.stringify(initialEscalations)));
    setFindings(JSON.parse(JSON.stringify(initialFindings)));
    setEvidence(JSON.parse(JSON.stringify(initialEvidence)));
    setAssets(JSON.parse(JSON.stringify(initialAssets)));
    setCseEntities(JSON.parse(JSON.stringify(initialCseEntities)));
    setIsDemoMode(true);
    setActiveFileName('');
  };

  useEffect(() => {
    loadScenario();
  }, []);

  const resetDemoScenario = () => {
    loadScenario();
  };

  // Actions
  const updateAlertStatus = (alertId, newStatus) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: newStatus } : a));
  };

  const updateCaseStatus = (caseId, newStatus, resolution = null) => {
    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        const updated = { ...c, status: newStatus };
        if (resolution) {
          updated.closureReason = resolution;
          updated.closed = new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
        }
        return updated;
      }
      return c;
    }));
  };

  const addCaseNote = (caseId, note) => {
    setCases(prev => prev.map(c => {
      if (c.id === caseId) {
        const notes = c.notes ? [...c.notes, note] : [note];
        return { ...c, notes };
      }
      return c;
    }));
  };

  const escalateAlert = (alertId) => {
    const alert = alerts.find(a => a.id === alertId);
    if (!alert) return;

    const newCaseId = `CASE-${Math.floor(Math.random() * 1000) + 300}`;
    const newEscId = `ESC-${Math.floor(Math.random() * 1000) + 200}`;
    
    // Create Case
    const newCase = {
      id: newCaseId,
      cse: alert.cse,
      alertIds: [alert.id],
      severity: alert.severity,
      opened: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      closed: null,
      status: 'Open',
      investigationId: null,
      escalationId: newEscId,
      analyst: 'Current User',
      closureReason: null,
      notes: []
    };

    // Create Escalation
    const newEscalation = {
      id: newEscId,
      caseId: newCaseId,
      alertId: alert.id,
      cse: alert.cse,
      level: 'L2',
      status: 'Open',
      reason: 'Manual escalation from Analyst Workspace',
      created: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
      owner: 'Duty supervisor'
    };

    setCases(prev => [newCase, ...prev]);
    setEscalations(prev => [newEscalation, ...prev]);
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, caseId: newCaseId, escalationId: newEscId, status: 'Escalated' } : a));
  };

  const resolveIncident = (alertId) => {
    setAlerts(prev => prev.map(a => a.id === alertId ? { ...a, status: 'Resolved' } : a));
    const alert = alerts.find(a => a.id === alertId);
    if (alert && alert.caseId) {
      setCases(prev => prev.map(c => {
        if (c.id === alert.caseId) {
          return {
            ...c,
            status: 'Resolved',
            closureReason: 'Resolved by senior supervisor',
            closed: new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
          };
        }
        return c;
      }));
    }
    setFindings(prev => prev.map(f => {
      if ((f.alertIds && f.alertIds.includes(alertId)) || f.id === alertId) {
        return { ...f, status: 'Resolved' };
      }
      return f;
    }));
  };

  const updateFindingStatus = (findingId, newStatus) => {
    setFindings(prev => prev.map(f => f.id === findingId ? { ...f, status: newStatus } : f));
  };

  // Derived Data
  const activeAlerts = alerts.filter(a => a.status !== 'Closed' && a.status !== 'Resolved');
  const resolvedIncidents = cases.filter(c => c.status === 'Closed' || c.status === 'Resolved');
  
  // Cohort Attention Score Calculation based on proportional severity distribution
  const calculateCohortAttentionScore = () => {
    if (!activeAlerts || activeAlerts.length === 0) return 48;

    const total = activeAlerts.length;
    const criticals = activeAlerts.filter(a => String(a.severity).toLowerCase() === 'critical').length;
    const highs = activeAlerts.filter(a => String(a.severity).toLowerCase() === 'high').length;
    const mediums = activeAlerts.filter(a => String(a.severity).toLowerCase() === 'medium').length;
    const lows = activeAlerts.filter(a => {
      const s = String(a.severity).toLowerCase();
      return s === 'low' || s === 'informational' || s === 'info';
    }).length;

    // Proportional weighted score (0-100) based on severity ratio
    const weightedRatio = ((criticals * 100) + (highs * 75) + (mediums * 45) + (lows * 20)) / total;
    
    // Slight adjustment for unresolved cases ratio
    const openCasesRatio = cases.length > 0 ? (cases.filter(c => c.status !== 'Closed').length / cases.length) : 0.5;
    const finalScore = Math.round((weightedRatio * 0.85) + (openCasesRatio * 15));

    return Math.min(100, Math.max(15, finalScore));
  };

  const cohortAttentionScore = calculateCohortAttentionScore();

  // Helper function to flexibly match and extract row fields by various key synonyms
  const getRowField = (row, candidateKeys) => {
    if (!row || typeof row !== 'object') return '';
    const normKeys = Object.keys(row).map(k => ({
      original: k,
      normalized: k.trim().toLowerCase().replace(/[-_ ]/g, '')
    }));

    for (const candidate of candidateKeys) {
      const normCand = candidate.toLowerCase().replace(/[-_ ]/g, '');
      const match = normKeys.find(k => k.normalized === normCand || k.normalized.includes(normCand));
      if (match && row[match.original] !== undefined && String(row[match.original]).trim() !== '') {
        return String(row[match.original]).trim();
      }
    }
    return '';
  };

  const loadUploadedCSV = (records, filename = 'uploaded.csv') => {
    if (!records || !Array.isArray(records) || records.length === 0) return;

    setIsDemoMode(false);
    setActiveFileName(filename);

    // Map uploaded rows to active SOC alerts/records
    const newAlerts = records.map((r, idx) => {
      const id = getRowField(r, ['record_id', 'alert_code', 'alert_id', 'id', 'case_code', 'incident_id', 'event_id', 'ticket_id']) || `ALT-LIVE-${1000 + idx}`;
      
      const rawCse = getRowField(r, ['cse_code', 'cse_id', 'cse', 'entity_code', 'entity_id', 'entity', 'critical_entity', 'org_code', 'organization_id', 'company_code', 'system_id']);
      const rawCseName = getRowField(r, ['company_name', 'cs1', 'facilityzone', 'facility_zone', 'sensor_location', 'device_vendor', 'vendor', 'cse_name', 'entity_name', 'organization', 'org', 'company', 'agency', 'enterprise', 'system_name', 'system']);
      const rawSector = getRowField(r, ['sector', 'industry', 'critical_sector', 'domain', 'vertical', 'department']);
      
      const asset = getRowField(r, ['destinationhost', 'target_host', 'targethost', 'dstaddress', 'destinationip', 'destination_ip', 'destination', 'asset_code', 'asset', 'host', 'target', 'node', 'dhost', 'dst', 'source_ip', 'src_ip', 'ip']) || `192.168.1.${100 + (idx * 5)}`;
      
      let cse = rawCse;
      let cseName = rawCseName;
      let sector = rawSector;

      // If no explicit CSE column is present, infer CSE from destination/asset/host
      if (!cse) {
        const assetUpper = String(asset).toUpperCase();
        if (assetUpper.startsWith('EN-') || assetUpper.includes('SCADA') || assetUpper.includes('HIST') || assetUpper.includes('ENERGY') || assetUpper.includes('GRID')) {
          cse = 'CSE-07';
          if (!cseName) cseName = 'Power Grid Operations';
          if (!sector) sector = 'Power & Energy';
        } else if (assetUpper.startsWith('TR-') || assetUpper.includes('TRANS') || assetUpper.includes('RAIL') || assetUpper.includes('TRAFFIC')) {
          cse = 'CSE-08';
          if (!cseName) cseName = 'Transmission Operations';
          if (!sector) sector = 'Power & Energy';
        } else if (assetUpper.startsWith('PL-') || assetUpper.startsWith('IC-') || assetUpper.includes('PLC') || assetUpper.includes('CONTROL') || assetUpper.includes('MANUF')) {
          cse = 'CSE-09';
          if (!cseName) cseName = 'Grid Monitoring & Control';
          if (!sector) sector = 'Power & Energy';
        } else if (assetUpper.startsWith('FIN-') || assetUpper.includes('172.16.5') || assetUpper.includes('BANK') || assetUpper.includes('DISTRIB')) {
          cse = 'CSE-02';
          if (!cseName) cseName = 'Northern Power Distribution';
          if (!sector) sector = 'Power & Energy';
        } else if (assetUpper.startsWith('TEL-') || assetUpper.includes('10.0.1') || assetUpper.includes('ARCHIVE') || assetUpper.includes('COMM')) {
          cse = 'CSE-10';
          if (!cseName) cseName = 'Historian & Distribution Archive';
          if (!sector) sector = 'Power & Energy';
        } else if (rawCseName) {
          cse = rawCseName.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 8);
        } else {
          // Deterministically distribute across the 4 core CSE cohort entities based on IP/asset hash
          const hashVal = Math.abs(String(asset).split('').reduce((acc, c) => acc + c.charCodeAt(0), 0) + idx);
          const cohort = [
            { id: 'CSE-07', name: 'Power Grid Operations', sector: 'Power & Energy' },
            { id: 'CSE-08', name: 'Transmission Operations', sector: 'Power & Energy' },
            { id: 'CSE-09', name: 'Grid Monitoring & Control', sector: 'Power & Energy' },
            { id: 'CSE-10', name: 'Historian & Distribution Archive', sector: 'Power & Energy' }
          ];
          const assigned = cohort[hashVal % cohort.length];
          cse = assigned.id;
          if (!cseName) cseName = assigned.name;
          if (!sector) sector = assigned.sector;
        }
      }

      // Severity normalization
      const rawSev = getRowField(r, ['triage_priority', 'triagepriority', 'priority', 'severity', 'severity_level', 'threat_level', 'raw_severity', 'sev', 'criticality', 'level', 'impact']);
      let severity = 'Medium';
      if (rawSev) {
        const sLower = String(rawSev).toLowerCase();
        if (sLower.includes('crit') || sLower === '9' || sLower === '10') severity = 'Critical';
        else if (sLower.includes('high') || sLower === '7' || sLower === '8') severity = 'High';
        else if (sLower.includes('med') || sLower === '4' || sLower === '5' || sLower === '6') severity = 'Medium';
        else if (sLower.includes('low') || sLower === '1' || sLower === '2' || sLower === '3') severity = 'Low';
        else if (sLower.includes('none') || sLower.includes('benign') || sLower.includes('info') || sLower === '0') severity = 'Low';
      } else {
        severity = idx % 5 === 0 ? 'Critical' : idx % 3 === 0 ? 'High' : idx % 2 === 0 ? 'Medium' : 'Low';
      }

      const type = getRowField(r, ['threat_type', 'threat_name', 'signature', 'alertname', 'alert_name', 'attack_type', 'deviceeventclassid', 'title', 'category', 'cat', 'event_type', 'alert_type', 'type', 'asset_type']) || 'Security Telemetry Event';
      const created = getRowField(r, ['eventtime', 'event_time', 'time_generated', 'timegenerated', 'timestamp', 'created_time', 'opened_time', 'time', 'date', 'created_at', 'datetime']) || new Date().toISOString();
      const status = getRowField(r, ['status', 'state', 'disposition']) ? (String(getRowField(r, ['status', 'state', 'disposition'])).charAt(0).toUpperCase() + String(getRowField(r, ['status', 'state', 'disposition'])).slice(1).toLowerCase()) : 'Open';
      const message = getRowField(r, ['msg', 'message', 'description', 'name', 'details', 'log_message', 'summary']) || `${type} detected on target ${asset}`;
      
      const src_ip = getRowField(r, ['sourceipaddress', 'sourceaddress', 'source_address', 'sourceip', 'srcaddress', 'src_ip', 'source_ip', 'src', 'source', 'client_ip', 'clientip', 'attacker_ip', 'origin_ip']) || '10.0.1.15';
      const dst_port = getRowField(r, ['targetport', 'target_port', 'destinationport', 'destination_port', 'dst_port', 'destport', 'dest_port', 'dport', 'dstport', 'port', 'rport']) || '443';
      const protocol = getRowField(r, ['networkprotocol', 'network_protocol', 'protocol', 'proto', 'service', 'transport', 'app']) || 'TCP';

      return {
        id,
        cse,
        rawCseName: cseName,
        rawSector: sector,
        severity,
        type,
        created: typeof created === 'string' ? created.replace('T', ' ').substring(0, 19) : String(created),
        caseId: `CASE-LIVE-${300 + idx}`,
        status,
        asset,
        message,
        src_ip,
        dst_port,
        protocol,
        rawRow: r
      };
    });

    // Create live corresponding cases
    const newCases = newAlerts.map((a, idx) => ({
      id: a.caseId,
      cse: a.cse,
      alertIds: [a.id],
      severity: a.severity,
      opened: a.created,
      closed: a.status === 'Closed' ? a.created : null,
      status: a.status,
      investigationId: `INV-LIVE-${700 + idx}`,
      escalationId: `ESC-LIVE-${100 + idx}`,
      analyst: idx % 2 === 0 ? 'A. Sharma' : 'R. Iyer',
      closureReason: a.status === 'Closed' ? 'Resolved without supervisor sign-off' : null,
      notes: [`Ingested live from file: ${filename}. Telemetry: ${a.message}`]
    }));

    // Filter actionable critical/high alerts for live supervisory findings across entities
    const criticalAlerts = newAlerts.filter(a => a.severity === 'Critical' || a.severity === 'High');
    const findingSources = criticalAlerts.length > 0 ? criticalAlerts.slice(0, 12) : newAlerts.slice(0, 12);

    const newFindings = findingSources.map((a, idx) => {
      const isCritical = a.severity === 'Critical' || a.severity === 'High';
      const cat = idx % 3 === 0 ? 'Execution Gap' : idx % 3 === 1 ? 'Negative Space' : 'Operational Anomaly';
      return {
        id: `FND-LIVE-${idx + 1}`,
        cse: a.cse,
        title: isCritical 
          ? `${a.severity} Gap: Unescalated ${a.type} on ${a.asset}`
          : `Operational Anomaly: Deviation on ${a.asset}`,
        category: cat,
        severity: a.severity,
        status: 'Open',
        detectedDate: a.created,
        evidenceCount: 1,
        explanation: `Supervisory engine analyzed telemetry from ${filename}. Observed ${a.type} on node ${a.asset} (${a.cse}) requiring mandatory human review.`,
        expected: 'Mandatory escalation and supervisor sign-off within 30-minute SLA window',
        observed: `${a.type} status is ${a.status} without corresponding Tier-2 escalation audit entry`,
        impact: 'Supervisory review recommended under NCIIPC Critical Sector Guidelines',
        alertIds: [a.id],
        caseIds: [a.caseId],
        rule: `RULE-LIVE-GAP-0${idx + 1}`
      };
    });

    // Create live supporting evidence
    const newEvidence = newAlerts.slice(0, 50).map((a, idx) => ({
      id: `EVD-LIVE-${500 + idx}`,
      findingId: newFindings[idx % newFindings.length]?.id || 'FND-LIVE-1',
      recordType: 'SECURITY_LOG',
      recordId: a.id,
      cse: a.cse,
      timestamp: a.created,
      summary: `Uploaded ${filename} row #${idx + 1}: ${a.type} on ${a.asset} (${a.cse} - Severity: ${a.severity})`
    }));

    // Create live assets for negative space
    const uniqueAssetsMap = new Map();
    newAlerts.forEach(a => {
      if (!uniqueAssetsMap.has(a.asset)) {
        uniqueAssetsMap.set(a.asset, {
          id: a.asset,
          cse: a.cse,
          name: `${a.asset} Substation Node`,
          observation: `Telemetry actively logged from ${a.asset}`,
          expected: 'Continuous SCADA telemetry feed',
          observed: `${a.type} event captured`,
          severity: a.severity,
          evidenceId: `EVD-LIVE-${500 + (uniqueAssetsMap.size % 50)}`
        });
      }
    });
    const newAssets = Array.from(uniqueAssetsMap.values());

    // Group unique CSEs from the uploaded records so the app strictly reflects all entities in the file
    const uniqueCseMap = new Map();
    newAlerts.forEach(a => {
      if (!uniqueCseMap.has(a.cse)) {
        let cseName = a.rawCseName;
        if (!cseName) {
          const known = initialCseEntities.find(c => c.id.toLowerCase() === a.cse.toLowerCase());
          cseName = known ? known.name : `${a.cse} Operations Center`;
        }

        let sector = a.rawSector;
        if (!sector) {
          const known = initialCseEntities.find(c => c.id.toLowerCase() === a.cse.toLowerCase());
          sector = known ? known.sector : 'Critical Infrastructure';
        }

        uniqueCseMap.set(a.cse, {
          id: a.cse,
          name: cseName,
          sector: sector,
          alerts: []
        });
      }
      uniqueCseMap.get(a.cse).alerts.push(a);
    });

    // Build dynamic CSE list exclusively from the uploaded CSV dataset
    const dynamicCseEntities = Array.from(uniqueCseMap.values()).map(cseObj => {
      const cseAlerts = cseObj.alerts;
      const cCrit = cseAlerts.filter(a => a.severity === 'Critical').length;
      const cHigh = cseAlerts.filter(a => a.severity === 'High').length;
      const cMed = cseAlerts.filter(a => a.severity === 'Medium').length;
      const cLow = cseAlerts.filter(a => a.severity === 'Low').length;
      const cThreats = cCrit + cHigh + cMed + cLow;
      const cTotal = cseAlerts.length;

      let thisScore = 50;
      if (cTotal > 0) {
        if (cCrit > 0 || cHigh > 0) {
          const weightedThreatScore = ((cCrit * 100) + (cHigh * 80) + (cMed * 50) + (cLow * 25)) / (cThreats || 1);
          thisScore = Math.min(98, Math.max(55, Math.round(weightedThreatScore)));
        } else if (cMed > 0) {
          thisScore = Math.min(50, Math.max(35, Math.round(35 + ((cMed / cTotal) * 20))));
        } else {
          thisScore = Math.min(30, Math.max(15, Math.round(20 + ((cLow / cTotal) * 15))));
        }
      }

      const thisBreakdown = calculateAttentionBreakdown(thisScore);
      const thisLevel = thisScore >= 71 ? 'HIGH' : thisScore >= 31 ? 'MEDIUM' : 'LOW';
      const cseFindingsCount = newFindings.filter(f => f.cse === cseObj.id).length || 1;

      return {
        id: cseObj.id,
        name: cseObj.name,
        sector: cseObj.sector,
        score: thisScore,
        total_score: thisScore,
        level: thisLevel,
        findings: cseFindingsCount,
        samples: cTotal,
        status: 'Assessed',
        lastAssessment: new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }),
        execution_gap_score: thisBreakdown.execution_gap_score,
        negative_space_score: thisBreakdown.negative_space_score,
        peer_deviation_score: thisBreakdown.peer_deviation_score,
        anomaly_score: thisBreakdown.anomaly_score,
        criticality: 'Critical Infrastructure'
      };
    }).sort((a, b) => b.score - a.score);

    setAlerts(newAlerts);
    setCases(newCases);
    setFindings(newFindings);
    setEvidence(newEvidence);
    setAssets(newAssets);
    setCseEntities(dynamicCseEntities);
  };

  return (
    <SOCContext.Provider
      value={{
        alerts,
        cases,
        investigations,
        escalations,
        findings,
        evidence,
        assets,
        cseEntities,
        isDemoMode,
        activeFileName,
        activeAlerts,
        resolvedIncidents,
        cohortAttentionScore,
        updateAlertStatus,
        updateCaseStatus,
        updateFindingStatus,
        addCaseNote,
        escalateAlert,
        resolveIncident,
        loadUploadedCSV,
        resetDemoScenario
      }}
    >
      {children}
    </SOCContext.Provider>
  );
}

export function useSOC() {
  const context = useContext(SOCContext);
  if (!context) {
    throw new Error('useSOC must be used within a SOCProvider');
  }
  return context;
}

