-- =========================================================
-- BIRDSHOP SUPPORT / REVIEW ADMIN ASSIGNMENT MIGRATION
-- Run this once in Supabase SQL Editor on an existing setup.
-- Safe to re-run.
-- =========================================================

alter table public.support_requests
  add column if not exists assigned_to text;

alter table public.support_requests
  add column if not exists assigned_at timestamptz;

alter table public.reviews
  add column if not exists assigned_to text;

alter table public.reviews
  add column if not exists assigned_at timestamptz;
