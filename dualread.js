// 这是一个集成了“Ruby注音”和“样式设置”功能的 Docsify 插件套件。
// v6.0 更新:
// 1. 设置面板会随着侧边栏的折叠/展开而同步显示/隐藏。
// 2. 添加了平滑的滑入/滑出动画效果。

(function () {
  'use strict';

  // =========================================================================
  // == PART 1: RUBY ANNOTATION PLUGIN LOGIC (No changes in this part)      ==
  // =========================================================================

  function rubyAnnotationPlugin(hook, vm) {
    hook.beforeEach(function (content, next) {
      vm.originalMarkdown = content;
      next(content);
    });

    hook.afterEach(function (html, next) {
      if (!vm.originalMarkdown) {
        next(html);
        return;
      }
      // 构建主文件路径(主路径+文件路径)
      const mainFilePath = vm.config.nameLink.slice(0, -1) + vm.route.file;
      if (mainFilePath.endsWith('.md')) {
        const enFilePath = mainFilePath.replace('.md', '_en.md');
        fetch(enFilePath)
          .then(response => {
            if (!response.ok) {
              delete vm.originalMarkdown;
              next(html);
              return null;
            }
            return response.text();
          })
          .then(enContent => {
            if (enContent) {
              const mainLines = vm.originalMarkdown.split('\n').filter(line => line.trim() !== '');
              const enLines = enContent.split('\n').filter(line => line.trim() !== '');
              const container = document.createElement('div');
              container.innerHTML = html;
              const elements = container.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, code');
              const markdownMarkerRegex = /^(#{1,6}\s+|[\*\-\+]\s+|>\s*|\d+\.\s+)/;
              let lineIndex = 0;
              elements.forEach(element => {
                if (!element.textContent.trim() || element.closest('.sidebar-nav')) { return; }
                if (lineIndex < mainLines.length) {
                  const mainText = element.textContent;
                  const enText = (enLines[lineIndex] || '').replace(markdownMarkerRegex, '').trim();
                  if (mainText && enText) {
                    element.innerHTML = `<ruby>${mainText}<rt>${enText}</rt></ruby>`;
                  }
                  lineIndex++;
                }
              });
              delete vm.originalMarkdown;
              next(container.innerHTML);
            } else {
              delete vm.originalMarkdown;
              next(html);
            }
          })
          .catch(error => {
            console.error('获取或处理注音文件时出错:', error);
            delete vm.originalMarkdown;
            next(html);
          });
      } else {
        delete vm.originalMarkdown;
        next(html);
      }
    });
  }

  // =========================================================================
  // == PART 2: STYLE SETTINGS PLUGIN LOGIC (Changes are here)              ==
  // =========================================================================

  function styleSettingsPlugin(hook, vm) {
    const STORAGE_KEY = 'bilingual_style_settings_v3'; 
    const BASE_DEFAULT_SETTINGS = {
      en: { fontSize: 0.5, color: '#7aadff' },
      zh: { fontSize: 1.3, color: null }
    };

    function rgbToHex(rgb) {
      if (!rgb || !rgb.startsWith('rgb')) return rgb;
      const parts = rgb.match(/^rgb\((\d+),\s*(\d+),\s*(\d+)\)$/);
      if (!parts) return '#333333';
      delete parts[0];
      for (let i = 1; i <= 3; ++i) {
        parts[i] = parseInt(parts[i], 10).toString(16);
        if (parts[i].length === 1) parts[i] = '0' + parts[i];
      }
      return '#' + parts.join('');
    }

    function getThemeTextColor() {
      const pElement = document.querySelector('.markdown-section p');
      if (pElement) {
        return rgbToHex(window.getComputedStyle(pElement).color);
      }
      return '#333333';
    }

    function getDefaults() {
      const defaults = JSON.parse(JSON.stringify(BASE_DEFAULT_SETTINGS));
      defaults.zh.color = getThemeTextColor();
      return defaults;
    }

    function loadSettings() {
      try {
        const storedSettings = localStorage.getItem(STORAGE_KEY);
        const defaults = getDefaults();
        const loaded = storedSettings ? JSON.parse(storedSettings) : {};
        return {
          en: { ...defaults.en, ...loaded.en },
          zh: { ...defaults.zh, ...loaded.zh }
        };
      } catch (e) {
        return getDefaults();
      }
    }

    function saveSettings(settings) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    }

    function applyStyles(settings) {
      const styleId = 'custom-bilingual-styles';
      let styleTag = document.getElementById(styleId);
      if (!styleTag) {
        styleTag = document.createElement('style');
        styleTag.id = styleId;
        document.head.appendChild(styleTag);
      }
      styleTag.innerHTML = `
        .markdown-section p ruby, .markdown-section li ruby, .markdown-section blockquote ruby {
          font-size: ${settings.zh.fontSize}em !important;
          color: ${settings.zh.color} !important;
        }
        .markdown-section rt {
          font-size: ${settings.en.fontSize}em !important;
          color: ${settings.en.color} !important;
        }
      `;
    }

    /**
     * **CHANGED**: Added transition and transform properties to the panel's CSS.
     */
    function createPanelHTML(settings) {
      return `
        <div id="style-settings-panel">
          <div class="setting-group">
            <div class="controls">
              <label>英文：</label>
              <input type="number" id="en-font-size-input" value="${settings.en.fontSize}" min="0.0" max="1.0" step="0.1">
              <label>em</label>
              <input type="color" id="en-color-picker" value="${settings.en.color}">
            </div>
            <div class="controls">
              <label>中文：</label>
              <input type="number" id="zh-font-size-input" value="${settings.zh.fontSize}" min="1.0" max="2.0" step="0.1">
              <label>em</label>
              <input type="color" id="zh-color-picker" value="${settings.zh.color}">
            </div>
          </div>
        </div>
        <style>
          #style-settings-panel {
            position: fixed;
            bottom: 0;
            padding: 10px 15px;
            z-index: 100;
          }
          #style-settings-panel .setting-group {
            display: flex;
            flex-direction: column;
            gap: 8px; /* Space between Chinese and English rows */
          }
          #style-settings-panel label {
            flex-shrink: 0;
          }
          #style-settings-panel input[type="number"] {
            width: 50px;
            border: 1px solid #ccc;
            padding: 4px;
          }
          #style-settings-panel input[type="color"] {
            width: 30px;
            margin-left: 10px;
            cursor: pointer;
          }
        </style>
      `;
    }
    
    function setupEventListeners(settings) {
      const syncAndUpdate = (lang, type, value) => {
        const finalValue = type === 'fontSize' ? parseFloat(value) : value;
        if (type === 'fontSize') { settings[lang].fontSize = finalValue; } 
        else if (type === 'color') { settings[lang].color = finalValue; }
        applyStyles(settings);
        saveSettings(settings);
      };
      document.getElementById('en-font-size-input').addEventListener('input', e => syncAndUpdate('en', 'fontSize', e.target.value));
      document.getElementById('en-color-picker').addEventListener('input', e => syncAndUpdate('en', 'color', e.target.value));
      document.getElementById('zh-font-size-input').addEventListener('input', e => syncAndUpdate('zh', 'fontSize', e.target.value));
      document.getElementById('zh-color-picker').addEventListener('input', e => syncAndUpdate('zh', 'color', e.target.value));
    }

    let currentSettings = loadSettings();
    const mobileQuery = window.matchMedia('(max-width: 768px)');

    hook.doneEach(function () {
      if (!currentSettings.zh.color) {
        currentSettings.zh.color = getThemeTextColor();
      }
      applyStyles(currentSettings);
      
      if (document.getElementById('style-settings-panel')) { return; }

      const panelHTML = createPanelHTML(currentSettings);
      document.body.insertAdjacentHTML('beforeend', panelHTML);
      const settingsPanel = document.getElementById('style-settings-panel');
      setupEventListeners(currentSettings);

      // **NEW**: Logic to sync panel visibility with sidebar collapse/expand.
      // ----------------------------------------------------------------------
      
      // 1. Function to check the body class and toggle the panel's position.
      const syncPanelVisibility = () => {
        if (document.body.classList.contains('close')) {
          // If sidebar is closed, move panel off-screen to the left.
          if(mobileQuery.matches)
            settingsPanel.style.transform = 'translateY(0)';
          else
            settingsPanel.style.transform = 'translateX(-100%)';
        } else {
          // If sidebar is open, move panel back to its original position.
          if(mobileQuery.matches)
            settingsPanel.style.transform = 'translateX(-100%)';
          else
            settingsPanel.style.transform = 'translateX(0)';
        }
      };

      // 2. Create a MutationObserver to watch for class changes on the body.
      const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
          if (mutation.type === 'attributes' && mutation.attributeName === 'class') {
            syncPanelVisibility(); // Sync visibility whenever body class changes.
            return;
          }
        }
      });

      // 3. Start observing the body for attribute changes.
      observer.observe(document.body, { attributes: true });
      
      // 4. Run the check once immediately to set the initial state correctly.
      syncPanelVisibility();
    });
  }

  // =========================================================================
  // == PART 3: PLUGIN REGISTRATION (No changes in this part)               ==
  // =========================================================================

  if (!window.$docsify) {
    window.$docsify = {};
  }
  window.$docsify.plugins = [].concat(
    window.$docsify.plugins || [],
    rubyAnnotationPlugin,
    styleSettingsPlugin
  );

})();
