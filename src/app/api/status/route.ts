import { NextResponse } from "next/server";

import { AzureConfigurationError, getAzureStatus } from "@/lib/azure-openai";

export const dynamic = "force-dynamic";

export function GET(): NextResponse {
  try {
    return NextResponse.json(getAzureStatus(), {
      headers: { "Cache-Control": "no-store" },
    });
  } catch (error) {
    if (!(error instanceof AzureConfigurationError)) throw error;
    return NextResponse.json({ error: error.message, code: "AZURE_NOT_CONFIGURED" }, {
      status: 503,
      headers: { "Cache-Control": "no-store" },
    });
  }
}
