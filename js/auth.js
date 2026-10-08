/**
 * auth.js
 * إدارة جلسة المستخدم وتسجيل الدخول والخروج باستخدام Firebase Authentication
 */

const Auth = {
  currentUser: null,
  isLoggedIn: false,
  _authCallback: null,

  init(onAuthStateChangeCallback) {
    this._authCallback = onAuthStateChangeCallback;
    const auth = FirebaseApp.getAuth();
    
    if (auth) {
      auth.onAuthStateChanged((user) => {
        if (user) {
          this.currentUser = user;
          this.isLoggedIn = true;
          localStorage.setItem('bm_session_active', 'true');
          if (this._authCallback) this._authCallback(user);
        } else {
          this.currentUser = null;
          this.isLoggedIn = false;
          localStorage.removeItem('bm_session_active');
          localStorage.removeItem('bm_local_user');
          if (this._authCallback) this._authCallback(null);
        }
      });
    } else {
      console.warn('Firebase Auth is not ready during init.');
      this.currentUser = null;
      this.isLoggedIn = false;
      if (this._authCallback) this._authCallback(null);
    }
  },

  /**
   * تسجيل الدخول عبر Firebase Authentication
   */
  async login(email, password) {
    const auth = FirebaseApp.getAuth();

    if (!auth) {
      return {
        success: false,
        error: 'تعذر الاتصال بـ Firebase Authentication. يرجى التأكد من اتصالك بالإنترنت.'
      };
    }

    const cleanEmail = (email || '').trim();
    const cleanPassword = (password || '').trim();

    if (!cleanEmail || !cleanPassword) {
      return {
        success: false,
        error: 'يرجى إدخال البريد الإلكتروني وكلمة المرور'
      };
    }

    try {
      const userCredential = await auth.signInWithEmailAndPassword(cleanEmail, cleanPassword);
      this.currentUser = userCredential.user;
      this.isLoggedIn = true;
      localStorage.setItem('bm_session_active', 'true');
      localStorage.setItem('bm_local_user', JSON.stringify({
        uid: this.currentUser.uid,
        email: this.currentUser.email,
        displayName: this.currentUser.displayName || 'صاحبة البزنس'
      }));
      if (this._authCallback) this._authCallback(this.currentUser);
      return { success: true, user: this.currentUser };
    } catch (error) {
      console.error('Firebase Auth Login Error:', error.code, error.message);
      return {
        success: false,
        code: error.code,
        error: this.getArabicAuthError(error.code)
      };
    }
  },

  /**
   * تسجيل الخروج
   */
  async logout() {
    const auth = FirebaseApp.getAuth();
    if (auth) {
      try {
        await auth.signOut();
      } catch (e) {
        console.warn('SignOut error:', e);
      }
    }
    this.currentUser = null;
    this.isLoggedIn = false;
    localStorage.removeItem('bm_session_active');
    localStorage.removeItem('bm_local_user');
    window.location.reload();
  },

  /**
   * استعادة كلمة المرور عبر رابط يرسل إلى البريد الإلكتروني
   */
  async resetPassword(email) {
    const auth = FirebaseApp.getAuth();
    const cleanEmail = (email || '').trim();

    if (!auth) {
      return {
        success: false,
        error: 'خدمة Firebase غير متصلة حالياً.'
      };
    }

    if (!cleanEmail) {
      return {
        success: false,
        error: 'يرجى كتابة البريد الإلكتروني أولاً في حقل البريد.'
      };
    }

    try {
      await auth.sendPasswordResetEmail(cleanEmail);
      return {
        success: true,
        message: 'تم إرسال رابط إعادة تعيين كلمة المرور إلى بريدك الإلكتروني بنجاح.'
      };
    } catch (error) {
      console.error('Reset Password Error:', error);
      return {
        success: false,
        error: this.getArabicAuthError(error.code)
      };
    }
  },

  /**
   * معالجة أخطاء Firebase وتوحيد رسائل الدخول لأسباب أمنية
   */
  getArabicAuthError(code) {
    switch (code) {
      // توحيد رسائل أخطاء بيانات الاعتماد لأسباب أمنية
      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'البريد الإلكتروني أو كلمة المرور غير صحيحة';

      case 'auth/invalid-email':
        return 'صيغة البريد الإلكتروني غير صالحة';

      case 'auth/user-disabled':
        return 'تم تعطيل هذا الحساب. يرجى مراجعة إدارة النظام';

      case 'auth/too-many-requests':
        return 'تم حظر الدخول مؤقتاً لكثرة المحاولات، يرجى الانتظار والمحاولة لاحقاً';

      case 'auth/network-request-failed':
        return 'فشل الاتصال بالإنترنت أو تعذر الوصول إلى خوادم Firebase';

      case 'auth/operation-not-allowed':
        return 'طريقة الدخول عبر البريد الإلكتروني غير مفعلة في إعدادات Firebase Authentication';

      case 'auth/unauthorized-domain':
        return 'نطاق الموقع الحالي غير مصرح به في إعدادات Firebase Console (Authorized Domains)';

      default:
        return 'البريد الإلكتروني أو كلمة المرور غير صحيحة';
    }
  }
};

window.Auth = Auth;
