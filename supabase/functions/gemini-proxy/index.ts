// Supabase Edge Function (Deno) — Gemini Proxy (non-stream, güvenli)
// POST /functions/v1/gemini-proxy
// Body (basit): { prompt: string, model?: string, temperature?: number, maxOutputTokens?: number, system?: string }
// Body (ileri): { contents: GeminiContent[], system?: string, ... }  // contents verirsen prompt yok sayılır.
// CORS: Geliştirme için '*', prod'da kendi domaininle kısıtla.

type GeminiPart = { text?: string; inline_data?: { mime_type: string; data: string } };
type GeminiContent = { role?: string; parts: GeminiPart[] };

const ALLOWED_ORIGIN = Deno.env.get("ALLOWED_ORIGIN") || "*"; // prod'da domain yaz
const corsHeaders = {
  "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST,OPTIONS",
  "Content-Type": "application/json; charset=utf-8",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Use POST" }), { status: 405, headers: corsHeaders });
  }

  // Secret: GEMINI_API_KEY (yoksa API_KEY'e de bak)
  const API_KEY = Deno.env.get("GEMINI_API_KEY") ?? Deno.env.get("API_KEY");
  if (!API_KEY) {
    return new Response(JSON.stringify({ error: "Missing GEMINI_API_KEY (or API_KEY) secret" }), {
      status: 500,
      headers: corsHeaders,
    });
  }

  let body: any;
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "Invalid JSON body" }), { status: 400, headers: corsHeaders });
  }

  const model = body.model || "gemini-1.5-flash";
  const temperature = typeof body.temperature === "number" ? body.temperature : 0.2;
  const maxOutputTokens = typeof body.maxOutputTokens === "number" ? body.maxOutputTokens : 1024;
  const system = typeof body.system === "string" ? body.system.trim() : undefined;

  // Kullanıcı iki şekilde gönderebilir:
  // a) Basit: { prompt: "..." }
  // b) İleri: { contents: [...] }
  let contents: GeminiContent[] | undefined = Array.isArray(body.contents) ? body.contents : undefined;

  if (!contents) {
    const prompt = String(body.prompt ?? "").trim();
    if (!prompt) {
      return new Response(JSON.stringify({ error: "Provide 'prompt' (string) or 'contents' (array)" }), {
        status: 400,
        headers: corsHeaders,
      });
    }
    contents = [{ role: "user", parts: [{ text: prompt }] }];
  }

  // Gemini REST endpoint (non-stream)
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model
  )}:generateContent?key=${encodeURIComponent(API_KEY)}`;

  const payload: Record<string, unknown> = {
    contents,
    generationConfig: {
      temperature,
      maxOutputTokens,
    },
  };

  if (system) {
    // System instruction ekliyoruz (Gemini v1beta: systemInstruction top-level Content bekler)
    payload["systemInstruction"] = { role: "system", parts: [{ text: system }] };
  }

  const upstream = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });

  const data = await upstream.json().catch(() => null);

  if (!upstream.ok) {
    return new Response(JSON.stringify({ error: "Upstream error", status: upstream.status, detail: data }), {
      status: 502,
      headers: corsHeaders,
    });
  }

  // Kullanışlı tek-string cevap: candidates[0].content.parts[].text birleştirme
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((p: any) => p?.text)
      ?.filter((t: unknown) => typeof t === "string")
      ?.join("") ?? null;

  return new Response(JSON.stringify({ model, text, raw: data }), { status: 200, headers: corsHeaders });
});
