import React, { createContext, useContext, useState, ReactNode } from 'react';

// Scan Context
interface Scorecard {
  [key: string]: any;
}

interface ScanContextType {
  upc: string | null;
  scorecard: Scorecard | null;
  setResult: ({ upc, scorecard }: { upc: string | null; scorecard: Scorecard | null }) => void;
}

const ScanContext = createContext<ScanContextType | undefined>(undefined);

interface ScanProviderProps {
  children: ReactNode;
}

export const ScanProvider: React.FC<ScanProviderProps> = ({ children }) => {
  const [upc, setUpc] = useState<string | null>(null);
  const [scorecard, setScorecard] = useState<Scorecard | null>(null);

  const setResult = ({ upc, scorecard }: { upc: string | null; scorecard: Scorecard | null }) => {
    setUpc(upc);
    setScorecard(scorecard);
  };

  return (
    <ScanContext.Provider value={{ upc, scorecard, setResult }}>
      {children}
    </ScanContext.Provider>
  );
};

export const useScan = () => {
  const context = useContext(ScanContext);
  if (context === undefined) {
    throw new Error('useScan must be used within a ScanProvider');
  }
  return context;
};