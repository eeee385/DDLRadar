var DDLRadar = (function () {
  'use strict';

  var API_BASE = 'http://127.0.0.1:3000';
  var dom = {};

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

    dom.taskForm.addEventListener('submit', handleFormSubmit);
    dom.taskList.addEventListener('click', handleTaskListClick);
    dom.taskList.addEventListener('change', handleTaskListChange);

    loadTasks();
    loadDashboard();
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
        renderTasks(tasks);
      })
      .catch(function (err) {
        console.error('任务列表加载失败:', err);
        dom.taskList.innerHTML =
          '<p class="placeholder-text" style="color:#d63031;">任务列表加载失败，请检查后端是否运行</p>';
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

  return {
    init: init,
    dom: dom
  };
})();

document.addEventListener('DOMContentLoaded', function () {
  DDLRadar.init();
});