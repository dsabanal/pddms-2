/**
 * Text size for the whole app. Every size in the design is in rem, so changing the root font size
 * scales text, buttons, fields and spacing together. The choice is kept on this computer only.
 */
export const textSizes = [
  { id: 'normal', label: 'Normal', short: 'A', percent: 100 },
  { id: 'large', label: 'Large', short: 'A+', percent: 112.5 },
  { id: 'extra-large', label: 'Extra large', short: 'A++', percent: 125 }
] as const

export type TextSizeId = (typeof textSizes)[number]['id']

const STORAGE_KEY = 'medprix.textSize'

export const readTextSize = (): TextSizeId => {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEY)
    return textSizes.some((size) => size.id === saved) ? (saved as TextSizeId) : 'normal'
  } catch {
    return 'normal'
  }
}

export const applyTextSize = (id: TextSizeId): void => {
  const size = textSizes.find((item) => item.id === id) ?? textSizes[0]
  document.documentElement.style.fontSize = `${size.percent}%`
  document.documentElement.dataset.textSize = size.id
}

/** Applies and remembers a text size. */
export const saveTextSize = (id: TextSizeId): void => {
  applyTextSize(id)
  try {
    window.localStorage.setItem(STORAGE_KEY, id)
  } catch {
    // Note: Without storage the size still applies until the app is closed.
  }
}

/** Applies the saved text size before the first screen is drawn. */
export const applySavedTextSize = (): void => applyTextSize(readTextSize())
