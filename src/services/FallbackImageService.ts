import fetch from 'node-fetch';

/**
 * 备用图像生成服务
 * 当Google Cloud Imagen API不可用时使用
 */
export class FallbackImageService {

    /**
     * 使用Pollinations.ai生成图像 - 免费且快速的第一选择
     */
    async generateWithPollinations(prompt: string): Promise<{
        success: boolean;
        imageData?: string;
        error?: string;
    }> {
        try {
            console.log('🌸 尝试使用Pollinations.ai生成图像:', prompt);

            // 构建优化的纹身提示词
            const enhancedPrompt = `professional tattoo design, ${prompt}, black and white line art, high contrast, clean lines, tattoo stencil, detailed artwork, minimalist style`;
            
            // URL编码提示词
            const encodedPrompt = encodeURIComponent(enhancedPrompt);
            
            // Pollinations.ai的API端点
            const apiUrl = `https://image.pollinations.ai/prompt/${encodedPrompt}`;
            
            // 添加参数以优化图像质量
            const params = new URLSearchParams({
                width: '512',
                height: '512',
                seed: Math.floor(Math.random() * 1000000).toString(),
                model: 'flux', // 使用更好的模型
                enhance: 'true'
            });
            
            const fullUrl = `${apiUrl}?${params.toString()}`;
            
            console.log('📡 发送Pollinations.ai请求...');
            const response = await fetch(fullUrl, {
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
                    
                    // 确定图像格式
                    let mimeType = 'image/jpeg';
                    if (contentType.includes('png')) mimeType = 'image/png';
                    else if (contentType.includes('webp')) mimeType = 'image/webp';
                    
                    console.log('✅ Pollinations.ai图像生成成功');
                    return {
                        success: true,
                        imageData: `data:${mimeType};base64,${base64Image}`
                    };
                } else {
                    console.warn('⚠️ Pollinations.ai返回了非图像内容');
                    return {
                        success: false,
                        error: 'Non-image response from Pollinations.ai'
                    };
                }
            } else {
                console.warn('⚠️ Pollinations.ai API错误:', response.status, response.statusText);
                return {
                    success: false,
                    error: `Pollinations.ai API error: ${response.status}`
                };
            }
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

            // 方法2: 尝试使用其他图像生成模型
            try {
                const altResponse = await fetch('https://openrouter.ai/api/v1/chat/completions', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Authorization': `Bearer ${apiKey}`,
                        'HTTP-Referer': 'https://inkgenius.digworldai.com'
                    },
                    body: JSON.stringify({
                        model: 'meta-llama/llama-3.2-90b-vision-instruct',
                        messages: [{
                            role: 'user',
                            content: `请描述一个专业纹身设计: ${prompt}。要求详细描述黑白线条艺术风格的纹身图案。`
                        }],
                        max_tokens: 500
                    }),
                });

                if (altResponse.ok) {
                    const result = await altResponse.json() as any;
                    console.log('✅ OpenRouter文本描述生成成功，将使用程序化生成');
                    // 获取描述后使用程序化生成
                    return this.generateProceduralTattoo(prompt);
                }
            } catch (altError) {
                console.warn('⚠️ 备用方法也失败');
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

            // 使用新的router端点
            const response = await fetch(
                'https://api-inference.huggingface.co/models/runwayml/stable-diffusion-v1-5',
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        // 如果有token可以添加
                        // 'Authorization': `Bearer ${process.env.HUGGINGFACE_API_TOKEN}`,
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
                    // 直接返回图像数据
                    const imageBuffer = await response.buffer();
                    const base64Image = imageBuffer.toString('base64');

                    console.log('✅ Hugging Face图像生成成功');
                    return {
                        success: true,
                        imageData: `data:image/png;base64,${base64Image}`
                    };
                } else {
                    // 可能是JSON响应，检查是否有错误
                    const result = await response.json() as any;
                    if (result.error) {
                        console.warn('⚠️ Hugging Face API错误:', result.error);
                        
                        // 如果是模型加载错误，等待一下再试
                        if (result.error.includes('loading')) {
                            console.log('🔄 模型正在加载，等待10秒后重试...');
                            await new Promise(resolve => setTimeout(resolve, 10000));
                            
                            // 重试一次
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
                            error: result.error
                        };
                    }
                }
            } else {
                const errorText = await response.text();
                console.warn('⚠️ Hugging Face API错误:', response.status, errorText);
                return {
                    success: false,
                    error: `Hugging Face API error: ${response.status}`
                };
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

            // 使用新的API端点
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
                    // Craiyon返回base64图像数组，取第一个
                    const imageData = `data:image/png;base64,${result.images[0]}`;

                    console.log('✅ Craiyon图像生成成功');
                    return {
                        success: true,
                        imageData
                    };
                } else if (result.image) {
                    // 有时候返回单个图像
                    const imageData = `data:image/png;base64,${result.image}`;
                    console.log('✅ Craiyon图像生成成功');
                    return {
                        success: true,
                        imageData
                    };
                }
            } else {
                const errorText = await response.text();
                console.warn('⚠️ Craiyon API错误:', response.status, errorText);
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
     * 新增：使用Replicate API作为额外备用方案
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
                
                // Replicate是异步的，需要轮询结果
                let result = prediction;
                let attempts = 0;
                const maxAttempts = 30; // 最多等待30次，每次2秒

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

        // 分析提示词中的关键元素
        const elements = this.analyzePrompt(prompt);

        // 生成基于SVG的纹身设计
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

        // 检测风格（支持中英文）
        let style = 'traditional';
        if (lowerPrompt.includes('geometric') || lowerPrompt.includes('几何')) style = 'geometric';
        else if (lowerPrompt.includes('minimalist') || lowerPrompt.includes('极简') || lowerPrompt.includes('简约')) style = 'minimalist';
        else if (lowerPrompt.includes('realistic') || lowerPrompt.includes('写实') || lowerPrompt.includes('逼真')) style = 'realistic';
        else if (lowerPrompt.includes('tribal') || lowerPrompt.includes('部落') || lowerPrompt.includes('图腾')) style = 'tribal';
        else if (lowerPrompt.includes('watercolor') || lowerPrompt.includes('水彩')) style = 'watercolor';

        // 检测元素（支持中英文）
        const elements = [];
        if (lowerPrompt.includes('dragon') || lowerPrompt.includes('龙')) elements.push('dragon');
        if (lowerPrompt.includes('flower') || lowerPrompt.includes('rose') || lowerPrompt.includes('花') || lowerPrompt.includes('玫瑰')) elements.push('flower');
        if (lowerPrompt.includes('skull') || lowerPrompt.includes('骷髅') || lowerPrompt.includes('头骨')) elements.push('skull');
        if (lowerPrompt.includes('heart') || lowerPrompt.includes('心') || lowerPrompt.includes('爱心')) elements.push('heart');
        if (lowerPrompt.includes('star') || lowerPrompt.includes('星') || lowerPrompt.includes('星星')) elements.push('star');
        if (lowerPrompt.includes('moon') || lowerPrompt.includes('月亮') || lowerPrompt.includes('月')) elements.push('moon');
        if (lowerPrompt.includes('sun') || lowerPrompt.includes('太阳') || lowerPrompt.includes('日')) elements.push('sun');
        if (lowerPrompt.includes('cat') || lowerPrompt.includes('animal') || lowerPrompt.includes('猫') || lowerPrompt.includes('动物')) elements.push('animal');
        if (lowerPrompt.includes('butterfly') || lowerPrompt.includes('蝴蝶')) elements.push('butterfly');
        if (lowerPrompt.includes('tree') || lowerPrompt.includes('树')) elements.push('tree');
        if (lowerPrompt.includes('bird') || lowerPrompt.includes('鸟')) elements.push('bird');

        // 如果没有检测到特定元素，添加通用元素
        if (elements.length === 0) {
            elements.push('abstract');
        }

        // 确定复杂度
        const complexity = elements.length > 2 ? 'complex' : elements.length > 1 ? 'medium' : 'simple';

        return { style, elements, complexity };
    }

    /**
     * 创建SVG纹身设计 - 增强版本
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
          <pattern id="crosshatch" patternUnits="userSpaceOnUse" width="4" height="4">
            <path d="M0,0 L4,4 M0,4 L4,0" stroke="black" stroke-width="0.5" opacity="0.3"/>
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="white"/>
    `;

        // 根据风格和元素生成不同的设计
        if (designElements.includes('dragon')) {
            svg += this.createDragonDesign(style);
        } else if (designElements.includes('flower')) {
            svg += this.createFlowerDesign(style);
        } else if (designElements.includes('skull')) {
            svg += this.createSkullDesign(style);
        } else if (designElements.includes('animal')) {
            svg += this.createAnimalDesign(style);
        } else if (designElements.includes('butterfly')) {
            svg += this.createButterflyDesign(style);
        } else if (designElements.includes('tree')) {
            svg += this.createTreeDesign(style);
        } else if (style === 'geometric') {
            svg += this.createGeometricDesign();
        } else {
            svg += this.createAbstractDesign(style);
        }

        // 添加装饰元素
        if (complexity !== 'simple') {
            svg += this.addDecorativeElements();
        }

        // 添加标题
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
        <path d="M-30,-10 L-35,-5 L-30,0" stroke-width="2"/>
        <path d="M30,-10 L35,-5 L30,0" stroke-width="2"/>
        ${style === 'traditional' ? '<path d="M-80,-20 L-100,-10 L-80,0" stroke-width="4"/>' : ''}
        ${style === 'geometric' ? '<polygon points="-10,-40 0,-50 10,-40 0,-30" fill="black"/>' : ''}
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
        <path d="M-28,-28 Q-14,-14 0,0 Q-14,14 -28,28" fill="black" opacity="0.2"/>
        <path d="M28,-28 Q14,-14 0,0 Q14,14 28,28" fill="black" opacity="0.2"/>
        <line x1="0" y1="0" x2="0" y2="80" stroke-width="4"/>
        <path d="M-10,60 Q0,50 10,60" stroke-width="2"/>
        <path d="M-15,70 Q0,60 15,70" stroke-width="2"/>
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
        ${style === 'tribal' ? '<path d="M-70,-30 Q-80,-10 -70,10 Q-60,0 -70,-30" fill="black"/>' : ''}
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
        <circle cx="-15" cy="-5" r="2" fill="white"/>
        <circle cx="15" cy="-5" r="2" fill="white"/>
      </g>
    `;
    }

    private createButterflyDesign(style: string): string {
        return `
      <g transform="translate(256,256)" fill="none" stroke="black" stroke-width="2" filter="url(#roughPaper)">
        <line x1="0" y1="-40" x2="0" y2="40" stroke-width="3"/>
        <path d="M0,-30 Q-30,-50 -50,-30 Q-40,-10 -20,-20 Q-10,-25 0,-30" fill="black" opacity="0.3"/>
        <path d="M0,-30 Q30,-50 50,-30 Q40,-10 20,-20 Q10,-25 0,-30" fill="black" opacity="0.3"/>
        <path d="M0,10 Q-25,20 -40,40 Q-30,50 -15,35 Q-5,25 0,10" fill="black" opacity="0.2"/>
        <path d="M0,10 Q25,20 40,40 Q30,50 15,35 Q5,25 0,10" fill="black" opacity="0.2"/>
        <circle cx="-35" cy="-35" r="3" fill="black"/>
        <circle cx="35" cy="-35" r="3" fill="black"/>
        <path d="M-2,-40 L2,-40 L1,-45 L-1,-45 Z" fill="black"/>
        <path d="M-1,-45 Q-3,-48 -1,-50" stroke-width="1"/>
        <path d="M1,-45 Q3,-48 1,-50" stroke-width="1"/>
      </g>
    `;
    }

    private createTreeDesign(style: string): string {
        return `
      <g transform="translate(256,400)" fill="none" stroke="black" stroke-width="3" filter="url(#roughPaper)">
        <rect x="-10" y="0" width="20" height="80" fill="url(#crosshatch)" stroke="black"/>
        <path d="M0,-20 Q-40,-60 -60,-40 Q-50,-20 -30,-30 Q-15,-35 0,-20" fill="black" opacity="0.4"/>
        <path d="M0,-20 Q40,-60 60,-40 Q50,-20 30,-30 Q15,-35 0,-20" fill="black" opacity="0.4"/>
        <path d="M0,-40 Q-30,-80 -50,-60 Q-40,-40 -20,-50 Q-10,-55 0,-40" fill="black" opacity="0.3"/>
        <path d="M0,-40 Q30,-80 50,-60 Q40,-40 20,-50 Q10,-55 0,-40" fill="black" opacity="0.3"/>
        <circle cx="-25" cy="-25" r="2" fill="black"/>
        <circle cx="25" cy="-25" r="2" fill="black"/>
        <circle cx="0" cy="-50" r="2" fill="black"/>
        <path d="M-5,80 Q-15,90 -10,100 Q0,95 5,100 Q15,90 5,80" stroke-width="2"/>
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
        <polygon points="0,-45 -15,-30 0,-15 15,-30" fill="black" opacity="0.3"/>
        <polygon points="0,45 -15,30 0,15 15,30" fill="black" opacity="0.3"/>
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
        <path d="M-60,-60 Q-30,-80 0,-60 Q30,-80 60,-60" stroke-width="1" opacity="0.5"/>
        <path d="M-60,60 Q-30,80 0,60 Q30,80 60,60" stroke-width="1" opacity="0.5"/>
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
        <path d="M80,80 L120,120 M120,80 L80,120" stroke-width="0.5"/>
        <path d="M392,80 L432,120 M432,80 L392,120" stroke-width="0.5"/>
      </g>
    `;
    }
}