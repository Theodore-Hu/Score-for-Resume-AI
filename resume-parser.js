// 简历解析器 - AI关键词提取增强版
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
                useSystemFonts: false
            });
            
            pdf = await loadingTask.promise;
            let fullText = '';
            const maxPages = Math.min(pdf.numPages, 10);
            
            const concurrentLimit = 3;
            const chunks = [];
            
            for (let i = 0; i < maxPages; i += concurrentLimit) {
                const pagePromises = [];
                for (let j = i; j < Math.min(i + concurrentLimit, maxPages); j++) {
                    pagePromises.push(this.extractPageText(pdf, j + 1));
                }
                const chunkResults = await Promise.all(pagePromises);
                chunks.push(...chunkResults);
            }
            
            fullText = chunks.join('\n');
            
            // 使用AI关键词提取进行文本清理
            return this.aiEnhancedTextCleaning(fullText);
            
        } catch (error) {
            console.error('PDF解析错误:', error);
            throw new Error('PDF解析失败: ' + error.message);
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
            
            const textItems = textContent.items.map(item => {
                let text = item.str;
                if (item.hasEOL) {
                    text += '\n';
                }
                return text;
            });
            
            const pageText = textItems.join(' ');
            page.cleanup();
            return pageText;
        } catch (error) {
            console.warn(`页面 ${pageNum} 解析失败:`, error);
            return '';
        }
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
            
            // 使用AI关键词提取进行文本清理
            return this.aiEnhancedTextCleaning(result.value);
            
        } catch (error) {
            console.error('Word解析错误:', error);
            throw new Error('Word文档解析失败: ' + error.message);
        }
    }
    
    // AI增强的文本清理
    static aiEnhancedTextCleaning(text) {
        if (!text || typeof text !== 'string') {
            return '';
        }
        
        // 基础清理
        let cleanedText = text
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\t/g, ' ')
            .replace(/ +/g, ' ')
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            .trim();
        
        // 如果AI关键词提取器可用，使用AI清理
        if (window.aiKeywordExtractor && window.aiKeywordExtractor.isAvailable()) {
            try {
                console.log('使用AI关键词提取进行文本清理...');
                const extraction = window.aiKeywordExtractor.extractKeywords(cleanedText);
                
                if (extraction.isAIEnhanced && extraction.cleanedSections) {
                    // 重构文本，减少重复和噪音
                    cleanedText = this.reconstructTextFromKeywords(extraction.cleanedSections, cleanedText);
                    console.log('AI文本清理完成，置信度:', extraction.confidence);
                }
            } catch (error) {
                console.warn('AI文本清理失败，使用传统方法:', error);
            }
        }
        
        return this.finalTextCleaning(cleanedText);
    }
    
    // 基于关键词重构文本
    static reconstructTextFromKeywords(cleanedSections, originalText) {
        const sections = [];
        
        // 保留个人信息部分
        if (cleanedSections.personal && cleanedSections.personal.sentences.length > 0) {
            sections.push('=== 个人信息 ===');
            sections.push(...cleanedSections.personal.sentences);
            sections.push('');
        }
        
        // 教育背景
        if (cleanedSections.education && cleanedSections.education.sentences.length > 0) {
            sections.push('=== 教育背景 ===');
            sections.push(...cleanedSections.education.sentences);
            sections.push('');
        }
        
        // 工作经验
        if (cleanedSections.experience && cleanedSections.experience.sentences.length > 0) {
            sections.push('=== 工作经验 ===');
            sections.push(...cleanedSections.experience.sentences);
            sections.push('');
        }
        
        // 专业技能
        if (cleanedSections.skills && cleanedSections.skills.sentences.length > 0) {
            sections.push('=== 专业技能 ===');
            sections.push(...cleanedSections.skills.sentences);
            sections.push('');
        }
        
        // 奖励荣誉
        if (cleanedSections.achievements && cleanedSections.achievements.sentences.length > 0) {
            sections.push('=== 奖励荣誉 ===');
            sections.push(...cleanedSections.achievements.sentences);
            sections.push('');
        }
        
        // 如果AI提取的内容太少，保留原文的一部分
        const reconstructedText = sections.join('\n');
        if (reconstructedText.length < originalText.length * 0.3) {
            console.log('AI提取内容过少，保留更多原文');
            return originalText; // 回退到原文
        }
        
        return reconstructedText;
    }
    
    static finalTextCleaning(text) {
        return text
            .split('\n')
            .map(line => line.trim())
            .filter(line => line.length > 0)
            .join('\n')
            .replace(/={3,}/g, '') // 移除分隔符
            .trim();
    }
    
    static async parseFile(file) {
        if (!file || !file.type || !file.name) {
            throw new Error('无效的文件');
        }
        
        const fileType = file.type.toLowerCase();
        const fileName = file.name.toLowerCase();
        
        if (file.size === 0) {
            throw new Error('文件为空或损坏');
        }
        
        try {
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
            
            if (!text || text.trim().length < 10) {
                throw new Error('无法从文件中提取有效内容，请检查文件是否正确或尝试其他格式');
            }
            
            if (!this.isValidResumeContent(text)) {
                throw new Error('文件内容不像是简历，请上传正确的简历文件');
            }
            
            return text;
            
        } catch (error) {
            if (error.message.includes('password') || error.message.includes('encrypted')) {
                throw new Error('文件已加密，请上传未加密的文件');
            }
            
            if (error.message.includes('corrupted') || error.message.includes('invalid')) {
                throw new Error('文件已损坏，请尝试重新保存后上传');
            }
            
            throw error;
        }
    }
    
    static isValidResumeContent(text) {
        const resumeKeywords = [
            '姓名', '电话', '邮箱', '教育', '经历', '技能', '工作', '实习', 
            '项目', '学校', '专业', '大学', '学院', '毕业', '求职', '应聘',
            'name', 'phone', 'email', 'education', 'experience', 'skills',
            'work', 'university', 'college', 'graduate', 'internship', 'project'
        ];
        
        const lowerText = text.toLowerCase();
        const matchCount = resumeKeywords.filter(keyword => 
            lowerText.includes(keyword.toLowerCase())
        ).length;
        
        return matchCount >= 3;
    }
    
    static getFileInfo(file) {
        return {
            name: file.name,
            size: file.size,
            type: file.type,
            lastModified: new Date(file.lastModified),
            sizeFormatted: this.formatFileSize(file.size)
        };
    }
    
    static formatFileSize(bytes) {
        if (bytes === 0) return '0 B';
        
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    }
}

// 简历评分器 - AI关键词增强版
class ResumeScorer {
    constructor() {
        this.maxScores = {
            basicInfo: 10,
            education: 25,
            skills: 20,
            experience: 30,
            achievements: 15
        };
        
        // 学校分级体系保持不变
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
        
        // 技能关键词库
        this.skillKeywords = {
            programming: [
                'Java', 'Python', 'JavaScript', 'C++', 'C#', 'Go', 'Rust', 'Swift', 'Kotlin',
                'React', 'Vue', 'Angular', 'Node.js', 'Spring', 'Django', 'Flask', 'Express',
                '前端', '后端', '全栈', '编程', '开发', '程序设计', 'HTML', 'CSS', 'PHP',
                'TypeScript', 'jQuery', 'Bootstrap', 'Webpack', 'Git', 'Linux', 'Docker'
            ],
            design: [
                'Photoshop', 'Illustrator', 'Sketch', 'Figma', 'XD', 'Axure', 'Principle',
                'UI', 'UX', '平面设计', '交互设计', '视觉设计', '用户体验', '用户界面',
                '界面设计', '原型设计', '设计思维', 'Premiere', 'After Effects', 'Cinema 4D'
            ],
            data: [
                'SQL', 'MySQL', 'MongoDB', 'PostgreSQL', 'Oracle', 'Excel', 'Tableau',
                'SPSS', 'R语言', 'MATLAB', 'Power BI', 'Spark', 'Hadoop', 'Hive',
                '数据分析', '数据挖掘', '数据可视化', '机器学习', '深度学习', '人工智能',
                'TensorFlow', 'PyTorch', '统计分析', '数据库', '大数据'
            ],
            engineering: [
                'CAD', 'AutoCAD', 'SolidWorks', 'Pro/E', 'UG', 'CATIA', 'Inventor',
                'ANSYS', 'ABAQUS', 'COMSOL', '有限元', '仿真', '建模', '测试', '实验设计',
                'LabVIEW', 'Altium Designer', 'Keil', 'Quartus', 'Vivado', 'FPGA'
            ],
            arts: [
                '钢琴', '吉他', '小提琴', '舞蹈', '唱歌', '绘画', '书法', '摄影', '视频制作',
                '篮球', '足球', '乒乓球', '羽毛球', '游泳', '跑步', '健身', '瑜伽',
                '演讲', '主持', '辩论', '表演', '相声', '话剧', '朗诵', '配音',
                '文学创作', '诗歌', '小说', '散文', '新闻写作', '编剧', '导演',
                '乐器演奏', '声乐', '作曲', '编曲', '音乐制作', '音响师'
            ]
        };
    }
    
    // 使用AI关键词增强的简历分析
    analyzeResume(text) {
        let aiExtraction = null;
        
        // 如果AI关键词提取器可用，使用AI增强分析
        if (window.aiKeywordExtractor && window.aiKeywordExtractor.isAvailable()) {
            try {
                aiExtraction = window.aiKeywordExtractor.extractKeywords(text);
                console.log('使用AI关键词提取进行增强分析');
            } catch (error) {
                console.warn('AI关键词提取失败，使用传统分析:', error);
            }
        }
        
        const basicInfo = this.analyzeBasicInfo(text, aiExtraction);
        const education = this.analyzeEducation(text, aiExtraction);
        const skills = this.analyzeSkills(text, aiExtraction);
        const experience = this.analyzeExperience(text, aiExtraction);
        const achievements = this.analyzeAchievements(text, aiExtraction);
        
        return {
            originalText: text,
            basicInfo: basicInfo,
            education: education,
            skills: skills,
            experience: experience,
            achievements: achievements,
            wordCount: text.length,
            hasStructure: this.hasGoodStructure(text),
            aiEnhanced: aiExtraction ? aiExtraction.isAIEnhanced : false,
            aiConfidence: aiExtraction ? aiExtraction.confidence : 0
        };
    }
    
    // AI增强的基本信息分析
    analyzeBasicInfo(text, aiExtraction = null) {
        const info = {};
        let count = 0;
        
        // 使用AI提取的个人信息（如果可用）
        if (aiExtraction && aiExtraction.extractedKeywords && aiExtraction.extractedKeywords.personal) {
            const personalKeywords = aiExtraction.extractedKeywords.personal;
            personalKeywords.forEach(item => {
                // 安全地获取句子
                const sentence = (item && typeof item.sentence === 'string') ? item.sentence : 
                               (typeof item === 'string') ? item : '';
                
                if (sentence) {
                    if (/姓名|名字/.test(sentence)) { info.name = true; count++; }
                    if (/1[3-9]\d{9}/.test(sentence)) { info.phone = true; count++; }
                    if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(sentence)) { info.email = true; count++; }
                    if (/(地址|住址|居住地)/.test(sentence)) { info.address = true; count++; }
                }
            });
        }
        
        // 传统方法补充（确保text是字符串）
        if (text && typeof text === 'string') {
            if (this.hasName(text)) { info.name = info.name || true; if (!info.name) count++; }
            if (/1[3-9]\d{9}/.test(text)) { info.phone = info.phone || true; if (!info.phone) count++; }
            if (/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/.test(text)) { info.email = info.email || true; if (!info.email) count++; }
            if (/(市|省|区|县|路|街|号|意向|求职)/.test(text)) { info.address = info.address || true; if (!info.address) count++; }
            if (/(求职|应聘|岗位|职位|意向)/.test(text)) { info.intention = true; count++; }
            if (/(github|gitlab|个人网站|博客|portfolio)/i.test(text)) { info.website = true; count++; }
            if (/(linkedin|微博|知乎)/i.test(text)) { info.social = true; count++; }
            if (/(出生|生日|\d{4}年\d{1,2}月)/.test(text)) { info.birthday = true; count++; }
            if (/(党员|团员|群众|政治面貌)/.test(text)) { info.political = true; count++; }
        }
        
        return { ...info, count: Math.min(count, 9) }; // 最多9分
    }
    
    // AI增强的技能分析
    analyzeSkills(text, aiExtraction = null) {
        const skills = {
            programming: [],
            design: [],
            data: [],
            engineering: [],
            arts: [],
            total: 0
        };
        
        // 使用AI提取的技能信息
        if (aiExtraction && aiExtraction.extractedKeywords && aiExtraction.extractedKeywords.skills) {
            const skillKeywords = aiExtraction.extractedKeywords.skills;
            skillKeywords.forEach(item => {
                // 安全地获取句子和关键词
                const sentence = (item && typeof item.sentence === 'string') ? item.sentence : 
                               (typeof item === 'string') ? item : '';
                const keywords = item && Array.isArray(item.keywords) ? item.keywords : 
                               (item && item.keyword) ? [item.keyword] : [];
                
                if (sentence) {
                    // 将AI提取的关键词分类到对应技能类别
                    Object.keys(this.skillKeywords).forEach(category => {
                        this.skillKeywords[category].forEach(skill => {
                            // 添加安全检查
                            if (skill && typeof skill === 'string' && sentence && typeof sentence === 'string') {
                                const isInSentence = sentence.toLowerCase().includes(skill.toLowerCase());
                                const isInKeywords = keywords.some(k => 
                                    k && typeof k === 'string' && k.toLowerCase().includes(skill.toLowerCase())
                                );
                                
                                if (isInSentence || isInKeywords) {
                                    if (!skills[category].includes(skill)) {
                                        skills[category].push(skill);
                                    }
                                }
                            }
                        });
                    });
                }
            });
        }
        
        // 传统方法补充
        if (text && typeof text === 'string') {
            const textLower = text.toLowerCase();
            Object.keys(this.skillKeywords).forEach(category => {
                this.skillKeywords[category].forEach(skill => {
                    // 添加安全检查
                    if (skill && typeof skill === 'string') {
                        const skillLower = skill.toLowerCase();
                        if (textLower.includes(skillLower) || 
                            textLower.includes(skillLower.replace(/[.\s]/g, '')) ||
                            this.fuzzyMatch(textLower, skillLower)) {
                            if (!skills[category].includes(skill)) {
                                skills[category].push(skill);
                            }
                        }
                    }
                });
            });
        }
        
        skills.total = Object.values(skills).reduce((sum, arr) => 
            sum + (Array.isArray(arr) ? arr.length : 0), 0
        );
        
        return skills;
    }
    
    // 其他分析方法保持原来的逻辑，但增加AI辅助
    analyzeEducation(text, aiExtraction = null) {
        const education = {
            schoolLevel: 0,
            hasGPA: /GPA|绩点|平均分|成绩/.test(text),
            gpa: this.extractGPA(text),
            degrees: this.extractDegrees(text, aiExtraction),
            degreeScore: 0
        };
        
        education.schoolLevel = this.calculateSchoolScore(text, education.degrees);
        education.degreeScore = this.calculateDegreeScore(education.degrees);
        
        return education;
    }
    
    analyzeExperience(text, aiExtraction = null) {
        let internshipCount = Math.max(
            (text.match(/实习|intern/gi) || []).length, 
            (text.match(/(公司|企业|集团|科技|有限).*?(实习|intern)/gi) || []).length
        );
        
        let projectCount = Math.max(
            (text.match(/项目|project/gi) || []).length,
            (text.match(/(开发|设计|完成|负责).*?(项目|系统|网站|APP)/gi) || []).length
        );
        
        // AI增强：从提取的经验中获取更准确的计数
        if (aiExtraction && aiExtraction.extractedKeywords.experience) {
            const experienceItems = aiExtraction.extractedKeywords.experience;
            const aiInternshipCount = experienceItems.filter(item => 
                (item.sentence || item).includes('实习')
            ).length;
            const aiProjectCount = experienceItems.filter(item => 
                (item.sentence || item).includes('项目')
            ).length;
            
            // 取AI和传统方法的较大值
            internshipCount = Math.max(internshipCount, aiInternshipCount);
            projectCount = Math.max(projectCount, aiProjectCount);
        }
        
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
            academicExtraScore: academicExtraScore
        };
    }
    
    analyzeAchievements(text, aiExtraction = null) {
        // AI增强的奖励荣誉分析
        let totalScore = 0;
        const details = {};
        const extraScore = {};
        
        // 使用AI提取的成就信息进行更精确的识别
        if (aiExtraction && aiExtraction.extractedKeywords.achievements) {
            const achievementItems = aiExtraction.extractedKeywords.achievements;
            console.log('AI提取的成就信息:', achievementItems);
            
            // 基于AI提取的内容进行分类计分
            achievementItems.forEach(item => {
                const sentence = item.sentence || item;
                
                // 学生干部识别
                if (/(主席|会长|社长)/.test(sentence)) {
                    details.chairman = (details.chairman || 0) + 1;
                } else if (/(部长|副主席|副会长|副社长)/.test(sentence)) {
                    details.minister = (details.minister || 0) + 1;
                } else if (/(干事|委员|成员|班长|团支书)/.test(sentence)) {
                    details.member = (details.member || 0) + 1;
                }
                
                // 奖学金和荣誉识别
                if (/(国家.{0,10}奖学金|国家.{0,10}励志奖学金)/.test(sentence)) {
                    details.nationalHonor = (details.nationalHonor || 0) + 1;
                } else if (/(省.{0,10}奖学金|省级.{0,10}奖学金)/.test(sentence)) {
                    details.provincialHonor = (details.provincialHonor || 0) + 1;
                } else if (/(校.{0,10}奖学金|一等奖学金|二等奖学金|三等奖学金)/.test(sentence)) {
                    details.schoolHonor = (details.schoolHonor || 0) + 1;
                }
                
                // 竞赛获奖识别
                if (/(国际.{0,15}(竞赛|比赛|大赛).{0,10}(奖|名|获奖)|ACM|ICPC)/.test(sentence)) {
                    details.internationalComp = (details.internationalComp || 0) + 1;
                } else if (/(全国.{0,15}(竞赛|比赛|大赛).{0,10}(奖|名|获奖)|国家级.{0,15}(竞赛|比赛|大赛))/.test(sentence)) {
                    details.nationalComp = (details.nationalComp || 0) + 1;
                }
                
                // 证书认证识别
                if (/(CPA|注册会计师|司法考试|法律职业资格)/.test(sentence)) {
                    details.advancedCert = (details.advancedCert || 0) + 1;
                } else if (/(英语.*[四六]级|CET-[46]|托福|雅思|计算机.*级)/.test(sentence)) {
                    details.generalCert = (details.generalCert || 0) + 1;
                }
            });
        }
        
        // 如果AI没有提取到足够信息，使用传统方法补充
        if (Object.keys(details).length === 0) {
            return this.traditionalAchievementAnalysis(text);
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
        
        if (honorRawScore > 5) {
            extraScore.honor = honorRawScore - 5;
        }
        
        totalScore += honorScore;
        
        // 竞赛和证书计分类似...
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
        
        if (competitionRawScore > 5) {
            extraScore.competition = competitionRawScore - 5;
        }
        
        totalScore += competitionScore;
        
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
            extraScore: extraScore
        };
    }
    
    // 传统成就分析方法（作为回退）
    traditionalAchievementAnalysis(text) {
        // 原有的analyzeAchievements逻辑
        let totalScore = 0;
        const details = {};
        const extraScore = {};
        
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
            totalScore += Math.min(chairmanCount * 3, 5);
        }
        
        // ... 其他传统逻辑
        
        return {
            totalScore: Math.min(totalScore, 15),
            details: details,
            extraScore: extraScore
        };
    }
    
    // 其他方法保持不变...
    fuzzyMatch(text, keyword) {
        // 添加安全检查
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
                const sentence = item.sentence || item;
                
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
    
    // 评分相关方法保持不变...
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
            maxScore: this.maxScores.basicInfo
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
            maxScores: { school: 15, academic: 5, degree: 5 }
        };
    }
    
    scoreSkillsDetailed(analysis) {
        const details = {};
        let total = 0;
        const skills = analysis.skills;
        
        details.programming = Math.min(skills.programming.length, 4);
        total += details.programming;
        
        details.design = Math.min(skills.design.length, 4);
        total += details.design;
        
        details.data = Math.min(skills.data.length, 4);
        total += details.data;
        
        details.engineering = Math.min(skills.engineering.length, 4);
        total += details.engineering;
        
        details.arts = Math.min(skills.arts.length, 4);
        total += details.arts;
        
        return {
            total: Math.min(total, this.maxScores.skills),
            details: details,
            maxScores: { programming: 4, design: 4, data: 4, engineering: 4, arts: 4 }
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
            maxScores: { internship: 10, project: 10, academic: 10 }
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
            extraScore: ach.extraScore || {}
        };
    }
    
    detectSpecialization(analysis) {
        const specializations = [];
        const skills = analysis.skills;
        const experience = analysis.experience;
        const achievements = analysis.achievements;
        
        if (skills.programming && skills.programming.length >= 5) {
            specializations.push({
                type: 'programming',
                category: 'skill',
                level: skills.programming.length,
                bonus: Math.min(skills.programming.length - 4, 5),
                description: `编程开发专精 (掌握${skills.programming.length}项技术)`
            });
        }
        
        if (skills.data && skills.data.length >= 4) {
            specializations.push({
                type: 'data',
                category: 'skill',
                level: skills.data.length,
                bonus: Math.min(skills.data.length - 3, 4),
                description: `数据分析专精 (掌握${skills.data.length}项技术)`
            });
        }
        
        if (skills.design && skills.design.length >= 4) {
            specializations.push({
                type: 'design',
                category: 'skill',
                level: skills.design.length,
                bonus: Math.min(skills.design.length - 3, 4),
                description: `设计创作专精 (掌握${skills.design.length}项技术)`
            });
        }
        
        if (skills.engineering && skills.engineering.length >= 4) {
            specializations.push({
                type: 'engineering',
                category: 'skill',
                level: skills.engineering.length,
                bonus: Math.min(skills.engineering.length - 3, 4),
                description: `工程技术专精 (掌握${skills.engineering.length}项技术)`
            });
        }
        
        if (skills.arts && skills.arts.length >= 4) {
            specializations.push({
                type: 'arts',
                category: 'skill',
                level: skills.arts.length,
                bonus: Math.min(skills.arts.length - 3, 4),
                description: `文体艺术专精 (掌握${skills.arts.length}项技能)`
            });
        }
        
        if (experience.internshipExtraScore > 0) {
            const bonus = Math.min(Math.floor(experience.internshipExtraScore / 3), 5);
            if (bonus > 0) {
                specializations.push({
                    type: 'internship',
                    category: 'experience',
                    level: experience.internshipCount,
                    bonus: bonus,
                    description: `实习专精 (${experience.internshipCount}次实习经历)`
                });
            }
        }
        
        if (experience.projectExtraScore > 0) {
            const bonus = Math.min(Math.floor(experience.projectExtraScore / 3), 5);
            if (bonus > 0) {
                specializations.push({
                    type: 'project',
                    category: 'experience',
                    level: experience.projectCount,
                    bonus: bonus,
                    description: `项目专精 (${experience.projectCount}个项目经验)`
                });
            }
        }
        
        if (experience.academicExtraScore > 0) {
            const bonus = Math.min(Math.floor(experience.academicExtraScore / 3), 5);
            if (bonus > 0) {
                specializations.push({
                    type: 'academic',
                    category: 'experience',
                    level: this.countPapers(analysis.originalText),
                    bonus: bonus,
                    description: `学术专精 (${this.countPapers(analysis.originalText)}篇学术成果)`
                });
            }
        }
        
        if (achievements.extraScore) {
            let totalExtraScore = 0;
            Object.values(achievements.extraScore).forEach(score => {
                totalExtraScore += score;
            });
            
            if (totalExtraScore > 0) {
                const bonus = Math.min(Math.floor(totalExtraScore / 3), 5);
                if (bonus > 0) {
                    specializations.push({
                        type: 'achievement',
                        category: 'achievement',
                        level: totalExtraScore,
                        bonus: bonus,
                        description: `荣誉专精 (超出基础分${totalExtraScore}分)`
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
        
        if (skills.programming && skills.programming.length > 0) {
            jobs.push({
                category: '软件开发工程师',
                match: Math.min(75 + skills.programming.length * 5, 95),
                reason: `掌握${skills.programming.slice(0, 3).join('、')}等编程技能${analysis.aiEnhanced ? ' (AI识别)' : ''}`
            });
        }
        
        if (skills.data && skills.data.length > 0) {
            jobs.push({
                category: '数据分析师',
                match: Math.min(70 + skills.data.length * 6, 90),
                reason: `具备${skills.data.slice(0, 3).join('、')}等数据处理能力${analysis.aiEnhanced ? ' (AI识别)' : ''}`
            });
        }
        
        if (skills.design && skills.design.length > 0) {
            jobs.push({
                category: '产品设计师',
                match: Math.min(65 + skills.design.length * 7, 88),
                reason: `熟练使用${skills.design.slice(0, 3).join('、')}等设计工具${analysis.aiEnhanced ? ' (AI识别)' : ''}`
            });
        }
        
        if (skills.engineering && skills.engineering.length > 0) {
            jobs.push({
                category: '工程技术岗位',
                match: Math.min(60 + skills.engineering.length * 8, 85),
                reason: `掌握${skills.engineering.slice(0, 3).join('、')}等工程技术${analysis.aiEnhanced ? ' (AI识别)' : ''}`
            });
        }
        
        if (skills.arts && skills.arts.length > 0) {
            jobs.push({
                category: '文体艺术相关岗位',
                match: Math.min(60 + skills.arts.length * 6, 80),
                reason: `具备${skills.arts.slice(0, 3).join('、')}等文体艺术技能${analysis.aiEnhanced ? ' (AI识别)' : ''}`
            });
        }
        
        if (analysis.experience.academicScore > 0) {
            jobs.push({
                category: '学术研究/科研助理',
                match: Math.min(60 + analysis.experience.academicScore * 2, 85),
                reason: `具备学术研究能力和成果${analysis.aiEnhanced ? ' (AI识别)' : ''}`
            });
        }
        
        if (analysis.experience.internshipScore > 0) {
            jobs.push({
                category: '商务运营',
                match: Math.min(60 + analysis.experience.internshipScore, 85),
                reason: `具备商业思维和实习经验${analysis.aiEnhanced ? ' (AI识别)' : ''}`
            });
        }
        
        specializations.forEach(spec => {
            if (spec.type === 'programming' && spec.level >= 5) {
                jobs.push({
                    category: '高级软件工程师',
                    match: 90,
                    reason: `编程技能专精（掌握${spec.level}项技术）${analysis.aiEnhanced ? ' (AI识别)' : ''}`
                });
            }
            if (spec.type === 'academic' && spec.level >= 3) {
                jobs.push({
                    category: '博士研究生/高级研发',
                    match: 88,
                    reason: `学术能力突出（${spec.description}）${analysis.aiEnhanced ? ' (AI识别)' : ''}`
                });
            }
        });
        
        if (jobs.length === 0) {
            if (education.schoolLevel >= 11) {
                jobs.push({
                    category: '知名企业管培生',
                    match: 75,
                    reason: `名校背景，适合大企业培养计划${analysis.aiEnhanced ? ' (AI识别)' : ''}`
                });
            } else {
                jobs.push({
                    category: '管理培训生',
                    match: 60,
                    reason: `适合全面发展的应届毕业生${analysis.aiEnhanced ? ' (AI识别)' : ''}`
                });
            }
        }
        
        const uniqueJobs = jobs.filter((job, index, self) => 
            index === self.findIndex(j => j.category === job.category)
        );
        
        return uniqueJobs.sort((a, b) => b.match - a.match).slice(0, 4);
    }
    
    generateSuggestions(scores, analysis) {
        const suggestions = [];
        
        const basicScore = scores.basicInfo.total;
        const eduScore = scores.education.total;
        const skillScore = scores.skills.total;
        const expScore = scores.experience.total;
        const achScore = scores.achievements.total;
        
        if (basicScore < 8) {
            suggestions.push('完善个人信息，建议至少填写5项基本信息');
        }
        
        if (eduScore < 20) {
            if (!analysis.education.hasGPA) {
                suggestions.push('建议添加GPA或学业成绩信息');
            }
            if (analysis.education.degreeScore < 3) {
                suggestions.push('考虑继续深造提升学历层次');
            }
            suggestions.push('突出学校优势和学术表现');
        }
        
        if (skillScore < 12) {
            suggestions.push('增加与目标岗位相关的技能描述');
            suggestions.push('可以补充文体艺术等综合技能展示');
        }
        
        if (expScore < 20) {
            if (analysis.experience.internshipScore < 6) {
                suggestions.push('寻找更多实习机会，积累实践经验');
            }
            if (analysis.experience.projectScore < 6) {
                suggestions.push('参与更多项目，详细描述项目成果');
            }
            
            if (analysis.experience.academicScore === 0) {
                suggestions.push('考虑参与学术研究或发表论文');
            }
        }
        
        if (achScore < 8) {
            suggestions.push('积极参加各类竞赛和申请奖学金');
            suggestions.push('争取担任学生干部或参与社团活动');
        }
        
        if (analysis.education.schoolLevel >= 13) {
            suggestions.push('充分利用名校背景，可考虑申请知名企业或继续深造');
        }
        
        // AI增强建议
        if (analysis.aiEnhanced && analysis.aiConfidence > 0.8) {
            suggestions.push('AI智能分析显示您的简历结构清晰，内容丰富');
        } else if (analysis.aiEnhanced && analysis.aiConfidence < 0.5) {
            suggestions.push('建议优化简历格式，使用更清晰的段落结构');
        }
        
        if (suggestions.length === 0) {
            suggestions.push('简历质量很好！建议针对不同岗位定制化调整');
        }
        
        return suggestions;
    }
}

// 导出为全局变量
window.ResumeParser = ResumeParser;
window.ResumeScorer = ResumeScorer;
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ResumeParser, ResumeScorer };
}
