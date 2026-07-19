-- ================================================
-- Audit: Booking Contact Phones
-- ================================================
-- This script safely audits the phone numbers in the 
-- departments table without modifying any data.
--
-- The output includes a view of the numbers and 
-- a basic classification to help identify invalid entries.

SELECT 
    id,
    name as department_name,
    booking_contact_phone,
    phone as fallback_phone,
    CASE 
        WHEN booking_contact_phone IS NULL OR booking_contact_phone = '' THEN 'missing'
        WHEN booking_contact_phone ~ '^[0-9]{8}$' THEN 'valid_local_8'
        WHEN booking_contact_phone ~ '^\+?965[0-9]{8}$' THEN 'valid_965'
        WHEN booking_contact_phone ~ '^00965[0-9]{8}$' THEN 'valid_00965'
        WHEN booking_contact_phone ~ '[^0-9\+]' THEN 'contains_separators'
        ELSE 'invalid_length_or_format'
    END as classification
FROM 
    departments
ORDER BY 
    name;
