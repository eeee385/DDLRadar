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

    loadTasks();
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
    var statusLabel = STATUS_LABEL[task.status] || task.status || '';
    var riskLevel = task.risk_level || '';

    return ''
      + '<div class="task-card" style="background:#fff;border-radius:6px;padding:12px 16px;margin-bottom:10px;'
      + 'box-shadow:0 1px 3px rgba(0,0,0,0.08);border-left:4px solid ' + borderColor(riskLevel) + ';">'
      +   '<div style="font-size:15px;font-weight:600;margin-bottom:6px;color:#2d3436;">' + title + '</div>'
      +   '<div style="font-size:12px;color:#636e72;display:flex;flex-wrap:wrap;gap:4px 16px;">'
      +     '<span>课程: ' + course + '</span>'
      +     '<span>类型: ' + typeLabel + '</span>'
      +     '<span>截止: ' + deadline + '</span>'
      +     '<span>优先级: ' + priorityLabel + '</span>'
      +     '<span>状态: ' + statusLabel + '</span>'
      +     '<span>风险: ' + riskLevel + '</span>'
      +   '</div>'
      + '</div>';
  }

  function borderColor(level) {
    if (level === 'high') return '#d63031';
    if (level === 'mid') return '#e17055';
    return '#00b894';
  }

  function escHtml(str) {
    return String(str)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
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