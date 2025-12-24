import fetch from 'node-fetch';

/**
 * 备用图像生成服务
 * 当主要服务不可用时使用
 */
export class FallbackImageService {

    /**
     * 使用 Pollinations.ai 生成图像
     */
    async generateWithPollinations(prompt: string, options: {
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
            console.log('🌸 尝试使用Pollinations.ai生成图像:', prompt);

            const enhancedPrompt = this.enhancePromptForTattoo(prompt, options.style);
            const width = options.width || 512;
            const height = options.height || 512;

            // Pollinations.ai 支持多种模型
            const models = ['flux', 'flux-realism', 'flux-3d', 'turbo'];

            for (const model of models) {
                try {
                    const pollinationsUrl = `https://image.pollinations.ai/prompt/${encodeURIComponent(enhancedPrompt)}?width=${width}&height=${height}&model=${model}&enhance=true&nologo=true&private=true`;

                    console.log(`📡 尝试Pollinations.ai模型: ${model}`);
                    const response = await fetch(pollinationsUrl, {
                        method: 'GET',
                        headers: {
                            'User-Agent': 'InkGenius-Pro/1.0',
                            'Accept': 'image/*'
                        }
                    });

                    if (response.ok) {
                        const contentType = response.headers.get('content-type');
                        if (contentType && contentType.startsWith('image/')) {
                            const imageBuffer = await response.buffer();
                            const base64Image = imageBuffer.toString('base64');

                            console.log(`✅ Pollinations.ai (${model}) 生成成功`);
                            return {
                                success: true,
                                imageData: `data:image/png;base64,${base64Image}`
                            };
                        }
                    }
                } catch (modelError) {
                    console.warn(`⚠️ Pollinations.ai模型 ${model} 失败:`, modelError);
                    continue;
                }
            }

            return {
                success: false,
                error: 'All Pollinations.ai models failed'
            };

        } catch (error) {
            console.error('❌ Pollinations.ai生成失败:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Pollinations.ai generation failed'
            };
        }
    }

    /**
     * 使用OpenRouter API生成图像 - 修复版本
     */
    async generateWithOpenRouter(prompt: string): Promise<{
        success: boolean;
        imageData?: string;
        error?: string;
    }> {
        try {
            console.log('🚀 尝试使用OpenRouter生成图像:', prompt);

            const apiKey = process.env.OPENROUTER_API_KEY;
            if (!apiKey) {
                console.warn('⚠️ OpenRouter API密钥未配置');
                return {
                    success: false,
                    error: 'OpenRouter API key not configured'
                };
            }

            // 方法1: 尝试使用DALL-E 3 (正确的端点)
            try {
                const dalleResponse = await fetch('https://openrouter.ai/api/v1/images/generations', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                        'HTTP-Referer': 'https://inkgenius.digworldai.com',
                        'X-Title': 'InkGenius Pro'
                    },
                    body: JSON.stringify({
                        model: 'openai/dall-e-3',
                        prompt: `专业纹身设计: ${prompt}。风格: 黑白线条艺术，高对比度，清晰线条，适合纹身，模板友好，专业纹身艺术品，详细，艺术杰作`,
                        n: 1,
                        size: '1024x1024',
                        quality: 'standard'
                    }),
                });

                if (dalleResponse.ok) {
                    const result = await dalleResponse.json() as any;
                    if (result.data && result.data[0] && result.data[0].url) {
                        const imageResponse = await fetch(result.data[0].url);
                        if (imageResponse.ok) {
                            const imageBuffer = await imageResponse.buffer();
                            const base64Image = imageBuffer.toString('base64');
                            console.log('✅ OpenRouter DALL-E 3生成成功');
                            return {
                                success: true,
                                imageData: `data:image/png;base64,${base64Image}`
                            };
                        }
                    }
                }
            } catch (dalleError) {
                console.warn('⚠️ DALL-E 3方法失败，尝试其他模型');
            }

            return {
                success: false,
                error: 'All OpenRouter methods failed'
            };

        } catch (error) {
            console.error('❌ OpenRouter生成失败:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'OpenRouter generation failed'
            };
        }
    }

    /**
     * 使用Hugging Face Inference API生成图像 - 修复版本
     */
    async generateWithHuggingFace(prompt: string): Promise<{
        success: boolean;
        imageData?: string;
        error?: string;
    }> {
        try {
            console.log('🤗 尝试使用Hugging Face生成图像:', prompt);

            // 使用稳定的模型
            const response = await fetch(
                'https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                    },
                    body: JSON.stringify({
                        inputs: `纹身设计, ${prompt}, 黑白线条艺术, 高质量, 详细, 专业纹身艺术品, 模板就绪`,
                        parameters: {
                            negative_prompt: "模糊, 低质量, 扭曲, 不适宜, 水印, 文字, 签名, 彩色, 彩虹",
                            num_inference_steps: 20,
                            guidance_scale: 7.5,
                            width: 512,
                            height: 512
                        }
                    }),
                }
            );

            if (response.ok) {
                const contentType = response.headers.get('content-type');

                if (contentType && contentType.includes('image')) {
                    const imageBuffer = await response.buffer();
                    const base64Image = imageBuffer.toString('base64');

                    console.log('✅ Hugging Face图像生成成功');
                    return {
                        success: true,
                        imageData: `data:image/png;base64,${base64Image}`
                    };
                } else {
                    const result = await response.json() as any;
                    if (result.error && result.error.includes('loading')) {
                        console.log('🔄 模型正在加载，等待10秒后重试...');
                        await new Promise(resolve => setTimeout(resolve, 10000));

                        const retryResponse = await fetch(
                            'https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5',
                            {
                                method: 'POST',
                                headers: {
                                    'Content-Type': 'application/json',
                                },
                                body: JSON.stringify({
                                    inputs: `纹身设计, ${prompt}, 黑白线条艺术`,
                                }),
                            }
                        );

                        if (retryResponse.ok) {
                            const retryBuffer = await retryResponse.buffer();
                            const retryBase64 = retryBuffer.toString('base64');
                            console.log('✅ Hugging Face重试成功');
                            return {
                                success: true,
                                imageData: `data:image/png;base64,${retryBase64}`
                            };
                        }
                    }

                    return {
                        success: false,
                        error: result.error || 'Unknown Hugging Face error'
                    };
                }
            }

            return {
                success: false,
                error: 'Unexpected response format from Hugging Face'
            };
        } catch (error) {
            console.error('❌ Hugging Face生成失败:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Hugging Face generation failed'
            };
        }
    }

    /**
     * 使用Craiyon API - 修复版本
     */
    async generateWithCraiyon(prompt: string): Promise<{
        success: boolean;
        imageData?: string;
        error?: string;
    }> {
        try {
            console.log('🎨 尝试使用Craiyon生成图像:', prompt);

            const response = await fetch('https://api.craiyon.com/v3', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    prompt: `纹身设计 ${prompt} 黑白线条艺术`,
                    model: 'art',
                    negative_prompt: '模糊 低质量 不适宜',
                    version: '35s5hfwn9n78gb06'
                }),
            });

            if (response.ok) {
                const result = await response.json() as any;

                if (result.images && result.images.length > 0) {
                    const imageData = `data:image/png;base64,${result.images[0]}`;
                    console.log('✅ Craiyon图像生成成功');
                    return {
                        success: true,
                        imageData
                    };
                } else if (result.image) {
                    const imageData = `data:image/png;base64,${result.image}`;
                    console.log('✅ Craiyon图像生成成功');
                    return {
                        success: true,
                        imageData
                    };
                }
            }

            console.warn('⚠️ Craiyon API响应无效');
            return {
                success: false,
                error: 'No images in Craiyon response'
            };
        } catch (error) {
            console.error('❌ Craiyon生成失败:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Craiyon generation failed'
            };
        }
    }

    /**
     * 使用Replicate API作为额外备用方案
     */
    async generateWithReplicate(prompt: string): Promise<{
        success: boolean;
        imageData?: string;
        error?: string;
    }> {
        try {
            const apiToken = process.env.REPLICATE_API_TOKEN;
            if (!apiToken) {
                return {
                    success: false,
                    error: 'Replicate API token not configured'
                };
            }

            console.log('🔄 尝试使用Replicate生成图像:', prompt);

            const response = await fetch('https://api.replicate.com/v1/predictions', {
                method: 'POST',
                headers: {
                    'Authorization': `Token ${apiToken}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    version: 'ac732df83cea7fff18b8472768c88ad041fa750ff7682a21affe81863cbe77e4',
                    input: {
                        prompt: `专业纹身设计: ${prompt}, 黑白线条艺术, 高对比度, 清晰线条`,
                        negative_prompt: '模糊, 低质量, 彩色, 不适宜内容',
                        width: 512,
                        height: 512,
                        num_inference_steps: 20,
                        guidance_scale: 7.5
                    }
                }),
            });

            if (response.ok) {
                const prediction = await response.json() as any;

                let result = prediction;
                let attempts = 0;
                const maxAttempts = 30;

                while (result.status !== 'succeeded' && result.status !== 'failed' && attempts < maxAttempts) {
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    const statusResponse = await fetch(`https://api.replicate.com/v1/predictions/${result.id}`, {
                        headers: {
                            'Authorization': `Token ${apiToken}`,
                        },
                    });

                    if (statusResponse.ok) {
                        result = await statusResponse.json() as any;
                        attempts++;
                    } else {
                        break;
                    }
                }

                if (result.status === 'succeeded' && result.output && result.output.length > 0) {
                    const imageUrl = result.output[0];
                    const imageResponse = await fetch(imageUrl);

                    if (imageResponse.ok) {
                        const imageBuffer = await imageResponse.buffer();
                        const base64Image = imageBuffer.toString('base64');

                        console.log('✅ Replicate图像生成成功');
                        return {
                            success: true,
                            imageData: `data:image/png;base64,${base64Image}`
                        };
                    }
                }
            }

            return {
                success: false,
                error: 'Replicate generation failed or timed out'
            };
        } catch (error) {
            console.error('❌ Replicate生成失败:', error);
            return {
                success: false,
                error: error instanceof Error ? error.message : 'Replicate generation failed'
            };
        }
    }

    /**
     * 生成高质量的程序化纹身图像 - 增强版本
     */
    generateProceduralTattoo(prompt: string): {
        success: boolean;
        imageData: string;
    } {
        console.log('🎯 生成程序化纹身图像:', prompt);

        const elements = this.analyzePrompt(prompt);
        const svg = this.createTattooSVG(elements);
        const base64Svg = Buffer.from(svg).toString('base64');

        return {
            success: true,
            imageData: `data:image/svg+xml;base64,${base64Svg}`
        };
    }

    /**
     * 分析提示词中的设计元素 - 支持中文
     */
    private analyzePrompt(prompt: string): {
        style: string;
        elements: string[];
        complexity: 'simple' | 'medium' | 'complex';
    } {
        const lowerPrompt = prompt.toLowerCase();

        let style = 'traditional';
        if (lowerPrompt.includes('geometric') || lowerPrompt.includes('几何')) style = 'geometric';
        else if (lowerPrompt.includes('minimalist') || lowerPrompt.includes('极简') || lowerPrompt.includes('简约')) style = 'minimalist';
        else if (lowerPrompt.includes('realistic') || lowerPrompt.includes('写实') || lowerPrompt.includes('逼真')) style = 'realistic';
        else if (lowerPrompt.includes('tribal') || lowerPrompt.includes('部落') || lowerPrompt.includes('图腾')) style = 'tribal';

        const elements = [];
        if (lowerPrompt.includes('dragon') || lowerPrompt.includes('龙')) elements.push('dragon');
        if (lowerPrompt.includes('flower') || lowerPrompt.includes('rose') || lowerPrompt.includes('花') || lowerPrompt.includes('玫瑰')) elements.push('flower');
        if (lowerPrompt.includes('skull') || lowerPrompt.includes('骷髅') || lowerPrompt.includes('头骨')) elements.push('skull');
        if (lowerPrompt.includes('heart') || lowerPrompt.includes('心') || lowerPrompt.includes('爱心')) elements.push('heart');
        if (lowerPrompt.includes('star') || lowerPrompt.includes('星') || lowerPrompt.includes('星星')) elements.push('star');
        if (lowerPrompt.includes('moon') || lowerPrompt.includes('月亮') || lowerPrompt.includes('月')) elements.push('moon');
        if (lowerPrompt.includes('sun') || lowerPrompt.includes('太阳') || lowerPrompt.includes('日')) elements.push('sun');
        if (lowerPrompt.includes('cat') || lowerPrompt.includes('animal') || lowerPrompt.includes('猫') || lowerPrompt.includes('动物')) elements.push('animal');

        if (elements.length === 0) {
            elements.push('abstract');
        }

        const complexity = elements.length > 2 ? 'complex' : elements.length > 1 ? 'medium' : 'simple';

        return { style, elements, complexity };
    }

    /**
     * 创建SVG纹身设计
     */
    private createTattooSVG(elements: { style: string; elements: string[]; complexity: string }): string {
        const { style, elements: designElements, complexity } = elements;

        let svg = `
      <svg width="512" height="512" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
        <defs>
          <linearGradient id="tattooGrad" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#000000;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#333333;stop-opacity:1" />
          </linearGradient>
          <filter id="roughPaper">
            <feTurbulence baseFrequency="0.04" numOctaves="5" result="noise"/>
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="1"/>
          </filter>
        </defs>
        <rect width="100%" height="100%" fill="white"/>
    `;

        if (designElements.includes('dragon')) {
            svg += this.createDragonDesign(style);
        } else if (designElements.includes('flower')) {
            svg += this.createFlowerDesign(style);
        } else if (designElements.includes('skull')) {
            svg += this.createSkullDesign(style);
        } else if (designElements.includes('animal')) {
            svg += this.createAnimalDesign(style);
        } else if (style === 'geometric') {
            svg += this.createGeometricDesign();
        } else {
            svg += this.createAbstractDesign(style);
        }

        if (complexity !== 'simple') {
            svg += this.addDecorativeElements();
        }

        svg += `
      <text x="256" y="480" text-anchor="middle" font-family="serif" font-size="14" fill="#666">
        AI生成纹身设计 - InkGenius Pro
      </text>
    `;

        svg += '</svg>';
        return svg;
    }

    private createDragonDesign(style: string): string {
        return `
      <g transform="translate(256,256)" fill="none" stroke="black" stroke-width="3" filter="url(#roughPaper)">
        <path d="M-100,-50 Q-50,-100 0,-50 Q50,-100 100,-50 Q80,0 50,50 Q0,80 -50,50 Q-80,0 -100,-50 Z" />
        <circle cx="0" cy="-30" r="15" fill="black"/>
        <path d="M-20,-30 Q0,-50 20,-30" stroke-width="2"/>
        <path d="M-60,20 Q-40,40 -20,20" stroke-width="2"/>
        <path d="M20,20 Q40,40 60,20" stroke-width="2"/>
        ${style === 'traditional' ? '<path d="M-80,-20 L-100,-10 L-80,0" stroke-width="4"/>' : ''}
      </g>
    `;
    }

    private createFlowerDesign(style: string): string {
        return `
      <g transform="translate(256,256)" fill="none" stroke="black" stroke-width="2" filter="url(#roughPaper)">
        <circle cx="0" cy="0" r="20" fill="black" opacity="0.1"/>
        <path d="M0,-40 Q-20,-20 0,0 Q20,-20 0,-40" fill="black" opacity="0.3"/>
        <path d="M40,0 Q20,-20 0,0 Q20,20 40,0" fill="black" opacity="0.3"/>
        <path d="M0,40 Q20,20 0,0 Q-20,20 0,40" fill="black" opacity="0.3"/>
        <path d="M-40,0 Q-20,20 0,0 Q-20,-20 -40,0" fill="black" opacity="0.3"/>
        <line x1="0" y1="0" x2="0" y2="80" stroke-width="4"/>
        <path d="M-10,60 Q0,50 10,60" stroke-width="2"/>
        ${style === 'realistic' ? '<circle cx="0" cy="0" r="5" fill="black"/>' : ''}
      </g>
    `;
    }

    private createSkullDesign(style: string): string {
        return `
      <g transform="translate(256,200)" fill="none" stroke="black" stroke-width="3" filter="url(#roughPaper)">
        <ellipse cx="0" cy="0" rx="60" ry="80" fill="white" stroke="black"/>
        <circle cx="-25" cy="-20" r="15" fill="black"/>
        <circle cx="25" cy="-20" r="15" fill="black"/>
        <path d="M0,10 L-10,30 L0,40 L10,30 Z" fill="black"/>
        <path d="M-30,50 Q0,60 30,50" stroke-width="2"/>
        <line x1="-20" y1="55" x2="-20" y2="65" stroke-width="2"/>
        <line x1="-10" y1="55" x2="-10" y2="70" stroke-width="2"/>
        <line x1="0" y1="55" x2="0" y2="65" stroke-width="2"/>
        <line x1="10" y1="55" x2="10" y2="70" stroke-width="2"/>
        <line x1="20" y1="55" x2="20" y2="65" stroke-width="2"/>
      </g>
    `;
    }

    private createAnimalDesign(style: string): string {
        return `
      <g transform="translate(256,256)" fill="none" stroke="black" stroke-width="3" filter="url(#roughPaper)">
        <circle cx="0" cy="0" r="50" fill="white" stroke="black"/>
        <path d="M-30,-40 L-20,-60 L-10,-40" fill="black"/>
        <path d="M10,-40 L20,-60 L30,-40" fill="black"/>
        <circle cx="-20" cy="-10" r="8" fill="black"/>
        <circle cx="20" cy="-10" r="8" fill="black"/>
        <path d="M0,10 L-5,20 L0,25 L5,20 Z" fill="black"/>
        <path d="M-15,25 Q0,35 15,25" stroke-width="2"/>
        <path d="M-40,0 Q-60,10 -40,20" stroke-width="2"/>
        <path d="M40,0 Q60,10 40,20" stroke-width="2"/>
      </g>
    `;
    }

    private createGeometricDesign(): string {
        return `
      <g transform="translate(256,256)" fill="none" stroke="black" stroke-width="2" filter="url(#roughPaper)">
        <polygon points="-60,-60 60,-60 60,60 -60,60" stroke-width="3"/>
        <polygon points="-40,-40 40,-40 40,40 -40,40"/>
        <polygon points="-20,-20 20,-20 20,20 -20,20"/>
        <circle cx="0" cy="0" r="30"/>
        <circle cx="0" cy="0" r="15"/>
        <line x1="-60" y1="-60" x2="60" y2="60" stroke-width="1"/>
        <line x1="60" y1="-60" x2="-60" y2="60" stroke-width="1"/>
        <line x1="0" y1="-60" x2="0" y2="60" stroke-width="1"/>
        <line x1="-60" y1="0" x2="60" y2="0" stroke-width="1"/>
      </g>
    `;
    }

    private createAbstractDesign(style: string): string {
        return `
      <g transform="translate(256,256)" fill="none" stroke="black" stroke-width="2" filter="url(#roughPaper)">
        <path d="M-80,0 Q-40,-40 0,0 Q40,-40 80,0 Q40,40 0,0 Q-40,40 -80,0" stroke-width="3"/>
        <circle cx="0" cy="0" r="20" stroke-width="2"/>
        <path d="M-50,-25 Q0,-50 50,-25" stroke-width="2"/>
        <path d="M-50,25 Q0,50 50,25" stroke-width="2"/>
        <circle cx="-30" cy="0" r="5" fill="black"/>
        <circle cx="30" cy="0" r="5" fill="black"/>
        <circle cx="0" cy="-30" r="3" fill="black"/>
        <circle cx="0" cy="30" r="3" fill="black"/>
      </g>
    `;
    }

    private addDecorativeElements(): string {
        return `
      <g fill="none" stroke="black" stroke-width="1" opacity="0.5">
        <path d="M50,50 Q100,75 150,50" />
        <path d="M362,50 Q412,75 462,50" />
        <path d="M50,462 Q100,437 150,462" />
        <path d="M362,462 Q412,437 462,462" />
        <circle cx="100" cy="100" r="3" fill="black"/>
        <circle cx="412" cy="100" r="3" fill="black"/>
        <circle cx="100" cy="412" r="3" fill="black"/>
        <circle cx="412" cy="412" r="3" fill="black"/>
      </g>
    `;
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

        if (!prompt.toLowerCase().includes('tattoo')) {
            enhancedPrompt = `${enhancedPrompt}, ${tattooKeywords.join(', ')}`;
        }

        if (style && styleEnhancements[style as keyof typeof styleEnhancements]) {
            enhancedPrompt = `${enhancedPrompt}, ${styleEnhancements[style as keyof typeof styleEnhancements]}`;
        }

        enhancedPrompt = `${enhancedPrompt}, high quality, detailed, professional, artistic masterpiece`;

        return enhancedPrompt;
    }
}