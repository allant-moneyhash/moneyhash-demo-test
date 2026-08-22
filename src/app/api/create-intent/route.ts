import { NextRequest, NextResponse } from "next/server";

// This is the "thin relay". The browser sends the secret key + base URL + the
// intent payload here for one request; we call MoneyHash and hand back both the
// request we sent and the response we got, so the inspector can show both.
// The secret key is used only for this call and is never stored or logged.

export async function POST(req: NextRequest) {
  let payload: {
    baseURL?: string;
    secretApiKey?: string;
    body?: Record<string, unknown>;
  };

  try {
    payload = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Could not read the request. Expected JSON." },
      { status: 400 },
    );
  }

  const { baseURL, secretApiKey, body } = payload;

  if (!baseURL || !secretApiKey || !body) {
    return NextResponse.json(
      {
        error:
          "Missing something. Need the environment, your secret key, and an intent payload.",
      },
      { status: 400 },
    );
  }

  const endpoint = `${baseURL}/payments/intent/`;

  try {
    const mhResponse = await fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": secretApiKey,
      },
      body: JSON.stringify(body),
    });

    const text = await mhResponse.text();
    let data: unknown;
    try {
      data = JSON.parse(text);
    } catch {
      data = text;
    }

    if (!mhResponse.ok) {
      return NextResponse.json(
        {
          error: `MoneyHash returned ${mhResponse.status}.`,
          endpoint,
          details: data,
        },
        { status: mhResponse.status },
      );
    }

    // Echo back the endpoint we hit (handy for the inspector) plus the data.
    return NextResponse.json({ endpoint, data });
  } catch (err) {
    return NextResponse.json(
      {
        error:
          "Could not reach MoneyHash. Check the environment/base URL and your network.",
        endpoint,
        details: err instanceof Error ? err.message : String(err),
      },
      { status: 502 },
    );
  }
}
