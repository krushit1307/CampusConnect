-- 1. Add barcode and borrower tracking to existing inventory
ALTER TABLE inventory_items 
ADD COLUMN barcode_id TEXT UNIQUE,
ADD COLUMN current_borrower_id UUID REFERENCES auth.users(id);

-- 2. Create the accountability table for tracking who has what
CREATE TABLE asset_loans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  item_id UUID REFERENCES inventory_items(id) NOT NULL,
  borrower_id UUID REFERENCES auth.users(id) NOT NULL,
  checkout_date TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  due_date TIMESTAMP WITH TIME ZONE NOT NULL,
  returned_date TIMESTAMP WITH TIME ZONE,
  status TEXT DEFAULT 'active'
);
