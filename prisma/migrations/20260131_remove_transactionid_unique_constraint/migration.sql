-- Remove unique constraint on transactionId to allow same transaction for multiple job posts
-- The replay attack prevention is now handled manually by checking transactionId + jobPostId combination
DO $$ 
BEGIN
    -- Drop the unique constraint on transactionId if it exists
    IF EXISTS (
        SELECT 1 FROM pg_constraint 
        WHERE conname = 'JobPostEntitlement_transactionId_key'
    ) THEN
        ALTER TABLE "JobPostEntitlement" 
        DROP CONSTRAINT "JobPostEntitlement_transactionId_key";
        
        RAISE NOTICE 'Constraint único de transactionId eliminado exitosamente';
    ELSE
        RAISE NOTICE 'El constraint único de transactionId no existe, no se requiere acción';
    END IF;
END $$;

