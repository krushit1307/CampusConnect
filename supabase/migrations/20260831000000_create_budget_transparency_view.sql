-- 1. Ensure is_confidential flag exists on club_transactions
ALTER TABLE club_transactions
ADD COLUMN IF NOT EXISTS is_confidential BOOLEAN DEFAULT FALSE NOT NULL;

-- 2. Create public aggregated view for budget transparency charts
CREATE OR REPLACE VIEW club_expense_summary AS
SELECT 
    club_id,
    CASE 
        WHEN is_confidential THEN 'Miscellaneous'
        ELSE category
    END AS category,
    SUM(Math.abs(amount)) AS total_amount,
    COUNT(id) AS transaction_count,
    TO_CHAR(created_at, 'YYYY-MM') AS month_key
FROM club_transactions
WHERE transaction_type = 'EXPENSE'
GROUP BY 
    club_id,
    CASE 
        WHEN is_confidential THEN 'Miscellaneous'
        ELSE category
    END,
    TO_CHAR(created_at, 'YYYY-MM');

-- 3. Enable public access to the aggregated view only
GRANT SELECT ON club_expense_summary TO anon, authenticated;