-- Add username field to users table
ALTER TABLE "users" ADD COLUMN "username" TEXT;

-- Add unique constraint to username field
ALTER TABLE "users" ADD CONSTRAINT "users_username_key" UNIQUE ("username");