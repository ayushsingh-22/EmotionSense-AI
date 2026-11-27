SET LOCAL lock_timeout = '5s';
SET LOCAL statement_timeout = '60s';

DO $$
BEGIN
  IF current_setting('lock_timeout') <> '5s' THEN
    RAISE EXCEPTION 'migration is not running inside a single transaction';
  END IF;
  LOCK TABLE "content_items" IN ACCESS EXCLUSIVE MODE;
END $$;

ALTER TABLE "content_items" ADD COLUMN "image_asset_id" TEXT;
ALTER TABLE "content_items" ADD CONSTRAINT "content_items_image_asset_id_fkey"
  FOREIGN KEY ("image_asset_id") REFERENCES "media_assets"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
CREATE INDEX "content_items_image_asset_id_idx" ON "content_items"("image_asset_id");
