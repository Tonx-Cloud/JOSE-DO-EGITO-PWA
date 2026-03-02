// gemini.ts - Serviço exclusivo Google Gemini
// Transcrição multimodal, interpretação de sonhos e geração de áudio (TTS)
import { GoogleGenAI } from '@google/genai';

const getClient = () => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey || apiKey === 'sua_chave_aqui') {
    throw new Error('API Key não configurada. Configure VITE_GEMINI_API_KEY no arquivo .env.local');
  }
  return new GoogleGenAI({ apiKey });
};

// ─── Transcrição de áudio ────────────────────────────────────

export const transcribeAudio = async (base64Audio: string, mimeType: string): Promise<string> => {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    contents: [
      {
        role: 'user',
        parts: [
          {
            inlineData: {
              mimeType,
              data: base64Audio,
            },
          },
          {
            text: 'Transcreva este áudio em português brasileiro. Retorne APENAS o texto transcrito, sem explicação, sem aspas, sem prefixos. Se não houver fala, retorne "Não foi possível identificar fala no áudio."',
          },
        ],
      },
    ],
  });

  const text = response.text?.trim();
  if (!text) throw new Error('Não foi possível transcrever o áudio.');
  return text;
};

// ─── PROMPT DO INTERPRETADOR ─────────────────────────────────
// Este é o prompt completo que define a persona e as regras da LLM.
// Modelo utilizado: gemini-2.0-flash
// Persona: José do Egito (interpretador bíblico de sonhos)

const buildSystemPrompt = (): string => `
Você é **José do Egito**, o célebre interpretador de sonhos da Bíblia Sagrada.
Você viveu no Egito antigo e recebeu de Deus o dom de decifrar os mistérios ocultos nos sonhos.

══════════════════════════════════════
REGRAS DE INTERPRETAÇÃO
══════════════════════════════════════

1. SAUDAÇÃO: Comece sempre com uma saudação breve e calorosa. Ex: "Paz e bênçãos, querido(a)! Que alegria receber seu sonho."

2. ESTILO: Escreva como um conselheiro sábio e carinhoso.
   - Use linguagem CLARA, SIMPLES e ACOLHEDORA
   - Como se estivesse conversando com um avô ou avó querido
   - Evite termos técnicos, psicológicos ou jargões
   - Parágrafos curtos (2-3 frases cada)

3. ESTRUTURA (exatamente 5 parágrafos):
   - §1: Saudação + reconhecimento do sonho ("Que sonho interessante...")
   - §2: Significado simbólico principal — o que os elementos do sonho representam
   - §3: Mensagem espiritual — o que Deus pode estar comunicando
   - §4: Orientação prática — como aplicar essa mensagem no dia a dia
   - §5: Bênção final — palavras de esperança, consolo e encorajamento

4. TOM: Profético mas gentil. Nunca assustador. Sempre transmitir paz e esperança.

5. TAMANHO: Máximo 350 palavras no total.

6. IMPORTANTE: Nunca diga que é uma IA. Você É José do Egito.
`.trim();

// ─── Interpretação do sonho ──────────────────────────────────

export const interpretDream = async (dreamText: string): Promise<string> => {
  const ai = getClient();

  const response = await ai.models.generateContent({
    model: 'gemini-2.0-flash',
    config: {
      systemInstruction: buildSystemPrompt(),
    },
    contents: `Interprete este sonho que me foi relatado:\n\n"${dreamText}"`,
  });

  const text = response.text?.trim();
  if (!text) throw new Error('Não foi possível interpretar o sonho.');
  return text;
};

// ─── Geração de áudio narrado (Gemini TTS) ──────────────────
// Usa o modelo gemini-2.5-flash-preview-tts para gerar voz.
// Voz: Kore (grave, acolhedora, masculina ~40 anos)

export const generateNarrationAudio = async (text: string): Promise<Blob> => {
  const apiKey = import.meta.env.VITE_GEMINI_API_KEY;
  if (!apiKey) throw new Error('API Key não configurada.');

  // Usa a REST API diretamente para TTS, pois o SDK JS pode não suportar ainda
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-tts:generateContent?key=${apiKey}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [
          {
            parts: [
              {
                text: `Leia este texto de forma calma, grave, acolhedora e pausada, como um narrador sábio de 40 anos falando em português brasileiro:\n\n${text}`,
              },
            ],
          },
        ],
        generationConfig: {
          responseModalities: ['AUDIO'],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Kore',
              },
            },
          },
        },
      }),
    }
  );

  if (!response.ok) {
    const err = await response.text();
    console.error('TTS Error:', err);
    throw new Error(`Erro ao gerar narração: ${response.status}`);
  }

  const data = await response.json();

  // Extrair o áudio base64 da resposta
  const audioPart = data.candidates?.[0]?.content?.parts?.find(
    (p: { inlineData?: { mimeType: string; data: string } }) => p.inlineData?.mimeType?.startsWith('audio/')
  );

  if (!audioPart?.inlineData) {
    throw new Error('Resposta de TTS não contém áudio.');
  }

  const byteCharacters = atob(audioPart.inlineData.data);
  const byteNumbers = new Array(byteCharacters.length);
  for (let i = 0; i < byteCharacters.length; i++) {
    byteNumbers[i] = byteCharacters.charCodeAt(i);
  }
  const byteArray = new Uint8Array(byteNumbers);
  return new Blob([byteArray], { type: audioPart.inlineData.mimeType || 'audio/mp3' });
};

// ─── Exportar o prompt para consulta ─────────────────────────
export const getSystemPrompt = buildSystemPrompt;
