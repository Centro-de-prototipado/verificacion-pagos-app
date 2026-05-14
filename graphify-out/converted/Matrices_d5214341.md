<!-- converted from Matrices.xlsx -->

## Sheet: Resumen General
| PROYECTO | Verificación de Pagos a Contratistas App |
| --- | --- |
| AMBIENTE | Producción |
| FECHA | 2026-05-12 00:00:00 |
| OBJETIVO | Validar carga de documentos, extracción de datos, validaciones y generación de PDF |
| Notas y Observaciones generales |  |
| Planillas | Se debe validar que se encuentren paga, la fecha limite debe tomar como punto de referencia el siguiente periodo |
| Arl | Se debe validar vigencia, la universidad como contratante, si esta inactiva no deja continuar |
| Contratos | Extraer supervisor, Integrar anexo para otrosi, adiciones, prorrogas, CSI |
| Editables | Riesgo en cambio de valores de planilla, estado de arl,… |
## Sheet: Casos de prueba
| ID | Módulo | Casos | Escenario | Pasos | Resultado esperado | Resultado obtenido | Estado | Severidad |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| P-01 | Carga de documentos | Cualquiera | Arrastrar y soltar | Arrastrar archivo al área de carga | El archivo se carga correctamente | Los archivos fue cargado correctamente mediante la funcionalidad de arrastrar y soltar | Aprobado | Baja |
| P-02 | Carga de documentos | Cualquiera | Subir formato no permitido (Documentos) | Intentar cargar archivo .docx | El sistema rechaza el archivo | El sistema rechazó correctamente el archivo .docx e informó que el formato no es permitido | Aprobado | Media |
| P-03 | Carga de documentos | Cualquiera | Subir formato no permitido (Firma) | Intentar cargar archivo .pdf | El sistema rechaza el archivo | El sistema rechazó correctamente el archivo .pdf para la firma e informó el formato permitido | Aprobado | Media |
| P-04 | Carga de documentos | Cualquiera | Carga exitosa documentos obligatorios | Cargar (Planilla, ARL, Contrato y Firma), Continuar | El sistema permite avanzar a la etapa de extracción IA | Se cargaron correctamente los documentos y el sistema avanzó a la etapa de extracción IA | Aprobado | Crítica |
| P-05 | Carga de documentos | Cualquiera | Validar obligatoriedad de contrato | 1. Cargar ARL y planilla 2. No cargar contrato 3. Intentar continuar | El sistema muestra mensaje indicando que el contrato es obligatorio | El sistema mostró mensaje indicando que faltan documentos por subir | Aprobado | Crítica |
| P-06 | Carga de documentos | Cualquiera | Validar obligatoriedad de ARL | 1. Cargar contrato y planilla 2. No cargar ARL | El sistema muestra mensaje indicando que la ARL es obligatoria | El sistema mostró mensaje indicando que faltan documentos por subir | Aprobado | Crítica |
| P-07 | Carga de documentos | Cualquiera | Validar obligatoriedad de planilla | 1. Cargar contrato y ARL 2. No cargar planilla | El sistema muestra mensaje indicando que la planilla es obligatoria | El sistema mostró mensaje indicando que faltan documentos por subir | Aprobado | Crítica |
| P-08 | Carga de documentos | Cualquiera | Validar obligatoriedad de firma | 1. Cargar PDFs obligatorios 2. No cargar firma | El sistema solicita cargar firma antes de continuar | El sistema mostró mensaje indicando que faltan documentos por subir | Aprobado | Alta |
| P-9 | IA - Extracción | Operadores Planilla | Extracción correcta Aportes en Línea Tipo 1 | Usar caso 01Operadores Planilla/Aportes en Linea/Tipo1 | El modelo extrae los datos (Cedula, Nombre, Numero, Periodo, Valor) | Extrajo los datos correctamente (Pide verificar Valor, Cedula, Fecha de pago y Nombre a pesar de estar correctos) | Aprobado | Alta |
| P-10 | IA - Extracción | Operadores Planilla | Extracción correcta Aportes en Línea Tipo 2 | Usar caso 01Operadores Planilla/Aportes en Linea/Tipo2 | El modelo extrae los datos (Cedula, Nombre, Numero, Periodo, Valor) | Extrajo los datos correctamente (Pide verificar todo excepto fecha limite de pago, calculo el valor total a pesar de que no estaba explicito) | Aprobado | Alta |
| P-11 | IA - Extracción | Operadores Planilla | Extracción correcta Asopagos Tipo 1 | Usar caso 01Operadores Planilla/Asopagos/Tipo1 | El modelo extrae los datos (Cedula, Nombre, Numero, Periodo, Valor) | Extrajo los datos correctamente (Pide verificar algunos datos, sin embargo estan bien) | Aprobado | Alta |
| P-12 | IA - Extracción | Operadores Planilla | Extracción correcta Asopagos Tipo 2 | Usar caso 01Operadores Planilla/Asopagos/Tipo2 | El modelo extrae los datos (Cedula, Nombre, Numero, Periodo, Valor) | Error en el numero de planilla y en cedula, en esta planilla no aparece nombre del la persona así que toma el de la AFP, calcula bien fecha limite de pago del periodo analizado | Fallido | Alta |
| P-13 | IA - Extracción | Operadores Planilla | Extracción correcta Asopagos Tipo 3 | Usar caso 01Operadores Planilla/Asopagos/Tipo3 | El modelo extrae los datos (Cedula, Nombre, Numero, Periodo, Valor) | Error en fecha de pago, extrajo bien el resto de datos | Fallido | Alta |
| P-14 | IA - Extracción | Operadores Planilla | Extracción correcta Asopagos Tipo 4 | Usar caso 01Operadores Planilla/Asopagos/Tipo4 | El modelo extrae los datos (Cedula, Nombre, Numero, Periodo, Valor) | Extrajo los datos correctamente los datos | Aprobado | Alta |
| P-15 | IA - Extracción | Operadores Planilla | Extracción correcta Enlace | Usar caso 01Operadores Planilla/Enlace | El modelo extrae los datos (Cedula, Nombre, Numero, Periodo, Valor) | Error en el valor total (tomo el valor con intereses) | Fallido | Alta |
| P-16 | IA - Extracción | Operadores Planilla | Extracción correcta Mi Planilla | Usar caso 01Operadores Planilla/Mi Planilla | El modelo extrae los datos (Cedula, Nombre, Numero, Periodo, Valor) | Extrajo los datos correctamente (Pide verificar todo excepto fecha limite de pago) | Aprobado | Alta |
| P-17 | IA - Extracción | Operadores Planilla | Extracción correcta Simple | Usar caso 01Operadores Planilla/Simple | El modelo extrae los datos (Cedula, Nombre, Numero, Periodo, Valor) | Error en numero de planilla (tomo el numero de transaccion bancaria) | Fallido | Alta |
| P-18 | IA - Extracción | Operadores Planilla | Extracción correcta Soi Tipo 1 | Usar caso 01Operadores Planilla/Soi/Tipo1 | El modelo extrae los datos (Cedula, Nombre, Numero, Periodo, Valor) | Error, el modelo no loro extraer ninguno de los datos | Fallido | Alta |
| P-19 | IA - Extracción | Operadores Planilla | Extracción correcta Soi Tipo 2 | Usar caso 01Operadores Planilla/Soi/Tipo2 | El modelo extrae los datos (Cedula, Nombre, Numero, Periodo, Valor) | Error, el modelo no loro extraer ninguno de los datos | Fallido | Alta |
| P-20 | IA - Extracción | ARL | Extracción correcta ARL Colmena | Usar caso 02ARL/Colmena | El modelo extrae los datos (Cedula, Contratante, Riesgo, Vigencia, Estado | Extrajo correctamente los datos (reconocio equivalencia Cancelado-Inactivo) | Aprobado | Alta |
| P-21 | IA - Extracción | ARL | Extracción correcta ARL Positiva | Usar caso 02ARL/Positiva | El modelo extrae los datos (Cedula, Contratante, Riesgo, Vigencia, Estado | Extrajo correctamente los datos (toma las fechas correctas, a pesar de existir otras similares) | Aprobado | Alta |
| P-22 | IA - Extracción | ARL | Extracción correcta ARL Sura Tipo 1 | Usar caso 02ARL/Sura/Tipo1 | El modelo extrae los datos (Cedula, Contratante, Riesgo, Vigencia, Estado | Extrajo correctamente los datos | Aprobado | Alta |
| P-23 | IA - Extracción | ARL | Extracción correcta ARL Sura Tipo 2 | Usar caso 02ARL/Sura/Tipo2 | El modelo extrae los datos (Cedula, Contratante, Riesgo, Vigencia, Estado | Extrajo correctamente los datos | Aprobado | Alta |
| P-24 | IA - Extracción | Contratos | Extracción correcta contrato CSI | Usar caso 03Contratos/CSI | El modelo extrae los datos (Cedula, Nombre, Tipo, Numero, Año, Fechas, Supervisor, Total) | No solicito CSI | Fallido | Crítica |
| P-25 | IA - Extracción | Contratos | Extracción correcta contrato doble | Usar caso 03Contratos/Doble | El modelo extrae los datos (Cedula, Nombre, Tipo, Numero, Año, Fechas, Supervisor, Total) | Permite avanzar sin escoger contrato a cobrar, El contrato 2 no estipulaba las fechas (el modelo uso las mismas del contrato 1) | Fallido | Crítica |
| P-26 | IA - Extracción | Contratos | Extracción correcta contrato sencillo | Usar caso 03Contratos/Sencillo | El modelo extrae los datos (Cedula, Nombre, Tipo, Numero, Año, Fechas, Supervisor, Total) | Reconoce bien los datos y detecta clausula de informe | Aprobado | Crítica |
| P-27 | IA - Extracción | Informes | Extracción correcta informe normal | Usar caso 04Informes/Estandar | El modelo procesa correctamente el informe estandar | No permite subir informe | Fallido | Media |
| P-28 | IA - Extracción | Informes | Extracción correcta informe formato diferente | Usar caso 04Informes/Formato Diferente | El modelo procesa formatos no estándar | No permite subir informe | Fallido | Media |
| P-29 | IA - Extracción | Informes | Extracción correcta informe con imágenes | Usar caso 04Informes/Imágenes Contenidas | El modelo procesa correctamente informes que contienen imágenes | No permite subir informe | Fallido | Media |
| P-30 | Validación | Especiales | Validar aportes incompletos | Usar caso Especiales/Aportes Incompletos | El sistema detecta inconsistencia de aportes | El sistema dectecta cuando los aportes son menores a los aportes obligatorios (Mensaje de error se muestra en rojo, mirar contenido) | Aprobado | Crítica |
| P-31 | Validación | Especiales | Validar ARL en mora | Usar caso Especiales/ARL Mora | El sistema genera alerta de mora | El sistema no reconocio el estado de Mora de la ARL | Fallido | Crítica |
| P-32 | Validación | Especiales | Validar ARL asociada a otro contrato | Usar caso Especiales/ARL otro Contrato | El sistema detecta inconsistencia ARL de otro contrato |  | No ejecutado | Crítica |
| P-33 | Validación | Especiales | Validar ARL vencida | Usar caso Especiales/ARL Vencida | El sistema identifica ARL vencida |  | No ejecutado | Crítica |
| P-34 | Especiales | Especiales | Validar documentos de diferentes personas | Usar caso Especiales/Diferentes Personas | El sistema detecta diferencias entre titulares |  | No ejecutado | Crítica |
| P-35 | IA - Extracción | Especiales | Validar PDFs escaneados | Usar caso Especiales/Escaneados | El modelo extrae correctamente la información |  | No ejecutado | Alta |
| P-36 | IA - Extracción | Especiales | Validar ARL en pantallazo | Usar caso Especiales/Pantallazos/ARL_Pantallazo | El modelo extrae datos de ARL cuando el pdf es una imagen |  | No ejecutado | Alta |
| P-37 | IA - Extracción | Especiales | Validar planilla en pantallazo | Usar caso Especiales/Pantallazos/Planilla_Pantallazo | El modelo extrae datos de Planilla cuando el pdf es uan imagen |  | No ejecutado | Alta |
| P-38 | Validación | Especiales | Validar planilla no paga | Usar caso Especiales/Planilla No Paga | El sistema detecta estado de planilla sin pagar |  | No ejecutado | Crítica |
| P-39 | Validación | Especiales | Validar planilla no perteneciente a contrato | Usar caso Especiales/Planilla no perteneciente | El sistema detecta que la planilla no corresponde al contrato cobrado |  | No ejecutado | Crítica |
| P-40 | IA - Extracción | Especiales | Validar documentos rotados | Usar caso Especiales/Rotados | El modelo extrae datos cuando el pdf esta rotado |  | No ejecutado | Media |
| P-41 | Validación | Especiales | Validar siguiente planilla faltante | Usar caso Especiales/Siguiente Planilla Faltante | El sistema alerta ausencia de siguiente periodo (por fecha de pago) |  | No ejecutado | Alta |
| P-42 | IA - Extracción | Especiales | Validar planillas varios periodos | Usar caso Especiales/Vaias Planillas | El modelo extrar datos (Todas las planillas) |  | No ejecutado | Alta |
| P-43 | Validación | Cualquiera | Subir documentos en casillas incorrectas | Subir contrato en casilla de planilla, planilla en arl y arl en contrato | El sistema informa inconsitencias |  | No ejecutado | Alta |
| P-44 | Validación | Cualquiera | Todos los datos correctos | Subir documentos consistentes | La validación finaliza exitosamente (en verde) |  | No ejecutado | Crítica |
| P-45 | Edición | Cualquiera | Editar datos extraídos manualmente | 1. Ejecutar extracción 2. Modificar un dato | El sistema permite guardar cambios manuales |  | No ejecutado | Alta |
| P-46 | Edición | Cualquiera | Validar persistencia de cambios manuales | 1. Editar validaciones 2. Refrescar pantalla | Los cambios permanecen guardados |  | No ejecutado | Alta |
| P-47 | Generación PDF | Cualquiera | Validar estructura formatos generados | Ejecutar caso completamente válido | Los dos formatos requeridos se generan completos |  | No ejecutado | Crítica |
| P-48 | Generación PDF | Cualquiera | Validar inclusión de soportes | Generar PDF final con informe adjunto | El PDF incluye soportes cargados inicialmente, no hay páginas cortadas o vacías |  | No ejecutado | Alta |
| P-49 | Generación PDF | Cualquiera | Validar datos autodiligenciados | Ejecutar caso completamente válido y contrastar datos | Los campos aparecen completos y correctos |  | No ejecutado | Crítica |
| P-50 | Generación PDF | Cualquiera | Validar flujo end-to-end exitoso | Ejecutar caso completamente válido | El proceso termina exitosamente con PDF descargable |  | No ejecutado | Crítica |
| P-51 | Generación PDF | Cualquiera | Generar múltiples veces | Generar PDF varias veces | Los PDFs son consistentes |  | No ejecutado | Media |
## Sheet: Metricas
| Métrica | Valor |
| --- | --- |
| Total casos ejecutados |  |
| Casos exitosos |  |
| Casos fallidos |  |
| Casos bloqueados |  |
| Bugs críticos |  |
| Bugs altos |  |
| Bugs medios |  |
| Bugs bajos |  |
| Porcentaje éxito |  |
## Sheet: Clasificaciones
|  | Severidad | Descripción | Impacto |
| --- | --- | --- | --- |
|  | Crítica | El fallo impide completar el flujo principal del sistema o compromete la integridad, validez o confiabilidad de la información procesada. No existe una alternativa funcional viable para continuar el proceso. | Genera alto riesgo operativo, financiero, legal o de cumplimiento. Puede detener completamente la operación o producir resultados incorrectos con consecuencias importantes. |
|  | Alta | El fallo afecta funcionalidades importantes del sistema, aunque el proceso puede continuar mediante acciones manuales o soluciones temporales. | Produce afectación significativa en la operación, incrementa el riesgo de errores y genera reprocesos o pérdida de eficiencia. |
|  | Media | El fallo afecta funcionalidades secundarias, escenarios específicos o ciertos tipos de compatibilidad, sin impedir la ejecución del proceso principal. | Tiene impacto moderado sobre la experiencia de usuario, la eficiencia operativa o la calidad del proceso. |
|  | Baja | El fallo corresponde a problemas menores, visuales o de usabilidad que no afectan la lógica principal ni el resultado funcional del sistema. | Tiene impacto mínimo sobre la operación y no compromete la continuidad ni la validez del proceso. |
|  | Estado | Descripción |  |
|  | No ejecutado | El caso de prueba aún no ha sido validado ni iniciado. |  |
|  | Aprobado | El comportamiento del sistema coincide completamente con el resultado esperado definido para la prueba. |  |
|  | Fallido | El sistema presenta un comportamiento diferente al esperado o evidencia un defecto funcional. |  |
|  | Revalidación | El caso de prueba está siendo ejecutado nuevamente después de aplicar una corrección o ajuste sobre un defecto reportado. |  |
|  | Pendiente corrección | El defecto identificado ya fue reportado y se encuentra a la espera de solución. |  |