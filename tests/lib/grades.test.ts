import { describe, expect, it } from 'vitest'
import { compareClassNames, gradeRange, parseGrade, unparsableClassNames } from '@/lib/grades'

describe('parseGrade', () => {
  it('бере число з початку назви', () => {
    expect(parseGrade('7-А')).toBe(7)
    expect(parseGrade('10-Б')).toBe(10)
    expect(parseGrade('1-А')).toBe(1)
    expect(parseGrade('11 В')).toBe(11)
  })

  // Так само толерантно, як regexp у базі: пробіли попереду допустимі.
  it('не зважає на пробіли попереду', () => {
    expect(parseGrade('  5-А')).toBe(5)
  })

  it('без числа на початку повертає null', () => {
    expect(parseGrade('Підготовчий')).toBeNull()
    expect(parseGrade('А-7')).toBeNull()
    expect(parseGrade('')).toBeNull()
  })

  // '0-А' база розібрала б як 0 і спробувала створити клас «1-А» з нуля;
  // краще вважати таку назву непридатною.
  it('нуль не вважає паралеллю', () => {
    expect(parseGrade('0-А')).toBeNull()
  })
})

describe('gradeRange', () => {
  // Головне, навіщо все це: школа з початковими класами.
  it('для школи 1–11 дає межі 1 і 11', () => {
    const names = ['1-А', '1-Б', '4-А', '5-А', '9-Б', '11-А']
    expect(gradeRange(names)).toEqual({ min: 1, max: 11 })
  })

  it('для школи 5–11 дає межі 5 і 11', () => {
    expect(gradeRange(['5-А', '7-Б', '11-А'])).toEqual({ min: 5, max: 11 })
  })

  it('назви без паралелі не враховує', () => {
    expect(gradeRange(['Підготовчий', '3-А', '4-Б'])).toEqual({ min: 3, max: 4 })
  })

  it('без жодної придатної назви повертає null', () => {
    expect(gradeRange([])).toBeNull()
    expect(gradeRange(['Підготовчий'])).toBeNull()
  })
})

describe('unparsableClassNames', () => {
  it('повертає саме ті назви, які зупинять переведення', () => {
    expect(unparsableClassNames(['1-А', 'Підготовчий', '11-Б', 'Логопедичний'])).toEqual([
      'Підготовчий',
      'Логопедичний',
    ])
  })

  it('коли всі назви правильні — порожній список', () => {
    expect(unparsableClassNames(['1-А', '11-Б'])).toEqual([])
  })
})

describe('compareClassNames', () => {
  // Сервер сортує назви як рядки, і в школі 1–11 «10-А» стояв перед «2-А».
  it('упорядковує паралелі числом, а не як рядки', () => {
    const names = ['10-А', '2-А', '11-А', '1-Б', '1-А', '9-А']
    expect([...names].sort(compareClassNames)).toEqual(['1-А', '1-Б', '2-А', '9-А', '10-А', '11-А'])
  })

  it('усередині паралелі — за літерою', () => {
    expect(['7-В', '7-А', '7-Б'].sort(compareClassNames)).toEqual(['7-А', '7-Б', '7-В'])
  })

  it('назви без паралелі ставить у кінець', () => {
    expect(['Підготовчий', '5-А', '1-А'].sort(compareClassNames)).toEqual(['1-А', '5-А', 'Підготовчий'])
  })
})
