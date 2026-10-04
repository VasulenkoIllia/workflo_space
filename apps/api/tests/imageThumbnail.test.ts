import { describe, expect, it } from 'vitest'
import sharp from 'sharp'
import { isThumbnailable, makeThumbnail } from '../src/services/imageThumbnail.js'

// S10-06ч: генерація мініатюр — растрові → webp, решта/сміття → null.

describe('isThumbnailable', () => {
  it('растрові зображення — так; svg / не-зображення — ні', () => {
    expect(isThumbnailable('image/png')).toBe(true)
    expect(isThumbnailable('image/jpeg')).toBe(true)
    expect(isThumbnailable('image/webp')).toBe(true)
    expect(isThumbnailable('image/gif')).toBe(true)
    expect(isThumbnailable('image/svg+xml')).toBe(false) // векторний ввід свідомо пропускаємо
    expect(isThumbnailable('application/pdf')).toBe(false)
  })
})

describe('makeThumbnail', () => {
  it('велике зображення → webp, вписаний у 400px зі збереженням пропорцій', async () => {
    const src = await sharp({
      create: { width: 1200, height: 800, channels: 3, background: { r: 10, g: 120, b: 200 } },
    })
      .png()
      .toBuffer()
    const thumb = await makeThumbnail(src)
    expect(thumb).not.toBeNull()
    const meta = await sharp(thumb as Buffer).metadata()
    expect(meta.format).toBe('webp')
    expect(meta.width).toBe(400) // довша сторона впирається в 400
    expect(meta.height).toBeLessThanOrEqual(400)
  })

  it('маленьке зображення не збільшується (withoutEnlargement)', async () => {
    const src = await sharp({
      create: { width: 50, height: 50, channels: 3, background: { r: 0, g: 0, b: 0 } },
    })
      .png()
      .toBuffer()
    const thumb = await makeThumbnail(src)
    const meta = await sharp(thumb as Buffer).metadata()
    expect(meta.width).toBe(50)
  })

  it('сміття (не зображення) → null, не кидає', async () => {
    expect(await makeThumbnail(Buffer.from('definitely not an image', 'utf8'))).toBeNull()
  })
})
