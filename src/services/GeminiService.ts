import fetch from 'node-fetch';
import { 
  GEMINI_CONFIG, 
  TextToImageRequest, 
  ImageToImageRequest, 
  StencilRequest,
  TryOnRequest,
  CoverUpRequest,
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
        return this.generateFallbackResponse(request, startTime, 'text-to-image');
      }

    } catch (error) {
      console.error('❌ 文生图生成失败:', error);
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
   * STENCIL - 生成纹身模板
   */
  async generateStencil(request: StencilRequest): Promise<GeminiImageResponse> {
    const startTime = Date.now();
    
    try {
      console.log('📋 开始STENCIL生成:', request.prompt);
      
      // 验证输入图像
      const { buffer, mimeType } = base64ToBuffer(request.imageData);
      
      if (!validateImageFormat(mimeType)) {
        throw new Error(`不支持的图像格式: ${mimeType}`);
      }
      
      if (!validateImageSize(buffer)) {
        throw new Error('图像文件过大');
      }

      // 构建专门的STENCIL提示词
      const stencilPrompt = `Create a tattoo stencil based on this image. ${request.prompt}. 
      Requirements: 
      - Black and white line art only
      - Clean, bold outlines suitable for tattoo stenciling
      - Remove all shading and color
      - Simplify details for tattoo application
      - High contrast black lines on white background
      - Stencil-ready design`;

      // 使用图像编辑功能生成STENCIL
      const result = await this.imageGenService.editImage(
        stencilPrompt,
        request.imageData,
        {
          width: request.width || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_WIDTH,
          height: request.height || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_HEIGHT,
          strength: 0.8 // 较高的强度以确保转换为模板风格
        }
      );

      const generationTime = Date.now() - startTime;
      
      if (result.success && result.imageData) {
        console.log('✅ STENCIL生成成功');
        return {
          success: true,
          imageData: result.imageData,
          metadata: {
            model: 'stencil-generator',
            prompt: request.prompt,
            generationTime,
            dimensions: {
              width: request.width || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_WIDTH,
              height: request.height || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_HEIGHT
            }
          }
        };
      } else {
        console.warn('⚠️ STENCIL生成失败，使用占位符:', result.error);
        return this.generateFallbackResponse(request, startTime, 'stencil');
      }

    } catch (error) {
      console.error('❌ STENCIL生成失败:', error);
      return this.generateFallbackResponse(request, startTime, 'stencil');
    }
  }

  /**
   * TRY-ON - 生成纹身试穿效果
   */
  async generateTryOn(request: TryOnRequest): Promise<GeminiImageResponse> {
    const startTime = Date.now();
    
    try {
      console.log('👕 开始TRY-ON生成:', request.prompt);
      
      // 验证输入图像
      const { buffer, mimeType } = base64ToBuffer(request.imageData);
      
      if (!validateImageFormat(mimeType)) {
        throw new Error(`不支持的图像格式: ${mimeType}`);
      }
      
      if (!validateImageSize(buffer)) {
        throw new Error('图像文件过大');
      }

      // 构建专门的TRY-ON提示词
      const tryOnPrompt = `Apply this tattoo design to the person in the image: ${request.prompt}. 
      Requirements:
      - Realistically place the tattoo on the person's skin
      - Match skin tone and lighting
      - Natural tattoo placement and sizing
      - Maintain realistic skin texture
      - Show how the tattoo would look when healed
      - Professional tattoo application appearance`;

      // 使用图像编辑功能生成TRY-ON效果
      const result = await this.imageGenService.editImage(
        tryOnPrompt,
        request.imageData,
        {
          width: request.width || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_WIDTH,
          height: request.height || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_HEIGHT,
          strength: 0.6 // 中等强度以保持人物特征
        }
      );

      const generationTime = Date.now() - startTime;
      
      if (result.success && result.imageData) {
        console.log('✅ TRY-ON生成成功');
        return {
          success: true,
          imageData: result.imageData,
          metadata: {
            model: 'try-on-generator',
            prompt: request.prompt,
            generationTime,
            dimensions: {
              width: request.width || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_WIDTH,
              height: request.height || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_HEIGHT
            }
          }
        };
      } else {
        console.warn('⚠️ TRY-ON生成失败，使用占位符:', result.error);
        return this.generateFallbackResponse(request, startTime, 'try-on');
      }

    } catch (error) {
      console.error('❌ TRY-ON生成失败:', error);
      return this.generateFallbackResponse(request, startTime, 'try-on');
    }
  }

  /**
   * COVER-UP - 生成纹身遮盖设计
   */
  async generateCoverUp(request: CoverUpRequest): Promise<GeminiImageResponse> {
    const startTime = Date.now();
    
    try {
      console.log('🎭 开始COVER-UP生成:', request.prompt);
      
      // 验证输入图像
      const { buffer, mimeType } = base64ToBuffer(request.imageData);
      
      if (!validateImageFormat(mimeType)) {
        throw new Error(`不支持的图像格式: ${mimeType}`);
      }
      
      if (!validateImageSize(buffer)) {
        throw new Error('图像文件过大');
      }

      // 构建专门的COVER-UP提示词
      const coverUpPrompt = `Design a cover-up tattoo that completely covers the existing tattoo in this image. ${request.prompt}. 
      Requirements:
      - Completely cover and hide the old tattoo
      - Use darker, bolder elements to mask the existing ink
      - Create a cohesive new design that works with the skin area
      - Strategic use of black and dark shading
      - Professional cover-up tattoo techniques
      - Ensure the new design is larger and darker than the original
      - Artistic and aesthetically pleasing final result`;

      // 使用图像编辑功能生成COVER-UP设计
      const result = await this.imageGenService.editImage(
        coverUpPrompt,
        request.imageData,
        {
          width: request.width || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_WIDTH,
          height: request.height || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_HEIGHT,
          strength: 0.9 // 高强度以确保完全覆盖原有纹身
        }
      );

      const generationTime = Date.now() - startTime;
      
      if (result.success && result.imageData) {
        console.log('✅ COVER-UP生成成功');
        return {
          success: true,
          imageData: result.imageData,
          metadata: {
            model: 'cover-up-generator',
            prompt: request.prompt,
            generationTime,
            dimensions: {
              width: request.width || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_WIDTH,
              height: request.height || GEMINI_CONFIG.IMAGE_CONFIG.DEFAULT_HEIGHT
            }
          }
        };
      } else {
        console.warn('⚠️ COVER-UP生成失败，使用占位符:', result.error);
        return this.generateFallbackResponse(request, startTime, 'cover-up');
      }

    } catch (error) {
      console.error('❌ COVER-UP生成失败:', error);
      return this.generateFallbackResponse(request, startTime, 'cover-up');
    }
  }

  /**
   * 生成后备响应（当API调用失败时）
   */
  private generateFallbackResponse(
    request: TextToImageRequest | ImageToImageRequest | StencilRequest | TryOnRequest | CoverUpRequest, 
    startTime: number, 
    type: string
  ): GeminiImageResponse {
    const generationTime = Date.now() - startTime;
    const prompt = 'prompt' in request ? request.prompt : 'Image generation';
    
    return {
      success: true,
      imageData: this.generateEnhancedPlaceholderImage(prompt, type),
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
   * 生成增强的占位符图像
   */
  private generateEnhancedPlaceholderImage(originalPrompt: string, type: string = 'text-to-image'): string {
    // 根据不同类型生成不同的图标和标题
    const typeConfig = {
      'text-to-image': { icon: '🎨', title: 'Design Generation', color: '#4CAF50' },
      'image-to-image': { icon: '🖼️', title: 'Image Enhancement', color: '#2196F3' },
      'stencil': { icon: '📋', title: 'Stencil Creation', color: '#FF9800' },
      'try-on': { icon: '👕', title: 'Try-On Preview', color: '#9C27B0' },
      'cover-up': { icon: '🎭', title: 'Cover-Up Design', color: '#F44336' }
    };

    const config = typeConfig[type as keyof typeof typeConfig] || typeConfig['text-to-image'];

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
        <circle cx="256" cy="180" r="80" fill="none" stroke="${config.color}" stroke-width="3"/>
        <path d="M 176 180 L 256 100 L 336 180 L 256 260 Z" fill="none" stroke="${config.color}" stroke-width="2" opacity="0.7"/>
        <circle cx="256" cy="180" r="40" fill="none" stroke="${config.color}" stroke-width="1" opacity="0.5"/>
        
        <!-- 装饰性元素 -->
        <path d="M 200 120 Q 256 80 312 120" stroke="#666" stroke-width="2" fill="none"/>
        <path d="M 200 240 Q 256 280 312 240" stroke="#666" stroke-width="2" fill="none"/>
        
        <!-- 类型图标 -->
        <text x="50%" y="140" text-anchor="middle" font-size="48" fill="${config.color}" filter="url(#glow)">
          ${config.icon}
        </text>
        
        <!-- 标题 -->
        <text x="50%" y="320" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="20" font-weight="bold" filter="url(#glow)">
          ${config.title}
        </text>
        
        <!-- 副标题 -->
        <text x="50%" y="350" text-anchor="middle" fill="#888" font-family="Arial, sans-serif" font-size="14">
          AI Powered • InkGenius Pro
        </text>
        
        <!-- 原始提示 -->
        <text x="50%" y="380" text-anchor="middle" fill="#666" font-family="Arial, sans-serif" font-size="12">
          "${originalPrompt.substring(0, 40)}${originalPrompt.length > 40 ? '...' : ''}"
        </text>
        
        <!-- 底部装饰 -->
        <rect x="50" y="450" width="412" height="2" fill="#333"/>
        <text x="50%" y="480" text-anchor="middle" fill="#555" font-family="monospace" font-size="10">
          Generated by Gemini AI • ${new Date().toLocaleString()}
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