// src/types/product.ts
export interface ProductRecord {
  id?: string;
  title: string;
  ingredients?: string[];
  facts?: string;
  warnings?: string[];
  _meta?: Record<string, any>;
  
  // Additional fields from existing usage
  supplementFacts?: { raw?: string };
  score?: {
    purity: number;
    effectiveness: number;
    safety: number;
    value: number;
    overall: number;
  };
  rawData?: any;
  meta?: any;
}

// Export other related types that might be needed
export interface ExtractResult {
  title?: string;
  ingredients?: string[];
  supplementFacts?: { raw?: string };
  warnings?: string[];
  raw?: {
    success?: boolean;
    data?: {
      markdown?: string;
      html?: string;
      metadata?: Record<string, any>;
    };
  };
  _meta?: Record<string, any>;
}