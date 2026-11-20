import * as pdfjs from 'pdfjs-dist/legacy/build/pdf.mjs';
import pdfjsWorker from 'pdfjs-dist/legacy/build/pdf.worker.mjs?url';

export function ensurePdfWorkerConfigured(): void {
  if (typeof window !== 'undefined' && pdfjs?.GlobalWorkerOptions) {
    if (!pdfjs.GlobalWorkerOptions.workerSrc) {
      pdfjs.GlobalWorkerOptions.workerSrc = pdfjsWorker;
    }
  }
}

ensurePdfWorkerConfigured();

export { pdfjs, pdfjsWorker };
