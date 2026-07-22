// ==UserScript==
// @name         多平台分类关键词屏蔽器
// @author       清.HZQ
// @namespace    http://tampermonkey.net/
// @version      1.0.0
// @description  按平台（知乎、B站、小红书、微博）独立管理屏蔽词，互不干扰
// @match        https://www.zhihu.com/*
// @match        https://www.xiaohongshu.com/*
// @match        https://www.bilibili.com/*
// @icon         https://picx.zhimg.com/v2-fab9e4d5ddf148b93df597a86b0525fd_l.jpg?source=32738c0c&needBackground=1
// @grant        none
// @license      MIT
// ==/UserScript==

(function() {
    'use strict';

    // 1. 各平台独立的默认词库配置
    const DEFAULT_SITE_KEYWORDS = {
        zhihu: [
            '985', '211', '原生家庭', '华为', '小米', '生物爹', '大龄剩女', '结婚', '生娃'
        ],
        bilibili: [
            'coser', 'COSER', '漫展', 'JK', '体育生', '盲盒', '华为', '小米'
        ],
        xiaohongshu: [
            '美女', '女神', '小姐姐', '身材', '迪士尼', '奶茶', '健身房', '华为'
        ],
        weibo: [
            '今日俄罗斯', '大妈', '单亲', '男子', '女演员', '华为'
        ]
    };

    const FALLBACK_KEYWORDS = ['华为', '小米'];

    // 获取当前域名所属平台 Key
    function getCurrentSite() {
        const hostname = window.location.hostname;
        if (hostname.includes('zhihu.com')) return 'zhihu';
        if (hostname.includes('xiaohongshu.com')) return 'xiaohongshu';
        if (hostname.includes('bilibili.com')) return 'bilibili';
        if (hostname.includes('weibo.com')) return 'weibo';
        return 'unknown';
    }

    const currentSite = getCurrentSite();

    // 动态生成平台专属的 Storage Key，实现独立数据隔离
    const STORAGE_KEY_PREFIX = 'keyword_blocker_words_v3_';
    const currentStorageKey = `${STORAGE_KEY_PREFIX}${currentSite}`;
    const DISABLED_SITES_KEY = 'keyword_blocker_disabled_sites';

    // 获取当前平台的默认屏蔽词列表
    function getDefaultKeywordsForSite(site) {
        return DEFAULT_SITE_KEYWORDS[site] ? [...DEFAULT_SITE_KEYWORDS[site]] : [...FALLBACK_KEYWORDS];
    }

    // 存储当前平台的词库
    function saveKeywords(keywords) {
        if (currentSite === 'unknown') return;
        localStorage.setItem(currentStorageKey, JSON.stringify(keywords));
    }

    // 加载当前平台的词库
    function loadKeywords() {
        if (currentSite === 'unknown') return [];
        try {
            const saved = localStorage.getItem(currentStorageKey);
            return saved ? JSON.parse(saved) : getDefaultKeywordsForSite(currentSite);
        } catch (e) {
            console.error('加载屏蔽词失败:', e);
            return getDefaultKeywordsForSite(currentSite);
        }
    }

    // 禁用网站管理
    function saveDisabledSites(sites) {
        localStorage.setItem(DISABLED_SITES_KEY, JSON.stringify(sites));
    }

    function loadDisabledSites() {
        try {
            const saved = localStorage.getItem(DISABLED_SITES_KEY);
            return saved ? JSON.parse(saved) : [];
        } catch (e) {
            return [];
        }
    }

    function isCurrentSiteDisabled() {
        return loadDisabledSites().includes(currentSite);
    }

    function toggleCurrentSite() {
        const disabledSites = loadDisabledSites();
        const index = disabledSites.indexOf(currentSite);
        if (index > -1) {
            disabledSites.splice(index, 1);
        } else {
            disabledSites.push(currentSite);
        }
        saveDisabledSites(disabledSites);
    }

    // 当前平台的屏蔽词列表
    let BLOCK_KEYWORDS = loadKeywords();

    // 平台匹配 DOM 配置
    const siteConfigs = {
        zhihu: {
            containerSelector: '.ContentItem, .TopstoryItem',
            titleSelector: '.ContentItem-title, .QuestionItem-title',
            logPrefix: '已屏蔽知乎内容',
            name: '知乎'
        },
        xiaohongshu: {
            containerSelector: 'section.note-item, .note-item',
            titleSelector: '.title, .name',
            logPrefix: '已屏蔽小红书内容',
            name: '小红书'
        },
        bilibili: {
            containerSelector: '.bili-feed-card, .bili-video-card, .feed-card',
            titleSelector: '.bili-video-card__info--tit, .bili-video-card__info--author',
            logPrefix: '已屏蔽B站内容',
            name: 'B站'
        },
        weibo: {
            containerSelector: '.wbpro-scroller-item, .vue-recycle-scroller__item-view',
            titleSelector: '.detail_wbtext_4CRf9, .wbpro-feed-content',
            logPrefix: '已屏蔽微博内容',
            name: '微博'
        }
    };

    // UI 构建逻辑
    function createManagementUI() {
        const style = document.createElement('style');
        style.textContent = `
            #keyword-blocker-toggle {
                position: fixed; left: 0; top: 40%; z-index: 10000;
                background: #1890ff; color: white; border: none;
                border-radius: 0 6px 6px 0; padding: 10px 6px; cursor: pointer;
                font-size: 13px; writing-mode: vertical-lr; box-shadow: 2px 2px 8px rgba(0,0,0,0.2);
            }
            #keyword-blocker-panel {
                position: fixed; left: -360px; top: 20%; z-index: 10001;
                width: 320px; max-height: 75vh; background: #fff;
                border: 1px solid #e8e8e8; border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0,0,0,0.15); transition: left 0.3s ease;
                display: flex; flex-direction: column; font-family: sans-serif;
            }
            #keyword-blocker-panel.show { left: 20px; }
            .kb-header { padding: 14px; background: #fafafa; border-bottom: 1px solid #f0f0f0; }
            .kb-title-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; }
            .kb-input-group { display: flex; gap: 6px; margin-top: 8px; }
            .kb-input { flex: 1; padding: 6px 10px; border: 1px solid #d9d9d9; border-radius: 4px; outline: none; }
            .kb-btn { padding: 6px 12px; background: #1890ff; color: #fff; border: none; border-radius: 4px; cursor: pointer; }
            .kb-btn-reset { background: #faad14; margin-left: 4px; }
            .kb-list-container { flex: 1; overflow-y: auto; padding: 0; max-height: 50vh; }
            .kb-list { list-style: none; margin: 0; padding: 0; }
            .kb-list-item { display: flex; justify-content: space-between; align-items: center; padding: 8px 14px; border-bottom: 1px solid #f0f0f0; }
            .kb-delete-btn { padding: 2px 6px; background: #ff4d4f; color: white; border: none; border-radius: 3px; cursor: pointer; font-size: 12px; }
            .kb-stats { padding: 10px; background: #fafafa; border-top: 1px solid #f0f0f0; font-size: 12px; color: #666; text-align: center; }
            .kb-close-btn { background: none; border: none; font-size: 16px; cursor: pointer; color: #999; }
            .kb-site-badge { background: #e6f7ff; color: #1890ff; border: 1px solid #91d5ff; padding: 2px 6px; border-radius: 4px; font-size: 12px; }
        `;
        document.head.appendChild(style);

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'keyword-blocker-toggle';
        toggleBtn.textContent = '屏蔽词管理';
        document.body.appendChild(toggleBtn);

        const panel = document.createElement('div');
        panel.id = 'keyword-blocker-panel';

        const siteName = siteConfigs[currentSite]?.name || '当前网站';
        const isDisabled = isCurrentSiteDisabled();

        panel.innerHTML = `
            <div class="kb-header">
                <div class="kb-title-row">
                    <div>
                        <strong style="font-size: 14px;">${isDisabled ? '⚠️ 屏蔽已暂停' : '屏蔽词管理'}</strong>
                        <span class="kb-site-badge">${siteName}专属</span>
                    </div>
                    <div>
                        <button class="kb-btn kb-btn-reset" id="kb-reset-btn" title="恢复当前网站的默认词库">重置</button>
                        <button class="kb-close-btn" id="kb-close">✕</button>
                    </div>
                </div>
                <button class="kb-btn" id="kb-disable-site" style="width: 100%; margin-top: 4px; background: ${isDisabled ? '#52c41a' : '#8c8c8c'}">
                    ${isDisabled ? `启用 [${siteName}] 屏蔽` : `在 [${siteName}] 暂停屏蔽`}
                </button>
                <div class="kb-input-group">
                    <input type="text" id="kb-input" class="kb-input" placeholder="新增 [${siteName}] 屏蔽词 (逗号分隔)" />
                    <button id="kb-add-btn" class="kb-btn">添加</button>
                </div>
            </div>
            <div class="kb-list-container">
                <ul id="kb-list" class="kb-list"></ul>
            </div>
            <div class="kb-stats">
                [${siteName}] 当前共有 <span id="kb-count">0</span> 个屏蔽词
            </div>
        `;
        document.body.appendChild(panel);

        return { toggleBtn, panel };
    }

    function renderKeywordList() {
        const list = document.getElementById('kb-list');
        const count = document.getElementById('kb-count');
        if (!list || !count) return;

        list.innerHTML = '';
        count.textContent = BLOCK_KEYWORDS.length;

        BLOCK_KEYWORDS.forEach((keyword, index) => {
            const li = document.createElement('li');
            li.className = 'kb-list-item';
            li.innerHTML = `
                <span class="kb-keyword">${keyword}</span>
                <button class="kb-delete-btn" data-index="${index}">删除</button>
            `;
            list.appendChild(li);
        });
    }

    function addKeywords(input) {
        const rawWords = input.split(/[,，/]/).map(w => w.trim()).filter(Boolean);
        let addedCount = 0;
        let existedWords = [];

        rawWords.forEach(word => {
            if (BLOCK_KEYWORDS.includes(word)) {
                existedWords.push(word);
            } else {
                BLOCK_KEYWORDS.unshift(word);
                addedCount++;
            }
        });

        if (existedWords.length > 0) {
            alert(`在 [${siteConfigs[currentSite]?.name || '当前平台'}] 中已存在：${existedWords.join(', ')}`);
        }

        if (addedCount > 0) {
            saveKeywords(BLOCK_KEYWORDS);
            renderKeywordList();
            processAllContent();
            return true;
        }
        return false;
    }

    function removeKeyword(index) {
        if (index >= 0 && index < BLOCK_KEYWORDS.length) {
            BLOCK_KEYWORDS.splice(index, 1);
            saveKeywords(BLOCK_KEYWORDS);
            renderKeywordList();
            return true;
        }
        return false;
    }

    function initUIEvents() {
        const toggleBtn = document.getElementById('keyword-blocker-toggle');
        const panel = document.getElementById('keyword-blocker-panel');
        const closeBtn = document.getElementById('kb-close');
        const addBtn = document.getElementById('kb-add-btn');
        const resetBtn = document.getElementById('kb-reset-btn');
        const input = document.getElementById('kb-input');
        const list = document.getElementById('kb-list');
        const disableSiteBtn = document.getElementById('kb-disable-site');

        toggleBtn.addEventListener('click', () => panel.classList.toggle('show'));
        closeBtn.addEventListener('click', () => panel.classList.remove('show'));

        addBtn.addEventListener('click', () => {
            const val = input.value.trim();
            if (val && addKeywords(val)) input.value = '';
        });

        input.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addBtn.click();
        });

        resetBtn.addEventListener('click', () => {
            const siteName = siteConfigs[currentSite]?.name || '当前网站';
            if (confirm(`确定要将 [${siteName}] 的屏蔽词库恢复为默认设置吗？`)) {
                BLOCK_KEYWORDS = getDefaultKeywordsForSite(currentSite);
                saveKeywords(BLOCK_KEYWORDS);
                renderKeywordList();
                processAllContent();
            }
        });

        list.addEventListener('click', (e) => {
            if (e.target.classList.contains('kb-delete-btn')) {
                const idx = parseInt(e.target.dataset.index);
                removeKeyword(idx);
            }
        });

        disableSiteBtn.addEventListener('click', () => {
            toggleCurrentSite();
            location.reload();
        });
    }

    function processContentElement(element, config) {
        if (!element || element.dataset.kbProcessed) return;

        const titleElem = element.querySelector(config.titleSelector);
        const textToTest = titleElem ? titleElem.textContent : element.textContent;

        if (!textToTest) return;

        const hasBlockedWord = BLOCK_KEYWORDS.some(kw => textToTest.includes(kw));

        if (hasBlockedWord) {
            element.style.display = 'none';
            element.dataset.kbProcessed = 'true';
            console.log(`${config.logPrefix}: 匹配命中已隐蔽卡片`);
        }
    }

    function processAllContent() {
        if (isCurrentSiteDisabled()) return;

        const config = siteConfigs[currentSite];
        if (!config) return;

        document.querySelectorAll(config.containerSelector).forEach(el => {
            processContentElement(el, config);
        });
    }

    function init() {
        createManagementUI();
        renderKeywordList();
        initUIEvents();

        if (isCurrentSiteDisabled()) return;

        processAllContent();

        const observer = new MutationObserver((mutations) => {
            let needsScan = false;
            for (const m of mutations) {
                if (m.addedNodes.length > 0) {
                    needsScan = true;
                    break;
                }
            }
            if (needsScan) processAllContent();
        });

        observer.observe(document.body, { childList: true, subtree: true });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
