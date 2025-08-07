import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface ProductRecord {
  productId: string;
  title?: string;
  productName?: string;
  ingredients?: string[];
  supplementFacts?: {
    raw?: string;
    servingSize?: string;
    servingsPerContainer?: number;
    nutrients?: Array<{
      name: string;
      amount: string;
      dailyValue?: string;
    }>;
  };
  warnings?: string[];
  score?: {
    purity: number;
    effectiveness: number;
    safety: number;
    value: number;
    overall: number;
  };
  rawData?: any;
  _meta?: {
    chain?: Array<{
      provider: string;
      status: string;
      ms: number;
      code?: number;
      hint?: string;
    }>;
    model?: string;
    scoredAt?: string;
    [key: string]: any;
  };
  // Legacy support
  meta?: any;
}

interface ProductContextType {
  lastProductId: string | null;
  lastProductData: any; // New unified data format
  current: any; // Current ChainResult
  cache: { [id: string]: ProductRecord };
  setProduct: (product: ProductRecord | any) => void; // Accept both formats
  setCurrent: (result: any) => void; // Set current ChainResult
  setLastProductId: (id: string) => void;
  getProduct: (id: string) => ProductRecord | undefined;
  getProductById: (id: string) => any; // New method
}

const ProductContext = createContext<ProductContextType | undefined>(undefined);

export function ProductProvider({ children }: { children: ReactNode }) {
  const [lastProductId, setLastProductId] = useState<string | null>(null);
  const [lastProductData, setLastProductData] = useState<any>(null);
  const [current, setCurrent] = useState<any>(null);
  const [cache, setCache] = useState<{ [id: string]: ProductRecord }>({});

  const setProduct = (product: ProductRecord | any) => {
    // Handle ChainResult format
    if (product?.product && product?.score) {
      setCurrent(product);
      setLastProductData(product);
      return;
    }
    
    // Handle new unified data format
    if (product?.product?.id) {
      const id = product.product.id;
      setCache(prev => ({ ...prev, [id]: product }));
      setLastProductId(id);
      setLastProductData(product);
    } 
    // Handle legacy ProductRecord format
    else if (product?.productId) {
      setCache(prev => ({ ...prev, [product.productId]: product }));
      setLastProductId(product.productId);
      setLastProductData(product);
    } else {
      // Store as-is for compatibility
      setLastProductData(product);
    }
  };

  const getProduct = (id: string) => cache[id];
  const getProductById = (id: string) => cache[id];

  return (
    <ProductContext.Provider value={{
      lastProductId,
      lastProductData,
      current,
      cache,
      setProduct,
      setCurrent,
      setLastProductId,
      getProduct,
      getProductById
    }}>
      {children}
    </ProductContext.Provider>
  );
}

export function useProductContext() {
  const context = useContext(ProductContext);
  if (!context) {
    throw new Error('useProductContext must be used within a ProductProvider');
  }
  return context;
}

export function useProductById(id: string) {
  const { getProduct } = useProductContext();
  return getProduct(id);
}

export function useProduct() {
  const { current, setCurrent } = useProductContext();
  return { current, setCurrent };
}