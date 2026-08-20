/**
 * Copy a key to the clipboard.
 *
 * `navigator.clipboard` is the whole story on a secure origin, but the portal is also run
 * over plain http on a LAN address during setup, where the API simply isn't there — hence
 * the textarea fallback. Callers get a boolean instead of an exception because a failed
 * copy is a toast, never an error state.
 */
export async function copyText(value: string): Promise<boolean> {
  try {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(value)
      return true
    }
  } catch {
    // Denied or unavailable — fall through and try the old way.
  }

  try {
    const area = document.createElement('textarea')
    area.value = value
    area.setAttribute('readonly', '')
    area.style.position = 'fixed'
    area.style.opacity = '0'
    document.body.appendChild(area)
    area.select()
    const copied = document.execCommand('copy')
    area.remove()
    return copied
  } catch {
    return false
  }
}
