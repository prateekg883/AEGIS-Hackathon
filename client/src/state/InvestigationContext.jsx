import { createContext, useContext, useState } from 'react';

const InvestigationContext = createContext();

export function InvestigationProvider({ children }) {
  const [investigatingFindingId, setInvestigatingFindingId] = useState(null);

  const openInvestigation = (findingId) => {
    setInvestigatingFindingId(findingId);
  };

  const closeInvestigation = () => {
    setInvestigatingFindingId(null);
  };

  return (
    <InvestigationContext.Provider
      value={{
        investigatingFindingId,
        openInvestigation,
        closeInvestigation,
      }}
    >
      {children}
    </InvestigationContext.Provider>
  );
}

export function useInvestigation() {
  const context = useContext(InvestigationContext);
  if (!context) {
    throw new Error('useInvestigation must be used within an InvestigationProvider');
  }
  return context;
}
