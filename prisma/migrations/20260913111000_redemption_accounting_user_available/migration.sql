-- Additive local-only correction to Phase 4 internal redemption accounting.
-- USER_AVAILABLE represents the accounting-side available account; User.points remains the legacy base.
ALTER TYPE "PointPostingAccount" ADD VALUE IF NOT EXISTS 'USER_AVAILABLE' BEFORE 'USER_RESERVED';
