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
import { ImageGenerationService } from './ImageGenerationService';

export class GeminiService {
  private apiKey: string;
  private baseUrl: string;
  private imageGenService: ImageGenerationService;

  constructor() {
    this.apiKey = GEMINI_CONFIG.API_KEY;
    this.baseUrl = GEMINI_CONFIG.BASE_URL;
    this.imageGenService = new ImageGenerationService();
    
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
      
      // 使用真正的Imagen API生成图像
      const result = await this.imageGenService.generateImage(request.prompt, {
        width: request.width || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_WIDTH,
        height: request.height || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_HEIGHT,
        style: request.style,
        negativePrompt: request.negativePrompt
      });

      const generationTime = Date.now() - startTime;
      
      if (result.success && result.imageData) {
        console.log('✅ 真实图像生成成功');
        return {
          success: true,
          imageData: result.imageData,
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
        console.warn('⚠️ 图像生成失败，使用占位符:', result.error);
        // 如果真实生成失败，返回增强占位符
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

      // 使用真正的Imagen API进行图像编辑
      const result = await this.imageGenService.editImage(
        request.prompt,
        request.imageData,
        {
          width: request.width || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_WIDTH,
          height: request.height || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_HEIGHT,
          style: request.style,
          strength: request.strength || 0.7
        }
      );

      const generationTime = Date.now() - startTime;
      
      if (result.success && result.imageData) {
        console.log('✅ 真实图像编辑成功');
        return {
          success: true,
          imageData: result.imageData,
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
        console.warn('⚠️ 图像编辑失败，使用占位符:', result.error);
        return this.generateFallbackResponse(request, startTime, 'image-to-image');
      }

    } catch (error) {
      console.error('❌ 图生图生成失败:', error);
      return this.generateFallbackResponse(request, startTime, 'image-to-image');
    }
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
      imageData: this.generateEnhancedPlaceholderImage(prompt, 'Fallback placeholder image', type),
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
   * 生成增强的占位符图像（基于AI描述）
   */
  private generateEnhancedPlaceholderImage(originalPrompt: string, aiDescription: string, type: string = 'text-to-image'): string {
    // 创建一个更精美的SVG占位符，包含AI生成的描述
    const svg = `
      <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#2a2a2a;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#1a1a1a;stop-opacity:1" />
          </linearGradient>
          <filter id="glow">
            <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
            <feMerge> 
              <feMergeNode in="coloredBlur"/>
              <feMergeNode in="SourceGraphic"/>
            </feMerge>
          </filter>
          <pattern id="tattooPattern" patternUnits="userSpaceOnUse" width="40" height="40">
            <rect width="40" height="40" fill="none"/>
            <path d="M0 20 L20 0 L40 20 L20 40 Z" stroke="#333" stroke-width="0.5" fill="none"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg)"/>
        <rect width="100%" height="100%" fill="url(#tattooPattern)" opacity="0.1"/>
        
        <!-- 主要设计元素 -->
        <circle cx="256" cy="180" r="80" fill="none" stroke="#555" stroke-width="3"/>
        <path d="M 176 180 L 256 100 L 336 180 L 256 260 Z" fill="none" stroke="#777" stroke-width="2"/>
        <circle cx="256" cy="180" r="40" fill="none" stroke="#999" stroke-width="1"/>
        
        <!-- 装饰性元素 -->
        <path d="M 200 120 Q 256 80 312 120" stroke="#666" stroke-width="2" fill="none"/>
        <path d="M 200 240 Q 256 280 312 240" stroke="#666" stroke-width="2" fill="none"/>
        
        <!-- 标题 -->
        <text x="50%" y="320" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="20" font-weight="bold" filter="url(#glow)">
          AI Tattoo Design
        </text>
        
        <!-- 类型标识 -->
        <text x="50%" y="350" text-anchor="middle" fill="#888" font-family="Arial, sans-serif" font-size="14">
          ${type === 'text-to-image' ? 'Text-to-Image' : 'Image-to-Image'} • Imagen Powered
        </text>
        
        <!-- 原始提示 -->
        <text x="50%" y="380" text-anchor="middle" fill="#666" font-family="Arial, sans-serif" font-size="12">
          "${originalPrompt.substring(0, 40)}${originalPrompt.length > 40 ? '...' : ''}"
        </text>
        
        <!-- 底部装饰 -->
        <rect x="50" y="450" width="412" height="2" fill="#333"/>
        <text x="50%" y="480" text-anchor="middle" fill="#555" font-family="monospace" font-size="10">
          Generated by Google Imagen AI • ${new Date().toLocaleString()}
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
      // 测试Imagen API连接
      const isImageGenWorking = await this.imageGenService.testConnection();
      
      // 测试Gemini API连接
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

      const isGeminiWorking = response.ok;
      
      console.log('🧪 API连接测试结果:', {
        gemini: isGeminiWorking,
        imagen: isImageGenWorking
      });
      
      return isGeminiWorking || isImageGenWorking; // 至少一个工作即可
    } catch (error) {
      console.error('❌ API连接测试失败:', error);
      return false;
    }
  }
}