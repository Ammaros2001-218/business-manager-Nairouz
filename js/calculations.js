/**
 * calculations.js
 * وحدة الحسابات المالية الدقيقة لمشروع Business Manager
 * تعتمد على الدينار الليبي (LYD) كعملة أساسية، مع تحويل وتتبع المبالغ بالدولار (USD)
 */

const Calculations = {
  /**
   * حساب إجمالي تكلفة البضاعة والمخزون بالدينار الليبي
   * يمنع الازدواجية: إذا اختار المستخدم الشراء بالدولار، يتم تحويل المبلغ عبر سعر الصرف
   * بالإضافة إلى مصاريف الشحن والجمارك والمصاريف الإضافية بالدينار
   */
  calculateTotalInitialCost(params) {
    const currency = params.currency || 'LYD'; // العملة المدخلة للبضاعة
    const costInLYD = parseFloat(params.costInLYD) || 0;
    const costInUSD = parseFloat(params.costInUSD) || 0;
    const exchangeRate = parseFloat(params.exchangeRate) || 1;
    const shippingCost = parseFloat(params.shippingCost) || 0;
    const customsCost = parseFloat(params.customsCost) || 0;
    const additionalCost = parseFloat(params.additionalCost) || 0;

    let baseInventoryCostLYD = 0;
    if (currency === 'USD') {
      baseInventoryCostLYD = costInUSD * exchangeRate;
    } else {
      baseInventoryCostLYD = costInLYD;
    }

    const totalCostLYD = baseInventoryCostLYD + shippingCost + customsCost + additionalCost;

    return {
      baseInventoryCostLYD: Number(baseInventoryCostLYD.toFixed(2)),
      shippingCost: Number(shippingCost.toFixed(2)),
      customsCost: Number(customsCost.toFixed(2)),
      additionalCost: Number(additionalCost.toFixed(2)),
      totalCostLYD: Number(totalCostLYD.toFixed(2))
    };
  },

  /**
   * حساب تكلفة القطعة الواحدة:
   * إجمالي تكلفة المخزون (شاملاً الشحن والجمارك) ÷ عدد القطع المشتراة
   */
  calculateUnitCost(totalCostLYD, totalUnits) {
    const units = parseInt(totalUnits, 10) || 0;
    if (units <= 0) return 0;
    return Number((totalCostLYD / units).toFixed(3));
  },

  /**
   * حساب إحصائيات عملية بيع فردية:
   * صافي البيع = (الكمية * سعر القطعة) - الخصم
   * تكلفة البضاعة المباعة (COGS) = الكمية * تكلفة القطعة الواحدة
   * ربح العملية = صافي البيع - تكلفة البضاعة المباعة - مصاريف البيع
   * المبلغ المتبقي (المستحق) = صافي البيع - المبلغ المدفوع
   */
  calculateSaleItem(sale, unitCost = 0) {
    const quantity = parseInt(sale.quantity, 10) || 0;
    const unitPrice = parseFloat(sale.unitPrice) || 0;
    const discount = parseFloat(sale.discount) || 0;
    const saleExpense = parseFloat(sale.saleExpense) || 0;
    const paidAmount = parseFloat(sale.paidAmount) || 0;

    const grossTotal = quantity * unitPrice;
    const netTotal = Math.max(0, grossTotal - discount);
    const cogs = quantity * unitCost;
    const netProfit = netTotal - cogs - saleExpense;
    const remainingAmount = Math.max(0, netTotal - paidAmount);

    return {
      grossTotal: Number(grossTotal.toFixed(2)),
      netTotal: Number(netTotal.toFixed(2)),
      cogs: Number(cogs.toFixed(2)),
      saleExpense: Number(saleExpense.toFixed(2)),
      paidAmount: Number(paidAmount.toFixed(2)),
      netProfit: Number(netProfit.toFixed(2)),
      remainingAmount: Number(remainingAmount.toFixed(2)),
      isFullyPaid: remainingAmount <= 0.001
    };
  },

  /**
   * حساب الإحصائيات الشاملة لبزنس واحد:
   * @param {Object} business بيانات البزنس
   * @param {Array} sales قائمة مبيعات البزنس
   * @param {Array} expenses قائمة مصروفات البزنس
   */
  calculateBusinessSummary(business, sales = [], expenses = []) {
    const totalUnits = parseInt(business.totalUnits, 10) || 0;
    const unitCost = parseFloat(business.unitCost) || 0;
    const totalCostLYD = parseFloat(business.totalCostLYD) || (unitCost * totalUnits);

    // حساب كميات المبيعات والمبالغ
    let soldUnits = 0;
    let totalSalesRevenue = 0; // صافي المبيعات
    let totalCollectedSales = 0; // المبالغ المحصلة فعلاً
    let totalSalesExpenses = 0; // مصاريف مرتبطة بعمليات البيع المباشرة
    let totalSalesCogs = 0; // تكلفة البضاعة المباعة

    sales.forEach(sale => {
      const q = parseInt(sale.quantity, 10) || 0;
      soldUnits += q;

      const calc = this.calculateSaleItem(sale, unitCost);
      totalSalesRevenue += calc.netTotal;
      totalCollectedSales += calc.paidAmount;
      totalSalesExpenses += calc.saleExpense;
      totalSalesCogs += calc.cogs;
    });

    const remainingUnits = Math.max(0, totalUnits - soldUnits);
    const remainingStockValue = Number((remainingUnits * unitCost).toFixed(2));
    const totalReceivable = Math.max(0, totalSalesRevenue - totalCollectedSales);

    // حساب المصروفات العامة (إعلانات، تغليف، شحن، أخرى...)
    let generalExpensesTotal = 0;
    let adExpensesTotal = 0;

    expenses.forEach(exp => {
      const amt = parseFloat(exp.amount) || 0;
      // إذا كان المصروف بالدولار وتم توفير سعر الصرف
      const rate = parseFloat(exp.exchangeRate) || 1;
      const amtLYD = exp.currency === 'USD' ? amt * rate : amt;

      generalExpensesTotal += amtLYD;
      if (exp.category === 'ads' || exp.type === 'ads') {
        adExpensesTotal += amtLYD;
      }
    });

    // إجمالي المصروفات تشمل المصروفات العامة + المصروفات المرتبطة بالمبيعات
    const totalExpenses = generalExpensesTotal + totalSalesExpenses;

    // صافي الربح = إجمالي صافي المبيعات - تكلفة البضاعة المباعة - المصروفات الإضافية
    const netProfitOrLoss = totalSalesRevenue - totalSalesCogs - totalExpenses;

    // نسبة الربح = (صافي الربح ÷ صافي المبيعات) * 100
    let profitMarginPercentage = 0;
    if (totalSalesRevenue > 0) {
      profitMarginPercentage = Number(((netProfitOrLoss / totalSalesRevenue) * 100).toFixed(2));
    }

    return {
      totalUnits,
      soldUnits,
      remainingUnits,
      unitCost: Number(unitCost.toFixed(3)),
      totalCostLYD: Number(totalCostLYD.toFixed(2)),
      remainingStockValue,
      totalSalesRevenue: Number(totalSalesRevenue.toFixed(2)),
      totalCollectedSales: Number(totalCollectedSales.toFixed(2)),
      totalReceivable: Number(totalReceivable.toFixed(2)),
      totalSalesExpenses: Number(totalSalesExpenses.toFixed(2)),
      generalExpensesTotal: Number(generalExpensesTotal.toFixed(2)),
      adExpensesTotal: Number(adExpensesTotal.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      cogs: Number(totalSalesCogs.toFixed(2)),
      netProfitOrLoss: Number(netProfitOrLoss.toFixed(2)),
      profitMarginPercentage,
      isProfit: netProfitOrLoss >= 0
    };
  },

  /**
   * حساب الإحصائيات الإجمالية لجميع البزنسات في لوحة التحكم Dashboard
   */
  calculateDashboardOverview(businesses = [], allSales = [], allExpenses = []) {
    let totalBusinesses = businesses.length;
    let activeBusinesses = 0;
    let closedBusinesses = 0;

    let totalInvestedCost = 0; // إجمالي رأس المال وتكلفة شراء البضائع
    let totalSalesRevenue = 0; // إجمالي المبيعات
    let totalExpenses = 0; // إجمالي المصروفات
    let totalNetProfitOrLoss = 0; // صافي الأرباح
    let totalRemainingStockValue = 0; // قيمة المخزون المتبقي
    let totalReceivable = 0; // المبالغ المستحقة من العملاء

    // تجميع المبيعات والمصروفات بحسب البزنس
    const salesByBiz = {};
    const expensesByBiz = {};

    allSales.forEach(s => {
      const bId = s.businessId;
      if (!salesByBiz[bId]) salesByBiz[bId] = [];
      salesByBiz[bId].push(s);
    });

    allExpenses.forEach(e => {
      const bId = e.businessId;
      if (!expensesByBiz[bId]) expensesByBiz[bId] = [];
      expensesByBiz[bId].push(e);
    });

    businesses.forEach(biz => {
      if (biz.status === 'closed') {
        closedBusinesses++;
      } else {
        activeBusinesses++;
      }

      const bizSales = salesByBiz[biz.id] || [];
      const bizExpenses = expensesByBiz[biz.id] || [];
      const summary = this.calculateBusinessSummary(biz, bizSales, bizExpenses);

      totalInvestedCost += summary.totalCostLYD;
      totalSalesRevenue += summary.totalSalesRevenue;
      totalExpenses += summary.totalExpenses;
      totalNetProfitOrLoss += summary.netProfitOrLoss;
      totalRemainingStockValue += summary.remainingStockValue;
      totalReceivable += summary.totalReceivable;
    });

    return {
      totalBusinesses,
      activeBusinesses,
      closedBusinesses,
      totalInvestedCost: Number(totalInvestedCost.toFixed(2)),
      totalSalesRevenue: Number(totalSalesRevenue.toFixed(2)),
      totalExpenses: Number(totalExpenses.toFixed(2)),
      totalNetProfitOrLoss: Number(totalNetProfitOrLoss.toFixed(2)),
      totalRemainingStockValue: Number(totalRemainingStockValue.toFixed(2)),
      totalReceivable: Number(totalReceivable.toFixed(2))
    };
  },

  /**
   * تنسيق العملة لعرض واضح
   */
  formatCurrency(amount, currency = 'د.ل') {
    const val = Number(amount) || 0;
    return `${val.toLocaleString('ar-LY', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency}`;
  },

  /**
   * تنسيق العملة بالإنجليزية أو بدون رمز
   */
  formatNumber(val) {
    const num = Number(val) || 0;
    return num.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  }
};

window.Calculations = Calculations;
