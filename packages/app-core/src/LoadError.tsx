import { Button, EmptyState } from '@workflo/ui'

/**
 * STATES-HYGIENE (аудит D11): помилка завантаження ≠ «порожньо». Раніше збій запиту
 * рендерив порожній стан («задач ще немає») — користувач думав, що даних нема. Тост із
 * текстом сервера показує глобальний пайплайн (queryClient); тут — стан сторінки + повтор.
 */
export function LoadError({
  what = 'дані',
  onRetry,
}: {
  /** Що не завантажилось, у знахідному відмінку: «задачі», «звіт», «чати». */
  what?: string
  onRetry?: () => void
}) {
  return (
    <EmptyState
      glyph="// помилка"
      title={`Не вдалося завантажити ${what}`}
      description="Перевірте зʼєднання й спробуйте ще раз. Якщо повторюється — напишіть у підтримку."
      action={
        onRetry ? (
          <Button variant="secondary" onClick={onRetry}>
            Оновити
          </Button>
        ) : undefined
      }
    />
  )
}
