
import { useState, useCallback } from 'react';

// This tells TypeScript that pdfjsLib will be available globally from the script tag in index.html
declare var pdfjsLib: any;

export const usePdfProcessor = () => {
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const processPdf = useCallback(async (file: File): Promise<string | null> => {
    setIsProcessing(true);
    setError(null);
    try {
      if (typeof pdfjsLib === 'undefined') {
        throw new Error('pdf.js library is not loaded.');
      }
      
      // The worker is needed to process the PDF off the main thread
      pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.3.136/pdf.worker.min.mjs`;

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      const numPages = pdf.numPages;
      let fullText = '';

      for (let i = 1; i <= numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items.map((item: any) => item.str).join(' ');
        fullText += pageText + '\n\n';
      }
      return fullText;
    } catch (e) {
      console.error('Error processing PDF:', e);
      const errorMessage = e instanceof Error ? e.message : 'An unknown error occurred during PDF processing.';
      setError(errorMessage);
      return null;
    } finally {
      setIsProcessing(false);
    }
  }, []);

  return { processPdf, isProcessing, error };
};
