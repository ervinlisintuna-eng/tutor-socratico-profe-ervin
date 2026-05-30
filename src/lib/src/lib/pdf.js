import { jsPDF } from 'jspdf'

const palette = {
  yellow: '#FFD54F',
  blue: '#4FC3F7',
  green: '#81C784',
  purple: '#B39DDB',
  orange: '#FFB74D',
  navy: '#1A237E',
}

export function generateCertificatePdf({
  studentName,
  subjectName,
  topicNames,
  dateLabel,
  durationLabel,
  points,
  badges,
  message,
  schoolName,
}) {
  const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' })
  const width = pdf.internal.pageSize.getWidth()
  const height = pdf.internal.pageSize.getHeight()

  pdf.setFillColor(250, 248, 242)
  pdf.rect(0, 0, width, height, 'F')

  pdf.setDrawColor(79, 195, 247)
  pdf.setLineWidth(1.5)
  pdf.roundedRect(8, 8, width - 16, height - 16, 8, 8, 'S')

  pdf.setFillColor(255, 240, 190)
  pdf.circle(22, 22, 11, 'F')
  pdf.setFillColor(79, 195, 247)
  pdf.circle(width - 22, 22, 11, 'F')
  pdf.setFillColor(129, 199, 132)
  pdf.circle(22, height - 22, 11, 'F')

  pdf.setFont('helvetica', 'bold')
  pdf.setTextColor(palette.navy)
  pdf.setFontSize(26)
  pdf.text('CERTIFICADO DE PARTICIPACIÓN', width / 2, 28, { align: 'center' })

  pdf.setFontSize(14)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Otorgado con orgullo a:', width / 2, 42, { align: 'center' })

  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(24)
  pdf.text(studentName || 'Estudiante Valiente', width / 2, 54, { align: 'center' })

  pdf.setFont('helvetica', 'normal')
  pdf.setFontSize(13)
  pdf.text(`Asignatura: ${subjectName}`, 20, 72)
  pdf.text(`Temas revisados: ${topicNames.join(', ') || '—'}`, 20, 82)
  pdf.text(`Fecha: ${dateLabel}`, 20, 92)
  pdf.text(`Duración: ${durationLabel}`, 20, 102)
  pdf.text(`Puntos acumulados: ${points}`, 20, 112)
  pdf.text(`Medallas obtenidas: ${badges.join(', ') || '—'}`, 20, 122)

  pdf.setFillColor(243, 229, 245)
  pdf.roundedRect(156, 62, 126, 58, 6, 6, 'F')
  pdf.setTextColor(94, 53, 177)
  pdf.setFont('helvetica', 'italic')
  pdf.setFontSize(14)
  const wrappedMessage = pdf.splitTextToSize(`“${message}”`, 110)
  pdf.text(wrappedMessage, 168, 78)

  pdf.setTextColor(palette.navy)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(11)
  pdf.text('Firma digital del Profe Ervin Lisintuña', width - 74, height - 34, { align: 'center' })
  pdf.setDrawColor(26, 35, 126)
  pdf.line(width - 108, height - 28, width - 40, height - 28)
  pdf.setFont('helvetica', 'normal')
  pdf.text('Docente de Primero de Básica', width - 74, height - 20, { align: 'center' })

  pdf.setFontSize(10)
  pdf.setTextColor(88, 88, 88)
  pdf.text(
    schoolName ? `Institución: ${schoolName}` : 'Institución educativa: configurable por la familia',
    20,
    height - 14,
  )

  pdf.setFillColor(255, 248, 225)
  pdf.roundedRect(width - 116, 18, 92, 24, 8, 8, 'F')
  pdf.setTextColor(218, 165, 32)
  pdf.setFont('helvetica', 'bold')
  pdf.setFontSize(18)
  pdf.text('★', width - 61, 33, { align: 'center' })

  const filename = `Certificado_${sanitizeFilename(studentName || 'Estudiante')}_${formatDateForFile()}.pdf`
  pdf.save(filename)
  return filename
}

function sanitizeFilename(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
}

function formatDateForFile() {
  return new Date().toISOString().slice(0, 10)
}
