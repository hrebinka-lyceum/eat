// pdfmake 0.3 не постачає типів, а @types/pdfmake описують 0.2 з іншим API
// (getBlob там через колбек). Описуємо лише те, чим користуємося.
declare module 'pdfmake/build/pdfmake' {
  interface PdfDocument {
    getBlob(): Promise<Blob>
  }
  interface PdfMake {
    addVirtualFileSystem(vfs: Record<string, string>): void
    addFonts(fonts: Record<string, { normal: string; bold?: string; italics?: string; bolditalics?: string }>): void
    createPdf(definition: object): PdfDocument
  }
  const pdfMake: PdfMake
  export default pdfMake
}
