// AI关键词提取器 - 轻量级NLP实现
class AIKeywordExtractor {
    constructor() {
        this.isEnabled = localStorage.getItem('ai-keyword-enabled') !== 'false';
        this.isReady = false;
        this.nlpLib = null;
        
        // 关键词库和权重
        this.keywordCategories = {
            education: {
                keywords: ['大学', '学院', '本科', '硕士', '博士', '毕业', '专业', '学位', 'GPA', '绩点', '成绩', '奖学金'],
                weight: 1.0
            },
            experience: {
                keywords: ['实习', '工作', '项目', '开发', '负责', '完成', '参与', '设计', '实现', '优化', '维护'],
                weight: 1.2
            },
            skills: {
                keywords: ['Java', 'Python', 'JavaScript', 'React', 'Vue', 'MySQL', 'Git', 'Linux', '技能', '熟练', '精通', '掌握'],
                weight: 1.1
            },
            achievements: {
                keywords: ['奖励', '荣誉', '获得', '证书', '竞赛', '比赛', '获奖', '认证', '资格'],
                weight: 1.3
            },
            personal: {
                keywords: ['姓名', '电话', '邮箱', '地址', '微信', 'QQ', '性别', '年龄', '出生'],
                weight: 0.8
            }
        };
        
        this.init();
    }
    
    async init() {
        try {
            this.updateStatus('正在初始化AI关键词提取器...');
            
            // 检查NLP库是否加载
            if (typeof nlp !== 'undefined') {
                this.nlpLib = nlp;
                this.isReady = true;
                this.updateStatus('AI关键词提取准备就绪', 'ready');
                console.log('AI关键词提取器初始化成功');
            } else {
                console.warn('NLP库未加载，使用传统方法');
                this.updateStatus('NLP库未加载，使用传统识别', 'disabled');
            }
        } catch (error) {
            console.error('AI关键词提取器初始化失败:', error);
            this.updateStatus('AI初始化失败', 'error');
        }
    }
    
    // 智能关键词提取
    extractKeywords(text) {
        if (!this.isEnabled) {
            return this.fallbackExtraction(text);
        }
        
        try {
            const result = {
                isAIEnhanced: true,
                extractedKeywords: {},
                cleanedSections: {},
                confidence: 0
            };
            
            if (this.isReady && this.nlpLib) {
                // 使用NLP库进行智能提取
                result.extractedKeywords = this.nlpExtraction(text);
                result.cleanedSections = this.sectionCleaning(text, result.extractedKeywords);
                result.confidence = this.calculateConfidence(result.extractedKeywords);
            } else {
                // 回退到增强的正则表达式提取
                result.extractedKeywords = this.enhancedRegexExtraction(text);
                result.cleanedSections = this.sectionCleaning(text, result.extractedKeywords);
                result.confidence = 0.7; // 传统方法置信度
            }
            
            console.log('AI关键词提取结果:', result);
            return result;
            
        } catch (error) {
            console.error('关键词提取失败:', error);
            return this.fallbackExtraction(text);
        }
    }
    
    // NLP库智能提取
    nlpExtraction(text) {
        const doc = this.nlpLib(text);
        const extractedKeywords = {};
        
        Object.entries(this.keywordCategories).forEach(([category, config]) => {
            extractedKeywords[category] = [];
            
            // 使用NLP库的实体识别和词性标注
            const sentences = doc.sentences().out('array');
            
            sentences.forEach(sentence => {
                const sentenceDoc = this.nlpLib(sentence);
                
                // 检查句子是否包含该类别的关键词
                const hasKeyword = config.keywords.some(keyword => 
                    sentence.toLowerCase().includes(keyword.toLowerCase())
                );
                
                if (hasKeyword) {
                    // 提取名词和关键实体
                    const nouns = sentenceDoc.nouns().out('array');
                    const people = sentenceDoc.people().out('array');
                    const places = sentenceDoc.places().out('array');
                    const organizations = sentenceDoc.organizations().out('array');
                    
                    extractedKeywords[category].push({
                        sentence: sentence.trim(),
                        nouns: nouns,
                        entities: [...people, ...places, ...organizations],
                        confidence: this.calculateSentenceConfidence(sentence, config.keywords)
                    });
                }
            });
        });
        
        return extractedKeywords;
    }
    
    // 增强的正则表达式提取（回退方案）
    enhancedRegexExtraction(text) {
        const extractedKeywords = {};
        
        Object.entries(this.keywordCategories).forEach(([category, config]) => {
            extractedKeywords[category] = [];
            
            config.keywords.forEach(keyword => {
                // 使用更智能的正则表达式
                const pattern = new RegExp(`([^。\\n]*${keyword}[^。\\n]*)`, 'gi');
                const matches = text.match(pattern);
                
                if (matches) {
                    matches.forEach(match => {
                        const cleaned = match.trim();
                        if (cleaned.length > 3 && cleaned.length < 200) {
                            extractedKeywords[category].push({
                                sentence: cleaned,
                                keyword: keyword,
                                confidence: this.calculateSentenceConfidence(cleaned, [keyword])
                            });
                        }
                    });
                }
            });
        });
        
        return extractedKeywords;
    }
    
    // 段落清理和去重
    sectionCleaning(originalText, extractedKeywords) {
        const cleanedSections = {};
        
        Object.entries(extractedKeywords).forEach(([category, items]) => {
            const sentences = items.map(item => item.sentence || item);
            
            // 去重和清理
            const uniqueSentences = [...new Set(sentences)]
                .filter(sentence => sentence && sentence.length > 10)
                .map(sentence => this.cleanSentence(sentence));
            
            cleanedSections[category] = {
                originalCount: items.length,
                cleanedCount: uniqueSentences.length,
                sentences: uniqueSentences,
                keywords: this.extractKeywordsFromSentences(uniqueSentences, category)
            };
        });
        
        return cleanedSections;
    }
    
    // 句子清理
    cleanSentence(sentence) {
        return sentence
            .replace(/\s+/g, ' ')
            .replace(/[^\u4e00-\u9fa5\u0030-\u0039\u0041-\u005a\u0061-\u007a\s\.\,\;\:\!\?\-\(\)]/g, '')
            .trim();
    }
    
    // 从句子中提取关键词
    extractKeywordsFromSentences(sentences, category) {
        const keywords = new Set();
        const categoryConfig = this.keywordCategories[category];
        
        sentences.forEach(sentence => {
            categoryConfig.keywords.forEach(keyword => {
                if (sentence.toLowerCase().includes(keyword.toLowerCase())) {
                    keywords.add(keyword);
                }
            });
            
            // 使用简单的词频分析提取额外关键词
            if (this.isReady && this.nlpLib) {
                const doc = this.nlpLib(sentence);
                const importantWords = doc.nouns().out('array')
                    .filter(word => word.length > 2)
                    .slice(0, 3);
                importantWords.forEach(word => keywords.add(word));
            }
        });
        
        return Array.from(keywords);
    }
    
    // 计算置信度
    calculateConfidence(extractedKeywords) {
        let totalItems = 0;
        let totalConfidence = 0;
        
        Object.values(extractedKeywords).forEach(items => {
            items.forEach(item => {
                totalItems++;
                totalConfidence += item.confidence || 0.5;
            });
        });
        
        return totalItems > 0 ? totalConfidence / totalItems : 0;
    }
    
    // 计算句子置信度
    calculateSentenceConfidence(sentence, keywords) {
        const matchCount = keywords.filter(keyword => 
            sentence.toLowerCase().includes(keyword.toLowerCase())
        ).length;
        
        const lengthScore = Math.min(sentence.length / 50, 1); // 长度适中得分高
        const keywordScore = Math.min(matchCount / keywords.length * 2, 1); // 关键词匹配度
        
        return (lengthScore + keywordScore) / 2;
    }
    
    // 回退提取方法
    fallbackExtraction(text) {
        return {
            isAIEnhanced: false,
            extractedKeywords: this.enhancedRegexExtraction(text),
            cleanedSections: {},
            confidence: 0.6
        };
    }
    
    // 更新UI状态
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
                'loading': 'AI',
                'ready': 'AI✓',
                'error': 'AI✗',
                'disabled': 'AI-'
            };
            aiStatus.textContent = statusMap[status] || 'AI';
        }
    }
    
    // 切换AI模式
    toggleMode() {
        this.isEnabled = !this.isEnabled;
        localStorage.setItem('ai-keyword-enabled', this.isEnabled.toString());
        
        if (this.isEnabled) {
            if (this.isReady) {
                this.updateStatus('AI关键词提取已启用', 'ready');
            } else {
                this.updateStatus('AI关键词提取已启用（传统模式）', 'loading');
            }
        } else {
            this.updateStatus('AI关键词提取已关闭', 'disabled');
        }
        
        this.updateModeUI();
        return this.isEnabled;
    }
    
    // 更新模式UI
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
    
    // 检查是否可用
    isAvailable() {
        return this.isEnabled && (this.isReady || true); // 即使NLP库未加载也可用传统方法
    }
}

// 全局实例
window.aiKeywordExtractor = new AIKeywordExtractor();

// 全局函数
function toggleAIMode() {
    if (window.aiKeywordExtractor) {
        const enabled = window.aiKeywordExtractor.toggleMode();
        if (window.app) {
            window.app.showToast(
                enabled ? 'AI关键词提取已启用' : 'AI关键词提取已关闭', 
                enabled ? 'success' : 'info'
            );
        }
    }
}
