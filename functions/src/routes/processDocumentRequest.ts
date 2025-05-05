// functions/src/index.ts

import { onRequest } from 'firebase-functions/v2/https';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

import { callOpenAI } from '../services/openaiService';
import { generatePDF } from '../services/generatePDF';         // tu PDF-lib tradicional
import { generateDOCX } from '../services/generateDOCX';        // ahora convierte Markdown→.docx vía html-docx-js
import { generateZipFiles } from '../services/generateZipFiles';
import {
  uploadDocumentToStorage,
  uploadZipToStorage,
  getPreviewUrl
} from '../services/storageService';

import {
  legalDocumentGenerationPrompt,
  questionValidationPrompt
} from '../utils/prompts';

const corsHandler = cors({ origin: true });

export const processDocumentRequest = onRequest({
  secrets: ['OPENAI_KEY']
}, (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const formData = req.body.formData;

      // 1) Validar completitud
      const validationResponse = await callOpenAI(
        questionValidationPrompt,
        JSON.stringify(formData)
      );
      if (validationResponse !== '__COMPLETO__') {
        let questions: any;
        try {
          questions = JSON.parse(validationResponse);
        } catch {
          res.status(500).json({ error: 'Error al interpretar las preguntas generadas.' });
          return;
        }
        res.status(200).json({ status: 'incomplete', questions });
        return;
      }

      // 2) Generar contenido (Markdown) con el asistente
      const legalMarkdown = await callOpenAI(
        legalDocumentGenerationPrompt,
        JSON.stringify(formData)
      );

      // 3) Generar el PDF completo desde Markdown
      const pdfBuffer = await generatePDF(legalMarkdown);

      // 4) Generar el .docx desde el mismo Markdown
      const docxBuffer = await generateDOCX(legalMarkdown);

      // 5) Empaquetar en ZIP (PDF + DOCX)
      const zipBuffer = await generateZipFiles({
        pdfBuffer,
        docxBuffer,
        includeWord: true
      });

      // 6) Subir PDF, ZIP y obtener token
      const token = uuidv4();
      await uploadDocumentToStorage(token, pdfBuffer);
      await uploadZipToStorage(token, zipBuffer);

      // 7) Generar URL de preview (PDF)
      const previewUrl = await getPreviewUrl(token);

      // 8) Responder al cliente
      res.status(200).json({
        status: 'complete',
        previewUrl,
        downloadToken: token
      });
    } catch (error: any) {
      console.error('[processDocumentRequest] Error:', error?.message || error);
      res.status(500).json({ error: 'Error al procesar el documento.' });
    }
  });
});
