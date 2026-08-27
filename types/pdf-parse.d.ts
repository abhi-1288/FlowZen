declare module "pdf-parse/lib/pdf-parse.js" {
  interface PDFResult {
    text: string;
    numpages: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
  }

  function pdf(dataBuffer: Buffer): Promise<PDFResult>;
  export default pdf;
}

declare module "pdf-parse" {
  interface PDFResult {
    text: string;
    numpages: number;
    info: Record<string, unknown>;
    metadata: Record<string, unknown>;
  }

  function pdf(dataBuffer: Buffer): Promise<PDFResult>;
  export default pdf;
}
