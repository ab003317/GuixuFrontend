/*import 'https://fonts.googleapis.com/css2?family=ZCOOL+KuaiLe&family=Ma+Shan+Zheng&display=swap';
import './scripts.js';
import './style.css';

// 2. 等待 DOM 加载完成后执行
$(() => {
  console.log('归墟界面脚本已加载！');

  // 获取需要操作的 DOM 元素
  const aboutBtn = $('#about-guixu-btn');
  const aboutModal = $('#about-guixu-modal');
  const readBtn = $('#about-read-btn');

  // 显示“关于”弹窗的函数
  const showAboutModal = () => {
    aboutModal.css('display', 'flex').attr('aria-hidden', 'false');
  };

  // 隐藏“关于”弹窗的函数
  const hideAboutModal = () => {
    aboutModal.css('display', 'none').attr('aria-hidden', 'true');
  };

  // --- 事件绑定 ---
  // 点击“关于归墟”按钮，显示弹窗
  aboutBtn.on('click', () => {
    showAboutModal();
  });

  // 点击“已阅读”按钮，关闭弹窗
  readBtn.on('click', () => {
    hideAboutModal();
  });

  // 点击弹窗的灰色背景区域，关闭弹窗
  aboutModal.on('click', event => {
    // `event.target` 是指用户实际点击的元素
    // 如果点击的是弹窗自身（即灰色背景），则关闭它
    if (event.target === aboutModal[0]) {
      hideAboutModal();
    }
  });

  toastr.success('归墟界面加载完成');
});

// 卸载界面时执行的清理操作
$(window).on('pagehide', () => {
  // 在这里可以添加一些清理逻辑，比如移除事件监听器、清除定时器等
  // 对于这个简单的例子，我们只打印一条消息
  console.log('归墟界面已卸载。');
  toastr.info('归墟界面已卸载');
});

console.log('index.ts: 已成功联系 style.css 和 script.js');
*/