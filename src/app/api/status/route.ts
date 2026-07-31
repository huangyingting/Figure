import { NextResponse } from "next/server";

import { getAzureStatus } from "@/lib/azure-openai";

export const dynamic = "force-dynamic";

export function GET(): NextResponse {
  return NextResponse.json(getAzureStatus(), {
    headers: { "Cache-Control": "no-store" },
  });
}
