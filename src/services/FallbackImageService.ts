import fetch from 'node-fetch';

/**
 * 备用图像生成服务
 * 当Google Cloud Imagen API不可用时使用
 */
export class FallbackImageService {
  
  /**
   * 使用Hugging Face Inference API生成图像
   */
  async generateWithHuggingFace(prompt: string): Promise<{
    success: boolean;
    imageData?: string;
    error?: string;
  }> {
    try {
      console.log('🤗 尝试使用Hugging Face生成图像:', prompt);
      
      // 使用新的API端点
      const response = await fetch(
        'https://api-inference.huggingface.co/models/black-forest-labs/FLUX.1-dev',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            // 注意：这里可以添加Hugging Face API token以获得更好的服务
            // 'Authorization': `Bearer ${process.env.HUGGINGFACE_API_TOKEN}`,
          },
          body: JSON.stringify({
            inputs: `tattoo design, ${prompt}, black and white line art, high quality, detailed, professional tattoo artwork`,
            parameters: {
              negative_prompt: "blurry, low quality, distorted, nsfw, watermark, text, signature",
              num_inference_steps: 20,
              guidance_scale: 7.5,
              width: 512,
              height: 512
            }
          }),
        }
      );

      if (response.ok) {
        const imageBuffer = await response.buffer();
        const base64Image = imageBuffer.toString('base64');
        
        console.log('✅ Hugging Face图像生成成功');
        return {
          success: true,
          imageData: `data:image/png;base64,${base64Image}`
        };
      } else {
        const errorText = await response.text();
        console.warn('⚠️ Hugging Face API错误:', response.status, errorText);
        return {
          success: false,
          error: `Hugging Face API error: ${response.status}`
        };
      }
    } catch (error) {
      console.error('❌ Hugging Face生成失败:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Hugging Face generation failed'
      };
    }
  }

  /**
   * 使用DALL-E Mini (Craiyon) API
   */
  async generateWithCraiyon(prompt: string): Promise<{
    success: boolean;
    imageData?: string;
    error?: string;
  }> {
    try {
      console.log('🎨 尝试使用Craiyon生成图像:', prompt);
      
      const response = await fetch('https://backend.craiyon.com/generate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          prompt: `tattoo design ${prompt} black and white line art`,
          model: 'art',
          negative_prompt: 'blurry low quality nsfw'
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
   * 生成高质量的程序化纹身图像
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
   * 分析提示词中的设计元素
   */
  private analyzePrompt(prompt: string): {
    style: string;
    elements: string[];
    complexity: 'simple' | 'medium' | 'complex';
  } {
    const lowerPrompt = prompt.toLowerCase();
    
    // 检测风格
    let style = 'traditional';
    if (lowerPrompt.includes('geometric')) style = 'geometric';
    else if (lowerPrompt.includes('minimalist')) style = 'minimalist';
    else if (lowerPrompt.includes('realistic')) style = 'realistic';
    else if (lowerPrompt.includes('tribal')) style = 'tribal';
    
    // 检测元素
    const elements = [];
    if (lowerPrompt.includes('dragon')) elements.push('dragon');
    if (lowerPrompt.includes('flower') || lowerPrompt.includes('rose')) elements.push('flower');
    if (lowerPrompt.includes('skull')) elements.push('skull');
    if (lowerPrompt.includes('heart')) elements.push('heart');
    if (lowerPrompt.includes('star')) elements.push('star');
    if (lowerPrompt.includes('moon')) elements.push('moon');
    if (lowerPrompt.includes('sun')) elements.push('sun');
    if (lowerPrompt.includes('cat') || lowerPrompt.includes('animal')) elements.push('animal');
    
    // 如果没有检测到特定元素，添加通用元素
    if (elements.length === 0) {
      elements.push('abstract');
    }
    
    // 确定复杂度
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
    
    // 根据风格和元素生成不同的设计
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
    
    // 添加装饰元素
    if (complexity !== 'simple') {
      svg += this.addDecorativeElements();
    }
    
    // 添加标题
    svg += `
      <text x="256" y="480" text-anchor="middle" font-family="serif" font-size="14" fill="#666">
        AI Generated Tattoo Design
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
        <path d="M-28,-28 Q-14,-14 0,0 Q-14,14 -28,28" fill="black" opacity="0.2"/>
        <path d="M28,-28 Q14,-14 0,0 Q14,14 28,28" fill="black" opacity="0.2"/>
        <line x1="0" y1="0" x2="0" y2="80" stroke-width="4"/>
        <path d="M-10,60 Q0,50 10,60" stroke-width="2"/>
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
    // 创建一个简化的猫咪设计
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
}