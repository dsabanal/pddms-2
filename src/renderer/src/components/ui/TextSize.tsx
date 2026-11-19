import { useState, type ReactElement } from 'react'
import { readTextSize, saveTextSize, textSizes, type TextSizeId } from './textSizeSettings'

/** Three buttons (A, A+, A++) that set the text size for every screen. */
export default function TextSizeControl({
  tone = 'light'
}: {
  tone?: 'light' | 'dark'
}): ReactElement {
  const [current, setCurrent] = useState<TextSizeId>(readTextSize)
  return (
    <div
      role="group"
      aria-label="Text size"
      className={`text-size-control ${tone === 'dark' ? 'text-size-control-dark' : ''}`}
    >
      <span className="text-size-label">Text size</span>
      {textSizes.map((size) => (
        <button
          key={size.id}
          type="button"
          aria-pressed={current === size.id}
          aria-label={`${size.label} text`}
          title={`${size.label} text`}
          onClick={() => {
            setCurrent(size.id)
            saveTextSize(size.id)
          }}
          className="text-size-option"
        >
          {size.short}
        </button>
      ))}
    </div>
  )
}
