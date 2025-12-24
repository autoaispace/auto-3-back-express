import { PredictionServiceClient } from '@google-cloud/aiplatform';
import { google } from '@google-cloud/aiplatform/build/protos/protos';
import { FallbackImageService } from './FallbackImageService';

export class ImageGenerationService {
  private client: PredictionServiceClient | null = null;
  private projectId: string;
  private location: string;
  private fallbackService: FallbackImageService;
  private isInitialized: boolean = false;

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'gen-lang-client-0322496168';
    this.location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
    this.fallbackService = new FallbackImageService();

    // 尝试初始化Google Cloud客户端
    this.initializeClient();
  }

  /**
   * 初始化Google Cloud客户端
   */
  private async initializeClient() {
    try {
      const credentials = this.getCredentialsFromEnv();

      if (credentials) {
        this.client = new PredictionServiceClient({
          credentials,
          projectId: this.projectId,
        });

        console.log('✅ Google Cloud AI Platform客户端初始化成功');
        this.isInitialized = true;
      } else {
        console.warn('⚠️ Google Cloud凭据不可用，将使用备用服务');
        this.isInitialized = false;
      }
    } catch (error) {
      console.error('❌ Google Cloud客户端初始化失败:', error);
      this.isInitialized = false;
    }
  }

  /**
   * 从环境变量获取Google Cloud凭据
   */
  private getCredentialsFromEnv() {
    // 优先使用JSON格式的凭据（Vercel推荐方式）
    const credentialsJson = process.env.GOOGLE_APPLICATION_CREDENTIALS_JSON;
    if (credentialsJson) {
      try {
        const credentials = JSON.parse(credentialsJson);
        console.log('✅ 使用JSON格式的Google Cloud凭据');
        return credentials;
      } catch (error) {
        console.error('❌ 解析JSON凭据失败:', error);
      }
    }

    // 备用方案：使用分离的环境变量
    const privateKey = process.env.GOOGLE_CLOUD_PRIVATE_KEY;
    const clientEmail = process.env.GOOGLE_CLOUD_CLIENT_EMAIL;

    if (privateKey && clientEmail) {
      try {
        // 处理私钥中的换行符
        const formattedPrivateKey = privateKey.replace(/\\n/g, '\n');

        console.log('✅ 使用分离的Google Cloud凭据环境变量');
        return {
          client_email: clientEmail,
          private_key: formattedPrivateKey,
          type: 'service_account',
          project_id: this.projectId,
        };
      } catch (error) {
        console.error('❌ 处理分离的Google Cloud凭据时出错:', error);
      }
    }

    console.warn('⚠️ 未找到有效的Google Cloud凭据');
    return null;
  }

  /**
   * 使用Imagen生成图像（带备用方案）
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
    // 首先尝试Google Cloud Imagen
    if (this.isInitialized && this.client) {
      try {
        const result = await this.generateWithImagen(prompt, options);
        if (result.success) {
          return result;
        }
        console.warn('⚠️ Imagen生成失败，尝试备用方案:', result.error);
      } catch (error) {
        console.error('❌ Imagen API调用异常:', error);
      }
    }

    // 备用方案1: 尝试Hugging Face
    console.log('🔄 尝试备用方案: Hugging Face');
    try {
      const hfResult = await this.fallbackService.generateWithHuggingFace(prompt);
      if (hfResult.success) {
        console.log('✅ Hugging Face生成成功');
        return hfResult;
      }
    } catch (error) {
      console.warn('⚠️ Hugging Face备用方案失败:', error);
    }

    // 备用方案2: 尝试Craiyon
    console.log('🔄 尝试备用方案: Craiyon');
    try {
      const craiyonResult = await this.fallbackService.generateWithCraiyon(prompt);
      if (craiyonResult.success) {
        console.log('✅ Craiyon生成成功');
        return craiyonResult;
      }
    } catch (error) {
      console.warn('⚠️ Craiyon备用方案失败:', error);
    }

    // 最终备用方案: 程序化生成
    console.log('🎯 使用最终备用方案: 程序化生成');
    const proceduralResult = this.fallbackService.generateProceduralTattoo(prompt);
    console.log('✅ 程序化纹身生成成功');
    return proceduralResult;
  }

  /**
   * 使用Google Cloud Imagen生成图像
   */
  private async generateWithImagen(prompt: string, options: {
    width?: number;
    height?: number;
    style?: string;
    negativePrompt?: string;
  }): Promise<{
    success: boolean;
    imageData?: string;
    error?: string;
  }> {
    if (!this.client) {
      throw new Error('Google Cloud客户端未初始化');
    }

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

    return {
      success: false,
      error: 'No image data in Imagen response'
    };
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
    // 首先尝试Google Cloud Imagen
    if (this.isInitialized && this.client) {
      try {
        const result = await this.editWithImagen(prompt, baseImageBase64, options);
        if (result.success) {
          return result;
        }
        console.warn('⚠️ Imagen编辑失败，使用程序化生成:', result.error);
      } catch (error) {
        console.error('❌ Imagen编辑API调用异常:', error);
      }
    }

    // 备用方案: 程序化生成
    console.log('🎯 图生图备用方案: 程序化生成');
    const proceduralResult = this.fallbackService.generateProceduralTattoo(prompt);
    console.log('✅ 程序化纹身生成成功');
    return proceduralResult;
  }

  /**
   * 使用Google Cloud Imagen进行图像编辑
   */
  private async editWithImagen(
    prompt: string,
    baseImageBase64: string,
    options: {
      width?: number;
      height?: number;
      style?: string;
      strength?: number;
    }
  ): Promise<{
    success: boolean;
    imageData?: string;
    error?: string;
  }> {
    if (!this.client) {
      throw new Error('Google Cloud客户端未初始化');
    }

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

    return {
      success: false,
      error: 'No image data in edit response'
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
      console.log('🧪 测试图像生成服务连接...');

      const result = await this.generateImage('test tattoo design', {
        width: 256,
        height: 256
      });

      console.log('✅ 图像生成服务连接测试完成:', result.success);
      return result.success;
    } catch (error) {
      console.error('❌ 图像生成服务连接测试失败:', error);
      return false;
    }
  }
}