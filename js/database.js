/**
 * database.js
 * طبقة الوصول للبيانات Data Access Layer (DAL)
 * تدعم Cloud Firestore مباشرة عند توفر بيانات الاعتماد الصالحة،
 * وتتضمن حماية Fallback تخزين محلي (LocalStorage) تلقائياً لمعاينة الموقع واختباره بسلاسة على أي جهاز أو GitHub Pages
 */

const Database = {
  // معرف المجموعة
  COLLECTIONS: {
    BUSINESSES: 'businesses',
    SALES: 'sales',
    EXPENSES: 'expenses',
    INVENTORY_LOGS: 'inventory_logs',
    SETTINGS: 'settings'
  },

  // التحقق إن كانت إعدادات Firebase غير وهمية ومفعلة
  canUseFirestore() {
    const config = FirebaseApp.getConfig();
    const isDummy = !config.apiKey || config.apiKey.includes('DummyKey');
    const auth = FirebaseApp.getAuth();
    // إذا كان المستخدم مسجلاً دخوله في Firebase أو Firestore مهيأ بدون dummy
    return FirebaseApp.isInitialized() && !isDummy && (auth && auth.currentUser);
  },

  // ========== إدارة البزنسات BUSINESSES ==========
  async getAllBusinesses() {
    if (this.canUseFirestore()) {
      try {
        const db = FirebaseApp.getDb();
        const snapshot = await db.collection(this.COLLECTIONS.BUSINESSES).orderBy('createdAt', 'desc').get();
        const list = [];
        snapshot.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() });
        });
        return list;
      } catch (err) {
        console.warn('Firestore fetch failed, falling back to local storage:', err);
      }
    }
    // Fallback LocalStorage
    const local = localStorage.getItem('bm_local_businesses');
    return local ? JSON.parse(local) : [];
  },

  async getBusinessById(id) {
    const all = await this.getAllBusinesses();
    return all.find(b => b.id === id) || null;
  },

  async saveBusiness(businessData, existingId = null) {
    const now = new Date().toISOString();
    const item = {
      ...businessData,
      updatedAt: now
    };

    if (this.canUseFirestore()) {
      try {
        const db = FirebaseApp.getDb();
        if (existingId) {
          await db.collection(this.COLLECTIONS.BUSINESSES).doc(existingId).update(item);
          return { id: existingId, ...item };
        } else {
          item.createdAt = now;
          item.status = item.status || 'active'; // active or closed
          const ref = await db.collection(this.COLLECTIONS.BUSINESSES).add(item);
          return { id: ref.id, ...item };
        }
      } catch (err) {
        console.warn('Firestore save failed, using local storage:', err);
      }
    }

    // Local Storage Mode
    const list = await this.getAllBusinesses();
    let savedItem;
    if (existingId) {
      const idx = list.findIndex(b => b.id === existingId);
      if (idx !== -1) {
        savedItem = { ...list[idx], ...item };
        list[idx] = savedItem;
      } else {
        savedItem = { id: existingId, ...item };
        list.push(savedItem);
      }
    } else {
      const newId = 'biz_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
      item.id = newId;
      item.createdAt = now;
      item.status = item.status || 'active';
      savedItem = item;
      list.unshift(savedItem);
    }
    localStorage.setItem('bm_local_businesses', JSON.stringify(list));
    return savedItem;
  },

  async updateBusinessStatus(id, newStatus, closeNotes = '') {
    const updatePayload = {
      status: newStatus,
      statusUpdatedAt: new Date().toISOString()
    };
    if (newStatus === 'closed') {
      updatePayload.closedAt = new Date().toISOString();
      updatePayload.closeNotes = closeNotes;
    } else if (newStatus === 'active') {
      updatePayload.reopenedAt = new Date().toISOString();
    }

    if (this.canUseFirestore()) {
      try {
        const db = FirebaseApp.getDb();
        await db.collection(this.COLLECTIONS.BUSINESSES).doc(id).update(updatePayload);
        return true;
      } catch (e) {
        console.warn('Firestore update status failed, fallback to local:', e);
      }
    }

    const list = await this.getAllBusinesses();
    const idx = list.findIndex(b => b.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...updatePayload };
      localStorage.setItem('bm_local_businesses', JSON.stringify(list));
      return true;
    }
    return false;
  },

  async deleteBusiness(id) {
    if (this.canUseFirestore()) {
      try {
        const db = FirebaseApp.getDb();
        await db.collection(this.COLLECTIONS.BUSINESSES).doc(id).delete();
      } catch (e) {
        console.warn(e);
      }
    }
    const list = await this.getAllBusinesses();
    const filtered = list.filter(b => b.id !== id);
    localStorage.setItem('bm_local_businesses', JSON.stringify(filtered));

    // حذف مبيعات ومصروفات البزنس أيضاً
    const sales = await this.getAllSales();
    const filteredSales = sales.filter(s => s.businessId !== id);
    localStorage.setItem('bm_local_sales', JSON.stringify(filteredSales));

    const expenses = await this.getAllExpenses();
    const filteredExpenses = expenses.filter(e => e.businessId !== id);
    localStorage.setItem('bm_local_expenses', JSON.stringify(filteredExpenses));
    return true;
  },

  // ========== إدارة المبيعات SALES ==========
  async getAllSales(businessId = null) {
    if (this.canUseFirestore()) {
      try {
        const db = FirebaseApp.getDb();
        let query = db.collection(this.COLLECTIONS.SALES);
        if (businessId) {
          query = query.where('businessId', '==', businessId);
        }
        const snapshot = await query.orderBy('date', 'desc').get();
        const list = [];
        snapshot.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() });
        });
        return list;
      } catch (err) {
        console.warn('Firestore sales fetch failed, fallback to local:', err);
      }
    }

    const local = localStorage.getItem('bm_local_sales');
    let list = local ? JSON.parse(local) : [];
    if (businessId) {
      list = list.filter(s => s.businessId === businessId);
    }
    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  async addSale(saleData) {
    const now = new Date().toISOString();
    const item = {
      ...saleData,
      createdAt: now
    };

    if (this.canUseFirestore()) {
      try {
        const db = FirebaseApp.getDb();
        const ref = await db.collection(this.COLLECTIONS.SALES).add(item);
        return { id: ref.id, ...item };
      } catch (err) {
        console.warn('Firestore add sale failed, fallback:', err);
      }
    }

    const list = await this.getAllSales();
    const newId = 'sale_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const saved = { id: newId, ...item };
    list.unshift(saved);
    localStorage.setItem('bm_local_sales', JSON.stringify(list));
    return saved;
  },

  async updateSale(id, saleData) {
    const now = new Date().toISOString();
    const item = { ...saleData, updatedAt: now };

    if (this.canUseFirestore()) {
      try {
        const db = FirebaseApp.getDb();
        await db.collection(this.COLLECTIONS.SALES).doc(id).update(item);
        return { id, ...item };
      } catch (err) {
        console.warn('Firestore update sale failed:', err);
      }
    }

    const list = await this.getAllSales();
    const idx = list.findIndex(s => s.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...item };
      localStorage.setItem('bm_local_sales', JSON.stringify(list));
      return list[idx];
    }
    return null;
  },

  async deleteSale(id) {
    if (this.canUseFirestore()) {
      try {
        const db = FirebaseApp.getDb();
        await db.collection(this.COLLECTIONS.SALES).doc(id).delete();
      } catch (e) {
        console.warn(e);
      }
    }
    const list = await this.getAllSales();
    const filtered = list.filter(s => s.id !== id);
    localStorage.setItem('bm_local_sales', JSON.stringify(filtered));
    return true;
  },

  // ========== إدارة المصروفات EXPENSES ==========
  async getAllExpenses(businessId = null) {
    if (this.canUseFirestore()) {
      try {
        const db = FirebaseApp.getDb();
        let query = db.collection(this.COLLECTIONS.EXPENSES);
        if (businessId) {
          query = query.where('businessId', '==', businessId);
        }
        const snapshot = await query.orderBy('date', 'desc').get();
        const list = [];
        snapshot.forEach(doc => {
          list.push({ id: doc.id, ...doc.data() });
        });
        return list;
      } catch (err) {
        console.warn('Firestore expenses fetch failed:', err);
      }
    }

    const local = localStorage.getItem('bm_local_expenses');
    let list = local ? JSON.parse(local) : [];
    if (businessId) {
      list = list.filter(e => e.businessId === businessId);
    }
    return list.sort((a, b) => new Date(b.date) - new Date(a.date));
  },

  async addExpense(expenseData) {
    const now = new Date().toISOString();
    const item = {
      ...expenseData,
      createdAt: now
    };

    if (this.canUseFirestore()) {
      try {
        const db = FirebaseApp.getDb();
        const ref = await db.collection(this.COLLECTIONS.EXPENSES).add(item);
        return { id: ref.id, ...item };
      } catch (err) {
        console.warn('Firestore add expense failed:', err);
      }
    }

    const list = await this.getAllExpenses();
    const newId = 'exp_' + Date.now() + '_' + Math.random().toString(36).substr(2, 5);
    const saved = { id: newId, ...item };
    list.unshift(saved);
    localStorage.setItem('bm_local_expenses', JSON.stringify(list));
    return saved;
  },

  async updateExpense(id, expenseData) {
    const now = new Date().toISOString();
    const item = { ...expenseData, updatedAt: now };

    if (this.canUseFirestore()) {
      try {
        const db = FirebaseApp.getDb();
        await db.collection(this.COLLECTIONS.EXPENSES).doc(id).update(item);
        return { id, ...item };
      } catch (err) {
        console.warn('Firestore update expense failed:', err);
      }
    }

    const list = await this.getAllExpenses();
    const idx = list.findIndex(e => e.id === id);
    if (idx !== -1) {
      list[idx] = { ...list[idx], ...item };
      localStorage.setItem('bm_local_expenses', JSON.stringify(list));
      return list[idx];
    }
    return null;
  },

  async deleteExpense(id) {
    if (this.canUseFirestore()) {
      try {
        const db = FirebaseApp.getDb();
        await db.collection(this.COLLECTIONS.EXPENSES).doc(id).delete();
      } catch (e) {
        console.warn(e);
      }
    }
    const list = await this.getAllExpenses();
    const filtered = list.filter(e => e.id !== id);
    localStorage.setItem('bm_local_expenses', JSON.stringify(filtered));
    return true;
  },

  // ========== رفع الصور (Firebase Storage أو Base64 كبديل آمن وسهل) ==========
  async uploadImage(file, pathPrefix = 'products') {
    if (!file) return null;

    // محاولة الرفع على Firebase Storage إن كان متاحاً ومسجل الدخول
    if (this.canUseFirestore() && FirebaseApp.getStorage()) {
      try {
        const storage = FirebaseApp.getStorage();
        const ext = file.name.split('.').pop() || 'png';
        const filename = `${pathPrefix}/${Date.now()}_${Math.random().toString(36).substr(2, 6)}.${ext}`;
        const ref = storage.ref().child(filename);
        const snapshot = await ref.put(file);
        const downloadUrl = await snapshot.ref.getDownloadURL();
        return downloadUrl;
      } catch (err) {
        console.warn('Firebase Storage upload failed, converting to compressed data URL:', err);
      }
    }

    // بديل فوري ممتاز دون الحاجة لتفعيل Storage Bucket: Base64 مضغوط
    return new Promise((resolve) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        // ضغط الصورة عبر Canvas إذا كانت كبيرة
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const maxDim = 800;
          let w = img.width;
          let h = img.height;
          if (w > maxDim || h > maxDim) {
            if (w > h) {
              h = Math.round((h * maxDim) / w);
              w = maxDim;
            } else {
              w = Math.round((w * maxDim) / h);
              h = maxDim;
            }
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = () => resolve(e.target.result);
        img.src = e.target.result;
      };
      reader.onerror = () => resolve(null);
      reader.readAsDataURL(file);
    });
  }
};

window.Database = Database;
