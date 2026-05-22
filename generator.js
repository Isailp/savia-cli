const Anthropic = require("@anthropic-ai/sdk");
const { SAVIA_SYSTEM_PROMPT } = require("./savia.prompt");

const client = new Anthropic();

const PILARES = {
  1: "Yo también sentí eso — Empatía y validación emocional",
  2: "Así funciona — Claridad, traducción de lo complejo a lo simple",
  3: "Tu primer paso — Acción pequeña, sin intimidar",
  4: "Esto ya cambió — Contexto real sin alarmismo",
};

async function generarPost({ pilar, tema, contexto }) {
  const pilarTexto = PILARES[pilar];
  if (!pilarTexto) throw new Error(`Pilar inválido. Usa 1, 2, 3 o 4.`);

  let userPrompt = `Genera un post de Facebook para el pilar: "${pilarTexto}".`;

  if (tema) userPrompt += `\nTema específico: ${tema}`;
  if (contexto) userPrompt += `\nContexto adicional: ${contexto}`;

  userPrompt += `\nRecuerda: solo el texto del post, listo para publicar.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: SAVIA_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  return response.content[0].text;
}

async function iterarPost({ postActual, instruccion }) {
  const userPrompt = `Este es un post existente de SavIA:

---
${postActual}
---

Instrucción de cambio: ${instruccion}

Devuelve el post corregido, solo el texto, listo para publicar.`;

  const response = await client.messages.create({
    model: "claude-sonnet-4-20250514",
    max_tokens: 1000,
    system: SAVIA_SYSTEM_PROMPT,
    messages: [{ role: "user", content: userPrompt }],
  });

  return response.content[0].text;
}

module.exports = { generarPost, iterarPost, PILARES };
