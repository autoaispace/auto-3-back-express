import dotenv from 'dotenv';

dotenv.config();

// Gemini API 配置
export const GEMINI_CONFIG = {
    API_KEY: process.env.GEMINI_API_KEY || 'AIzaSyDz0B3fx8k2nNPWodRZbXNFyMdJG86XmLI',
    PROJECT_ID: process.env.GEMINI_PROJECT_ID || 'projects/80867917966',
    PROJECT_NUMBER: process.env.GEMINI_PROJECT_NUMBER || '80867917966',

    // API 端点
    BASE_URL: 'https://generativelanguage.googleapis.com/v1beta',

    // 模型配置
    MODELS: {
        TEXT_TO_IMAGE: 'gemini-2.0-flash',
        IMAGE_TO_IMAGE: 'gemini-2.0-flash'
    },

    // 图像生成配置
    IMAGE_CONFIG: {
        MAX_WIDTH: 1024,
        MAX_HEIGHT: 1024,
        DEFAULT_WIDTH: 512,
        DEFAULT_HEIGHT: 512,
        SUPPORTED_FORMATS: ['image/jpeg', 'image/png', 'image/webp'],
        MAX_FILE_SIZE: 10 * 1024 * 1024, // 10MB
    },

    // 验证配置
    validate() {
        if (!this.API_KEY) {
            console.warn('⚠️ GEMINI_API_KEY not set');
            return false;
        }
        return true;
    }
};

// 图像生成请求接口
export interface TextToImageRequest {
    prompt: string;
    width?: number;
    height?: number;
    style?: string;
    negativePrompt?: string;
}

export interface ImageToImageRequest {
    prompt: string;
    imageData: string; // base64 encoded image
    strength?: number; // 0.0 to 1.0
    width?: number;
    height?: number;
    style?: string;
}

// 新增：STENCIL请求接口
export interface StencilRequest {
    prompt: string;
    imageData: string; // base64 encoded image
    width?: number;
    height?: number;
}

// 新增：TRY-ON请求接口
export interface TryOnRequest {
    prompt: string;
    imageData: string; // base64 encoded image
    width?: number;
    height?: number;
}

// 新增：COVER-UP请求接口
export interface CoverUpRequest {
    prompt: string;
    imageData: string; // base64 encoded image
    width?: number;
    height?: number;
}

// API响应接口
export interface GeminiImageResponse {
    success: boolean;
    imageUrl?: string;
    imageData?: string; // base64
    error?: string;
    metadata?: {
        model: string;
        prompt: string;
        generationTime: number;
        dimensions: {
            width: number;
            height: number;
        };
        creditsUsed?: number;
        remainingCredits?: number;
    };
}

// 辅助函数：将图像转换为base64
export function imageToBase64(buffer: Buffer, mimeType: string): string {
    return `data:${mimeType};base64,${buffer.toString('base64')}`;
}

// 辅助函数：从base64提取图像数据
export function base64ToBuffer(base64String: string): { buffer: Buffer; mimeType: string } {
    const matches = base64String.match(/^data:([^;]+);base64,(.+)$/);
    if (!matches) {
        throw new Error('Invalid base64 image format');
    }

    const mimeType = matches[1];
    const base64Data = matches[2];
    const buffer = Buffer.from(base64Data, 'base64');

    return { buffer, mimeType };
}

// 验证图像格式
export function validateImageFormat(mimeType: string): boolean {
    return GEMINI_CONFIG.IMAGE_CONFIG.SUPPORTED_FORMATS.includes(mimeType);
}

// 验证图像大小
export function validateImageSize(buffer: Buffer): boolean {
    return buffer.length <= GEMINI_CONFIG.IMAGE_CONFIG.MAX_FILE_SIZE;
}