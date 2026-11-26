-- MentorsMD cleanup (Oct 2026): remove discount codes from the database.
-- The owner decided on no promos, and the code that used them is gone.
-- The table was empty and no order pointed at a code.
--
-- Open your Neon project -> SQL Editor, paste this whole file, and run it
-- once (make a Neon backup branch first). This file REMOVES things, so
-- run it only AFTER the new code is live: the old code still expects the
-- column and table. Everything uses IF EXISTS, so it's safe to run twice.

-- 1. The link from orders to discount codes.
ALTER TABLE "Order" DROP CONSTRAINT IF EXISTS "Order_discountCodeId_fkey";

-- 2. The column on orders.
ALTER TABLE "Order" DROP COLUMN IF EXISTS "discountCodeId";

-- 3. The discount codes table itself.
DROP TABLE IF EXISTS "DiscountCode";
