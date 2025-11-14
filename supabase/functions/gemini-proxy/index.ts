import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const MAX_RETRIES = 3;
const RETRY_DELAY_MS = 1000;
const REQUEST_TIMEOUT_MS = 120000;

interface StreamChunk {
  text?: string;
  functionCalls?: any[];
  usageMetadata?: {
    promptTokenCount: number;
    candidatesTokenCount: number;
    totalTokenCount: number;
  };
}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...options,
      signal: controller.signal,
    });
    clearTimeout(timeout);
    return response;
  } catch (error) {
    clearTimeout(timeout);
    throw error;
  }
}

async function fetchWithRetry(url: string, options: RequestInit, maxRetries: number, retryDelay: number): Promise<Response> {
  let lastError: Error | null = null;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, options, REQUEST_TIMEOUT_MS);

      if (response.status === 429 || response.status === 503) {
        if (attempt < maxRetries) {
          const delay = retryDelay * Math.pow(2, attempt);
          console.log(`Rate limited or service unavailable, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1})`);
          await new Promise(resolve => setTimeout(resolve, delay));
          continue;
        }
      }

      return response;
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      if (attempt < maxRetries) {
        const delay = retryDelay * Math.pow(2, attempt);
        console.log(`Request failed, retrying in ${delay}ms (attempt ${attempt + 1}/${maxRetries + 1}):`, error);
        await new Promise(resolve => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError || new Error("Request failed after all retries");
}

function validateRequest(body: any): { valid: boolean; error?: string } {
  if (!body) {
    return { valid: false, error: "Request body is required" };
  }

  const { contents, config } = body;

  if (!contents || !Array.isArray(contents)) {
    return { valid: false, error: "contents must be an array" };
  }

  if (contents.length === 0) {
    return { valid: false, error: "contents array cannot be empty" };
  }

  for (let i = 0; i < contents.length; i++) {
    const content = contents[i];
    if (!content.role || !content.parts) {
      return { valid: false, error: `Invalid content at index ${i}: must have role and parts` };
    }
    if (!Array.isArray(content.parts) || content.parts.length === 0) {
      return { valid: false, error: `Invalid content at index ${i}: parts must be a non-empty array` };
    }
  }

  if (config?.model && typeof config.model !== 'string') {
    return { valid: false, error: "config.model must be a string" };
  }

  return { valid: true };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, {
      status: 200,
      headers: corsHeaders,
    });
  }

  try {
    const body = await req.json().catch(err => {
      console.error("JSON parse error:", err);
      return null;
    });

    const validation = validateRequest(body);
    if (!validation.valid) {
      return new Response(
        JSON.stringify({ error: validation.error }),
        {
          status: 400,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    const { contents, config, stream = false } = body;

    const apiKey = Deno.env.get("GEMINI_API_KEY") || Deno.env.get("GEMINI_APIKEY");
    if (!apiKey) {
      console.error("GEMINI_API_KEY or GEMINI_APIKEY not found in environment");
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

    const model = config?.model || "gemini-2.0-flash-exp";
    const apiUrl = `https://generativelanguage.googleapis.com/v1beta/models/${model}:${stream ? 'streamGenerateContent' : 'generateContent'}?key=${apiKey}`;

    const requestBody: any = {
      contents,
    };

    if (config) {
      const { model: _, systemInstruction, tools, ...restConfig } = config;

      if (systemInstruction) {
        if (typeof systemInstruction === 'string') {
          requestBody.systemInstruction = {
            parts: [{ text: systemInstruction }]
          };
        } else {
          requestBody.systemInstruction = systemInstruction;
        }
      }

      if (tools) {
        requestBody.tools = tools;
      }

      if (Object.keys(restConfig).length > 0) {
        requestBody.generationConfig = restConfig;
      }
    }

    console.log("Sending request to Gemini API:", {
      model,
      stream,
      hasTools: !!requestBody.tools,
      hasSystemInstruction: !!requestBody.systemInstruction,
    });

    const response = await fetchWithRetry(
      apiUrl,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(requestBody),
      },
      MAX_RETRIES,
      RETRY_DELAY_MS
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Gemini API Error:", response.status, errorText);

      let errorMessage = `Gemini API error: ${response.status}`;
      let errorDetails = errorText;

      try {
        const errorJson = JSON.parse(errorText);
        if (errorJson.error?.message) {
          errorMessage = errorJson.error.message;
        }
      } catch (e) {
      }

      return new Response(
        JSON.stringify({
          error: errorMessage,
          details: errorDetails,
          status: response.status,
        }),
        {
          status: response.status,
          headers: {
            ...corsHeaders,
            "Content-Type": "application/json",
          },
        }
      );
    }

    if (stream) {
      if (!response.body) {
        return new Response(
          JSON.stringify({ error: "No response body from Gemini API" }),
          {
            status: 500,
            headers: {
              ...corsHeaders,
              "Content-Type": "application/json",
            },
          }
        );
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      const encoder = new TextEncoder();

      const stream = new ReadableStream({
        async start(controller) {
          let totalTokens = 0;
          let buffer = "";
          let depth = 0;
          let currentObject = "";

          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;

              const chunk = decoder.decode(value, { stream: true });
              buffer += chunk;

              for (let i = 0; i < buffer.length; i++) {
                const char = buffer[i];

                if (char === '{') {
                  depth++;
                  currentObject += char;
                } else if (char === '}') {
                  currentObject += char;
                  depth--;

                  if (depth === 0 && currentObject.trim()) {
                    try {
                      const parsedChunk = JSON.parse(currentObject);
                      const streamChunk: StreamChunk = {};

                      if (parsedChunk.candidates?.[0]?.content?.parts) {
                        const parts = parsedChunk.candidates[0].content.parts;
                        const textParts = parts.filter((part: any) => part.text).map((part: any) => part.text);
                        if (textParts.length > 0) {
                          streamChunk.text = textParts.join('');
                        }

                        const functionCalls = parts.filter((part: any) => part.functionCall);
                        if (functionCalls.length > 0) {
                          streamChunk.functionCalls = functionCalls.map((part: any) => part.functionCall);
                        }
                      }

                      if (parsedChunk.usageMetadata) {
                        streamChunk.usageMetadata = {
                          promptTokenCount: parsedChunk.usageMetadata.promptTokenCount || 0,
                          candidatesTokenCount: parsedChunk.usageMetadata.candidatesTokenCount || parsedChunk.usageMetadata.totalTokenCount || 0,
                          totalTokenCount: parsedChunk.usageMetadata.totalTokenCount || 0,
                        };
                        totalTokens = streamChunk.usageMetadata.totalTokenCount;
                      }

                      if (Object.keys(streamChunk).length > 0) {
                        controller.enqueue(encoder.encode(JSON.stringify(streamChunk) + "\n"));
                      }

                      currentObject = "";
                    } catch (e) {
                      console.error("Failed to parse JSON object:", e, "Object:", currentObject);
                      currentObject = "";
                    }
                  }
                } else if (depth > 0) {
                  currentObject += char;
                }
              }

              buffer = currentObject;
            }

            controller.close();
          } catch (error) {
            console.error("Stream processing error:", error);
            controller.error(error);
          }
        },
      });

      return new Response(stream, {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/x-ndjson",
          "Transfer-Encoding": "chunked",
        },
      });
    }

    const data = await response.json();

    const text = data.candidates?.[0]?.content?.parts?.[0]?.text || "";
    const functionCalls = data.candidates?.[0]?.content?.parts
      ?.filter((part: any) => part.functionCall)
      ?.map((part: any) => part.functionCall) || [];

    const tokens = (data.usageMetadata?.promptTokenCount || 0) + (data.usageMetadata?.candidatesTokenCount || 0);

    const result: any = { text, tokens };

    if (functionCalls.length > 0) {
      result.functionCalls = functionCalls;
    }

    if (data.usageMetadata) {
      result.usageMetadata = {
        promptTokenCount: data.usageMetadata.promptTokenCount || 0,
        candidatesTokenCount: data.usageMetadata.candidatesTokenCount || 0,
        totalTokenCount: data.usageMetadata.totalTokenCount || tokens,
      };
    }

    return new Response(
      JSON.stringify(result),
      {
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  } catch (error) {
    console.error("Edge function error:", error);

    let errorMessage = "Internal server error";
    let statusCode = 500;

    if (error instanceof Error) {
      if (error.name === "AbortError" || error.message.includes("timeout")) {
        errorMessage = "Request timeout - the API took too long to respond";
        statusCode = 504;
      } else if (error.message.includes("fetch")) {
        errorMessage = "Network error - unable to reach Gemini API";
        statusCode = 503;
      } else {
        errorMessage = error.message;
      }
    }

    return new Response(
      JSON.stringify({
        error: errorMessage,
        details: error instanceof Error ? error.message : String(error),
        type: error instanceof Error ? error.name : "UnknownError",
      }),
      {
        status: statusCode,
        headers: {
          ...corsHeaders,
          "Content-Type": "application/json",
        },
      }
    );
  }
});
