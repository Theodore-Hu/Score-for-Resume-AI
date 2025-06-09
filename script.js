// 在 script.js 开头添加
// 抑制AudioContext错误（通常由浏览器扩展引起）
window.addEventListener('error', function(e) {
    if (e.message && e.message.includes('AudioContext')) {
        e.preventDefault();
        return false;
    }
});

// 应用程序主类 - AI关键词提取版
class ResumeScoreApp {
    constructor() {
        this.currentAnalysis = null;
        this.isDarkTheme = localStorage.getItem('theme') === 'dark';
        this.isProcessing = false;
        this.eventListeners = new Map();
        this.aiKeywordExtractor = window.aiKeywordExtractor;
        
        this.initializeApp();
    }
    
    initializeApp() {
        this.setupTheme();
        this.setupEventListeners();
        this.setupKeyboardShortcuts();
        this.updateCharacterCount();
        this.setupAIFeatures();
    }
    
    setupAIFeatures() {
        this.updateAIModeUI();
        
        // 监听AI状态变化
        if (this.aiKeywordExtractor) {
            this.aiKeywordExtractor.updateModeUI = () => {
                this.updateAIModeUI();
            };
        }
    }
    
    updateAIModeUI() {
        const aiModeInfo = document.getElementById('aiModeInfo');
        const aiToggle = document.querySelector('.ai-toggle');
        const analyzeBtn = document.querySelector('.analyze-btn');
        
        const isAIEnabled = this.aiKeywordExtractor && this.aiKeywordExtractor.isEnabled;
        
        if (aiModeInfo) {
            aiModeInfo.style.display = isAIEnabled ? 'block' : 'none';
        }
        
        if (aiToggle) {
            aiToggle.classList.toggle('active', isAIEnabled);
        }
        
        if (analyzeBtn) {
            const btnText = analyzeBtn.querySelector('.btn-text');
            const btnIcon = analyzeBtn.querySelector('.btn-icon');
            if (btnText && btnIcon) {
                if (isAIEnabled) {
                    btnText.textContent = 'AI智能分析';
                    btnIcon.textContent = '🔍';
                } else {
                    btnText.textContent = '开始分析';
                    btnIcon.textContent = '📊';
                }
            }
        }
    }
    
    setupTheme() {
        if (this.isDarkTheme) {
            document.body.classList.add('dark-theme');
            document.querySelector('.theme-icon').textContent = '☀️';
        }
    }
    
    setupEventListeners() {
        const uploadArea = document.getElementById('uploadArea');
        const fileInput = document.getElementById('fileInput');
        const textarea = document.getElementById('resumeText');
        
        const dragEvents = {
            dragover: (e) => {
                e.preventDefault();
                uploadArea.classList.add('dragover');
            },
            dragleave: (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
            },
            drop: (e) => {
                e.preventDefault();
                uploadArea.classList.remove('dragover');
                const files = e.dataTransfer.files;
                if (files.length > 0) {
                    this.handleFileUpload(files[0]);
                }
            }
        };
        
        Object.entries(dragEvents).forEach(([event, handler]) => {
            uploadArea.addEventListener(event, handler);
            this.eventListeners.set(`uploadArea-${event}`, { element: uploadArea, event, handler });
        });
        
        const fileChangeHandler = (e) => {
            if (e.target.files.length > 0) {
                this.handleFileUpload(e.target.files[0]);
            }
        };
        fileInput.addEventListener('change', fileChangeHandler);
        this.eventListeners.set('fileInput-change', { element: fileInput, event: 'change', handler: fileChangeHandler });
        
        const textInputHandler = this.debounce(() => {
            this.checkTextInput();
            this.updateCharacterCount();
        }, 300);
        
        textarea.addEventListener('input', textInputHandler);
        this.eventListeners.set('textarea-input', { element: textarea, event: 'input', handler: textInputHandler });
        
        const pasteHandler = (e) => {
            setTimeout(() => {
                this.checkTextInput();
                this.updateCharacterCount();
            }, 0);
        };
        textarea.addEventListener('paste', pasteHandler);
        this.eventListeners.set('textarea-paste', { element: textarea, event: 'paste', handler: pasteHandler });
    }
    
    setupKeyboardShortcuts() {
        const keydownHandler = (e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'u') {
                e.preventDefault();
                document.getElementById('fileInput').click();
            }
            
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
                e.preventDefault();
                if (!document.querySelector('.analyze-btn').disabled) {
                    this.analyzeResume();
                }
            }
            
            if ((e.ctrlKey || e.metaKey) && e.key === 'e') {
                e.preventDefault();
                if (this.currentAnalysis) {
                    this.exportResults();
                }
            }
            
            if (e.key === 'F1') {
                e.preventDefault();
                this.toggleKeyboardShortcuts();
            }
            
            if (e.key === 'Escape') {
                this.closeModals();
            }
            
            if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
                e.preventDefault();
                this.toggleAIMode();
            }
        };
        document.addEventListener('keydown', keydownHandler);
        this.eventListeners.set('document-keydown', { element: document, event: 'keydown', handler: keydownHandler });
    }
    
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func.apply(this, args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    updateCharacterCount() {
        const textarea = document.getElementById('resumeText');
        const charCount = document.getElementById('charCount');
        const count = textarea.value.length;
        
        charCount.textContent = `${count} 字符`;
        
        if (count > 2000) {
            charCount.style.color = '#48bb78';
        } else if (count > 500) {
            charCount.style.color = '#ed8936';
        } else {
            charCount.style.color = '#666';
        }
    }
    
    checkTextInput() {
        const text = document.getElementById('resumeText').value.trim();
        const analyzeBtn = document.querySelector('.analyze-btn');
        
        if (text.length > 100) {
            analyzeBtn.style.background = this.aiKeywordExtractor && this.aiKeywordExtractor.isEnabled ? 
                'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' : 
                '#48bb78';
            analyzeBtn.disabled = false;
        } else {
            analyzeBtn.style.background = '#ccc';
            analyzeBtn.disabled = true;
        }
    }
    
    async handleFileUpload(file) {
        if (this.isProcessing) {
            this.showToast('正在处理文件，请稍候...', 'info');
            return;
        }
        
        const validation = this.validateFile(file);
        if (!validation.valid) {
            this.showToast(validation.message, 'error');
            return;
        }
        
        this.isProcessing = true;
        const isAIMode = this.aiKeywordExtractor && this.aiKeywordExtractor.isEnabled;
        const loadingMessage = isAIMode ? '正在解析文件 (AI关键词提取)...' : '正在解析文件...';
        this.showLoading(loadingMessage);
        
        try {
            const startTime = performance.now();
            const text = await ResumeParser.parseFile(file);
            
            if (text.trim().length < 50) {
                throw new Error('文件内容过少，请检查文件是否正确');
            }
            
            document.getElementById('resumeText').value = text;
            this.updateCharacterCount();
            this.checkTextInput();
            
            this.hideLoading();
            
            const processingTime = performance.now() - startTime;
            console.log(`File processing time: ${processingTime.toFixed(2)}ms`);
            
            const successMessage = isAIMode ? '文件解析成功！(AI关键词已优化)' : '文件解析成功！';
            this.showToast(successMessage, 'success');
            
            setTimeout(() => {
                this.analyzeResume();
            }, 500);
        } catch (error) {
            this.hideLoading();
            this.handleError(error, 'handleFileUpload');
        } finally {
            this.isProcessing = false;
        }
    }
    
    validateFile(file) {
        if (file.size > 10 * 1024 * 1024) {
            return { valid: false, message: '文件大小超过10MB限制' };
        }
        
        if (file.size < 1024) {
            return { valid: false, message: '文件太小，可能不是有效的简历文件' };
        }
        
        const allowedTypes = [
            'application/pdf',
            'application/msword',
            'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
        ];
        
        const fileName = file.name.toLowerCase();
        const isValidType = allowedTypes.includes(file.type) || 
                           fileName.endsWith('.pdf') || 
                           fileName.endsWith('.doc') || 
                           fileName.endsWith('.docx');
        
        if (!isValidType) {
            return { valid: false, message: '请上传PDF或Word格式的文件' };
        }
        
        return { valid: true };
    }
    
    async analyzeResume() {
        if (this.isProcessing) {
            this.showToast('正在处理中，请稍候...', 'info');
            return;
        }
        
        const text = document.getElementById('resumeText').value.trim();
        if (text.length < 50) {
            this.showToast('简历内容过少，请输入完整的简历信息', 'warning');
            return;
        }
        
        this.isProcessing = true;
        
        const isAIMode = this.aiKeywordExtractor && this.aiKeywordExtractor.isEnabled;
        const loadingMessage = isAIMode ? '正在进行AI关键词提取分析...' : '正在分析简历...';
        this.showLoading(loadingMessage);
        
        try {
            const startTime = performance.now();
            
            // 模拟处理时间
            const processingTime = isAIMode ? 2000 : 1500;
            await new Promise(resolve => setTimeout(resolve, processingTime));
            
            // 使用优化后的评分器
            const scorer = new ResumeScorer();
            const result = scorer.scoreResume(text);
            
            const analysisTime = performance.now() - startTime;
            console.log(`Analysis time: ${analysisTime.toFixed(2)}ms`);
            
            this.hideLoading();
            this.displayResults(result);
            
            const successMessage = result.analysis.aiEnhanced ? 
                `AI关键词提取分析完成！(置信度: ${Math.round(result.analysis.aiConfidence * 100)}%)` : 
                '简历分析完成！';
            this.showToast(successMessage, 'success');
            
        } catch (error) {
            this.hideLoading();
            this.handleError(error, 'analyzeResume');
        } finally {
            this.isProcessing = false;
        }
    }
    
    handleError(error, context = 'Unknown') {
        console.error(`Error in ${context}:`, error);
        
        let message = '发生了一个错误，请重试';
        
        if (error.name === 'NetworkError') {
            message = '网络连接问题，请检查网络后重试';
        } else if (error.name === 'TypeError') {
            message = '数据处理错误，请刷新页面重试';
        } else if (error.message.includes('memory')) {
            message = '内存不足，请尝试上传更小的文件';
        } else if (error.message) {
            message = error.message;
        }
        
        this.showToast(message, 'error');
        this.hideLoading();
        this.isProcessing = false;
    }
    
    displayResults(result) {
        this.currentAnalysis = result;
        
        const resultSection = document.getElementById('resultSection');
        resultSection.style.display = 'block';
        resultSection.scrollIntoView({ behavior: 'smooth' });
        
        this.updateAIAnalysisBadge(result);
        this.updateTotalScore(result);
        this.updateDetailedScores(result.categoryScores, result.specializations);
        this.updateJobRecommendations(result.jobRecommendations);
        this.updateSuggestions(result.suggestions);
        
        setTimeout(() => {
            this.animateScoreItems();
        }, 500);
    }
    
    updateAIAnalysisBadge(result) {
        const aiAnalysisBadge = document.getElementById('aiAnalysisBadge');
        if (aiAnalysisBadge) {
            if (result.analysis.aiEnhanced) {
                aiAnalysisBadge.style.display = 'flex';
                const badgeText = aiAnalysisBadge.querySelector('.ai-badge-text');
                if (badgeText) {
                    badgeText.textContent = `AI关键词提取完成 (置信度: ${Math.round(result.analysis.aiConfidence * 100)}%)`;
                }
            } else {
                aiAnalysisBadge.style.display = 'none';
            }
        }
    }
    
    updateTotalScore(result) {
        if (!result || typeof result.totalScore !== 'number') {
            console.error('Invalid result data:', result);
            this.showToast('数据错误，请重新分析', 'error');
            return;
        }
        
        const scoreElement = document.getElementById('totalScore');
        const levelElement = document.getElementById('scoreLevel');
        const summaryElement = document.getElementById('scoreSummary');
        const circleElement = document.getElementById('scoreCircle');
        
        if (!scoreElement || !levelElement || !summaryElement || !circleElement) {
            console.error('Required DOM elements not found');
            return;
        }
        
        const baseScore = result.baseScore;
        const bonus = result.specializationBonus || 0;
        const totalScore = result.totalScore;
        
        // 清理所有可能存在的专精信息显示
        const container = document.querySelector('.score-overview');
        const existingSpecInfos = container.querySelectorAll(
            '.specialization-info, .specialization-info-separate'
        );
        existingSpecInfos.forEach(el => el.remove());
        
        scoreElement.innerHTML = '';
        scoreElement.className = 'score-number';
        
        if (bonus > 0) {
            scoreElement.innerHTML = `
                <div class="total-score-main">${totalScore}</div>
                <div class="score-breakdown-compact">
                    <span class="base-part">${baseScore}</span>
                    <span class="plus-sign">+</span>
                    <span class="bonus-part">${bonus}</span>
                </div>
            `;
        } else {
            scoreElement.innerHTML = `
                <div class="total-score-main">${totalScore}</div>
            `;
        }
        
        const basePercentage = Math.min((baseScore / 100) * 360, 360);
        
        const existingElements = circleElement.querySelectorAll('.bonus-ring, .specialization-info');
        existingElements.forEach(el => el.remove());
        
        if (bonus > 0) {
            circleElement.style.background = `conic-gradient(
                #48bb78 0deg, 
                #48bb78 ${basePercentage}deg,
                #f0f0f0 ${basePercentage}deg
            )`;
            
            circleElement.style.boxShadow = `
                0 0 20px rgba(102, 126, 234, 0.3),
                0 0 40px rgba(102, 126, 234, 0.1),
                inset 0 0 0 3px rgba(102, 126, 234, 0.2)
            `;
            
            circleElement.classList.add('excellent-plus');
        } else {
            const color = this.getScoreColor(baseScore);
            circleElement.style.background = `conic-gradient(${color} 0deg, ${color} ${basePercentage}deg, #f0f0f0 ${basePercentage}deg)`;
            circleElement.style.boxShadow = 'none';
            circleElement.classList.remove('excellent-plus');
        }
        
        const level = this.getScoreLevel(totalScore);
        levelElement.textContent = level.text;
        levelElement.style.color = level.color;
        
        summaryElement.innerHTML = level.summary;
        if (bonus > 0) {
            summaryElement.innerHTML += `<br><small style="color: #667eea; font-weight: 500; margin-top: 8px; display: inline-block;">🌟 专精加成让您脱颖而出！</small>`;
        }
        
        // AI增强标识
        if (result.analysis.aiEnhanced) {
            summaryElement.innerHTML += `<br><small style="color: #667eea; font-weight: 500; margin-top: 4px; display: inline-block;">🔍 AI关键词提取增强</small>`;
        }
        
        if (result.specializations && result.specializations.length > 0) {
            setTimeout(() => {
                this.showSpecializationInfo(result.specializations, result.specializationBonus);
            }, 100);
        }
    }
    
    showSpecializationInfo(specializations, totalBonus) {
        const container = document.querySelector('.score-overview');
        
        const existingSpecInfos = container.querySelectorAll(
            '.specialization-info, .specialization-info-separate'
        );
        existingSpecInfos.forEach(el => el.remove());
        
        const specDiv = document.createElement('div');
        specDiv.className = 'specialization-info-separate';
        
        const categoryMap = {
            skill: '🔧 技能专精',
            experience: '💼 实践专精',
            achievement: '🏆 荣誉专精'
        };
        
        const groupedSpecs = {};
        specializations.forEach(spec => {
            const category = spec.category || 'other';
            if (!groupedSpecs[category]) {
                groupedSpecs[category] = [];
            }
            groupedSpecs[category].push(spec);
        });
        
        let specDetails = '';
        Object.entries(groupedSpecs).forEach(([category, specs]) => {
            const categoryName = categoryMap[category] || '🌟 其他专精';
            const specList = specs.map(spec => spec.description).join(' • ');
            specDetails += `<div class="spec-category">${categoryName}: ${specList}</div>`;
        });
        
        specDiv.innerHTML = `
            <div class="spec-header-separate">
                <span class="spec-icon">⭐</span>
                <span class="spec-title">专精领域识别</span>
            </div>
            <div class="spec-details-separate">
                ${specDetails}
            </div>
            <div class="spec-total-separate">
                总专精加成: <strong>+${totalBonus}分</strong>
            </div>
        `;
        
        container.appendChild(specDiv);
    }
    
    getScoreLevel(score) {
        if (score >= 140) {
            return {
                text: '传奇',
                color: '#9c27b0',
                summary: '全能型专精人才，简历质量卓越超群！'
            };
        } else if (score >= 130) {
            return {
                text: '卓越',
                color: '#9f7aea',
                summary: '多项专精突出，简历质量超群！'
            };
        } else if (score >= 120) {
            return {
                text: '优秀专精',
                color: '#667eea',
                summary: '专精优势明显，简历质量优异！'
            };
        } else if (score >= 110) {
            return {
                text: '专精发展',
                color: '#5a67d8',
                summary: '开始展现专精特质，发展潜力大！'
            };
        } else if (score >= 90) {
            return {
                text: '优秀',
                color: '#48bb78',
                summary: '简历质量很高，可以冲击知名企业！'
            };
        } else if (score >= 75) {
            return {
                text: '良好',
                color: '#38a169',
                summary: '简历整体不错，稍作完善就很棒了'
            };
        } else if (score >= 60) {
            return {
                text: '中等',
                color: '#ed8936',
                summary: '简历有一定亮点，还有提升空间'
            };
        } else if (score >= 45) {
            return {
                text: '及格',
                color: '#dd6b20',
                summary: '简历基本完整，建议重点优化'
            };
        } else {
            return {
                text: '待改进',
                color: '#e53e3e',
                summary: '简历需要大幅提升，建议重新梳理'
            };
        }
    }
    
    getScoreColor(score) {
        if (score >= 80) return '#48bb78';
        if (score >= 60) return '#ed8936';
        return '#e53e3e';
    }
    
    updateDetailedScores(categoryScores, specializations = []) {
        console.log('Updating detailed scores with AI enhancement flags');
        
        const container = document.getElementById('scoreCategories');
        if (!container) {
            console.error('Score categories container not found');
            return;
        }
        
        container.innerHTML = '';
        
        // 类别映射和图标
        const categoryConfig = {
            basicInfo: {
                name: '基本信息',
                icon: '📋',
                maxScore: 10,
                color: '#48bb78'
            },
            education: {
                name: '教育背景',
                icon: '🎓',
                maxScore: 25,
                color: '#667eea'
            },
            skills: {
                name: '专业技能',
                icon: '🔧',
                maxScore: 20,
                color: '#ed8936'
            },
            experience: {
                name: '实践经验',
                icon: '💼',
                maxScore: 30,
                color: '#9f7aea'
            },
            achievements: {
                name: '奖励荣誉',
                icon: '🏆',
                maxScore: 15,
                color: '#f56565'
            }
        };
        
        // 检查是否有专精加成
        const specializationMap = {};
        if (specializations && Array.isArray(specializations)) {
            specializations.forEach(spec => {
                if (spec.category && spec.type) {
                    const key = `${spec.category}-${spec.type}`;
                    specializationMap[key] = spec;
                }
            });
        }
        
        // 渲染每个类别
        Object.entries(categoryScores).forEach(([category, scoreData]) => {
            const config = categoryConfig[category];
            if (!config) return;
            
            const scoreItem = document.createElement('div');
            scoreItem.className = 'score-item';
            
            // 检查是否有AI增强
            const hasAIEnhancement = this.currentAnalysis && this.currentAnalysis.analysis && this.currentAnalysis.analysis.aiEnhanced;
            if (hasAIEnhancement) {
                scoreItem.classList.add('ai-enhanced');
            }
            
            const score = typeof scoreData === 'object' ? scoreData.total : scoreData;
            const maxScore = config.maxScore;
            
            // 计算进度百分比
            const baseScore = Math.min(score, maxScore);
            const basePercentage = (baseScore / maxScore) * 100;
            const bonusScore = Math.max(0, score - maxScore);
            const bonusPercentage = bonusScore > 0 ? Math.min((bonusScore / maxScore) * 100, 30) : 0;
            
            // 检查是否有专精
            const hasSpecialization = Object.keys(specializationMap).some(key => 
                key.includes(category) || (category === 'skills' && key.includes('skill'))
            );
            
            scoreItem.innerHTML = `
                <div class="main-score-row">
                    <div class="category-name">
                        <span>${config.icon}</span>
                        <span>${config.name}</span>
                        ${hasAIEnhancement ? '<span class="ai-enhanced-tag">AI</span>' : ''}
                        ${hasSpecialization ? '<span class="specialization-badge">专精</span>' : ''}
                    </div>
                    
                    <div class="score-right-section">
                        <div class="progress-container">
                            <div class="progress-bar-wrapper">
                                <div class="progress-bar">
                                    <div class="progress-fill base-progress" style="width: ${basePercentage}%"></div>
                                    ${bonusScore > 0 ? `<div class="progress-fill bonus-progress" style="width: ${bonusPercentage}%; left: ${Math.min(basePercentage, 100)}%"></div>` : ''}
                                </div>
                                <div class="progress-legend">
                                    <div class="legend-item">
                                        <div class="legend-color base"></div>
                                        <span>基础 ${baseScore}</span>
                                    </div>
                                    ${bonusScore > 0 ? `
                                        <div class="legend-item">
                                            <div class="legend-color bonus"></div>
                                            <span>加成 +${bonusScore}</span>
                                        </div>
                                    ` : ''}
                                    <div class="legend-item legend-max">
                                        <span>/ ${maxScore}</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="category-score-container">
                            <div class="main-category-score">${score}</div>
                            ${bonusScore > 0 ? `
                                <div class="score-composition-mini">
                                    <span>${baseScore}</span>
                                    <span class="plus">+</span>
                                    <span>${bonusScore}</span>
                                </div>
                            ` : ''}
                        </div>
                        
                        <button class="toggle-detail collapsed" onclick="this.parentElement.parentElement.parentElement.querySelector('.category-detail').style.display = this.classList.contains('collapsed') ? 'block' : 'none'; this.classList.toggle('collapsed'); this.classList.toggle('expanded');">
                            详情
                        </button>
                    </div>
                </div>
                
                <div class="category-detail" style="display: none;">
                    ${this.generateCategoryDetail(category, scoreData, hasAIEnhancement)}
                </div>
            `;
            
            container.appendChild(scoreItem);
        });
        
        // 添加AI增强总结（如果适用）
        if (this.currentAnalysis && this.currentAnalysis.analysis && this.currentAnalysis.analysis.aiEnhanced) {
            const aiSummary = document.createElement('div');
            aiSummary.className = 'ai-summary-box';
            aiSummary.innerHTML = `
                <div class="ai-summary-header">
                    <span class="ai-summary-icon">🔍</span>
                    <span class="ai-summary-title">AI关键词提取分析总结</span>
                </div>
                <div class="ai-summary-content">
                    <p>本次分析采用AI关键词提取技术，智能识别简历关键信息</p>
                    <p>置信度: <span class="confidence-indicator confidence-${this.getConfidenceLevel(this.currentAnalysis.analysis.aiConfidence)}">${Math.round(this.currentAnalysis.analysis.aiConfidence * 100)}%</span></p>
                    <p>相比传统分析，AI关键词提取能够：</p>
                    <ul>
                        <li>🎯 更准确识别关键信息</li>
                        <li>🔄 智能去重，减少重复内容</li>
                        <li>📝 优化文本结构，提高可读性</li>
                        <li>⚡ 提升分析速度和准确性</li>
                    </ul>
                </div>
            `;
            container.appendChild(aiSummary);
        }
    }
    
    // 辅助方法：生成类别详情
    generateCategoryDetail(category, scoreData, hasAIEnhancement = false) {
        const detailMap = {
            basicInfo: this.generateBasicInfoDetail,
            education: this.generateEducationDetail,
            skills: this.generateSkillsDetail,
            experience: this.generateExperienceDetail,
            achievements: this.generateAchievementsDetail
        };
        
        const generator = detailMap[category];
        if (generator && typeof generator === 'function') {
            return generator.call(this, scoreData, hasAIEnhancement);
        }
        
        return `<p>详细信息暂无</p>`;
    }
    
    // 各类别详情生成方法
    generateBasicInfoDetail(scoreData, hasAIEnhancement) {
        const details = scoreData.details || {};
        
        let html = '<h4>基本信息详情</h4>';
        
        const items = [
            { key: 'name', label: '姓名', icon: '👤' },
            { key: 'phone', label: '电话', icon: '📞' },
            { key: 'email', label: '邮箱', icon: '📧' },
            { key: 'address', label: '地址/意向', icon: '📍' },
            { key: 'intention', label: '求职意向', icon: '🎯' },
            { key: 'website', label: '个人网站', icon: '🌐' },
            { key: 'social', label: '社交媒体', icon: '📱' }
        ];
        
        items.forEach(item => {
            const hasItem = details[item.key];
            html += `
                <div class="subcategory-item ${hasItem ? 'completed' : 'missing'}">
                    <div class="subcategory-info">
                        <div class="subcategory-name">
                            ${item.icon} ${item.label}
                            ${hasAIEnhancement && hasItem ? '<span class="ai-detected">AI识别</span>' : ''}
                        </div>
                    </div>
                    <div class="subcategory-status">
                        ${hasItem ? '✅ 已填写' : '❌ 缺失'}
                    </div>
                </div>
            `;
        });
        
        if (hasAIEnhancement) {
            html += `
                <div class="ai-insight-box">
                    <h5>🔍 AI分析洞察</h5>
                    <p>AI智能识别了您简历中的关键个人信息，建议补充缺失项以提高完整性。</p>
                </div>
            `;
        }
        
        return html;
    }
    
    generateEducationDetail(scoreData, hasAIEnhancement) {
        const details = scoreData.details || {};
        
        let html = '<h4>教育背景详情</h4>';
        
        html += `
            <div class="subcategory-item">
                <div class="subcategory-info">
                    <div class="subcategory-name">🏫 学校水平</div>
                    <div class="subcategory-max">满分: 15分</div>
                </div>
                <div class="subcategory-progress-container">
                    <div class="subcategory-progress">
                        <div class="subcategory-progress-fill" style="width: ${(details.school / 15) * 100}%"></div>
                    </div>
                    <div class="subcategory-score">${details.school || 0}</div>
                </div>
            </div>
            
            <div class="subcategory-item">
                <div class="subcategory-info">
                    <div class="subcategory-name">📊 学术成绩</div>
                    <div class="subcategory-max">满分: 5分</div>
                </div>
                <div class="subcategory-progress-container">
                    <div class="subcategory-progress">
                        <div class="subcategory-progress-fill" style="width: ${(details.academic / 5) * 100}%"></div>
                    </div>
                    <div class="subcategory-score">${details.academic || 0}</div>
                </div>
            </div>
            
            <div class="subcategory-item">
                <div class="subcategory-info">
                    <div class="subcategory-name">🎓 学历层次</div>
                    <div class="subcategory-max">满分: 5分</div>
                </div>
                <div class="subcategory-progress-container">
                    <div class="subcategory-progress">
                        <div class="subcategory-progress-fill" style="width: ${(details.degree / 5) * 100}%"></div>
                    </div>
                    <div class="subcategory-score">${details.degree || 0}</div>
                </div>
            </div>
        `;
        
        if (scoreData.total > 25) {
            html += `
                <div class="education-note">
                    <p><strong>🌟 教育背景超分奖励</strong></p>
                    <p>您的教育背景得分超过了基础分上限，这通常意味着您拥有优秀的学校背景或突出的学术表现。</p>
                </div>
            `;
        }
        
        if (hasAIEnhancement) {
            html += `
                <div class="ai-insight-box">
                    <h5>🔍 AI分析洞察</h5>
                    <p>AI从您的简历中智能提取了教育信息，自动识别学校层次和学历程度。</p>
                </div>
            `;
        }
        
        return html;
    }
    
    generateSkillsDetail(scoreData, hasAIEnhancement) {
        const details = scoreData.details || {};
        
        let html = '<h4>专业技能详情</h4>';
        
        const skillCategories = [
            { key: 'programming', label: '编程开发', icon: '💻' },
            { key: 'design', label: '设计创作', icon: '🎨' },
            { key: 'data', label: '数据分析', icon: '📊' },
            { key: 'engineering', label: '工程技术', icon: '⚙️' },
            { key: 'arts', label: '文体艺术', icon: '🎭' }
        ];
        
        skillCategories.forEach(category => {
            const score = details[category.key] || 0;
            const maxScore = 4;
            
            html += `
                <div class="subcategory-item ${score > 0 ? 'has-skills' : ''}">
                    <div class="subcategory-info">
                        <div class="subcategory-name">
                            ${category.icon} ${category.label}
                            ${hasAIEnhancement && score > 0 ? '<span class="ai-detected">AI识别</span>' : ''}
                        </div>
                        <div class="subcategory-max">满分: ${maxScore}分</div>
                    </div>
                    <div class="subcategory-progress-container">
                        <div class="subcategory-progress">
                            <div class="subcategory-progress-fill" style="width: ${(score / maxScore) * 100}%"></div>
                        </div>
                        <div class="subcategory-score">${score}</div>
                    </div>
                </div>
            `;
        });
        
        if (hasAIEnhancement) {
            html += `
                <div class="ai-insight-box">
                    <h5>🔍 AI分析洞察</h5>
                    <p>AI智能识别了您简历中的技能关键词，自动分类到相应技能领域。</p>
                </div>
            `;
        }
        
        return html;
    }
    
    generateExperienceDetail(scoreData, hasAIEnhancement) {
        const details = scoreData.details || {};
        
        let html = '<h4>实践经验详情</h4>';
        
        const experienceCategories = [
            { key: 'internship', label: '实习经历', icon: '💼', maxScore: 10 },
            { key: 'project', label: '项目经验', icon: '📋', maxScore: 10 },
            { key: 'academic', label: '学术研究', icon: '📚', maxScore: 10 }
        ];
        
        experienceCategories.forEach(category => {
            const score = details[category.key] || 0;
            
            html += `
                <div class="subcategory-item ${score > 0 ? 'has-experience' : ''}">
                    <div class="subcategory-info">
                        <div class="subcategory-name">
                            ${category.icon} ${category.label}
                            ${hasAIEnhancement && score > 0 ? '<span class="ai-detected">AI识别</span>' : ''}
                        </div>
                        <div class="subcategory-max">满分: ${category.maxScore}分</div>
                    </div>
                    <div class="subcategory-progress-container">
                        <div class="subcategory-progress">
                            <div class="subcategory-progress-fill" style="width: ${(score / category.maxScore) * 100}%"></div>
                        </div>
                        <div class="subcategory-score">${score}</div>
                    </div>
                </div>
            `;
        });
        
        if (hasAIEnhancement) {
            html += `
                <div class="ai-insight-box">
                    <h5>🔍 AI分析洞察</h5>
                    <p>AI从您的简历中提取了实践经验信息，自动识别实习、项目和学术活动。</p>
                </div>
            `;
        }
        
        return html;
    }
    
    generateAchievementsDetail(scoreData, hasAIEnhancement) {
        const details = scoreData.details || {};
        
        let html = '<h4>奖励荣誉详情</h4>';
        
        const achievementCategories = [
            { key: 'leadership', label: '学生干部', icon: '👥', maxScore: 5 },
            { key: 'honor', label: '奖学金荣誉', icon: '🏅', maxScore: 5 },
            { key: 'competition', label: '竞赛获奖', icon: '🏆', maxScore: 5 },
            { key: 'certificate', label: '专业证书', icon: '📜', maxScore: 5 }
        ];
        
        achievementCategories.forEach(category => {
            const score = details[category.key] || 0;
            
            html += `
                <div class="subcategory-item ${score > 0 ? 'has-achievement' : ''}">
                    <div class="subcategory-info">
                        <div class="subcategory-name">
                            ${category.icon} ${category.label}
                            ${hasAIEnhancement && score > 0 ? '<span class="ai-detected">AI识别</span>' : ''}
                        </div>
                        <div class="subcategory-max">满分: ${category.maxScore}分</div>
                    </div>
                    <div class="subcategory-progress-container">
                        <div class="subcategory-progress">
                            <div class="subcategory-progress-fill" style="width: ${(score / category.maxScore) * 100}%"></div>
                        </div>
                        <div class="subcategory-score">${score}</div>
                    </div>
                </div>
            `;
        });
        
        // 显示额外加成（如果有）
        if (scoreData.extraScore && Object.keys(scoreData.extraScore).length > 0) {
            html += `
                <div class="extra-score-section">
                    <h5>🌟 超分加成</h5>
            `;
            
            Object.entries(scoreData.extraScore).forEach(([category, score]) => {
                if (score > 0) {
                    const categoryNames = {
                        leadership: '学生干部',
                        honor: '奖学金荣誉', 
                        competition: '竞赛获奖',
                        certificate: '专业证书'
                    };
                    
                    html += `
                        <div class="extra-score-item">
                            <span>${categoryNames[category] || category}: +${score}分</span>
                        </div>
                    `;
                }
            });
            
            html += `</div>`;
        }
        
        if (hasAIEnhancement) {
            html += `
                <div class="ai-insight-box">
                    <h5>🔍 AI分析洞察</h5>
                    <p>AI智能识别了您的奖励荣誉信息，自动分类不同类型的成就。</p>
                </div>
            `;
        }
        
        return html;
    }
    
    // 辅助方法：获取置信度等级
    getConfidenceLevel(confidence) {
        if (confidence >= 0.8) return 'high';
        if (confidence >= 0.6) return 'medium';
        return 'low';
    }
    
    updateJobRecommendations(jobs) {
        const container = document.getElementById('jobList');
        container.innerHTML = '';
        
        jobs.forEach((job, index) => {
            const item = document.createElement('div');
            item.className = 'job-item';
            item.style.animationDelay = (index * 0.1) + 's';
            
            // 添加AI推荐标识
            const isAIRecommended = job.reason.includes('AI识别');
            if (isAIRecommended) {
                item.classList.add('ai-recommended');
            }
            
            let borderColor = '#667eea';
            if (job.match >= 85) borderColor = '#48bb78';
            else if (job.match >= 70) borderColor = '#ed8936';
            else if (job.match < 60) borderColor = '#f56565';
            
            item.style.borderLeftColor = borderColor;
            
            item.innerHTML = `
                <div class="job-header">
                    <div class="job-title">
                        ${job.category}
                        ${isAIRecommended ? '<span class="ai-rec-badge">🔍 AI识别</span>' : ''}
                    </div>
                    <div class="job-match" style="color: ${borderColor};">匹配度: ${Math.round(job.match)}%</div>
                </div>
                <div class="job-reason">${job.reason}</div>
            `;
            
            container.appendChild(item);
        });
    }
    
    updateSuggestions(suggestions) {
        const container = document.getElementById('suggestionList');
        container.innerHTML = '';
        
        suggestions.forEach((suggestion, index) => {
            const item = document.createElement('div');
            const isPositive = suggestion.includes('质量很好') || suggestion.includes('名校背景') || suggestion.includes('充分利用');
            const isAISuggestion = suggestion.includes('AI智能分析') || suggestion.includes('AI识别') || suggestion.includes('格式');
            
            item.className = `suggestion-item ${isPositive ? 'positive' : ''} ${isAISuggestion ? 'ai-suggestion' : ''}`;
            item.style.animationDelay = (index * 0.1) + 's';
            
            let icon = '💡';
            if (suggestion.includes('完善') || suggestion.includes('添加')) icon = '📝';
            if (suggestion.includes('技能') || suggestion.includes('证书')) icon = '🔧';
            if (suggestion.includes('实习') || suggestion.includes('项目')) icon = '💼';
            if (suggestion.includes('竞赛') || suggestion.includes('奖学金')) icon = '🏆';
            if (suggestion.includes('质量很好') || suggestion.includes('名校')) icon = '⭐';
            if (isAISuggestion) icon = '🔍';
            
            item.innerHTML = `
                <div style="display: flex; align-items: flex-start; gap: 10px;">
                    <span style="font-size: 1.2em; margin-top: 2px;">${icon}</span>
                    <span>${suggestion}</span>
                    ${isAISuggestion ? '<span class="ai-suggestion-badge">AI</span>' : ''}
                </div>
            `;
            
            container.appendChild(item);
        });
    }
    
    animateScoreItems() {
        const scoreItems = document.querySelectorAll('.score-item');
        scoreItems.forEach((item, index) => {
            item.style.opacity = '0';
            item.style.transform = 'translateY(20px)';
            
            setTimeout(() => {
                item.style.transition = 'all 0.5s ease';
                item.style.opacity = '1';
                item.style.transform = 'translateY(0)';
            }, index * 150);
        });
    }
    
    showToast(message, type = 'info', duration = 3000) {
        const container = document.getElementById('toastContainer');
        const toast = document.createElement('div');
        
        const typeIcons = {
            success: '✅',
            error: '❌',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        toast.className = `toast toast-${type}`;
        toast.innerHTML = `
            <span class="toast-icon">${typeIcons[type]}</span>
            <span class="toast-message">${message}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">×</button>
        `;
        
        container.appendChild(toast);
        
        setTimeout(() => {
            if (toast.parentElement) {
                toast.remove();
            }
        }, duration);
        
        const toasts = container.querySelectorAll('.toast');
        if (toasts.length > 3) {
            toasts[0].remove();
        }
    }
    
    showLoading(message) {
        const overlay = document.getElementById('loadingOverlay');
        const text = document.getElementById('loadingText');
        text.textContent = message;
        overlay.style.display = 'flex';
    }
    
    hideLoading() {
        const overlay = document.getElementById('loadingOverlay');
        overlay.style.display = 'none';
    }
    
    exportResults() {
        if (!this.currentAnalysis) {
            this.showToast('没有可导出的分析结果', 'warning');
            return;
        }
        
        try {
            const reportContent = this.generateReport(this.currentAnalysis);
            this.downloadFile(reportContent, `简历分析报告${this.currentAnalysis.analysis.aiEnhanced ? '_AI关键词提取版' : ''}_${new Date().toISOString().slice(0, 10)}.txt`);
            this.showToast('报告导出成功！', 'success');
        } catch (error) {
            this.showToast('导出失败: ' + error.message, 'error');
        }
    }
    
    downloadFile(content, filename) {
        const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        
        URL.revokeObjectURL(url);
    }
    
    async shareResults() {
        if (!this.currentAnalysis) {
            this.showToast('没有可分享的结果', 'warning');
            return;
        }
        
        const shareData = {
            title: `我的简历评分结果${this.currentAnalysis.analysis.aiEnhanced ? ' (AI关键词提取版)' : ''}`,
            text: `我的简历获得了 ${this.currentAnalysis.totalScore} 分！${this.currentAnalysis.analysis.aiEnhanced ? ' (AI关键词智能分析)' : ''}`,
            url: window.location.href
        };
        
        try {
            if (navigator.share) {
                await navigator.share(shareData);
                this.showToast('分享成功！', 'success');
            } else {
                await navigator.clipboard.writeText(window.location.href);
                this.showToast('链接已复制到剪贴板！', 'success');
            }
        } catch (error) {
            this.showToast('分享失败', 'error');
        }
    }
    
    clearTextarea() {
        document.getElementById('resumeText').value = '';
        this.updateCharacterCount();
        this.checkTextInput();
        this.showToast('内容已清空', 'info');
    }
    
    analyzeAgain() {
        const resultSection = document.getElementById('resultSection');
        resultSection.style.display = 'none';
        this.currentAnalysis = null;
        document.getElementById('resumeText').focus();
        this.showToast('可以重新上传或粘贴简历内容', 'info');
    }
    
    toggleTheme() {
        this.isDarkTheme = !this.isDarkTheme;
        document.body.classList.toggle('dark-theme');
        localStorage.setItem('theme', this.isDarkTheme ? 'dark' : 'light');
        
        const icon = document.querySelector('.theme-icon');
        icon.textContent = this.isDarkTheme ? '☀️' : '🌙';
        
        this.showToast(`已切换到${this.isDarkTheme ? '深色' : '浅色'}模式`, 'info');
    }
    
    toggleAIMode() {
        if (this.aiKeywordExtractor) {
            const enabled = this.aiKeywordExtractor.toggleMode();
            this.updateAIModeUI();
            this.checkTextInput();
            
            const message = enabled ? 
                'AI关键词提取已启用，将智能识别简历关键信息' : 
                'AI关键词提取已关闭，将使用传统算法分析';
            this.showToast(message, enabled ? 'success' : 'info', 4000);
        }
    }
    
    toggleKeyboardShortcuts() {
        const shortcuts = document.getElementById('keyboardShortcuts');
        shortcuts.style.display = shortcuts.style.display === 'none' ? 'block' : 'none';
    }
    
    closeModals() {
        document.getElementById('keyboardShortcuts').style.display = 'none';
    }
    
    generateReport(analysis) {
        let report = `简历分析报告${analysis.analysis.aiEnhanced ? ' (AI关键词提取版)' : ''}
==================
生成时间: ${new Date().toLocaleString()}
分析模式: ${analysis.analysis.aiEnhanced ? 'AI关键词提取增强' : '传统分析'}
${analysis.analysis.aiEnhanced ? `AI置信度: ${Math.round(analysis.analysis.aiConfidence * 100)}%` : ''}

📊 总体评分
基础分: ${analysis.baseScore}/100分
专精加成: +${analysis.specializationBonus}分
总分: ${analysis.totalScore}分
等级: ${this.getScoreLevel(analysis.totalScore).text}
评语: ${this.getScoreLevel(analysis.totalScore).summary}
`;
        
        if (analysis.analysis.aiEnhanced) {
            report += `
🔍 AI关键词提取洞察
分析置信度: ${Math.round(analysis.analysis.aiConfidence * 100)}%
识别精度: ${analysis.analysis.aiConfidence > 0.8 ? '高精度' : analysis.analysis.aiConfidence > 0.6 ? '中等精度' : '基础精度'}
关键词提取: 智能去重和优化完成
文本清理: 减少重复内容，提高识别准确性
`;
        }
        
        if (analysis.specializations && analysis.specializations.length > 0) {
            report += `
⭐ 专精领域识别
`;
            analysis.specializations.forEach(spec => {
                report += `- ${spec.description} (+${spec.bonus}分加成)
`;
            });
            report += '\n';
        }
        
        report += `📋 详细评分
`;
        const categoryNames = {
            basicInfo: '基本信息',
            education: '教育背景',
            skills: '专业技能',
            experience: '实践经验',
            achievements: '奖励荣誉'
        };
        
        Object.entries(analysis.categoryScores).forEach(([category, scoreData]) => {
            const score = scoreData.total;
            const maxScore = category === 'education' ? 25 : 
                           category === 'experience' ? 30 :
                           category === 'skills' ? 20 :
                           category === 'achievements' ? 15 : 10;
            
            if (category === 'education' && score > maxScore) {
                report += `- ${categoryNames[category]}: ${score}/${maxScore}分 (超分奖励)
`;
            } else {
                report += `- ${categoryNames[category]}: ${score}/${maxScore}分
`;
            }
        });
        
        report += `
🎯 岗位推荐
`;
        analysis.jobRecommendations.forEach((job, index) => {
            const aiFlag = job.reason.includes('AI识别') ? ' (AI识别)' : '';
            report += `${index + 1}. ${job.category}${aiFlag} (匹配度: ${Math.round(job.match)}%)
   推荐理由: ${job.reason}
`;
        });
        
        report += `
💡 改进建议
`;
        analysis.suggestions.forEach((suggestion, index) => {
            const aiFlag = suggestion.includes('AI智能分析') || suggestion.includes('格式') ? ' (AI建议)' : '';
            report += `${index + 1}. ${suggestion}${aiFlag}
`;
        });
        
        report += `
---
本报告由简历评分工具${analysis.analysis.aiEnhanced ? 'AI关键词提取版' : ''}自动生成
${analysis.analysis.aiEnhanced ? '技术支持: Compromise.js NLP库 + 智能关键词提取算法' : ''}
建议结合个人实际情况和目标岗位要求进行参考`;
        
        return report;
    }
    
    destroy() {
        this.eventListeners.forEach(({ element, event, handler }) => {
            element.removeEventListener(event, handler);
        });
        this.eventListeners.clear();
    }
}

// 性能监控类
class PerformanceMonitor {
    static trackFileProcessing(fileName, startTime) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.log(`File processing time for ${fileName}: ${duration.toFixed(2)}ms`);
        
        if (duration > 5000) {
            console.warn('File processing took longer than expected');
        }
        
        return duration;
    }
    
    static trackAnalysis(startTime) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.log(`Analysis time: ${duration.toFixed(2)}ms`);
        return duration;
    }
    
    static trackKeywordExtraction(startTime) {
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        console.log(`Keyword extraction time: ${duration.toFixed(2)}ms`);
        return duration;
    }
}

// 初始化应用程序
let app;
function initializeApp() {
    try {
        window.app = new ResumeScoreApp();
        
        // 检查依赖库
        if (typeof pdfjsLib !== 'undefined') {
            console.log('PDF.js 库加载成功');
        } else {
            console.warn('PDF.js 库未加载，PDF解析功能可能不可用');
        }
        
        if (typeof mammoth !== 'undefined') {
            console.log('Mammoth 库加载成功');
        } else {
            console.warn('Mammoth 库未加载，Word解析功能可能不可用');
        }
        
        // 检查NLP库
        if (typeof nlp !== 'undefined') {
            console.log('Compromise.js NLP 库加载成功');
        } else {
            console.warn('Compromise.js 库未加载，AI关键词提取功能将使用传统方法');
        }
        
        if (typeof i18n !== 'undefined') {
            i18n.updateUI();
        }
        
        console.log('应用程序初始化完成 (AI关键词提取版)');
        
    } catch (error) {
        console.error('应用程序初始化失败:', error);
        showError('应用程序初始化失败，请刷新页面重试');
    }
}

// 确保函数在全局作用域
window.initializeApp = initializeApp;

// 全局函数（保持向后兼容）
function toggleLanguage() {
    if (typeof i18n !== 'undefined') {
        const newLang = i18n.currentLang === 'zh' ? 'en' : 'zh';
        i18n.switchLanguage(newLang);
        if (app) {
            app.showToast(`Language switched to ${newLang === 'zh' ? 'Chinese' : 'English'}`, 'info');
        }
    }
}

function toggleTheme() {
    if (app) {
        app.toggleTheme();
    }
}

function toggleAIMode() {
    if (app) {
        app.toggleAIMode();
    }
}

function clearTextarea() {
    if (app) {
        app.clearTextarea();
    }
}

function analyzeResume() {
    if (app) {
        app.analyzeResume();
    }
}

function exportResults() {
    if (app) {
        app.exportResults();
    }
}

function shareResults() {
    if (app) {
        app.shareResults();
    }
}

function analyzeAgain() {
    if (app) {
        app.analyzeAgain();
    }
}

// 全局错误处理
function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: #fed7d7;
        color: #9b2c2c;
        padding: 16px 20px;
        border-radius: 8px;
        border-left: 4px solid #f56565;
        box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        z-index: 1000;
        max-width: 400px;
        animation: slideInRight 0.3s ease;
    `;
    
    errorDiv.innerHTML = `
        <div style="display: flex; align-items: center; gap: 10px;">
            <span style="font-size: 1.2em;">❌</span>
            <span>${message}</span>
            <button onclick="this.parentElement.parentElement.remove()" 
                    style="margin-left: auto; background: none; border: none; font-size: 1.2em; cursor: pointer; color: #9b2c2c;">×</button>
        </div>
    `;
    
    document.body.appendChild(errorDiv);
    
    setTimeout(() => {
        if (errorDiv.parentElement) {
            errorDiv.remove();
        }
    }, 5000);
}

// 全局错误监听
window.addEventListener('error', function(event) {
    console.error('全局错误:', event.error);
    showError('发生了一个错误，请刷新页面重试');
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('未处理的Promise错误:', event.reason);
    showError('处理请求时发生错误，请重试');
});

// 页面可见性改变时的处理
document.addEventListener('visibilitychange', function() {
    if (document.hidden) {
        console.log('页面隐藏');
    } else {
        console.log('页面可见');
        // 页面恢复时重新检查AI状态
        if (window.aiKeywordExtractor && !window.aiKeywordExtractor.isReady) {
            console.log('页面恢复，重新初始化AI关键词提取器');
            window.aiKeywordExtractor.init();
        }
    }
});

// 网络状态监听
window.addEventListener('online', function() {
    if (app) {
        app.showToast('网络连接已恢复', 'success');
    }
});

window.addEventListener('offline', function() {
    if (app) {
        app.showToast('网络连接已断开，AI功能可能不可用', 'warning');
    }
});

// 内存使用监控
function monitorMemoryUsage() {
    if ('memory' in performance) {
        const memory = performance.memory;
        const usedJSSize = Math.round(memory.usedJSHeapSize / 1024 / 1024);
        const totalJSSize = Math.round(memory.totalJSHeapSize / 1024 / 1024);
        const jsHeapSizeLimit = Math.round(memory.jsHeapSizeLimit / 1024 / 1024);
        
        console.log(`内存使用情况: ${usedJSSize}MB / ${totalJSSize}MB (限制: ${jsHeapSizeLimit}MB)`);
        
        if (usedJSSize / jsHeapSizeLimit > 0.8) {
            console.warn('内存使用率较高，建议刷新页面');
            if (app) {
                app.showToast('内存使用率较高，建议刷新页面以获得最佳性能', 'warning', 5000);
            }
        }
    }
}

// 定期监控内存使用（仅在开发环境下）
if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
    setInterval(monitorMemoryUsage, 30000);
}

// 键盘快捷键增强
document.addEventListener('keydown', function(e) {
    if ((e.ctrlKey || e.metaKey) && e.key === 'i' && !e.shiftKey) {
        e.preventDefault();
        toggleAIMode();
    }
});

// 响应式设计支持
function handleResponsiveDesign() {
    const isMobile = window.innerWidth <= 768;
    
    if (isMobile && window.aiKeywordExtractor) {
        console.log('移动设备检测，AI关键词提取功能保持启用');
    }
    
    const aiToggle = document.querySelector('.ai-toggle');
    const langToggle = document.querySelector('.language-toggle');
    const themeToggle = document.querySelector('.theme-toggle');
    
    if (isMobile) {
        if (aiToggle) aiToggle.style.right = '15px';
        if (langToggle) langToggle.style.right = '85px';
        if (themeToggle) themeToggle.style.right = '15px';
    }
}

window.addEventListener('resize', handleResponsiveDesign);
window.addEventListener('orientationchange', handleResponsiveDesign);
handleResponsiveDesign();

// 性能监控
if ('performance' in window) {
    window.addEventListener('load', function() {
        setTimeout(() => {
            const perfData = performance.timing;
            const loadTime = perfData.loadEventEnd - perfData.navigationStart;
            console.log(`页面加载时间: ${loadTime}ms`);
            
            if (loadTime > 3000) {
                console.warn('页面加载时间较长，可能需要优化');
            }
            
            if (typeof nlp !== 'undefined') {
                console.log('NLP库加载完成');
            }
        }, 0);
    });
}

// 导出主要类
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { 
        ResumeScoreApp, 
        PerformanceMonitor, 
        initializeApp
    };
}

// 版本信息
console.log(`
🎓 简历评分工具 AI关键词提取版
版本: 2.1.0
特性: 
- ✅ 传统算法分析
- ✅ AI关键词提取 (Compromise.js NLP)
- ✅ 智能去重和文本清理
- ✅ 专精识别与加成
- ✅ 智能岗位推荐
- ✅ 响应式设计
- ✅ 深色模式
- ✅ 多语言支持
- ✅ 性能监控

快捷键:
- Ctrl+U: 上传文件
- Ctrl+Enter: 开始分析
- Ctrl+E: 导出报告
- Ctrl+I: 切换AI模式
- F1: 显示快捷键
- ESC: 关闭弹窗

GitHub: https://github.com/Theodore-Hu/Score-for-Resume-AI
`);
