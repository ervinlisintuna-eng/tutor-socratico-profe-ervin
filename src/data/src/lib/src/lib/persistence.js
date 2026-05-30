import { supabase } from './supabase'

const KEY_PREFIX = 'profe-ervin:web:v1'

export function loadLocalAppState() {
  try {
    const raw = localStorage.getItem(KEY_PREFIX)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

export function saveLocalAppState(state) {
  try {
    localStorage.setItem(KEY_PREFIX, JSON.stringify(state))
  } catch {
    // No hacemos nada: el modo local sigue funcionando.
  }
}

export function createId(prefix) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}_${Date.now().toString(36)}`
}

export async function syncStudent(student) {
  if (!supabase) return
  try {
    await supabase.from('students').upsert(
      {
        id: student.id,
        full_name: student.fullName,
        age: student.age ?? null,
        school_name: student.schoolName ?? null,
        avatar_url: student.avatar?.emoji ?? null,
        pin_hash: student.pin || null,
      },
      { onConflict: 'id' },
    )
  } catch {
    // Modo resiliente: el flujo local no se interrumpe.
  }
}

export async function syncSession(session) {
  if (!supabase) return
  try {
    await supabase.from('sessions').upsert(
      {
        id: session.id,
        student_id: session.studentId,
        subject: session.subject,
        topic_id: session.topicId,
        started_at: session.startedAt,
        ended_at: session.endedAt ?? null,
        duration_min: session.durationMin ?? null,
        total_points: session.points ?? 0,
        status: session.status,
      },
      { onConflict: 'id' },
    )
  } catch {
    // No-op
  }
}

export async function syncMessage(message) {
  if (!supabase) return
  try {
    await supabase.from('messages').insert({
      id: message.id,
      session_id: message.sessionId,
      role: message.role,
      content: message.content,
    })
  } catch {
    // No-op
  }
}

export async function syncCertificate(certificate) {
  if (!supabase) return
  try {
    await supabase.from('certificates').insert({
      id: certificate.id,
      student_id: certificate.studentId,
      session_id: certificate.sessionId,
      pdf_url: certificate.pdfUrl ?? null,
      content_json: certificate.content,
    })
  } catch {
    // No-op
  }
}

export async function fetchRemoteTopics() {
  if (!supabase) return []
  try {
    const { data, error } = await supabase
      .from('topics')
      .select('*')
      .eq('is_active', true)
      .order('order_index', { ascending: true })

    if (error) return []
    return data ?? []
  } catch {
    return []
  }
}
