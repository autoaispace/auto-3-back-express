import { PredictionServiceClient } from '@google-cloud/aiplatform';
import { google } from '@google-cloud/aiplatform/build/protos/protos';
import path from 'path';

export class ImageGenerationService {
  private client: PredictionServiceClient;
  private projectId: string;
  private location: string;

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'gen-lang-client-0322496168';
    this.location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
    
    // 初始化客户端
    this.client = new PredictionServiceClient({
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS || path.join(__dirname, '../../google-cloud-key.json'),
    });
    
    console.log('🎨 ImageGenerationService initialized with project:', this.projectId);
  }

  /**
   * 使用Imagen生成图像
   */
  async generateImage(prompt: string, options: {
    width?: number;
    height?: number;
    style?: string;
    negativePrompt?: string;
  } = {}): Promise<{
    success: boolean;
    imageData?: string;
    error?: string;
  }> {
    try {
      console.log('🎨 开始Imagen图像生成:', prompt);
      
      // 构建增强的纹身提示词
      const enhancedPrompt = this.enhancePromptForTattoo(prompt, options.style);
      
      // 构建请求
      const endpoint = `projects/${this.projectId}/locations/${this.location}/publishers/google/models/imagen-3.0-generate-001`;
      
      const instanceValue = {
        prompt: enhancedPrompt,
        negativePrompt: options.negativePrompt || "blurry, low quality, distorted, watermark, text, signature, nsfw",
        sampleCount: 1,
        aspectRatio: this.getAspectRatio(options.width, options.height),
        safetyFilterLevel: "block_some",
        personGeneration: "dont_allow"
      };

      const instances = [google.protobuf.Value.fromObject(instanceValue)];
      const parameters = google.protobuf.Value.fromObject({
        sampleCount: 1,
        aspectRatio: this.getAspectRatio(options.width, options.height),
        safetyFilterLevel: "block_some",
        personGeneration: "dont_allow"
      });

      const request = {
        endpoint,
        instances,
        parameters,
      };

      console.log('📡 发送Imagen API请求...');
      const [response] = await this.client.predict(request);
      
      if (response.predictions && response.predictions.length > 0) {
        const prediction = response.predictions[0];
        const predictionValue = prediction.structValue;
        
        if (predictionValue && predictionValue.fields && predictionValue.fields.bytesBase64Encoded) {
          const imageBase64 = predictionValue.fields.bytesBase64Encoded.stringValue;
          
          if (imageBase64) {
            console.log('✅ Imagen图像生成成功');
            return {
              success: true,
              imageData: `data:image/png;base64,${imageBase64}`
            };
          }
        }
      }
      
      console.warn('⚠️ Imagen API响应中没有图像数据');
      return {
        success: false,
        error: 'No image data in response'
      };
      
    } catch (error) {
      console.error('❌ Imagen图像生成失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Image generation failed'
      };
    }
  }

  /**
   * 使用Imagen进行图像编辑（图生图）
   */
  async editImage(
    prompt: string, 
    baseImageBase64: string, 
    options: {
      width?: number;
      height?: number;
      style?: string;
      strength?: number;
    } = {}
  ): Promise<{
    success: boolean;
    imageData?: string;
    error?: string;
  }> {
    try {
      console.log('🖼️ 开始Imagen图像编辑:', prompt);
      
      const endpoint = `projects/${this.projectId}/locations/${this.location}/publishers/google/models/imagen-3.0-generate-001`;
      
      const instanceValue = {
        prompt: `Based on the reference image, create a tattoo design: ${prompt}. Style: ${options.style || 'artistic tattoo design'}`,
        image: {
          bytesBase64Encoded: baseImageBase64.replace(/^data:image\/[a-z]+;base64,/, '')
        },
        editMode: "inpainting-insert",
        negativePrompt: "blurry, low quality, distorted, watermark, text, signature, nsfw",
        sampleCount: 1,
        guidanceScale: options.strength ? options.strength * 10 : 7.5,
        seed: Math.floor(Math.random() * 1000000)
      };

      const instances = [google.protobuf.Value.fromObject(instanceValue)];
      const parameters = google.protobuf.Value.fromObject({
        sampleCount: 1,
        guidanceScale: options.strength ? options.strength * 10 : 7.5
      });

      const request = {
        endpoint,
        instances,
        parameters,
      };

      console.log('📡 发送Imagen编辑请求...');
      const [response] = await this.client.predict(request);
      
      if (response.predictions && response.predictions.length > 0) {
        const prediction = response.predictions[0];
        const predictionValue = prediction.structValue;
        
        if (predictionValue && predictionValue.fields && predictionValue.fields.bytesBase64Encoded) {
          const imageBase64 = predictionValue.fields.bytesBase64Encoded.stringValue;
          
          if (imageBase64) {
            console.log('✅ Imagen图像编辑成功');
            return {
              success: true,
              imageData: `data:image/png;base64,${imageBase64}`
            };
          }
        }
      }
      
      console.warn('⚠️ Imagen编辑API响应中没有图像数据');
      return {
        success: false,
        error: 'No image data in edit response'
      };
      
    } catch (error) {
      console.error('❌ Imagen图像编辑失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Image editing failed'
      };
    }
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
      'stencil-friendly',
      'professional tattoo artwork'
    ];

    const styleEnhancements = {
      'traditional': 'traditional tattoo style, bold outlines, limited color palette, classic American tattoo',
      'realistic': 'photorealistic tattoo design, detailed shading, lifelike, hyperrealistic',
      'minimalist': 'minimalist tattoo design, simple lines, clean aesthetic, geometric simplicity',
      'geometric': 'geometric tattoo design, precise lines, mathematical patterns, sacred geometry',
      'watercolor': 'watercolor tattoo style, flowing colors, artistic brushstrokes, paint splash effects',
      'blackwork': 'blackwork tattoo design, solid black areas, high contrast, bold silhouettes'
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
    
    // 添加质量提升关键词
    enhancedPrompt = `${enhancedPrompt}, high quality, detailed, professional, artistic masterpiece`;
    
    return enhancedPrompt;
  }

  /**
   * 获取宽高比
   */
  private getAspectRatio(width?: number, height?: number): string {
    const w = width || 512;
    const h = height || 512;
    
    if (w === h) return "1:1";
    if (w > h) {
      if (w / h >= 1.7) return "16:9";
      return "4:3";
    } else {
      if (h / w >= 1.7) return "9:16";
      return "3:4";
    }
  }

  /**
   * 测试连接
   */
  async testConnection(): Promise<boolean> {
    try {
      console.log('🧪 测试Imagen API连接...');
      
      const result = await this.generateImage('test tattoo design', {
        width: 256,
        height: 256
      });
      
      console.log('✅ Imagen API连接测试完成:', result.success);
      return result.success;
    } catch (error) {
      console.error('❌ Imagen API连接测试失败:', error);
      return false;
    }
  }
}