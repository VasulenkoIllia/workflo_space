import { useRef, useState } from 'react'
import { toast } from 'sonner'
import { EmptyState, Icon } from '@workflo/ui'
import { useAuth } from '@/contexts/AuthContext'
import {
  downloadFile,
  useDeleteFile,
  useFiles,
  useUploadFile,
  type OrderFileItem,
} from '@/lib/orderDetail'
import { formatBytes, formatDate } from '@/lib/format'

export function FilesTab({ orderId }: { orderId: string }) {
  const { data: files = [], isLoading } = useFiles(orderId)
  const upload = useUploadFile(orderId)
  const del = useDeleteFile(orderId)
  const { user } = useAuth()
  const myId = user?.profile.id
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)

  const handleFile = (f: File | undefined) => {
    if (f) upload.mutate(f)
  }

  return (
    <div style={{ padding: '14px 0', display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragOver(true)
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragOver(false)
          handleFile(e.dataTransfer.files[0])
        }}
        disabled={upload.isPending}
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          gap: 6,
          padding: '28px 20px',
          border: `1px dashed ${dragOver ? 'var(--wf-accent)' : 'var(--wf-border-strong)'}`,
          borderRadius: 8,
          background: dragOver
            ? 'color-mix(in oklab, var(--wf-accent) 8%, transparent)'
            : 'transparent',
          color: 'var(--wf-fg-secondary)',
          cursor: 'pointer',
          width: '100%',
        }}
      >
        <Icon name="download" size={20} />
        <span style={{ fontSize: 13 }}>
          {upload.isPending ? 'Завантаження…' : 'Перетягніть файл або натисніть, щоб обрати'}
        </span>
        <span className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
          PDF, DOC, XLS, PNG, ZIP · до 100 МБ
        </span>
      </button>
      <input
        ref={inputRef}
        type="file"
        hidden
        onChange={(e) => {
          handleFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {upload.isError && (
        <div className="wfp-field-hint wfp-field-hint--error">
          Не вдалося завантажити файл. Перевірте тип і розмір.
        </div>
      )}

      {isLoading ? (
        <div className="wfp-mono" style={{ fontSize: 12, color: 'var(--wf-fg-muted)' }}>
          // завантаження…
        </div>
      ) : files.length === 0 ? (
        <EmptyState
          title="Файлів ще немає"
          description="Завантажте перший файл для цього замовлення."
        />
      ) : (
        <>
          <div
            className="wfp-mono"
            style={{
              fontSize: 11,
              color: 'var(--wf-fg-muted)',
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            // {files.length} {files.length === 1 ? 'файл' : 'файлів'}
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {files.map((f) => (
              <FileRow
                key={f.id}
                file={f}
                canDelete={f.uploadedBy === myId}
                onDelete={() => del.mutate(f.id)}
                deleting={del.isPending && del.variables === f.id}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
}

function FileRow({
  file,
  canDelete,
  onDelete,
  deleting,
}: {
  file: OrderFileItem
  canDelete: boolean
  onDelete: () => void
  deleting: boolean
}) {
  const [busy, setBusy] = useState(false)
  const download = () => {
    setBusy(true)
    downloadFile(file)
      .catch(() => toast.error('Не вдалося завантажити файл'))
      .finally(() => setBusy(false))
  }
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        padding: '10px 14px',
        border: '1px solid var(--wf-border)',
        borderRadius: 8,
      }}
    >
      <Icon name="file" size={16} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            fontSize: 13,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}
        >
          {file.filename}
        </div>
        <div className="wfp-mono" style={{ fontSize: 11, color: 'var(--wf-fg-muted)' }}>
          {formatBytes(file.sizeBytes)} · {formatDate(file.createdAt)}
        </div>
      </div>
      <button
        type="button"
        className="wfp-iconbtn"
        title="Завантажити"
        onClick={download}
        disabled={busy}
      >
        <Icon name="download" size={15} />
      </button>
      {canDelete && (
        <button
          type="button"
          className="wfp-iconbtn"
          title="Видалити"
          onClick={onDelete}
          disabled={deleting}
        >
          <Icon name="close" size={15} />
        </button>
      )}
    </div>
  )
}
