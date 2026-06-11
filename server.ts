import express, { Request, Response } from 'express';
import cors from 'cors';
import * as dotenv from 'dotenv';

dotenv.config({ path: '.env.local' });

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());

app.post('/api/extractVision', async (req: Request, res: Response) => {
  const { base64, prompt } = req.body;

  if (!base64 || !prompt) {
    return res.status(400).json({ error: 'Missing base64 or prompt' });
  }

  const apiKey = process.env.CLAUDE_API_KEY;
  if (!apiKey) {
    console.error('[Server] CLAUDE_API_KEY not found in environment');
    return res.status(500).json({ error: 'CLAUDE_API_KEY not set' });
  }

  try {
    console.log('[Server] Calling Claude API...');
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
      console.error('[Server] Claude error:', error);
      return res.status(response.status).json({ error });
    }

    const data = await response.json();
    console.log('[Server] Claude response received');
    return res.status(200).json(data);
  } catch (error) {
    console.error('[Server] Error:', error);
    return res.status(500).json({ error: String(error) });
  }
});

app.listen(PORT, () => {
  console.log(`🚀 Vision API proxy running on http://localhost:${PORT}`);
  console.log('📋 POST /api/extractVision - Extract kidney parameters from medical images');
});
