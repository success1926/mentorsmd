-- MentorsMD (Oct 2026): Admin -> Website, the editor for the public
-- site's text and photos (draft -> preview -> publish).
--
-- One row per editable page ("home", "seniorTeam", "becomeMentor",
-- "mentors", "contact", "footer"). Each row only stores the fields an admin
-- has changed; anything not stored shows the built-in text from
-- lib/siteContent.ts. With an empty table the site looks exactly as before.
--   draft = unsaved-to-the-site changes (NULL = no unpublished changes)
--   live  = what visitors see
--
-- Open your Neon project -> SQL Editor, paste this whole file, and run it
-- once (make a Neon backup branch first). It only ADDS a table (with
-- IF NOT EXISTS), so it's safe to run while the current site is live, and
-- safe to run twice. Run it BEFORE the new code goes live.

CREATE TABLE IF NOT EXISTS "SiteContent" (
  "key" TEXT NOT NULL,
  "draft" JSONB,
  "live" JSONB,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedById" TEXT,
  "publishedAt" TIMESTAMP(3),
  "publishedById" TEXT,
  CONSTRAINT "SiteContent_pkey" PRIMARY KEY ("key")
);
