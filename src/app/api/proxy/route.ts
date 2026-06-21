import { NextRequest, NextResponse } from "next/server";
import { httpRequest } from "@/lib/http";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const targetUrl = searchParams.get("url");

  if (!targetUrl) {
    return NextResponse.json({ error: "Missing 'url' parameter" }, { status: 400 });
  }

  try {
    const decodedUrl = decodeURIComponent(targetUrl);
    const urlObj = new URL(decodedUrl);
    
    if (!["http:", "https:"].includes(urlObj.protocol)) {
      return NextResponse.json(
        { error: "Invalid protocol. Only http and https are allowed." },
        { status: 400 }
      );
    }

    const headers = new Headers();
    
    // Forward user authorization if present (Application Passwords)
    const authHeader = req.headers.get("authorization");
    if (authHeader) {
      headers.set("authorization", authHeader);
    }

    // Route through the shared wrapper so a hung upstream can't hang the proxy.
    const result = await httpRequest(decodedUrl, { headers, timeoutMs: 20000 });

    // timeout / network / aborted means we never received an upstream response.
    if (!result.ok && result.kind !== "http") {
      return NextResponse.json(
        { error: "Failed to fetch target URL", details: result.message },
        { status: 502 }
      );
    }

    // Forward the upstream response verbatim — including non-2xx — so the client
    // can surface WordPress's own error bodies and pagination headers.
    const status = result.ok ? result.status : result.status ?? 502;
    const upstreamHeaders = result.headers;
    const body = result.ok ? result.text : result.body ?? "";

    const responseHeaders = new Headers();
    responseHeaders.set(
      "Content-Type",
      upstreamHeaders?.get("content-type") || "application/json"
    );

    // Forward crucial WordPress pagination and response headers
    const wpHeaders = ["x-wp-total", "x-wp-totalpages", "link", "allow", "retry-after"];
    wpHeaders.forEach((headerName) => {
      const headerVal = upstreamHeaders?.get(headerName);
      if (headerVal) {
        responseHeaders.set(headerName, headerVal);
      }
    });

    return new Response(body, {
      status,
      headers: responseHeaders,
    });
  } catch (error: unknown) {
    console.error("Proxy fetch error:", error);
    const errorMessage = error instanceof Error ? error.message : String(error);
    return NextResponse.json(
      { error: "Failed to fetch target URL", details: errorMessage },
      { status: 502 }
    );
  }
}
