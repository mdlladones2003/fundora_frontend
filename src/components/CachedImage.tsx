import { useEffect, useState, type ImgHTMLAttributes } from 'react'

const cacheName = 'fundora-image-sources-v1'
const pendingImages = new Map<string, Promise<Blob | null>>()

function fetchCachedImage(src: string) {
  const pending = pendingImages.get(src)
  if (pending) return pending

  const load = (async (): Promise<Blob | null> => {
    if (!('caches' in window) || !/^https?:\/\//i.test(src)) return null
    const cache = await caches.open(cacheName)
    const cached = await cache.match(src)
    if (cached) return cached.blob()

    const response = await fetch(src, { mode: 'cors', credentials: 'omit', cache: 'force-cache' })
    if (!response.ok || response.type === 'opaque') return null
    const blob = await response.blob()
    try {
      await cache.put(src, new Response(blob, { headers: { 'Content-Type': blob.type } }))
    } catch (error) {
      console.warn('Image loaded but could not be saved to the browser cache.', error)
    }
    return blob
  })().catch(error => {
    console.warn('Image cache unavailable; loading the source directly.', error)
    return null
  }).finally(() => {
    pendingImages.delete(src)
  })

  pendingImages.set(src, load)
  return load
}

export function CachedImage({ src, alt, ...props }: ImgHTMLAttributes<HTMLImageElement>) {
  const [displaySrc, setDisplaySrc] = useState(src)

  useEffect(() => {
    let active = true
    let objectUrl: string | undefined
    setDisplaySrc(src)
    if (!src) return

    void fetchCachedImage(src).then(blob => {
      if (!active || !blob) return
      objectUrl = URL.createObjectURL(blob)
      setDisplaySrc(objectUrl)
    })

    return () => {
      active = false
      if (objectUrl) URL.revokeObjectURL(objectUrl)
    }
  }, [src])

  if (!src) return null
  return <img {...props} src={displaySrc || src} alt={alt || ''} loading={props.loading || 'lazy'} decoding="async"/>
}
