-- ================================================
-- Migration: Prevent Double Bookings
-- Run this in Supabase SQL Editor
-- ================================================

-- This creates a unique constraint to prevent overlapping 
-- start_times on the same date, guaranteeing atomicity.
-- Any concurrent inserts for the same slot will throw code 23505.

ALTER TABLE bookings 
ADD CONSTRAINT unique_booking_slot UNIQUE (date, start_time);
