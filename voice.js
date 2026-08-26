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

const voiceButton =
document.getElementById("voiceButton");

let mediaRecorder = null;
let audioChunks = [];
let audioStream = null;

let isRecording = false;
let isStarting = false;
let stopRequested = false;

// ==================================================
// الضغط على زر الميكروفون
// ==================================================

voiceButton.addEventListener(
"pointerdown",
async (event) => {

event.preventDefault();

if (isRecording || isStarting)
  return;

isStarting = true;
stopRequested = false;


// تثبيت الضغط على الزر
try {

  if (
    voiceButton.setPointerCapture &&
    event.pointerId !== undefined
  ) {

    voiceButton.setPointerCapture(
      event.pointerId
    );

  }

} catch (error) {

  console.log(
    "Pointer capture:",
    error
  );

}


try {

  await startRecording();

} catch (error) {

  console.error(
    "Start recording error:",
    error
  );

  stopMicrophone();

  resetVoice();

  alert(
    "لم يتم السماح بالميكروفون"
  );

}

isStarting = false;


// إذا رفع المستخدم إصبعه أثناء انتظار تشغيل الميكروفون
if (stopRequested && isRecording) {

  stopRecording();

}

}
);

// ==================================================
// رفع الإصبع = إنهاء التسجيل
// ==================================================

voiceButton.addEventListener(
"pointerup",
(event) => {

event.preventDefault();

stopRequested = true;

stopRecording();

}
);

// ==================================================
// إلغاء اللمس
// ==================================================

voiceButton.addEventListener(
"pointercancel",
() => {

stopRequested = true;

stopRecording();

}
);

// ==================================================
// إذا خرج المؤشر
// ==================================================

voiceButton.addEventListener(
"lostpointercapture",
() => {

if (isRecording) {

  stopRequested = true;

  stopRecording();

}

}
);

// ==================================================
// بدء التسجيل
// ==================================================

async function startRecording() {

// التأكد من Firebase
if (
!window.storage ||
!window.chatDB ||
!window.chatID ||
!window.chatUser ||
!window.chatFriend
) {

throw new Error(
  "Firebase variables are missing"
);

}

// التأكد من دعم الميكروفون
if (
!navigator.mediaDevices ||
!navigator.mediaDevices.getUserMedia
) {

throw new Error(
  "Microphone is not supported"
);

}

// تشغيل الميكروفون
audioStream =
await navigator.mediaDevices.getUserMedia({
audio: true
});

// اختيار أفضل صيغة متاحة
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

if (mimeType) {

mediaRecorder =
  new MediaRecorder(
    audioStream,
    {
      mimeType: mimeType
    }
  );

}

else {

mediaRecorder =
  new MediaRecorder(
    audioStream
  );

}

audioChunks = [];

// استقبال الصوت
mediaRecorder.ondataavailable =
(event) => {

  if (
    event.data &&
    event.data.size > 0
  ) {

    audioChunks.push(
      event.data
    );

  }

};

// عند إيقاف التسجيل
mediaRecorder.onstop =
async () => {

  await finishRecording();

};

// بدء التسجيل
mediaRecorder.start();

isRecording = true;

voiceButton.textContent =
"🔴";

voiceButton.classList.add(
"recording"
);

console.log(
"🎤 بدأ التسجيل"
);

}

// ==================================================
// إيقاف التسجيل
// ==================================================

function stopRecording() {

if (!isRecording)
return;

if (stopRequested === false) {

stopRequested = true;

}

if (
mediaRecorder &&
mediaRecorder.state !== "inactive"
) {

console.log(
  "⏹️ إيقاف التسجيل"
);


mediaRecorder.stop();

}

}

// ==================================================
// إنهاء التسجيل وحفظه
// ==================================================

async function finishRecording() {

try {

// إيقاف الميكروفون
stopMicrophone();


if (
  !audioChunks ||
  audioChunks.length === 0
) {

  throw new Error(
    "No audio data"
  );

}


// معرفة نوع الملف
const mimeType =
  mediaRecorder &&
  mediaRecorder.mimeType
    ?
    mediaRecorder.mimeType
    :
    "audio/webm";


// إنشاء ملف الصوت
const blob =
  new Blob(
    audioChunks,
    {
      type: mimeType
    }
  );


if (blob.size === 0) {

  throw new Error(
    "Audio file is empty"
  );

}


console.log(
  "🎵 Audio size:",
  blob.size
);


// ==================================================
// إظهار الصوت مباشرة للمستخدم
// ==================================================

const localURL =
  URL.createObjectURL(
    blob
  );


addVoiceMessage(
  localURL
);


// ==================================================
// اسم الملف
// ==================================================

const extension =
  mimeType.includes("webm")
    ?
    "webm"
    :
    "webm";


const fileName =
  "voices/" +
  window.chatUser.uid +
  "/" +
  Date.now() +
  "_" +
  Math.random()
    .toString(36)
    .substring(2) +
  "." +
  extension;


// ==================================================
// رفع الصوت إلى Firebase Storage
// ==================================================

console.log(
  "⬆️ رفع الصوت..."
);


const voiceRef =
  ref(
    window.storage,
    fileName
  );


await uploadBytes(
  voiceRef,
  blob
);


// الحصول على رابط دائم
const downloadURL =
  await getDownloadURL(
    voiceRef
  );


console.log(
  "✅ تم رفع الصوت"
);


// ==================================================
// حفظ الرسالة في Firestore
// ==================================================

await addDoc(

  collection(
    window.chatDB,
    "chats",
    window.chatID,
    "messages"
  ),

  {

    type: "voice",

    audio: downloadURL,

    senderId:
      window.chatUser.uid,

    receiverId:
      window.chatFriend.uid,

    createdAt:
      serverTimestamp()

  }

);


console.log(
  "✅ تم حفظ الرسالة في Firestore"
);

}

catch (error) {

console.error(
  "❌ Voice send error:",
  error
);


alert(
  "حدث خطأ أثناء حفظ الرسالة الصوتية"
);

}

finally {

resetVoice();

}

}

// ==================================================
// إظهار الصوت في الدردشة
// ==================================================

function addVoiceMessage(url) {

const messages =
document.getElementById(
"messages"
);

if (!messages)
return;

// إزالة رسالة المحادثة الفارغة إن وجدت
const empty =
messages.querySelector(
".empty"
);

if (empty) {

empty.remove();

}

// إنشاء صندوق الرسالة
const box =
document.createElement(
"div"
);

box.className =
"message mine";

// إنشاء مشغل الصوت
const audio =
document.createElement(
"audio"
);

audio.controls = true;

audio.preload = "metadata";

audio.src = url;

audio.style.width =
"230px";

audio.style.maxWidth =
"100%";

box.appendChild(
audio
);

// إضافة النص
const label =
document.createElement(
"div"
);

label.textContent =
"🎤 رسالة صوتية";

label.style.fontSize =
"12px";

label.style.marginTop =
"5px";

box.appendChild(
label
);

// إضافة الرسالة للدردشة
messages.appendChild(
box
);

// النزول لآخر رسالة
messages.scrollTop =
messages.scrollHeight;

}

// ==================================================
// إيقاف الميكروفون
// ==================================================

function stopMicrophone() {

if (!audioStream)
return;

audioStream
.getTracks()
.forEach(
(track) => {

    track.stop();

  }
);

audioStream = null;

}

// ==================================================
// إعادة زر الميكروفون
// ==================================================

function resetVoice() {

stopMicrophone();

mediaRecorder = null;

audioChunks = [];

audioStream = null;

isRecording = false;

isStarting = false;

stopRequested = false;

voiceButton.textContent =
"🎤";

voiceButton.classList.remove(
"recording"
);

}
