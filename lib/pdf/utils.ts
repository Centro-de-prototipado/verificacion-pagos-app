/**
 * Genera el nombre del archivo final para los anexos.
 * e.g. quipu="4013", tipo="OSE", numero="14" → "4013AnexosOSE14.pdf"
 */
export function nombreArchivoFinal(
  quipu: string,
  tipoContrato: string,
  numeroOrden: string
): string {
  return `${quipu}Anexos${tipoContrato}${numeroOrden}.pdf`
}
