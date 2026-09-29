import { useRef, useState } from 'react'

export default function UploadField({
  label,
  hint,
  accept,
  multiple = false,
  onFileSelect,
  onFilesSelect,
}) {
  const inputRef = useRef(null)
  const [fileNames, setFileNames] = useState([])
  const [isDragging, setIsDragging] = useState(false)

  function handleFiles(fileList) {
    const files = Array.from(fileList || [])
    if (files.length === 0) return

    setFileNames(files.map((f) => f.name))

    if (multiple) {
      onFilesSelect?.(files)
    } else {
      onFileSelect?.(files[0])
    }
  }

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2">
        <label className="font-display text-sm">{label}</label>
        {hint && (
          <span className="text-[11px] tracking-wide text-ink/40">{hint}</span>
        )}
      </div>

      <div
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setIsDragging(true)
        }}
        onDragLeave={() => setIsDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setIsDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
        className={`cursor-pointer rounded-lg border-2 border-dashed p-6 text-center transition-colors
          ${
            isDragging
              ? 'bg-cream border-teal'
              : 'border-navy/15 hover:border-teal'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        {fileNames.length > 0 ? (
          <p className="text-sm text-ink">
            {fileNames.length === 1
              ? fileNames[0]
              : `${fileNames.length} files selected`}
          </p>
        ) : (
          <>
            <p className="text-sm text-ink/70">
              Drop {multiple ? 'files' : 'a file'} here, or{' '}
              <span className="underline">browse</span>
            </p>
            {accept && <p className="text-[11px] text-ink/40 mt-1">{accept}</p>}
          </>
        )}
      </div>
    </div>
  )
}
