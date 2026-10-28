import { describe, expect, it } from 'vitest'
import { Packer } from 'docx'
import { strFromU8, unzipSync } from 'fflate'
import { buildDocx } from '@/lib/reportDocx'
import type { ReportDocumentModel } from '@/lib/reportDocument'

const model: ReportDocumentModel = {
  approval: ['ЗАТВЕРДЖУЮ', 'Директор', '____________ Олена ПЕТРЕНКО', '«___» ______________ 2026 р.'],
  title: 'ЗВІТ ПРО ОРГАНІЗАЦІЮ ХАРЧУВАННЯ УЧНІВ',
  period: 'за жовтень 2026 року',
  sections: [
    {
      heading: '1. Загальна інформація',
      table: {
        columns: [
          { header: 'Показник', align: 'left', width: 3 },
          { header: 'Значення', align: 'right', width: 1 },
        ],
        rows: [['Кількість днів харчування', '21']],
        total: ['Разом', '21'],
      },
      note: 'Примітка до таблиці',
    },
  ],
}

async function documentXml(): Promise<string> {
  const buffer = await Packer.toBuffer(buildDocx(model))
  const files = unzipSync(new Uint8Array(buffer))
  return strFromU8(files['word/document.xml'])
}

describe('DOCX', () => {
  it('містить шапку, заголовок, період і таблицю', async () => {
    const xml = await documentXml()
    for (const text of [
      'ЗАТВЕРДЖУЮ',
      '____________ Олена ПЕТРЕНКО',
      '«___» ______________ 2026 р.',
      'ЗВІТ ПРО ОРГАНІЗАЦІЮ ХАРЧУВАННЯ УЧНІВ',
      'за жовтень 2026 року',
      '1. Загальна інформація',
      'Кількість днів харчування',
      'Примітка до таблиці',
    ]) {
      expect(xml).toContain(text)
    }
    // заголовок + рядок + підсумок
    expect(xml.match(/<w:tr[ >]/g)).toHaveLength(3)
  })

  it('шрифт Times New Roman, аркуш A4 з полем 30 мм ліворуч', async () => {
    const xml = await documentXml()
    expect(xml).toContain('w:ascii="Times New Roman"')
    expect(xml).toMatch(/<w:pgSz w:w="11906" w:h="16838"/)
    expect(xml).toMatch(/w:left="1701"/)
  })
})
