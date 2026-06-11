module.exports = async function handler(req, res) {
  // Only allow POST
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  let body = req.body;
  if (!body) {
    const buffers = [];
    for await (const chunk of req) {
      buffers.push(chunk);
    }
    const rawBody = Buffer.concat(buffers).toString();
    try {
      body = JSON.parse(rawBody);
    } catch (_) {
      body = {};
    }
  } else if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {
      body = {};
    }
  }

  const base64 = body?.base64;
  const prompt = body?.prompt;

  if (!base64 || !prompt) {
    return res.status(400).json({ error: 'Missing base64 or prompt' });
  }

  const apiKey = process.env.CLAUDE_API_KEY || process.env.EXPO_PUBLIC_CLAUDE_API_KEY || process.env.EXPO_PUBLIC_GROK_API_KEY || process.env.GROK_API_KEY;
  if (!apiKey) {
    return res.status(500).json({ error: 'Claude/Groq API Key not set' });
  }

  const isGroq = apiKey.startsWith('gsk_');

  try {
    if (isGroq) {
      console.log('[API] Routing vision request to Groq...');
      const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: 'meta-llama/llama-4-scout-17b-16e-instruct',
          messages: [
            {
              role: 'user',
              content: [
                { type: 'text', text: prompt },
                {
                  type: 'image_url',
                  image_url: {
                    url: `data:image/jpeg;base64,${base64}`
                  }
                }
              ]
            }
          ],
          temperature: 0.1,
          response_format: { type: 'json_object' }
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[API] Groq error:', error);
        return res.status(response.status).json({ error });
      }

      const data = await response.json();
      const textContent = data.choices?.[0]?.message?.content || '';
      // Return normalized to Claude format
      return res.status(200).json({
        content: [
          { text: textContent }
        ]
      });
    } else {
      console.log('[API] Routing vision request to Claude...');
      const response = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-api-key': apiKey,
          'anthropic-version': '2023-06-01',
        },
        body: JSON.stringify({
          model: 'claude-3-5-sonnet-20241022',
          max_tokens: 350,
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: 'image/jpeg',
                    data: base64,
                  },
                },
                { type: 'text', text: prompt },
              ],
            },
          ],
        }),
      });

      if (!response.ok) {
        const error = await response.text();
        console.error('[API] Claude error:', error);
        return res.status(response.status).json({ error });
      }

      const data = await response.json();
      return res.status(200).json(data);
    }
  } catch (error) {
    console.error('[API] Error:', error);
    return res.status(500).json({ error: String(error) });
  }
};
