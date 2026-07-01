import { MarkdownPageEvent, MarkdownTheme, MarkdownThemeContext } from 'typedoc-plugin-markdown';

export function load(app) {
  app.renderer.on(MarkdownPageEvent.END, page => {
    page.contents = page.contents.replace(/## Default/g, '## 默认值');
    page.contents = page.contents.replace(/## Usage/g, '## 用法');
    page.contents = page.contents.replace(/## Deprecated/g, '## 已弃用');
    page.contents = page.contents.replace(/## Example/g, '## 示例');
    page.contents = page.contents.replace(/#### Type Parameters/g, '#### 类型参数');
    page.contents = page.contents.replace(/\| Type parameter \|/g, '| 类型参数 |');
    page.contents = page.contents.replace(/#### Parameters/g, '#### 参数');
    page.contents = page.contents.replace(/Parameter/g, '参数名');
    page.contents = page.contents.replace(/Type/g, '类型');
    page.contents = page.contents.replace(/Default value/g, '默认值');
    page.contents = page.contents.replace(/Description/g, '描述');
    page.contents = page.contents.replace(/#### Returns/g, '#### 返回值类型');
    page.contents = page.contents.replace(/#### Inherited from/g, '#### 继承自');
    page.contents = page.contents.replace(/#### Example/g, '#### 示例');

    // 四级标题的默认值 -> 加粗 + 单行代码块
    page.contents = page.contents.replace(/#### 默认值\n\n```\w*\n([^\n]+)\n```/g, '**默认值：** `$1`');
    page.contents = page.contents.replace(/#### 示例/g, '**示例：**');

    // 已弃用属性标记
    {
      const sections = page.contents.split('\n\n***\n\n');
      page.contents = sections.map(section => {
        if (!section.includes('#### 已弃用'))
          return section;
        section = section.replace(/^(### [^\n]+)/m, '$1 <Badge type="danger" text="已弃用" />');
        section = section.replace(/\n\n#### 已弃用[\s\S]*/, '');
        return section;
      }).join('\n\n***\n\n');
    }

    page.contents = page.contents.replace(/## Extends\n\n- .+\n\n/g, '');
    page.contents = page.contents.replace(/## Properties/g, '');
    page.contents = page.contents.replace(/## Methods/g, '## 方法');
    page.contents = page.contents.replace(/## Enumeration Members/g, '');

    // 可选属性标题：### name? -> ### name（可选）
    page.contents = page.contents.replace(/^### (\S+)\?$/gm, '### $1（可选）');

    // 剩余四级标题统一转为加粗加冒号
    page.contents = page.contents.replace(/^#### (.+)$/gm, '**$1：**');

    // 单行代码块转为内联代码
    page.contents = page.contents.replace(/```\w*\n([^\n]+)\n```/g, '`$1`');
    // 内联代码紧跟在 label 冒号后面
    page.contents = page.contents.replace(/(\*\*[^*\n]+：\*\*)\n\n(`[^`\n]+`)/g, '$1 $2');
  });

  app.renderer.defineTheme('themeExpand', MyMarkdownTheme);
}

class MyMarkdownTheme extends MarkdownTheme {
  getRenderContext(page) {
    return new MyMarkdownThemeContext(this, page, this.application.options);
  }
}

class MyMarkdownThemeContext extends MarkdownThemeContext {
  partials = {
    ...this.partials,
    pageTitle: () => {
      switch (this.page.model.name) {
        case 'WidgetOptions':
          return '挂件选项';
        case 'ModelOptions':
          return '模型选项';
        case 'MenusOptions':
          return '菜单选项';
        case 'MenuItem':
          return '菜单项';
        case 'TipsOptions':
          return '提示框选项';
        case 'Widget':
          return 'Widget 实例';
        case 'createWidget':
          return '创建挂件';
        default:
          return '';
      }
    },
  };
}
