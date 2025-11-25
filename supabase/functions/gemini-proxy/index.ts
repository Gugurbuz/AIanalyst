import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const apiKey = Deno.env.get("GEMINI_API_KEY");

    if (!apiKey) {
      return new Response(
        JSON.stringify({ error: "GEMINI_API_KEY not configured" }),
        {
          status: 500,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { contents, config, stream } = await req.json();

    const model = config?.model || "gemini-2.0-flash-exp";
    const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${stream ? 'streamGenerateContent' : 'generateContent'}?key=${apiKey}`;

    const requestBody: any = {
      contents,
    };

    if (config) {
      const { model: _, ...restConfig } = config;
      if (Object.keys(restConfig).length > 0) {
        requestBody.generationConfig = restConfig;
      }
    }

    const geminiResponse = await fetch(geminiUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestBody),
    });

    if (!geminiResponse.ok) {
      const errorText = await geminiResponse.text();
      return new Response(
        JSON.stringify({
          error: "Gemini API Error",
          details: errorText,
          status: geminiResponse.status
        }),
        {
          status: geminiResponse.status,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (stream) {
      const body = geminiResponse.body;
      if (!body) {
        return new Response(
          JSON.stringify({ error: "No response body from Gemini" }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      const transformStream = new TransformStream({
        async transform(chunk, controller) {
          const text = new TextDecoder().decode(chunk);
          const lines = text.split('\n').filter(line => line.trim());

          for (const line of lines) {
            if (line.startsWith('data: ')) {
              const jsonStr = line.slice(6);
              if (jsonStr === '[DONE]') continue;

              try {
                const data = JSON.parse(jsonStr);
                if (data.candidates && data.candidates[0]?.content?.parts) {
                  const textPart = data.candidates[0].content.parts[0]?.text || '';
                  const functionCalls = data.candidates[0].content.parts
                    .filter((p: any) => p.functionCall)
                    .map((p: any) => p.functionCall);

                  const chunk = {
                    text: textPart,
                    functionCalls: functionCalls.length > 0 ? functionCalls : undefined,
                    usageMetadata: data.usageMetadata,
                  };

                  controller.enqueue(new TextEncoder().encode(JSON.stringify(chunk) + '\n'));
                }
              } catch (e) {
                console.error("Error parsing stream chunk:", e);
              }
            }
          }
        },
      });

      return new Response(body.pipeThrough(transformStream), {
        status: 200,
        headers: {
          ...corsHeaders,
          "Content-Type": "text/event-stream",
          "Cache-Control": "no-cache",
          "Connection": "keep-alive",
        },
      });
    }

    const data = await geminiResponse.json();

    const text = data.candidates?.[0]?.content?.parts?.map((p: any) => p.text).join('') || '';
    const functionCalls = data.candidates?.[0]?.content?.parts
      ?.filter((p: any) => p.functionCall)
      .map((p: any) => p.functionCall);

    const response = {
      text,
      functionCalls: functionCalls?.length > 0 ? functionCalls : undefined,
      usageMetadata: data.usageMetadata,
      tokens: data.usageMetadata?.totalTokenCount || 0,
    };

    return new Response(JSON.stringify(response), {
      status: 200,
      headers: {
        ...corsHeaders,
        "Content-Type": "application/json",
      },
    });

  } catch (error) {
    console.error("Error in gemini-proxy:", error);
    return new Response(
      JSON.stringify({
        error: "Internal server error",
        details: error.message
      }),
      {
        status: 500,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});