const generateContent = async (
  prompt: string | Content[], // Artık Content[] dizisini de kabul ediyor
  model: GeminiModel,
  modelConfig?: any
): Promise<{ text: string, tokens: number }> => {
    
    // DÜZELTME: prompt string ise Content[] formatına çevir, değilse olduğu gibi kullan
    const contents = typeof prompt === 'string' 
        ? [{ role: 'user', parts: [{ text: prompt }] }] 
        : prompt;

    const { config } = {
        config: modelConfig?.generationConfig || modelConfig,
    };

    try {
        const { data, error } = await supabase.functions.invoke('gemini-proxy', {
            body: { contents, config, stream: false }, // Stream olmadığını belirt
        });

        if (error) throw error;

        // Edge function stream=false ise doğrudan JSON döner
        if (data && typeof data.text === 'string') {
             return { text: data.text, tokens: data.tokens || 0 };
        }
        
        // Edge function stream=true cevabı döndürürse (hata)
        if (data instanceof ReadableStream) {
             const reader = data.getReader();
             const decoder = new TextDecoder();
             let text = "";
             let done = false;
             while (!done) {
                const { value, done: readerDone } = await reader.read();
                done = readerDone;
                if (value) {
                    text += decoder.decode(value, { stream: true });
                }
             }
             return { text: text, tokens: 0 }; 
        }

        throw new Error("Supabase Function'dan beklenmeyen yanıt formatı (JSON bekleniyordu).");

    } catch (error) {
        console.error("Supabase Function Hatası (generateContent):", error);
        handleGeminiError(error);
    }
};