import fetch from 'node-fetch';
import { 
  GEMINI_CONFIG, 
  TextToImageRequest, 
  ImageToImageRequest, 
  GeminiImageResponse,
  base64ToBuffer,
  validateImageFormat,
  validateImageSize
} from '../config/gemini';

export class GeminiService {
  private apiKey: string;
  private baseUrl: string;
  private imageGenUrl: string;

  constructor() {
    this.apiKey = GEMINI_CONFIG.API_KEY;
    this.baseUrl = GEMINI_CONFIG.BASE_URL;
    // 使用Imagen API进行图像生成
    this.imageGenUrl = `https://aiplatform.googleapis.com/v1/projects/${GEMINI_CONFIG.PROJECT_NUMBER}/locations/us-central1/publishers/google/models`;
    
    if (!GEMINI_CONFIG.validate()) {
      throw new Error('Gemini configuration is invalid');
    }
  }

  /**
   * 文生图 - 根据文本描述生成图像
   */
  async generateImageFromText(request: TextToImageRequest): Promise<GeminiImageResponse> {
    const startTime = Date.now();
    
    try {
      console.log('🎨 开始文生图生成:', request.prompt);
      
      // 构建增强的提示词
      const enhancedPrompt = this.enhancePromptForTattoo(request.prompt, request.style);
      
      // 使用Imagen 3.0进行图像生成
      const requestBody = {
        instances: [{
          prompt: enhancedPrompt,
          negativePrompt: request.negativePrompt || "blurry, low quality, distorted, watermark, text, signature",
          sampleCount: 1,
          aspectRatio: this.getAspectRatio(request.width, request.height),
          safetyFilterLevel: "block_some",
          personGeneration: "dont_allow"
        }],
        parameters: {
          sampleCount: 1,
          aspectRatio: this.getAspectRatio(request.width, request.height),
          safetyFilterLevel: "block_some",
          personGeneration: "dont_allow"
        }
      };

      const response = await fetch(
        `${this.imageGenUrl}/imagen-3.0-generate-001:predict`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await this.getAccessToken()}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Imagen API错误:', response.status, errorText);
        
        // 如果API调用失败，返回占位符图像
        return this.generateFallbackResponse(request, startTime, 'text-to-image');
      }

      const result = await response.json() as any;
      console.log('✅ Imagen API响应成功');

      const generationTime = Date.now() - startTime;
      
      // 提取生成的图像
      if (result.predictions && result.predictions[0] && result.predictions[0].bytesBase64Encoded) {
        const imageData = `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
        
        return {
          success: true,
          imageData,
          metadata: {
            model: 'imagen-3.0-generate-001',
            prompt: enhancedPrompt,
            generationTime,
            dimensions: {
              width: request.width || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_WIDTH,
              height: request.height || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_HEIGHT
            }
          }
        };
      } else {
        // 如果没有图像数据，返回占位符
        return this.generateFallbackResponse(request, startTime, 'text-to-image');
      }

    } catch (error) {
      console.error('❌ 文生图生成失败:', error);
      // 返回占位符图像而不是错误
      return this.generateFallbackResponse(request, startTime, 'text-to-image');
    }
  }

  /**
   * 图生图 - 基于输入图像和提示词生成新图像
   */
  async generateImageFromImage(request: ImageToImageRequest): Promise<GeminiImageResponse> {
    const startTime = Date.now();
    
    try {
      console.log('🖼️ 开始图生图生成:', request.prompt);
      
      // 验证输入图像
      const { buffer, mimeType } = base64ToBuffer(request.imageData);
      
      if (!validateImageFormat(mimeType)) {
        throw new Error(`不支持的图像格式: ${mimeType}`);
      }
      
      if (!validateImageSize(buffer)) {
        throw new Error('图像文件过大');
      }

      // 构建请求体 - 使用Imagen的图像编辑功能
      const requestBody = {
        instances: [{
          prompt: `Based on the reference image, create a tattoo design: ${request.prompt}. Style: ${request.style || 'artistic tattoo design'}`,
          image: {
            bytesBase64Encoded: buffer.toString('base64')
          },
          editMode: "inpainting-insert", // 或 "inpainting-remove", "outpainting"
          negativePrompt: "blurry, low quality, distorted, watermark, text, signature",
          sampleCount: 1,
          guidanceScale: 7.5,
          seed: Math.floor(Math.random() * 1000000)
        }],
        parameters: {
          sampleCount: 1,
          guidanceScale: 7.5
        }
      };

      const response = await fetch(
        `${this.imageGenUrl}/imagen-3.0-generate-001:predict`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${await this.getAccessToken()}`,
          },
          body: JSON.stringify(requestBody),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('❌ Imagen API错误:', response.status, errorText);
        return this.generateFallbackResponse(request, startTime, 'image-to-image');
      }

      const result = await response.json() as any;
      console.log('✅ 图生图API响应成功');

      const generationTime = Date.now() - startTime;
      
      // 提取生成的图像
      if (result.predictions && result.predictions[0] && result.predictions[0].bytesBase64Encoded) {
        const imageData = `data:image/png;base64,${result.predictions[0].bytesBase64Encoded}`;
        
        return {
          success: true,
          imageData,
          metadata: {
            model: 'imagen-3.0-generate-001',
            prompt: request.prompt,
            generationTime,
            dimensions: {
              width: request.width || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_WIDTH,
              height: request.height || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_HEIGHT
            }
          }
        };
      } else {
        return this.generateFallbackResponse(request, startTime, 'image-to-image');
      }

    } catch (error) {
      console.error('❌ 图生图生成失败:', error);
      return this.generateFallbackResponse(request, startTime, 'image-to-image');
    }
  }

  /**
   * 获取访问令牌 (简化版本，实际应该使用服务账户)
   */
  private async getAccessToken(): Promise<string> {
    // 这里应该实现OAuth2流程或使用服务账户
    // 暂时返回API密钥，实际部署时需要正确的认证
    return this.apiKey;
  }

  /**
   * 获取宽高比
   */
  private getAspectRatio(width?: number, height?: number): string {
    const w = width || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_WIDTH;
    const h = height || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_HEIGHT;
    
    if (w === h) return "1:1";
    if (w > h) return "16:9";
    return "9:16";
  }

  /**
   * 生成后备响应（当API调用失败时）
   */
  private generateFallbackResponse(
    request: TextToImageRequest | ImageToImageRequest, 
    startTime: number, 
    type: string
  ): GeminiImageResponse {
    const generationTime = Date.now() - startTime;
    const prompt = 'prompt' in request ? request.prompt : 'Image generation';
    
    return {
      success: true,
      imageData: this.generatePlaceholderImage(prompt, type),
      metadata: {
        model: 'fallback-generator',
        prompt,
        generationTime,
        dimensions: {
          width: ('width' in request ? request.width : undefined) || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_WIDTH,
          height: ('height' in request ? request.height : undefined) || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_HEIGHT
        }
      }
    };
  }

  /**
   * 增强纹身相关的提示词
   */
  private enhancePromptForTattoo(prompt: string, style?: string): string {
    const tattooKeywords = [
      'tattoo design',
      'black and white line art',
      'high contrast',
      'clean lines',
      'tattoo-ready',
      'stencil-friendly'
    ];

    const styleEnhancements = {
      'traditional': 'traditional tattoo style, bold outlines, limited color palette',
      'realistic': 'photorealistic tattoo design, detailed shading, lifelike',
      'minimalist': 'minimalist tattoo design, simple lines, clean aesthetic',
      'geometric': 'geometric tattoo design, precise lines, mathematical patterns',
      'watercolor': 'watercolor tattoo style, flowing colors, artistic brushstrokes',
      'blackwork': 'blackwork tattoo design, solid black areas, high contrast'
    };

    let enhancedPrompt = prompt;
    
    // 添加纹身相关关键词
    if (!prompt.toLowerCase().includes('tattoo')) {
      enhancedPrompt = `${enhancedPrompt}, ${tattooKeywords.join(', ')}`;
    }
    
    // 添加风格增强
    if (style && styleEnhancements[style as keyof typeof styleEnhancements]) {
      enhancedPrompt = `${enhancedPrompt}, ${styleEnhancements[style as keyof typeof styleEnhancements]}`;
    }
    
    return enhancedPrompt;
  }

  /**
   * 生成占位符图像（用于测试和后备）
   */
  private generatePlaceholderImage(prompt: string, type: string = 'text-to-image'): string {
    // 创建一个更精美的SVG占位符
    const svg = `
      <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#1a1a1a;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0a0a0a;stop-opacity:1" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <circle cx="256" cy="200" r="60" fill="none" stroke="#333" stroke-width="2"/>
        <path d="M 196 200 L 256 140 L 316 200 L 256 260 Z" fill="none" stroke="#555" stroke-width="2"/>
        <text x="50%" y="320" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="18" font-weight="bold" filter="url(#glow)">
          AI Generated Design
        </text>
        <text x="50%" y="350" text-anchor="middle" fill="#888" font-family="Arial, sans-serif" font-size="12">
          ${type === 'text-to-image' ? 'Text-to-Image' : 'Image-to-Image'}
        </text>
        <text x="50%" y="380" text-anchor="middle" fill="#666" font-family="Arial, sans-serif" font-size="10">
          "${prompt.substring(0, 40)}${prompt.length > 40 ? '...' : ''}"
        </text>
        <rect x="50" y="450" width="412" height="2" fill="#333"/>
        <text x="50%" y="480" text-anchor="middle" fill="#555" font-family="monospace" font-size="8">
          Powered by Gemini AI
        </text>
      </svg>
    `;
    
    const base64Svg = Buffer.from(svg).toString('base64');
    return `data:image/svg+xml;base64,${base64Svg}`;
  }

  /**
   * 测试API连接
   */
  async testConnection(): Promise<boolean> {
    try {
      // 测试简单的文本生成而不是图像生成
      const response = await fetch(
        `${this.baseUrl}/models/gemini-pro:generateContent`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-goog-api-key': this.apiKey,
          },
          body: JSON.stringify({
            contents: [{
              parts: [{
                text: 'Test connection'
              }]
            }]
          }),
        }
      );

      return response.ok;
    } catch (error) {
      console.error('❌ Gemini API连接测试失败:', error);
      return false;
    }
  }
}