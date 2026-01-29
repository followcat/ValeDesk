# Multimodal Capabilities

ValeDesk now supports advanced multimodal operations for audio and image processing.

## Audio Transcription

Convert audio files to text using OpenAI Whisper API.

### Tool: `transcribe_audio`

**Supported Formats:** mp3, mp4, mpeg, mpga, m4a, wav, webm (max 25MB)

**Parameters:**
- `file_path` (required): Path to audio file
- `language` (optional): ISO-639-1 code (e.g., "en", "zh", "ja") for better accuracy
- `prompt` (optional): Context to guide transcription (proper nouns, terminology)
- `response_format` (optional): "text" (default), "json", or "verbose_json" (with timestamps)

**Examples:**

```
User: I attached an audio file. What's in it?
→ Assistant will automatically transcribe and summarize

User: Transcribe 三界四洲.mp3 to Chinese text
→ Uses transcribe_audio with language="zh"

User: Extract the lyrics from this song
→ Transcribes and formats as lyrics

User: Who is speaking in this audio? What are they talking about?
→ Transcribes and analyzes speaker/content
```

## Image Generation & Editing

Create or modify images using DALL-E API.

### Tool: `generate_image`

**Modes:**
- **generate**: Create new images from text (DALL-E 3)
- **edit**: Modify existing images with masks (DALL-E 2, PNG only)

**Parameters:**
- `prompt` (required): Detailed description
- `mode` (required): "generate" or "edit"
- `image_path` (for edit): Source image path
- `mask_path` (for edit, optional): Transparent mask PNG
- `size`: "1024x1024" (default), "1792x1024", "1024x1792"
- `quality`: "standard" (default) or "hd"
- `style`: "vivid" (default, hyper-real) or "natural"
- `output_name`: Custom filename (default: `generated_image_{timestamp}.png`)

**Examples:**

**Generate:**
```
User: Generate a sunset over mountains with a lake
→ Creates and saves image to workspace

User: 生成一张赛博朋克风格的城市夜景图
→ Generates cyberpunk cityscape

User: Create a logo for "ValeDesk" - modern, minimal, tech-focused
→ Generates logo design
```

**Edit:**
```
User: Change the background of this image to a beach
→ (Upload image first) Uses edit mode

User: P图：把人物的衣服改成红色的
→ Edits clothing color (requires mask)

User: Remove the text from this image
→ Uses mask to specify text area
```

## Workflow Examples

### Audio Analysis
```
1. User uploads audio file (drag & drop or attach)
2. "Transcribe this and give me a summary"
3. Assistant uses transcribe_audio tool
4. Receives full transcript
5. Provides summary and key points
```

### Music Editing Workflow
```
1. "Transcribe this song and extract the lyrics"
2. "Translate the lyrics to English"
3. "Generate album art for this song based on the lyrics"
4. (All handled automatically with tools)
```

### Image Editing Workflow
```
1. User uploads photo
2. "Change the background to sunset"
3. Assistant: "Let me edit this for you"
4. Uses generate_image in edit mode
5. Saves result: edited_photo.png
6. User can view/download from workspace
```

## Requirements

- **API Key**: Same OpenAI API key used for LLM (configured in Settings)
- **Workspace**: Audio/images saved to session workspace directory
- **File Limits**: 
  - Audio: 25MB max per file
  - Images: Standard web-compatible sizes

## Tips

**For better transcription:**
- Specify language with `language` parameter
- Use `prompt` for proper nouns, technical terms
- Use `verbose_json` format for timestamps

**For better image generation:**
- Be specific and detailed in prompts
- Use "hd" quality for fine details (costs more)
- Try "natural" style for realistic photos
- Use "vivid" style for artistic/dramatic images

**For image editing:**
- Source must be PNG format
- Mask defines editable area (transparent = edit, opaque = keep)
- Works best with clear, simple edits
- DALL-E 2 for editing (DALL-E 3 for generation)

## Troubleshooting

**"Authentication failed"**
→ Check OpenAI API key in Settings

**"File too large"**
→ Audio files must be <25MB. Compress or trim first.

**"Unsupported format"**
→ Convert to supported format (mp3, wav, png, etc.)

**"No workspace directory"**
→ Start session with workspace or configure default conversation directory

## Cost Notes

- Whisper API: ~$0.006/minute of audio
- DALL-E 3: ~$0.04 per image (standard), ~$0.08 (HD)
- DALL-E 2: ~$0.02 per image
- Check OpenAI pricing for latest rates
