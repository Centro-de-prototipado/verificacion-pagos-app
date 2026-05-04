import type { NextRequest } from "next/server"

const buckets = new Map<string, { count: number; resetAt: number }>()

function cleanupExpiredBuckets(now: number) {
  if (buckets.size < 2000) return
  for (const [key, bucket] of buckets.entries()) {
    if (bucket.resetAt <= now) buckets.delete(key)
  }
}

export function getClientIp(request: NextRequest): string {
  const forwardedFor = request.headers.get("x-forwarded-for")
  if (forwardedFor) {
    const first = forwardedFor.split(",")[0]?.trim()
    if (first) return first
  }
  return request.headers.get("x-real-ip")?.trim() || "unknown"
}

export function isRateLimited({
  key,
  limit,
  windowMs,
}: {
  key: string
  limit: number
  windowMs: number
}): boolean {
  const now = Date.now()
  cleanupExpiredBuckets(now)
  const bucket = buckets.get(key)
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs })
    return false
  }
  bucket.count += 1
  return bucket.count > limit
}

export function exceedsContentLength(
  request: NextRequest,
  maxBytes: number
): boolean {
  const raw = request.headers.get("content-length")
  if (!raw) return false
  const size = Number(raw)
  if (!Number.isFinite(size)) return false
  return size > maxBytes
}

export function readPdfFile(
  value: FormDataEntryValue | null,
  fieldName: string,
  options: { required: boolean; maxBytes: number }
): File | null {
  if (!value) {
    if (options.required) {
      throw new Error(`El archivo "${fieldName}" es obligatorio.`)
    }
    return null
  }
  if (!(value instanceof File)) {
    throw new Error(`El campo "${fieldName}" no es un archivo válido.`)
  }
  const name = value.name?.toLowerCase() ?? ""
  const mime = value.type?.toLowerCase() ?? ""
  const seemsPdfByMime =
    mime === "application/pdf" ||
    mime === "application/x-pdf" ||
    mime === "application/octet-stream" ||
    mime === ""
  const seemsPdfByName = name.endsWith(".pdf")
  if (!seemsPdfByMime || !seemsPdfByName) {
    throw new Error(`El archivo "${fieldName}" debe estar en formato PDF.`)
  }
  if (value.size > options.maxBytes) {
    throw new Error(
      `El archivo "${fieldName}" supera el tamaño máximo permitido.`
    )
  }
  return value
}

export function readImageFile(
  value: FormDataEntryValue | null,
  fieldName: string,
  options: { required: boolean; maxBytes: number }
): File | null {
  if (!value) {
    if (options.required) {
      throw new Error(`La imagen "${fieldName}" es obligatoria.`)
    }
    return null
  }
  if (!(value instanceof File)) {
    throw new Error(`El campo "${fieldName}" no es una imagen válida.`)
  }
  const mime = value.type?.toLowerCase() ?? ""
  const isImage = mime.startsWith("image/")
  if (!isImage) {
    throw new Error(`El archivo "${fieldName}" debe ser una imagen (JPG/PNG).`)
  }
  if (value.size > options.maxBytes) {
    throw new Error(
      `La imagen "${fieldName}" supera el tamaño máximo permitido.`
    )
  }
  return value
}
