/**
 * Image editing/generation tool using DALL-E or similar APIs
 */

import { type ToolResult } from './base-tool.js';
import { writeFileSync } from 'fs';
import { join } from 'path';
import OpenAI from 'openai';

export const generateImageDefinition = {
  type: 'function' as const,
  function: {
    name: 'generate_image',
    description: 'Generate or edit images using DALL-E. Can create new images from text descriptions or edit existing images with masks. Use for P图, image creation, or image manipulation tasks.',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Description of the image to generate or edit. Be detailed and specific.'
        },
        mode: {
          type: 'string',
          enum: ['generate', 'edit'],
          description: 'Mode: "generate" creates a new image, "edit" modifies an existing image'
        },
        image_path: {
          type: 'string',
          description: 'Required for edit mode: Path to the source image (PNG only)'
        },
        mask_path: {
          type: 'string',
          description: 'Optional for edit mode: Path to mask image (PNG, transparent areas will be edited)'
        },
        size: {
          type: 'string',
          enum: ['1024x1024', '1792x1024', '1024x1792'],
          description: 'Image size. Default: 1024x1024. Use wider/taller for specific compositions.'
        },
        quality: {
          type: 'string',
          enum: ['standard', 'hd'],
          description: 'Image quality. "hd" creates finer details but costs more. Default: standard'
        },
        style: {
          type: 'string',
          enum: ['vivid', 'natural'],
          description: 'Style: "vivid" for hyper-real, dramatic; "natural" for more realistic. Default: vivid'
        },
        output_name: {
          type: 'string',
          description: 'Optional: Output filename (will be saved in workspace). Default: generated_image_{timestamp}.png'
        }
      },
      required: ['prompt', 'mode']
    }
  }
};

export async function generateImage(
  args: {
    prompt: string;
    mode: 'generate' | 'edit';
    image_path?: string;
    mask_path?: string;
    size?: '1024x1024' | '1792x1024' | '1024x1792';
    quality?: 'standard' | 'hd';
    style?: 'vivid' | 'natural';
    output_name?: string;
  },
  context: {
    cwd: string;
    apiKey: string;
    baseUrl?: string;
  }
): Promise<ToolResult> {
  try {
    const { 
      prompt, 
      mode, 
      image_path, 
      mask_path, 
      size = '1024x1024',
      quality = 'standard',
      style = 'vivid',
      output_name
    } = args;
    const { cwd, apiKey, baseUrl } = context;

    console.log(`[generate_image] Using baseUrl=${baseUrl || '<default>'}`);

    // Initialize OpenAI client
    const client = new OpenAI({
      apiKey,
      baseURL: baseUrl || 'https://api.openai.com/v1'
    });

    console.log(`[generate_image] ${mode} mode: "${prompt.substring(0, 50)}..."`);

    let response: any;

    if (mode === 'generate') {
      // Generate new image
      response = await client.images.generate({
        model: 'dall-e-3',
        prompt,
        size,
        quality,
        style,
        n: 1
      });
    } else if (mode === 'edit') {
      // Edit existing image
      if (!image_path) {
        return {
          success: false,
          error: 'image_path is required for edit mode'
        };
      }

      // Read image file
      const fs = await import('fs');
      const absoluteImagePath = image_path.startsWith('/') ? image_path : join(cwd, image_path);
      
      let imageFile: File;
      try {
        const imageBuffer = fs.readFileSync(absoluteImagePath);
        imageFile = new File([imageBuffer], 'image.png', { type: 'image/png' });
      } catch (error) {
        return {
          success: false,
          error: `Failed to read image file: ${error instanceof Error ? error.message : String(error)}`
        };
      }

      // Read mask if provided
      let maskFile: File | undefined;
      if (mask_path) {
        const absoluteMaskPath = mask_path.startsWith('/') ? mask_path : join(cwd, mask_path);
        try {
          const maskBuffer = fs.readFileSync(absoluteMaskPath);
          maskFile = new File([maskBuffer], 'mask.png', { type: 'image/png' });
        } catch (error) {
          return {
            success: false,
            error: `Failed to read mask file: ${error instanceof Error ? error.message : String(error)}`
          };
        }
      }

      // Call DALL-E edit API
      response = await client.images.edit({
        model: 'dall-e-2', // Edit only works with dall-e-2
        image: imageFile,
        mask: maskFile,
        prompt,
        n: 1,
        size: '1024x1024' // Edit mode only supports 1024x1024
      });
    } else {
      return {
        success: false,
        error: `Invalid mode: ${mode}. Must be "generate" or "edit".`
      };
    }

    // Download generated image
    const imageUrl = response.data[0].url;
    if (!imageUrl) {
      return {
        success: false,
        error: 'No image URL returned from API'
      };
    }

    // Fetch image data
    const imageResponse = await fetch(imageUrl);
    const imageBuffer = Buffer.from(await imageResponse.arrayBuffer());

    // Save to workspace
    const fileName = output_name || `generated_image_${Date.now()}.png`;
    const outputPath = join(cwd, fileName);
    writeFileSync(outputPath, imageBuffer);

    console.log(`[generate_image] Saved to ${outputPath} (${(imageBuffer.length / 1024).toFixed(1)}KB)`);

    return {
      success: true,
      output: `Image ${mode === 'generate' ? 'generated' : 'edited'} successfully!\n\nPrompt: "${prompt}"\nSaved to: ${outputPath}\nSize: ${(imageBuffer.length / 1024).toFixed(1)}KB\n\nYou can now view or further process the image.`,
      data: {
        filePath: outputPath,
        fileName,
        fileSize: imageBuffer.length,
        url: imageUrl,
        prompt,
        revisedPrompt: response.data[0].revised_prompt
      }
    };
  } catch (error: any) {
    console.error('[generate_image] Error:', error);

    // Handle specific API errors
    if (error.status === 401) {
      return {
        success: false,
        error: 'Authentication failed. Check your OpenAI API key.'
      };
    }

    if (error.status === 400) {
      return {
        success: false,
        error: `Invalid request: ${error.message || 'Check your prompt and parameters'}`
      };
    }

    return {
      success: false,
      error: `Image generation failed: ${error.message || String(error)}`
    };
  }
}
