import { useParams } from 'react-router-dom'
import { Placeholder } from '@/routes/Placeholder'

// Filled in C4 (detail + sidebar + Tabs: chat-SSE / files / activity).
export function OrderDetailPage() {
  const { id } = useParams()
  return <Placeholder title={`Замовлення #${id?.slice(0, 6) ?? ''}`} />
}
