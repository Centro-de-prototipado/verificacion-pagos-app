import { z } from "zod";

export const ARLSchema = z.object({
  startDate: z
    .string()
    .describe("Fecha de inicio de la cobertura en formato DD/MM/YYYY"),
  endDate: z
    .string()
    .describe("Fecha de fin de la cobertura en formato DD/MM/YYYY"),
  coverageStatus: z
    .enum(["ACTIVA", "INACTIVA", "SUSPENDIDA"])
    .describe("Estado actual de la afiliación ARL"),
  riskClass: z
    .enum(["I", "II", "III", "IV", "V"])
    .describe("Clase de riesgo laboral asignada (I a V)"),
});

export type ARLExtracted = z.infer<typeof ARLSchema>;
