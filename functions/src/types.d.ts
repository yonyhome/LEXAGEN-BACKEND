// functions/src/custom-types.d.ts
declare module 'html-to-pdfmake' {
    interface HtmlToPdfmakeOptions {
      window?: any;
      defaultStyles?: any; // Puedes añadir otras opciones que sepas que existen
      // Añade más opciones según sea necesario
    }
  
    export default function htmlToPdfmake(
      html: string,
      options?: HtmlToPdfmakeOptions
    ): any[]; // Devuelve un array de contenido para pdfmake
  }