import {
  collection,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  ref,
  uploadBytes,
  getDownloadURL
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-storage.js";


// ==========================================
// زر التسجيل
// ==========================================

const voiceButton =
  document.getElementById("voiceButton");


// ==========================================
// المتغيرات
// ==========================================

let recorder = null;
let stream = null;
let chunks = [];

let isRecording = false;
let starting = false;

// مهم جدًا:
// نعرف هل إصبع المستخدم ما زال ضاغطًا
let fingerDown = false;

// لمنع الإيقاف أكثر من مرة
let stopRequested = false;


// ==========================================
// الضغط على زر الميكروفون
// ==========================================

voiceButton.addEventListener(
  "pointerdown",
  async (event) => {

    event.preventDefault();

    // المستخدم بدأ الضغط
    fingerDown = true;

    // منع التكرار
    if (isRecording || starting) {
      return;
    }

    starting = true;

    try {

      // محاولة تثبيت المؤشر على الزر
      if (
        voiceButton.setPointerCapture &&
        event.pointerId !== undefined
      ) {

        try {

          voiceButton.setPointerCapture(
            event.pointerId
          );

        } catch (e) {

          console.log(
            "Pointer capture غير متاح"
          );

        }

      }


      await startRecording();


      // ====================================
      // مهم جدًا
      // إذا كان المستخدم رفع إصبعه
      // أثناء انتظار تشغيل الميكروفون
      // نوقف التسجيل مباشرة بعد بدايته
      // ====================================

      if (!fingerDown) {

        stopRecording();

      }

    }

    catch (error) {

      console.error(
        "Microphone error:",
        error
      );

      stopMicrophone();

      resetVoice();

      alert(
        "لم يتم السماح بالميكروفون"
      );

    }

    finally {

      starting = false;

    }

  }
);


// ==========================================
// رفع الإصبع
// ==========================================

voiceButton.addEventListener(
  "pointerup",
  (event) => {

    event.preventDefault();

    fingerDown = false;

    stopRecording();

  }
);


// ==========================================
// إلغاء اللمس
// ==========================================

voiceButton.addEventListener(
  "pointercancel",
  (event) => {

    event.preventDefault();

    fingerDown = false;

    stopRecording();

  }
);


// ==========================================
// فقدان المؤشر
// ==========================================

voiceButton.addEventListener(
  "lostpointercapture",
  () => {

    fingerDown = false;

    stopRecording();

  }
);


// ==========================================
// إذا خرج الإصبع من الزر
// ==========================================

voiceButton.addEventListener(
  "pointerleave",
  () => {

    // لا نوقف هنا مباشرة.
    // على الهاتف pointerleave ممكن يحصل
    // بسبب حركة بسيطة للإصبع.
  }
);


// ==========================================
// بدء التسجيل
// ==========================================

async function startRecording() {

  // ========================================
  // التأكد من Firebase
  // ========================================

  if (
    !window.storage ||
    !window.chatDB ||
    !window.chatID ||
    !window.chatUser ||
    !window.chatFriend
  ) {

    throw new Error(
      "Firebase غير جاهز"
    );

  }


  // ========================================
  // التأكد من دعم الميكروفون
  // ========================================

  if (
    !navigator.mediaDevices ||
    !navigator.mediaDevices.getUserMedia
  ) {

    throw new Error(
      "المتصفح لا يدعم الميكروفون"
    );

  }


  if (
    typeof MediaRecorder === "undefined"
  ) {

    throw new Error(
      "MediaRecorder غير مدعوم"
    );

  }


  // ========================================
  // طلب الميكروفون
  // ========================================

  stream =
    await navigator.mediaDevices.getUserMedia(
      {
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true
        }
      }
    );


  // ========================================
  // اختيار صيغة الصوت
  // ========================================

  let mimeType = "";


  if (
    MediaRecorder.isTypeSupported(
      "audio/webm;codecs=opus"
    )
  ) {

    mimeType =
      "audio/webm;codecs=opus";

  }

  else if (
    MediaRecorder.isTypeSupported(
      "audio/webm"
    )
  ) {

    mimeType =
      "audio/webm";

  }

  else if (
    MediaRecorder.isTypeSupported(
      "audio/mp4"
    )
  ) {

    mimeType =
      "audio/mp4";

  }


  // ========================================
  // إنشاء MediaRecorder
  // ========================================

  if (mimeType) {

    recorder =
      new MediaRecorder(
        stream,
        {
          mimeType: mimeType
        }
      );

  }

  else {

    recorder =
      new MediaRecorder(
        stream
      );

  }


  chunks = [];

  stopRequested = false;


  // ========================================
  // استقبال بيانات الصوت
  // ========================================

  recorder.ondataavailable =
    (event) => {

      if (
        event.data &&
        event.data.size > 0
      ) {

        chunks.push(
          event.data
        );

      }

    };


  // ========================================
  // عند انتهاء التسجيل
  // ========================================

  recorder.onstop =
    async () => {

      await finishRecording();

    };


  // ========================================
  // عند حدوث خطأ
  // ========================================

  recorder.onerror =
    (event) => {

      console.error(
        "MediaRecorder error:",
        event
      );

    };


  // ========================================
  // بدء التسجيل
  // ========================================

  recorder.start();


  isRecording = true;


  // ========================================
  // شكل الزر أثناء التسجيل
  // ========================================

  voiceButton.innerHTML =
    "🔴";


  voiceButton.classList.add(
    "recording"
  );


  console.log(
    "🎤 بدأ التسجيل"
  );

}


// ==========================================
// إيقاف التسجيل
// ==========================================

function stopRecording() {

  // إذا لم يبدأ التسجيل بعد
  // لا نفعل شيء هنا.
  // startRecording() سيفحص fingerDown
  // بعد انتهاء getUserMedia.
  if (!isRecording) {

    return;

  }


  // منع الإيقاف المتكرر
  if (stopRequested) {

    return;

  }


  stopRequested = true;


  console.log(
    "🛑 إيقاف التسجيل"
  );


  if (
    recorder &&
    recorder.state !== "inactive"
  ) {

    try {

      recorder.stop();

    }

    catch (error) {

      console.error(
        "Recorder stop error:",
        error
      );

    }

  }

}


// ==========================================
// إنهاء التسجيل وإرساله
// ==========================================

async function finishRecording() {

  try {

    console.log(
      "📦 تجهيز التسجيل..."
    );


    // ======================================
    // التأكد من وجود بيانات
    // ======================================

    if (
      !chunks ||
      chunks.length === 0
    ) {

      throw new Error(
        "لم يتم تسجيل أي صوت"
      );

    }


    // ======================================
    // معرفة نوع الملف
    // ======================================

    const mime =
      recorder &&
      recorder.mimeType
        ?
        recorder.mimeType
        :
        "audio/webm";


    // ======================================
    // إنشاء الملف
    // ======================================

    const blob =
      new Blob(
        chunks,
        {
          type: mime
        }
      );


    console.log(
      "حجم الصوت:",
      blob.size
    );


    if (blob.size <= 0) {

      throw new Error(
        "ملف الصوت فارغ"
      );

    }


    // ======================================
    // اسم الملف
    // ======================================

    let extension =
      "webm";


    if (
      mime.includes("mp4")
    ) {

      extension =
        "mp4";

    }


    const fileName =
      "voices/" +
      window.chatID +
      "/" +
      Date.now() +
      "_" +
      Math.random()
        .toString(36)
        .substring(2) +
      "." +
      extension;


    // ======================================
    // Firebase Storage
    // ======================================

    const voiceRef =
      ref(
        window.storage,
        fileName
      );


    console.log(
      "⬆️ رفع الصوت..."
    );


    await uploadBytes(
      voiceRef,
      blob,
      {
        contentType: mime
      }
    );


    // ======================================
    // الحصول على الرابط
    // ======================================

    const url =
      await getDownloadURL(
        voiceRef
      );


    console.log(
      "✅ تم رفع الصوت"
    );


    // ======================================
    // حفظ الرسالة في Firestore
    // ======================================

    await addDoc(

      collection(
        window.chatDB,
        "chats",
        window.chatID,
        "messages"
      ),

      {

        type:
          "voice",

        audio:
          url,

        senderId:
          window.chatUser.uid,

        receiverId:
          window.chatFriend.uid,

        createdAt:
          serverTimestamp()

      }

    );


    console.log(
      "✅ تم إرسال الرسالة الصوتية"
    );


    // ======================================
    // لا نضيف الرسالة يدويًا هنا
    //
    // onSnapshot الموجود في index.html
    // سيعرضها تلقائيًا.
    //
    // هذا يمنع ظهور الرسالة مرتين.
    // ======================================

  }

  catch (error) {

    console.error(
      "❌ Voice error:",
      error
    );


    alert(
      "حدث خطأ أثناء إرسال التسجيل"
    );

  }

  finally {

    // ======================================
    // إيقاف الميكروفون
    // ======================================

    stopMicrophone();


    // ======================================
    // إعادة الزر
    // ======================================

    resetVoice();

  }

}


// ==========================================
// إيقاف الميكروفون
// ==========================================

function stopMicrophone() {

  if (!stream) {

    return;

  }


  stream
    .getTracks()
    .forEach(
      (track) => {

        try {

          track.stop();

        }

        catch (error) {

          console.error(
            error
          );

        }

      }
    );


  stream = null;

}


// ==========================================
// إعادة الزر للوضع الطبيعي
// ==========================================

function resetVoice() {

  stopMicrophone();


  recorder = null;

  chunks = [];

  isRecording = false;

  starting = false;

  stopRequested = false;


  voiceButton.innerHTML =
    "🎤";


  voiceButton.classList.remove(
    "recording"
  );

}


// ==========================================
// منع القائمة/السلوك الافتراضي
// ==========================================

voiceButton.addEventListener(
  "contextmenu",
  (event) => {

    event.preventDefault();

  }
);
