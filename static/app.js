var DDLRadar = (function () {
  'use strict';

  var API_BASE = 'http://127.0.0.1:3000';
  var dom = {};
  var tasksCache = [];

  var TYPE_LABEL = { homework: '作业', exam: '考试', project: '课程项目', other: '其他' };
  var PRIORITY_LABEL = { high: '高', mid: '中', low: '低' };
  var STATUS_LABEL = { todo: '待办', doing: '进行中', done: '已完成' };

  function init() {
    console.log('DDLRadar frontend loaded');

    dom.dashboard = document.getElementById('dashboard');
    dom.taskForm = document.getElementById('task-form');
    dom.taskList = document.getElementById('task-list');
    dom.aiSuggestion = document.getElementById('ai-suggestion');
    dom.statTotal = document.getElementById('stat-total');
    dom.statTodo = document.getElementById('stat-todo');
    dom.statHighRisk = document.getElementById('stat-high-risk');
    dom.statOverdue = document.getElementById('stat-overdue');
    dom.title = document.getElementById('title');
    dom.course = document.getElementById('course');
    dom.taskType = document.getElementById('task_type');
    dom.deadline = document.getElementById('deadline');
    dom.priority = document.getElementById('priority');
    dom.status = document.getElementById('status');
    dom.description = document.getElementById('description');
    dom.formMessage = document.getElementById('form-message');
    dom.aiForm = document.getElementById('ai-form');
    dom.aiTaskSelect = document.getElementById('ai-task-select');
    dom.aiMessage = document.getElementById('ai-message');
    dom.aiResult = document.getElementById('ai-result');
    dom.aiEmpty = document.getElementById('ai-empty');
    dom.btnWeeklySummary = document.getElementById('btn-weekly-summary');
    dom.aiWeeklyMessage = document.getElementById('ai-weekly-message');
    dom.cfgLabel = document.getElementById('cfg-label');
    dom.cfgApiKey = document.getElementById('cfg-api-key');
    dom.cfgApiBase = document.getElementById('cfg-api-base');
    dom.cfgModel = document.getElementById('cfg-model');
    dom.cfgMessage = document.getElementById('cfg-message');
    dom.btnSaveConfig = document.getElementById('btn-save-config');
    dom.btnResetConfig = document.getElementById('btn-reset-config');

    dom.taskForm.addEventListener('submit', handleFormSubmit);
    dom.aiForm.addEventListener('submit', handleAiSubmit);
    dom.taskList.addEventListener('click', handleTaskListClick);
    dom.taskList.addEventListener('change', handleTaskListChange);
    dom.btnWeeklySummary.addEventListener('click', handleWeeklySummary);
    dom.btnSaveConfig.addEventListener('click', handleSaveConfig);
    dom.btnResetConfig.addEventListener('click', handleResetConfig);

    loadTasks();
    loadDashboard();
    loadConfig();
  }

  function loadTasks() {
    fetch(API_BASE + '/api/tasks')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (json) {
        var tasks;
        if (json && json.success !== undefined && json.data !== undefined) {
          tasks = json.data;
        } else if (Array.isArray(json)) {
          tasks = json;
        } else {
          throw new Error('未知响应格式');
        }
        tasksCache = tasks;
        renderTasks(tasks);
        updateAiTaskSelect(tasks);
      })
      .catch(function (err) {
        console.error('任务列表加载失败:', err);
        tasksCache = [];
        dom.taskList.innerHTML =
          '<p class="placeholder-text" style="color:#d63031;">任务列表加载失败，请检查后端是否运行</p>';
        updateAiTaskSelect([]);
      });
  }

  function loadDashboard() {
    fetch(API_BASE + '/api/dashboard')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (json) {
        var data;
        if (json && json.success !== undefined && json.data !== undefined) {
          data = json.data;
        } else {
          data = json;
        }
        updateDashboardCards(data);
      })
      .catch(function (err) {
        console.error('Dashboard 加载失败:', err);
      });
  }

  function updateAiTaskSelect(tasks) {
    if (!tasks || tasks.length === 0) {
      dom.aiForm.style.display = 'none';
      dom.aiEmpty.style.display = 'block';
      dom.aiResult.style.display = 'none';
      return;
    }

    dom.aiForm.style.display = 'block';
    dom.aiEmpty.style.display = 'none';

    var html = '<option value="">请选择要分析的任务</option>';
    tasks.forEach(function (task) {
      html += '<option value="' + escAttr(String(task.id)) + '">' + escHtml(task.title || '') + '</option>';
    });
    dom.aiTaskSelect.innerHTML = html;
  }

  function handleAiSubmit(e) {
    e.preventDefault();

    var taskId = dom.aiTaskSelect.value;
    if (!taskId) {
      showAiMessage('请先选择一个任务', 'error');
      return;
    }

    var task = null;
    for (var i = 0; i < tasksCache.length; i++) {
      if (String(tasksCache[i].id) === String(taskId)) {
        task = tasksCache[i];
        break;
      }
    }

    if (!task) {
      showAiMessage('未找到所选任务', 'error');
      return;
    }

    var payload = {
      title: task.title || '',
      course: task.course || '',
      task_type: task.task_type || '',
      deadline: task.deadline || '',
      priority: task.priority || 'mid',
      status: task.status || 'todo',
      description: task.description || ''
    };

    showAiMessage('正在获取 AI 建议...', '');

    fetch(API_BASE + '/api/ai/suggest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (body) {
            var detail = body;
            try {
              var parsed = JSON.parse(body);
              detail = parsed.message || body;
            } catch (_) {}
            throw new Error('HTTP ' + res.status + ': ' + detail);
          });
        }
        return res.json();
      })
      .then(function (json) {
        var advice = extractAdvice(json);
        if (advice) {
          showAiMessage('', '');
          dom.aiResult.style.display = 'block';
          dom.aiResult.className = 'ai-result';
          dom.aiResult.innerHTML = renderMarkdown(advice);
        } else {
          showAiMessage('未能获取到建议内容', 'error');
        }
      })
      .catch(function (err) {
        console.error('AI 建议获取失败:', err.message || err);
        var msg = err.message || 'AI 建议获取失败，请稍后重试';
        showAiMessage(msg, 'error');
        dom.aiResult.style.display = 'block';
        dom.aiResult.className = 'ai-result ai-result--error';
        dom.aiResult.innerHTML = escHtml(msg);
      });
  }

  function extractAdvice(json) {
    if (typeof json === 'string') return json;

    if (json && json.advice !== undefined) return json.advice;

    if (json && json.success !== undefined) {
      if (json.data) {
        if (typeof json.data === 'string') return json.data;
        if (json.data.advice !== undefined) return json.data.advice;
      }
      if (json.message && typeof json.message === 'string' && json.message.length > 10) {
        return json.message;
      }
    }

    return null;
  }

  function showAiMessage(msg, type) {
    dom.aiMessage.textContent = msg;
    dom.aiMessage.className = 'form-message' + (type ? ' form-message--' + type : '');
  }

  function updateDashboardCards(data) {
    if (!data) return;

    var total = data.total_tasks !== undefined ? data.total_tasks : '--';
    var todo = data.todo_tasks !== undefined ? data.todo_tasks : '--';
    var highRisk = data.high_risk_tasks !== undefined ? data.high_risk_tasks : '--';
    var overdue = data.overdue_tasks !== undefined ? data.overdue_tasks : '--';

    var totalEl = dom.statTotal.querySelector('.card-value');
    var todoEl = dom.statTodo.querySelector('.card-value');
    var highRiskEl = dom.statHighRisk.querySelector('.card-value');
    var overdueEl = dom.statOverdue.querySelector('.card-value');

    if (totalEl) totalEl.textContent = total;
    if (todoEl) todoEl.textContent = todo;
    if (highRiskEl) highRiskEl.textContent = highRisk;
    if (overdueEl) overdueEl.textContent = overdue;
  }

  function handleFormSubmit(e) {
    e.preventDefault();

    var titleVal = dom.title.value.trim();
    if (!titleVal) {
      showFormMessage('请输入任务标题', 'error');
      return;
    }

    var deadlineVal = dom.deadline.value;
    if (deadlineVal) {
      deadlineVal = deadlineVal.replace('T', ' ');
    }

    var payload = {
      title: titleVal,
      course: dom.course.value.trim(),
      task_type: dom.taskType.value,
      deadline: deadlineVal,
      priority: dom.priority.value,
      status: dom.status.value,
      description: dom.description.value.trim()
    };

    fetch(API_BASE + '/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function () {
        showFormMessage('任务添加成功', 'success');
        dom.taskForm.reset();
        loadTasks();
      })
      .catch(function (err) {
        console.error('任务添加失败:', err);
        showFormMessage('任务添加失败，请检查后端是否运行', 'error');
      });
  }

  function showFormMessage(msg, type) {
    dom.formMessage.textContent = msg;
    dom.formMessage.className = 'form-message form-message--' + type;
  }

  function handleTaskListClick(e) {
    var btn = e.target.closest('.btn-delete');
    if (!btn) return;

    var taskId = btn.getAttribute('data-delete-id');
    if (!taskId) return;

    deleteTask(taskId);
  }

  function deleteTask(taskId) {
    if (!confirm('确定要删除该任务吗？')) return;

    fetch(API_BASE + '/api/tasks/' + encodeURIComponent(taskId), {
      method: 'DELETE'
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function () {
        showFormMessage('任务删除成功', 'success');
        loadTasks();
      })
      .catch(function (err) {
        console.error('任务删除失败:', err);
        showFormMessage('任务删除失败，请检查后端是否运行', 'error');
      });
  }

  function handleTaskListChange(e) {
    var select = e.target.closest('.select-status');
    if (select) {
      handleStatusChange(select);
      return;
    }

    var deadlineInput = e.target.closest('.input-deadline');
    if (deadlineInput) {
      handleDeadlineChange(deadlineInput);
      return;
    }
  }

  function handleStatusChange(select) {
    var card = select.closest('.task-card');
    if (!card) return;

    var taskJson = card.getAttribute('data-task');
    if (!taskJson) return;

    var task;
    try {
      task = JSON.parse(taskJson);
    } catch (err) {
      console.error('解析任务数据失败:', err);
      return;
    }

    var newStatus = select.value;
    if (task.status === newStatus) return;

    var payload = {
      title: task.title || '',
      course: task.course || '',
      task_type: task.task_type || '',
      deadline: task.deadline || '',
      priority: task.priority || 'mid',
      status: newStatus,
      description: task.description || ''
    };

    updateTaskStatus(task.id, payload);
  }

  function handleDeadlineChange(input) {
    var card = input.closest('.task-card');
    if (!card) return;

    var taskJson = card.getAttribute('data-task');
    if (!taskJson) return;

    var task;
    try {
      task = JSON.parse(taskJson);
    } catch (err) {
      console.error('解析任务数据失败:', err);
      return;
    }

    var newDeadline = fromDatetimeLocal(input.value);

    var payload = {
      title: task.title || '',
      course: task.course || '',
      task_type: task.task_type || '',
      deadline: newDeadline,
      priority: task.priority || 'mid',
      status: task.status || 'todo',
      description: task.description || ''
    };

    updateTaskDeadline(task.id, payload);
  }

  function updateTaskStatus(taskId, payload) {
    fetch(API_BASE + '/api/tasks/' + encodeURIComponent(taskId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function () {
        showFormMessage('状态更新成功', 'success');
        loadTasks();
      })
      .catch(function (err) {
        console.error('状态更新失败:', err);
        showFormMessage('状态更新失败，请检查后端是否运行', 'error');
      });
  }

  function updateTaskDeadline(taskId, payload) {
    fetch(API_BASE + '/api/tasks/' + encodeURIComponent(taskId), {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function () {
        showFormMessage('DDL更新成功', 'success');
        loadTasks();
      })
      .catch(function (err) {
        console.error('DDL更新失败:', err);
        showFormMessage('DDL更新失败，请检查后端是否运行', 'error');
      });
  }

  function toDatetimeLocal(str) {
    return String(str).replace(' ', 'T');
  }

  function fromDatetimeLocal(str) {
    return String(str).replace('T', ' ');
  }

  function renderTasks(tasks) {
    if (!tasks || tasks.length === 0) {
      dom.taskList.innerHTML = '<p class="placeholder-text">暂无任务数据，请先添加任务</p>';
      return;
    }

    var html = '';
    tasks.forEach(function (task) {
      html += buildCard(task);
    });
    dom.taskList.innerHTML = html;
  }

  function buildCard(task) {
    var title = escHtml(task.title || '');
    var course = escHtml(task.course || '');
    var typeLabel = TYPE_LABEL[task.task_type] || task.task_type || '';
    var deadline = escHtml(task.deadline || '');
    var priorityLabel = PRIORITY_LABEL[task.priority] || task.priority || '';
    var riskLevel = task.risk_level || '';
    var currentStatus = task.status || 'todo';
    var taskJson = JSON.stringify(task);

    var deadlineLocal = toDatetimeLocal(task.deadline || '');

    var statusOptions = ''
      + '<option value="todo"' + (currentStatus === 'todo' ? ' selected' : '') + '>待办</option>'
      + '<option value="doing"' + (currentStatus === 'doing' ? ' selected' : '') + '>进行中</option>'
      + '<option value="done"' + (currentStatus === 'done' ? ' selected' : '') + '>已完成</option>';

    return ''
      + '<div class="task-card" data-task="' + escAttr(taskJson) + '"'
      + ' style="background:#fff;border-radius:6px;padding:12px 16px;margin-bottom:10px;'
      + 'box-shadow:0 1px 3px rgba(0,0,0,0.08);border-left:4px solid ' + borderColor(riskLevel) + ';'
      + 'display:flex;justify-content:space-between;align-items:flex-start;">'
      +   '<div>'
      +     '<div style="font-size:15px;font-weight:600;margin-bottom:6px;color:#2d3436;">' + title + '</div>'
      +     '<div style="font-size:12px;color:#636e72;display:flex;flex-wrap:wrap;gap:4px 16px;">'
      +       '<span>课程: ' + course + '</span>'
      +       '<span>类型: ' + typeLabel + '</span>'
      +       '<span>截止: ' + deadline + '</span>'
      +       '<span>优先级: ' + priorityLabel + '</span>'
      +       '<span>风险: ' + riskLevel + '</span>'
      +     '</div>'
      +   '</div>'
      +   '<div style="flex-shrink:0;display:flex;flex-direction:column;align-items:flex-end;gap:4px;">'
      +     '<input type="datetime-local" class="input-deadline" value="' + escAttr(deadlineLocal) + '"'
      +     ' style="width:170px;padding:2px 4px;font-size:11px;border:1px solid #dfe6e9;border-radius:3px;background:#fff;">'
      +     '<div style="display:flex;align-items:center;gap:6px;">'
      +       '<select class="select-status" data-task-id="' + escHtml(String(task.id)) + '"'
      +       ' style="padding:3px 6px;font-size:12px;border:1px solid #dfe6e9;border-radius:3px;background:#fff;">'
      +       statusOptions
      +       '</select>'
      +       '<button class="btn-delete" data-delete-id="' + escHtml(String(task.id)) + '"'
      +       ' style="padding:4px 12px;font-size:12px;border:1px solid #d63031;'
      +       'background:#fff;color:#d63031;border-radius:4px;cursor:pointer;">删除</button>'
      +     '</div>'
      +   '</div>'
      + '</div>';
  }

  function borderColor(level) {
    if (level === 'overdue' || level === 'high') return '#d63031';
    if (level === 'mid') return '#e17055';
    if (level === 'completed') return '#b2bec3';
    return '#00b894';
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function escAttr(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;');
  }

  // --- Markdown 渲染 ---
  function renderMarkdown(md) {
    var html = escHtml(String(md));

    // 围栏代码块 ```...```
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function (_, lang, code) {
      return '<pre><code>' + code.trim() + '</code></pre>';
    });

    // 行内代码 `...`
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 标题
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

    // 加粗
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');

    // 斜体
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');

    // 引用块 &gt;  (escHtml 把 > 转成了 &gt;)
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

    // 水平线
    html = html.replace(/^---$/gm, '<hr>');

    // 无序列表：连续 `- ` 行归为一组
    html = html.replace(/((?:^- .+\n?)+)/gm, function (block) {
      var items = block.trim().split('\n').map(function (line) {
        return '<li>' + line.replace(/^- /, '') + '</li>';
      }).join('');
      return '<ul>' + items + '</ul>';
    });

    // 有序列表：连续 `1. ` 行归为一组
    html = html.replace(/((?:^\d+\. .+\n?)+)/gm, function (block) {
      var items = block.trim().split('\n').map(function (line) {
        return '<li>' + line.replace(/^\d+\. /, '') + '</li>';
      }).join('');
      return '<ol>' + items + '</ol>';
    });

    // 段落：按双换行切分，非块级元素包 <p>
    var blocks = html.split(/\n\n+/);
    html = blocks.map(function (block) {
      block = block.trim();
      if (!block) return '';
      if (/^<(h[1-6]|ul|ol|pre|blockquote|hr)/.test(block)) return block;
      block = block.replace(/\n/g, '<br>');
      return '<p>' + block + '</p>';
    }).join('\n');

    return html;
  }

  // --- AI 配置相关 ---

  function loadConfig() {
    fetch(API_BASE + '/api/ai/config')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (json) {
        var data = json.data || json;
        if (data.configured) {
          dom.cfgLabel.textContent = '(LLM · ' + escHtml(data.model) + ')';
          dom.cfgLabel.style.color = '#00b894';
          dom.cfgApiBase.value = data.api_base || '';
          dom.cfgModel.value = data.model || '';
        } else {
          dom.cfgLabel.textContent = '(Mock 模式)';
          dom.cfgLabel.style.color = '#b2bec3';
        }
      })
      .catch(function (err) {
        console.error('加载 AI 配置失败:', err);
      });
  }

  function handleWeeklySummary() {
    dom.aiWeeklyMessage.textContent = '正在生成...';
    dom.aiWeeklyMessage.className = 'form-message';

    fetch(API_BASE + '/api/ai/weekly', { method: 'POST' })
      .then(function (res) {
        if (!res.ok) {
          return res.text().then(function (body) {
            var detail = body;
            try { var p = JSON.parse(body); detail = p.message || body; } catch (_) {}
            throw new Error('HTTP ' + res.status + ': ' + detail);
          });
        }
        return res.json();
      })
      .then(function (json) {
        var advice = extractAdvice(json);
        dom.aiWeeklyMessage.textContent = '生成成功';
        dom.aiWeeklyMessage.className = 'form-message form-message--success';
        dom.aiResult.style.display = 'block';
        dom.aiResult.className = 'ai-result';
        dom.aiResult.innerHTML = renderMarkdown(advice || '无法获取周总结内容');
      })
      .catch(function (err) {
        console.error('周总结生成失败:', err.message || err);
        dom.aiWeeklyMessage.textContent = '生成失败';
        dom.aiWeeklyMessage.className = 'form-message form-message--error';
        dom.aiResult.style.display = 'block';
        dom.aiResult.className = 'ai-result ai-result--error';
        dom.aiResult.innerHTML = escHtml(err.message || '周总结生成失败，请稍后重试');
      });
  }

  function handleSaveConfig() {
    var apiKey = dom.cfgApiKey.value.trim();
    var apiBase = dom.cfgApiBase.value.trim();
    var model = dom.cfgModel.value.trim();

    dom.cfgMessage.textContent = '正在保存...';
    dom.cfgMessage.className = 'form-message';

    fetch(API_BASE + '/api/ai/config', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ api_key: apiKey, api_base: apiBase, model: model })
    })
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function () {
        dom.cfgMessage.textContent = apiKey ? 'LLM 配置已保存' : '已重置为 Mock';
        dom.cfgMessage.className = 'form-message form-message--success';
        dom.cfgApiKey.value = '';
        loadConfig();
      })
      .catch(function (err) {
        console.error('保存配置失败:', err);
        dom.cfgMessage.textContent = '保存失败: ' + (err.message || err);
        dom.cfgMessage.className = 'form-message form-message--error';
      });
  }

  function handleResetConfig() {
    dom.cfgApiKey.value = '';
    dom.cfgApiBase.value = '';
    dom.cfgModel.value = '';
    handleSaveConfig();
  }

  return {
    init: init,
    dom: dom
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  DDLRadar.init();
});