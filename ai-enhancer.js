// AI增强器 - 客户端AI模型实现
class AIEnhancer {
    constructor() {
        this.model = null;
        this.isLoading = false;
        this.isEnabled = localStorage.getItem('ai-mode-enabled') !== 'false'; // 默认启用
        this.loadingProgress = 0;
        
        // 预定义的语义模板和权重
        this.semanticTemplates = {
            education: {
                keywords: ['大学', '学院', '本科', '硕士', '博士', '毕业', '专业', '学位', 'university', 'college', 'bachelor', 'master', 'phd'],
                weight: 0.8,
                contexts: ['教育背景', '学历信息', '教育经历']
            },
            experience: {
                keywords: ['实习', '工作', '项目', '开发', '负责', '完成', '参与', 'internship', 'work', 'project', 'develop'],
                weight: 0.9,
                contexts: ['工作经历', '实习经历', '项目经验']
            },
            skills: {
                keywords: ['技能', '熟练', '精通', '掌握', '使用', 'skills', 'proficient', 'experienced'],
                weight: 0.7,
                contexts: ['技能清单', '专业技能', '技术能力']
            },
            achievements: {
                keywords: ['奖励', '荣誉', '获得', '证书', '竞赛', '奖学金', 'award', 'honor', 'certificate'],
                weight: 0.8,
                contexts: ['获奖情况', '荣誉奖励', '证书认证']
            }
        };
        
        // 初始化
        this.init();
    }
    
    async init() {
        this.updateAIStatus('正在初始化AI引擎...');
        
        // 检查TensorFlow.js是否加载
        if (typeof tf === 'undefined') {
            console.warn('TensorFlow.js未加载，AI功能将不可用');
            this.updateAIStatus('AI模型不可用', 'error');
            return;
        }
        
        // 预加载模型（如果启用了AI模式）
        if (this.isEnabled) {
            await this.loadModel();
        } else {
            this.updateAIStatus('AI模式已关闭', 'disabled');
        }
    }
    
    async loadModel() {
        if (this.model || this.isLoading) return this.model;
        
        this.isLoading = true;
        this.updateAIStatus('正在加载AI模型...', 'loading');
        
        try {
            // 显示加载进度
            this.showLoadingProgress();
            
            // 模拟加载进度更新
            const progressInterval = setInterval(() => {
                this.loadingProgress += Math.random() * 20;
                if (this.loadingProgress > 90) {
                    this.loadingProgress = 90;
                }
                this.updateLoadingProgress(this.loadingProgress);
            }, 500);
            
            // 加载Universal Sentence Encoder模型
            console.log('开始加载Universal Sentence Encoder模型...');
            this.model = await use.load();
            
            // 清除进度定时器
            clearInterval(progressInterval);
            this.updateLoadingProgress(100);
            
            console.log('AI模型加载成功');
            this.updateAIStatus('AI模型就绪', 'ready');
            
            // 隐藏加载进度
            setTimeout(() => {
                this.hideLoadingProgress();
            }, 1000);
            
            return this.model;
            
        } catch (error) {
            console.error('AI模型加载失败:', error);
            this.updateAIStatus('AI模型加载失败', 'error');
            this.hideLoadingProgress();
            throw error;
        } finally {
            this.isLoading = false;
        }
    }
    
    async enhanceResumeAnalysis(text) {
        if (!this.isEnabled || !this.model) {
            console.log('AI模式未启用或模型未加载，使用传统分析');
            return null;
        }
        
        try {
            console.log('开始AI增强分析...');
            
            // 文本预处理
            const preprocessedText = this.preprocessText(text);
            
            // 分句处理
            const sentences = this.splitIntoSentences(preprocessedText);
            
            if (sentences.length === 0) {
                throw new Error('没有找到有效的句子');
            }
            
            // 生成句子嵌入
            console.log(`正在为 ${sentences.length} 个句子生成嵌入向量...`);
            const embeddings = await this.model.embed(sentences);
            
            // 语义分类
            const categorized = await this.categorizeContent(sentences, embeddings);
            
            // 提取结构化信息
            const structuredData = this.extractStructuredInfo(categorized, text);
            
            console.log('AI分析完成:', structuredData);
            
            return {
                isAIEnhanced: true,
                categorized: categorized,
                structured: structuredData,
                confidence: this.calculateConfidence(categorized),
                aiAnalysisTime: Date.now()
            };
            
        } catch (error) {
            console.error('AI增强分析失败:', error);
            return null;
        }
    }
    
    preprocessText(text) {
        return text
            .replace(/\s+/g, ' ')  // 标准化空白字符
            .replace(/[^\u4e00-\u9fa5\u0030-\u0039\u0041-\u005a\u0061-\u007a\s\.\,\;\:\!\?\-\(\)]/g, '') // 保留中英文、数字、基本标点
            .trim();
    }
    
    splitIntoSentences(text) {
        // 智能分句，考虑中英文标点
        const sentences = text
            .split(/[。！？；\.\!\?;]/)
            .map(s => s.trim())
            .filter(s => s.length > 3 && s.length < 200) // 过滤过短或过长的句子
            .slice(0, 50); // 限制句子数量以提高性能
        
        console.log(`分割出 ${sentences.length} 个有效句子`);
        return sentences;
    }
    
    async categorizeContent(sentences, embeddings) {
        const categories = {
            education: [],
            experience: [],
            skills: [],
            achievements: [],
            personal: [],
            other: []
        };
        
        // 获取嵌入向量数据
        const embeddingData = await embeddings.data();
        const embeddingSize = embeddingData.length / sentences.length;
        
        // 为每个句子分类
        for (let i = 0; i < sentences.length; i++) {
            const sentence = sentences[i];
            const sentenceEmbedding = embeddingData.slice(i * embeddingSize, (i + 1) * embeddingSize);
            
            const category = this.classifySentence(sentence, sentenceEmbedding);
            categories[category].push({
                text: sentence,
                embedding: sentenceEmbedding,
                confidence: this.calculateSentenceConfidence(sentence, category)
            });
        }
        
        // 清理嵌入张量
        embeddings.dispose();
        
        return categories;
    }
    
    classifySentence(sentence, embedding) {
        const scores = {};
        
        // 基于关键词的初始分类
        Object.entries(this.semanticTemplates).forEach(([category, template]) => {
            let keywordScore = 0;
            
            template.keywords.forEach(keyword => {
                if (sentence.toLowerCase().includes(keyword.toLowerCase())) {
                    keywordScore += template.weight;
                }
            });
            
            // 上下文匹配加分
            template.contexts.forEach(context => {
                if (sentence.includes(context)) {
                    keywordScore += 0.5;
                }
            });
            
            scores[category] = keywordScore;
        });
        
        // 特殊规则
        if (sentence.match(/\d{11}|[\w\.-]+@[\w\.-]+|微信|QQ/)) {
            scores.personal = (scores.personal || 0) + 1;
        }
        
        // 返回得分最高的类别
        const maxCategory = Object.entries(scores).reduce((a, b) => 
            scores[a[0]] > scores[b[0]] ? a : b
        );
        
        return maxCategory[1] > 0 ? maxCategory[0] : 'other';
    }
    
    calculateSentenceConfidence(sentence, category) {
        const template = this.semanticTemplates[category];
        if (!template) return 0.5;
        
        const keywordMatches = template.keywords.filter(keyword => 
            sentence.toLowerCase().includes(keyword.toLowerCase())
        ).length;
        
        return Math.min(keywordMatches / template.keywords.length * 2, 1);
    }
    
    extractStructuredInfo(categorized, originalText) {
        const structured = {
            personalInfo: this.extractPersonalInfo(categorized.personal, originalText),
            education: this.extractEducationInfo(categorized.education),
            experience: this.extractExperienceInfo(categorized.experience),
            skills: this.extractSkillsInfo(categorized.skills),
            achievements: this.extractAchievementsInfo(categorized.achievements)
        };
        
        return structured;
    }
    
    extractPersonalInfo(personalSentences, fullText) {
        const info = {};
        
        // 提取邮箱
        const emailMatch = fullText.match(/[\w\.-]+@[\w\.-]+\.\w+/);
        if (emailMatch) info.email = emailMatch[0];
        
        // 提取手机号
        const phoneMatch = fullText.match(/1[3-9]\d{9}/);
        if (phoneMatch) info.phone = phoneMatch[0];
        
        // 提取姓名（简单启发式）
        const nameMatch = fullText.match(/姓名[：:]\s*([^\s\n]{2,4})/);
        if (nameMatch) info.name = nameMatch[1];
        
        return info;
    }
    
    extractEducationInfo(educationSentences) {
        const educationList = [];
        
        educationSentences.forEach(sentenceObj => {
            const sentence = sentenceObj.text;
            
            // 提取学校
            const schoolMatch = sentence.match(/([^\s]{2,15}(?:大学|学院|学校))/);
            
            // 提取学位
            const degreeMatch = sentence.match(/(本科|硕士|博士|学士|硕士研究生|博士研究生)/);
            
            // 提取专业
            const majorMatch = sentence.match(/专业[：:]?\s*([^\s\n]{2,20})/);
            
            if (schoolMatch || degreeMatch) {
                educationList.push({
                    school: schoolMatch ? schoolMatch[1] : '',
                    degree: degreeMatch ? degreeMatch[1] : '',
                    major: majorMatch ? majorMatch[1] : '',
                    confidence: sentenceObj.confidence,
                    originalText: sentence
                });
            }
        });
        
        return educationList;
    }
    
    extractExperienceInfo(experienceSentences) {
        const experienceList = [];
        
        experienceSentences.forEach(sentenceObj => {
            const sentence = sentenceObj.text;
            
            // 提取公司
            const companyMatch = sentence.match(/([^\s]{2,20}(?:公司|企业|集团|科技|有限公司))/);
            
            // 提取职位
            const positionMatch = sentence.match(/(实习生|工程师|开发|设计师|分析师|助理|专员)/);
            
            // 提取时间
            const timeMatch = sentence.match(/(20\d{2}[年\-\.]*\d{1,2}?[月]?)/);
            
            if (companyMatch || positionMatch) {
                experienceList.push({
                    company: companyMatch ? companyMatch[1] : '',
                    position: positionMatch ? positionMatch[1] : '',
                    time: timeMatch ? timeMatch[1] : '',
                    confidence: sentenceObj.confidence,
                    originalText: sentence
                });
            }
        });
        
        return experienceList;
    }
    
    extractSkillsInfo(skillsSentences) {
        const skillsList = [];
        const technicalSkills = ['Java', 'Python', 'JavaScript', 'React', 'Vue', 'Node.js', 'MySQL', 'Git'];
        
        skillsSentences.forEach(sentenceObj => {
            const sentence = sentenceObj.text;
            
            technicalSkills.forEach(skill => {
                if (sentence.toLowerCase().includes(skill.toLowerCase())) {
                    skillsList.push({
                        skill: skill,
                        context: sentence,
                        confidence: sentenceObj.confidence
                    });
                }
            });
        });
        
        return skillsList;
    }
    
    extractAchievementsInfo(achievementsSentences) {
        const achievementsList = [];
        
        achievementsSentences.forEach(sentenceObj => {
            const sentence = sentenceObj.text;
            
            // 提取奖项
            const awardMatch = sentence.match(/(奖学金|奖|荣誉|证书|竞赛)/);
            
            if (awardMatch) {
                achievementsList.push({
                    type: awardMatch[1],
                    description: sentence,
                    confidence: sentenceObj.confidence
                });
            }
        });
        
        return achievementsList;
    }
    
    calculateConfidence(categorized) {
        const totalSentences = Object.values(categorized).reduce((sum, cat) => sum + cat.length, 0);
        if (totalSentences === 0) return 0;
        
        const weightedConfidence = Object.entries(categorized).reduce((sum, [category, sentences]) => {
            const categoryConfidence = sentences.reduce((catSum, sentence) => catSum + sentence.confidence, 0);
            return sum + categoryConfidence;
        }, 0);
        
        return Math.min(weightedConfidence / totalSentences, 1);
    }
    
    // UI更新方法
    updateAIStatus(message, status = 'loading') {
        const statusText = document.getElementById('aiStatusText');
        const statusDisplay = document.getElementById('aiStatusDisplay');
        const aiStatus = document.getElementById('aiStatus');
        
        if (statusText) {
            statusText.textContent = message;
        }
        
        if (statusDisplay) {
            statusDisplay.className = `ai-status-display ${status}`;
        }
        
        if (aiStatus) {
            const statusMap = {
                'loading': 'AI加载中',
                'ready': 'AI就绪',
                'error': 'AI错误',
                'disabled': 'AI关闭'
            };
            aiStatus.textContent = statusMap[status] || 'AI';
        }
    }
    
    showLoadingProgress() {
        const progressElement = document.getElementById('aiLoadingProgress');
        if (progressElement) {
            progressElement.style.display = 'block';
        }
    }
    
    hideLoadingProgress() {
        const progressElement = document.getElementById('aiLoadingProgress');
        if (progressElement) {
            progressElement.style.display = 'none';
        }
    }
    
    updateLoadingProgress(progress) {
        const progressFill = document.getElementById('aiProgressFill');
        const progressText = document.getElementById('aiProgressText');
        
        if (progressFill) {
            progressFill.style.width = `${progress}%`;
        }
        
        if (progressText) {
            if (progress < 30) {
                progressText.textContent = '正在初始化AI引擎...';
            } else if (progress < 60) {
                progressText.textContent = '正在下载模型文件...';
            } else if (progress < 90) {
                progressText.textContent = '正在编译模型...';
            } else {
                progressText.textContent = 'AI模型加载完成！';
            }
        }
    }
    
    // 公共方法
    isAIEnabled() {
        return this.isEnabled && this.model !== null;
    }
    
    toggleAIMode() {
        this.isEnabled = !this.isEnabled;
        localStorage.setItem('ai-mode-enabled', this.isEnabled.toString());
        
        if (this.isEnabled && !this.model) {
            this.loadModel();
        } else if (!this.isEnabled) {
            this.updateAIStatus('AI模式已关闭', 'disabled');
        }
        
        this.updateAIModeUI();
        return this.isEnabled;
    }
    
    updateAIModeUI() {
        const aiModeInfo = document.getElementById('aiModeInfo');
        const aiToggle = document.querySelector('.ai-toggle');
        
        if (aiModeInfo) {
            aiModeInfo.style.display = this.isEnabled ? 'block' : 'none';
        }
        
        if (aiToggle) {
            aiToggle.classList.toggle('active', this.isEnabled);
        }
    }
}

// 全局实例
window.aiEnhancer = new AIEnhancer();

// 全局函数
function toggleAIMode() {
    if (window.aiEnhancer) {
        const enabled = window.aiEnhancer.toggleAIMode();
        if (window.app) {
            window.app.showToast(
                enabled ? 'AI智能模式已启用' : 'AI模式已关闭', 
                enabled ? 'success' : 'info'
            );
        }
    }
}
