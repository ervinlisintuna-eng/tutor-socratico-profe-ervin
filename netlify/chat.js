import {
  buildConversationPayload,
  buildSystemPrompt,
  extractActivityTag,
  fallbackTutorReply,
} from '../../src/lib/chatPrompt.js'

export default async function handler(request) {
  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Method not allowed' }, 405)
  }

  let payload = {}
  try {
    payload = await request.json()
  } catch {
    return jsonResponse({ error: 'Invalid JSON body' }, 400)
  }

  const studentName = payload.studentName || 'Estudiante'
  const age = Number(payload.age) || 6
  const subject = payload.subject || 'drawing'
  const topic = payload.topic || 'tema libre'
  const topicPrompt = payload.topicPrompt || ''
  const messages = Array.isArray(payload.messages) ? payload.messages : []
  const message = payload.message || ''
  const turnCount = Number(payload.turnCount) || 0
  const priorMessages =
    messages.length && messages[messages.length - 1]?.content === message ? messages.slice(0, -1) : messages

  const historyText = priorMessages.map((item) => `${item.role}: ${item.content}`).join('\n')

  if (!process.env.GEMINI_API_KEY) {
    const reply = fallbackTutorReply({
      message,
      subjectName: subject,
      topicName: topic,
      turnCount,
    })
    const parsed = extractActivityTag(reply)
    return jsonResponse({
      reply: parsed.text,
      activity: parsed.activity,
      provider: 'local',
      systemPrompt: buildSystemPrompt({
        studentName,
        age,
        subject,
        topic,
        topicPrompt,
        history: historyText,
      }),
    })
  }

  const systemPrompt =
    payload.systemPrompt ||
    buildSystemPrompt({
      studentName,
      age,
      subject,
      topic,
      topicPrompt,
      history: historyText,
    })

  const body = {
    systemInstruction: {
      parts: [{ text: systemPrompt }],
    },
    contents: [...buildConversationPayload(priorMessages), { role: 'user', parts: [{ text: message }] }],
    generationConfig: {
      temperature: 0.7,
      maxOutputTokens: 300,
    },
  }

  try {
    const response = await fetch(
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-goog-api-key': process.env.GEMINI_API_KEY,
        },
        body: JSON.stringify(body),
      },
    )

    if (!response.ok) {
      throw new Error(`Gemini request failed with ${response.status}`)
    }

    const data = await response.json()
    const replyText = data?.candidates?.[0]?.content?.parts?.[0]?.text || ''
    const parsed = extractActivityTag(replyText)

    return jsonResponse({
      reply: parsed.text || '¿Qué más puedes observar? 😊',
      activity: parsed.activity,
      provider: 'gemini',
    })
  } catch (error) {
    const reply = fallbackTutorReply({
      message,
      subjectName: subject,
      topicName: topic,
      turnCount,
    })
    const parsed = extractActivityTag(reply)
    return jsonResponse({
      reply: parsed.text,
      activity: parsed.activity,
      provider: 'fallback',
      error: error instanceof Error ? error.message : 'unknown_error',
    })
  }
}

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      'Content-Type': 'application/json; charset=utf-8',
    },
  })
}
