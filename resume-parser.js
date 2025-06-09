// 简历解析器 - 增强版本 v3.0
class ResumeParser {
    static async parsePDF(file) {
        let pdf = null;
        try {
            if (typeof pdfjsLib === 'undefined') {
                throw new Error('PDF.js库未加载，请刷新页面重试');
            }
            
            const arrayBuffer = await file.arrayBuffer();
            const loadingTask = pdfjsLib.getDocument({
                data: arrayBuffer,
                verbosity: 0,
                maxImageSize: 1024 * 1024,
                disableFontFace: true,
                useSystemFonts: false,
                standardFontDataUrl: null
            });
            
            pdf = await loadingTask.promise;
            let fullText = '';
            const maxPages = Math.min(pdf.numPages, 10);
            
            // 并发处理页面，但限制并发数
            const concurrentLimit = 2;
            const pageTexts = [];
            
            for (let i = 0; i < maxPages; i += concurrentLimit) {
                const pagePromises = [];
                for (let j = i; j < Math.min(i + concurrentLimit, maxPages); j++) {
                    pagePromises.push(this.extractPageText(pdf, j + 1));
                }
                const chunkResults = await Promise.all(pagePromises);
                pageTexts.push(...chunkResults);
            }
            
            fullText = pageTexts.join('\n');
            
            // 使用增强的文本处理
            return this.enhancedTextProcessing(fullText, 'pdf');
            
        } catch (error) {
            console.error('PDF解析错误:', error);
            throw new Error(`PDF解析失败: ${error.message}`);
        } finally {
            if (pdf) {
                try {
                    await pdf.destroy();
                } catch (cleanupError) {
                    console.warn('PDF cleanup error:', cleanupError);
                }
            }
        }
    }
    
    static async extractPageText(pdf, pageNum) {
        try {
            const page = await pdf.getPage(pageNum);
            const textContent = await page.getTextContent();
            
            // 改进的文本提取逻辑
            const textItems = textContent.items
                .filter(item => item.str && item.str.trim())
                .map(item => {
                    let text = item.str.trim();
                    
                    // 处理换行
                    if (item.hasEOL || this.shouldAddNewline(item, textContent.items)) {
                        text += '\n';
                    }
                    
                    return text;
                });
            
            const pageText = textItems.join(' ')
                .replace(/\s+/g, ' ')
                .replace(/\n\s+/g, '\n')
                .trim();
            
            page.cleanup();
            return pageText;
        } catch (error) {
            console.warn(`页面 ${pageNum} 解析失败:`, error);
            return '';
        }
    }
    
    static shouldAddNewline(currentItem, allItems) {
        // 简单的换行判断逻辑
        const currentY = currentItem.transform[5];
        const nextItem = allItems[allItems.indexOf(currentItem) + 1];
        
        if (!nextItem) return true;
        
        const nextY = nextItem.transform[5];
        return Math.abs(currentY - nextY) > 5; // Y坐标差异大于5认为是新行
    }
    
    static async parseWord(file) {
        try {
            if (typeof mammoth === 'undefined') {
                throw new Error('Word解析库未加载，请刷新页面重试');
            }
            
            const arrayBuffer = await file.arrayBuffer();
            
            const result = await mammoth.extractRawText({ 
                arrayBuffer,
                includeEmbeddedStyleMap: false,
                includeDefaultStyleMap: false
            });
            
            if (result.messages && result.messages.length > 0) {
                console.warn('Word解析警告:', result.messages);
            }
            
            return this.enhancedTextProcessing(result.value, 'word');
            
        } catch (error) {
            console.error('Word解析错误:', error);
            throw new Error(`Word文档解析失败: ${error.message}`);
        }
    }
    
    // 增强的文本处理
    static enhancedTextProcessing(text, sourceType = 'unknown') {
        if (!text || typeof text !== 'string') {
            return '';
        }
        
        const startTime = performance.now();
        
        // 第一步：基础清理
        let processedText = this.basicTextCleaning(text);
        
        // 第二步：结构化处理
        processedText = this.structuralProcessing(processedText);
        
        // 第三步：内容保护和恢复
        processedText = this.contentPreservation(processedText);
        
        // 第四步：AI增强处理（如果可用）
        if (window.aiKeywordExtractor && window.aiKeywordExtractor.isAvailable()) {
            try {
                processedText = this.aiEnhancedProcessing(processedText);
            } catch (error) {
                console.warn('AI处理失败，使用基础处理结果:', error);
            }
        }
        
        // 第五步：最终清理
        processedText = this.finalTextCleaning(processedText);
        
        const processingTime = performance.now() - startTime;
        console.log(`文本处理完成 (${sourceType}): ${processingTime.toFixed(2)}ms, 输出长度: ${processedText.length}`);
        
        return processedText;
    }
    
    // 基础文本清理
    static basicTextCleaning(text) {
        return text
            // 标准化换行符
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            
            // 标准化空格和制表符
            .replace(/\t/g, ' ')
            .replace(/[\u00A0\u2000-\u200B\u2028\u2029]/g, ' ') // 各种空格字符
            
            // 移除控制字符
            .replace(/[\u0000-\u001F\u007F-\u009F]/g, '')
            
            // 标准化标点符号
            .replace(/['']/g, "'")
            .replace(/[""]/g, '"')
            .replace(/[––—]/g, '-')
            .replace(/…/g, '...')
            
            // 处理重复空格
            .replace(/ {2,}/g, ' ')
            
            // 处理多余的换行
            .replace(/\n{3,}/g, '\n\n')
            
            .trim();
    }
    
    // 结构化处理
    static structuralProcessing(text) {
        // 识别和标准化常见的简历结构
        const structurePatterns = [
            // 个人信息部分
            { pattern: /(个人信息|基本信息|联系方式)/gi, replacement: '\n=== 个人信息 ===\n' },
            
            // 教育背景部分
            { pattern: /(教育背景|教育经历|学习经历)/gi, replacement: '\n=== 教育背景 ===\n' },
            
            // 工作经验部分
            { pattern: /(工作经验|工作经历|实习经历|职业经历)/gi, replacement: '\n=== 工作经验 ===\n' },
            
            // 项目经验部分
            { pattern: /(项目经验|项目经历|主要项目)/gi, replacement: '\n=== 项目经验 ===\n' },
            
            // 技能专长部分
            { pattern: /(专业技能|技能专长|核心技能|掌握技能)/gi, replacement: '\n=== 专业技能 ===\n' },
            
            // 获奖情况部分
            { pattern: /(获奖情况|荣誉奖励|奖励荣誉|主要荣誉)/gi, replacement: '\n=== 获奖情况 ===\n' }
        ];
        
        let structuredText = text;
        structurePatterns.forEach(({ pattern, replacement }) => {
            structuredText = structuredText.replace(pattern, replacement);
        });
        
        return structuredText;
    }
    
    // 内容保护
    static contentPreservation(text) {
        const protectedContent = new Map();
        let protectedText = text;
        let protectedIndex = 0;
        
        // 保护重要信息模式
        const protectionPatterns = [
            // 邮箱地址
            {
                pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
                type: 'email'
            },
            // 手机号码
            {
                pattern: /(?:\+86[-\s]?)?1[3-9]\d{9}/g,
                type: 'phone'
            },
            // 日期格式
            {
                pattern: /(?:19|20)\d{2}[-./年]\d{1,2}[-./月]?(?:\d{1,2}[日]?)?/g,
                type: 'date'
            },
            // 网址
            {
                pattern: /https?:\/\/[^\s\n]+/g,
                type: 'url'
            },
            // 身份证号（部分保护）
            {
                pattern: /\d{15}|\d{17}[\dXx]/g,
                type: 'id'
            }
        ];
        
        protectionPatterns.forEach(({ pattern, type }) => {
            protectedText = protectedText.replace(pattern, (match) => {
                const placeholder = `__PROTECTED_${type.toUpperCase()}_${protectedIndex}__`;
                protectedContent.set(placeholder, match);
                protectedIndex++;
                return placeholder;
            });
        });
        
        // 处理文本...
        
        // 恢复保护的内容
        protectedContent.forEach((content, placeholder) => {
            protectedText = protectedText.replace(placeholder, content);
        });
        
        return protectedText;
    }
    
    // AI增强处理
    static aiEnhancedProcessing(text) {
        if (!window.aiKeywordExtractor || !window.aiKeywordExtractor.isAvailable()) {
            return text;
        }
        
        try {
            console.log('开始AI增强文本处理...');
            
            // 使用AI提取关键信息
            const extraction = window.aiKeywordExtractor.extractKeywords(text);
            
            if (extraction.isAIEnhanced && extraction.cleanedSections) {
                // 基于AI提取结果重构文本
                const reconstructedText = this.reconstructFromAIExtraction(extraction, text);
                
                if (reconstructedText.length >= text.length * 0.4) {
                    console.log('AI文本重构成功');
                    return reconstructedText;
                } else {
                    console.log('AI重构结果过短，保留原文');
                    return text;
                }
            }
            
        } catch (error) {
            console.warn('AI增强处理失败:', error);
        }
        
        return text;
    }
    
    // 基于AI提取结果重构文本
    static reconstructFromAIExtraction(extraction, originalText) {
        const sections = [];
        
        // 个人信息部分
        const personalInfo = this.buildPersonalSection(extraction.extractedKeywords.personal);
        if (personalInfo) {
            sections.push('=== 个人信息 ===');
            sections.push(personalInfo);
            sections.push('');
        }
        
        // 教育背景部分
        const educationInfo = this.buildEducationSection(extraction.extractedKeywords.education);
        if (educationInfo) {
            sections.push('=== 教育背景 ===');
            sections.push(educationInfo);
            sections.push('');
        }
        
        // 专业技能部分
        const skillsInfo = this.buildSkillsSection(extraction.extractedKeywords.skills);
        if (skillsInfo) {
            sections.push('=== 专业技能 ===');
            sections.push(skillsInfo);
            sections.push('');
        }
        
        // 工作经验部分
        const experienceInfo = this.buildExperienceSection(extraction.extractedKeywords.experience);
        if (experienceInfo) {
            sections.push('=== 工作经验 ===');
            sections.push(experienceInfo);
            sections.push('');
        }
        
        // 获奖情况部分
        const achievementsInfo = this.buildAchievementsSection(extraction.extractedKeywords.achievements);
        if (achievementsInfo) {
            sections.push('=== 获奖情况 ===');
            sections.push(achievementsInfo);
            sections.push('');
        }
        
        const result = sections.join('\n');
        
        // 如果重构的内容太少，补充原文中的其他信息
        if (result.length < originalText.length * 0.5) {
            const additionalContent = this.extractAdditionalContent(originalText, extraction);
            if (additionalContent) {
                sections.push('=== 其他信息 ===');
                sections.push(additionalContent);
            }
        }
        
        return sections.join('\n');
    }
    
    // 构建各个部分的方法
    static buildPersonalSection(personalItems) {
        if (!personalItems || personalItems.length === 0) return '';
        
        const info = {};
        personalItems.forEach(item => {
            if (item.confidence > 0.5) {
                if (!info[item.subcategory] || info[item.subcategory].confidence < item.confidence) {
                    info[item.subcategory] = item;
                }
            }
        });
        
        const lines = [];
        const order = ['name', 'phone', 'email', 'address', 'intention'];
        
        order.forEach(key => {
            if (info[key]) {
                const label = {
                    name: '姓名',
                    phone: '电话',
                    email: '邮箱',
                    address: '地址',
                    intention: '求职意向'
                }[key];
                lines.push(`${label}: ${info[key].text}`);
            }
        });
        
        return lines.join('\n');
    }
    
    static buildEducationSection(educationItems) {
        if (!educationItems || educationItems.length === 0) return '';
        
        const highConfidenceItems = educationItems
            .filter(item => item.confidence > 0.5)
            .sort((a, b) => b.confidence - a.confidence);
        
        const lines = [];
        const categories = ['school', 'degree', 'major', 'gpa'];
        
        categories.forEach(category => {
            const items = highConfidenceItems.filter(item => item.subcategory === category);
            if (items.length > 0) {
                const label = {
                    school: '学校',
                    degree: '学历',
                    major: '专业',
                    gpa: '成绩'
                }[category];
                
                items.slice(0, 3).forEach(item => {
                    lines.push(`${label}: ${item.text}`);
                });
            }
        });
        
        return lines.join('\n');
    }
    
    static buildSkillsSection(skillsItems) {
        if (!skillsItems || skillsItems.length === 0) return '';
        
        const skillGroups = {};
        skillsItems
            .filter(item => item.confidence > 0.4)
            .forEach(item => {
                if (!skillGroups[item.subcategory]) {
                    skillGroups[item.subcategory] = [];
                }
                skillGroups[item.subcategory].push(item.text);
            });
        
        const lines = [];
        Object.entries(skillGroups).forEach(([category, skills]) => {
            if (skills.length > 0) {
                const label = {
                    programming: '编程技术',
                    design: '设计软件',
                    languages: '语言能力'
                }[category] || category;
                
                const uniqueSkills = [...new Set(skills)];
                lines.push(`${label}: ${uniqueSkills.slice(0, 10).join('、')}`);
            }
        });
        
        return lines.join('\n');
    }
    
    static buildExperienceSection(experienceItems) {
        if (!experienceItems || experienceItems.length === 0) return '';
        
        const expGroups = {};
        experienceItems
            .filter(item => item.confidence > 0.4)
            .forEach(item => {
                if (!expGroups[item.subcategory]) {
                    expGroups[item.subcategory] = [];
                }
                expGroups[item.subcategory].push(item.text);
            });
        
        const lines = [];
        Object.entries(expGroups).forEach(([category, experiences]) => {
            if (experiences.length > 0) {
                const label = {
                    internship: '实习经历',
                    project: '项目经验',
                    work: '工作经历'
                }[category] || category;
                
                lines.push(`${label}:`);
                experiences.slice(0, 5).forEach(exp => {
                    lines.push(`• ${exp}`);
                });
                lines.push('');
            }
        });
        
        return lines.join('\n');
    }
    
    static buildAchievementsSection(achievementItems) {
        if (!achievementItems || achievementItems.length === 0) return '';
        
        const achievementGroups = {};
        achievementItems
            .filter(item => item.confidence > 0.4)
            .sort((a, b) => b.confidence - a.confidence)
            .forEach(item => {
                const category = item.category || item.subcategory || 'other';
                if (!achievementGroups[category]) {
                    achievementGroups[category] = [];
                }
                achievementGroups[category].push(item.text);
            });
        
        const lines = [];
        const categoryOrder = ['scholarship', 'honor', 'competition', 'certificate', 'leadership'];
        
        categoryOrder.forEach(category => {
            if (achievementGroups[category] && achievementGroups[category].length > 0) {
                const label = {
                    scholarship: '奖学金',
                    honor: '荣誉称号',
                    competition: '竞赛获奖',
                    certificate: '专业证书',
                    leadership: '学生工作'
                }[category] || category;
                
                lines.push(`${label}:`);
                achievementGroups[category].slice(0, 8).forEach(achievement => {
                    lines.push(`• ${achievement}`);
                });
                lines.push('');
            }
        });
        
        // 处理其他类别
        Object.entries(achievementGroups).forEach(([category, achievements]) => {
            if (!categoryOrder.includes(category) && achievements.length > 0) {
                lines.push(`${category}:`);
                achievements.slice(0, 5).forEach(achievement => {
                    lines.push(`• ${achievement}`);
                });
                lines.push('');
            }
        });
        
        return lines.join('\n');
    }
    
    static extractAdditionalContent(originalText, extraction) {
        // 找出原文中没有被AI提取到的重要信息
        const extractedTexts = new Set();
        
        Object.values(extraction.extractedKeywords).forEach(items => {
            items.forEach(item => {
                extractedTexts.add(item.text.toLowerCase());
                if (item.source) {
                    extractedTexts.add(item.source.toLowerCase());
                }
            });
        });
        
        const sentences = originalText.split(/[。；！？\n]/)
            .map(s => s.trim())
            .filter(s => s.length > 10 && s.length < 200);
        
        const additionalSentences = sentences.filter(sentence => {
            const sentenceLower = sentence.toLowerCase();
            return !Array.from(extractedTexts).some(extracted => 
                sentenceLower.includes(extracted) || extracted.includes(sentenceLower)
            );
        });
        
        return additionalSentences.slice(0, 10).join('\n');
    }
    
    // 最终文本清理
    static finalTextCleaning(text) {
        return text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n')
            .replace(/={3,}/g, '') // 移除临时分隔符
            .replace(/\n{3,}/g, '\n\n') // 限制空行数量
            .trim();
    }
    
    // 主要解析入口
    static async parseFile(file) {
        if (!file || !file.type || !file.name) {
            throw new Error('无效的文件');
        }
        
        const fileType = file.type.toLowerCase();
        const fileName = file.name.toLowerCase();
        
        if (file.size === 0) {
            throw new Error('文件为空或损坏');
        }
        
        if (file.size > 50 * 1024 * 1024) { // 50MB限制
            throw new Error('文件过大，请选择小于50MB的文件');
        }
        
        try {
            const startTime = performance.now();
            let text = '';
            
            if (fileType === 'application/pdf' || fileName.endsWith('.pdf')) {
                text = await this.parsePDF(file);
            } else if (fileType.includes('word') || 
                      fileType.includes('document') ||
                      fileName.endsWith('.docx') || 
                      fileName.endsWith('.doc')) {
                text = await this.parseWord(file);
            } else {
                throw new Error('不支持的文件格式。仅支持 PDF (.pdf) 和 Word (.doc, .docx) 格式');
            }
            
            const parseTime = performance.now() - startTime;
            console.log(`文件解析完成: ${parseTime.toFixed(2)}ms`);
            
            if (!text || text.trim().length < 50) {
                throw new Error('无法从文件中提取有效内容，请检查文件是否正确或尝试其他格式');
            }
            
            if (!this.isValidResumeContent(text)) {
                console.warn('文件内容可能不是简历，但仍然处理');
            }
            
            // 最终验证
            if (text.length > 100000) { // 100KB文本限制
                console.warn('文本内容过长，可能影响处理性能');
                text = text.substring(0, 100000) + '\n\n... (内容过长，已截断)';
            }
            
            return text;
            
        } catch (error) {
            console.error('文件解析失败:', error);
            
            // 提供更具体的错误信息
            if (error.message.includes('password') || error.message.includes('encrypted')) {
                throw new Error('文件已加密，请上传未加密的文件');
            }
            
            if (error.message.includes('corrupted') || error.message.includes('invalid')) {
                throw new Error('文件已损坏，请尝试重新保存后上传');
            }
            
            if (error.message.includes('memory') || error.message.includes('out of memory')) {
                throw new Error('文件过大或复杂，请尝试简化文件内容后重新上传');
            }
            
            throw error;
        }
    }
    
    // 验证简历内容
    static isValidResumeContent(text) {
        const resumeKeywords = [
            // 中文关键词
            '姓名', '电话', '邮箱', '教育', '经历', '技能', '工作', '实习', 
            '项目', '学校', '专业', '大学', '学院', '毕业', '求职', '应聘',
            '奖学金', '获奖', '证书', '能力', '经验', '职位', '公司',
            
            // 英文关键词
            'name', 'phone', 'email', 'education', 'experience', 'skills',
            'work', 'university', 'college', 'graduate', 'internship', 'project',
            'award', 'certificate', 'ability', 'position', 'company'
        ];
        
        const lowerText = text.toLowerCase();
        const matchCount = resumeKeywords.filter(keyword => 
            lowerText.includes(keyword.toLowerCase())
        ).length;
        
        const threshold = Math.min(resumeKeywords.length * 0.1, 5); // 至少匹配10%的关键词或5个
        return matchCount >= threshold;
    }
    
    // 获取文件信息
    static getFileInfo(file) {
        return {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: new Date(file.lastModified),
            sizeFormatted: this.formatFileSize(file.size),
            isLargeFile: file.size > 5 * 1024 * 1024, // 5MB
            estimatedProcessingTime: this.estimateProcessingTime(file)
        };
    }
    
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
    
    static estimateProcessingTime(file) {
        // 基于文件大小估算处理时间
        const sizeInMB = file.size / (1024 * 1024);
        const baseTime = 1000; // 基础时间1秒
        const timePerMB = 500; // 每MB额外500ms
        
        return Math.ceil(baseTime + (sizeInMB * timePerMB));
    }
}

// 简历评分器增强版本
class ResumeScorer {
    constructor() {
        this.maxScores = {
            basicInfo: 10,
            education: 25,
            skills: 20,
            experience: 30,
            achievements: 15
        };
        
        this.debugMode = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        // 学校分级体系（保持原有）
        this.schoolRanks = {
            topTier: ['清华大学', '北京大学', '清华', '北大'],
            tier1A: [
                '复旦大学', '上海交通大学', '浙江大学', '中国科学技术大学', '南京大学',
                '中国人民大学', '北京航空航天大学', '北京理工大学',
                '中国科学院大学', '南方科技大学',
                '复旦', '交大', '浙大', '中科大', '南大', '人大', '北航', '北理工', '国科大', '南科大'
            ],
            tier1B: [
                '西安交通大学', '哈尔滨工业大学', '华中科技大学', '同济大学',
                '东南大学', '天津大学', '北京师范大学', '南开大学',
                '中山大学', '西北工业大学', '华东师范大学',
                '西交', '哈工大', '华科', '同济', '东南', '天大', '北师大', '南开',
                '中大', '西工大', '华师大'
            ],
            tier2A: [
                '中南大学', '电子科技大学', '重庆大学', '大连理工大学', '吉林大学',
                '厦门大学', '山东大学', '华南理工大学', '湖南大学', '东北大学',
                '兰州大学', '中国农业大学', '中国海洋大学', '西北农林科技大学',
                '北京邮电大学', '华东理工大学', '西安电子科技大学', '北京科技大学',
                '上海财经大学', '对外经济贸易大学', '中央财经大学',
                '海大', '中海大', '山大', '华南理工', '湖大', '东北大学'
            ],
            tier2B: [
                '北京交通大学', '北京工业大学', '北京化工大学', '中国石油大学', '中国地质大学',
                '中国矿业大学', '河海大学', '江南大学', '南京理工大学', '南京航空航天大学',
                '安徽大学', '合肥工业大学', '福州大学', '南昌大学', '郑州大学'
            ],
            tier3: [
                '西湖大学', '上海科技大学', '深圳大学', '苏州大学',
                '杭州电子科技大学', '宁波大学', '江苏科技大学', '南京信息工程大学'
            ]
        };
        
        // 增强的技能关键词库
        this.skillKeywords = {
            programming: [
                'Java', 'Python', 'JavaScript', 'C++', 'C#', 'Go', 'Rust', 'Swift', 'Kotlin',
                'React', 'Vue', 'Angular', 'Node.js', 'Spring', 'Django', 'Flask', 'Express',
                '前端', '后端', '全栈', '编程', '开发', '程序设计', 'HTML', 'CSS', 'PHP',
                'TypeScript', 'jQuery', 'Bootstrap', 'Webpack', 'Git', 'Linux', 'Docker',
                'MySQL', 'MongoDB', 'PostgreSQL', 'Redis', 'Kubernetes', 'AWS', 'Azure'
            ],
            design: [
                'Photoshop', 'Illustrator', 'Sketch', 'Figma', 'XD', 'Axure', 'Principle',
                'UI', 'UX', '平面设计', '交互设计', '视觉设计', '用户体验', '用户界面',
                '界面设计', '原型设计', '设计思维', 'Premiere', 'After Effects', 'Cinema 4D',
                'AutoCAD', 'SolidWorks', 'Pro/E', 'UG', 'CATIA', 'Inventor', '工业设计'
            ],
            data: [
                'SQL', 'MySQL', 'MongoDB', 'PostgreSQL', 'Oracle', 'Excel', 'Tableau',
                'SPSS', 'R语言', 'MATLAB', 'Power BI', 'Spark', 'Hadoop', 'Hive',
                '数据分析', '数据挖掘', '数据可视化', '机器学习', '深度学习', '人工智能',
                'TensorFlow', 'PyTorch', '统计分析', '数据库', '大数据', 'Pandas', 'NumPy'
            ],
            engineering: [
                'CAD', 'AutoCAD', 'SolidWorks', 'Pro/E', 'UG', 'CATIA', 'Inventor',
                'ANSYS', 'ABAQUS', 'COMSOL', '有限元', '仿真', '建模', '测试', '实验设计',
                'LabVIEW', 'Altium Designer', 'Keil', 'Quartus', 'Vivado', 'FPGA',
                '电路设计', '机械设计', '结构设计', '工艺设计'
            ],
            languages: [
                '英语', '日语', '韩语', '法语', '德语', '西班牙语', 'CET-4', 'CET-6', 
                '托福', '雅思', '四级', '六级', 'TOEFL', 'IELTS', 'GRE', 'GMAT'
            ],
            business: [
                '项目管理', '产品管理', '运营', '市场营销', '销售', '客户服务',
                '商务谈判', '团队管理', '财务分析', '会计', '审计', 'PPT', 'Word', 'Excel'
            ],
            arts: [
                '钢琴', '吉他', '小提琴', '舞蹈', '唱歌', '绘画', '书法', '摄影', '视频制作',
                '篮球', '足球', '乒乓球', '羽毛球', '游泳', '跑步', '健身', '瑜伽',
                '演讲', '主持', '辩论', '表演', '相声', '话剧', '朗诵', '配音',
                '文学创作', '诗歌', '小说', '散文', '新闻写作', '编剧', '导演'
            ]
        };
    }
    
    // 主要分析方法（使用AI增强）
    analyzeResume(text) {
        const startTime = performance.now();
        let aiExtraction = null;
        
        // 使用AI关键词提取器进行增强分析
        if (window.aiKeywordExtractor && window.aiKeywordExtractor.isAvailable()) {
            try {
                aiExtraction = window.aiKeywordExtractor.extractKeywords(text);
                if (this.debugMode) {
                    console.log('使用AI关键词提取进行增强分析');
                    console.log('AI提取结果:', aiExtraction);
                }
            } catch (error) {
                console.warn('AI关键词提取失败，使用传统分析:', error);
            }
        }
        
        // 执行各项分析
        const basicInfo = this.analyzeBasicInfo(text, aiExtraction);
        const education = this.analyzeEducation(text, aiExtraction);
        const skills = this.analyzeSkills(text, aiExtraction);
        const experience = this.analyzeExperience(text, aiExtraction);
        const achievements = this.analyzeAchievements(text, aiExtraction);
        
        const analysisTime = performance.now() - startTime;
        
        const result = {
            originalText: text,
            basicInfo: basicInfo,
            education: education,
            skills: skills,
            experience: experience,
            achievements: achievements,
            wordCount: text.length,
            hasStructure: this.hasGoodStructure(text),
            aiEnhanced: aiExtraction ? aiExtraction.isAIEnhanced : false,
            aiConfidence: aiExtraction ? aiExtraction.confidence : 0,
            processingTime: analysisTime,
            aiStats: aiExtraction ? aiExtraction.stats : null
        };
        
        if (this.debugMode) {
            console.log(`简历分析完成: ${analysisTime.toFixed(2)}ms`);
            console.log('分析结果:', result);
        }
        
        return result;
    }
    
    // AI增强的基本信息分析
    analyzeBasicInfo(text, aiExtraction = null) {
        const info = {};
        let count = 0;
        
        // 使用AI提取的个人信息
        if (aiExtraction && aiExtraction.extractedKeywords && aiExtraction.extractedKeywords.personal) {
            const personalItems = aiExtraction.extractedKeywords.personal;
            
            personalItems.forEach(item => {
                if (item.confidence > 0.5) {
                    const subcategory = item.subcategory || item.keyword;
                    
                    switch (subcategory) {
                        case 'name':
                            if (!info.name) {
                                info.name = true;
                                count++;
                            }
                            break;
                        case 'phone':
                            if (!info.phone) {
                                info.phone = true;
                                count++;
                            }
                            break;
                        case 'email':
                            if (!info.email) {
                                info.email = true;
                                count++;
                            }
                            break;
                        case 'address':
                            if (!info.address) {
                                info.address = true;
                                count++;
                            }
                            break;
                        case 'intention':
                            if (!info.intention) {
                                info.intention = true;
                                count++;
                            }
                            break;
                    }
                }
            });
        }
        
        // 传统方法补充验证
        if (text && typeof text === 'string') {
            // 姓名检测
            if (!info.name && this.hasName(text)) {
                info.name = true;
                count++;
            }
            
            // 电话检测
            if (!info.phone && /1[3-9]\d{9}/.test(text)) {
                info.phone = true;
                count++;
            }
            
            // 邮箱检测（增强）
            if (!info.email && /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/.test(text)) {
                info.email = true;
                count++;
            }
            
            // 地址/意向检测
            if (!info.address && /(市|省|区|县|路|街|号|意向|求职)/.test(text)) {
                info.address = true;
                count++;
            }
            
            // 其他信息检测
            if (/(求职|应聘|岗位|职位|意向)/.test(text)) {
                info.intention = true;
                if (!info.intentionCounted) {
                    count++;
                    info.intentionCounted = true;
                }
            }
            
            if (/(github|gitlab|个人网站|博客|portfolio)/i.test(text)) {
                info.website = true;
                count++;
            }
            
            if (/(linkedin|微博|知乎)/i.test(text)) {
                info.social = true;
                count++;
            }
            
            if (/(出生|生日|\d{4}年\d{1,2}月)/.test(text)) {
                info.birthday = true;
                count++;
            }
            
            if (/(党员|团员|群众|政治面貌)/.test(text)) {
                info.political = true;
                count++;
            }
        }
        
        return { 
            ...info, 
            count: Math.min(count, 10),
            aiEnhanced: aiExtraction ? aiExtraction.isAIEnhanced : false
        };
    }
    
    // AI增强的技能分析
    analyzeSkills(text, aiExtraction = null) {
        const skills = {
            programming: [],
            design: [],
            data: [],
            engineering: [],
            languages: [],
            business: [],
            arts: [],
            total: 0
        };
        
        // 使用AI提取的技能信息
        if (aiExtraction && aiExtraction.extractedKeywords && aiExtraction.extractedKeywords.skills) {
            const skillItems = aiExtraction.extractedKeywords.skills;
            
            skillItems.forEach(item => {
                if (item.confidence > 0.4) {
                    const subcategory = item.subcategory || 'programming';
                    const skillText = item.text || item.keyword;
                    
                    // 从AI提取的文本中识别具体技能
                    Object.keys(this.skillKeywords).forEach(category => {
                        if (subcategory === category || this.skillKeywords[category].some(skill => 
                            skillText.toLowerCase().includes(skill.toLowerCase())
                        )) {
                            this.skillKeywords[category].forEach(skill => {
                                if (skillText.toLowerCase().includes(skill.toLowerCase()) && 
                                    !skills[category].includes(skill)) {
                                    skills[category].push(skill);
                                }
                            });
                        }
                    });
                }
            });
        }
        
        // 传统方法补充
        if (text && typeof text === 'string') {
            const textLower = text.toLowerCase();
            Object.keys(this.skillKeywords).forEach(category => {
                this.skillKeywords[category].forEach(skill => {
                    if (skill && typeof skill === 'string') {
                        const skillLower = skill.toLowerCase();
                        if ((textLower.includes(skillLower) || 
                            textLower.includes(skillLower.replace(/[.\s]/g, '')) ||
                            this.fuzzyMatch(textLower, skillLower)) &&
                            !skills[category].includes(skill)) {
                            skills[category].push(skill);
                        }
                    }
                });
            });
        }
        
        // 计算总数
        skills.total = Object.values(skills).reduce((sum, arr) => 
            sum + (Array.isArray(arr) ? arr.length : 0), 0
        );
        
        skills.aiEnhanced = aiExtraction ? aiExtraction.isAIEnhanced : false;
        
        return skills;
    }
    
    // AI增强的教育背景分析
    analyzeEducation(text, aiExtraction = null) {
        const education = {
            schoolLevel: 0,
            hasGPA: false,
            gpa: 0,
            degrees: [],
            degreeScore: 0,
            aiEnhanced: aiExtraction ? aiExtraction.isAIEnhanced : false
        };
        
        // 检测GPA
        education.hasGPA = /GPA|绩点|平均分|成绩/.test(text);
        education.gpa = this.extractGPA(text);
        
        // 提取学位信息
        education.degrees = this.extractDegrees(text, aiExtraction);
        
        // 计算学校水平分数
        education.schoolLevel = this.calculateSchoolScore(text, education.degrees);
        
        // 计算学位分数
        education.degreeScore = this.calculateDegreeScore(education.degrees);
        
        return education;
    }
    
    // AI增强的经验分析
    analyzeExperience(text, aiExtraction = null) {
        let internshipCount = 0;
        let projectCount = 0;
        
        // 使用AI提取的经验信息
        if (aiExtraction && aiExtraction.extractedKeywords && aiExtraction.extractedKeywords.experience) {
            const experienceItems = aiExtraction.extractedKeywords.experience;
            
            internshipCount = experienceItems.filter(item => 
                item.confidence > 0.5 && 
                (item.subcategory === 'internship' || 
                 (item.text || item.keyword || '').includes('实习'))
            ).length;
            
            projectCount = experienceItems.filter(item => 
                item.confidence > 0.5 && 
                (item.subcategory === 'project' || 
                 (item.text || item.keyword || '').includes('项目'))
            ).length;
        }
        
        // 传统方法补充
        const traditionalInternshipCount = Math.max(
            (text.match(/实习|intern/gi) || []).length, 
            (text.match(/(公司|企业|集团|科技|有限).*?(实习|intern)/gi) || []).length
        );
        
        const traditionalProjectCount = Math.max(
            (text.match(/项目|project/gi) || []).length,
            (text.match(/(开发|设计|完成|负责).*?(项目|系统|网站|APP)/gi) || []).length
        );
        
        // 取AI和传统方法的较大值
        internshipCount = Math.max(internshipCount, traditionalInternshipCount);
        projectCount = Math.max(projectCount, traditionalProjectCount);
        
        const hasCompanyName = /(有限公司|股份|集团|科技|互联网|腾讯|阿里|百度|字节|美团|京东|华为|小米|网易|滴滴|快手)/i.test(text);
        const hasAchievement = /(完成|实现|提升|优化|负责|开发|设计|获得|达到)/i.test(text);
        
        const internshipBaseScore = Math.min(internshipCount * (hasCompanyName ? 3 : 2.5), 10);
        const projectBaseScore = Math.min(projectCount * (hasAchievement ? 3 : 2.5), 10);
        const academicBaseScore = Math.min(this.calculateAcademicScore(text), 10);
        
        const internshipExtraScore = Math.max(0, internshipCount * (hasCompanyName ? 3 : 2.5) - 10);
        const projectExtraScore = Math.max(0, projectCount * (hasAchievement ? 3 : 2.5) - 10);
        const academicExtraScore = Math.max(0, this.calculateAcademicScore(text) - 10);
        
        return {
            internshipCount: internshipCount,
            projectCount: projectCount,
            hasCompanyName: hasCompanyName,
            hasAchievement: hasAchievement,
            internshipScore: internshipBaseScore,
            projectScore: projectBaseScore,
            academicScore: academicBaseScore,
            internshipExtraScore: internshipExtraScore,
            projectExtraScore: projectExtraScore,
            academicExtraScore: academicExtraScore,
            aiEnhanced: aiExtraction ? aiExtraction.isAIEnhanced : false
        };
    }
    
    // AI增强的成就分析
    analyzeAchievements(text, aiExtraction = null) {
        let totalScore = 0;
        const details = {};
        const extraScore = {};
        
        // 使用AI提取的成就信息
        if (aiExtraction && aiExtraction.extractedKeywords && aiExtraction.extractedKeywords.achievements) {
            const achievementItems = aiExtraction.extractedKeywords.achievements;
            
            if (this.debugMode) {
                console.log('AI提取的成就信息:', achievementItems);
            }
            
            // 基于AI提取的内容进行分类计分
            achievementItems.forEach(item => {
                if (item.confidence > 0.4) {
                    const text = item.text || item.keyword || '';
                    const category = item.category || item.subcategory;
                    
                    // 奖学金分类
                    if (category === 'scholarship' || /奖学金|助学金/.test(text)) {
                        if (/(国家.{0,10}奖学金|国家.{0,10}励志奖学金)/.test(text)) {
                            details.nationalHonor = (details.nationalHonor || 0) + 1;
                        } else if (/(省.{0,10}奖学金|省级.{0,10}奖学金)/.test(text)) {
                            details.provincialHonor = (details.provincialHonor || 0) + 1;
                        } else {
                            details.schoolHonor = (details.schoolHonor || 0) + 1;
                        }
                    }
                    
                    // 荣誉称号分类
                    else if (category === 'honor' || /三好学生|优秀|先进/.test(text)) {
                        if (/(国家|全国).{0,10}(优秀|先进)/.test(text)) {
                            details.nationalHonor = (details.nationalHonor || 0) + 1;
                        } else if (/(省|市).{0,10}(优秀|先进)/.test(text)) {
                            details.provincialHonor = (details.provincialHonor || 0) + 1;
                        } else {
                            details.schoolHonor = (details.schoolHonor || 0) + 1;
                        }
                    }
                    
                    // 竞赛获奖分类
                    else if (category === 'competition' || /竞赛|比赛|大赛|获奖/.test(text)) {
                        if (/(国际|世界).{0,15}(竞赛|比赛|大赛)|ACM|ICPC/.test(text)) {
                            details.internationalComp = (details.internationalComp || 0) + 1;
                        } else if (/(全国|国家级).{0,15}(竞赛|比赛|大赛)/.test(text)) {
                            details.nationalComp = (details.nationalComp || 0) + 1;
                        } else if (/(省|市).{0,15}(竞赛|比赛|大赛)/.test(text)) {
                            details.provincialComp = (details.provincialComp || 0) + 1;
                        } else {
                            details.schoolComp = (details.schoolComp || 0) + 1;
                        }
                    }
                    
                    // 证书认证分类
                    else if (category === 'certificate' || /证书|资格|认证/.test(text)) {
                        if (/(CPA|注册会计师|司法考试|法律职业资格|注册建筑师|注册工程师)/.test(text)) {
                            details.advancedCert = (details.advancedCert || 0) + 1;
                        } else {
                            details.generalCert = (details.generalCert || 0) + 1;
                        }
                    }
                    
                    // 学生干部分类
                    else if (category === 'leadership' || /主席|会长|社长|部长|班长|团支书/.test(text)) {
                        if (/(主席|会长|社长)/.test(text)) {
                            details.chairman = (details.chairman || 0) + 1;
                        } else if (/(部长|副主席|副会长|副社长)/.test(text)) {
                            details.minister = (details.minister || 0) + 1;
                        } else {
                            details.member = (details.member || 0) + 1;
                        }
                    }
                }
            });
        }
        
        // 传统方法补充（如果AI没有提取到足够信息）
        if (Object.keys(details).length === 0) {
            details = this.traditionalAchievementAnalysis(text);
        } else {
            // AI提取到了一些信息，但用传统方法补充验证
            const traditionalDetails = this.traditionalAchievementAnalysis(text);
            Object.keys(traditionalDetails).forEach(key => {
                if (!details[key] || details[key] < traditionalDetails[key]) {
                    details[key] = Math.max(details[key] || 0, traditionalDetails[key] || 0);
                }
            });
        }
        
        // 计算分数（保持原有逻辑）
        let leadershipScore = 0;
        let leadershipRawScore = 0;
        
        if (details.chairman) {
            const rawScore = details.chairman * 3;
            leadershipRawScore += rawScore;
            const limitedScore = Math.min(rawScore, 5);
            leadershipScore += limitedScore;
        }
        if (details.minister) {
            const rawScore = details.minister * 2;
            leadershipRawScore += rawScore;
            const remainingLimit = Math.max(0, 5 - leadershipScore);
            const limitedScore = Math.min(rawScore, remainingLimit);
            leadershipScore += limitedScore;
        }
        if (details.member) {
            const rawScore = details.member * 1;
            leadershipRawScore += rawScore;
            const remainingLimit = Math.max(0, 5 - leadershipScore);
            const limitedScore = Math.min(rawScore, remainingLimit);
            leadershipScore += limitedScore;
        }
        
        if (leadershipRawScore > 5) {
            extraScore.leadership = leadershipRawScore - 5;
        }
        
        totalScore += leadershipScore;
        
        // 荣誉奖励计分
        let honorScore = 0;
        let honorRawScore = 0;
        
        if (details.nationalHonor) {
            const rawScore = details.nationalHonor * 4;
            honorRawScore += rawScore;
            const limitedScore = Math.min(rawScore, 5);
            honorScore += limitedScore;
        }
        if (details.provincialHonor) {
            const rawScore = details.provincialHonor * 3;
            honorRawScore += rawScore;
            const remainingLimit = Math.max(0, 5 - honorScore);
            const limitedScore = Math.min(rawScore, remainingLimit);
            honorScore += limitedScore;
        }
        if (details.schoolHonor) {
            const rawScore = details.schoolHonor * 2;
            honorRawScore += rawScore;
            const remainingLimit = Math.max(0, 5 - honorScore);
            const limitedScore = Math.min(rawScore, remainingLimit);
            honorScore += limitedScore;
        }
        if (details.collegeHonor) {
            const rawScore = details.collegeHonor * 1;
            honorRawScore += rawScore;
            const remainingLimit = Math.max(0, 5 - honorScore);
            const limitedScore = Math.min(rawScore, remainingLimit);
            honorScore += limitedScore;
        }
        
        if (honorRawScore > 5) {
            extraScore.honor = honorRawScore - 5;
        }
        
        totalScore += honorScore;
        
        // 竞赛计分
        let competitionScore = 0;
        let competitionRawScore = 0;
        
        if (details.internationalComp) {
            const rawScore = details.internationalComp * 4;
            competitionRawScore += rawScore;
            const limitedScore = Math.min(rawScore, 5);
            competitionScore += limitedScore;
        }
        if (details.nationalComp) {
            const rawScore = details.nationalComp * 3;
            competitionRawScore += rawScore;
            const remainingLimit = Math.max(0, 5 - competitionScore);
            const limitedScore = Math.min(rawScore, remainingLimit);
            competitionScore += limitedScore;
        }
        if (details.provincialComp) {
            const rawScore = details.provincialComp * 2;
            competitionRawScore += rawScore;
            const remainingLimit = Math.max(0, 5 - competitionScore);
            const limitedScore = Math.min(rawScore, remainingLimit);
            competitionScore += limitedScore;
        }
        if (details.schoolComp) {
            const rawScore = details.schoolComp * 1;
            competitionRawScore += rawScore;
            const remainingLimit = Math.max(0, 5 - competitionScore);
            const limitedScore = Math.min(rawScore, remainingLimit);
            competitionScore += limitedScore;
        }
        
        if (competitionRawScore > 5) {
            extraScore.competition = competitionRawScore - 5;
        }
        
        totalScore += competitionScore;
        
        // 证书计分
        let certScore = 0;
        let certRawScore = 0;
        
        if (details.advancedCert) {
            const rawScore = details.advancedCert * 2;
            certRawScore += rawScore;
            const limitedScore = Math.min(rawScore, 5);
            certScore += limitedScore;
        }
        if (details.generalCert) {
            const rawScore = details.generalCert * 1;
            certRawScore += rawScore;
            const remainingLimit = Math.max(0, 5 - certScore);
            const limitedScore = Math.min(rawScore, remainingLimit);
            certScore += limitedScore;
        }
        
        if (certRawScore > 5) {
            extraScore.certificate = certRawScore - 5;
        }
        
        totalScore += certScore;
        
        return {
            totalScore: Math.min(totalScore, 15),
            details: details,
            extraScore: extraScore,
            aiEnhanced: aiExtraction ? aiExtraction.isAIEnhanced : false
        };
    }
    
    // 传统成就分析方法（作为回退和补充）
    traditionalAchievementAnalysis(text) {
        const details = {};
        
        // 学生干部
        const chairmanPatterns = [
            /(学生会|社团|协会|俱乐部).{0,10}(主席|会长|社长)/gi,
            /(主席|会长|社长)/gi
        ];
        
        let chairmanCount = 0;
        chairmanPatterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) chairmanCount += matches.length;
        });
        
        if (chairmanCount > 0) {
            details.chairman = chairmanCount;
        }
        
        const ministerPatterns = [
            /(学生会|社团|协会|俱乐部).{0,10}(部长|副主席|副会长|副社长)/gi,
            /(部长|副主席|副会长|副社长)/gi
        ];
        
        let ministerCount = 0;
        ministerPatterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) ministerCount += matches.length;
        });
        
        if (ministerCount > 0) {
            details.minister = ministerCount;
        }
        
        // 奖学金
        const scholarshipPatterns = [
            /(国家.{0,10}奖学金|国家.{0,10}励志奖学金)/gi,
            /(省.{0,10}奖学金|省级.{0,10}奖学金)/gi,
            /(校.{0,10}奖学金|一等奖学金|二等奖学金|三等奖学金)/gi
        ];
        
        scholarshipPatterns.forEach((pattern, index) => {
            const matches = text.match(pattern);
            if (matches) {
                if (index === 0) {
                    details.nationalHonor = (details.nationalHonor || 0) + matches.length;
                } else if (index === 1) {
                    details.provincialHonor = (details.provincialHonor || 0) + matches.length;
                } else {
                    details.schoolHonor = (details.schoolHonor || 0) + matches.length;
                }
            }
        });
        
        // 竞赛获奖
        const compPatterns = [
            /(国际.{0,15}(竞赛|比赛|大赛).{0,10}(奖|名|获奖)|ACM|ICPC)/gi,
            /(全国.{0,15}(竞赛|比赛|大赛).{0,10}(奖|名|获奖)|国家级.{0,15}(竞赛|比赛|大赛))/gi,
            /(省.{0,15}(竞赛|比赛|大赛).{0,10}(奖|名|获奖))/gi
        ];
        
        compPatterns.forEach((pattern, index) => {
            const matches = text.match(pattern);
            if (matches) {
                if (index === 0) {
                    details.internationalComp = (details.internationalComp || 0) + matches.length;
                } else if (index === 1) {
                    details.nationalComp = (details.nationalComp || 0) + matches.length;
                } else {
                    details.provincialComp = (details.provincialComp || 0) + matches.length;
                }
            }
        });
        
        // 证书
        const certPatterns = [
            /(CPA|注册会计师|司法考试|法律职业资格)/gi,
            /(英语.*[四六]级|CET-[46]|托福|雅思|计算机.*级)/gi
        ];
        
        certPatterns.forEach((pattern, index) => {
            const matches = text.match(pattern);
            if (matches) {
                if (index === 0) {
                    details.advancedCert = (details.advancedCert || 0) + matches.length;
                } else {
                    details.generalCert = (details.generalCert || 0) + matches.length;
                }
            }
        });
        
        return details;
    }
    
    // 其他方法保持不变...
    fuzzyMatch(text, keyword) {
        if (!text || !keyword || typeof text !== 'string' || typeof keyword !== 'string') {
            return false;
        }
        
        try {
            const cleanText = text.replace(/[\s\-_.]/g, '');
            const cleanKeyword = keyword.replace(/[\s\-_.]/g, '');
            return cleanText.includes(cleanKeyword) || cleanKeyword.includes(cleanText);
        } catch (error) {
            console.warn('fuzzyMatch error:', error);
            return false;
        }
    }
    
    hasName(text) {
        const namePatterns = [
            /姓名[：:]\s*([^\s\n]{2,4})/,
            /^([^\s\n]{2,4})$/m,
            /(个人简历|简历)/
        ];
        return namePatterns.some(pattern => pattern.test(text)) || text.length > 50;
    }
    
    hasGoodStructure(text) {
        const sections = ['教育', '经历', '技能', '项目', '实习', '工作', '学习', '经验'];
        return sections.filter(section => text.includes(section)).length >= 3;
    }
    
    extractGPA(text) {
        const gpaMatch = text.match(/GPA[：:\s]*([0-9.]+)/i) || 
                        text.match(/绩点[：:\s]*([0-9.]+)/) ||
                        text.match(/平均分[：:\s]*([0-9.]+)/);
        if (gpaMatch) {
            const gpa = parseFloat(gpaMatch[1]);
            if (gpa > 5) return gpa / 25;
            if (gpa > 4) return gpa * 0.8;
            return gpa;
        }
        return 0;
    }
    
    extractDegrees(text, aiExtraction = null) {
        const degrees = [];
        
        // 如果有AI提取的教育信息，优先使用
        if (aiExtraction && aiExtraction.extractedKeywords.education) {
            const educationItems = aiExtraction.extractedKeywords.education;
            
            educationItems.forEach(item => {
                if (item.confidence > 0.5) {
                    const sentence = item.text || item.keyword || '';
                    
                    const schoolMatch = sentence.match(/([^\s]{2,15}(?:大学|学院|学校))/);
                    const degreeMatch = sentence.match(/(本科|硕士|博士|学士|硕士研究生|博士研究生)/);
                    const majorMatch = sentence.match(/专业[：:]?\s*([^\s\n]{2,20})/);
                    
                    if (schoolMatch || degreeMatch) {
                        degrees.push({
                            school: this.cleanSchoolName(schoolMatch ? schoolMatch[1] : ''),
                            degree: this.getDegreeLevel(degreeMatch ? degreeMatch[1] : ''),
                            major: majorMatch ? majorMatch[1] : '',
                            text: sentence,
                            aiExtracted: true
                        });
                    }
                }
            });
        }
        
        // 如果AI没有提取到足够信息，使用传统方法补充
        if (degrees.length === 0) {
            const patterns = [
                /([^。\n]*?(?:大学|学院|学校)[^。\n]*?(?:本科|硕士|博士|学士|研究生)[^。\n]*)/gi,
                /([^。\n]*?(?:大学|学院|学校)[^。\n]*?(?:研究生|硕士|博士|master|phd|doctor)[^。\n]*)/gi,
                /(20\d{2}[年\-\.]*20\d{2}|20\d{2}[年\-\.]*).*?([^。\n]*?(?:大学|学院)[^。\n]*?(?:本科|研究生|硕士|博士))/gi
            ];
            
            patterns.forEach(pattern => {
                let match;
                const regex = new RegExp(pattern.source, pattern.flags);
                while ((match = regex.exec(text)) !== null) {
                    degrees.push({
                        school: this.cleanSchoolName(match[1] || match[2] || ''),
                        degree: this.getDegreeLevel(match[2] || match[3] || ''),
                        text: match[0],
                        aiExtracted: false
                    });
                }
            });
        }
        
        // 去重
        return degrees.filter((degree, index, self) => 
            index === self.findIndex(d => d.school === degree.school && d.degree === degree.degree)
        );
    }
    
    cleanSchoolName(schoolText) {
        if (!schoolText) return '';
        return schoolText
            .replace(/(大学|学院|科技|理工).*/, '$1')
            .replace(/^\s*/, '')
            .trim();
    }
    
    getDegreeLevel(degreeText) {
        if (/(博士|phd|doctor)/i.test(degreeText)) return 'phd';
        if (/(硕士|研究生|master)/i.test(degreeText)) return 'master';
        if (/(本科|学士|bachelor)/i.test(degreeText)) return 'bachelor';
        return 'unknown';
    }
    
    calculateSchoolScore(text, degrees) {
        if (degrees.length === 0) {
            return this.getBasicSchoolScore(text);
        }
        
        if (degrees.length === 1) {
            const score = this.getSchoolRankScore(degrees[0].school);
            return Math.min(score, 15);
        }
        
        const sortedDegrees = degrees.sort((a, b) => {
            const order = { 'associate': 1, 'bachelor': 2, 'master': 3, 'phd': 4 };
            return (order[a.degree] || 0) - (order[b.degree] || 0);
        });
        
        const firstDegree = sortedDegrees[0];
        const highestDegree = sortedDegrees[sortedDegrees.length - 1];
        
        const firstScore = this.getSchoolRankScore(firstDegree.school);
        const highestScore = this.getSchoolRankScore(highestDegree.school);
        
        const finalScore = Math.round(firstScore * 0.5 + highestScore * 0.5);
        return Math.min(finalScore, 15);
    }
    
    getSchoolRankScore(schoolName) {
        if (!schoolName) return 2;
        
        const normalizedName = schoolName
            .replace(/大学$/, '')
            .replace(/学院$/, '')
            .replace(/科技$/, '')
            .replace(/理工$/, '');
        
        if (this.schoolRanks.topTier.some(school => 
            this.matchSchoolName(schoolName, school) || 
            this.matchSchoolName(normalizedName, school.replace(/大学$/, '').replace(/学院$/, ''))
        )) {
            return 15;
        }
        
        if (this.schoolRanks.tier1A.some(school => 
            this.matchSchoolName(schoolName, school) || 
            this.matchSchoolName(normalizedName, school.replace(/大学$/, '').replace(/学院$/, ''))
        )) {
            return 13;
        }
        
        if (this.schoolRanks.tier1B.some(school => 
            this.matchSchoolName(schoolName, school) || 
            this.matchSchoolName(normalizedName, school.replace(/大学$/, '').replace(/学院$/, ''))
        )) {
            return 11;
        }
        
        if (this.schoolRanks.tier2A.some(school => 
            this.matchSchoolName(schoolName, school) || 
            this.matchSchoolName(normalizedName, school.replace(/大学$/, '').replace(/学院$/, ''))
        )) {
            return 9;
        }
        
        if (this.schoolRanks.tier2B.some(school => 
            this.matchSchoolName(schoolName, school) || 
            this.matchSchoolName(normalizedName, school.replace(/大学$/, '').replace(/学院$/, ''))
        )) {
            return 7;
        }
        
        if (this.schoolRanks.tier3.some(school => 
            this.matchSchoolName(schoolName, school) || 
            this.matchSchoolName(normalizedName, school.replace(/大学$/, '').replace(/学院$/, ''))
        )) {
            return 5;
        }
        
        if (/(大学|学院)/i.test(schoolName)) {
            if (/(985|211|双一流|重点)/i.test(schoolName)) return 6;
            return 3;
        }
        
        if (/(专科|高职)/i.test(schoolName)) return 1;
        
        return 2;
    }
    
    matchSchoolName(name1, name2) {
        if (!name1 || !name2) return false;
        
        if (name1.includes(name2) || name2.includes(name1)) return true;
        
        const simple1 = name1.replace(/[大学院科技理工]/g, '');
        const simple2 = name2.replace(/[大学院科技理工]/g, '');
        
        return simple1.length >= 2 && simple2.length >= 2 && 
               (simple1.includes(simple2) || simple2.includes(simple1));
    }
    
    getBasicSchoolScore(text) {
        if (/(清华|北大)/i.test(text)) return 15;
        if (/(复旦|交大|浙大|中科大|南大)/i.test(text)) return 13;
        if (/(985)/i.test(text)) return 11;
        if (/(211|双一流)/i.test(text)) return 9;
        if (/(重点大学)/i.test(text)) return 7;
        if (/(大学|学院)/i.test(text)) return 3;
        if (/(专科|高职)/i.test(text)) return 1;
        
        return 2;
    }
    
    calculateDegreeScore(degrees) {
        if (degrees.length === 0) return 0;
        
        let maxDegreeScore = 0;
        const degreeCount = {};
        
        degrees.forEach(degree => {
            if (degree.degree === 'phd') {
                maxDegreeScore = Math.max(maxDegreeScore, 5);
                degreeCount.phd = (degreeCount.phd || 0) + 1;
            } else if (degree.degree === 'master') {
                maxDegreeScore = Math.max(maxDegreeScore, 3);
                degreeCount.master = (degreeCount.master || 0) + 1;
            } else if (degree.degree === 'bachelor') {
                maxDegreeScore = Math.max(maxDegreeScore, 1);
                degreeCount.bachelor = (degreeCount.bachelor || 0) + 1;
            }
        });
        
        const totalDegrees = Object.values(degreeCount).reduce((sum, count) => sum + count, 0);
        let multiDegreeBonus = 0;
        if (totalDegrees > 1) {
            multiDegreeBonus = (totalDegrees - 1) * 1;
        }
        
        const finalScore = maxDegreeScore + multiDegreeBonus;
        return Math.min(finalScore, 5);
    }
    
    calculateAcademicScore(text) {
        let score = 0;
        
        const natureMatches = text.match(/(nature|science)/gi);
        if (natureMatches) score += natureMatches.length * 5;
        
        const jcr1Matches = text.match(/(JCR.*?[一1]区|影响因子.*?[5-9])/gi);
        if (jcr1Matches) score += jcr1Matches.length * 4;
        
        const sciMatches = text.match(/(SCI|sci)/gi);
        if (sciMatches) score += sciMatches.length * 3;
        
        const eiMatches = text.match(/(EI|ei)/gi);
        if (eiMatches) score += eiMatches.length * 2;
        
        const chineseMatches = text.match(/(核心期刊|中文期刊)/gi);
        if (chineseMatches) score += chineseMatches.length * 1;
        
        return Math.min(score, 15);
    }
    
    // 评分相关方法...（保持原有逻辑，但增加AI增强标识）
    scoreResume(text) {
        const analysis = this.analyzeResume(text);
        const baseScores = this.calculateScores(analysis);
        
        const specializations = this.detectSpecialization(analysis);
        
        let baseTotalScore = 0;
        Object.entries(baseScores).forEach(([category, scoreObj]) => {
            const score = typeof scoreObj === 'object' ? scoreObj.total : scoreObj;
            if (category === 'education') {
                baseTotalScore += score;
            } else {
                baseTotalScore += Math.min(score, this.maxScores[category]);
            }
        });
        
        const specializationBonus = specializations.reduce((sum, spec) => sum + spec.bonus, 0);
        const finalTotalScore = baseTotalScore + specializationBonus;
        
        const suggestions = this.generateSuggestions(baseScores, analysis);
        const jobRecommendations = this.recommendJobs(analysis, specializations);
        
        return {
            baseScore: Math.round(baseTotalScore),
            specializationBonus: specializationBonus,
            totalScore: Math.round(finalTotalScore),
            categoryScores: baseScores,
            analysis: analysis,
            specializations: specializations,
            suggestions: suggestions,
            jobRecommendations: jobRecommendations
        };
    }
    
    calculateScores(analysis) {
        return {
            basicInfo: this.scoreBasicInfoDetailed(analysis),
            education: this.scoreEducationDetailed(analysis),
            skills: this.scoreSkillsDetailed(analysis),
            experience: this.scoreExperienceDetailed(analysis),
            achievements: this.scoreAchievementsDetailed(analysis)
        };
    }
    
    scoreBasicInfoDetailed(analysis) {
        const count = analysis.basicInfo.count;
        const total = Math.min(count * 2, this.maxScores.basicInfo);
        
        return {
            total: total,
            details: analysis.basicInfo,
            maxScore: this.maxScores.basicInfo,
            aiEnhanced: analysis.basicInfo.aiEnhanced
        };
    }
    
    scoreEducationDetailed(analysis) {
        const details = {};
        let total = 0;
        
        details.school = Math.min(analysis.education.schoolLevel, 15);
        total += details.school;
        
        const gpa4 = analysis.education.gpa;
        if (gpa4 >= 3.7) details.academic = 5;
        else if (gpa4 >= 3.3) details.academic = 4;
        else if (gpa4 >= 2.7) details.academic = 3;
        else if (gpa4 >= 2.0) details.academic = 2;
        else if (analysis.education.hasGPA) details.academic = 1;
        else details.academic = 0;
        total += details.academic;
        
        details.degree = analysis.education.degreeScore;
        total += details.degree;
        
        return {
            total: total,
            details: details,
            maxScores: { school: 15, academic: 5, degree: 5 },
            aiEnhanced: analysis.education.aiEnhanced
        };
    }
    
    scoreSkillsDetailed(analysis) {
        const details = {};
        let total = 0;
        const skills = analysis.skills;
        
        details.programming = Math.min(skills.programming.length, 5);
        total += details.programming;
        
        details.design = Math.min(skills.design.length, 4);
        total += details.design;
        
        details.data = Math.min(skills.data.length, 4);
        total += details.data;
        
        details.engineering = Math.min(skills.engineering.length, 3);
        total += details.engineering;
        
        details.languages = Math.min(skills.languages.length, 3);
        total += details.languages;
        
        details.business = Math.min(skills.business.length, 2);
        total += details.business;
        
        details.arts = Math.min(skills.arts.length, 3);
        total += details.arts;
        
        return {
            total: Math.min(total, this.maxScores.skills),
            details: details,
            maxScores: { 
                programming: 5, design: 4, data: 4,
                engineering: 3, languages: 3, business: 2, arts: 3
            },
            aiEnhanced: analysis.skills.aiEnhanced
        };
    }
    
    scoreExperienceDetailed(analysis) {
        const exp = analysis.experience;
        
        const details = {
            internship: Math.round(exp.internshipScore),
            project: Math.round(exp.projectScore),
            academic: Math.round(exp.academicScore)
        };
        
        const total = Math.min(
            details.internship + details.project + details.academic, 
            this.maxScores.experience
        );
        
        return {
            total: total,
            details: details,
            maxScores: { internship: 10, project: 10, academic: 10 },
            aiEnhanced: analysis.experience.aiEnhanced
        };
    }
    
    scoreAchievementsDetailed(analysis) {
        const ach = analysis.achievements;
        
        const details = {};
        
        let leadershipScore = 0;
        if (ach.details.chairman) leadershipScore += ach.details.chairman * 3;
        if (ach.details.minister) leadershipScore += ach.details.minister * 2;
        if (ach.details.member) leadershipScore += ach.details.member * 1;
        details.leadership = Math.min(leadershipScore, 5);
        
        let honorScore = 0;
        if (ach.details.nationalHonor) honorScore += ach.details.nationalHonor * 4;
        if (ach.details.provincialHonor) honorScore += ach.details.provincialHonor * 3;
        if (ach.details.schoolHonor) honorScore += ach.details.schoolHonor * 2;
        if (ach.details.collegeHonor) honorScore += ach.details.collegeHonor * 1;
        details.honor = Math.min(honorScore, 5);
        
        let competitionScore = 0;
        if (ach.details.internationalComp) competitionScore += ach.details.internationalComp * 4;
        if (ach.details.nationalComp) competitionScore += ach.details.nationalComp * 3;
        if (ach.details.provincialComp) competitionScore += ach.details.provincialComp * 2;
        if (ach.details.schoolComp) competitionScore += ach.details.schoolComp * 1;
        details.competition = Math.min(competitionScore, 5);
        
        let certificateScore = 0;
        if (ach.details.advancedCert) certificateScore += ach.details.advancedCert * 2;
        if (ach.details.generalCert) certificateScore += ach.details.generalCert * 1;
        details.certificate = Math.min(certificateScore, 5);
        
        return {
            total: ach.totalScore,
            details: details,
            maxScore: this.maxScores.achievements,
            subMaxScores: {
                leadership: 5,
                honor: 5,
                competition: 5,
                certificate: 5
            },
            extraScore: ach.extraScore || {},
            aiEnhanced: ach.aiEnhanced
        };
    }
    
    detectSpecialization(analysis) {
        const specializations = [];
        const skills = analysis.skills;
        const experience = analysis.experience;
        const achievements = analysis.achievements;
        
        // 编程专精
        if (skills.programming && skills.programming.length >= 5) {
            specializations.push({
                type: 'programming',
                category: 'skill',
                level: skills.programming.length,
                bonus: Math.min(skills.programming.length - 4, 6),
                description: `编程开发专精 (掌握${skills.programming.length}项技术)`,
                aiEnhanced: skills.aiEnhanced
            });
        }
        
        // 数据分析专精
        if (skills.data && skills.data.length >= 4) {
            specializations.push({
                type: 'data',
                category: 'skill',
                level: skills.data.length,
                bonus: Math.min(skills.data.length - 3, 5),
                description: `数据分析专精 (掌握${skills.data.length}项技术)`,
                aiEnhanced: skills.aiEnhanced
            });
        }
        
        // 设计专精
        if (skills.design && skills.design.length >= 4) {
            specializations.push({
                type: 'design',
                category: 'skill',
                level: skills.design.length,
                bonus: Math.min(skills.design.length - 3, 5),
                description: `设计创作专精 (掌握${skills.design.length}项技术)`,
                aiEnhanced: skills.aiEnhanced
            });
        }
        
        // 工程技术专精
        if (skills.engineering && skills.engineering.length >= 3) {
            specializations.push({
                type: 'engineering',
                category: 'skill',
                level: skills.engineering.length,
                bonus: Math.min(skills.engineering.length - 2, 4),
                description: `工程技术专精 (掌握${skills.engineering.length}项技术)`,
                aiEnhanced: skills.aiEnhanced
            });
        }
        
        // 语言能力专精
        if (skills.languages && skills.languages.length >= 3) {
            specializations.push({
                type: 'languages',
                category: 'skill',
                level: skills.languages.length,
                bonus: Math.min(skills.languages.length - 2, 4),
                description: `语言能力专精 (掌握${skills.languages.length}种语言)`,
                aiEnhanced: skills.aiEnhanced
            });
        }
        
        // 商务技能专精
        if (skills.business && skills.business.length >= 3) {
            specializations.push({
                type: 'business',
                category: 'skill',
                level: skills.business.length,
                bonus: Math.min(skills.business.length - 2, 3),
                description: `商务技能专精 (掌握${skills.business.length}项商务技能)`,
                aiEnhanced: skills.aiEnhanced
            });
        }
        
        // 文体艺术专精
        if (skills.arts && skills.arts.length >= 4) {
            specializations.push({
                type: 'arts',
                category: 'skill',
                level: skills.arts.length,
                bonus: Math.min(skills.arts.length - 3, 4),
                description: `文体艺术专精 (掌握${skills.arts.length}项技能)`,
                aiEnhanced: skills.aiEnhanced
            });
        }
        
        // 实习经验专精
        if (experience.internshipExtraScore > 0) {
            const bonus = Math.min(Math.floor(experience.internshipExtraScore / 2), 6);
            if (bonus > 0) {
                specializations.push({
                    type: 'internship',
                    category: 'experience',
                    level: experience.internshipCount,
                    bonus: bonus,
                    description: `实习经验专精 (${experience.internshipCount}次实习经历)`,
                    aiEnhanced: experience.aiEnhanced
                });
            }
        }
        
        // 项目经验专精
        if (experience.projectExtraScore > 0) {
            const bonus = Math.min(Math.floor(experience.projectExtraScore / 2), 6);
            if (bonus > 0) {
                specializations.push({
                    type: 'project',
                    category: 'experience',
                    level: experience.projectCount,
                    bonus: bonus,
                    description: `项目经验专精 (${experience.projectCount}个项目经验)`,
                    aiEnhanced: experience.aiEnhanced
                });
            }
        }
        
        // 学术研究专精
        if (experience.academicExtraScore > 0) {
            const bonus = Math.min(Math.floor(experience.academicExtraScore / 2), 6);
            if (bonus > 0) {
                specializations.push({
                    type: 'academic',
                    category: 'experience',
                    level: this.countPapers(analysis.originalText),
                    bonus: bonus,
                    description: `学术研究专精 (${this.countPapers(analysis.originalText)}篇学术成果)`,
                    aiEnhanced: experience.aiEnhanced
                });
            }
        }
        
        // 荣誉成就专精
        if (achievements.extraScore) {
            let totalExtraScore = 0;
            Object.values(achievements.extraScore).forEach(score => {
                totalExtraScore += score;
            });
            
            if (totalExtraScore > 0) {
                const bonus = Math.min(Math.floor(totalExtraScore / 2), 6);
                if (bonus > 0) {
                    specializations.push({
                        type: 'achievement',
                        category: 'achievement',
                        level: totalExtraScore,
                        bonus: bonus,
                        description: `荣誉成就专精 (超出基础分${totalExtraScore}分)`,
                        aiEnhanced: achievements.aiEnhanced
                    });
                }
            }
        }
        
        return specializations;
    }
    
    countPapers(text) {
        const patterns = [
            /(nature|science)/gi,
            /(JCR.*?[一1]区|影响因子.*?[5-9])/gi,
            /(SCI|sci)/gi,
            /(EI|ei)/gi,
            /(核心期刊|中文期刊)/gi
        ];
        
        let count = 0;
        patterns.forEach(pattern => {
            const matches = text.match(pattern);
            if (matches) count += matches.length;
        });
        
        return count;
    }
    
    recommendJobs(analysis, specializations = []) {
        const jobs = [];
        const skills = analysis.skills;
        const education = analysis.education;
        const aiFlag = analysis.aiEnhanced ? ' (AI智能分析)' : '';
        
        // 编程开发相关岗位
        if (skills.programming && skills.programming.length > 0) {
            let match = Math.min(70 + skills.programming.length * 4, 95);
            if (specializations.some(s => s.type === 'programming')) match += 5;
            
            jobs.push({
                category: '软件开发工程师',
                match: match,
                reason: `掌握${skills.programming.slice(0, 3).join('、')}等编程技能${aiFlag}`,
                aiEnhanced: analysis.aiEnhanced
            });
        }
        
        // 数据分析相关岗位
        if (skills.data && skills.data.length > 0) {
            let match = Math.min(65 + skills.data.length * 5, 90);
            if (specializations.some(s => s.type === 'data')) match += 5;
            
            jobs.push({
                category: '数据分析师',
                match: match,
                reason: `具备${skills.data.slice(0, 3).join('、')}等数据处理能力${aiFlag}`,
                aiEnhanced: analysis.aiEnhanced
            });
        }
        
        // 产品设计相关岗位
        if (skills.design && skills.design.length > 0) {
            let match = Math.min(60 + skills.design.length * 6, 88);
            if (specializations.some(s => s.type === 'design')) match += 5;
            
            jobs.push({
                category: '产品设计师',
                match: match,
                reason: `熟练使用${skills.design.slice(0, 3).join('、')}等设计工具${aiFlag}`,
                aiEnhanced: analysis.aiEnhanced
            });
        }
        
        // 工程技术相关岗位
        if (skills.engineering && skills.engineering.length > 0) {
            let match = Math.min(55 + skills.engineering.length * 7, 85);
            if (specializations.some(s => s.type === 'engineering')) match += 5;
            
            jobs.push({
                category: '工程技术岗位',
                match: match,
                reason: `掌握${skills.engineering.slice(0, 3).join('、')}等工程技术${aiFlag}`,
                aiEnhanced: analysis.aiEnhanced
            });
        }
        
        // 商务运营相关岗位
        if (skills.business && skills.business.length > 0) {
            let match = Math.min(55 + skills.business.length * 6, 82);
            if (specializations.some(s => s.type === 'business')) match += 5;
            
            jobs.push({
                category: '商务运营',
                match: match,
                reason: `具备${skills.business.slice(0, 3).join('、')}等商务技能${aiFlag}`,
                aiEnhanced: analysis.aiEnhanced
            });
        }
        
        // 国际化相关岗位
        if (skills.languages && skills.languages.length >= 2) {
            let match = Math.min(60 + skills.languages.length * 8, 85);
            if (specializations.some(s => s.type === 'languages')) match += 5;
            
            jobs.push({
                category: '国际化业务',
                match: match,
                reason: `具备${skills.languages.slice(0, 3).join('、')}等语言能力${aiFlag}`,
                aiEnhanced: analysis.aiEnhanced
            });
        }
        
        // 文体艺术相关岗位
        if (skills.arts && skills.arts.length > 0) {
            let match = Math.min(50 + skills.arts.length * 5, 80);
            if (specializations.some(s => s.type === 'arts')) match += 5;
            
            jobs.push({
                category: '文体艺术相关岗位',
                match: match,
                reason: `具备${skills.arts.slice(0, 3).join('、')}等文体艺术技能${aiFlag}`,
                aiEnhanced: analysis.aiEnhanced
            });
        }
        
        // 学术研究相关岗位
        if (analysis.experience.academicScore > 0) {
            let match = Math.min(55 + analysis.experience.academicScore * 2, 85);
            if (specializations.some(s => s.type === 'academic')) match += 5;
            
            jobs.push({
                category: '学术研究/科研助理',
                match: match,
                reason: `具备学术研究能力和成果${aiFlag}`,
                aiEnhanced: analysis.aiEnhanced
            });
        }
        
        // 专精加成岗位推荐
        specializations.forEach(spec => {
            if (spec.type === 'programming' && spec.level >= 6) {
                jobs.push({
                    category: '高级软件工程师',
                    match: 92,
                    reason: `编程技能专精（掌握${spec.level}项技术）${aiFlag}`,
                    aiEnhanced: analysis.aiEnhanced,
                    isSpecialization: true
                });
            }
            if (spec.type === 'academic' && spec.level >= 3) {
                jobs.push({
                    category: '博士研究生/高级研发',
                    match: 90,
                    reason: `学术能力突出（${spec.description}）${aiFlag}`,
                    aiEnhanced: analysis.aiEnhanced,
                    isSpecialization: true
                });
            }
            if (spec.type === 'data' && spec.level >= 5) {
                jobs.push({
                    category: '高级数据科学家',
                    match: 91,
                    reason: `数据分析专精（掌握${spec.level}项技术）${aiFlag}`,
                    aiEnhanced: analysis.aiEnhanced,
                    isSpecialization: true
                });
            }
        });
        
        // 如果没有明显专长，推荐管培生
        if (jobs.length === 0) {
            if (education.schoolLevel >= 11) {
                jobs.push({
                    category: '知名企业管培生',
                    match: 75,
                    reason: `名校背景，适合大企业培养计划${aiFlag}`,
                    aiEnhanced: analysis.aiEnhanced
                });
            } else {
                jobs.push({
                    category: '管理培训生',
                    match: 60,
                    reason: `适合全面发展的应届毕业生${aiFlag}`,
                    aiEnhanced: analysis.aiEnhanced
                });
            }
        }
        
        // 去重并排序
        const uniqueJobs = jobs.filter((job, index, self) => 
            index === self.findIndex(j => j.category === job.category)
        );
        
        return uniqueJobs.sort((a, b) => b.match - a.match).slice(0, 5);
    }
    
    generateSuggestions(scores, analysis) {
        const suggestions = [];
        
        const basicScore = scores.basicInfo.total;
        const eduScore = scores.education.total;
        const skillScore = scores.skills.total;
        const expScore = scores.experience.total;
        const achScore = scores.achievements.total;
        
        const aiFlag = analysis.aiEnhanced ? ' (AI分析建议)' : '';
        
        // 基本信息建议
        if (basicScore < 8) {
            suggestions.push(`完善个人信息，建议至少填写5项基本信息${aiFlag}`);
        }
        
        // 教育背景建议
        if (eduScore < 20) {
            if (!analysis.education.hasGPA) {
                suggestions.push(`建议添加GPA或学业成绩信息${aiFlag}`);
            }
            if (analysis.education.degreeScore < 3) {
                suggestions.push(`考虑继续深造提升学历层次${aiFlag}`);
            }
            suggestions.push(`突出学校优势和学术表现${aiFlag}`);
        }
        
        // 技能建议
        if (skillScore < 12) {
            const skillCategories = Object.keys(analysis.skills).filter(key => 
                key !== 'total' && key !== 'aiEnhanced' && 
                Array.isArray(analysis.skills[key]) && 
                analysis.skills[key].length === 0
            );
            
            if (skillCategories.length > 0) {
                suggestions.push(`增加${skillCategories.slice(0, 2).join('、')}等领域的技能描述${aiFlag}`);
            }
            suggestions.push(`详细描述技能掌握程度和应用经验${aiFlag}`);
        }
        
        // 经验建议
        if (expScore < 20) {
            if (analysis.experience.internshipScore < 6) {
                suggestions.push(`寻找更多实习机会，积累实践经验${aiFlag}`);
            }
            if (analysis.experience.projectScore < 6) {
                suggestions.push(`参与更多项目，详细描述项目成果和个人贡献${aiFlag}`);
            }
            if (analysis.experience.academicScore === 0) {
                suggestions.push(`考虑参与学术研究或发表论文${aiFlag}`);
            }
        }
        
        // 成就建议
        if (achScore < 8) {
            suggestions.push(`积极参加各类竞赛和申请奖学金${aiFlag}`);
            suggestions.push(`争取担任学生干部或参与社团活动${aiFlag}`);
            suggestions.push(`考虑考取相关专业证书提升竞争力${aiFlag}`);
        }
        
        // 名校背景建议
        if (analysis.education.schoolLevel >= 13) {
            suggestions.push(`充分利用名校背景，可考虑申请知名企业或继续深造${aiFlag}`);
        }
        
        // AI增强建议
        if (analysis.aiEnhanced) {
            if (analysis.aiConfidence > 0.8) {
                suggestions.push(`AI智能分析显示您的简历结构清晰，内容丰富${aiFlag}`);
            } else if (analysis.aiConfidence < 0.5) {
                suggestions.push(`建议优化简历格式，使用更清晰的段落结构便于AI识别${aiFlag}`);
            }
            
            // 基于AI统计信息的建议
            if (analysis.aiStats) {
                if (analysis.aiStats.coverageScore < 0.6) {
                    suggestions.push(`简历内容覆盖度较低，建议补充缺失的关键信息模块${aiFlag}`);
                }
                if (analysis.aiStats.qualityScore < 0.5) {
                    suggestions.push(`提高信息描述的准确性和完整性，避免模糊表达${aiFlag}`);
                }
            }
        }
        
        // 专精发展建议
        const skills = analysis.skills;
        const strongSkills = [];
        Object.entries(skills).forEach(([category, skillList]) => {
            if (Array.isArray(skillList) && skillList.length >= 3) {
                strongSkills.push(category);
            }
        });
        
        if (strongSkills.length > 0) {
            suggestions.push(`您在${strongSkills.slice(0, 2).join('、')}方面有优势，可重点发展相关岗位${aiFlag}`);
        }
        
        // 如果没有其他建议
        if (suggestions.length === 0) {
            suggestions.push(`简历质量很好！建议针对不同岗位定制化调整${aiFlag}`);
        }
        
        return suggestions;
    }
}

// 导出
window.ResumeParser = ResumeParser;
window.ResumeScorer = ResumeScorer;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ResumeParser, ResumeScorer };
}

