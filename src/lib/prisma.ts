import { PrismaClient } from "@prisma/client";

import { getApplicationConfig } from "@/lib/config";

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  datasourceUrl: getApplicationConfig().databaseUrl,
});

if (process.env.NODE_ENV !== "production") globalForPrisma.prisma = prisma;
