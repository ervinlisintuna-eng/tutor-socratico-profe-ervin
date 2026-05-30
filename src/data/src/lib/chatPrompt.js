export function buildSystemPrompt({
  studentName,
  age,
  subject,
  topic,
  topicPrompt,
  history,
}) {
  return `Eres el Profe Ervin Lisintuña, un docente de Primero de Educación General Básica en Ecuador.
Tu misión es acompañar con paciencia, cariño y alegría a ${studentName || 'un estudiante'} de ${age || 6} años.

Reglas absolutas:
1. Nunca des la respuesta directa.
2. Siempre responde con preguntas abiertas, pistas suaves o pequeñas invitaciones a pensar.
3. Usa vocabulario simple, frases cortas y un tono cálido.
4. Nunca uses palabras duras como "mal", "incorrecto" o "equivocado".
5. Si detectas bloqueo, da una pista pequeña y pregunta otra vez.
6. Si conviene, propone una actividad usando el tag [ACTIVIDAD: color|match|see|shape|rhyme|order].
7. Mantén el foco en ${subject} y en el tema "${topic}".
8. Celebra el esfuerzo, la curiosidad y los intentos.

Contexto del tema:
${topicPrompt}

Historial reciente:
${history || 'Sin historial previo.'}`
}

export function buildConversationPayload(messages = []) {
  return messages.map((message) => ({
    role: message.role === 'tutor' ? 'model' : 'user',
    parts: [{ text: message.content }],
  }))
}

export function extractActivityTag(text = '') {
  const match = text.match(/\[ACTIVIDAD:\s*([a-z-]+)\s*\]/i)
  const activity = match?.[1]?.toLowerCase() ?? null
  const cleanedText = text.replace(/\[ACTIVIDAD:\s*([a-z-]+)\s*\]/i, '').trim()
  return {
    text: cleanedText,
    activity,
  }
}

export function fallbackTutorReply({ message, subjectName, topicName, turnCount = 0 }) {
  const lower = message.toLowerCase()
  const gentle = [
    `¡Qué buena idea! ¿Qué ves en ${topicName}?`,
    `Vamos juntos. ¿Me cuentas una parte más de ${topicName}?`,
    `¡Muy cerca! ¿Qué pasaría si lo miramos con calma?`,
  ]

  const languageHints = {
    drawing: '¿Qué forma o color te llama más la atención?',
    language: '¿Qué sonido escuchas primero en esa palabra?',
    art: '¿Qué te gustaría crear con tus manos?',
  }

  const blockedHints = [
    '¡No pasa nada, vamos despacito! ¿Qué observas primero?',
    'Muy bien por intentarlo. ¿Cuál crees que podría ser la respuesta?',
    'Probemos otra vez. ¿Qué pista te ayuda más?',
  ]

  let reply = gentle[turnCount % gentle.length]
  if (lower.includes('no sé') || lower.includes('no entiendo') || lower.includes('ayuda')) {
    reply = blockedHints[turnCount % blockedHints.length]
  } else if (lower.includes('?')) {
    reply = `Esa pregunta es interesante. ¿Qué piensas tú sobre ${topicName}?`
  } else {
    reply = `¡Gracias por compartir! ${languageHints[subjectName] || '¿Qué más podemos descubrir juntos?'}`
  }

  const shouldSuggestActivity = turnCount > 0 && turnCount % 3 === 0
  const tag = shouldSuggestActivity ? ` [ACTIVIDAD: ${activityForSubject(subjectName, topicName)}]` : ''

  return `${reply}${tag}`
}

export function activityForSubject(subjectId, topicName = '') {
  if (subjectId === 'language' && /rima/i.test(topicName)) return 'rhyme'
  if (subjectId === 'language') return 'match'
  if (subjectId === 'drawing' && /forma|figura|cuerpo/i.test(topicName)) return 'shape'
  if (subjectId === 'drawing') return 'color'
  if (subjectId === 'art' && /música|ritmo|danza/i.test(topicName)) return 'see'
  return 'color'
}
