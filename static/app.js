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
    dom.submitBtn = dom.taskForm.querySelector('button[type="submit"]');
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

    dom.taskModal = document.getElementById('task-modal');
    dom.taskModalContent = document.getElementById('task-modal-content');
    dom.aiModal = document.getElementById('ai-modal');
    dom.aiModalTitle = document.getElementById('ai-modal-title');
    dom.aiModalMeta = document.getElementById('ai-modal-meta');
    dom.aiModalContent = document.getElementById('ai-modal-content');

    dom.taskForm.addEventListener('submit', handleFormSubmit);
    dom.aiForm.addEventListener('submit', handleAiSubmit);
    dom.taskList.addEventListener('click', handleTaskListClick);
    dom.taskList.addEventListener('change', handleTaskListChange);
    dom.btnWeeklySummary.addEventListener('click', handleWeeklySummary);
    dom.btnSaveConfig.addEventListener('click', handleSaveConfig);
    dom.btnResetConfig.addEventListener('click', handleResetConfig);

    document.addEventListener('click', handleGlobalClick);
    document.addEventListener('keydown', handleGlobalKeydown);

    loadTasks();
    loadDashboard();
    loadConfig();
  }

  function handleGlobalClick(e) {
    var closeBtn = e.target.closest('[data-close-modal]');
    if (closeBtn) {
      closeModal(closeBtn.getAttribute('data-close-modal'));
      return;
    }

    var detailBtn = e.target.closest('.btn-view-detail');
    if (detailBtn) {
      var taskId = detailBtn.getAttribute('data-view-id');
      openTaskDetail(taskId);
      return;
    }

    var card = e.target.closest('.task-card');
    if (card && !e.target.closest('.task-card__actions') && !e.target.closest('.btn-delete') && !e.target.closest('.select-status') && !e.target.closest('.input-deadline')) {
      var taskIdFromCard = card.getAttribute('data-task-id');
      openTaskDetail(taskIdFromCard);
    }
  }

  function handleGlobalKeydown(e) {
    if (e.key === 'Escape') {
      closeModal('task-modal');
      closeModal('ai-modal');
    }
  }

  function openModal(id) {
    var modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    document.body.classList.add('modal-open');
  }

  function closeModal(id) {
    var modal = document.getElementById(id);
    if (!modal) return;
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');

    if (!document.querySelector('.modal.is-open')) {
      document.body.classList.remove('modal-open');
    }
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

    var task = findTaskById(taskId);
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
          showAiMessage('生成成功', 'success');
          dom.aiResult.style.display = 'none';
          openAiModal('AI 建议', advice);
        } else {
          showAiMessage('未能获取到建议内容', 'error');
        }
      })
      .catch(function (err) {
        console.error('AI 建议获取失败:', err.message || err);
        var msg = err.message || 'AI 建议获取失败，请稍后重试';
        showAiMessage(msg, 'error');
        openAiModal('AI 建议', escHtml(msg), true);
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
            try {
              var p = JSON.parse(body);
              detail = p.message || body;
            } catch (_) {}
            throw new Error('HTTP ' + res.status + ': ' + detail);
          });
        }
        return res.json();
      })
      .then(function (json) {
        var advice = extractAdvice(json);
        dom.aiWeeklyMessage.textContent = '生成成功';
        dom.aiWeeklyMessage.className = 'form-message form-message--success';
        openAiModal('AI 周总结', advice || '无法获取周总结内容');
      })
      .catch(function (err) {
        console.error('周总结生成失败:', err.message || err);
        dom.aiWeeklyMessage.textContent = '生成失败';
        dom.aiWeeklyMessage.className = 'form-message form-message--error';
        openAiModal('AI 周总结', escHtml(err.message || '周总结生成失败，请稍后重试'), true);
      });
  }

  function openAiModal(title, content, isError) {
    dom.aiModalTitle.textContent = title;
    dom.aiModalMeta.textContent = '生成时间：' + formatNow();
    dom.aiModalContent.className = 'ai-result ai-result--modal' + (isError ? ' ai-result--error' : '');
    dom.aiModalContent.innerHTML = isError ? content : renderMarkdown(content);
    openModal('ai-modal');
  }

  function openTaskDetail(taskId) {
    var task = findTaskById(taskId);
    if (!task) return;

    var typeLabel = TYPE_LABEL[task.task_type] || task.task_type || '未分类';
    var priorityLabel = PRIORITY_LABEL[task.priority] || task.priority || '中';
    var statusLabel = STATUS_LABEL[task.status] || task.status || '待办';
    var riskText = getRiskText(task.risk_level || 'low');

    var html = ''
      + '<div class="detail-grid">'
      +   '<div class="detail-item"><span class="detail-label">任务标题</span><div class="detail-value detail-value--title">' + escHtml(task.title || '未命名任务') + '</div></div>'
      +   '<div class="detail-item"><span class="detail-label">课程名称</span><div class="detail-value">' + escHtml(task.course || '未填写') + '</div></div>'
      +   '<div class="detail-item"><span class="detail-label">任务类型</span><div class="detail-value">' + escHtml(typeLabel) + '</div></div>'
      +   '<div class="detail-item"><span class="detail-label">截止时间</span><div class="detail-value">' + escHtml(task.deadline || '未设置') + '</div></div>'
      +   '<div class="detail-item"><span class="detail-label">优先级</span><div class="detail-value">' + escHtml(priorityLabel) + '</div></div>'
      +   '<div class="detail-item"><span class="detail-label">状态</span><div class="detail-value">' + escHtml(statusLabel) + '</div></div>'
      +   '<div class="detail-item"><span class="detail-label">风险等级</span><div class="detail-value">' + escHtml(riskText) + '</div></div>'
      +   '<div class="detail-item detail-item--full"><span class="detail-label">任务描述</span><div class="detail-value detail-value--description">' + nl2br(escHtml(task.description || '暂无描述')) + '</div></div>'
      + '</div>';

    dom.taskModalContent.innerHTML = html;
    openModal('task-modal');
  }

  function findTaskById(taskId) {
    for (var i = 0; i < tasksCache.length; i++) {
      if (String(tasksCache[i].id) === String(taskId)) {
        return tasksCache[i];
      }
    }
    return null;
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

    dom.title.classList.remove('input-error');

    var titleVal = dom.title.value.trim();
    if (!titleVal) {
      dom.title.classList.add('input-error');
      dom.title.focus();
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

    if (dom.submitBtn) {
      dom.submitBtn.disabled = true;
      dom.submitBtn.textContent = '提交中...';
    }

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
        loadDashboard();

        var taskListSection = document.getElementById('task-list-section');
        if (taskListSection) {
          taskListSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
      })
      .catch(function (err) {
        console.error('任务添加失败:', err);
        showFormMessage('任务添加失败，请检查后端是否运行', 'error');
      })
      .finally(function () {
        if (dom.submitBtn) {
          dom.submitBtn.disabled = false;
          dom.submitBtn.textContent = '添加任务';
        }
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
        loadDashboard();
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
        loadDashboard();
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
        loadDashboard();
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
    var title = escHtml(task.title || '未命名任务');
    var course = escHtml(task.course || '未填写课程');
    var typeLabel = TYPE_LABEL[task.task_type] || task.task_type || '未分类';
    var deadline = escHtml(task.deadline || '未设置');
    var priorityLabel = PRIORITY_LABEL[task.priority] || task.priority || '中';
    var riskLevel = task.risk_level || 'low';
    var currentStatus = task.status || 'todo';
    var taskJson = JSON.stringify(task);
    var deadlineLocal = toDatetimeLocal(task.deadline || '');

    var statusText = STATUS_LABEL[currentStatus] || '待办';
    var riskText = getRiskText(riskLevel);

    var statusOptions = ''
      + '<option value="todo"' + (currentStatus === 'todo' ? ' selected' : '') + '>待办</option>'
      + '<option value="doing"' + (currentStatus === 'doing' ? ' selected' : '') + '>进行中</option>'
      + '<option value="done"' + (currentStatus === 'done' ? ' selected' : '') + '>已完成</option>';

    return ''
      + '<article class="task-card" data-task="' + escAttr(taskJson) + '" data-task-id="' + escAttr(String(task.id)) + '">'
      +   '<div class="task-card__main">'
      +     '<div class="task-card__header">'
      +       '<h3 class="task-card__title">' + title + '</h3>'
      +       '<div class="task-card__badges">'
      +         '<span class="badge badge--risk badge--risk-' + escAttr(riskLevel) + '">' + escHtml(riskText) + '</span>'
      +         '<span class="badge badge--priority badge--priority-' + escAttr(task.priority || 'mid') + '">优先级：' + escHtml(priorityLabel) + '</span>'
      +       '</div>'
      +     '</div>'

      +     '<div class="task-card__meta">'
      +       '<span class="task-card__meta-item">课程：' + course + '</span>'
      +       '<span class="task-card__meta-item">类型：' + escHtml(typeLabel) + '</span>'
      +       '<span class="task-card__meta-item task-card__meta-item--deadline">截止：' + deadline + '</span>'
      +     '</div>'

      +     '<div class="task-card__footer">'
      +       '<span class="badge badge--status badge--status-' + escAttr(currentStatus) + '">' + escHtml(statusText) + '</span>'
      +       '<button type="button" class="btn-link btn-view-detail" data-view-id="' + escAttr(String(task.id)) + '">查看详情</button>'
      +     '</div>'
      +   '</div>'

      +   '<div class="task-card__actions">'
      +     '<label class="task-card__field">'
      +       '<span class="task-card__field-label">截止时间</span>'
      +       '<input type="datetime-local" class="input-deadline" value="' + escAttr(deadlineLocal) + '">'
      +     '</label>'

      +     '<div class="task-card__action-row">'
      +       '<label class="task-card__field task-card__field--compact">'
      +         '<span class="task-card__field-label">状态</span>'
      +         '<select class="select-status" data-task-id="' + escHtml(String(task.id)) + '">'
      +           statusOptions
      +         '</select>'
      +       '</label>'

      +       '<button class="btn-delete" data-delete-id="' + escHtml(String(task.id)) + '">删除</button>'
      +     '</div>'
      +   '</div>'
      + '</article>';
  }

  function getRiskText(level) {
    if (level === 'overdue') return '已逾期';
    if (level === 'high') return '高风险';
    if (level === 'mid') return '中风险';
    if (level === 'completed') return '已完成';
    return '低风险';
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

  function nl2br(str) {
    return String(str).replace(/\n/g, '<br>');
  }

  function formatNow() {
    var d = new Date();
    var y = d.getFullYear();
    var m = String(d.getMonth() + 1).padStart(2, '0');
    var day = String(d.getDate()).padStart(2, '0');
    var h = String(d.getHours()).padStart(2, '0');
    var min = String(d.getMinutes()).padStart(2, '0');
    var s = String(d.getSeconds()).padStart(2, '0');
    return y + '-' + m + '-' + day + ' ' + h + ':' + min + ':' + s;
  }

  function renderMarkdown(md) {
    var html = escHtml(String(md));

    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function (_, lang, code) {
      return '<pre><code>' + code.trim() + '</code></pre>';
    });

    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
    html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
    html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
    html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');
    html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
    html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');
    html = html.replace(/^---$/gm, '<hr>');

    html = html.replace(/((?:^- .+\n?)+)/gm, function (block) {
      var items = block.trim().split('\n').map(function (line) {
        return '<li>' + line.replace(/^- /, '') + '</li>';
      }).join('');
      return '<ul>' + items + '</ul>';
    });

    html = html.replace(/((?:^\d+\. .+\n?)+)/gm, function (block) {
      var items = block.trim().split('\n').map(function (line) {
        return '<li>' + line.replace(/^\d+\. /, '') + '</li>';
      }).join('');
      return '<ol>' + items + '</ol>';
    });

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

  function loadConfig() {
    fetch(API_BASE + '/api/ai/config')
      .then(function (res) {
        if (!res.ok) throw new Error('HTTP ' + res.status);
        return res.json();
      })
      .then(function (json) {
        var data = json.data || json;
        if (data.configured) {
          dom.cfgLabel.textContent = '(LLM · ' + data.model + ')';
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
