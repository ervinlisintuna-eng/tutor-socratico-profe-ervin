import { useEffect, useMemo, useRef, useState } from 'react'
import {
  avatarOptions,
  badges as badgeDefinitions,
  subjects,
  topics as defaultTopics,
  subjectMap,
} from './data/catalog'
import {
  activityForSubject,
  buildConversationPayload,
  buildSystemPrompt,
  extractActivityTag,
  fallbackTutorReply,
} from './lib/chatPrompt'
import {
  createId,
  fetchRemoteTopics,
  loadLocalAppState,
  saveLocalAppState,
  syncCertificate,
  syncMessage,
  syncSession,
  syncStudent,
} from './lib/persistence'
import { generateCertificatePdf } from './lib/pdf'

const STORAGE_VERSION = 1
const MAX_HISTORY_MESSAGES = 12
const themeReferenceUrl = '/theme-reference.png'

const appScreens = [
  { id: 'welcome', label: 'Inicio', emoji: '🏠' },
  { id: 'profile', label: 'Perfil', emoji: '👦' },
  { id: 'subjects', label: 'Asignaturas', emoji: '🎒' },
  { id: 'topics', label: 'Temas', emoji: '📚' },
  { id: 'chat', label: 'Chat', emoji: '💬' },
  { id: 'history', label: 'Historial', emoji: '🗂️' },
  { id: 'parent', label: 'Para padres', emoji: '👪' },
  { id: 'certificate', label: 'Certificado', emoji: '🏅' },
]

const activityCatalog = {
  color: {
    title: 'Colorea el dibujo',
    description: 'Escoge el color que mejor completa la idea.',
    options: ['Rojo', 'Azul', 'Amarillo', 'Verde'],
    answer: 2,
  },
  match: {
    title: 'Arrastra y empareja',
    description: 'Une la idea correcta con su pareja.',
    options: ['A', 'E', 'I', 'O', 'U'],
    answer: 0,
  },
  see: {
    title: '¿Qué ves?',
    description: 'Describe lo que observas en voz alta o por texto.',
    options: ['Un objeto', 'Un animal', 'Una acción', 'Un color'],
    answer: 1,
  },
  shape: {
    title: 'Completa la figura',
    description: 'Elige la parte que falta para terminar la figura.',
    options: ['Círculo', 'Cuadrado', 'Triángulo', 'Rectángulo'],
    answer: 2,
  },
  rhyme: {
    title: '¡Adivina la rima!',
    description: 'Encuentra la palabra que suena parecido.',
    options: ['Casa', 'Rosa', 'Mesa', 'Silla'],
    answer: 1,
  },
  order: {
    title: 'Ordena la historia',
    description: 'Pon en orden lo que pasó primero, después y al final.',
    options: ['Primero', 'Después', 'Al final'],
    answer: 0,
  },
}

const defaultProfile = {
  id: null,
  fullName: '',
  age: 6,
  schoolName: '',
  avatarId: avatarOptions[0].id,
  pin: '',
}

const defaultMetrics = {
  totalPoints: 0,
  sessionsCompleted: 0,
  topicsCompleted: 0,
  voiceUsed: 0,
}

function uid(prefix) {
  return createId(prefix)
}

export default function App() {
  const initialState = useMemo(() => loadInitialState(), [])
  const [screen, setScreen] = useState(initialState.screen)
  const [profile, setProfile] = useState(initialState.profile)
  const [sessions, setSessions] = useState(initialState.sessions)
  const [activeSessionId, setActiveSessionId] = useState(initialState.activeSessionId)
  const [customTopics, setCustomTopics] = useState(initialState.customTopics)
  const [remoteTopicsLoaded, setRemoteTopicsLoaded] = useState(false)
  const [voiceEnabled, setVoiceEnabled] = useState(initialState.voiceEnabled)
  const [soundEnabled, setSoundEnabled] = useState(initialState.soundEnabled)
  const [micListening, setMicListening] = useState(false)
  const [inputText, setInputText] = useState('')
  const [subjectId, setSubjectId] = useState(initialState.subjectId)
  const [topicId, setTopicId] = useState(initialState.topicId)
  const [showActivity, setShowActivity] = useState(initialState.showActivity)
  const [activitySelection, setActivitySelection] = useState(null)
  const [activityCompleted, setActivityCompleted] = useState(initialState.activityCompleted)
  const [loadingReply, setLoadingReply] = useState(false)
  const [assistantNotice, setAssistantNotice] = useState(
    'Todo listo. Vamos a acompañar a los niños con una experiencia web cálida y clara.',
  )
  const chatEndRef = useRef(null)
  const recognitionRef = useRef(null)

  const currentSession = sessions.find((session) => session.id === activeSessionId) || null
  const selectedSubject = subjectMap[subjectId] || subjects[0]
  const topicList = useMemo(() => {
    const allTopics = [...defaultTopics, ...customTopics]
    return allTopics.filter((topic) => topic.subject === subjectId)
  }, [customTopics, subjectId])
  const selectedTopic = topicList.find((topic) => topic.id === topicId) || topicList[0] || defaultTopics[0]
  const selectedAvatar = avatarOptions.find((avatar) => avatar.id === profile.avatarId) || avatarOptions[0]
  const currentMessages = currentSession?.messages || []
  const metrics = useMemo(() => computeMetrics(sessions, profile.id), [sessions, profile.id])
  const currentBadgeObjects = useMemo(
    () => collectBadges(metrics, sessions, profile.id),
    [metrics, sessions, profile.id],
  )
  const currentBadgeNames = currentBadgeObjects.map((badge) => badge.name)
  const completionProgress = Math.min(100, currentMessages.length * 10 + metrics.totalPoints * 0.8)

  useEffect(() => {
    saveLocalAppState({
      version: STORAGE_VERSION,
      screen,
      profile,
      sessions,
      activeSessionId,
      customTopics,
      voiceEnabled,
      soundEnabled,
      subjectId,
      topicId,
      showActivity,
      activityCompleted,
    })
  }, [
    screen,
    profile,
    sessions,
    activeSessionId,
    customTopics,
    voiceEnabled,
    soundEnabled,
    subjectId,
    topicId,
    showActivity,
    activityCompleted,
  ])

  useEffect(() => {
    window.__profeErvinVoiceEnabled = voiceEnabled
    window.__profeErvinSoundEnabled = soundEnabled
  }, [voiceEnabled, soundEnabled])

  useEffect(() => {
    scrollChatToBottom(chatEndRef)
  }, [currentMessages.length, showActivity, loadingReply])

  useEffect(() => {
    let isMounted = true
    ;(async () => {
      const remote = await fetchRemoteTopics()
      if (!isMounted) return
      if (remote.length) {
        setCustomTopics(remote.map(normalizeRemoteTopic))
      }
      setRemoteTopicsLoaded(true)
    })()
    return () => {
      isMounted = false
    }
  }, [])

  useEffect(() => {
    if (!profile.id && profile.fullName.trim()) {
      const nextStudentId = uid('student')
      setProfile((previous) => ({ ...previous, id: nextStudentId }))
    }
  }, [profile.fullName, profile.id])

  useEffect(() => {
    syncStudent(profile)
  }, [profile])

  useEffect(() => {
    if (currentSession) {
      syncSession(currentSession)
    }
  }, [currentSession])

  useEffect(() => {
    if (currentSession) {
      const lastMessage = currentSession.messages.at(-1)
      if (lastMessage) {
        syncMessage(lastMessage)
      }
    }
  }, [currentSession?.messages?.length])

  useEffect(() => {
    if (!selectedTopic && topicList.length) {
      setTopicId(topicList[0].id)
    }
  }, [topicList, selectedTopic])

  function startSession() {
    if (!profile.fullName.trim()) {
      setAssistantNotice('Primero guardemos el perfil para seguir. 💛')
      setScreen('profile')
      return
    }

    const activeTopic = selectedTopic || topicList[0]
    if (!activeTopic) {
      setAssistantNotice('Selecciona un tema antes de empezar.')
      setScreen('topics')
      return
    }

    let studentId = profile.id
    if (!studentId) {
      studentId = uid('student')
      setProfile((previous) => ({ ...previous, id: studentId }))
    }

    const newSession = {
      id: uid('session'),
      studentId,
      subject: selectedSubject.id,
      subjectName: selectedSubject.name,
      topicId: activeTopic.id,
      topicName: activeTopic.title,
      startedAt: new Date().toISOString(),
      endedAt: null,
      durationMin: null,
      status: 'active',
      points: 10,
      messages: [
        {
          id: uid('msg'),
          sessionId: null,
          role: 'tutor',
          content: `¡Hola ${profile.fullName}! Soy el Profe Ervin. Hoy vamos a explorar ${activeTopic.title} con curiosidad y alegría. ¿Qué te gustaría descubrir primero?`,
          createdAt: new Date().toISOString(),
        },
      ],
      activitiesCompleted: [],
      badges: [],
      voiceUsed: 0,
    }

    newSession.messages[0].sessionId = newSession.id
    setSessions((previous) => [newSession, ...previous])
    setActiveSessionId(newSession.id)
    setScreen('chat')
    setShowActivity(false)
    setActivitySelection(null)
    setActivityCompleted(false)
    setAssistantNotice('¡Sesión lista! El Profe Ervin ya está acompañando.')
    speakText(newSession.messages[0].content)
  }

  async function submitMessage(messageOverride = '') {
    const message = (messageOverride || inputText).trim()
    if (!message || !currentSession) return

    const updatedSessions = sessions.map((session) => {
      if (session.id !== currentSession.id) return session
      const studentMessage = {
        id: uid('msg'),
        sessionId: session.id,
        role: 'student',
        content: message,
        createdAt: new Date().toISOString(),
      }
      return {
        ...session,
        messages: [...session.messages, studentMessage],
        points: session.points + 5,
      }
    })

    setSessions(updatedSessions)
    setInputText('')
    setLoadingReply(true)
    setAssistantNotice('El Profe Ervin está pensando con cariño...')

    try {
      const recentMessages = updatedSessions.find((session) => session.id === currentSession.id)?.messages || []
      const tutorReply = await requestTutorReply({
        studentName: profile.fullName,
        age: Number(profile.age) || 6,
        subject: selectedSubject.id,
        subjectName: selectedSubject.name,
        topic: selectedTopic?.title || 'Tema libre',
        topicPrompt: selectedTopic?.prompt || '',
        messages: recentMessages.slice(0, -1).slice(-MAX_HISTORY_MESSAGES),
        message,
        turnCount: recentMessages.length,
      })

      const sessionId = currentSession.id
      const parsed = extractActivityTag(tutorReply)
      const tutorMessage = {
        id: uid('msg'),
        sessionId,
        role: 'tutor',
        content: parsed.text,
        createdAt: new Date().toISOString(),
      }

      setSessions((previous) =>
        previous.map((session) => {
          if (session.id !== sessionId) return session
          return {
            ...session,
            messages: [...session.messages, tutorMessage],
            points: session.points + 5,
            activitiesCompleted: parsed.activity
              ? [...new Set([...session.activitiesCompleted, parsed.activity])]
              : session.activitiesCompleted,
          }
        }),
      )

      setAssistantNotice(
        parsed.activity ? `¡Profe Ervin sugirió una actividad: ${parsed.activity}!` : 'El Profe Ervin respondió con calma.',
      )
      speakText(parsed.text)
      if (parsed.activity) {
        setShowActivity(true)
        setActivitySelection(null)
      }
    } catch {
      const fallback = fallbackTutorReply({
        message,
        subjectName: selectedSubject.id,
        topicName: selectedTopic?.title || 'este tema',
        turnCount: currentMessages.length,
      })
      const parsed = extractActivityTag(fallback)
      const tutorMessage = {
        id: uid('msg'),
        sessionId: currentSession.id,
        role: 'tutor',
        content: parsed.
