CREATE TYPE "public"."stock_type" AS ENUM('RESTOCK', 'SALE');--> statement-breakpoint
CREATE TYPE "public"."user_role" AS ENUM('ADMIN', 'STAFF');--> statement-breakpoint
CREATE TABLE "food_items" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"category" text NOT NULL,
	"price" numeric(12, 2) NOT NULL,
	"current_stock" integer DEFAULT 0 NOT NULL,
	"min_threshold" integer DEFAULT 5 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "food_items_price_non_negative" CHECK ("food_items"."price" >= 0),
	CONSTRAINT "food_items_current_stock_non_negative" CHECK ("food_items"."current_stock" >= 0),
	CONSTRAINT "food_items_min_threshold_non_negative" CHECK ("food_items"."min_threshold" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sales" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid,
	"item_name" text NOT NULL,
	"quantity_sold" integer NOT NULL,
	"total_price" numeric(12, 2) NOT NULL,
	"user_id" uuid,
	"username" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sales_quantity_sold_positive" CHECK ("sales"."quantity_sold" > 0),
	CONSTRAINT "sales_total_price_non_negative" CHECK ("sales"."total_price" >= 0)
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"user_id" uuid NOT NULL,
	"token_hash" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "sessions_token_hash_unique" UNIQUE("token_hash")
);
--> statement-breakpoint
CREATE TABLE "stock_records" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"item_id" uuid,
	"item_name" text NOT NULL,
	"quantity_changed" integer NOT NULL,
	"type" "stock_type" NOT NULL,
	"user_id" uuid,
	"username" text DEFAULT 'System' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "stock_records_quantity_changed_positive" CHECK ("stock_records"."quantity_changed" > 0)
);
--> statement-breakpoint
CREATE TABLE "users" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"username" "citext" NOT NULL,
	"password_hash" text NOT NULL,
	"role" "user_role" DEFAULT 'STAFF' NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "users_username_unique" UNIQUE("username"),
	CONSTRAINT "users_username_format" CHECK ("users"."username" ~ '^[A-Za-z0-9_.-]{3,32}$')
);
--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_item_id_food_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."food_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sales" ADD CONSTRAINT "sales_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_records" ADD CONSTRAINT "stock_records_item_id_food_items_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."food_items"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "stock_records" ADD CONSTRAINT "stock_records_user_id_users_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "sales_created_at_idx" ON "sales" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "sales_item_id_idx" ON "sales" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "sales_user_id_idx" ON "sales" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_user_id_idx" ON "sessions" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "sessions_expires_at_idx" ON "sessions" USING btree ("expires_at");--> statement-breakpoint
CREATE INDEX "stock_records_created_at_idx" ON "stock_records" USING btree ("created_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "stock_records_item_id_idx" ON "stock_records" USING btree ("item_id");--> statement-breakpoint
CREATE INDEX "stock_records_user_id_idx" ON "stock_records" USING btree ("user_id");