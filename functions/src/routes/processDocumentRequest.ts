import { onRequest } from 'firebase-functions/v2/https';
import cors from 'cors';
import { v4 as uuidv4 } from 'uuid';

import { callOpenAI } from '../services/openaiService';
import { generatePDF, generateZipFiles } from '../services/documentService';
import {
  uploadDocumentToStorage,
  uploadZipToStorage,
  getPreviewUrl
} from '../services/storageService';
import { basePrompts, questionGenerationPrompt } from '../utils/prompts';

const corsHandler = cors({ origin: true });

export const processDocumentRequest = onRequest({
  secrets: ['OPENAI_KEY'] // Esto solo se activa en producción
}, (req, res) => {
  corsHandler(req, res, async () => {
    try {
      const formData = req.body.formData;
      const tipoDocumento = formData?.tipoDocumento;

      if (!formData || !tipoDocumento || !basePrompts[tipoDocumento]) {
        res.status(400).json({ error: 'Faltan campos requeridos o tipo de documento inválido.' });
        return;
      }

      // Validar si la información está completa
      const validationResponse = await callOpenAI(
        questionGenerationPrompt,
        JSON.stringify(formData)
      );

      if (validationResponse !== '__COMPLETO__') {
        let questions;
        try {
          questions = JSON.parse(validationResponse);
        } catch {
          res.status(500).json({ error: 'Error al interpretar las preguntas generadas.' });
          return;
        }

        res.status(200).json({
          status: 'incomplete',
          questions
        });
        return;
      }

      // Generar texto legal
      const legalText = await callOpenAI(
        basePrompts[tipoDocumento],
        JSON.stringify(formData)
      );

      // Generar archivos y subirlos
      const token = uuidv4();
      const pdfBuffer = await generatePDF(legalText);
      const zipBuffer = await generateZipFiles({ pdfBuffer, includeWord: false });

      await uploadDocumentToStorage(token, pdfBuffer);
      await uploadZipToStorage(token, zipBuffer);

      const previewUrl = await getPreviewUrl(token);

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
