import yauzl from 'yauzl';

const DOCUMENT_MAX_EXTRACTED_CHARS = 80000;
const DOCX_MAX_UNCOMPRESSED_BYTES = 25 * 1024 * 1024; // 25 MB
const DOCX_MAX_ENTRIES = 500;
const DOCX_MAX_ENTRY_SIZE = 20 * 1024 * 1024; // 20 MB

async function inspectDocxSafe(buffer: Buffer): Promise<void> {
    return new Promise((resolve, reject) => {
        yauzl.fromBuffer(buffer, { lazyEntries: true }, (err, zipfile) => {
            if (err) return reject(new Error('Invalid ZIP format'));
            
            let totalUncompressedSize = 0;
            let entriesCount = 0;
            
            zipfile.readEntry();
            
            zipfile.on('entry', (entry) => {
                entriesCount++;
                if (entriesCount > DOCX_MAX_ENTRIES) {
                    zipfile.close();
                    return reject(new Error('Too many entries in DOCX'));
                }
                
                const entrySize = entry.uncompressedSize || 0;
                
                if (entrySize > DOCX_MAX_ENTRY_SIZE) {
                    zipfile.close();
                    return reject(new Error(`Entry ${entry.fileName} is too large`));
                }
                
                totalUncompressedSize += entrySize;
                
                if (totalUncompressedSize > DOCX_MAX_UNCOMPRESSED_BYTES) {
                    zipfile.close();
                    return reject(new Error('Total uncompressed size exceeds maximum limit'));
                }
                
                zipfile.readEntry();
            });
            
            zipfile.on('end', () => {
                resolve();
            });
            
            zipfile.on('error', (e) => {
                reject(e);
            });
        });
    });
}

export async function parseDocument(buffer: Buffer, mimeType: string, originalName: string): Promise<string | null> {
    let text = '';

    if (mimeType === 'text/plain' || mimeType === 'text/markdown' || originalName.endsWith('.txt') || originalName.endsWith('.md')) {
        text = buffer.toString('utf-8');
    } else if (mimeType === 'application/pdf' || originalName.endsWith('.pdf')) {
        const { PDFParse } = await import('pdf-parse');
        const pdf = new PDFParse({ data: buffer });
        const data = await pdf.getText();
        text = data.text;
    } else if (mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' || originalName.endsWith('.docx')) {
        // Protect against DOCX decompression bombs by pre-inspecting the archive
        await inspectDocxSafe(buffer);

        try {
            const mammoth = await import('mammoth');
            const result = await mammoth.extractRawText({ buffer });
            text = result.value;
        } catch (e: any) {
            throw new Error(`Failed to parse DOCX securely: ${e.message}`);
        }
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
