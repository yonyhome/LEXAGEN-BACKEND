import { onRequest, HttpsFunction } from 'firebase-functions/v2/https';
import type { Request, Response } from 'express';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

import { callOpenAI } from '../services/openaiService';
import { generateAllDocuments } from '../services/documentService';
import { generateZipFiles } from '../services/generateZipFiles';
import {
  uploadDocumentToStorage,
  uploadPreviewPDFToStorage,
  uploadZipToStorage,
  getPreviewUrl,
} from '../services/storageService';
import {
  questionValidationPrompt,
  getLegalDocumentGenerationPrompt,
} from '../utils/prompts';

const corsHandler = cors({ origin: true });

// Función para limpiar y procesar el HTML del LLM
function processLLMHtml(rawHtml: string): string {
  console.log('[processLLMHtml] HTML crudo recibido:', rawHtml.slice(0, 300));
  
  // Limpiar posibles artefactos del LLM
  let cleanHtml = rawHtml
    .replace(/```html/g, '')
    .replace(/```/g, '')
    .trim();

  // Asegurar que no hay etiquetas de documento completo
  cleanHtml = cleanHtml
    .replace(/<\/?html[^>]*>/gi, '')
    .replace(/<\/?head[^>]*>/gi, '')
    .replace(/<\/?body[^>]*>/gi, '')
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');

  // Validar que el HTML tiene estructura mínima esperada
  const hasHeaders = cleanHtml.includes('<h2') || cleanHtml.includes('<h1');
  const hasClasses = cleanHtml.includes('class=');
  
  if (!hasHeaders) {
    console.warn('[processLLMHtml] HTML no contiene encabezados esperados');
  }
  if (!hasClasses) {
    console.warn('[processLLMHtml] HTML no contiene clases CSS esperadas');
  }

  // Log del HTML limpio para debug
  console.log('[processLLMHtml] HTML procesado:', cleanHtml.slice(0, 300));
  
  return cleanHtml;
}

// Función para validar la calidad del documento generado
function validateDocumentQuality(html: string): { isValid: boolean; issues: string[] } {
  const issues: string[] = [];
  
  // Verificar elementos esenciales
  if (!html.includes('HECHOS')) {
    issues.push('Falta sección HECHOS');
  }
  if (!html.includes('PETICIONES') && !html.includes('SOLICITUD')) {
    issues.push('Falta sección PETICIONES o SOLICITUD');
  }
  if (!html.includes('Atentamente') && !html.includes('Cordialmente')) {
    issues.push('Falta cierre formal del documento');
  }
  if (!html.includes('@')) {
    issues.push('Falta información de contacto (email)');
  }
  
  return {
    isValid: issues.length === 0,
    issues
  };
}

export const processDocumentRequest: HttpsFunction = onRequest(
  {
    secrets: ['OPENAI_KEY'],
    memory: '1GiB',
    timeoutSeconds: 240,
  },
  async (req: Request, res: Response) => {
    corsHandler(req, res, async () => {
      try {
        // Validar body
        if (!req.body?.formData) {
          console.warn('[processDocumentRequest] Falta formData.');
          return res.status(400).json({ error: 'Falta "formData" en el body.' });
        }
        
        const data = req.body.formData;
        const payload = JSON.stringify(data);
        console.log('[processDocumentRequest] Datos recibidos:', payload.slice(0, 200));

        // Paso 1: Validación de datos con el LLM
        console.log('[processDocumentRequest] Validando completitud de datos...');
        const validationRaw = await callOpenAI(questionValidationPrompt, payload);
        
        if (!validationRaw?.trim()) {
          throw new Error('LLM no devolvió respuesta de validación.');
        }
        
        const validation = validationRaw.trim();
        console.log('[processDocumentRequest] Resultado validación:', validation.slice(0, 100));

        // Si los datos están incompletos, devolver preguntas
        if (validation !== '__COMPLETO__') {
          let questions;
          try {
            questions = JSON.parse(validation);
          } catch (parseError) {
            console.error('[processDocumentRequest] Error parsing preguntas:', parseError);
            throw new Error('Validación no devuelve JSON válido de preguntas.');
          }
          
          if (!Array.isArray(questions) || questions.length === 0) {
            throw new Error('Array de preguntas inválido o vacío.');
          }
          
          console.log('[processDocumentRequest] Preguntas generadas:', questions.length);
          return res.status(200).json({ 
            status: 'incomplete', 
            questions,
            message: 'Se requiere información adicional para completar el documento'
          });
        }

        // Paso 2: Generación del documento HTML
        console.log('[processDocumentRequest] Generando documento legal...');
        const rawHtml = await callOpenAI(getLegalDocumentGenerationPrompt(), payload);
        
        if (!rawHtml?.trim()) {
          throw new Error('LLM no devolvió contenido HTML.');
        }

        // Procesar y limpiar el HTML
        const cleanHtml = processLLMHtml(rawHtml);
        
        // Validar calidad del documento
        const qualityCheck = validateDocumentQuality(cleanHtml);
        if (!qualityCheck.isValid) {
          console.warn('[processDocumentRequest] Problemas de calidad detectados:', qualityCheck.issues);
          // Continuar pero logear los problemas
        }

        console.log('[processDocumentRequest] Documento HTML generado exitosamente');

        // Paso 3: Generación de archivos PDF y DOCX
        console.log('[processDocumentRequest] Generando archivos PDF y DOCX...');
        const { pdfBuffer, previewPdfBuffer, docxBuffer } = await generateAllDocuments(cleanHtml);
        
        // Generar token único para este documento
        const token = uuidv4();
        console.log('[processDocumentRequest] Token generado:', token);

        // Paso 4: Subir archivos al storage
        console.log('[processDocumentRequest] Subiendo archivos al storage...');
        await Promise.all([
          uploadDocumentToStorage(token, pdfBuffer),
          uploadPreviewPDFToStorage(token, previewPdfBuffer),
        ]);

        // Generar ZIP con ambos formatos
        const zipBuffer = await generateZipFiles({ 
          pdfBuffer, 
          docxBuffer, 
          includeWord: true 
        });
        await uploadZipToStorage(token, zipBuffer);

        // Obtener URL del preview
        const previewUrl = await getPreviewUrl(token);
        
        console.log('[processDocumentRequest] Proceso completado exitosamente');

        // Respuesta exitosa
        return res.status(200).json({ 
          status: 'complete', 
          previewUrl, 
          downloadToken: token,
          message: 'Documento generado exitosamente',
          documentQuality: qualityCheck.isValid ? 'excellent' : 'good',
          ...(qualityCheck.issues.length > 0 && { qualityNotes: qualityCheck.issues })
        });

      } catch (error: any) {
        console.error('[processDocumentRequest] Error durante el procesamiento:', error);
        
        // Clasificar tipo de error para mejor debugging
        let errorType = 'unknown';
        if (error.message.includes('LLM')) {
          errorType = 'llm_error';
        } else if (error.message.includes('PDF') || error.message.includes('HTML')) {
          errorType = 'document_generation_error';
        } else if (error.message.includes('storage') || error.message.includes('upload')) {
          errorType = 'storage_error';
        }

        return res.status(500).json({ 
          error: error.message || 'Error interno del servidor',
          errorType,
          message: 'Hubo un problema al procesar tu solicitud. Por favor intenta nuevamente.'
        });
      }
    });
  }
);