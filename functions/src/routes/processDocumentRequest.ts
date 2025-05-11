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
  legalDocumentGenerationPrompt,
} from '../utils/prompts';

const corsHandler = cors({ origin: true });

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
        console.log('[processDocumentRequest] Datos recibidos:', payload.slice(0,200));

        // Paso 1: Validación de datos
        console.log('[processDocumentRequest] Validando datos con LLM...');
        const validationRaw = await callOpenAI(
          questionValidationPrompt,
          payload
        );
        if (!validationRaw?.trim()) {
          throw new Error('LLM no devolvió respuesta de validación.');
        }
        const validation = validationRaw.trim();

        // Si no está completo, parsear preguntas
        if (validation !== '__COMPLETO__') {
          let questions;
          try {
            questions = JSON.parse(validationRaw);
          } catch {
            throw new Error('Validación no devuelve JSON válido de preguntas.');
          }
          if (!Array.isArray(questions) || questions.length === 0) {
            throw new Error('Array de preguntas inválido o vacío.');
          }
          console.log('[processDocumentRequest] Preguntas generadas:', questions);
          return res.status(200).json({ status: 'incomplete', questions });
        }

        // Paso 2: Generación de HTML
        console.log('[processDocumentRequest] Generando HTML con LLM...');
        const html = await callOpenAI(
          legalDocumentGenerationPrompt,
          payload
        );
        if (!html?.trim()) {
          throw new Error('LLM no devolvió HTML.');
        }
        const htmlDocument = html;
        console.log('[processDocumentRequest] HTML generado:', htmlDocument.slice(0,200));

        // Paso 3: Generación de archivos
        const { pdfBuffer, previewPdfBuffer, docxBuffer } =
          await generateAllDocuments(htmlDocument);
        const token = uuidv4();
        await Promise.all([
          uploadDocumentToStorage(token, pdfBuffer),
          uploadPreviewPDFToStorage(token, previewPdfBuffer),
        ]);

        const zipBuffer = await generateZipFiles({ pdfBuffer, docxBuffer, includeWord: true });
        await uploadZipToStorage(token, zipBuffer);
        const previewUrl = await getPreviewUrl(token);

        return res.status(200).json({ status: 'complete', previewUrl, downloadToken: token });
      } catch (error: any) {
        console.error('[processDocumentRequest] Error:', error);
        return res.status(500).json({ error: error.message || 'Error interno' });
      }
    });
  }
);
