// PDF зі звіту. Сам pdfmake і шрифт вантажаться лише на натискання кнопки.
//
// Шрифт — Liberation Serif: він метрично збігається з Times New Roman (тож
// PDF виглядає як DOCX) і має кирилицю, якої в стандартних шрифтах PDF немає.
// Файли лежать у public/fonts разом із ліцензією SIL OFL.
import type { DocSection, ReportDocumentModel } from './reportDocument'

const MM = 72 / 25.4 // пунктів в одному міліметрі
const PAGE_WIDTH = 595.28 // A4
const MARGINS: [number, number, number, number] = [30 * MM, 20 * MM, 15 * MM, 20 * MM] // ліве, верх, праве, низ
const CONTENT_WIDTH = PAGE_WIDTH - MARGINS[0] - MARGINS[2]
const CELL_PADDING = 4

const FONT = 'LiberationSerif'
const FONT_FILES = {
  normal: 'LiberationSerif-Regular.ttf',
  bold: 'LiberationSerif-Bold.ttf',
}

function sectionContent(section: DocSection): object[] {
  const { columns, rows, total } = section.table
  const sum = columns.reduce((acc, column) => acc + column.width, 0)
  // pdfmake рахує ширину без внутрішніх відступів і рамок — віднімаємо їх.
  const available = CONTENT_WIDTH - columns.length * (CELL_PADDING * 2 + 1) - 1
  const widths = columns.map((column) => (available * column.width) / sum)

  const header = columns.map((column) => ({ text: column.header, bold: true, alignment: 'center' }))
  const body = rows.map((row) => row.map((text, i) => ({ text, alignment: columns[i].align })))
  const totalRow = total ? [total.map((text, i) => ({ text, bold: true, alignment: columns[i].align }))] : []

  const content: object[] = [
    { text: section.heading, bold: true, fontSize: 14, margin: [0, 14, 0, 6], headlineLevel: 1 },
    {
      table: { headerRows: 1, widths, body: [header, ...body, ...totalRow], dontBreakRows: true },
      layout: {
        hLineWidth: () => 0.5,
        vLineWidth: () => 0.5,
        paddingLeft: () => CELL_PADDING,
        paddingRight: () => CELL_PADDING,
        paddingTop: () => 2,
        paddingBottom: () => 2,
      },
    },
  ]
  if (section.note) {
    content.push({ text: section.note, fontSize: 11, color: '#444444', margin: [0, 4, 0, 0] })
  }
  return content
}

/** Опис документа для pdfmake. Чиста функція — її й перевіряють тести. */
export function pdfDefinition(model: ReportDocumentModel): object {
  return {
    pageSize: 'A4',
    pageMargins: MARGINS,
    info: { title: `${model.title} ${model.period}`, creator: 'Шкільне харчування' },
    defaultStyle: { font: FONT, fontSize: 12, lineHeight: 1.1 },
    content: [
      {
        columns: [
          { width: '*', text: '' },
          {
            width: CONTENT_WIDTH * 0.48,
            fontSize: 14,
            stack: model.approval.map((text) => ({ text, margin: [0, 0, 0, 6] })),
          },
        ],
      },
      { text: model.title, bold: true, fontSize: 14, alignment: 'center', margin: [0, 28, 0, 2] },
      { text: model.period, fontSize: 14, alignment: 'center', margin: [0, 0, 0, 10] },
      ...model.sections.flatMap(sectionContent),
    ],
    // Заголовок розділу не лишається сиротою внизу сторінки.
    pageBreakBefore: (
      node: { headlineLevel?: number; startPosition: { verticalRatio: number } },
    ) => node.headlineLevel === 1 && node.startPosition.verticalRatio > 0.85,
  }
}

async function fontBase64(file: string): Promise<string> {
  const response = await fetch(`${import.meta.env.BASE_URL}fonts/${file}`)
  if (!response.ok) throw new Error('Не вдалося завантажити шрифт для PDF.')
  const bytes = new Uint8Array(await response.arrayBuffer())
  // btoa приймає рядок; шматками, щоб не впертися в ліміт аргументів.
  let binary = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(binary)
}

export async function pdfBlob(model: ReportDocumentModel): Promise<Blob> {
  const [{ default: pdfMake }, normal, bold] = await Promise.all([
    import('pdfmake/build/pdfmake'),
    fontBase64(FONT_FILES.normal),
    fontBase64(FONT_FILES.bold),
  ])
  pdfMake.addVirtualFileSystem({ [FONT_FILES.normal]: normal, [FONT_FILES.bold]: bold })
  pdfMake.addFonts({
    [FONT]: {
      normal: FONT_FILES.normal,
      bold: FONT_FILES.bold,
      // Курсиву в звіті немає, але pdfmake вимагає всі накреслення.
      italics: FONT_FILES.normal,
      bolditalics: FONT_FILES.bold,
    },
  })
  return pdfMake.createPdf(pdfDefinition(model)).getBlob()
}
