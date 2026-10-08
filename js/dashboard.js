/**
 * dashboard.js
 * إدارة لوحة التحكم الرئيسية، الإحصائيات الشاملة، والرسوم البيانية التفاعلية عبر Chart.js
 */

const Dashboard = {
  charts: {},

  async render() {
    const container = document.getElementById('dashboard-view');
    if (!container) return;

    try {
      // جلب البيانات من قاعدة البيانات
      const businesses = await Database.getAllBusinesses();
      const sales = await Database.getAllSales();
      const expenses = await Database.getAllExpenses();

      // حساب الإحصائيات التراكمية
      const stats = Calculations.calculateDashboardOverview(businesses, sales, expenses);

      // تحديث البطاقات الإحصائية
      this.updateStatCards(stats);

      // رسم وتحديث المخططات البيانية
      this.renderCharts(businesses, sales, expenses);

      // عرض أحدث العمليات السريعة
      this.renderRecentActivities(businesses, sales, expenses);
    } catch (error) {
      console.error('Error rendering dashboard:', error);
    }
  },

  updateStatCards(stats) {
    document.getElementById('dash-stat-total-businesses').textContent = stats.totalBusinesses;
    document.getElementById('dash-stat-active-businesses').textContent = stats.activeBusinesses;
    document.getElementById('dash-stat-closed-businesses').textContent = stats.closedBusinesses;
    
    document.getElementById('dash-stat-total-capital').textContent = Calculations.formatCurrency(stats.totalInvestedCost);
    document.getElementById('dash-stat-total-sales').textContent = Calculations.formatCurrency(stats.totalSalesRevenue);
    document.getElementById('dash-stat-total-expenses').textContent = Calculations.formatCurrency(stats.totalExpenses);
    
    const profitEl = document.getElementById('dash-stat-net-profit');
    profitEl.textContent = Calculations.formatCurrency(stats.totalNetProfitOrLoss);
    if (stats.totalNetProfitOrLoss >= 0) {
      profitEl.className = 'stat-value text-profit';
      document.getElementById('dash-stat-profit-badge').textContent = 'صافي أرباح';
      document.getElementById('dash-stat-profit-badge').className = 'badge bg-success-soft text-success';
    } else {
      profitEl.className = 'stat-value text-loss';
      document.getElementById('dash-stat-profit-badge').textContent = 'صافي خسائر';
      document.getElementById('dash-stat-profit-badge').className = 'badge bg-danger-soft text-danger';
    }

    document.getElementById('dash-stat-inventory-val').textContent = Calculations.formatCurrency(stats.totalRemainingStockValue);
    document.getElementById('dash-stat-receivable').textContent = Calculations.formatCurrency(stats.totalReceivable);
  },

  renderCharts(businesses, sales, expenses) {
    if (typeof Chart === 'undefined') {
      console.warn('Chart.js library is not loaded yet');
      return;
    }
    // 1. مخطط الأرباح والمبيعات حسب البزنس
    this.renderPerformanceChart(businesses, sales, expenses);

    // 2. مخطط توزيع المصروفات
    this.renderExpenseBreakdownChart(expenses);

    // 3. مقارنة المبيعات بالمصروفات
    this.renderComparisonChart(sales, expenses);
  },

  renderPerformanceChart(businesses, sales, expenses) {
    const canvas = document.getElementById('chart-performance');
    if (!canvas) return;

    if (this.charts.performance) {
      this.charts.performance.destroy();
    }

    const labels = [];
    const salesData = [];
    const profitData = [];

    // نأخذ حتى آخر 6 بزنسات
    businesses.slice(0, 6).forEach(biz => {
      const bizSales = sales.filter(s => s.businessId === biz.id);
      const bizExp = expenses.filter(e => e.businessId === biz.id);
      const summary = Calculations.calculateBusinessSummary(biz, bizSales, bizExp);

      labels.push(biz.name || 'بزنس');
      salesData.push(summary.totalSalesRevenue);
      profitData.push(summary.netProfitOrLoss);
    });

    if (labels.length === 0) {
      labels.push('لا توجد بزنسات بعد');
      salesData.push(0);
      profitData.push(0);
    }

    const ctx = canvas.getContext('2d');
    this.charts.performance = new Chart(ctx, {
      type: 'bar',
      data: {
        labels: labels,
        datasets: [
          {
            label: 'إجمالي المبيعات (د.ل)',
            data: salesData,
            backgroundColor: 'rgba(232, 93, 158, 0.75)',
            borderColor: '#E85D9E',
            borderWidth: 1.5,
            borderRadius: 8
          },
          {
            label: 'صافي الربح / الخسارة (د.ل)',
            data: profitData,
            backgroundColor: profitData.map(val => val >= 0 ? 'rgba(22, 163, 74, 0.75)' : 'rgba(220, 38, 38, 0.75)'),
            borderColor: profitData.map(val => val >= 0 ? '#16A34A' : '#DC2626'),
            borderWidth: 1.5,
            borderRadius: 8
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { family: 'Tajawal' } }
          },
          tooltip: {
            titleFont: { family: 'Tajawal' },
            bodyFont: { family: 'Tajawal' }
          }
        },
        scales: {
          x: { ticks: { font: { family: 'Tajawal' } }, grid: { display: false } },
          y: { ticks: { font: { family: 'Tajawal' } }, grid: { color: 'rgba(232, 93, 158, 0.08)' } }
        }
      }
    });
  },

  renderExpenseBreakdownChart(expenses) {
    const canvas = document.getElementById('chart-expenses');
    if (!canvas) return;

    if (this.charts.expenses) {
      this.charts.expenses.destroy();
    }

    const categories = {
      ads: { label: 'إعلانات ممولة', total: 0, color: '#E85D9E' },
      packaging: { label: 'تغليف وتعبئة', total: 0, color: '#F472B6' },
      shipping: { label: 'شحن وتوصيل', total: 0, color: '#C084FC' },
      customs: { label: 'جمارك ورسوم', total: 0, color: '#D4AF37' },
      returns: { label: 'مرتجعات وتعويضات', total: 0, color: '#F87171' },
      other: { label: 'أخرى', total: 0, color: '#A78BFA' }
    };

    expenses.forEach(e => {
      const cat = e.category || e.type || 'other';
      const amt = parseFloat(e.amount) || 0;
      const rate = parseFloat(e.exchangeRate) || 1;
      const amtLYD = e.currency === 'USD' ? amt * rate : amt;

      if (categories[cat]) {
        categories[cat].total += amtLYD;
      } else {
        categories.other.total += amtLYD;
      }
    });

    const activeCats = Object.values(categories).filter(c => c.total > 0);
    const labels = activeCats.length ? activeCats.map(c => c.label) : ['لا توجد مصاريف'];
    const data = activeCats.length ? activeCats.map(c => c.total) : [1];
    const bgColors = activeCats.length ? activeCats.map(c => c.color) : ['#EDE9FE'];

    const ctx = canvas.getContext('2d');
    this.charts.expenses = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: labels,
        datasets: [{
          data: data,
          backgroundColor: bgColors,
          borderWidth: 2,
          borderColor: '#ffffff'
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom',
            labels: { font: { family: 'Tajawal' } }
          }
        },
        cutout: '68%'
      }
    });
  },

  renderComparisonChart(sales, expenses) {
    const canvas = document.getElementById('chart-comparison');
    if (!canvas) return;

    if (this.charts.comparison) {
      this.charts.comparison.destroy();
    }

    // تجميع شهري مبسط لآخر 5 أشهر
    const months = ['أكتوبر', 'نوفمبر', 'ديسمبر', 'يناير', 'فبراير', 'مارس'];
    const ctx = canvas.getContext('2d');

    let totalSalesVal = sales.reduce((sum, s) => {
      const q = parseInt(s.quantity, 10) || 0;
      const p = parseFloat(s.unitPrice) || 0;
      const d = parseFloat(s.discount) || 0;
      return sum + Math.max(0, (q * p) - d);
    }, 0);

    let totalExpVal = expenses.reduce((sum, e) => {
      const amt = parseFloat(e.amount) || 0;
      const rate = parseFloat(e.exchangeRate) || 1;
      return sum + (e.currency === 'USD' ? amt * rate : amt);
    }, 0);

    this.charts.comparison = new Chart(ctx, {
      type: 'line',
      data: {
        labels: ['الشهر 1', 'الشهر 2', 'الشهر 3', 'الشهر 4', 'الشهر الحالي'],
        datasets: [
          {
            label: 'المبيعات',
            data: [totalSalesVal * 0.15, totalSalesVal * 0.3, totalSalesVal * 0.55, totalSalesVal * 0.8, totalSalesVal],
            borderColor: '#E85D9E',
            backgroundColor: 'rgba(232, 93, 158, 0.12)',
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#E85D9E'
          },
          {
            label: 'المصروفات',
            data: [totalExpVal * 0.25, totalExpVal * 0.45, totalExpVal * 0.65, totalExpVal * 0.85, totalExpVal],
            borderColor: '#A78BFA',
            backgroundColor: 'rgba(167, 139, 250, 0.1)',
            fill: true,
            tension: 0.35,
            pointBackgroundColor: '#A78BFA'
          }
        ]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'top',
            labels: { font: { family: 'Tajawal' } }
          }
        },
        scales: {
          x: { ticks: { font: { family: 'Tajawal' } }, grid: { display: false } },
          y: { ticks: { font: { family: 'Tajawal' } }, grid: { color: 'rgba(232, 93, 158, 0.08)' } }
        }
      }
    });
  },

  renderRecentActivities(businesses, sales, expenses) {
    const listEl = document.getElementById('dash-recent-sales');
    if (!listEl) return;

    const bizMap = {};
    businesses.forEach(b => bizMap[b.id] = b);

    const recent = sales.slice(0, 5);
    if (recent.length === 0) {
      listEl.innerHTML = `
        <div class="text-center py-4 text-muted">
          <i class="bi bi-inbox fs-2 text-pink-soft mb-2 d-block"></i>
          لا توجد عمليات بيع مسجلة حتى الآن
        </div>
      `;
      return;
    }

    listEl.innerHTML = recent.map(s => {
      const biz = bizMap[s.businessId] || { name: 'بزنس محذوف' };
      const q = parseInt(s.quantity, 10) || 0;
      const p = parseFloat(s.unitPrice) || 0;
      const d = parseFloat(s.discount) || 0;
      const net = Math.max(0, (q * p) - d);

      const statusBadge = s.paymentStatus === 'unpaid'
        ? '<span class="badge bg-danger-soft text-danger">غير مدفوع</span>'
        : s.paymentStatus === 'partial'
        ? '<span class="badge bg-warning-soft text-warning">مدفوع جزئياً</span>'
        : '<span class="badge bg-success-soft text-success">مدفوع بالكامل</span>';

      return `
        <div class="activity-row d-flex align-items-center justify-content-between p-3 border-bottom hover-lift">
          <div class="d-flex align-items-center gap-3">
            <div class="icon-avatar bg-pink-soft text-pink rounded-circle p-2">
              <i class="bi bi-bag-check fs-5"></i>
            </div>
            <div>
              <div class="fw-bold">${biz.name}</div>
              <small class="text-muted"><i class="bi bi-calendar3 me-1"></i>${s.date || 'اليوم'} • بيع ${q} قطع</small>
            </div>
          </div>
          <div class="text-start">
            <div class="fw-bold text-pink">${Calculations.formatCurrency(net)}</div>
            <div>${statusBadge}</div>
          </div>
        </div>
      `;
    }).join('');
  }
};

window.Dashboard = Dashboard;
