/**
 * FinRP — Prisma Configuration
 * Prisma v5 — schema path: prisma/schema.prisma
 *
 * NOTE: The `prisma/config` module belongs to Prisma v7+.
 * This project uses Prisma v5 which is configured via:
 *  - prisma/schema.prisma  (schema definition)
 *  - .env.local            (DATABASE_URL)
 *  - package.json scripts  (migrate / generate)
 */

export const prismaConfig = {
  schemaPath: "./prisma/schema.prisma",
  datasource: "postgresql",
  version: "5.22.0",
} as const;

export type PrismaConfig = typeof prismaConfig;
