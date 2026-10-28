// DOCX зі звіту. Модуль вантажиться лише на натискання кнопки: бібліотека
// docx важить сотні кілобайт, і решті застосунку вона ні до чого.
import {
  AlignmentType,
  BorderStyle,
  Document,
  Packer,
  Paragraph,
  Table,
  TableCell,
  TableRow,
  TextRun,
  WidthType,
} from 'docx'
import type { Align, DocSection, ReportDocumentModel } from './reportDocument'

// Аркуш A4 і поля за ДСТУ 4163: ліве 30 мм, праве 15, верх і низ по 20.
const MM = 56.7 // twips
const PAGE = { width: 11906, height: 16838 }
const MARGIN = { top: Math.round(20 * MM), bottom: Math.round(20 * MM), left: Math.round(30 * MM), right: Math.round(15 * MM) }
const CONTENT_WIDTH = PAGE.width - MARGIN.left - MARGIN.right

const FONT = 'Times New Roman'
const pt = (size: number) => size * 2 // docx міряє розмір у півпунктах

const ALIGN: Record<Align, (typeof AlignmentType)[keyof typeof AlignmentType]> = {
  left: AlignmentType.LEFT,
  center: AlignmentType.CENTER,
  right: AlignmentType.RIGHT,
}

const BORDER = { style: BorderStyle.SINGLE, size: 4, color: '000000' }
const BORDERS = { top: BORDER, bottom: BORDER, left: BORDER, right: BORDER }

function cell(text: string, width: number, align: Align, bold = false): TableCell {
  return new TableCell({
    width: { size: width, type: WidthType.DXA },
    borders: BORDERS,
    margins: { top: 40, bottom: 40, left: 90, right: 90 },
    children: [
      new Paragraph({
        alignment: ALIGN[align],
        children: [new TextRun({ text, bold, size: pt(12), font: FONT })],
      }),
    ],
  })
}

function sectionBlocks(section: DocSection): Array<Paragraph | Table> {
  const { columns, rows, total } = section.table
  const sum = columns.reduce((acc, column) => acc + column.width, 0)
  const widths = columns.map((column) => Math.floor((CONTENT_WIDTH * column.width) / sum))

  const header = new TableRow({
    tableHeader: true,
    children: columns.map((column, i) => cell(column.header, widths[i], 'center', true)),
  })
  const body = rows.map(
    (row) => new TableRow({ children: row.map((text, i) => cell(text, widths[i], columns[i].align)) }),
  )
  const totalRow = total
    ? [new TableRow({ children: total.map((text, i) => cell(text, widths[i], columns[i].align, true)) })]
    : []

  const blocks: Array<Paragraph | Table> = [
    new Paragraph({
      spacing: { before: 280, after: 120 },
      keepNext: true,
      children: [new TextRun({ text: section.heading, bold: true, size: pt(14), font: FONT })],
    }),
    new Table({
      width: { size: CONTENT_WIDTH, type: WidthType.DXA },
      columnWidths: widths,
      rows: [header, ...body, ...totalRow],
    }),
  ]
  if (section.note) {
    blocks.push(
      new Paragraph({
        spacing: { before: 80 },
        children: [new TextRun({ text: section.note, size: pt(11), font: FONT, color: '444444' })],
      }),
    )
  }
  return blocks
}

export function buildDocx(model: ReportDocumentModel): Document {
  // Блок «ЗАТВЕРДЖУЮ» — у правій половині аркуша, як на бланку.
  const approvalIndent = Math.round(CONTENT_WIDTH * 0.52)
  const approval = model.approval.map(
    (text) =>
      new Paragraph({
        indent: { left: approvalIndent },
        spacing: { after: 120 },
        children: [new TextRun({ text, size: pt(14), font: FONT })],
      }),
  )

  return new Document({
    creator: 'Шкільне харчування',
    title: `${model.title} ${model.period}`,
    styles: { default: { document: { run: { font: FONT, size: pt(14) } } } },
    sections: [
      {
        properties: { page: { size: PAGE, margin: MARGIN } },
        children: [
          ...approval,
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { before: 480, after: 60 },
            children: [new TextRun({ text: model.title, bold: true, size: pt(14), font: FONT })],
          }),
          new Paragraph({
            alignment: AlignmentType.CENTER,
            spacing: { after: 240 },
            children: [new TextRun({ text: model.period, size: pt(14), font: FONT })],
          }),
          ...model.sections.flatMap(sectionBlocks),
        ],
      },
    ],
  })
}

export function docxBlob(model: ReportDocumentModel): Promise<Blob> {
  return Packer.toBlob(buildDocx(model))
}
