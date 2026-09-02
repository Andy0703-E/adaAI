import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth/auth';
import { prisma } from '@/lib/db/prisma';
import { createErrorResponse } from '@/lib/utils/error-response';
import { logger } from '@/lib/logging/logger';
import { rateLimit } from '@/lib/rate-limit';
import { parseDocument } from '@/lib/documents/parser';
import { DocumentAttachmentStatus } from '@prisma/client';

export const runtime = "nodejs";

const DOCUMENT_MAX_FILE_BYTES = 5242880; // 5 MB
const DOCUMENT_MAX_FILES_PER_MESSAGE = 3;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await auth();
  if (!session?.user?.id) {
    return createErrorResponse('UNAUTHORIZED', 'Unauthorized', undefined, 401);
  }

  const resolvedParams = await params;
  const conversationId = resolvedParams.id;
  const userId = session.user.id;

  const conversation = await prisma.conversation.findFirst({
    where: { id: conversationId, userId },
  });

  if (!conversation) {
    return createErrorResponse('NOT_FOUND', 'Conversation not found', undefined, 404);
  }

  const clientIp = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "anonymous";
  const rl = await rateLimit({
    scope: 'document_upload',
    userId,
    ip: clientIp,
  });
  
  if (!rl.allowed) {
    return NextResponse.json(
      {
        error: 'RATE_LIMIT_EXCEEDED',
        message: 'Too many uploads. Please try again later.',
        retryAfter: rl.retryAfter,
      },
      { status: 429 }
    );
  }

  const formData = await request.formData().catch(() => null);
  if (!formData) {
    return createErrorResponse('VALIDATION_FAILED', 'Invalid form data', undefined, 400);
  }

  const file = formData.get('file') as File;
  if (!file) {
    return createErrorResponse('VALIDATION_FAILED', 'No file provided', undefined, 400);
  }

  if (file.size > DOCUMENT_MAX_FILE_BYTES) {
    return createErrorResponse('DOCUMENT_TOO_LARGE', 'File exceeds the maximum size of 5MB', undefined, 400);
  }

  const existingAttachments = await prisma.documentAttachment.count({
    where: { conversationId, status: 'UPLOADED', messageId: null },
  });

  if (existingAttachments >= DOCUMENT_MAX_FILES_PER_MESSAGE) {
    return createErrorResponse('DOCUMENT_TOO_MANY_FILES', `Maximum ${DOCUMENT_MAX_FILES_PER_MESSAGE} attachments allowed per message`, undefined, 400);
  }
  
  const originalName = file.name || 'document';
  const mimeType = file.type || 'application/octet-stream';
  
  const allowedMimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'text/plain',
    'text/markdown'
  ];

  if (!allowedMimeTypes.includes(mimeType)) {
      return createErrorResponse('DOCUMENT_UNSUPPORTED_TYPE', 'Unsupported file type. Allowed: PDF, DOCX, TXT, MD', undefined, 400);
  }

  if(file.size === 0) {
      return createErrorResponse('DOCUMENT_INVALID_FILE', 'File is empty', undefined, 400);
  }

  const arrayBuffer = await file.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  
  const startMs = Date.now();
  let extractedText: string | null = null;
  let parseError: string | null = null;
  
  try {
      extractedText = await parseDocument(buffer, mimeType, originalName);
  } catch (err: any) {
      parseError = err.message;
  }
  
  const parseMs = Date.now() - startMs;
  
  if (parseError) {
      logger.error('Document parsing failed', { parseError, mimeType, sizeBytes: file.size });
      return createErrorResponse('DOCUMENT_PARSE_FAILED', 'Failed to parse document content', undefined, 400);
  }
  
  if (!extractedText || extractedText.trim().length === 0) {
      return createErrorResponse('DOCUMENT_NO_EXTRACTABLE_TEXT', 'Dokumen ini tidak memiliki teks yang dapat dibaca. PDF hasil scan belum didukung pada AdaAI V1.1.', undefined, 400);
  }
  
  const extractedChars = extractedText.length;
  
  if (extractedChars > 80000) {
      return createErrorResponse('DOCUMENT_TEXT_TOO_LARGE', 'Extracted text exceeds the maximum character limit', undefined, 400);
  }
  
  const attachment = await prisma.documentAttachment.create({
      data: {
          userId,
          conversationId,
          originalName,
          mimeType,
          sizeBytes: file.size,
          extractedText,
          extractedChars,
          status: DocumentAttachmentStatus.READY
      }
  });
  
  logger.info('Document uploaded successfully', {
      attachmentId: attachment.id,
      mimeType,
      sizeBytes: file.size,
      extractedChars,
      parseMs,
      docStatus: attachment.status
  });
  
  return NextResponse.json({
      id: attachment.id,
      name: attachment.originalName,
      mimeType: attachment.mimeType,
      sizeBytes: attachment.sizeBytes,
      extractedChars: attachment.extractedChars,
      status: attachment.status
  }, { status: 201 });
}
