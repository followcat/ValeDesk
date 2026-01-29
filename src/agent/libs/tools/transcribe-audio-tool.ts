/**
 * Audio transcription tool using OpenAI Whisper API
 */

import { type ToolResult } from './base-tool.js';
import { readFileSync } from 'fs';
import { basename } from 'path';
import OpenAI from 'openai';

export const transcribeAudioDefinition = {
  type: 'function' as const,
  function: {
    name: 'transcribe_audio',
    description: 'Transcribe audio file to text using OpenAI Whisper. Supports mp3, mp4, mpeg, mpga, m4a, wav, and webm files up to 25MB. Use this to convert speech to text, extract lyrics, or analyze audio content.',
    parameters: {
      type: 'object',
      properties: {
        file_path: {
          type: 'string',
          description: 'Path to the audio file to transcribe (relative or absolute)'
        },
        language: {
          type: 'string',
          description: 'Optional: ISO-639-1 language code (e.g., "en", "zh", "ja"). Improves accuracy and latency.'
        },
        prompt: {
          type: 'string',
          description: 'Optional: Context to guide the transcription (e.g., proper nouns, terminology)'
        },
        response_format: {
          type: 'string',
          enum: ['text', 'json', 'verbose_json'],
          description: 'Optional: Output format. Default is "text". Use "verbose_json" for timestamps and word-level details.'
        }
      },
      required: ['file_path']
    }
  }
};

export async function transcribeAudio(
  args: {
    file_path: string;
    language?: string;
    prompt?: string;
    response_format?: 'text' | 'json' | 'verbose_json';
  },
  context: {
    cwd: string;
    apiKey: string;
    baseUrl?: string;
  }
): Promise<ToolResult> {
  try {
    const { file_path, language, prompt, response_format = 'text' } = args;
    const { cwd, apiKey, baseUrl } = context;

    // Resolve file path
    const absolutePath = file_path.startsWith('/') ? file_path : `${cwd}/${file_path}`;
    
    // Check file exists and read it
    let fileBuffer: Buffer;
    try {
      fileBuffer = readFileSync(absolutePath);
    } catch (error) {
      return {
        success: false,
        error: `Failed to read audio file: ${error instanceof Error ? error.message : String(error)}`
      };
    }

    // Check file size (Whisper has 25MB limit)
    const maxSize = 25 * 1024 * 1024; // 25MB
    if (fileBuffer.length > maxSize) {
      return {
        success: false,
        error: `Audio file too large: ${(fileBuffer.length / 1024 / 1024).toFixed(2)}MB. Maximum is 25MB.`
      };
    }

    // Initialize OpenAI client
    const client = new OpenAI({
      apiKey,
      baseURL: baseUrl || 'https://api.openai.com/v1'
    });

    // Create File object for upload
    const fileName = basename(absolutePath);
    const file = new File([fileBuffer], fileName, {
      type: getAudioMimeType(fileName)
    });

    // Call Whisper API
    console.log(`[transcribe_audio] Transcribing ${fileName} (${(fileBuffer.length / 1024).toFixed(1)}KB)...`);
    
    const transcription = await client.audio.transcriptions.create({
      file,
      model: 'whisper-1',
      ...(language && { language }),
      ...(prompt && { prompt }),
      response_format
    });

    // Format output based on response format
    let output: string;
    if (response_format === 'verbose_json') {
      output = JSON.stringify(transcription, null, 2);
    } else if (response_format === 'json') {
      output = JSON.stringify(transcription);
    } else {
      output = typeof transcription === 'string' ? transcription : (transcription as any).text;
    }

    return {
      success: true,
      output: `Transcription of ${fileName}:\n\n${output}`,
      data: { transcription, fileName, fileSize: fileBuffer.length }
    };
  } catch (error: any) {
    console.error('[transcribe_audio] Error:', error);
    
    // Handle specific API errors
    if (error.status === 401) {
      return {
        success: false,
        error: 'Authentication failed. Check your OpenAI API key.'
      };
    }
    
    if (error.status === 413) {
      return {
        success: false,
        error: 'Audio file too large. Maximum size is 25MB.'
      };
    }

    return {
      success: false,
      error: `Transcription failed: ${error.message || String(error)}`
    };
  }
}

// Helper: Determine MIME type from file extension
function getAudioMimeType(fileName: string): string {
  const ext = fileName.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    'mp3': 'audio/mpeg',
    'mp4': 'audio/mp4',
    'm4a': 'audio/mp4',
    'mpeg': 'audio/mpeg',
    'mpga': 'audio/mpeg',
    'wav': 'audio/wav',
    'webm': 'audio/webm'
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}
