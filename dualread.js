// plugins/ruby-annotation.js

/**
 * Docsify 双语注音插件（最终版）
 * * 工作原理:
 * 1. 使用 'beforeEach' 钩子捕获并暂存原始的 Markdown 内容，但不修改它。
 * 这确保 Docsify 能基于干净的 Markdown 生成正确的边栏目录 (TOC)。
 * 2. 使用 'afterEach' 钩子，在 Docsify 将 Markdown 渲染为 HTML 之后执行。
 * 此时，边栏已生成完毕。我们在这个钩子中获取对应的 *_en.md 文件。
 * 3. 插件将渲染后的 HTML 转换成一个临时的 DOM 结构。
 * 4. 插件逐一遍历 HTML 中的元素（如 <p>, <h1>, <li> 等），并根据暂存的
 * 原始 Markdown 内容和 *_en.md 的内容，将它们替换为 <ruby> 标签结构。
 * 5. 最后，将修改后的 HTML 交还给 Docsify 进行最终的页面显示。
 */
function rubyAnnotation(hook, vm) {

  // 钩子 1: 在 Markdown 解析前，仅保存原始内容。
  hook.beforeEach(function (content, next) {
    // 将当前页面的原始 Markdown 内容暂存到 vm 对象上，供 afterEach 钩子使用。
    vm.originalMarkdown = content;
    // 直接调用 next，不修改任何内容，保证 Docsify 能生成干净的目录。
    next(content);
  });

  // 钩子 2: 在 HTML 渲染后，执行注音添加操作。
  hook.afterEach(function (html, next) {
    // 检查是否存在暂存的 Markdown，如果不存在则直接跳过。
    if (!vm.originalMarkdown) {
      next(html);
      return;
    }

    const mainFilePath = vm.config.nameLink.slice(0, -1) + vm.route.file;

    // 同样只处理 .md 文件
    if (mainFilePath.endsWith('.md')) {
      const enFilePath = mainFilePath.replace('.md', '_en.md');

      fetch(enFilePath)
        .then(response => {
          if (!response.ok) {
            // 如果英文文件不存在，清除暂存并返回原始 HTML。
            delete vm.originalMarkdown;
            next(html);
            return null;
          }
          return response.text();
        })
        .then(enContent => {
          if (enContent) {
            // 将原始 Markdown 和英文内容按行分割，并过滤掉空行。
            const mainLines = vm.originalMarkdown.split('\n').filter(line => line.trim() !== '');
            const enLines = enContent.split('\n').filter(line => line.trim() !== '');

            // 创建一个临时的 DOM 容器来操作渲染好的 HTML。
            const container = document.createElement('div');
            container.innerHTML = html;

            // 选择所有可能包含需要注音文本的块级元素。
            // 顺序通常与 Markdown 源文件中的行顺序一致。
            const elements = container.querySelectorAll('p, li, h1, h2, h3, h4, h5, h6, blockquote, code');

            // 正则表达式，用于移除英文行可能包含的 Markdown 标记。
            const markdownMarkerRegex = /^(#{1,6}\s+|[\*\-\+]\s+|>\s*|\d+\.\s+)/;

            let lineIndex = 0; // 用于追踪 Markdown 文件的行号。
            elements.forEach(element => {
                // 跳过没有文本内容的元素或自定义的 sidebar 元素
                if (!element.textContent.trim() || element.closest('.sidebar-nav')) {
                    return;
                }

                if (lineIndex < mainLines.length) {
                    const mainText = element.textContent; // 获取元素当前的文本内容
                    // 获取对应的英文行，并移除其行首的 Markdown 标记。
                    const enText = (enLines[lineIndex] || '').replace(markdownMarkerRegex, '').trim();

                    if (mainText && enText) {
                        // 使用 <ruby> 标签重建元素的内部 HTML。
                        element.innerHTML = `<ruby>${mainText}<rt>${enText}</rt></ruby>`;
                    }
                    lineIndex++;
                }
            });

            // 清理工作：删除暂存的 Markdown 内容，避免影响其他页面。
            delete vm.originalMarkdown;
            // 将修改后的 HTML 内容传递给 Docsify。
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
      // 如果不是 .md 文件，也需要清理暂存值并继续。
      delete vm.originalMarkdown;
      next(html);
    }
  });
}

// --- 插件注册 ---
if (!window.$docsify) {
  window.$docsify = {};
}
window.$docsify.plugins = [].concat(window.$docsify.plugins || [], rubyAnnotation);
