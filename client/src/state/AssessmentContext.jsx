import { createContext, useContext, useEffect, useState } from 'react';

const periods = ['Q1 2026', 'Q2 2026', 'Q3 2026', 'Q4 2026'];
const AssessmentContext = createContext(null);

export function AssessmentProvider({ children }) {
  const [period, setPeriod] = useState(() => localStorage.getItem('assessment-period') || 'Q2 2026');
  const [theme, setTheme] = useState(() => localStorage.getItem('theme') || 'dark');

  useEffect(() => {
    localStorage.setItem('assessment-period', period);
  }, [period]);

  useEffect(() => {
    localStorage.setItem('theme', theme);
    document.documentElement.dataset.theme = theme;
  }, [theme]);

  return <AssessmentContext.Provider value={{ period, setPeriod, periods, hasData: period === 'Q2 2026', theme, setTheme }}>{children}</AssessmentContext.Provider>;
}

export function useAssessment() {
  const context = useContext(AssessmentContext);
  if (!context) throw new Error('useAssessment must be used inside AssessmentProvider');
  return context;
}
