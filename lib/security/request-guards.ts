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

export async function readPdfFile(
  value: FormDataEntryValue | null,
  fieldName: string,
  options: { required: boolean; maxBytes: number }
): Promise<Uint8Array | null> {
  if (!value) {
    if (options.required) {
      throw new Error(`El archivo "${fieldName}" es obligatorio.`)
    }
    return null
  }
  if (!(value instanceof File)) {
    throw new Error(`El campo "${fieldName}" no es un archivo válido.`)
  }

  // Verificaciones rápidas de metadatos
  const name = value.name?.toLowerCase() ?? ""
  if (!name.endsWith(".pdf")) {
    throw new Error(`El archivo "${fieldName}" debe tener extensión .pdf`)
  }
  if (value.size > options.maxBytes) {
    throw new Error(
      `El archivo "${fieldName}" supera el tamaño máximo de ${Math.round(
        options.maxBytes / 1024 / 1024
      )}MB.`
    )
  }

  // --- VALIDACIÓN DE SEGURIDAD PROFUNDA ---
  const buffer = await value.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // 1. Validar Magic Number de PDF (%PDF-)
  if (
    bytes.length < 4 ||
    bytes[0] !== 0x25 ||
    bytes[1] !== 0x50 ||
    bytes[2] !== 0x44 ||
    bytes[3] !== 0x46
  ) {
    console.error(`[SECURITY] Firma de PDF inválida en "${fieldName}"`)
    throw new Error(
      `El archivo "${fieldName}" no es un PDF válido (firma corrupta).`
    )
  }

  // 2. Escaneo de patrones maliciosos básicos (JS/OpenAction)
  const headerContent = new TextDecoder().decode(bytes.slice(0, 5120))
  const dangerousPatterns = ["/JS", "/JavaScript", "/OpenAction"]
  for (const pattern of dangerousPatterns) {
    if (headerContent.includes(pattern)) {
      console.warn(
        `[SECURITY] Patrón peligroso detectado: ${pattern} en "${fieldName}"`
      )
      throw new Error(
        `Seguridad: El archivo "${fieldName}" contiene elementos no permitidos.`
      )
    }
  }

  return bytes
}

export async function readImageFile(
  value: FormDataEntryValue | null,
  fieldName: string,
  options: { required: boolean; maxBytes: number }
): Promise<File | null> {
  if (!value) {
    if (options.required) {
      throw new Error(`La imagen "${fieldName}" es obligatoria.`)
    }
    return null
  }
  if (!(value instanceof File)) {
    throw new Error(`El campo "${fieldName}" no es una imagen válida.`)
  }

  if (value.size > options.maxBytes) {
    throw new Error(
      `La imagen "${fieldName}" supera el tamaño máximo permitido.`
    )
  }

  const buffer = await value.arrayBuffer()
  const bytes = new Uint8Array(buffer)

  // Validar Magic Numbers comunes
  // JPEG: FF D8 FF
  const isJpg = bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  // PNG: 89 50 4E 47
  const isPng =
    bytes[0] === 0x89 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x4e &&
    bytes[3] === 0x47
  // GIF: 47 49 46
  const isGif = bytes[0] === 0x47 && bytes[1] === 0x49 && bytes[2] === 0x46

  if (!isJpg && !isPng && !isGif) {
    console.error(`[SECURITY] Firma de imagen no válida para "${fieldName}"`)
    throw new Error(
      `El archivo "${fieldName}" no es una imagen válida (JPG/PNG).`
    )
  }

  return value
}
