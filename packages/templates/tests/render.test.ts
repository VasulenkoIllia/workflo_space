import { describe, expect, it } from 'vitest'
import {
  type DocumentRenderData,
  defaultContractSections,
  renderDocumentHtml,
} from '../src/render.js'

const BASE: DocumentRenderData = {
  typeLabel: 'Рахунок',
  number: 'INV-2026-000007',
  date: '03.07.2026',
  orderTitle: 'CRM інтеграція з 1C',
  projectName: 'Автоматизація продажів',
  amount: '12 000,00',
  currency: 'USD',
  issuer: {
    name: 'ФОП Васюленко',
    legalName: 'ФОП Васюленко Ілля Сергійович',
    taxId: '3456789012',
    legalAddress: 'м. Луцьк, вул. Тестова 1',
    bankName: 'Приват',
    iban: 'UA123456789012345678901234567',
    signerName: 'Васюленко І. С.',
    signerTitle: 'ФОП',
  },
  recipient: {
    name: 'ТОВ Партнер',
    legalName: 'ТОВ «Партнер»',
    taxId: '12345678',
    legalAddress: 'м. Київ, вул. Клієнтська 2',
  },
}

describe('renderDocumentHtml — повний UA-комплект (06)', () => {
  it('invoice: позиції, ПДВ-рядок, до сплати, призначення платежу, грн-еквівалент', () => {
    const html = renderDocumentHtml('invoice', {
      ...BASE,
      dueDate: '10.07.2026',
      vatNote: 'без ПДВ (неплатник ПДВ)',
      uahTotal: '495 428,40',
      rateNote: 'за курсом 41,2857 грн/USD від 03.07.2026',
      paymentPurpose: 'Оплата за рахунком № INV-2026-000007 від 03.07.2026. Без ПДВ.',
      lines: [
        { name: 'Бекенд-інтеграція', qty: '40,00', unit: 'год', price: '200,00', sum: '8 000,00' },
        {
          name: 'Налаштування обміну',
          qty: '20,00',
          unit: 'год',
          price: '200,00',
          sum: '4 000,00',
        },
      ],
    })
    expect(html).toContain('INV-2026-000007')
    expect(html).toContain('Постачальник')
    expect(html).toContain('Бекенд-інтеграція')
    expect(html).toContain('8 000,00')
    expect(html).toContain('без ПДВ (неплатник ПДВ)')
    expect(html).toContain('до сплати')
    expect(html).toContain('₴495 428,40')
    expect(html).toContain('призначення платежу')
    expect(html).toContain('сплатити до')
  })

  it('invoice без ліній: одна фолбек-позиція із замовлення', () => {
    const html = renderDocumentHtml('invoice', BASE)
    expect(html).toContain('CRM інтеграція з 1C')
    expect(html).toContain('послуга')
  })

  it('completion_act: період, підстава, приймання-передача, двосторонні підписи', () => {
    const html = renderDocumentHtml('completion_act', {
      ...BASE,
      typeLabel: 'Акт виконаних робіт',
      number: 'ACT-2026-000003',
      periodFrom: '01.06.2026',
      periodTo: '03.07.2026',
      basisRef: 'Рахунок INV-2026-000007 від 03.07.2026',
      lines: [
        { name: 'Розробка модуля', qty: '60,00', unit: 'год', price: '200,00', sum: '12 000,00' },
      ],
    })
    expect(html).toContain('ACT-2026-000003')
    expect(html).toContain('Перелік виконаних робіт')
    expect(html).toContain('підстава')
    expect(html).toContain('Сторони претензій одна до одної не мають')
    expect(html).toContain('Виконавець')
    expect(html).toContain('Замовник')
    expect(html).toContain('сума за актом')
  })

  it('reconciliation_act: сальдо, обороти, деталізація, 10 днів на розбіжності', () => {
    const html = renderDocumentHtml('reconciliation_act', {
      ...BASE,
      typeLabel: 'Акт звірки',
      number: 'REC-2026-000001',
      periodFrom: '01.01.2026',
      periodTo: '03.07.2026',
      opening: '0,00',
      totalDebit: '20 000,00',
      totalCredit: '15 000,00',
      closing: '5 000,00',
      operations: [
        {
          date: '01.02.2026',
          doc: 'нарахування',
          desc: 'Підписка · лютий',
          debit: '10 000,00',
          credit: null,
        },
        {
          date: '15.02.2026',
          doc: 'оплата',
          desc: 'bank_transfer',
          debit: null,
          credit: '10 000,00',
        },
        {
          date: '01.03.2026',
          doc: 'нарахування',
          desc: 'Підписка · березень',
          debit: '10 000,00',
          credit: null,
        },
        {
          date: '20.03.2026',
          doc: 'оплата',
          desc: 'bank_transfer',
          debit: null,
          credit: '5 000,00',
        },
      ],
    })
    expect(html).toContain('REC-2026-000001')
    expect(html).toContain('сальдо на початок')
    expect(html).toContain('сальдо на кінець')
    expect(html).toContain('5 000,00')
    expect(html).toContain('РАЗОМ ОБОРОТИ')
    expect(html).toContain('Підписка · лютий')
    expect(html).toContain('10 (десяти) календарних днів')
  })

  it('specification: контекст, позиції, бюджет', () => {
    const html = renderDocumentHtml('specification', {
      ...BASE,
      typeLabel: 'Специфікація',
      number: 'SPC-2026-000002',
      description: 'Інтеграція CRM із 1C: обмін замовленнями і залишками.',
      lines: [
        { name: 'Модуль обміну', qty: '40,00', unit: 'год', price: '200,00', sum: '8 000,00' },
      ],
    })
    expect(html).toContain('SPC-2026-000002')
    expect(html).toContain('Контекст')
    expect(html).toContain('Інтеграція CRM із 1C')
    expect(html).toContain('бюджет')
    expect(html).toContain('Модуль обміну')
  })

  it('contract: сторони з реквізитами і типові розділи; предмет містить замовлення', () => {
    const html = renderDocumentHtml('contract', {
      ...BASE,
      typeLabel: 'Договір',
      number: 'CTR-2026-000001',
      contractPlace: 'м. Луцьк',
    })
    expect(html).toContain('CTR-2026-000001')
    expect(html).toContain('м. Луцьк')
    expect(html).toContain('Предмет договору')
    expect(html).toContain('CRM інтеграція з 1C') // предмет за замовленням
    expect(html).toContain('Конфіденційність')
    expect(html).toContain('UA123456789012345678901234567')
    expect(html).toContain('Сторони')
  })

  it('екранує HTML у користувацьких даних (XSS у назві позиції/компанії)', () => {
    const html = renderDocumentHtml('invoice', {
      ...BASE,
      recipient: { name: '<script>alert(1)</script>' },
      lines: [{ name: '<img src=x onerror=1>', qty: '1', unit: 'послуга', price: '1', sum: '1' }],
    })
    expect(html).not.toContain('<script>alert(1)</script>')
    expect(html).not.toContain('<img src=x')
    expect(html).toContain('&lt;script&gt;')
  })

  it('defaultContractSections: 7 розділів, кожен з текстом', () => {
    const sections = defaultContractSections(BASE)
    expect(sections).toHaveLength(7)
    for (const s of sections) {
      expect(s.h).toBeTruthy()
      expect(s.p.length).toBeGreaterThan(0)
    }
  })
})
