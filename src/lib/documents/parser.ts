const pdfParseModule = require('pdf-parse');
import * as mammoth from 'mammoth';

// Hack around weird CJS/ESM interop issues with pdf-parse
const pdfParse = typeof pdfParseModule === 'function' ? pdfParseModule : (pdfParseModule as any).default;

const DOCUMENT_MAX_EXTRACTED_CHARS = 80000;
const DOCX_MAX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024; // 25 MB

export async function parseDocument(buffer: Buffer, mimeType: string, originalName: string): Promise<string | null> {
    let text = '';
    
    if (mimeType === 'application/pdf') {
        const data = await pdfParse(buffer);
        text = data.text;
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || originalName.endsWith('.docx')) {
        // Protect against DOCX decompression bombs
        if (buffer.length > DOCX_MAX_UNCOMPRESSED_BYTES) {
           throw new Error('DOCX exceeds maximum safe decompression size limit.');
        }
        
        try {
            const result = await mammoth.extractRawText({ buffer });
            text = result.value;
        } catch (e: any) {
            throw new Error(`Failed to parse DOCX securely: ${e.message}`);
        }
    } else if (mimeType === 'text/plain' || mimeType === 'text/markdown' || originalName.endsWith('.txt') || originalName.endsWith('.md')) {
        text = buffer.toString('utf-8');
    } else {
        throw new Error('Unsupported mime type for parsing');
    }
    
    return normalizeText(text);
}

function normalizeText(text: string): string {
    if (!text) return '';
    let normalized = text.replace(/\0/g, ''); // Remove null bytes
    normalized = normalized.replace(/\r\n/g, '\n').replace(/\r/g, '\n'); // Normalize line endings
    normalized = normalized.replace(/\n{3,}/g, '\n\n'); // Collapse multiple newlines
    return normalized.trim();
}
