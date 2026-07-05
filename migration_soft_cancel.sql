-- Add status and cancellation columns for soft delete
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS status text DEFAULT 'confirmed';
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS cancelled_at timestamp with time zone;
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS updated_at timestamp with time zone;

-- Update existing rows to 'confirmed' just in case
UPDATE bookings SET status = 'confirmed' WHERE status IS NULL;
