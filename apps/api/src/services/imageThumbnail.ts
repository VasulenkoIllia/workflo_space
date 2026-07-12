import sharp from 'sharp'

/**
 * S10-06ч МІНІАТЮРИ: серверне webp-прев'ю для зображень-вкладень. Best-effort —
 * генерація ніколи не кидає (пошкоджене/невідоме зображення → null, upload триває).
 * sharp перекодовує в растровий webp і стрипає метадані → віддавати прев'ю inline
 * безпечно (на відміну від оригіналу, що завжди йде attachment-ом).
 */
const THUMB_MAX_PX = 400
const THUMB_QUALITY = 78

/**
 * Растрові формати, які sharp безпечно перекодовує. SVG свідомо пропускаємо —
 * векторний парсинг недовіреного вводу (зовнішні посилання/скрипт) зайвий ризик.
 */
export function isThumbnailable(mimeType: string): boolean {
  return /^image\/(jpe?g|png|webp|gif|avif|tiff)$/i.test(mimeType)
}

/** webp-мініатюра (вписана в THUMB_MAX_PX) або null, якщо зображення не читається. */
export async function makeThumbnail(buffer: Buffer): Promise<Buffer | null> {
  try {
    return await sharp(buffer, { failOn: 'error' })
      .rotate() // авто-орієнтація за EXIF (метадані далі стрипляться sharp'ом)
      .resize({
        width: THUMB_MAX_PX,
        height: THUMB_MAX_PX,
        fit: 'inside',
        withoutEnlargement: true,
      })
      .webp({ quality: THUMB_QUALITY })
      .toBuffer()
  } catch {
    return null
  }
}
