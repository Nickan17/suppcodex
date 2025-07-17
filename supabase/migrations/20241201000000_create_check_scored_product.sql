-- Create RPC function to check if a product exists in scored_products table
-- This is used for E2E testing to verify database insertion

CREATE OR REPLACE FUNCTION check_scored_product(upc TEXT)
RETURNS TABLE(
  id UUID,
  upc TEXT,
  product_name TEXT,
  overall_score NUMERIC,
  created_at TIMESTAMPTZ
) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    sp.id,
    sp.upc,
    sp.product_name,
    sp.overall_score,
    sp.created_at
  FROM scored_products sp
  WHERE sp.upc = check_scored_product.upc
  ORDER BY sp.created_at DESC
  LIMIT 1;
END;
$$;

-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION check_scored_product(TEXT) TO authenticated;

-- Add comment for documentation
COMMENT ON FUNCTION check_scored_product(TEXT) IS 'Check if a product exists in scored_products table by UPC. Used for E2E testing.'; 