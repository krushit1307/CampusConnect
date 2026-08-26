-- =============================================================================
-- Migration: In-App Wallet and Campus Store
-- Issue: #2813 - Implement an In-App Wallet for Gamification Points
-- Description: Creates the wallet infrastructure with strict ACID compliance, 
-- a store inventory system, and an atomic RPC function for secure purchases 
-- with row-level locking to prevent race conditions.
-- =============================================================================

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- =============================================================================
-- 1. Wallet Transactions Table (Immutable Ledger)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.wallet_transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    amount INT NOT NULL, -- Positive for credits, negative for debits
    balance_after INT NOT NULL, -- The user's balance after this transaction
    transaction_type TEXT NOT NULL CHECK (transaction_type IN ('earn', 'purchase', 'refund', 'expire', 'admin_adjust')),
    description TEXT NOT NULL,
    reference_id UUID, -- Links to event_id, order_id, etc.
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_user_id 
ON public.wallet_transactions(user_id, created_at DESC);

-- =============================================================================
-- 2. User Wallet Balances Table (Materialized View of the Ledger)
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.user_wallets (
    user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
    balance INT NOT NULL DEFAULT 0 CHECK (balance >= 0), -- Strict non-negative constraint
    lifetime_earned INT NOT NULL DEFAULT 0,
    lifetime_spent INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 3. Store Inventory Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.store_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    description TEXT,
    image_url TEXT,
    cost INT NOT NULL CHECK (cost > 0),
    stock_quantity INT NOT NULL DEFAULT -1, -- -1 means unlimited stock
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    item_type TEXT NOT NULL CHECK (item_type IN ('physical', 'digital', 'vip_access')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- =============================================================================
-- 4. Order Fulfillments Table
-- =============================================================================
CREATE TABLE IF NOT EXISTS public.store_orders (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    item_id UUID NOT NULL REFERENCES store_items(id) ON DELETE RESTRICT,
    quantity INT NOT NULL DEFAULT 1,
    total_cost INT NOT NULL,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'fulfilled', 'cancelled')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    fulfilled_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_store_orders_user_id 
ON public.store_orders(user_id, created_at DESC);

-- =============================================================================
-- 5. Atomic Purchase RPC Function (Prevents Race Conditions)
-- =============================================================================
CREATE OR REPLACE FUNCTION public.purchase_store_item(
    p_user_id UUID,
    p_item_id UUID,
    p_quantity INT DEFAULT 1
) RETURNS JSONB AS $$
DECLARE
    v_item_cost INT;
    v_item_stock INT;
    v_current_balance INT;
    v_total_cost INT;
    v_new_balance INT;
    v_order_id UUID;
BEGIN
    -- 1. Validate input
    IF p_quantity <= 0 THEN
        RAISE EXCEPTION 'Quantity must be greater than 0';
    END IF;

    -- 2. Lock the store item row to prevent stock race conditions
    SELECT cost, stock_quantity 
    INTO v_item_cost, v_item_stock
    FROM public.store_items
    WHERE id = p_item_id AND is_active = TRUE
    FOR UPDATE; -- ROW LEVEL LOCK

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Item not found or no longer available';
    END IF;

    -- 3. Check stock availability (if not unlimited)
    IF v_item_stock != -1 AND v_item_stock < p_quantity THEN
        RAISE EXCEPTION 'Insufficient stock. Only % items remaining.', v_item_stock;
    END IF;

    v_total_cost := v_item_cost * p_quantity;

    -- 4. Lock the user's wallet row to prevent double-spending race conditions
    SELECT balance 
    INTO v_current_balance
    FROM public.user_wallets
    WHERE user_id = p_user_id
    FOR UPDATE; -- ROW LEVEL LOCK

    -- Create wallet if it doesn't exist (first time user)
    IF NOT FOUND THEN
        INSERT INTO public.user_wallets (user_id, balance) 
        VALUES (p_user_id, 0)
        RETURNING balance INTO v_current_balance;
    END IF;

    -- 5. Verify sufficient funds
    IF v_current_balance < v_total_cost THEN
        RAISE EXCEPTION 'Insufficient funds. You need % ConnectCoins but only have %.', v_total_cost, v_current_balance;
    END IF;

    v_new_balance := v_current_balance - v_total_cost;

    -- 6. Create the order record
    INSERT INTO public.store_orders (user_id, item_id, quantity, total_cost, status)
    VALUES (p_user_id, p_item_id, p_quantity, v_total_cost, 'pending')
    RETURNING id INTO v_order_id;

    -- 7. Deduct balance and update wallet
    UPDATE public.user_wallets
    SET 
        balance = v_new_balance,
        lifetime_spent = lifetime_spent + v_total_cost,
        updated_at = NOW()
    WHERE user_id = p_user_id;

    -- 8. Record the transaction in the immutable ledger
    INSERT INTO public.wallet_transactions (
        user_id, amount, balance_after, transaction_type, description, reference_id
    ) VALUES (
        p_user_id, 
        -v_total_cost, 
        v_new_balance, 
        'purchase', 
        'Purchased item from Campus Store',
        v_order_id
    );

    -- 9. Deduct stock if not unlimited
    IF v_item_stock != -1 THEN
        UPDATE public.store_items
        SET stock_quantity = stock_quantity - p_quantity
        WHERE id = p_item_id;
    END IF;

    -- 10. Return success payload
    RETURN jsonb_build_object(
        'success', TRUE,
        'order_id', v_order_id,
        'new_balance', v_new_balance,
        'total_cost', v_total_cost
    );

EXCEPTION
    WHEN OTHERS THEN
        -- The transaction will automatically rollback on any exception
        RAISE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- =============================================================================
-- Row Level Security (RLS)
-- =============================================================================
ALTER TABLE public.wallet_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_wallets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.store_orders ENABLE ROW LEVEL SECURITY;

-- Users can view their own wallet and transactions
CREATE POLICY "Users can view own wallet" ON public.user_wallets FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own transactions" ON public.wallet_transactions FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can view own orders" ON public.store_orders FOR SELECT USING (auth.uid() = user_id);

-- Anyone can view active store items
CREATE POLICY "Anyone can view store items" ON public.store_items FOR SELECT USING (is_active = TRUE);

-- No direct inserts/updates allowed from frontend (must use RPC or Edge Functions)
CREATE POLICY "System only wallet inserts" ON public.wallet_transactions FOR INSERT WITH CHECK (FALSE);
CREATE POLICY "System only wallet updates" ON public.user_wallets FOR UPDATE USING (FALSE);
CREATE POLICY "System only order inserts" ON public.store_orders FOR INSERT WITH CHECK (FALSE);
