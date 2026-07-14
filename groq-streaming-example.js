// Streaming version of Groq API call (optional - for future implementation)
        async function generateGroqResponseStream(transcript) {
            try {
                console.log('🚀 Calling GroqCloud API with streaming:', transcript);
                
                const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Authorization': 'Bearer ' + VOICE_CONFIG.groqApiKey,
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        model: 'openai/gpt-oss-120b',
                        messages: [
                            {
                                role: 'system',
                                content: 'You are a helpful AI assistant in a video conference. Be concise and friendly.'
                            },
                            {
                                role: 'user',
                                content: transcript
                            }
                        ],
                        temperature: 1,
                        max_completion_tokens: 8192,
                        top_p: 1,
                        reasoning_effort: 'medium',
                        stream: true, // Enable streaming
                        stop: null
                    })
                });
                
                if (!response.ok) {
                    const errorText = await response.text();
                    console.error('❌ GroqCloud API error:', response.status, errorText);
                    throw new Error(`GroqCloud API error: ${response.status}`);
                }
                
                // Process streaming response
                const reader = response.body.getReader();
                const decoder = new TextDecoder();
                let fullResponse = '';
                
                while (true) {
                    const { done, value } = await reader.read();
                    if (done) break;
                    
                    const chunk = decoder.decode(value);
                    const lines = chunk.split('\n');
                    
                    for (const line of lines) {
                        if (line.startsWith('data: ')) {
                            const data = line.slice(6);
                            if (data === '[DONE]') continue;
                            
                            try {
                                const parsed = JSON.parse(data);
                                const content = parsed.choices[0]?.delta?.content;
                                if (content) {
                                    fullResponse += content;
                                    // Could update UI in real-time here
                                }
                            } catch (e) {
                                // Skip invalid JSON
                            }
                        }
                    }
                }
                
                console.log('✅ GroqCloud streaming response received:', fullResponse);
                return fullResponse;
                
            } catch (error) {
                console.error('❌ GroqCloud API error:', error);
                // Fallback response
                const fallbackResponse = "I understand what you're saying. That's interesting!";
                console.log('🔄 Using fallback response:', fallbackResponse);
                return fallbackResponse;
            }
        }
