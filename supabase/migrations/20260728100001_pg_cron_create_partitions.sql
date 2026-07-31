-- Migration: pg_cron automation for chat_messages partitions
-- Description: Creates a function and a scheduled pg_cron job to automatically 
-- create the next month's partition ahead of time, preventing insert failures.

-- Step 1: Create the function to generate the next month's partition
CREATE OR REPLACE FUNCTION public.create_next_chat_messages_partition()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    next_month_start DATE;
    next_month_end DATE;
    partition_name TEXT;
BEGIN
    -- Calculate the start and end of the next month
    next_month_start := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '1 month');
    next_month_end := DATE_TRUNC('month', CURRENT_DATE + INTERVAL '2 month');
    
    -- Format the partition name, e.g., chat_messages_2026_08
    partition_name := 'chat_messages_' || TO_CHAR(next_month_start, 'YYYY_MM');

    -- Check if the partition already exists to avoid errors
    IF NOT EXISTS (
        SELECT 1 FROM pg_class c
        JOIN pg_namespace n ON n.oid = c.relnamespace
        WHERE c.relname = partition_name AND n.nspname = 'public'
    ) THEN
        -- Execute dynamic SQL to create the partition
        EXECUTE format(
            'CREATE TABLE public.%I PARTITION OF public.chat_messages FOR VALUES FROM (%L) TO (%L)',
            partition_name,
            next_month_start,
            next_month_end
        );
        
        -- Log the creation (optional, but helpful for auditing)
        RAISE NOTICE 'Successfully created partition: %', partition_name;
    ELSE
        RAISE NOTICE 'Partition % already exists, skipping creation.', partition_name;
    END IF;
END;
$$;

-- Step 2: Grant execute permissions to the service role (pg_cron runs as postgres/superuser, but good practice)
GRANT EXECUTE ON FUNCTION public.create_next_chat_messages_partition() TO service_role;

-- Step 3: Schedule the pg_cron job to run on the 25th of every month at 2:00 AM UTC
-- This ensures the next month's partition is ready well before the month rolls over.
SELECT cron.schedule(
    'create-chat-messages-partition-monthly',
    '0 2 25 * *', -- Minute: 0, Hour: 2, Day of Month: 25, Month: *, Day of Week: *
    'SELECT public.create_next_chat_messages_partition();'
);

COMMENT ON FUNCTION public.create_next_chat_messages_partition() IS 'Automatically creates the next monthly partition for the chat_messages table.';
