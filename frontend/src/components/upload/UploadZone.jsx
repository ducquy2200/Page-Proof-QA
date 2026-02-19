import { useCallback, useState } from 'react'
import { UploadCloud } from 'lucide-react'
import { useDocumentUpload } from '../../hooks/useDocumentUpload'
import { useTheme } from '../../hooks/useTheme'

export default function UploadZone() {
  const { upload } = useDocumentUpload()
  const [dragging, setDragging] = useState(false)
  const [hovered, setHovered] = useState(false)
  const { c } = useTheme()

  const handleFile = useCallback((file) => { if (file) upload(file) }, [upload])
  const onDrop = (e) => { e.preventDefault(); setDragging(false); handleFile(e.dataTransfer.files?.[0]) }

  const active = dragging || hovered

  return (
    <div className="h-full flex flex-col items-center justify-center p-8 gap-3" style={{ backgroundColor: c.bgBase }}>
      <p className="text-xs tracking-[0.3em] uppercase mb-6" style={{ color: c.textFaint }}>
        Document Intelligence
      </p>

      <label
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={onDrop}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        className="flex flex-col items-center justify-center gap-5 w-full max-w-sm h-56 rounded-3xl cursor-pointer transition-all duration-200"
        style={{
          border: `1px solid ${active ? c.accent : c.borderMid}`,
          backgroundColor: active ? c.accentBg : c.bgSurface,
          transform: active ? 'scale(1.02)' : 'scale(1)',
        }}
      >
        <UploadCloud size={26} style={{ color: active ? c.accent : c.textMuted }} />
        <div className="text-center">
          <p className="font-medium tracking-widest text-sm uppercase" style={{ color: active ? c.textPrimary : c.textSecondary }}>
            Upload Document
          </p>
          <p className="text-xs mt-1.5 tracking-wide" style={{ color: active ? c.textMuted : c.textFaint }}>
            Drop a PDF or click to browse
          </p>
        </div>
        <input type="file" accept="application/pdf" className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      </label>

      <p className="text-xs tracking-widest mt-4" style={{ color: c.textFaint }}>PDF files only</p>
    </div>
  )
}
