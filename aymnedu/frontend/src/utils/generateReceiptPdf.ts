import { jsPDF } from 'jspdf'
import type { Paiement } from '@/types'

export function generateReceiptPdf(paiement: Paiement, schoolName = 'AymnEDU — Centre de Soutien Scolaire') {
  // A5 format (148mm x 210mm) in portrait mode
  const doc = new jsPDF({
    orientation: 'portrait',
    unit: 'mm',
    format: 'a5',
  })

  const pageWidth = 148
  const margin = 14
  const contentWidth = pageWidth - margin * 2

  const isPartiel = paiement.statut === 'partiel'
  const montantTotal = Number(paiement.montant || 0)
  const montantVerse = Number(paiement.montant_verse ?? (isPartiel ? montantTotal / 2 : montantTotal))
  const resteAPayer = Math.max(0, montantTotal - montantVerse)

  // ── 1. Header Banner ────────────────────────────────────────────────────────
  doc.setFillColor(15, 23, 42) // #0f172a Slate 900
  doc.roundedRect(margin, 12, contentWidth, 22, 2.5, 2.5, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(13)
  doc.text(schoolName, pageWidth / 2, 21, { align: 'center' })

  doc.setTextColor(56, 189, 248) // Sky 400
  doc.setFont('helvetica', 'normal')
  doc.setFontSize(9)
  const subTitle = isPartiel
    ? "REÇU D'ACOMPTE / VERSEMENT PARTIEL"
    : "REÇU D'ENCAISSEMENT & JUSTIFICATIF DE PAIEMENT"
  doc.text(subTitle, pageWidth / 2, 28, { align: 'center' })

  // ── 2. Receipt Reference Bar ────────────────────────────────────────────────
  const recuNo = paiement.recu_numero || `REC-${paiement.id.toString().padStart(4, '0')}`
  const dateStr = paiement.date_paiement
    ? new Date(paiement.date_paiement).toLocaleDateString('fr-DZ', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : new Date().toLocaleDateString('fr-DZ')

  doc.setFillColor(248, 250, 252) // Slate 50
  doc.setDrawColor(226, 232, 240) // Slate 200
  doc.roundedRect(margin, 38, contentWidth, 12, 1.5, 1.5, 'FD')

  doc.setTextColor(30, 41, 59)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9)
  doc.text(`N° Reçu :  ${recuNo}`, margin + 4, 45.5)

  doc.setFont('helvetica', 'normal')
  doc.setTextColor(100, 116, 139)
  doc.text(`Date : ${dateStr}`, pageWidth - margin - 4, 45.5, { align: 'right' })

  // ── 3. Student & Course Information Table ───────────────────────────────────
  let y = 56
  const rowHeight = 8.5

  const statutLabel = isPartiel ? "VERSEMENT PARTIEL" : "RÉGLÉ EN TOTALITÉ (Soldé)"

  const details = [
    { label: "Nom & Prénom de l'élève :", value: paiement.eleve_nom || 'Non spécifié' },
    { label: "Groupe / Matière :",        value: paiement.groupe_nom || 'Non spécifié' },
    { label: "Mois concerné :",           value: String(paiement.mois || '—') },
    { label: "Mode de règlement :",        value: "Espèces / Caisse centrale" },
    { label: "Statut du règlement :",     value: statutLabel },
  ]

  if (isPartiel) {
    details.push({ label: "Total dû pour ce mois :", value: `${montantTotal.toLocaleString('fr-DZ')} DZD` })
    details.push({ label: "Reste à payer :", value: `${resteAPayer.toLocaleString('fr-DZ')} DZD` })
  }

  doc.setFontSize(9)
  details.forEach((row, index) => {
    if (index % 2 === 0) {
      doc.setFillColor(248, 250, 252)
      doc.rect(margin, y - 5.5, contentWidth, rowHeight, 'F')
    }

    doc.setFont('helvetica', 'bold')
    doc.setTextColor(71, 85, 105)
    doc.text(row.label, margin + 4, y)

    const isStatut = row.label.startsWith('Statut')
    const isReste = row.label.startsWith('Reste')
    doc.setFont('helvetica', isStatut || isReste ? 'bold' : 'normal')
    if (isReste) {
      doc.setTextColor(217, 119, 6) // Amber 600
    } else if (isStatut) {
      doc.setTextColor(isPartiel ? 217 : 16, isPartiel ? 119 : 149, isPartiel ? 6 : 93)
    } else {
      doc.setTextColor(15, 23, 42)
    }
    doc.text(row.value, pageWidth - margin - 4, y, { align: 'right' })

    doc.setDrawColor(226, 232, 240)
    doc.setLineDashPattern([0.8, 0.8], 0)
    doc.line(margin + 2, y + 2, pageWidth - margin - 2, y + 2)
    doc.setLineDashPattern([], 0)

    y += rowHeight
  })

  // ── 4. Total Amount Highlighted Box ─────────────────────────────────────────
  y += 4
  doc.setFillColor(isPartiel ? 254 : 240, isPartiel ? 243 : 253, isPartiel ? 199 : 244) // Amber or Emerald
  doc.setDrawColor(isPartiel ? 245 : 16, isPartiel ? 158 : 185, isPartiel ? 11 : 129)
  doc.setLineWidth(0.6)
  doc.roundedRect(margin, y, contentWidth, 16, 2, 2, 'FD')

  doc.setFont('helvetica', 'bold')
  doc.setFontSize(9.5)
  doc.setTextColor(isPartiel ? 146 : 6, isPartiel ? 64 : 95, isPartiel ? 14 : 70)
  const boxTitle = isPartiel ? "MONTANT ENCAISSÉ À CE JOUR :" : "MONTANT TOTAL ENCAISSÉ :"
  doc.text(boxTitle, margin + 6, y + 10)

  doc.setFontSize(13)
  doc.setTextColor(isPartiel ? 180 : 4, isPartiel ? 83 : 120, isPartiel ? 9 : 87)
  const montantAffiche = isPartiel ? montantVerse : montantTotal
  doc.text(`${montantAffiche.toLocaleString('fr-DZ')} DZD`, pageWidth - margin - 6, y + 10.5, { align: 'right' })

  // ── 5. Stamp & Signature Box ────────────────────────────────────────────────
  y += 22
  const boxWidth = (contentWidth - 8) / 2
  const boxHeight = 22

  // Left: Cachet
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.3)
  doc.setLineDashPattern([1.5, 1.5], 0)
  doc.roundedRect(margin, y, boxWidth, boxHeight, 1.5, 1.5, 'D')

  doc.setLineDashPattern([], 0)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(8)
  doc.setTextColor(100, 116, 139)
  doc.text("Cachet de l'établissement :", margin + 3, y + 5)

  // Right: Signature
  doc.setDrawColor(203, 213, 225)
  doc.setLineWidth(0.3)
  doc.setLineDashPattern([1.5, 1.5], 0)
  doc.roundedRect(margin + boxWidth + 8, y, boxWidth, boxHeight, 1.5, 1.5, 'D')

  doc.setLineDashPattern([], 0)
  doc.text("Signature caisse / direction :", margin + boxWidth + 11, y + 5)

  // ── 6. Legal / Archival Footer ──────────────────────────────────────────────
  doc.setFont('helvetica', 'italic')
  doc.setFontSize(7.5)
  doc.setTextColor(148, 163, 184)
  const footerText = "Ce reçu original fait foi de paiement. À conserver précieusement par le tuteur légal."
  doc.text(footerText, pageWidth / 2, 198, { align: 'center' })

  const safeName = (paiement.eleve_nom || 'Eleve').replace(/[^a-zA-Z0-9_-]/g, '_')
  const fileName = `Recu_${recuNo}_${safeName}.pdf`

  doc.save(fileName)
}
