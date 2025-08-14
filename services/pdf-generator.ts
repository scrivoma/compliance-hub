import puppeteer from 'puppeteer'
import { marked } from 'marked'
import { PrismaClient } from '@prisma/client'
import { writeFileSync, mkdirSync, existsSync } from 'fs'
import { join, dirname } from 'path'

const prisma = new PrismaClient()

export interface PdfGenerationOptions {
  format?: 'A4' | 'Letter' | 'Legal'
  margin?: {
    top?: string
    right?: string
    bottom?: string
    left?: string
  }
  displayHeaderFooter?: boolean
  headerTemplate?: string
  footerTemplate?: string
  printBackground?: boolean
}

export interface PdfGenerationResult {
  success: boolean
  pdfPath?: string
  filePath?: string // Relative path for database storage
  fileSize?: number
  error?: string
}

export class PdfGeneratorService {
  private static instance: PdfGeneratorService
  private browser: puppeteer.Browser | null = null

  private constructor() {}

  public static getInstance(): PdfGeneratorService {
    if (!PdfGeneratorService.instance) {
      PdfGeneratorService.instance = new PdfGeneratorService()
    }
    return PdfGeneratorService.instance
  }

  private async initializeBrowser(): Promise<puppeteer.Browser> {
    if (!this.browser) {
      this.browser = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-accelerated-2d-canvas',
          '--no-first-run',
          '--no-zygote',
          '--single-process',
          '--disable-gpu'
        ]
      })
    }
    return this.browser
  }

  private async closeBrowser(): Promise<void> {
    if (this.browser) {
      await this.browser.close()
      this.browser = null
    }
  }

  private generateHtmlTemplate(content: string, title: string): string {
    return `
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>${title}</title>
    <style>
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 
                         'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif;
            line-height: 1.6;
            color: #333;
            max-width: 800px;
            margin: 0 auto;
            padding: 20px;
            background: white;
        }
        
        h1, h2, h3, h4, h5, h6 {
            color: #2c3e50;
            margin-top: 2em;
            margin-bottom: 1em;
            font-weight: 600;
        }
        
        h1 {
            font-size: 2.5em;
            border-bottom: 3px solid #3498db;
            padding-bottom: 10px;
        }
        
        h2 {
            font-size: 2em;
            border-bottom: 2px solid #ecf0f1;
            padding-bottom: 8px;
        }
        
        h3 {
            font-size: 1.5em;
            color: #34495e;
        }
        
        p {
            margin-bottom: 1em;
            text-align: justify;
        }
        
        ul, ol {
            margin-bottom: 1em;
            padding-left: 2em;
        }
        
        li {
            margin-bottom: 0.5em;
        }
        
        blockquote {
            border-left: 4px solid #3498db;
            margin: 1em 0;
            padding: 10px 20px;
            background-color: #f8f9fa;
            font-style: italic;
        }
        
        code {
            background-color: #f1f2f6;
            padding: 2px 4px;
            border-radius: 3px;
            font-family: 'Courier New', monospace;
            font-size: 0.9em;
        }
        
        pre {
            background-color: #f8f9fa;
            border: 1px solid #e9ecef;
            border-radius: 5px;
            padding: 15px;
            overflow-x: auto;
            margin-bottom: 1em;
        }
        
        pre code {
            background: none;
            padding: 0;
        }
        
        table {
            border-collapse: collapse;
            width: 100%;
            margin-bottom: 1em;
        }
        
        th, td {
            border: 1px solid #ddd;
            padding: 8px 12px;
            text-align: left;
        }
        
        th {
            background-color: #f8f9fa;
            font-weight: 600;
        }
        
        a {
            color: #3498db;
            text-decoration: none;
        }
        
        a:hover {
            text-decoration: underline;
        }
        
        .document-header {
            text-align: center;
            margin-bottom: 2em;
            padding-bottom: 1em;
            border-bottom: 2px solid #ecf0f1;
        }
        
        .document-title {
            font-size: 2.5em;
            color: #2c3e50;
            margin-bottom: 0.5em;
        }
        
        .document-meta {
            color: #7f8c8d;
            font-size: 0.9em;
        }
        
        .page-break {
            page-break-before: always;
        }
        
        @media print {
            body {
                margin: 0;
                padding: 15mm;
            }
            
            .page-break {
                page-break-before: always;
            }
        }
    </style>
</head>
<body>
    <div class="document-header">
        <h1 class="document-title">${title}</h1>
        <div class="document-meta">Generated on ${new Date().toLocaleDateString()}</div>
    </div>
    
    <div class="content">
        ${content}
    </div>
</body>
</html>`
  }

  public async generatePdfFromMarkdown(
    markdown: string,
    title: string,
    options: PdfGenerationOptions = {}
  ): Promise<PdfGenerationResult> {
    let browser: puppeteer.Browser | null = null
    let page: puppeteer.Page | null = null

    try {
      console.log(`Starting PDF generation for: ${title}`)

      // Convert markdown to HTML
      const htmlContent = marked(markdown)
      const fullHtml = this.generateHtmlTemplate(htmlContent, title)

      // Initialize browser and page
      browser = await this.initializeBrowser()
      page = await browser.newPage()

      // Set content
      await page.setContent(fullHtml, {
        waitUntil: 'networkidle0',
        timeout: 30000
      })

      // Generate PDF
      const defaultOptions: puppeteer.PDFOptions = {
        format: options.format || 'A4',
        margin: options.margin || {
          top: '20mm',
          right: '15mm',
          bottom: '20mm',
          left: '15mm'
        },
        displayHeaderFooter: options.displayHeaderFooter || true,
        headerTemplate: options.headerTemplate || `
          <div style="font-size: 10px; margin: 0 auto; color: #666;">
            <span class="title"></span>
          </div>
        `,
        footerTemplate: options.footerTemplate || `
          <div style="font-size: 10px; margin: 0 auto; color: #666; width: 100%; text-align: center;">
            Page <span class="pageNumber"></span> of <span class="totalPages"></span>
          </div>
        `,
        printBackground: options.printBackground !== false
      }

      const pdfBuffer = await page.pdf(defaultOptions)

      // Generate file path
      const timestamp = Date.now()
      const sanitizedTitle = title.replace(/[^a-zA-Z0-9\s-]/g, '').replace(/\s+/g, '-').toLowerCase()
      const fileName = `${sanitizedTitle}-${timestamp}.pdf`
      const relativePath = `generated-pdfs/${fileName}`
      const absolutePath = join(process.cwd(), 'public', relativePath)

      // Ensure directory exists
      const dirPath = dirname(absolutePath)
      if (!existsSync(dirPath)) {
        mkdirSync(dirPath, { recursive: true })
      }

      // Save PDF to disk
      writeFileSync(absolutePath, pdfBuffer)

      console.log(`PDF generated successfully: ${absolutePath} (${pdfBuffer.length} bytes)`)

      return {
        success: true,
        pdfPath: absolutePath,
        filePath: relativePath,
        fileSize: pdfBuffer.length
      }

    } catch (error) {
      console.error('PDF generation error:', error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    } finally {
      if (page) {
        await page.close()
      }
      // Don't close browser immediately - keep it warm for performance
    }
  }

  public async generatePdfForDocument(documentId: string): Promise<PdfGenerationResult> {
    try {
      console.log(`Generating PDF for document: ${documentId}`)

      // Get document from database
      const document = await prisma.document.findUnique({
        where: { id: documentId }
      })

      if (!document) {
        return {
          success: false,
          error: 'Document not found'
        }
      }

      if (!document.content) {
        return {
          success: false,
          error: 'Document has no content to convert to PDF'
        }
      }

      // Only generate PDF for URL documents or documents without existing PDFs
      if (document.sourceType !== 'URL' && document.sourceType !== 'PDF_URL') {
        return {
          success: false,
          error: 'PDF generation only supported for URL documents'
        }
      }

      // Generate PDF from content
      const result = await this.generatePdfFromMarkdown(
        document.content,
        document.title
      )

      if (!result.success) {
        return result
      }

      // Update document in database
      const updatedDocument = await prisma.document.update({
        where: { id: documentId },
        data: {
          pdfPath: result.filePath,
          hasGeneratedPdf: true,
          pdfGeneratedAt: new Date()
        }
      })

      console.log(`Document updated: ${documentId} - PDF generated successfully`)

      return {
        success: true,
        pdfPath: result.pdfPath,
        filePath: result.filePath,
        fileSize: result.fileSize
      }

    } catch (error) {
      console.error(`Error generating PDF for document ${documentId}:`, error)
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error occurred'
      }
    }
  }

  public async cleanup(): Promise<void> {
    await this.closeBrowser()
  }
}

// Export singleton instance
export const pdfGenerator = PdfGeneratorService.getInstance()

// Cleanup on process exit
process.on('exit', async () => {
  await pdfGenerator.cleanup()
})

process.on('SIGINT', async () => {
  await pdfGenerator.cleanup()
  process.exit(0)
})

process.on('SIGTERM', async () => {
  await pdfGenerator.cleanup()
  process.exit(0)
})