CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS food_items_set_updated_at ON food_items;
CREATE TRIGGER food_items_set_updated_at
BEFORE UPDATE ON food_items
FOR EACH ROW
EXECUTE FUNCTION set_updated_at();
