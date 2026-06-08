import { NextRequest, NextResponse } from "next/server";

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

    const response = await fetch(decodedUrl, {
      method: "GET",
      headers,
      next: { revalidate: 0 }, // Avoid caching to ensure fresh results
    });

    const body = await response.text();

    const responseHeaders = new Headers();
    responseHeaders.set(
      "Content-Type",
      response.headers.get("content-type") || "application/json"
    );

    // Forward crucial WordPress pagination and response headers
    const wpHeaders = ["x-wp-total", "x-wp-totalpages", "link", "allow"];
    wpHeaders.forEach((headerName) => {
      const headerVal = response.headers.get(headerName);
      if (headerVal) {
        responseHeaders.set(headerName, headerVal);
      }
    });

    return new Response(body, {
      status: response.status,
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
