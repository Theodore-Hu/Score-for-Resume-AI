// AI关键词提取器 - 增强版本 v3.0
class AIKeywordExtractor {
    constructor() {
        this.isEnabled = localStorage.getItem('ai-keyword-enabled') !== 'false';
        this.isReady = false;
        this.nlpLib = null;
        this.debugMode = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
        
        // 增强的关键词数据库
        this.keywordDatabase = {
            personal: {
                name: {
                    patterns: [
                        /姓名[：:\s]*([^\s\n]{2,4})/,
                        /^([^\s\n]{2,4})(?=\s|$)/m,
                        /我是([^\s\n]{2,4})/,
                        /([^\s\n]{2,4})的简历/
                    ],
                    contextWords: ['姓名', '我是', '个人信息', '基本信息']
                },
                phone: {
                    patterns: [
                        /(?:电话|手机|联系方式|Tel|Phone)[：:\s]*([1][3-9]\d{9})/gi,
                        /([1][3-9]\d{9})/g,
                        /(\d{3}[-\s]?\d{4}[-\s]?\d{4})/g
                    ],
                    contextWords: ['电话', '手机', '联系方式', 'Tel', 'Phone', '移动电话']
                },
                email: {
                    patterns: [
                        /(?:邮箱|邮件地址|Email|E-mail)[：:\s]*([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/gi,
                        /([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g
                    ],
                    contextWords: ['邮箱', '邮件', 'Email', 'E-mail', '电子邮件', '联系邮箱']
                },
                address: {
                    patterns: [
                        /(?:地址|住址|居住地|现居住地)[：:\s]*([^。\n]{5,50})/gi,
                        /([^。\n]*?(?:市|区|县|路|街|号|村|镇)[^。\n]*)/g
                    ],
                    contextWords: ['地址', '住址', '居住地', '家庭住址', '通讯地址']
                },
                intention: {
                    patterns: [
                        /(?:求职意向|应聘职位|目标职位|期望职位)[：:\s]*([^。\n]{3,30})/gi,
                        /应聘[：:\s]*([^。\n]{3,30})/gi
                    ],
                    contextWords: ['求职意向', '应聘职位', '目标职位', '期望职位', '意向岗位']
                }
            },
            education: {
                school: {
                    patterns: [
                        /([^。\n]*?(?:大学|学院|学校|University|College)[^。\n]*)/gi,
                        /(20\d{2}[年\-\.]*20\d{2}|20\d{2}[年\-\.]*).*?([^。\n]*?(?:大学|学院)[^。\n]*)/gi,
                        /就读于([^。\n]*?(?:大学|学院|学校)[^。\n]*)/gi
                    ],
                    contextWords: ['就读', '毕业于', '学校', '大学', '学院', '教育背景']
                },
                degree: {
                    patterns: [
                        /([^。\n]*?(?:本科|硕士|博士|学士|研究生|专科|大专)[^。\n]*)/gi,
                        /(?:学历|学位)[：:\s]*([^。\n]*?(?:本科|硕士|博士|学士|研究生|专科|大专)[^。\n]*)/gi
                    ],
                    contextWords: ['学历', '学位', '本科', '硕士', '博士', '研究生']
                },
                major: {
                    patterns: [
                        /(?:专业|主修)[：:\s]*([^。\n]{3,20})/gi,
                        /([^。\n]{3,20})专业/gi,
                        /专业为([^。\n]{3,20})/gi
                    ],
                    contextWords: ['专业', '主修', '学科', '方向']
                },
                gpa: {
                    patterns: [
                        /(?:GPA|绩点|平均分|成绩)[：:\s]*([0-9\.]+)/gi,
                        /平均成绩[：:\s]*([0-9\.]+)/gi
                    ],
                    contextWords: ['GPA', '绩点', '平均分', '成绩', '学习成绩']
                }
            },
            skills: {
                programming: {
                    keywords: [
                        'Java', 'Python', 'JavaScript', 'C++', 'C#', 'Go', 'Rust', 'Swift', 'Kotlin', 'PHP',
                        'React', 'Vue', 'Angular', 'Node.js', 'Spring', 'Django', 'Flask', 'Express',
                        'HTML', 'CSS', 'TypeScript', 'jQuery', 'Bootstrap', 'Webpack', 'Git', 'Docker',
                        'MySQL', 'MongoDB', 'PostgreSQL', 'Redis', 'Linux', 'AWS', 'Azure'
                    ],
                    patterns: [
                        /熟练掌握([^。\n]*?(?:Java|Python|JavaScript|C\+\+|C#|Go|Rust|Swift|Kotlin|PHP)[^。\n]*)/gi,
                        /精通([^。\n]*?(?:编程|开发|程序设计)[^。\n]*)/gi
                    ],
                    contextWords: ['编程', '开发', '程序设计', '软件开发', '代码', '算法']
                },
                design: {
                    keywords: [
                        'Photoshop', 'Illustrator', 'Sketch', 'Figma', 'XD', 'Axure', 'Principle',
                        'UI', 'UX', 'Premiere', 'After Effects', 'Cinema 4D', 'AutoCAD', 'SolidWorks'
                    ],
                    patterns: [
                        /熟练使用([^。\n]*?(?:Photoshop|Illustrator|Sketch|Figma|XD|Axure)[^。\n]*)/gi,
                        /([^。\n]*?(?:设计|UI|UX|平面设计|界面设计)[^。\n]*)/gi
                    ],
                    contextWords: ['设计', 'UI', 'UX', '平面设计', '界面设计', '视觉设计']
                },
                languages: {
                    keywords: ['英语', '日语', '韩语', '法语', '德语', '西班牙语', 'CET-4', 'CET-6', '托福', '雅思'],
                    patterns: [
                        /([^。\n]*?(?:英语|日语|韩语|法语|德语|西班牙语)[^。\n]*)/gi,
                        /([^。\n]*?(?:CET-4|CET-6|托福|雅思|四级|六级)[^。\n]*)/gi
                    ],
                    contextWords: ['语言能力', '外语', '英语水平', '语言技能']
                }
            },
            experience: {
                internship: {
                    patterns: [
                        /([^。\n]*?(?:实习|intern)[^。\n]*)/gi,
                        /(20\d{2}[年\-\.]*20\d{2}|20\d{2}[年\-\.]*).*?([^。\n]*?(?:实习|intern)[^。\n]*)/gi,
                        /在([^。\n]*?(?:公司|企业|集团|科技|有限))[^。\n]*?实习/gi
                    ],
                    contextWords: ['实习经历', '实习生', '实习期间', '实习工作']
                },
                project: {
                    patterns: [
                        /([^。\n]*?(?:项目|Project)[^。\n]*)/gi,
                        /(?:参与|负责|开发|设计)([^。\n]*?(?:项目|系统|网站|APP)[^。\n]*)/gi,
                        /项目名称[：:\s]*([^。\n]+)/gi
                    ],
                    contextWords: ['项目经验', '项目开发', '项目管理', '参与项目']
                },
                work: {
                    patterns: [
                        /([^。\n]*?(?:工作|职位|岗位|职责)[^。\n]*)/gi,
                        /(20\d{2}[年\-\.]*20\d{2}|20\d{2}[年\-\.]*).*?([^。\n]*?(?:工作|任职)[^。\n]*)/gi
                    ],
                    contextWords: ['工作经历', '职业经历', '任职经历', '工作经验']
                }
            },
            achievements: {
                scholarship: {
                    keywords: [
                        '奖学金', '助学金', '励志奖学金', '国家奖学金', '国家励志奖学金',
                        '校级奖学金', '省级奖学金', '一等奖学金', '二等奖学金', '三等奖学金',
                        '学业奖学金', '优秀学生奖学金', '专业奖学金', '单项奖学金'
                    ],
                    patterns: [
                        /([^。\n]*?(?:奖学金|助学金)[^。\n]*)/gi,
                        /(20\d{2}[年\-\.]*(?:获得|荣获)[^。\n]*?(?:奖学金|助学金)[^。\n]*)/gi,
                        /([一二三四五六七八九十0-9]+等奖学金)/gi
                    ],
                    contextWords: ['获得', '荣获', '奖励', '资助']
                },
                honor: {
                    keywords: [
                        '三好学生', '优秀学生', '优秀团员', '优秀干部', '先进个人',
                        '优秀毕业生', '优秀班干部', '学习标兵', '道德模范', '优秀志愿者'
                    ],
                    patterns: [
                        /([^。\n]*?(?:三好学生|优秀学生|优秀团员|优秀干部|先进个人)[^。\n]*)/gi,
                        /(20\d{2}[年\-\.]*(?:获得|荣获)[^。\n]*?(?:优秀|先进)[^。\n]*)/gi
                    ],
                    contextWords: ['荣誉', '称号', '表彰', '认定']
                },
                competition: {
                    keywords: [
                        '竞赛', '比赛', '大赛', '挑战杯', '数学建模', '程序设计竞赛',
                        '创新创业大赛', '学科竞赛', '专业竞赛', 'ACM', 'ICPC'
                    ],
                    patterns: [
                        /([^。\n]*?(?:竞赛|比赛|大赛)[^。\n]*?(?:获奖|名次|冠军|亚军|第[一二三]名|一等奖|二等奖|三等奖)[^。\n]*)/gi,
                        /(20\d{2}[年\-\.]*[^。\n]*?(?:竞赛|比赛|大赛)[^。\n]*)/gi
                    ],
                    contextWords: ['参赛', '获奖', '比赛', '竞赛', '名次']
                },
                certificate: {
                    keywords: [
                        'CPA', '注册会计师', '司法考试', '法律职业资格', '教师资格证',
                        '计算机等级', '软件设计师', 'PMP', 'CISSP', '驾驶证'
                    ],
                    patterns: [
                        /([^。\n]*?(?:证书|资格证|资格|认证)[^。\n]*)/gi,
                        /(?:获得|通过)([^。\n]*?(?:证书|资格|认证)[^。\n]*)/gi
                    ],
                    contextWords: ['证书', '资格', '认证', '考试', '职业资格']
                },
                leadership: {
                    keywords: [
                        '主席', '会长', '社长', '部长', '副主席', '副会长', '副社长',
                        '班长', '团支书', '学生干部', '社团干部', '组织委员', '宣传委员'
                    ],
                    patterns: [
                        /([^。\n]*?(?:主席|会长|社长|部长|班长|团支书)[^。\n]*)/gi,
                        /(?:担任|任职)([^。\n]*?(?:主席|会长|社长|部长|班长|团支书|干部)[^。\n]*)/gi
                    ],
                    contextWords: ['担任', '任职', '职务', '领导', '干部']
                }
            }
        };
        
        this.init();
    }
    
    async init() {
        try {
            this.updateStatus('正在初始化AI关键词提取器...');
            
            if (typeof nlp !== 'undefined') {
                this.nlpLib = nlp;
                this.isReady = true;
                this.updateStatus('AI关键词提取准备就绪', 'ready');
                if (this.debugMode) console.log('AI关键词提取器初始化成功');
            } else {
                if (this.debugMode) console.warn('NLP库未加载，使用增强传统方法');
                this.updateStatus('使用增强传统识别方法', 'ready');
                this.isReady = true; // 即使没有NLP库也可以使用增强方法
            }
        } catch (error) {
            console.error('AI关键词提取器初始化失败:', error);
            this.updateStatus('AI初始化失败', 'error');
        }
    }
    
    // 主要提取方法
    extractKeywords(text) {
        if (!this.isEnabled) {
            return this.fallbackExtraction(text);
        }
        
        try {
            const startTime = performance.now();
            
            // 预处理文本
            const preprocessedText = this.preprocessText(text);
            
            const result = {
                isAIEnhanced: true,
                extractedKeywords: {},
                cleanedSections: {},
                confidence: 0,
                processingTime: 0,
                stats: {
                    totalMatches: 0,
                    highConfidenceMatches: 0,
                    duplicatesRemoved: 0
                }
            };
            
            // 执行多层次提取
            result.extractedKeywords = this.multiLayerExtraction(preprocessedText);
            
            // 智能去重和清理
            result.extractedKeywords = this.intelligentDeduplication(result.extractedKeywords);
            
            // 生成清理后的段落
            result.cleanedSections = this.generateCleanedSections(preprocessedText, result.extractedKeywords);
            
            // 计算置信度
            result.confidence = this.calculateOverallConfidence(result.extractedKeywords);
            
            // 统计信息
            result.stats = this.calculateStats(result.extractedKeywords);
            result.processingTime = performance.now() - startTime;
            
            if (this.debugMode) {
                console.group('🔍 增强AI关键词提取结果');
                console.log('处理时间:', `${result.processingTime.toFixed(2)}ms`);
                console.log('整体置信度:', `${(result.confidence * 100).toFixed(1)}%`);
                console.log('统计信息:', result.stats);
                console.log('提取结果:', result.extractedKeywords);
                console.groupEnd();
            }
            
            return result;
            
        } catch (error) {
            console.error('关键词提取失败:', error);
            return this.fallbackExtraction(text);
        }
    }
    
    // 文本预处理
    preprocessText(text) {
        if (!text || typeof text !== 'string') return '';
        
        return text
            // 标准化换行和空格
            .replace(/\r\n/g, '\n')
            .replace(/\r/g, '\n')
            .replace(/\t/g, ' ')
            .replace(/\s+/g, ' ')
            // 标准化标点符号
            .replace(/：/g, ':')
            .replace(/；/g, ';')
            .replace(/（/g, '(')
            .replace(/）/g, ')')
            .replace(/"/g, '"')
            .replace(/"/g, '"')
            // 处理日期格式
            .replace(/(\d{4})\s*年\s*(\d{1,2})\s*月/g, '$1年$2月')
            .replace(/(\d{4})\s*\.\s*(\d{1,2})/g, '$1.$2')
            // 移除多余空行
            .replace(/\n\s*\n\s*\n/g, '\n\n')
            .trim();
    }
    
    // 多层次提取
    multiLayerExtraction(text) {
        const results = {};
        
        // 初始化结果结构
        Object.keys(this.keywordDatabase).forEach(category => {
            results[category] = [];
        });
        
        // 第一层：精确模式匹配
        this.exactPatternMatching(text, results);
        
        // 第二层：上下文分析
        this.contextAnalysis(text, results);
        
        // 第三层：语义理解（如果有NLP库）
        if (this.isReady && this.nlpLib) {
            this.semanticAnalysis(text, results);
        }
        
        // 第四层：关键词扫描
        this.keywordScanning(text, results);
        
        return results;
    }
    
    // 精确模式匹配
    exactPatternMatching(text, results) {
        Object.entries(this.keywordDatabase).forEach(([category, subcategories]) => {
            Object.entries(subcategories).forEach(([subcategory, config]) => {
                if (config.patterns) {
                    config.patterns.forEach((pattern, patternIndex) => {
                        const matches = this.findMatches(text, pattern);
                        matches.forEach(match => {
                            results[category].push({
                                text: match.text,
                                keyword: subcategory,
                                confidence: this.calculatePatternConfidence(match, pattern, patternIndex),
                                method: 'exact_pattern',
                                subcategory: subcategory,
                                position: match.index,
                                source: match.fullMatch
                            });
                        });
                    });
                }
            });
        });
    }
    
    // 查找匹配项
    findMatches(text, pattern) {
        const matches = [];
        let match;
        
        // 重置正则表达式的lastIndex
        if (pattern.global) pattern.lastIndex = 0;
        
        while ((match = pattern.exec(text)) !== null) {
            const matchText = match[1] || match[0];
            if (matchText && matchText.trim().length > 1) {
                matches.push({
                    text: matchText.trim(),
                    index: match.index,
                    fullMatch: match[0]
                });
            }
            
            // 防止无限循环
            if (!pattern.global) break;
        }
        
        return matches;
    }
    
    // 上下文分析
    contextAnalysis(text, results) {
        const sentences = this.splitIntoSentences(text);
        
        sentences.forEach((sentence, sentenceIndex) => {
            Object.entries(this.keywordDatabase).forEach(([category, subcategories]) => {
                Object.entries(subcategories).forEach(([subcategory, config]) => {
                    if (config.contextWords) {
                        const contextScore = this.calculateContextScore(sentence, config.contextWords);
                        if (contextScore > 0.3) {
                            // 在有上下文的句子中查找相关信息
                            this.extractFromContext(sentence, category, subcategory, contextScore, results, sentenceIndex);
                        }
                    }
                });
            });
        });
    }
    
    // 分割句子
    splitIntoSentences(text) {
        return text.split(/[。；！？\n]/)
            .map(s => s.trim())
            .filter(s => s.length > 5);
    }
    
    // 计算上下文得分
    calculateContextScore(sentence, contextWords) {
        let score = 0;
        const sentenceLower = sentence.toLowerCase();
        
        contextWords.forEach(word => {
            if (sentenceLower.includes(word.toLowerCase())) {
                score += 1;
            }
        });
        
        return Math.min(score / contextWords.length, 1);
    }
    
    // 从上下文提取信息
    extractFromContext(sentence, category, subcategory, contextScore, results, sentenceIndex) {
        // 根据不同类型提取不同信息
        let extracted = null;
        
        switch (subcategory) {
            case 'email':
                extracted = this.extractEmailFromContext(sentence);
                break;
            case 'phone':
                extracted = this.extractPhoneFromContext(sentence);
                break;
            case 'name':
                extracted = this.extractNameFromContext(sentence);
                break;
            case 'school':
                extracted = this.extractSchoolFromContext(sentence);
                break;
            default:
                extracted = this.extractGenericFromContext(sentence, subcategory);
        }
        
        if (extracted) {
            results[category].push({
                text: extracted,
                keyword: subcategory,
                confidence: contextScore * 0.8, // 上下文提取的置信度稍低
                method: 'context_analysis',
                subcategory: subcategory,
                position: sentenceIndex,
                source: sentence
            });
        }
    }
    
    // 具体的上下文提取方法
    extractEmailFromContext(sentence) {
        const emailPattern = /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/;
        const match = sentence.match(emailPattern);
        return match ? match[0] : null;
    }
    
    extractPhoneFromContext(sentence) {
        const phonePattern = /1[3-9]\d{9}/;
        const match = sentence.match(phonePattern);
        return match ? match[0] : null;
    }
    
    extractNameFromContext(sentence) {
        // 在包含"姓名"等词的句子中查找可能的姓名
        const namePattern = /(?:姓名|我是|叫)[：:\s]*([^\s\n]{2,4})/;
        const match = sentence.match(namePattern);
        return match ? match[1] : null;
    }
    
    extractSchoolFromContext(sentence) {
        const schoolPattern = /([^\s\n]*?(?:大学|学院|学校)[^\s\n]*)/;
        const match = sentence.match(schoolPattern);
        return match ? match[1] : null;
    }
    
    extractGenericFromContext(sentence, subcategory) {
        // 通用提取逻辑
        const words = sentence.split(/[\s，,。；;：:]/);
        return words.find(word => word.length > 2 && word.length < 20) || null;
    }
    
    // 语义分析（使用NLP库）
    semanticAnalysis(text, results) {
        if (!this.nlpLib) return;
        
        try {
            const doc = this.nlpLib(text);
            
            // 提取人名
            const people = doc.people().out('array');
            people.forEach(person => {
                if (person.length >= 2 && person.length <= 4) {
                    results.personal.push({
                        text: person,
                        keyword: 'name',
                        confidence: 0.7,
                        method: 'semantic_analysis',
                        subcategory: 'name',
                        source: 'NLP people extraction'
                    });
                }
            });
            
            // 提取地点
            const places = doc.places().out('array');
            places.forEach(place => {
                if (place.length > 2) {
                    results.personal.push({
                        text: place,
                        keyword: 'address',
                        confidence: 0.6,
                        method: 'semantic_analysis',
                        subcategory: 'address',
                        source: 'NLP places extraction'
                    });
                }
            });
            
            // 提取组织机构
            const organizations = doc.organizations().out('array');
            organizations.forEach(org => {
                if (org.includes('大学') || org.includes('学院')) {
                    results.education.push({
                        text: org,
                        keyword: 'school',
                        confidence: 0.8,
                        method: 'semantic_analysis',
                        subcategory: 'school',
                        source: 'NLP organizations extraction'
                    });
                } else {
                    results.experience.push({
                        text: org,
                        keyword: 'work',
                        confidence: 0.7,
                        method: 'semantic_analysis',
                        subcategory: 'work',
                        source: 'NLP organizations extraction'
                    });
                }
            });
            
        } catch (error) {
            if (this.debugMode) console.warn('语义分析失败:', error);
        }
    }
    
    // 关键词扫描
    keywordScanning(text, results) {
        Object.entries(this.keywordDatabase).forEach(([category, subcategories]) => {
            Object.entries(subcategories).forEach(([subcategory, config]) => {
                if (config.keywords) {
                    config.keywords.forEach(keyword => {
                        if (text.toLowerCase().includes(keyword.toLowerCase())) {
                            // 找到包含该关键词的句子
                            const sentences = this.findSentencesWithKeyword(text, keyword);
                            sentences.forEach(sentence => {
                                results[category].push({
                                    text: sentence,
                                    keyword: keyword,
                                    confidence: this.calculateKeywordConfidence(sentence, keyword),
                                    method: 'keyword_scanning',
                                    subcategory: subcategory,
                                    source: sentence
                                });
                            });
                        }
                    });
                }
            });
        });
    }
    
    // 查找包含关键词的句子
    findSentencesWithKeyword(text, keyword) {
        const sentences = this.splitIntoSentences(text);
        return sentences.filter(sentence => 
            sentence.toLowerCase().includes(keyword.toLowerCase()) &&
            sentence.length >= 5 &&
            sentence.length <= 100
        );
    }
    
    // 智能去重
    intelligentDeduplication(extractedKeywords) {
        const deduped = {};
        let duplicatesRemoved = 0;
        
        Object.keys(extractedKeywords).forEach(category => {
            deduped[category] = [];
            const items = extractedKeywords[category];
            
            // 按置信度排序
            items.sort((a, b) => b.confidence - a.confidence);
            
            items.forEach(item => {
                if (!this.isDuplicate(item, deduped[category])) {
                    deduped[category].push(item);
                } else {
                    duplicatesRemoved++;
                }
            });
        });
        
        if (this.debugMode) {
            console.log(`去重完成，移除 ${duplicatesRemoved} 个重复项`);
        }
        
        return deduped;
    }
    
    // 检查是否重复
    isDuplicate(newItem, existingItems) {
        return existingItems.some(existing => {
            // 文本相似度检查
            const similarity = this.calculateTextSimilarity(newItem.text, existing.text);
            
            // 如果文本相似度高，或者是同一子类别的相似内容
            return similarity > 0.8 || 
                   (newItem.subcategory === existing.subcategory && similarity > 0.6);
        });
    }
    
    // 计算文本相似度
    calculateTextSimilarity(text1, text2) {
        if (!text1 || !text2) return 0;
        
        text1 = text1.toLowerCase().trim();
        text2 = text2.toLowerCase().trim();
        
        if (text1 === text2) return 1;
        
        // 包含关系
        if (text1.includes(text2) || text2.includes(text1)) {
            return 0.9;
        }
        
        // Jaccard相似度计算
        const words1 = new Set(text1.split(/\s+/));
        const words2 = new Set(text2.split(/\s+/));
        
        const intersection = new Set([...words1].filter(x => words2.has(x)));
        const union = new Set([...words1, ...words2]);
        
        return intersection.size / union.size;
    }
    
    // 生成清理后的段落
    generateCleanedSections(originalText, extractedKeywords) {
        const sections = {};
        
        Object.entries(extractedKeywords).forEach(([category, items]) => {
            // 按置信度和位置排序
            const sortedItems = items
                .filter(item => item.confidence > 0.3)
                .sort((a, b) => {
                    if (Math.abs(a.confidence - b.confidence) > 0.1) {
                        return b.confidence - a.confidence;
                    }
                    return (a.position || 0) - (b.position || 0);
                });
            
            const uniqueTexts = [...new Set(sortedItems.map(item => item.text))];
            
            sections[category] = {
                originalCount: items.length,
                cleanedCount: uniqueTexts.length,
                highConfidenceCount: sortedItems.filter(item => item.confidence > 0.7).length,
                items: sortedItems,
                summary: this.generateCategorySummary(category, sortedItems)
            };
        });
        
        return sections;
    }
    
    // 生成类别摘要
    generateCategorySummary(category, items) {
        const highConfidence = items.filter(item => item.confidence > 0.7);
        const mediumConfidence = items.filter(item => item.confidence > 0.4 && item.confidence <= 0.7);
        
        return {
            total: items.length,
            highConfidence: highConfidence.length,
            mediumConfidence: mediumConfidence.length,
            topItems: items.slice(0, 5).map(item => ({
                text: item.text,
                confidence: item.confidence,
                method: item.method
            }))
        };
    }
    
    // 计算各种置信度
    calculatePatternConfidence(match, pattern, patternIndex) {
        let confidence = 0.6; // 基础置信度
        
        // 模式优先级加分（前面的模式通常更准确）
        confidence += (3 - patternIndex) * 0.05;
        
        // 匹配长度加分
        if (match.text.length >= 5 && match.text.length <= 30) {
            confidence += 0.1;
        }
        
        // 包含数字或特殊字符的加分
        if (/\d/.test(match.text)) confidence += 0.05;
        if (/@/.test(match.text)) confidence += 0.2; // 邮箱
        if (/1[3-9]\d{9}/.test(match.text)) confidence += 0.2; // 手机号
        
        // 包含年份信息
        if (/20\d{2}/.test(match.text)) confidence += 0.1;
        
        // 包含等级信息
        if (/[一二三四五六七八九十]等|第[一二三四五六七八九十]名|优秀|特等/.test(match.text)) {
            confidence += 0.15;
        }
        
        return Math.min(confidence, 1.0);
    }
    
    calculateKeywordConfidence(sentence, keyword) {
        let confidence = 0.4; // 基础置信度
        
        // 关键词匹配精确度
        if (sentence.toLowerCase() === keyword.toLowerCase()) {
            confidence += 0.3;
        } else if (sentence.toLowerCase().includes(keyword.toLowerCase())) {
            confidence += 0.2;
        }
        
        // 句子长度适中
        if (sentence.length >= 8 && sentence.length <= 50) {
            confidence += 0.1;
        }
        
        // 包含时间、等级等信息
        if (/20\d{2}|[一二三四五六七八九十]等|获得|荣获|通过|考取/.test(sentence)) {
            confidence += 0.15;
        }
        
        // 包含具体机构或组织
        if (/大学|学院|公司|企业|学校|教育部|团委/.test(sentence)) {
            confidence += 0.1;
        }
        
        return Math.min(confidence, 1.0);
    }
    
    calculateOverallConfidence(extractedKeywords) {
        let totalItems = 0;
        let totalConfidence = 0;
        
        Object.values(extractedKeywords).forEach(items => {
            items.forEach(item => {
                totalItems++;
                totalConfidence += item.confidence;
            });
        });
        
        if (totalItems === 0) return 0;
        
        const averageConfidence = totalConfidence / totalItems;
        
        // 根据提取项目数量调整置信度
        let adjustedConfidence = averageConfidence;
        if (totalItems < 5) {
            adjustedConfidence *= 0.8; // 项目太少，降低置信度
        } else if (totalItems > 20) {
            adjustedConfidence *= 1.1; // 项目充足，略微提高置信度
        }
        
        return Math.min(adjustedConfidence, 1.0);
    }
    
    calculateStats(extractedKeywords) {
        let totalMatches = 0;
        let highConfidenceMatches = 0;
        
        Object.values(extractedKeywords).forEach(items => {
            totalMatches += items.length;
            highConfidenceMatches += items.filter(item => item.confidence > 0.7).length;
        });
        
        return {
            totalMatches,
            highConfidenceMatches,
            coverageScore: this.calculateCoverageScore(extractedKeywords),
            qualityScore: totalMatches > 0 ? highConfidenceMatches / totalMatches : 0
        };
    }
    
    calculateCoverageScore(extractedKeywords) {
        const expectedCategories = ['personal', 'education', 'skills', 'experience', 'achievements'];
        let coveredCategories = 0;
        
        expectedCategories.forEach(category => {
            if (extractedKeywords[category] && extractedKeywords[category].length > 0) {
                coveredCategories++;
            }
        });
        
        return coveredCategories / expectedCategories.length;
    }
    
    // 回退提取方法
    fallbackExtraction(text) {
        return {
            isAIEnhanced: false,
            extractedKeywords: this.basicExtraction(text),
            cleanedSections: {},
            confidence: 0.5,
            stats: { totalMatches: 0, highConfidenceMatches: 0 }
        };
    }
    
    basicExtraction(text) {
        const result = {
            personal: [],
            education: [],
            skills: [],
            experience: [],
            achievements: []
        };
        
        // 基础邮箱提取
        const emailMatches = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g);
        if (emailMatches) {
            emailMatches.forEach(email => {
                result.personal.push({
                    text: email,
                    keyword: 'email',
                    confidence: 0.8,
                    method: 'basic_pattern'
                });
            });
        }
        
        // 基础电话提取
        const phoneMatches = text.match(/1[3-9]\d{9}/g);
        if (phoneMatches) {
            phoneMatches.forEach(phone => {
                result.personal.push({
                    text: phone,
                    keyword: 'phone',
                    confidence: 0.8,
                    method: 'basic_pattern'
                });
            });
        }
        
        // 基础学校提取
        const schoolMatches = text.match(/[^\s\n]*?(?:大学|学院|学校)[^\s\n]*/g);
        if (schoolMatches) {
            schoolMatches.forEach(school => {
                result.education.push({
                    text: school,
                    keyword: 'school',
                    confidence: 0.6,
                    method: 'basic_pattern'
                });
            });
        }
        
        return result;
    }
    
    // UI更新方法
    updateStatus(message, status = 'loading') {
        const statusText = document.getElementById('aiStatusText');
        const statusDisplay = document.getElementById('aiStatusDisplay');
        const aiStatus = document.getElementById('aiStatus');
        
        if (statusText) {
            statusText.textContent = message;
        }
        
        if (statusDisplay) {
            statusDisplay.className = `ai-status-display ${status}`;
            statusDisplay.style.display = this.isEnabled ? 'block' : 'none';
        }
        
        if (aiStatus) {
            const statusMap = {
                'loading': 'AI⌛',
                'ready': 'AI✓',
                'error': 'AI✗',
                'disabled': 'AI-'
            };
            aiStatus.textContent = statusMap[status] || 'AI';
        }
    }
    
    toggleMode() {
        this.isEnabled = !this.isEnabled;
        localStorage.setItem('ai-keyword-enabled', this.isEnabled.toString());
        
        if (this.isEnabled) {
            if (this.isReady) {
                this.updateStatus('AI关键词提取已启用', 'ready');
            } else {
                this.updateStatus('AI关键词提取启用中...', 'loading');
                this.init();
            }
        } else {
            this.updateStatus('AI关键词提取已关闭', 'disabled');
        }
        
        this.updateModeUI();
        return this.isEnabled;
    }
    
    updateModeUI() {
        const aiModeInfo = document.getElementById('aiModeInfo');
        const aiToggle = document.querySelector('.ai-toggle');
        
        if (aiModeInfo) {
            aiModeInfo.style.display = this.isEnabled ? 'block' : 'none';
        }
        
        if (aiToggle) {
            aiToggle.classList.toggle('active', this.isEnabled);
        }
    }
    
    isAvailable() {
        return this.isEnabled && this.isReady;
    }
}

// 全局实例和函数
window.aiKeywordExtractor = new AIKeywordExtractor();

function toggleAIMode() {
    if (window.aiKeywordExtractor) {
        const enabled = window.aiKeywordExtractor.toggleMode();
        if (window.app) {
            window.app.showToast(
                enabled ? 'AI关键词提取已启用 - 智能识别简历关键信息' : 'AI关键词提取已关闭', 
                enabled ? 'success' : 'info',
                3000
            );
        }
    }
}

// 调试函数
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    window.debugAIExtraction = function(text) {
        if (window.aiKeywordExtractor) {
            const result = window.aiKeywordExtractor.extractKeywords(text);
            console.group('🔍 AI关键词提取调试详情');
            console.log('原始文本长度:', text.length);
            console.log('处理时间:', `${result.processingTime?.toFixed(2) || 0}ms`);
            console.log('整体置信度:', `${(result.confidence * 100).toFixed(1)}%`);
            console.log('统计信息:', result.stats);
            console.log('提取结果详情:');
            
            Object.entries(result.extractedKeywords).forEach(([category, items]) => {
                if (items.length > 0) {
                    console.group(`${category} (${items.length}项)`);
                    items.forEach((item, index) => {
                        console.log(`${index + 1}.`, {
                            text: item.text,
                            confidence: `${(item.confidence * 100).toFixed(1)}%`,
                            method: item.method,
                            subcategory: item.subcategory
                        });
                    });
                    console.groupEnd();
                }
            });
            
            console.groupEnd();
            return result;
        }
    };
}
