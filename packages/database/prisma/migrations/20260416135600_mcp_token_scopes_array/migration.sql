-- AlterTable: replace scope (text) with scopes (text[])
ALTER TABLE "mcp_tokens"
  ADD COLUMN "scopes" TEXT[] NOT NULL DEFAULT '{}';

UPDATE "mcp_tokens"
  SET "scopes" = string_to_array(TRIM(scope), ' ')
  WHERE scope IS NOT NULL AND TRIM(scope) <> '';

ALTER TABLE "mcp_tokens"
  DROP COLUMN "scope";
