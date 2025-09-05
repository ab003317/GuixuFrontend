// --- YAML 解析器 ---
// 本文件提供一个简单的YAML解析器对象, 用于将特定格式的YAML字符串与JavaScript对象之间进行相互转换.
//
// 功能函数:
// - YAMLParser.parse(text): 将YAML格式的字符串解析成JavaScript对象.
// - YAMLParser.stringify(data): 将JavaScript对象转换成YAML格式的字符串.
//
// 加载顺序:
// - 本文件应在config.js之后, 在任何需要处理YAML数据的脚本(如worldbookManager.js)之前加载.

const YAMLParser = {
  parse: function (text) {
    if (!text || typeof text !== 'string') return {};
    const lines = text.split('\n');
    const result = {};
    const stack = [{ indent: -1, obj: result, lastKey: null }];

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) continue;

      const indent = line.search(/\S/);

      while (stack.length > 1 && indent <= stack[stack.length - 1].indent) {
        stack.pop();
      }
      const parent = stack[stack.length - 1].obj;
      const lastKeyInParent = stack[stack.length - 1].lastKey;

      if (trimmed.startsWith('- ')) {
        const value = trimmed.substring(2).trim();
        if (lastKeyInParent && Array.isArray(parent[lastKeyInParent])) {
          parent[lastKeyInParent].push(this._parseValue(value));
        }
      } else {
        const colonIndex = trimmed.indexOf(':');
        if (colonIndex > -1) {
          const key = trimmed.substring(0, colonIndex).trim();
          const value = trimmed.substring(colonIndex + 1).trim();

          stack[stack.length - 1].lastKey = key;

          if (value === '|' || value === '>') {
            let multiline = '';
            const blockStartIndex = lines.indexOf(line) + 1;
            for (let i = blockStartIndex; i < lines.length; i++) {
              const nextLine = lines[i];
              const nextIndent = nextLine.search(/\S/);
              if (nextLine.trim() === '' || nextIndent > indent) {
                multiline += nextLine.substring(indent + 2) + '\n';
              } else {
                break;
              }
            }
            parent[key] = multiline.trim();
          } else if (value === '') {
            const nextLine = lines[lines.indexOf(line) + 1] || '';
            const nextTrimmed = nextLine.trim();
            const nextIndent = nextLine.search(/\S/);
            if (nextTrimmed.startsWith('- ') && nextIndent > indent) {
              const newArr = [];
              parent[key] = newArr;
            } else if (nextIndent > indent) {
              const newObj = {};
              parent[key] = newObj;
              stack.push({ indent: indent, obj: newObj, lastKey: null });
            } else {
              parent[key] = '';
            }
          } else {
            parent[key] = this._parseValue(value);
          }
        }
      }
    }
    return result;
  },

  stringify: function (data, indent = '') {
    let yaml = '';
    for (const [key, value] of Object.entries(data)) {
      if (Array.isArray(value)) {
        yaml += `${indent}${key}:\n`;
        for (const item of value) {
          yaml += `${indent}  - ${item}\n`;
        }
      } else if (typeof value === 'object' && value !== null) {
        yaml += `${indent}${key}:\n`;
        yaml += this.stringify(value, indent + '  ');
      } else if (typeof value === 'string' && value.includes('\n')) {
        yaml += `${indent}${key}: |\n`;
        const lines = value.split('\n');
        for (const line of lines) {
          yaml += `${indent}  ${line}\n`;
        }
      } else {
        yaml += `${indent}${key}: ${value}\n`;
      }
    }
    return yaml;
  },

  _parseValue: function (val) {
    const numVal = Number(val);
    if (!isNaN(numVal) && val.trim() !== '') {
      return numVal;
    }
    if (val === 'true') return true;
    if (val === 'false') return false;
    return val;
  },
};
