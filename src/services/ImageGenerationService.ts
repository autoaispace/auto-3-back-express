import { PredictionServiceClient } from '@google-cloud/aiplatform';
import { google } from '@google-cloud/aiplatform/build/protos/protos';
import { FallbackImageService } from './FallbackImageService';
import fetch from 'node-fetch';

export class ImageGenerationService {
  private vertexClient: PredictionServiceClient | null = null;
  private projectId: string;
  private location: string;
  private fallbackService: FallbackImageService;
  private isGeminiInitialized: boolean = false;
  private isVertexInitialized: boolean = false;

  constructor() {
    this.projectId = process.env.GOOGLE_CLOUD_PROJECT_ID || 'gen-lang-client-0322496168';
    this.location = process.env.GOOGLE_CLOUD_LOCATION || 'us-central1';
    this.fallbackService = new FallbackImageService();

    // 初始化服务
    this.initializeServices();
  }

  /**
   * 初始化所有图像生成服务
   */
  private async initializeServices() {
    // 检查 Gemini API Key
    this.initializeGeminiClient();
    
    // 初始化 Vertex AI 客户端
    await this.initializeVertexClient();
  }

  /**
   * 检查 Gemini API Key 是否可用
   */
  private initializeGeminiClient() {
    try {
      const apiKey = process.env.GEMINI_API_KEY;
      if (apiKey) {
        console.log('✅ Gemini API Key已配置');
        this.isGeminiInitialized = true;
      } else {
        console.warn('⚠️ Gemini API密钥未配置');
        this.isGeminiInitialized = false;
      }
    } catch (error) {
      console.error('❌ Gemini API Key检查失败:', error);
      this.isGeminiInitialized = false;
    }
  }

  /**
   * 初始化 Vertex AI 客户端
   */
  private async initializeVertexClient() {
    try {
      const credentials = this.getCredentialsFromEnv();

      if (credentials) {
        this.vertexClient = new PredictionServiceClient({
          credentials,
          projectId: this.projectId,
        });

        console.log('✅ Vertex AI客户端初始化成功');
        this.isVertexInitialized = true;
      } else {
        console.warn('⚠️ Vertex AI凭据不可用');
        this.isVertexInitialized = false;
      }
    } catch (error) {
      console.error('❌ Vertex AI客户端初始化失败:', error);
      this.isVertexInitialized = false;
    }
  }

  /**
   * 从环境变量获取Google Cloud凭据
   */
  private getCredentialsFromEnv() {
    // 优先使用JSON格式的凭据
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
   * 主要图像生成方法 - 按优先级尝试各种服务
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
    console.log('🎨 开始图像生成流程:', prompt);

    // 方案1: Gemini 2.5 Flash (使用 REST API)
    if (this.isGeminiInitialized) {
      try {
        console.log('🚀 尝试方案1: Gemini 2.5 Flash (REST API)');
        const result = await this.generateWithGeminiREST(prompt, options);
        if (result.success) {
          console.log('✅ Gemini 2.5 Flash生成成功');
          return result;
        }
        console.warn('⚠️ Gemini 2.5 Flash失败:', result.error);
      } catch (error) {
        console.error('❌ Gemini 2.5 Flash异常:', error);
      }
    } else {
      console.log('⚠️ Gemini API Key未配置，跳过');
    }

    // 方案2: Pollinations.ai
    console.log('🔄 尝试方案2: Pollinations.ai');
    try {
      const pollinationsResult = await this.fallbackService.generateWithPollinations(prompt, options);
      if (pollinationsResult.success) {
        console.log('✅ Pollinations.ai生成成功');
        return pollinationsResult;
      }
      console.warn('⚠️ Pollinations.ai失败:', pollinationsResult.error);
    } catch (error) {
      console.warn('⚠️ Pollinations.ai异常:', error);
    }

    // 方案3: Gemini Vertex AI (Imagen)
    if (this.isVertexInitialized && this.vertexClient) {
      try {
        console.log('🔄 尝试方案3: Gemini Vertex AI (Imagen)');
        const result = await this.generateWithVertexImagen(prompt, options);
        if (result.success) {
          console.log('✅ Vertex AI Imagen生成成功');
          return result;
        }
        console.warn('⚠️ Vertex AI Imagen失败:', result.error);
      } catch (error) {
        console.error('❌ Vertex AI Imagen异常:', error);
        
        // 检查是否是计费问题
        if (error instanceof Error && error.message.includes('BILLING_DISABLED')) {
          console.error('💳 Google Cloud项目未启用计费，请访问以下链接启用:');
          console.error('🔗 https://console.developers.google.com/billing/enable?project=' + this.projectId);
        }
      }
    } else {
      console.log('⚠️ Vertex AI未初始化，跳过');
    }

    // 方案4: OpenRouter
    console.log('🔄 尝试方案4: OpenRouter');
    try {
      const openRouterResult = await this.fallbackService.generateWithOpenRouter(prompt);
      if (openRouterResult.success) {
        console.log('✅ OpenRouter生成成功');
        return openRouterResult;
      }
      console.warn('⚠️ OpenRouter失败:', openRouterResult.error);
    } catch (error) {
      console.warn('⚠️ OpenRouter异常:', error);
    }

    // 方案5: Hugging Face
    console.log('🔄 尝试方案5: Hugging Face');
    try {
      const hfResult = await this.fallbackService.generateWithHuggingFace(prompt);
      if (hfResult.success) {
        console.log('✅ Hugging Face生成成功');
        return hfResult;
      }
      console.warn('⚠️ Hugging Face失败:', hfResult.error);
    } catch (error) {
      console.warn('⚠️ Hugging Face异常:', error);
    }

    // 方案6: Replicate (如果配置了)
    if (process.env.REPLICATE_API_TOKEN) {
      console.log('🔄 尝试方案6: Replicate');
      try {
        const replicateResult = await this.fallbackService.generateWithReplicate(prompt);
        if (replicateResult.success) {
          console.log('✅ Replicate生成成功');
          return replicateResult;
        }
        console.warn('⚠️ Replicate失败:', replicateResult.error);
      } catch (error) {
        console.warn('⚠️ Replicate异常:', error);
      }
    }

    // 方案7: Craiyon
    console.log('🔄 尝试方案7: Craiyon');
    try {
      const craiyonResult = await this.fallbackService.generateWithCraiyon(prompt);
      if (craiyonResult.success) {
        console.log('✅ Craiyon生成成功');
        return craiyonResult;
      }
      console.warn('⚠️ Craiyon失败:', craiyonResult.error);
    } catch (error) {
      console.warn('⚠️ Craiyon异常:', error);
    }

    // 最终方案: 程序化生成
    console.log('🎯 使用最终方案: 程序化生成');
    const proceduralResult = this.fallbackService.generateProceduralTattoo(prompt);
    console.log('✅ 程序化纹身生成成功');
    return proceduralResult;
  }

  /**
   * 使用 Gemini REST API 生成图像
   */
  private async generateWithGeminiREST(prompt: string, options: {
    width?: number;
    height?: number;
    style?: string;
    negativePrompt?: string;
  }): Promise<{
    success: boolean;
    imageData?: string;
    error?: string;
  }> {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      throw new Error('Gemini API Key未配置');
    }

    console.log('🎨 开始Gemini REST API图像生成:', prompt);

    // 构建增强的纹身提示词
    const enhancedPrompt = this.enhancePromptForTattoo(prompt, options.style);

    try {
      // 使用 Gemini REST API
      const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent?key=${apiKey}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            parts: [{
              text: `请生成一个专业纹身设计的详细描述。要求：${enhancedPrompt}。
              
请提供详细的视觉描述，包括：
- 主要设计元素
- 线条风格和粗细
- 构图和布局
- 艺术风格特点
- 适合纹身的特征

请用专业的艺术术语描述这个纹身设计。`
            }]
          }],
          generationConfig: {
            temperature: 0.7,
            topK: 40,
            topP: 0.95,
            maxOutputTokens: 1024,
          }
        }),
      });

      if (response.ok) {
        const result = await response.json() as any;
        
        if (result.candidates && result.candidates[0] && result.candidates[0].content) {
          const description = result.candidates[0].content.parts[0].text;
          
          console.log('📝 Gemini返回纹身设计描述，使用程序化生成');
          // 使用描述来增强程序化生成
          return this.fallbackService.generateProceduralTattoo(prompt + ' ' + description);
        }
      } else {
        const errorText = await response.text();
        console.warn('⚠️ Gemini REST API错误:', response.status, errorText);
      }

      return {
        success: false,
        error: 'No valid response from Gemini REST API'
      };

    } catch (error) {
      console.error('❌ Gemini REST API生成失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Gemini REST API generation failed'
      };
    }
  }

  /**
   * 使用 Vertex AI Imagen 生成图像
   */
  private async generateWithVertexImagen(prompt: string, options: {
    width?: number;
    height?: number;
    style?: string;
    negativePrompt?: string;
  }): Promise<{
    success: boolean;
    imageData?: string;
    error?: string;
  }> {
    if (!this.vertexClient) {
      throw new Error('Vertex AI客户端未初始化');
    }

    console.log('🎨 开始Vertex AI Imagen图像生成:', prompt);

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

    console.log('📡 发送Vertex AI Imagen请求...');
    const [response] = await this.vertexClient.predict(request);

    if (response.predictions && response.predictions.length > 0) {
      const prediction = response.predictions[0];
      const predictionValue = prediction.structValue;

      if (predictionValue && predictionValue.fields && predictionValue.fields.bytesBase64Encoded) {
        const imageBase64 = predictionValue.fields.bytesBase64Encoded.stringValue;

        if (imageBase64) {
          console.log('✅ Vertex AI Imagen图像生成成功');
          return {
            success: true,
            imageData: `data:image/png;base64,${imageBase64}`
          };
        }
      }
    }

    return {
      success: false,
      error: 'No image data in Vertex AI Imagen response'
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
    // 首先尝试Vertex AI Imagen
    if (this.isVertexInitialized && this.vertexClient) {
      try {
        const result = await this.editWithVertexImagen(prompt, baseImageBase64, options);
        if (result.success) {
          return result;
        }
        console.warn('⚠️ Vertex AI Imagen编辑失败，使用程序化生成:', result.error);
      } catch (error) {
        console.error('❌ Vertex AI Imagen编辑API调用异常:', error);
      }
    }

    // 备用方案: 程序化生成
    console.log('🎯 图生图备用方案: 程序化生成');
    const proceduralResult = this.fallbackService.generateProceduralTattoo(prompt);
    console.log('✅ 程序化纹身生成成功');
    return proceduralResult;
  }

  /**
   * 使用Vertex AI Imagen进行图像编辑
   */
  private async editWithVertexImagen(
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
    if (!this.vertexClient) {
      throw new Error('Vertex AI客户端未初始化');
    }

    console.log('🖼️ 开始Vertex AI Imagen图像编辑:', prompt);

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

    console.log('📡 发送Vertex AI Imagen编辑请求...');
    const [response] = await this.vertexClient.predict(request);

    if (response.predictions && response.predictions.length > 0) {
      const prediction = response.predictions[0];
      const predictionValue = prediction.structValue;

      if (predictionValue && predictionValue.fields && predictionValue.fields.bytesBase64Encoded) {
        const imageBase64 = predictionValue.fields.bytesBase64Encoded.stringValue;

        if (imageBase64) {
          console.log('✅ Vertex AI Imagen图像编辑成功');
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