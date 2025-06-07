window.addEventListener('DOMContentLoaded', () => {

    // 创建一个全局的 canvas 用于文本测量，避免重复创建
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');

    const inputs = {
        english: document.getElementById('english-input'),
        chinese: document.getElementById('chinese-input'),
        chnFontSize: document.getElementById('chinese-font-size'),
        engFontSize: document.getElementById('english-font-size'),
        chnFontFamily: document.getElementById('chinese-font-family'),
        engFontFamily: document.getElementById('english-font-family'),
        marginTop: document.getElementById('margin-top'),
        marginBottom: document.getElementById('margin-bottom'),
        marginLeft: document.getElementById('margin-left'),
        marginRight: document.getElementById('margin-right'),
    };
    
    const generateBtn = document.getElementById('generate-preview-btn');
    const printBtn = document.getElementById('print-btn');
    const pageContainer = document.getElementById('page-container');

    generateBtn.addEventListener('click', updatePreview);
    printBtn.addEventListener('click', () => {
        updatePreview();
        window.print();
    });

    /**
     * 核心函数：将文本按指定宽度分割成多行
     * @param {string} text - 要分割的文本
     * @param {number} maxWidth - 允许的最大宽度 (px)
     * @param {string} font - CSS 字体字符串，如 "16px 'Microsoft YaHei'"
     * @param {boolean} isChinese - 是否为中文文本，中文按字分割，英文按词分割
     * @returns {string[]} 分割好的行数组
     */
    function breakTextIntoLines(text, maxWidth, font, isChinese = false) {
        ctx.font = font;
        const lines = [];
        // 中文按字分割，英文按词分割
        const segments = isChinese ? text.split('') : text.split(/(\s+)/);
        let currentLine = '';

        for (const segment of segments) {
            const testLine = currentLine + segment;
            const metrics = ctx.measureText(testLine);
            
            if (metrics.width > maxWidth && currentLine !== '') {
                lines.push(currentLine);
                // 如果是英文，要去掉词前的空格
                currentLine = segment.trimStart(); 
            } else {
                currentLine = testLine;
            }
        }
        if (currentLine) {
            lines.push(currentLine);
        }
        return lines;
    }

    function updatePreview() {
        const values = {
            engText: inputs.english.value,
            chnText: inputs.chinese.value,
            chnFontSize: parseInt(inputs.chnFontSize.value),
            engFontSize: parseInt(inputs.engFontSize.value),
            chnFontFamily: inputs.chnFontFamily.value,
            engFontFamily: inputs.engFontFamily.value,
            marginTop: parseInt(inputs.marginTop.value),
            marginBottom: parseInt(inputs.marginBottom.value),
            marginLeft: parseInt(inputs.marginLeft.value),
            marginRight: parseInt(inputs.marginRight.value),
        };
        
        // 验证...
        if (values.engFontSize >= values.chnFontSize) {
            alert("错误：根据要求，英文字体大小必须小于中文字体大小！");
            return;
        }
        
        updatePrintStyles(values);

        // A4 宽度 210mm，转换为 px (假设 96 DPI)
        const A4_WIDTH_MM = 210;
        const DPI = 96;
        const MM_TO_INCH = 1 / 25.4;
        const effectiveWidthPx = (A4_WIDTH_MM - values.marginLeft - values.marginRight) * MM_TO_INCH * DPI;
        
        pageContainer.innerHTML = '';
        pageContainer.style.padding = `${values.marginTop}mm ${values.marginRight}mm ${values.marginBottom}mm ${values.marginLeft}mm`;

        const engParagraphs = values.engText.split('\n');
        const chnParagraphs = values.chnText.split('\n');
        const maxTopLevelParagraphs = Math.max(engParagraphs.length, chnParagraphs.length);

        for (let i = 0; i < maxTopLevelParagraphs; i++) {
            const engPara = engParagraphs[i] || '';
            const chnPara = chnParagraphs[i] || '';

            if (!engPara.trim() && !chnPara.trim()) continue;

            const paragraphBlock = document.createElement('div');
            paragraphBlock.className = 'paragraph-block';

            const engFont = `${values.engFontSize}px ${values.engFontFamily}`;
            const chnFont = `${values.chnFontSize}px ${values.chnFontFamily}`;
            
            // 使用新函数手动分割行
            const englishLines = breakTextIntoLines(engPara, effectiveWidthPx, engFont, false);
            const chineseLines = breakTextIntoLines(chnPara, effectiveWidthPx, chnFont, true);
            
            const maxLines = Math.max(englishLines.length, chineseLines.length);

            for (let j = 0; j < maxLines; j++) {
                const linePair = document.createElement('div');
                linePair.className = 'line-pair';

                const engLineDiv = document.createElement('div');
                engLineDiv.className = 'eng-line';
                engLineDiv.style.font = engFont;
                engLineDiv.innerText = englishLines[j] || ' '; // 保持占位

                const chnLineDiv = document.createElement('div');
                chnLineDiv.className = 'chn-line';
                chnLineDiv.style.font = chnFont;
                chnLineDiv.innerText = chineseLines[j] || ' '; // 保持占位
                
                linePair.appendChild(engLineDiv);
                linePair.appendChild(chnLineDiv);
                paragraphBlock.appendChild(linePair);
            }
            
            pageContainer.appendChild(paragraphBlock);
        }
    }
    
    function updatePrintStyles(values) {
        const styleId = 'dynamic-print-styles';
        let styleElement = document.getElementById(styleId);

        if (!styleElement) {
            styleElement = document.createElement('style');
            styleElement.id = styleId;
            document.head.appendChild(styleElement);
        }

        styleElement.textContent = `
            @page {
                size: A4;
                margin: ${values.marginTop}mm ${values.marginRight}mm ${values.marginBottom}mm ${values.marginLeft}mm;
            }
        `;
    }

    // 页面加载后立即生成一次初始预览
    updatePreview();
});