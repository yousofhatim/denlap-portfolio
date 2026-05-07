// التهيئة الفورية لـ Firebase
(function init() {
    const firebaseConfig = {
        apiKey: "AIzaSyDhdID2wAdkpl-Hc-8mWvMz83PNfAgRto8",
        authDomain: "kid-id.firebaseapp.com",
        databaseURL: "https://kid-id-default-rtdb.firebaseio.com",
        projectId: "kid-id",
        storageBucket: "kid-id.appspot.com",
        messagingSenderId: "103513152686",
        appId: "1:103513152686:web:0b7c7f3c7b9c9b3c1a3e0a"
    };
    firebase.initializeApp(firebaseConfig);
})();

const db = firebase.database();
const storage = firebase.storage();

// عناصر DOM
const navItems = document.querySelectorAll('.nav-item');
const sections = document.querySelectorAll('.section');
const addPhotoBtn = document.getElementById('addPhotoBtn');
const addVideoBtn = document.getElementById('addVideoBtn');
const addMediaBtn = document.getElementById('addMediaBtn');
const photoModal = document.getElementById('addPhotoModal');
const videoModal = document.getElementById('addVideoModal');
const mediaModal = document.getElementById('addMediaModal');
const projectModal = document.getElementById('projectModal');
const closePhotoModal = document.getElementById('closePhotoModal');
const closeVideoModal = document.getElementById('closeVideoModal');
const closeMediaModal = document.getElementById('closeMediaModal');
const closeProjectModal = document.getElementById('closeProjectModal');
const photoForm = document.getElementById('photoForm');
const videoForm = document.getElementById('videoForm');
const mediaForm = document.getElementById('mediaForm');
const photoStatus = document.getElementById('photoStatus');
const videoStatus = document.getElementById('videoStatus');
const mediaStatus = document.getElementById('mediaStatus');
const photosContainer = document.getElementById('photosContainer');
const videosContainer = document.getElementById('videosContainer');
const mediaContainer = document.getElementById('mediaContainer');
const projectsContainer = document.getElementById('projectsContainer');
const projectModalBody = document.getElementById('projectModalBody');
const projectModalTitle = document.getElementById('projectModalTitle');

const chatContainer = document.getElementById('chatContainer');
const userInput = document.getElementById('userInput');
const sendButton = document.getElementById('sendButton');
const musicControl = document.getElementById('musicControl');
const backgroundMusic = document.getElementById('backgroundMusic');

// عناصر الوسائط الجديدة
const mediaTypes = document.querySelectorAll('.media-type');
const linkInput = document.getElementById('linkInput');
const fileUpload = document.getElementById('fileUpload');
const mediaLink = document.getElementById('mediaLink');
const mediaFile = document.getElementById('mediaFile');

// متغيرات الحالة
let currentProjectId = null;
let isMusicPlaying = false;
let openaiApiKey = null;
let selectedMediaType = 'link';
let currentPdfUrl = '';
let pdfZoomLevel = 1.0;
const pdfZoomStep = 0.25;
const minZoom = 0.5;
const maxZoom = 2.0;
let pdfPreview, pdfView, pdfLoading, pdfError, pdfControls;

// متغيرات التنقل في الوسائط
let currentMediaArray = [];
let currentMediaIndex = 0;
let currentMediaTab = '';
let projectMediaData = {};

// فهرس المشاريع والمحادثات المحفوظة
let projectIndex = new Map(); // Map<projectId, {chats: [], explanation: string}>
let isExplanationShown = new Set(); // Set<projectId>

// متغيرات القراءة الصوتية
let speechSynthesis = window.speechSynthesis;
let currentUtterance = null;
let autoReadEnabled = true; // حالة القراءة التلقائية - مفعلة افتراضياً

// دالة لتهيئة القراءة الصوتية
function initSpeechSynthesis() {
    // التحقق من دعم المتصفح
    if (!('speechSynthesis' in window)) {
        console.warn('المتصفح لا يدعم القراءة الصوتية');
        return false;
    }
    return true;
}

// دالة لضمان تحميل الأصوات قبل البدء
function ensureVoicesLoaded() {
    return new Promise((resolve) => {
        const voices = speechSynthesis.getVoices();
        if (voices.length > 0) {
            resolve();
        } else {
            speechSynthesis.addEventListener('voiceschanged', () => {
                resolve();
            }, { once: true });

            // Timeout للتأكد من عدم الانتظار إلى الأبد
            setTimeout(() => {
                resolve();
            }, 3000);
        }
    });
}

// دالة للقراءة الصوتية التلقائية
function autoReadMessage(text, voiceType = 'male') {
    if (!autoReadEnabled || !speechSynthesis) return;

    // إيقاف أي قراءة سابقة
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
    }

    const englishOnlyText = filterArabicText(text);
    if (!englishOnlyText) return;

    let selectedVoice = null;
    const voices = speechSynthesis.getVoices();

    if (voiceType === 'female') {
        const femaleVoices = voices.filter(voice => 
            voice.lang.startsWith('en') && 
            (voice.name.includes('Female') || voice.name.includes('Zira') || voice.name.includes('Google US English Female'))
        );
        selectedVoice = femaleVoices.length > 0 ? femaleVoices[0] : null;
    } else if (voiceType === 'young-male') {
        // صوت شاب - نستخدم معدل سريع قليلاً ونبرة أعلى
        const maleVoices = voices.filter(voice => 
            voice.lang.startsWith('en') && 
            (voice.name.includes('Male') || voice.name.includes('David') || voice.name.includes('Google US English Male'))
        );
        selectedVoice = maleVoices.length > 0 ? maleVoices[0] : null;
    } else {
        const maleVoices = voices.filter(voice => 
            voice.lang.startsWith('en') && 
            (voice.name.includes('Male') || voice.name.includes('David') || voice.name.includes('Google US English Male'))
        );
        selectedVoice = maleVoices.length > 0 ? maleVoices[0] : null;
    }

    currentUtterance = new SpeechSynthesisUtterance(englishOnlyText);
    if (selectedVoice) {
        currentUtterance.voice = selectedVoice;
        currentUtterance.lang = selectedVoice.lang;
    } else {
        currentUtterance.lang = 'en-US';
    }

    // تعديل الإعدادات للصوت الشاب
    if (voiceType === 'young-male') {
        currentUtterance.rate = 1.1;  // سرعة أعلى قليلاً
        currentUtterance.pitch = 1.2;  // نبرة أعلى لصوت شاب
        currentUtterance.volume = 1.0;
    } else {
        currentUtterance.rate = 1.0;
        currentUtterance.pitch = 1.0;
        currentUtterance.volume = 1.0;
    }

    currentUtterance.onstart = () => {
        updateSpeechButtons(true);
        // خفض صوت الموسيقى إلى 40%
        if (backgroundMusic && !backgroundMusic.paused) {
            backgroundMusic.volume = 0.4;
        }
    };

    currentUtterance.onend = () => { 
        currentUtterance = null;
        updateSpeechButtons(false);
        // إعادة صوت الموسيقى إلى 100%
        if (backgroundMusic && !backgroundMusic.paused) {
            backgroundMusic.volume = 1.0;
        }
    };

    currentUtterance.onerror = (event) => { 
        console.error('خطأ في القراءة الصوتية:', event); 
        currentUtterance = null;
        updateSpeechButtons(false);
        // إعادة صوت الموسيقى إلى 100%
        if (backgroundMusic && !backgroundMusic.paused) {
            backgroundMusic.volume = 1.0;
        }
    };

    speechSynthesis.speak(currentUtterance);
}

// دالة لإيقاف القراءة الصوتية
function stopSpeech() {
    if (speechSynthesis.speaking) {
        speechSynthesis.cancel();
        currentUtterance = null;
        updateSpeechButtons(false);
    }
}

// دالة لتحديث أزرار التحكم في القراءة الصوتية
function updateSpeechButtons(isSpeaking) {
    const stopBtn = document.getElementById('stopSpeechBtn');
    const defenseStopBtn = document.getElementById('defenseStopSpeechBtn');

    if (stopBtn) {
        if (isSpeaking) {
            stopBtn.classList.add('speaking');
            stopBtn.disabled = false;
        } else {
            stopBtn.classList.remove('speaking');
            stopBtn.disabled = true;
        }
    }

    if (defenseStopBtn) {
        if (isSpeaking) {
            defenseStopBtn.classList.add('speaking');
            defenseStopBtn.disabled = false;
        } else {
            defenseStopBtn.classList.remove('speaking');
            defenseStopBtn.disabled = true;
        }
    }
}

// شريط التنقل
function setupNavigation() {
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            navItems.forEach(i => i.classList.remove('active'));
            this.classList.add('active');

            sections.forEach(section => {
                section.classList.remove('active');
            });

            const targetId = this.getAttribute('data-target') + '-section';
            document.getElementById(targetId).classList.add('active');
        });
    });
}

// فتح وإغلاق النوافذ
addPhotoBtn.addEventListener('click', () => photoModal.style.display = 'flex');
addVideoBtn.addEventListener('click', () => videoModal.style.display = 'flex');
addMediaBtn.addEventListener('click', () => mediaModal.style.display = 'flex');
closePhotoModal.addEventListener('click', () => photoModal.style.display = 'none');
closeVideoModal.addEventListener('click', () => videoModal.style.display = 'none');
closeMediaModal.addEventListener('click', () => mediaModal.style.display = 'none');
closeProjectModal.addEventListener('click', () => {
    projectModal.style.display = 'none';
    document.body.classList.remove('modal-open');
});
// إغلاق النوافذ عند النقر خارجها
window.addEventListener('click', (e) => {
    if (e.target === photoModal) photoModal.style.display = 'none';
    if (e.target === videoModal) videoModal.style.display = 'none';
    if (e.target === mediaModal) mediaModal.style.display = 'none';
    if (e.target === projectModal) {
        projectModal.style.display = 'none';
        document.body.classList.remove('modal-open');
    }
});

// تحميل المشاريع
async function loadProjects() {
    try {
        const projectsPhotosSnapshot = await db.ref('portfolio/projectsPhotos').once('value');
        const projectsPhotos = projectsPhotosSnapshot.val();
        projectsContainer.innerHTML = '';

        if (!projectsPhotos) {
            projectsContainer.innerHTML = '<div style="color: var(--primary-color); text-align: center; grid-column: 1/-1;">لا توجد مشاريع حالياً</div>';
            return;
        }

        const projectsArray = Object.entries(projectsPhotos)
            .map(([id, photoUrl]) => ({
                id: Number(id),
                photoUrl: typeof photoUrl === 'string' ? photoUrl : photoUrl.photoURL
            }))
            .sort((a, b) => a.id - b.id);

        for (const project of projectsArray) {
            let pdfUrl = null;
            try {
                const docRef = db.ref(`portfolio/projectDocuments/${project.id}/pdfURL`);
                const docSnapshot = await docRef.once('value');
                pdfUrl = docSnapshot.val();
            } catch (error) {
                console.log(`لا يوجد مستند للمشروع ${project.id}`);
            }
            createProjectCard(project, pdfUrl);
        }

        if (projectsContainer.children.length === 0) {
            projectsContainer.innerHTML = '<div style="color: var(--primary-color); text-align: center; grid-column: 1/-1;">لا توجد مشاريع متاحة حالياً</div>';
        }
    } catch (error) {
        console.error('خطأ عام:', error);
        projectsContainer.innerHTML = '<div style="color: var(--secondary-color); text-align: center; grid-column: 1/-1;">حدث خطأ في تحميل المشاريع. يرجى المحاولة لاحقاً.</div>';
    }
}

function createProjectCard(project, pdfUrl) {
    const card = document.createElement('div');
    card.className = 'project-card';
    card.dataset.id = project.id;
    if (pdfUrl) card.dataset.pdf = pdfUrl;

    const projectId = document.createElement('div');
    projectId.className = 'project-id';
    projectId.textContent = `المشروع ${project.id}`;
    card.appendChild(projectId);

    const img = new Image();
    img.className = 'project-image';
    img.src = project.photoUrl;
    img.alt = `صورة المشروع ${project.id}`;
    img.onerror = () => {
        img.src = 'https://via.placeholder.com/420x300/0a0e17/a178ff?text=صورة+غير+متوفرة';
    };
    card.appendChild(img);

    card.addEventListener('click', () => openProjectModal(project.id, project.photoUrl, pdfUrl));
    projectsContainer.appendChild(card);
}

// فتح نافذة المشروع
async function openProjectModal(projectId, projectImage, pdfUrl) {
    currentProjectId = projectId;

    // منع الـ scroll في الصفحة الرئيسية
    document.body.classList.add('modal-open');

    projectModalBody.innerHTML = `
        <div class="loading">
            <div class="spinner"></div>
            <p>جاري تحميل تفاصيل المشروع...</p>
        </div>
    `;
    projectModal.style.display = 'flex';
    projectModalTitle.textContent = `المشروع ${projectId}`;

    try {
        // جلب الصور المرتبطة بالمشروع
        const photosRef = db.ref('portfolio/photos');
        const photosSnapshot = await photosRef.orderByChild('projectId').equalTo(projectId).once('value');
        const photos = photosSnapshot.val() || {};

        // جلب الفيديوهات المرتبطة بالمشروع
        const videosRef = db.ref('portfolio/videos');
        const videosSnapshot = await videosRef.orderByChild('projectId').equalTo(projectId).once('value');
        const videos = videosSnapshot.val() || {};

        // جلب الوسائط الأخرى المرتبطة بالمشروع
        const otherMediaRef = db.ref('portfolio/otherMedia');
        const otherMediaSnapshot = await otherMediaRef.orderByChild('projectId').equalTo(projectId).once('value');
        const otherMedia = otherMediaSnapshot.val() || {};

        // حفظ بيانات الوسائط للتنقل
        projectMediaData = {
            photos: Object.entries(photos).map(([key, item]) => ({...item, key, type: 'image'})),
            videos: Object.entries(videos).map(([key, item]) => ({...item, key, type: 'video'})),
            otherMedia: Object.entries(otherMedia).map(([key, item]) => ({...item, key, type: item.type}))
        };

        // جلب شرح المشروع الأولي
        let projectExplanation = "عذرا مازلت تحت التدريب لاستطيع شرح المشروع لحضراتكم";
        try {
            const explainRef = db.ref(`portfolio/explain/${projectId}`);
            const explainSnapshot = await explainRef.once('value');
            const explainData = explainSnapshot.val();
            if (explainData) {
                projectExplanation = explainData;
            }
        } catch (error) {
            console.error('خطأ في جلب شرح المشروع:', error);
        }

        // إنشاء واجهة المشروع مع التعديلات الجديدة
        projectModalBody.innerHTML = `
            <div class="project-media-section" style="background-image: url('${projectImage}');">
                ${Object.keys(photos).length > 0 || Object.keys(videos).length > 0 || Object.keys(otherMedia).length > 0 ? `
                    <div class="project-media-tabs">
                        ${Object.keys(photos).length > 0 ? `<div class="media-tab active" data-tab="photos">الصور <span class="tab-count">${Object.keys(photos).length}</span></div>` : ''}
                        ${Object.keys(videos).length > 0 ? `<div class="media-tab" data-tab="videos">الفيديوهات <span class="tab-count">${Object.keys(videos).length}</span></div>` : ''}
                        ${Object.keys(otherMedia).length > 0 ? `<div class="media-tab" data-tab="other">وسائط أخرى <span class="tab-count">${Object.keys(otherMedia).length}</span></div>` : ''}
                    </div>` : ''}
            </div>
            <div class="project-details">
                <div class="project-chat-container">
                    <div class="project-chat" id="projectChat">
                        <!-- سيتم إضافة الرسائل ديناميكياً -->
                    </div>
                    <div class="project-chat-input-container">
                        <input type="text" class="chat-input" id="projectChatInput" placeholder="اسأل عن تفاصيل المشروع...">
                        <button class="send-button" id="projectChatSend">إرسال</button>
                    </div>
                </div>

                <!-- عرض ملف PDF مباشرة إذا كان متوفراً -->
                ${pdfUrl ? `
                    <div class="media-category" style="margin-top: 25px;">
                        <h4><i class="fas fa-file-pdf"></i> مستند المشروع</h4>
                        <div class="pdf-view-container">
                            <iframe class="pdf-view" src="https://docs.google.com/gview?url=${encodeURIComponent(pdfUrl)}&embedded=true"></iframe>
                        </div>
                        <div class="pdf-controls">
                            <a href="${pdfUrl}" target="_blank" class="external-link">
                                <i class="fas fa-external-link-alt"></i>
                                فتح في نافذة جديدة
                            </a>
                            <a href="${pdfUrl}" download class="external-link">
                                <i class="fas fa-download"></i>
                                تحميل الملف
                            </a>
                        </div>
                    </div>
                ` : ''}
            </div>
        `;

        // إضافة الصور إلى الشبكة
        if (Object.keys(photos).length > 0) {
            const photosGrid = document.createElement('div');
            photosGrid.className = 'media-tab-content active';
            photosGrid.id = 'photosTab';
            photosGrid.innerHTML = '<div class="project-media-grid"></div>';
            projectModalBody.querySelector('.project-media-section').appendChild(photosGrid);

            const photosGridElement = photosGrid.querySelector('.project-media-grid');
            Object.entries(photos).forEach(([key, item], index) => {
                const mediaElement = document.createElement('div');
                mediaElement.className = 'media-item';
                mediaElement.dataset.mediaIndex = index;
                mediaElement.dataset.mediaType = 'photos';
                mediaElement.innerHTML = `
                    <img class="media-thumb" src="${item.url}" alt="${item.description}" data-type="image" data-url="${item.url}" data-description="${item.description}">
                    <div class="media-content">
                        <div class="media-description expanded">${item.description}</div>
                    </div>
                `;
                photosGridElement.appendChild(mediaElement);
            });
        }

        // إضافة الفيديوهات إلى الشبكة
        if (Object.keys(videos).length > 0) {
            const videosGrid = document.createElement('div');
            videosGrid.className = 'media-tab-content';
            videosGrid.id = 'videosTab';
            videosGrid.innerHTML = '<div class="project-media-grid"></div>';
            projectModalBody.querySelector('.project-media-section').appendChild(videosGrid);

            const videosGridElement = videosGrid.querySelector('.project-media-grid');
            Object.entries(videos).forEach(([key, item], index) => {
                const mediaElement = document.createElement('div');
                mediaElement.className = 'media-item';
                mediaElement.dataset.mediaIndex = index;
                mediaElement.dataset.mediaType = 'videos';
                mediaElement.innerHTML = `
                    <video class="media-thumb" src="${item.url}" controls data-type="video" data-url="${item.url}" data-description="${item.description}"></video>
                    <div class="media-content">
                        <div class="media-description expanded">${item.description}</div>
                    </div>
                `;
                videosGridElement.appendChild(mediaElement);
            });
        }

        // إضافة الوسائط الأخرى إلى الشبكة مع التحسينات الجديدة
        if (Object.keys(otherMedia).length > 0) {
            const otherGrid = document.createElement('div');
            otherGrid.className = 'media-tab-content';
            otherGrid.id = 'otherTab';
            otherGrid.innerHTML = '<div class="project-media-grid"></div>';
            projectModalBody.querySelector('.project-media-section').appendChild(otherGrid);

            const otherGridElement = otherGrid.querySelector('.project-media-grid');

            // تصنيف الوسائط حسب النوع
            const mediaByType = {
                youtube: [],
                pdf: [],
                link: []
            };

            // تجميع الوسائط حسب النوع
            Object.entries(otherMedia).forEach(([key, item]) => {
                if (mediaByType[item.type]) {
                    mediaByType[item.type].push(item);
                }
            });

            // إضافة روابط يوتيوب
            if (mediaByType.youtube.length > 0) {
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'media-category';
                categoryDiv.innerHTML = `
                    <h4><i class="fab fa-youtube"></i> فيديوهات يوتيوب</h4>
                    <div class="media-buttons-container" id="youtubeMedia"></div>
                `;
                otherGridElement.appendChild(categoryDiv);

                const youtubeContainer = categoryDiv.querySelector('#youtubeMedia');
                mediaByType.youtube.forEach((item, index) => {
                    const actualIndex = projectMediaData.otherMedia.indexOf(item);
                    const button = document.createElement('div');
                    button.className = 'media-button youtube-button';
                    button.dataset.type = 'youtube';
                    button.dataset.url = item.url;
                    button.dataset.description = item.description;
                    button.dataset.mediaIndex = actualIndex;
                    button.dataset.mediaType = 'other';
                    button.style.cursor = 'pointer';
                    button.innerHTML = `
                        <i class="fab fa-youtube"></i>
                        <div class="media-label">${item.description || 'فيديو يوتيوب'}</div>
                    `;

                    // إضافة معالج نقر مباشر
                    button.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        openMediaPreview('youtube', item.url, item.description, actualIndex, 'other');
                    });

                    youtubeContainer.appendChild(button);
                });
            }

            // إضافة ملفات PDF
            if (mediaByType.pdf.length > 0) {
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'media-category';
                categoryDiv.innerHTML = `
                    <h4><i class="fas fa-file-pdf"></i> ملفات PDF</h4>
                    <div class="media-buttons-container" id="pdfMedia"></div>
                `;
                otherGridElement.appendChild(categoryDiv);

                const pdfContainer = categoryDiv.querySelector('#pdfMedia');
                mediaByType.pdf.forEach((item, index) => {
                    const actualIndex = projectMediaData.otherMedia.indexOf(item);
                    const button = document.createElement('div');
                    button.className = 'media-button pdf-button';
                    button.dataset.type = 'pdf';
                    button.dataset.url = item.url;
                    button.dataset.description = item.description;
                    button.dataset.mediaIndex = actualIndex;
                    button.dataset.mediaType = 'other';
                    button.style.cursor = 'pointer';
                    button.innerHTML = `
                        <i class="fas fa-file-pdf"></i>
                        <div class="media-label">${item.description || 'ملف PDF'}</div>
                    `;

                    // إضافة معالج نقر مباشر
                    button.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        openMediaPreview('pdf', item.url, item.description, actualIndex, 'other');
                    });

                    pdfContainer.appendChild(button);
                });
            }

            // إضافة الروابط الخارجية (التعديل المطلوب)
            if (mediaByType.link.length > 0) {
                const categoryDiv = document.createElement('div');
                categoryDiv.className = 'media-category';
                categoryDiv.innerHTML = `
                    <h4><i class="fas fa-link"></i> روابط خارجية</h4>
                    <div class="link-container" id="externalLinks"></div>
                `;
                otherGridElement.appendChild(categoryDiv);

                const linksContainer = categoryDiv.querySelector('#externalLinks');
                mediaByType.link.forEach(item => {
                    const link = document.createElement('a');
                    link.href = item.url;
                    link.target = '_blank';
                    link.className = 'media-button link-button';
                    link.innerHTML = `
                        <i class="fas fa-external-link-alt"></i>
                        <div class="media-label">${item.description || 'زيارة الرابط'}</div>
                    `;
                    linksContainer.appendChild(link);
                });
            }
        }

        // إضافة معالجات النقر لأزرار التبويب
        setupMediaTabs();

        // إضافة معالجات النقر للوسائط
        setupMediaClickHandlers();

        // تكبير وتصغير صورة المشروع عند التمرير في الشات
        const projectChatContainer = document.getElementById('projectChat');
        const projectImageContainer = document.getElementById('projectImageContainer');

        if (projectChatContainer && projectImageContainer) {
            projectChatContainer.addEventListener('scroll', function() {
                if (this.scrollTop > 50) {
                    projectImageContainer.classList.add('small');
                } else {
                    projectImageContainer.classList.remove('small');
                }
            });
        }

        // إعداد الشات بوت للمشروع
        setupProjectChat(projectId);



    } catch (error) {
        console.error('خطأ في تحميل تفاصيل المشروع:', error);
        projectModalBody.innerHTML = '<p style="color: var(--secondary-color); text-align: center;">حدث خطأ في تحميل تفاصيل المشروع</p>';
    }
}



// إعداد الشات بوت للمشروع مع نظام الذاكرة والسياق المحسن
async function setupProjectChat(projectId) {
    const projectChat = document.getElementById('projectChat');
    const projectChatInput = document.getElementById('projectChatInput');
    const projectChatSend = document.getElementById('projectChatSend');

    if (!projectChat || !projectChatInput || !projectChatSend) return;

    // جلب برومبت المشروع
    const promptRef = db.ref(`portfolio/projectsPrompts/${projectId}`);
    const promptSnapshot = await promptRef.once('value');
    const projectPrompt = promptSnapshot.val() || "أنت مساعد ذكي يساعد في الدفاع عن مشروع يوسف حاتم أمام لجنة القبول في MIT هنا.";

    // جلب مفتاح API
    const apiKeyRef = db.ref('portfolio/api/apiKey');
    const apiKeySnapshot = await apiKeyRef.once('value');
    openaiApiKey = apiKeySnapshot.val();

    // جلب ذاكرة المحادثة المحفوظة للمشروع
    const memoryRef = db.ref(`portfolio/memory/${projectId}`);
    const memorySnapshot = await memoryRef.once('value');
    const savedMemory = memorySnapshot.val() || [];

    // تحويل الذاكرة لمصفوفة إذا كانت كائن
    let conversationMemory = Array.isArray(savedMemory) ? savedMemory : Object.values(savedMemory || {});

    // جلب شرح المشروع الأولي
    let projectExplanation = "عذرا مازلت تحت التدريب لاستطيع شرح المشروع لحضراتكم";
    try {
        const explainRef = db.ref(`portfolio/explain/${projectId}`);
        const explainSnapshot = await explainRef.once('value');
        const explainData = explainSnapshot.val();
        if (explainData) {
            projectExplanation = explainData;
        }
    } catch (error) {
        console.error('خطأ في جلب شرح المشروع:', error);
    }

    // التحقق من وجود رسالة الشرح الأولية في الذاكرة
    let hasInitialExplanation = conversationMemory.some(msg => !msg.isUser && (msg.isInitial || msg.text === projectExplanation));

    // إضافة رسالة للدردشة مع حفظ في قاعدة البيانات
    async function addProjectMessage(text, isUser, useTypewriter = false, saveToDatabase = true, isInitial = false) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;

        if (isUser) {
            messageDiv.innerHTML = `<p>${text}</p>`;
            projectChat.appendChild(messageDiv);
            autoScrollIfAtBottom(projectChat, true);
            // قراءة رسالة المستخدم تلقائياً بصوت أنثوي
            autoReadMessage(text, 'female');
        } else {
            const p = document.createElement('p');
            messageDiv.appendChild(p);
            projectChat.appendChild(messageDiv);

            if (useTypewriter) {
                // القراءة الصوتية ستبدأ داخل typewriterEffectWithFormattingProject
                await typewriterEffectWithFormattingProject(p, text);
            } else {
                // الحفاظ على التنسيق عند عرض الرسائل المحفوظة
                p.innerHTML = text.replace(/\n/g, '<br>');
                autoScrollIfAtBottom(projectChat, true);
            }
        }

        // حفظ الرسالة في الذاكرة المحلية والقاعدة
        if (saveToDatabase) {
            const messageData = {
                text: text,
                isUser: isUser,
                isInitial: isInitial,
                timestamp: Date.now()
            };

            conversationMemory.push(messageData);

            // حفظ في قاعدة البيانات
            try {
                const newMessageRef = db.ref(`portfolio/memory/${projectId}`).push();
                await newMessageRef.set(messageData);
            } catch (error) {
                console.error('خطأ في حفظ رسالة المشروع:', error);
            }
        }

        // حفظ الرسالة في فهرس المشروع المحلي أيضاً
        if (projectIndex.has(projectId)) {
            const projectData = projectIndex.get(projectId);
            projectData.chats.push({text: text, isUser: isUser});
        } else {
            projectIndex.set(projectId, {
                chats: [{text: text, isUser: isUser}],
                explanation: isInitial ? text : projectExplanation
            });
        }
    }

    // دالة محسنة لتأثير الكتابة مع الحفاظ على التنسيق في بوت المشروع
    async function typewriterEffectWithFormattingProject(element, text, speed = 30) {
        if (!element || !text) return;

        element.innerHTML = '';

        // إضافة مؤشر الكتابة
        const typingIndicator = document.createElement('span');
        typingIndicator.className = 'typing-indicator';
        typingIndicator.textContent = '...';
        element.appendChild(typingIndicator);

        // انتظار قصير قبل بدء الكتابة
        await new Promise(resolve => setTimeout(resolve, 300));

        // إزالة مؤشر الكتابة وبدء الكتابة الفعلية
        if (element.contains(typingIndicator)) {
            element.removeChild(typingIndicator);
        }

        // بدء القراءة الصوتية فوراً قبل بدء الكتابة
        autoReadMessage(text, 'male');

        // تحويل النص مع الحفاظ على فواصل الأسطر
        const formattedText = text.replace(/\n/g, '<br>');

        // كتابة النص حرفاً بحرف مع دعم HTML
        let currentHTML = '';
        for (let i = 0; i < formattedText.length; i++) {
            if (formattedText.substr(i, 4) === '<br>') {
                currentHTML += '<br>';
                i += 3; // تخطي باقي أحرف <br>
            } else {
                currentHTML += formattedText.charAt(i);
            }

            element.innerHTML = currentHTML;

            // سرعة متغيرة: أسرع للمسافات وأبطأ للأحرف
            const currentSpeed = formattedText.charAt(i) === ' ' ? speed * 0.3 : speed;
            await new Promise(resolve => setTimeout(resolve, currentSpeed));

            // التمرير التلقائي الذكي أثناء الكتابة
            const projectChat = document.getElementById('projectChat');
            if (projectChat) {
                autoScrollIfAtBottom(projectChat, false);
            }
        }
    }

    // الحصول على آخر رسائل للسياق (مع تضمين رسالة الشرح)
    function getRecentProjectContext() {
        // تأكد من تضمين رسالة الشرح في بداية السياق
        let contextMessages = [];

        // إضافة رسالة الشرح كجزء من السياق إذا لم تكن موجودة في الذاكرة
        const hasExplanationInMemory = conversationMemory.some(msg => 
            !msg.isUser && (msg.isInitial || msg.text === projectExplanation)
        );

        if (!hasExplanationInMemory) {
            contextMessages.push({
                role: "assistant",
                content: `شرح المشروع: ${projectExplanation}`
            });
        }

        // إضافة آخر 6 رسائل من الذاكرة
        const recentMessages = conversationMemory.slice(-6);
        const recentContext = recentMessages.map(msg => ({
            role: msg.isUser ? "user" : "assistant",
            content: msg.text
        }));

        return [...contextMessages, ...recentContext];
    }

    // الرد على سؤال المستخدم مع السياق المحسن
    async function respondToProjectQuestion(question) {
        // إظهار مؤشر الكتابة
        const typingIndicator = showTypingIndicator(projectChat);

        try {
            // بناء السياق مع رسالة الشرح وآخر الرسائل
            const recentContext = getRecentProjectContext();
            const messages = [
                { role: "system", content: `${projectPrompt}\n\nملاحظة هامة: لديك معرفة بتفاصيل هذا المشروع من خلال الشرح التالي: ${projectExplanation}` },
                ...recentContext,
                { role: "user", content: question }
            ];

            // الحصول على الرد من OpenAI مع السياق
            const response = await getOpenAIResponseWithContext(messages);

            // إخفاء مؤشر الكتابة
            hideTypingIndicator();

            // إضافة الرد إلى الدردشة مع التأثير التدريجي
            await addProjectMessage(response, false, true);
        } catch (error) {
            console.error('خطأ في بوت المشروع:', error);
            // إخفاء مؤشر الكتابة
            hideTypingIndicator();
            await addProjectMessage('حدث خطأ أثناء التواصل مع الخادم. يرجى المحاولة لاحقاً.', false, true);
        }
    }

    // إرسال رسالة المستخدم
    async function sendMessage() {
        const question = projectChatInput.value.trim();
        if (!question) return;

        // إضافة سؤال المستخدم
        await addProjectMessage(question, true);

        // مسح حقل الإدخال
        projectChatInput.value = '';

        // الرد على السؤال
        await respondToProjectQuestion(question);
    }

    // استرجاع المحادثات المحفوظة أولاً
    if (conversationMemory.length > 0) {
        for (const message of conversationMemory) {
            await addProjectMessage(message.text, message.isUser, false, false); // false = لا تحفظ مرة أخرى
        }
    } else {
        // إذا لم توجد محادثات محفوظة، أضف رسالة الشرح مع تأثير الكتابة
        await addProjectMessage(projectExplanation, false, true, true, true);
    }

    // إضافة أزرار التحكم في القراءة التلقائية فوق صندوق الشات
    const projectChatContainer = document.querySelector('.project-chat-container');
    if (projectChatContainer && !document.getElementById('projectAutoReadToggle')) {
        const toggleContainer = document.createElement('div');
        toggleContainer.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 15px;';

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'projectAutoReadToggle';
        toggleBtn.className = 'auto-read-toggle';
        toggleBtn.innerHTML = `<i class="fas fa-volume-up"></i> القراءة التلقائية: مفعّلة`;
        toggleBtn.style.cssText = `
            padding: 10px 20px;
            border-radius: 25px;
            border: none;
            background: var(--gradient);
            color: white;
            cursor: pointer;
            transition: all 0.3s ease;
            font-weight: 600;
        `;

        toggleBtn.addEventListener('click', () => {
            autoReadEnabled = !autoReadEnabled;
            if (autoReadEnabled) {
                toggleBtn.innerHTML = `<i class="fas fa-volume-up"></i> القراءة التلقائية: مفعّلة`;
                toggleBtn.style.background = 'var(--gradient)';
                toggleBtn.style.color = 'white';
                toggleBtn.style.borderColor = 'transparent';
            } else {
                toggleBtn.innerHTML = `<i class="fas fa-volume-mute"></i> القراءة التلقائية: متوقفة`;
                toggleBtn.style.background = 'rgba(78, 205, 196, 0.1)';
                toggleBtn.style.color = 'var(--accent-color)';
                toggleBtn.style.borderColor = 'var(--accent-color)';
                // إيقاف أي قراءة جارية
                stopSpeech();
            }
        });

        const stopBtn = document.createElement('button');
        stopBtn.id = 'stopSpeechBtn';
        stopBtn.className = 'stop-speech-btn';
        stopBtn.innerHTML = `<i class="fas fa-stop"></i> إيقاف الكلام`;
        stopBtn.disabled = true;
        stopBtn.style.cssText = `
            padding: 10px 20px;
            border-radius: 25px;
            border: 2px solid var(--secondary-color);
            background: rgba(255, 107, 107, 0.1);
            color: var(--secondary-color);
            cursor: pointer;
            transition: all 0.3s ease;
            font-weight: 600;
        `;

        stopBtn.addEventListener('click', () => {
            stopSpeech();
        });

        toggleContainer.appendChild(toggleBtn);
        toggleContainer.appendChild(stopBtn);

        const projectChat = projectChatContainer.querySelector('.project-chat');
        if (projectChat) {
            projectChatContainer.insertBefore(toggleContainer, projectChat);
        }
    }

    // معالجة النقر على زر الإرسال
    projectChatSend.addEventListener('click', sendMessage);

    // معالجة الضغط على Enter في حقل الإدخال
    projectChatInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });

    // إضافة دالة لحفظ وصف الوسائط في السياق
    window.addMediaDescriptionToProjectContext = async function(projectId, mediaType, description) {
        if (currentProjectId === projectId) {
            const contextMessage = `تم عرض ${getMediaTypeName(mediaType)}: ${description}`;

            // إضافة الرسالة للسياق فقط (بدون عرض)
            const messageData = {
                text: contextMessage,
                isUser: false,
                isMediaContext: true,
                timestamp: Date.now()
            };

            conversationMemory.push(messageData);

            // حفظ في قاعدة البيانات
            try {
                const newMessageRef = db.ref(`portfolio/memory/${projectId}`).push();
                await newMessageRef.set(messageData);
            } catch (error) {
                console.error('خطأ في حفظ وصف الوسائط:', error);
            }
        }
    };
}

// وظيفة تأثير الكتابة التدريجية
async function typewriterEffect(element, text, speed = 30) {
    if (!element || !text) return;

    element.textContent = '';

    // إضافة مؤشر الكتابة
    const typingIndicator = document.createElement('span');
    typingIndicator.className = 'typing-indicator';
    typingIndicator.textContent = '...';
    element.appendChild(typingIndicator);

    // انتظار قصير قبل بدء الكتابة
    await new Promise(resolve => setTimeout(resolve, 300));

    // إزالة مؤشر الكتابة وبدء الكتابة الفعلية
    if (element.contains(typingIndicator)) {
        element.removeChild(typingIndicator);
    }

    // كتابة النص حرفاً بحرف
    for (let i = 0; i < text.length; i++) {
        element.textContent += text.charAt(i);

        // سرعة متغيرة: أسرع للمسافات وأبطأ للأحرف
        const currentSpeed = text.charAt(i) === ' ' ? speed * 0.3 : speed;
        await new Promise(resolve => setTimeout(resolve, currentSpeed));

        // التمرير التلقائي الذكي
        const chatContainer = element.closest('.project-chat') || element.closest('.chat-container');
        if (chatContainer) {
            autoScrollIfAtBottom(chatContainer, false);
        }
    }
}

function filterArabicText(text) {
    const arabicPattern = /[\u0600-\u06FF\u0750-\u077F\u08A0-\u08FF\uFB50-\uFDFF\uFE70-\uFEFF]/g;
    return text.replace(arabicPattern, '').trim();
}


// دالة للتحقق إذا كان المستخدم في نهاية الشات أو قريب منها
function isUserAtBottom(container, threshold = 100) {
    if (!container) return false;
    const scrollPosition = container.scrollTop + container.clientHeight;
    const scrollHeight = container.scrollHeight;
    return scrollHeight - scrollPosition <= threshold;
}

// دالة للتمرير التلقائي السلس إذا كان المستخدم في الأسفل
function autoScrollIfAtBottom(container, smooth = true) {
    if (!container) return;

    if (isUserAtBottom(container)) {
        if (smooth) {
            container.scrollTo({
                top: container.scrollHeight,
                behavior: 'smooth'
            });
        } else {
            container.scrollTop = container.scrollHeight;
        }
    }
}

// إضافة مؤشر "يكتب الآن" 
function showTypingIndicator(container) {
    const typingDiv = document.createElement('div');
    typingDiv.className = 'message bot-message typing-message';
    typingDiv.id = 'typingIndicator';
    typingDiv.innerHTML = `
        <div class="typing-animation">
            <span></span>
            <span></span>
            <span></span>
        </div>
        <p style="margin: 0; padding-right: 10px;">يكتب الآن...</p>
    `;
    container.appendChild(typingDiv);
    autoScrollIfAtBottom(container, true);
    return typingDiv;
}

// إزالة مؤشر "يكتب الآن"
function hideTypingIndicator() {
    const typingIndicator = document.getElementById('typingIndicator');
    if (typingIndicator) {
        typingIndicator.remove();
    }
}

// التواصل مع OpenAI API
async function getOpenAIResponse(prompt, question) {
    if (!openaiApiKey) {
        return "عذراً، لا يمكن الوصول إلى خدمة الذكاء الاصطناعي في الوقت الحالي.";
    }

    try {
        // إعداد طلب API
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o",
                messages: [
                    { role: "system", content: prompt },
                    { role: "user", content: question }
                ],
                temperature: 0.7,
                max_tokens: 2500
            })
        });

        const data = await response.json();
        return data.choices[0].message.content;
    } catch (error) {
        console.error('خطأ في التواصل مع OpenAI:', error);
        return 'عذراً، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.';
    }
}

// التواصل مع OpenAI API مع السياق - النسخة المحسنة
async function getOpenAIResponseWithContext(messages) {
    if (!openaiApiKey) {
        return "عذراً، لا يمكن الوصول إلى خدمة الذكاء الاصطناعي في الوقت الحالي.";
    }

    try {
        // إعداد طلب API مع السياق
        const response = await fetch('https://api.openai.com/v1/chat/completions', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${openaiApiKey}`
            },
            body: JSON.stringify({
                model: "gpt-4o", // ✅ النموذج الأقوى
                messages: messages,
                temperature: 0.7,
                max_tokens: 2500, // ✅ زيادة Tokens للرسائل الطويلة
                stream: false // ✅ تأكد من إكمال الرسالة بالكامل
            })
        });

        // التحقق من استجابة الـ API
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }

        const data = await response.json();

        // التحقق من وجود الرد
        if (!data.choices || !data.choices[0] || !data.choices[0].message) {
            throw new Error('Invalid response format from OpenAI');
        }

        return data.choices[0].message.content;
    } catch (error) {
        console.error('خطأ في التواصل مع OpenAI مع السياق:', error);

        // رسائل خطأ أكثر وضوحاً
        if (error.message.includes('quota')) {
            return 'عذراً، تم تجاوز الحد المسموح لاستخدام الذكاء الاصطناعي. يرجى المحاولة لاحقاً.';
        } else if (error.message.includes('rate limit')) {
            return 'عذراً، عدد الطلبات كبير حالياً. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.';
        } else {
            return 'عذراً، حدث خطأ في معالجة طلبك. يرجى المحاولة مرة أخرى.';
        }
    }
}

// فتح معاينة الوسائط داخل نافذة المشروع مع التنقل
function openMediaPreview(type, url, description, mediaIndex = 0, tabType = '') {
    console.log('Opening media preview:', type, url, description);

    // التأكد من أن نافذة المشروع مفتوحة
    if (!projectModal.style.display || projectModal.style.display === 'none') {
        return;
    }

    // تحديد المصفوفة الحالية للتنقل
    if (tabType) {
        currentMediaTab = tabType;
        if (tabType === 'photos') {
            currentMediaArray = projectMediaData.photos;
        } else if (tabType === 'videos') {
            currentMediaArray = projectMediaData.videos;
        } else if (tabType === 'other') {
            currentMediaArray = projectMediaData.otherMedia;
        }
        currentMediaIndex = mediaIndex;
    }

    // إضافة الوصف للشات بوت أولاً - لجميع أنواع الوسائط مع تأثير الكتابة التدريجية
    if (currentProjectId && description) {
        addMediaMessageToChat(type, description, url);
    }

    // حفظ محتوى الوسائط الحالي للعودة إليه
    const mediaSection = document.querySelector('.project-media-section');
    if (!mediaSection) return;

    const originalContent = mediaSection.innerHTML;

    // إخفاء الشبكات والتبويبات
    const mediaTabs = document.querySelectorAll('.media-tab-content');
    mediaTabs.forEach(tab => {
        tab.style.display = 'none';
    });

    // إنشاء عارض الوسائط المكبر مع أزرار التنقل
    mediaSection.innerHTML = `
        <div class="media-viewer">
            <div class="media-viewer-header">
                <button class="back-to-gallery" id="backToGallery" data-media-url="${url}" data-media-type="${type}">
                    <i class="fas fa-arrow-right"></i>
                    العودة لاستكشاف الوسائط
                </button>

                <div class="media-navigation">
                    <button class="nav-media-btn" id="prevMedia" ${currentMediaArray.length === 0 || currentMediaIndex === 0 ? 'disabled' : ''}>
                        <i class="fas fa-chevron-right"></i>
                        السابق
                    </button>
                    <div class="media-counter" id="mediaCounter">
                        ${currentMediaArray.length > 0 ? `${currentMediaIndex + 1} من ${currentMediaArray.length}` : '1 من 1'}
                    </div>
                    <button class="nav-media-btn" id="nextMedia" ${currentMediaArray.length === 0 || currentMediaIndex === currentMediaArray.length - 1 ? 'disabled' : ''}>
                        التالي
                        <i class="fas fa-chevron-left"></i>
                    </button>
                </div>

                <button class="open-external" onclick="window.open('${url}', '_blank')">
                    <i class="fas fa-external-link-alt"></i>
                    فتح خارجياً
                </button>
            </div>
            <div class="media-display" id="mediaDisplay">
                <!-- سيتم ملؤها ديناميكياً -->
            </div>
        </div>
    `;

    // عرض الوسائط الحالية
    displayCurrentMedia(type, url, description);

    // إعداد أزرار التنقل
    setupNavigationButtons(originalContent, mediaSection);

    // إعداد زر العودة
    setupBackButton(url, type, originalContent, mediaSection);
}

// دالة لعرض الوسائط الحالية
function displayCurrentMedia(type, url, description) {
    const mediaDisplay = document.getElementById('mediaDisplay');

    // إزالة التوهج من جميع رسائل العرض السابقة
    const projectChat = document.getElementById('projectChat');
    if (projectChat) {
        const activeMediaMessages = projectChat.querySelectorAll('.media-preview-active');
        activeMediaMessages.forEach(msg => {
            msg.classList.remove('media-preview-active');
            msg.style.animation = 'none';
        });
    }

    if (type === 'image') {
        mediaDisplay.innerHTML = `
            <img src="${url}" alt="${description}" style="max-width: 100%; max-height: 100%; object-fit: contain; border-radius: 10px;">
        `;
    } else if (type === 'video') {
        mediaDisplay.innerHTML = `
            <video controls style="max-width: 100%; max-height: 100%; border-radius: 10px;">
                <source src="${url}" type="video/mp4">
                متصفحك لا يدعم عرض الفيديو
            </video>
        `;

        // خفض صوت الموسيقى عند تشغيل الفيديو
        const videoElement = mediaDisplay.querySelector('video');
        if (videoElement) {
            videoElement.addEventListener('play', () => {
                if (backgroundMusic && !backgroundMusic.paused) {
                    backgroundMusic.volume = 0.4;
                }
            });
            videoElement.addEventListener('pause', () => {
                if (backgroundMusic && !backgroundMusic.paused) {
                    backgroundMusic.volume = 1.0;
                }
            });
            videoElement.addEventListener('ended', () => {
                if (backgroundMusic && !backgroundMusic.paused) {
                    backgroundMusic.volume = 1.0;
                }
            });
        }
    } else if (type === 'youtube') {
        const videoId = getYouTubeId(url);
        if (videoId) {
            mediaDisplay.innerHTML = `
                <iframe 
                    src="https://www.youtube.com/embed/${videoId}?autoplay=0" 
                    frameborder="0" 
                    allowfullscreen
                    style="width: 100%; height: 450px; border-radius: 10px;"
                ></iframe>
            `;
        } else {
            mediaDisplay.innerHTML = `
                <div style="text-align: center; padding: 40px;">
                    <i class="fab fa-youtube" style="font-size: 3rem; color: #ff0000; margin-bottom: 20px;"></i>
                    <h3>رابط يوتيوب غير صحيح</h3>
                </div>
            `;
        }
    } else if (type === 'pdf') {
        mediaDisplay.innerHTML = `
            <iframe 
                src="https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true" 
                style="width: 100%; height: 500px; border-radius: 10px; border: none;"
            ></iframe>
        `;
    } else if (type === 'link') {
        mediaDisplay.innerHTML = `
            <div style="text-align: center; padding: 40px;">
                <i class="fas fa-external-link-alt" style="font-size: 3rem; color: var(--accent-color); margin-bottom: 20px;"></i>
                <h3>رابط خارجي</h3>
                <p style="margin: 20px 0; color: #ddd;">${description}</p>
                <a href="${url}" target="_blank" class="link-button">
                    <i class="fas fa-external-link-alt"></i>
                    فتح الرابط
                </a>
            </div>
        `;
    }
}

// دالة لإضافة رسالة وسائط للشات
function addMediaMessageToChat(type, description, url) {
    const projectChat = document.getElementById('projectChat');
    if (projectChat) {
        const mediaMessage = document.createElement('div');
        mediaMessage.className = 'message bot-message media-message media-preview-active';
        mediaMessage.setAttribute('data-media-url', url);
        mediaMessage.setAttribute('data-media-type', type);

        // تحديد النوع والوصف بناءً على نوع الوسائط
        let mediaTypeText = getMediaTypeName(type);
        let iconClass = getMediaIcon(type);

        // إنشاء العنصر مع عنصر فارغ للوصف
        mediaMessage.innerHTML = `
            <div class="media-preview-header">
                <i class="${getIconClass(type)} ${iconClass}"></i>
                <strong>تم عرض ${mediaTypeText}</strong>
            </div>
            <p class="media-description-text"></p>
        `;
        projectChat.appendChild(mediaMessage);
        autoScrollIfAtBottom(projectChat, true);

        // بدء القراءة الصوتية للوصف فوراً بصوت شاب (ذكوري)
        autoReadMessage(description, 'young-male');

        // تطبيق تأثير الكتابة التدريجية على الوصف
        const descriptionElement = mediaMessage.querySelector('.media-description-text');
        typewriterEffect(descriptionElement, description, 25);

        // حفظ الرسالة في فهرس المشروع المحلي
        if (projectIndex.has(currentProjectId)) {
            const projectData = projectIndex.get(currentProjectId);
            projectData.chats.push({
                text: `تم عرض ${mediaTypeText}: ${description}`,
                isUser: false
            });
        }

        // حفظ الوصف في سياق قاعدة البيانات للمشروع
        if (window.addMediaDescriptionToProjectContext) {
            window.addMediaDescriptionToProjectContext(currentProjectId, type, description);
        }
    }
}

// دالة لإعداد أزرار التنقل
function setupNavigationButtons(originalContent, mediaSection) {
    const prevBtn = document.getElementById('prevMedia');
    const nextBtn = document.getElementById('nextMedia');
    const mediaCounter = document.getElementById('mediaCounter');

    if (prevBtn) {
        prevBtn.addEventListener('click', () => {
            if (currentMediaIndex > 0) {
                currentMediaIndex--;
                const media = currentMediaArray[currentMediaIndex];
                displayCurrentMedia(media.type, media.url, media.description);
                addMediaMessageToChat(media.type, media.description, media.url);
                updateNavigationState();
            }
        });
    }

    if (nextBtn) {
        nextBtn.addEventListener('click', () => {
            if (currentMediaIndex < currentMediaArray.length - 1) {
                currentMediaIndex++;
                const media = currentMediaArray[currentMediaIndex];
                displayCurrentMedia(media.type, media.url, media.description);
                addMediaMessageToChat(media.type, media.description, media.url);
                updateNavigationState();
            }
        });
    }

    function updateNavigationState() {
        if (mediaCounter) {
            mediaCounter.textContent = `${currentMediaIndex + 1} من ${currentMediaArray.length}`;
        }
        if (prevBtn) {
            prevBtn.disabled = currentMediaIndex === 0;
        }
        if (nextBtn) {
            nextBtn.disabled = currentMediaIndex === currentMediaArray.length - 1;
        }

        // تحديث زر الفتح الخارجي
        const openExternalBtn = document.querySelector('.open-external');
        if (openExternalBtn && currentMediaArray.length > 0) {
            const currentMedia = currentMediaArray[currentMediaIndex];
            openExternalBtn.onclick = () => window.open(currentMedia.url, '_blank');
        }
    }
}

// دالة لإعداد زر العودة
function setupBackButton(url, type, originalContent, mediaSection) {
    document.getElementById('backToGallery').addEventListener('click', function() {
        const mediaUrl = this.getAttribute('data-media-url');
        const mediaType = this.getAttribute('data-media-type');

        // تغيير لون الرسالة في الشات للإشارة للخروج من وضع العرض
        const projectChat = document.getElementById('projectChat');
        if (projectChat && currentProjectId) {
            const activeMediaMessages = projectChat.querySelectorAll('.media-preview-active');
            activeMediaMessages.forEach(msg => {
                if (msg.getAttribute('data-media-url') === mediaUrl && 
                    msg.getAttribute('data-media-type') === mediaType) {
                    // تغيير اللون للون رسائل المستخدم (الأزرق)
                    msg.classList.remove('bot-message', 'media-preview-active');
                    msg.classList.add('user-message', 'media-preview-closed');

                    // تحديث النص للإشارة للخروج
                    const header = msg.querySelector('.media-preview-header strong');
                    if (header) {
                        header.textContent = header.textContent.replace('تم عرض', 'تم إغلاق عرض');
                    }
                }
            });
        }

        // استعادة المحتوى الأصلي
        mediaSection.innerHTML = originalContent;

        // إعادة تفعيل التبويبات والمعالجات مع تأخير أطول لضمان التحميل
        setTimeout(() => {
            setupMediaTabs();
            setupMediaClickHandlers();

            // إعادة إضافة معالجات النقر لأزرار يوتيوب و PDF بشكل مباشر
            reattachMediaButtonHandlers();

            // إعادة تفعيل التبويب "وسائط أخرى" إذا كنا في معاينة وسائط أخرى
            if (currentMediaTab === 'other') {
                const otherTab = mediaSection.querySelector('.media-tab[data-tab="other"]');
                const otherTabContent = mediaSection.querySelector('#otherTab');

                if (otherTab && otherTabContent) {
                    // إزالة جميع التفعيلات أولاً
                    mediaSection.querySelectorAll('.media-tab').forEach(tab => tab.classList.remove('active'));
                    mediaSection.querySelectorAll('.media-tab-content').forEach(content => content.classList.remove('active'));

                    // تفعيل تبويب وسائط أخرى
                    otherTab.classList.add('active');
                    otherTabContent.classList.add('active');
                }
            } else {
                // إعادة تفعيل التبويب الأول إذا لم نكن في وسائط أخرى
                const firstTab = mediaSection.querySelector('.media-tab');
                const firstTabContent = mediaSection.querySelector('.media-tab-content');
                if (firstTab && firstTabContent) {
                    // إزالة جميع التفعيلات أولاً
                    mediaSection.querySelectorAll('.media-tab').forEach(tab => tab.classList.remove('active'));
                    mediaSection.querySelectorAll('.media-tab-content').forEach(content => content.classList.remove('active'));

                    // تفعيل الأول
                    firstTab.classList.add('active');
                    firstTabContent.classList.add('active');
                }
            }
        }, 200);
    });
}

// دالة جديدة لإعادة إضافة معالجات النقر لأزرار الوسائط
function reattachMediaButtonHandlers() {
    // معالجة أزرار يوتيوب
    document.querySelectorAll('.youtube-button').forEach(button => {
        // إزالة المعالج القديم بإنشاء نسخة جديدة
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);

        const type = newButton.dataset.type;
        const url = newButton.dataset.url;
        const description = newButton.dataset.description;
        const mediaIndex = parseInt(newButton.dataset.mediaIndex) || 0;
        const mediaType = newButton.dataset.mediaType || 'other';

        if (type && url && description) {
            newButton.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('YouTube button click after restore:', {type, url, description, mediaIndex});
                openMediaPreview(type, url, description, mediaIndex, mediaType);
            });
        }
    });

    // معالجة أزرار PDF
    document.querySelectorAll('.pdf-button').forEach(button => {
        // إزالة المعالج القديم بإنشاء نسخة جديدة
        const newButton = button.cloneNode(true);
        button.parentNode.replaceChild(newButton, button);

        const type = newButton.dataset.type;
        const url = newButton.dataset.url;
        const description = newButton.dataset.description;
        const mediaIndex = parseInt(newButton.dataset.mediaIndex) || 0;
        const mediaType = newButton.dataset.mediaType || 'other';

        if (type && url && description) {
            newButton.addEventListener('click', function(e) {
                e.preventDefault();
                e.stopPropagation();
                console.log('PDF button click after restore:', {type, url, description, mediaIndex});
                openMediaPreview(type, url, description, mediaIndex, mediaType);
            });
        }
    });
}

// دالة للحصول على أيقونة نوع الوسائط
function getMediaIcon(type) {
    switch (type) {
        case 'image': return 'image';
        case 'video': return 'video';
        case 'youtube': return 'youtube';
        case 'pdf': return 'file-pdf';
        case 'link': return 'link';
        default: return 'file';
    }
}

// دالة للحصول على كلاس الأيقونة الكامل
function getIconClass(type) {
    switch (type) {
        case 'image': return 'fas fa-';
        case 'video': return 'fas fa-';
        case 'youtube': return 'fab fa-';
        case 'pdf': return 'fas fa-';
        case 'link': return 'fas fa-';
        default: return 'fas fa-';
    }
}

// دالة للحصول على اسم نوع الوسائط بالعربية
function getMediaTypeName(type) {
    switch (type) {
        case 'image': return 'الصورة';
        case 'video': return 'الفيديو';
        case 'youtube': return 'فيديو يوتيوب';
        case 'pdf': return 'ملف PDF';
        case 'link': return 'الرابط';
        default: return 'الوسائط';
    }
}



// دالة لتحميل ملف PDF وعرضه
function loadPdf(url) {
    currentPdfUrl = url;
    pdfZoomLevel = 1.0;

    // إظهار حالة التحميل وإخفاء الأخطاء
    pdfLoading.style.display = 'block';
    pdfError.style.display = 'none';
    pdfView.style.display = 'none';
    pdfControls.style.display = 'none';

    // إنشاء رابط Google Docs Viewer لعرض PDF
    const encodedUrl = encodeURIComponent(url);
    pdfView.src = `https://docs.google.com/gview?url=${encodedUrl}&embedded=true`;

    // إظهار ملف PDF عند التحميل
    pdfView.onload = () => {
        pdfLoading.style.display = 'none';
        pdfView.style.display = 'block';
        pdfControls.style.display = 'flex';
        updatePdfZoom();
    };

    // معالجة الأخطاء
    pdfView.onerror = () => {
        pdfLoading.style.display = 'none';
        pdfError.style.display = 'block';
    };

    // إعداد عناصر التحكم
    document.getElementById('pdfZoomIn').onclick = () => {
        if (pdfZoomLevel < maxZoom) {
            pdfZoomLevel += pdfZoomStep;
            updatePdfZoom();
        }
    };

    document.getElementById('pdfZoomOut').onclick = () => {
        if (pdfZoomLevel > minZoom) {
            pdfZoomLevel -= pdfZoomStep;
            updatePdfZoom();
        }
    };

    document.getElementById('pdfDownload').onclick = () => {
        window.open(currentPdfUrl, '_blank');
    };
}

// تحديث مستوى التكبير/التصغير لملف PDF
function updatePdfZoom() {
    pdfView.style.transform = `scale(${pdfZoomLevel})`;
    pdfView.style.transformOrigin = '0 0';
    pdfView.style.width = `${100 / pdfZoomLevel}%`;
    pdfView.style.height = `${100 / pdfZoomLevel}%`;
}

// استخراج معرف فيديو YouTube من الرابط
function getYouTubeId(url) {
    const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
    const match = url.match(regExp);

    if (match && match[2].length === 11) {
        return match[2];
    } else {
        return null;
    }
}

// الحصول على أيقونة بناءً على نوع الوسائط
function getIconForType(type) {
    switch (type) {
        case 'pdf': return 'fas fa-file-pdf';
        case 'youtube': return 'fab fa-youtube';
        case 'link': return 'fas fa-link';
        default: return 'fas fa-file';
    }
}

// تحميل الصور
async function loadPhotos() {
    try {
        const photosRef = db.ref('portfolio/photos');
        const snapshot = await photosRef.once('value');
        const photos = snapshot.val();
        photosContainer.innerHTML = '';

        if (!photos) {
            photosContainer.innerHTML = '<div style="color: var(--primary-color); text-align: center; grid-column: 1/-1;">لا توجد صور حالياً</div>';
            return;
        }

        Object.keys(photos).forEach(key => {
            const photo = photos[key];
            createMediaCard(photo, 'image', photosContainer);
        });
    } catch (error) {
        console.error('خطأ في تحميل الصور:', error);
        photosContainer.innerHTML = '<div style="color: var(--secondary-color); text-align: center; grid-column: 1/-1;">حدث خطأ في تحميل الصور. يرجى المحاولة لاحقاً.</div>';
    }
}

// تحميل الفيديوهات
async function loadVideos() {
    try {
        const videosRef = db.ref('portfolio/videos');
        const snapshot = await videosRef.once('value');
        const videos = snapshot.val();
        videosContainer.innerHTML = '';

        if (!videos) {
            videosContainer.innerHTML = '<div style="color: var(--primary-color); text-align: center; grid-column: 1/-1;">لا توجد فيديوهات حالياً</div>';
            return;
        }

        Object.keys(videos).forEach(key => {
            const video = videos[key];
            createMediaCard(video, 'video', videosContainer);
        });
    } catch (error) {
        console.error('خطأ في تحميل الفيديوهات:', error);
        videosContainer.innerHTML = '<div style="color: var(--secondary-color); text-align: center; grid-column: 1/-1;">حدث خطأ في تحميل الفيديوهات. يرجى المحاولة لاحقاً.</div>';
    }
}

// تحميل الوسائط الأخرى
async function loadOtherMedia() {
    try {
        const mediaRef = db.ref('portfolio/otherMedia');
        const snapshot = await mediaRef.once('value');
        const media = snapshot.val();
        mediaContainer.innerHTML = '';

        if (!media) {
            mediaContainer.innerHTML = '<div style="color: var(--primary-color); text-align: center; grid-column: 1/-1;">لا توجد وسائط حالياً</div>';
            return;
        }

        Object.keys(media).forEach(key => {
            const item = media[key];
            createMediaCard(item, item.type, mediaContainer);
        });
    } catch (error) {
        console.error('خطأ في تحميل الوسائط:', error);
        mediaContainer.innerHTML = '<div style="color: var(--secondary-color); text-align: center; grid-column: 1/-1;">حدث خطأ في تحميل الوسائط. يرجى المحاولة لاحقاً.</div>';
    }
}

// إنشاء بطاقة وسائط
function createMediaCard(media, type, container) {
    const card = document.createElement('div');
    card.className = 'gallery-card';

    let mediaElement;

    if (type === 'image') {
        const img = new Image();
        img.className = 'gallery-image';
        img.src = media.url;
        img.alt = media.description;
        img.dataset.type = 'image';
        img.dataset.url = media.url;
        img.dataset.description = media.description;
        card.appendChild(img);
        mediaElement = img;
    } else if (type === 'video') {
        const video = document.createElement('video');
        video.className = 'gallery-video';
        video.controls = true;
        video.src = media.url;
        video.dataset.type = 'video';
        video.dataset.url = media.url;
        video.dataset.description = media.description;
        card.appendChild(video);
        mediaElement = video;
    } else if (type === 'pdf') {
        const mediaElement = document.createElement('div');
        mediaElement.className = 'pdf-view-container';
        mediaElement.innerHTML = `
            <iframe class="pdf-view" src="https://docs.google.com/gview?url=${encodeURIComponent(media.url)}&embedded=true"></iframe>
        `;
        card.appendChild(mediaElement);
    } else if (type === 'link') {
        const linkElement = document.createElement('a');
        linkElement.href = media.url;
        linkElement.target = '_blank';
        linkElement.className = 'external-link';
        linkElement.innerHTML = `
            <i class="fas fa-external-link-alt"></i>
            ${media.description || 'زيارة الرابط'}
        `;
        card.appendChild(linkElement);
    } else {
        const icon = document.createElement('i');
        icon.className = getIconForType(type);
        icon.style.fontSize = '3rem';
        icon.style.margin = '20px auto';
        icon.style.display = 'block';
        icon.style.textAlign = 'center';
        icon.style.color = type === 'pdf' ? '#e74c3c' : '#a178ff';

        card.appendChild(icon);
        card.dataset.type = type;
        card.dataset.url = media.url;
        card.dataset.description = media.description;
        mediaElement = card;
    }

    const content = document.createElement('div');
    content.className = 'gallery-content';

    const title = document.createElement('h3');
    title.className = 'gallery-title';
    title.textContent = media.description.substring(0, 50) + (media.description.length > 50 ? '...' : '');
    content.appendChild(title);

    const description = document.createElement('p');
    description.className = 'gallery-description';
    description.textContent = media.description;
    content.appendChild(description);

    const readMore = document.createElement('span');
    readMore.className = 'read-more';
    readMore.textContent = 'عرض المزيد';
    content.appendChild(readMore);

    const projectTag = document.createElement('div');
    projectTag.className = 'project-tag';
    projectTag.textContent = `المشروع ${media.projectId}`;
    content.appendChild(projectTag);

    const date = document.createElement('div');
    date.className = 'gallery-date';
    date.textContent = new Date(media.timestamp).toLocaleDateString('ar-EG');
    content.appendChild(date);

    card.appendChild(content);
    container.appendChild(card);

    // إضافة معالج النقر لفتح المعاينة
    if (mediaElement) {
        mediaElement.addEventListener('click', () => {
            openMediaPreview(type, media.url, media.description);
        });
    }

    // إعداد "عرض المزيد" للأوصاف
    readMore.addEventListener('click', function(e) {
        e.stopPropagation();
        description.classList.toggle('expanded');
        this.textContent = description.classList.contains('expanded') ? 'عرض أقل' : 'عرض المزيد';
    });
}

// رفع صورة جديدة
photoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    photoStatus.textContent = 'جاري رفع الصورة...';

    const file = document.getElementById('photoFile').files[0];
    const projectId = document.getElementById('photoProjectId').value;
    const description = document.getElementById('photoDescription').value;

    if (!file || !projectId || !description) {
        photoStatus.textContent = 'الرجاء ملء جميع الحقول';
        return;
    }

    try {
        // رفع الصورة إلى Storage
        const storageRef = storage.ref(`portfolio/images/${Date.now()}_${file.name}`);
        const uploadTask = storageRef.put(file);

        // متابعة حالة الرفع
        uploadTask.on('state_changed', 
            (snapshot) => {
                // تقدم الرفع
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                photoStatus.textContent = `جاري الرفع: ${Math.round(progress)}%`;
            },
            (error) => {
                // خطأ في الرفع
                console.error('خطأ في رفع الصورة:', error);
                photoStatus.textContent = 'حدث خطأ أثناء الرفع. يرجى المحاولة مرة أخرى.';
            },
            async () => {
                // اكتمال الرفع
                const url = await uploadTask.snapshot.ref.getDownloadURL();

                // حفظ البيانات في Realtime Database
                const newPhotoRef = db.ref('portfolio/photos').push();
                await newPhotoRef.set({
                    url: url,
                    projectId: Number(projectId),
                    description: description,
                    timestamp: Date.now()
                });

                photoStatus.textContent = 'تم رفع الصورة بنجاح!';
                photoForm.reset();

                // إعادة تحميل الصور بعد 1.5 ثانية
                setTimeout(() => {
                    photoModal.style.display = 'none';
                    loadPhotos();
                }, 1500);
            }
        );
    } catch (error) {
        console.error('خطأ في رفع الصورة:', error);
        photoStatus.textContent = 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.';
    }
});

// رفع فيديو جديد
videoForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    videoStatus.textContent = 'جاري رفع الفيديو...';

    const file = document.getElementById('videoFile').files[0];
    const projectId = document.getElementById('videoProjectId').value;
    const description = document.getElementById('videoDescription').value;

    if (!file || !projectId || !description) {
        videoStatus.textContent = 'الرجاء ملء جميع الحقول';
        return;
    }

    try {
        // رفع الفيديو إلى Storage
        const storageRef = storage.ref(`portfolio/videos/${Date.now()}_${file.name}`);
        const uploadTask = storageRef.put(file);

        // متابعة حالة الرفع
        uploadTask.on('state_changed', 
            (snapshot) => {
                // تقدم الرفع
                const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                videoStatus.textContent = `جاري الرفع: ${Math.round(progress)}%`;
            },
            (error) => {
                // خطأ في الرفع
                console.error('خطأ في رفع الفيديو:', error);
                videoStatus.textContent = 'حدث خطأ أثناء الرفع. يرجى المحاولة مرة أخرى.';
            },
            async () => {
                // اكتمال الرفع
                const url = await uploadTask.snapshot.ref.getDownloadURL();

                // حفظ البيانات في Realtime Database
                const newVideoRef = db.ref('portfolio/videos').push();
                await newVideoRef.set({
                    url: url,
                    projectId: Number(projectId),
                    description: description,
                    timestamp: Date.now()
                });

                videoStatus.textContent = 'تم رفع الفيديو بنجاح!';
                videoForm.reset();

                // إعادة تحميل الفيديوهات بعد 1.5 ثانية
                setTimeout(() => {
                    videoModal.style.display = 'none';
                    loadVideos();
                }, 1500);
            }
        );
    } catch (error) {
        console.error('خطأ في رفع الفيديو:', error);
        videoStatus.textContent = 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.';
    }
});

// رفع وسائط جديدة
mediaForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    mediaStatus.textContent = 'جاري حفظ الوسائط...';

    const projectId = document.getElementById('mediaProjectId').value;
    const description = document.getElementById('mediaDescription').value;

    if (!projectId || !description) {
        mediaStatus.textContent = 'الرجاء ملء جميع الحقول';
        return;
    }

    try {
        let url = '';

        if (selectedMediaType === 'link' || selectedMediaType === 'youtube') {
            url = mediaLink.value;
            if (!url) {
                mediaStatus.textContent = 'الرجاء إدخال رابط صحيح';
                return;
            }
        } else if (selectedMediaType === 'pdf') {
            const file = mediaFile.files[0];
            if (!file) {
                mediaStatus.textContent = 'الرجاء اختيار ملف PDF';
                return;
            }

            // رفع الملف إلى Storage
            const storageRef = storage.ref(`portfolio/media/${Date.now()}_${file.name}`);
            const uploadTask = storageRef.put(file);

            // متابعة حالة الرفع
            uploadTask.on('state_changed', 
                (snapshot) => {
                    // تقدم الرفع
                    const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 100;
                    mediaStatus.textContent = `جاري الرفع: ${Math.round(progress)}%`;
                },
                (error) => {
                    // خطأ في الرفع
                    console.error('خطأ في رفع الملف:', error);
                    mediaStatus.textContent = 'حدث خطأ أثناء الرفع. يرجى المحاولة مرة أخرى.';
                },
                async () => {
                    // اكتمال الرفع
                    url = await uploadTask.snapshot.ref.getDownloadURL();
                    saveMediaToDatabase(url, projectId, description);
                }
            );

            return;
        }

        saveMediaToDatabase(url, projectId, description);

    } catch (error) {
        console.error('خطأ في رفع الوسائط:', error);
        mediaStatus.textContent = 'حدث خطأ غير متوقع. يرجى المحاولة مرة أخرى.';
    }
});

// حفظ الوسائط في قاعدة البيانات
async function saveMediaToDatabase(url, projectId, description) {
    try {
        // حفظ البيانات في Realtime Database
        const newMediaRef = db.ref('portfolio/otherMedia').push();
        await newMediaRef.set({
            url: url,
            type: selectedMediaType,
            projectId: Number(projectId),
            description: description,
            timestamp: Date.now()
        });

        mediaStatus.textContent = 'تم حفظ الوسائط بنجاح!';
        mediaForm.reset();

        // إعادة تحميل الوسائط بعد 1.5 ثانية
        setTimeout(() => {
            mediaModal.style.display = 'none';
            loadOtherMedia();
        }, 1500);
    } catch (error) {
        console.error('خطأ في حفظ الوسائط:', error);
        mediaStatus.textContent = 'حدث خطأ أثناء حفظ الوسائط. يرجى المحاولة مرة أخرى.';
    }
}

// التحكم بالموسيقى
function setupMusicControl() {
    // محاولة تشغيل الموسيقى تلقائياً عند التحميل
    function tryAutoPlay() {
        backgroundMusic.play().then(() => {
            musicControl.innerHTML = '<i class="fas fa-pause"></i>';
            isMusicPlaying = true;
            console.log('الموسيقى تعمل تلقائياً');
        }).catch(error => {
            console.log("التشغيل التلقائي محظور، يتطلب تفاعل المستخدم");
            musicControl.innerHTML = '<i class="fas fa-play"></i>';
            isMusicPlaying = false;
        });
    }

    // محاولة التشغيل التلقائي
    tryAutoPlay();

    // تشغيل الموسيقى عند أول تفاعل للمستخدم
    function enableAutoPlay() {
        if (!isMusicPlaying) {
            tryAutoPlay();
        }
        // إزالة المستمعين بعد أول تفاعل
        document.removeEventListener('click', enableAutoPlay);
        document.removeEventListener('keydown', enableAutoPlay);
        document.removeEventListener('scroll', enableAutoPlay);
    }

    // إضافة مستمعين لأول تفاعل
    document.addEventListener('click', enableAutoPlay, { once: true });
    document.addEventListener('keydown', enableAutoPlay, { once: true });
    document.addEventListener('scroll', enableAutoPlay, { once: true });

    // التحكم اليدوي بالموسيقى
    musicControl.addEventListener('click', function(e) {
        e.stopPropagation();
        if (isMusicPlaying) {
            backgroundMusic.pause();
            musicControl.innerHTML = '<i class="fas fa-play"></i>';
            isMusicPlaying = false;
        } else {
            backgroundMusic.play().then(() => {
                musicControl.innerHTML = '<i class="fas fa-pause"></i>';
                isMusicPlaying = true;
            }).catch(e => {
                console.log('خطأ في تشغيل الموسيقى:', e);
            });
        }
    });
}

// إعداد اختيار نوع الوسائط
function setupMediaTypeSelector() {
    mediaTypes.forEach(type => {
        type.addEventListener('click', function() {
            mediaTypes.forEach(t => t.classList.remove('active'));
            this.classList.add('active');
            selectedMediaType = this.dataset.type;

            // إظهار/إخفاء حقول الإدخال المناسبة
            if (selectedMediaType === 'link' || selectedMediaType === 'youtube') {
                linkInput.style.display = 'block';
                fileUpload.style.display = 'none';
            } else if (selectedMediaType === 'pdf') {
                linkInput.style.display = 'none';
                fileUpload.style.display = 'block';
            }
        });
    });
}

// الدفاع عن يوسف حاتم باستخدام OpenAI API
async function setupDefenseChat() {
    // جلب برومبت الدفاع
    const promptRef = db.ref('portfolio/projectsPrompts/defender');
    const promptSnapshot = await promptRef.once('value');
    const defensePrompt = promptSnapshot.val() || "أنت مساعد ذكي يساعد في الدفاع عن طلب يوسف حاتم للقبول في MIT أمام لجنة القبول.";

    // جلب شرح الدفاع
    const explainRef = db.ref('portfolio/explain/defender');
    const explainSnapshot = await explainRef.once('value');
    const explainMessage = explainSnapshot.val() || "مرحباً! أنا تجسيد رقمي لعقل يوسف حاتم للدفاع عن طلبه للقبول في MIT.";

    // جلب مفتاح API
    const apiKeyRef = db.ref('portfolio/api/apiKey');
    const apiKeySnapshot = await apiKeyRef.once('value');
    openaiApiKey = apiKeySnapshot.val();

    // جلب ذاكرة المحادثة المحفوظة
    const memoryRef = db.ref('portfolio/memory/defender');
    const memorySnapshot = await memoryRef.once('value');
    const savedMemory = memorySnapshot.val() || [];

    // تحويل الذاكرة لمصفوفة إذا كانت كائن
    let conversationMemory = Array.isArray(savedMemory) ? savedMemory : Object.values(savedMemory || {});

    // التأكد من تحميل الأصوات قبل المتابعة
    await ensureVoicesLoaded();

    // إضافة أزرار التحكم فوق صندوق الشات
    const defenseSection = document.querySelector('#defense-section');
    if (defenseSection && !document.getElementById('autoReadToggle')) {
        const toggleContainer = document.createElement('div');
        toggleContainer.style.cssText = 'display: flex; align-items: center; justify-content: center; gap: 10px; margin-bottom: 15px;';

        const toggleBtn = document.createElement('button');
        toggleBtn.id = 'autoReadToggle';
        toggleBtn.className = 'auto-read-toggle';
        toggleBtn.innerHTML = `<i class="fas fa-volume-up"></i> القراءة التلقائية: مفعّلة`;
        toggleBtn.style.cssText = `
            padding: 10px 20px;
            border-radius: 25px;
            border: none;
            background: var(--gradient);
            color: white;
            cursor: pointer;
            transition: all 0.3s ease;
            font-weight: 600;
        `;

        toggleBtn.addEventListener('click', () => {
            autoReadEnabled = !autoReadEnabled;
            if (autoReadEnabled) {
                toggleBtn.innerHTML = `<i class="fas fa-volume-up"></i> القراءة التلقائية: مفعّلة`;
                toggleBtn.style.background = 'var(--gradient)';
                toggleBtn.style.color = 'white';
                toggleBtn.style.borderColor = 'transparent';
            } else {
                toggleBtn.innerHTML = `<i class="fas fa-volume-mute"></i> القراءة التلقائية: متوقفة`;
                toggleBtn.style.background = 'rgba(78, 205, 196, 0.1)';
                toggleBtn.style.color = 'var(--accent-color)';
                toggleBtn.style.borderColor = 'var(--accent-color)';
                // إيقاف أي قراءة جارية
                stopSpeech();
            }
        });

        const stopBtn = document.createElement('button');
        stopBtn.id = 'defenseStopSpeechBtn';
        stopBtn.className = 'stop-speech-btn';
        stopBtn.innerHTML = `<i class="fas fa-stop"></i> إيقاف الكلام`;
        stopBtn.disabled = true;
        stopBtn.style.cssText = `
            padding: 10px 20px;
            border-radius: 25px;
            border: 2px solid var(--secondary-color);
            background: rgba(255, 107, 107, 0.1);
            color: var(--secondary-color);
            cursor: pointer;
            transition: all 0.3s ease;
            font-weight: 600;
        `;

        stopBtn.addEventListener('click', () => {
            stopSpeech();
        });

        toggleContainer.appendChild(toggleBtn);
        toggleContainer.appendChild(stopBtn);

        const chatContainer = defenseSection.querySelector('.chat-container');
        const defenseChat = defenseSection.querySelector('.defense-chat');
        if (chatContainer && defenseChat) {
            defenseChat.insertBefore(toggleContainer, chatContainer);
        }
    }

    // عرض الرسائل المحفوظة أولاً
    let hasShownInitialMessage = conversationMemory.length > 0;
    if (hasShownInitialMessage) {
        for (const message of conversationMemory) {
            await addDefenseMessage(message.text, message.isUser, false, false); // false = لا تحفظ في قاعدة البيانات
        }
    }

    // إضافة رسالة للدردشة للشات الرئيسي
    async function addDefenseMessage(text, isUser, useTypewriter = false, saveToDatabase = true) {
        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${isUser ? 'user-message' : 'bot-message'}`;

        if (isUser) {
            messageDiv.innerHTML = `<p>${text}</p>`;
            chatContainer.appendChild(messageDiv);
            autoScrollIfAtBottom(chatContainer, true);
            // قراءة رسالة المستخدم تلقائياً بصوت أنثوي
            autoReadMessage(text, 'female');
        } else {
            const p = document.createElement('p');
            messageDiv.appendChild(p);
            chatContainer.appendChild(messageDiv);

            if (useTypewriter) {
                // القراءة الصوتية ستبدأ داخل typewriterEffectWithFormatting
                await typewriterEffectWithFormatting(p, text);
            } else {
                // الحفاظ على التنسيق عند عرض الرسائل المحفوظة
                p.innerHTML = text.replace(/\n/g, '<br>');
                autoScrollIfAtBottom(chatContainer, true);
            }
        }

        // حفظ الرسالة في الذاكرة المحلية فقط إذا لم تكن محفوظة مسبقاً
        if (saveToDatabase) {
            const messageData = {
                text: text,
                isUser: isUser,
                timestamp: Date.now()
            };

            conversationMemory.push(messageData);

            // حفظ في قاعدة البيانات
            try {
                const newMessageRef = db.ref('portfolio/memory/defender').push();
                await newMessageRef.set(messageData);
            } catch (error) {
                console.error('خطأ في حفظ الرسالة:', error);
            }
        }
    }

    // دالة محسنة لتأثير الكتابة مع الحفاظ على التنسيق
    async function typewriterEffectWithFormatting(element, text, speed = 30) {
        if (!element || !text) return;

        element.innerHTML = '';

        // إضافة مؤشر الكتابة
        const typingIndicator = document.createElement('span');
        typingIndicator.className = 'typing-indicator';
        typingIndicator.textContent = '...';
        element.appendChild(typingIndicator);

        // انتظار قصير قبل بدء الكتابة
        await new Promise(resolve => setTimeout(resolve, 300));

        // إزالة مؤشر الكتابة وبدء الكتابة الفعلية
        if (element.contains(typingIndicator)) {
            element.removeChild(typingIndicator);
        }

        // بدء القراءة الصوتية فوراً قبل بدء الكتابة
        autoReadMessage(text, 'male');

        // تحويل النص مع الحفاظ على فواصل الأسطر
        const formattedText = text.replace(/\n/g, '<br>');

        // كتابة النص حرفاً بحرف مع دعم HTML
        let currentHTML = '';
        for (let i = 0; i < formattedText.length; i++) {
            if (formattedText.substr(i, 4) === '<br>') {
                currentHTML += '<br>';
                i += 3; // تخطي باقي أحرف <br>
            } else {
                currentHTML += formattedText.charAt(i);
            }

            element.innerHTML = currentHTML;

            // سرعة متغيرة: أسرع للمسافات وأبطأ للأحرف
            const currentSpeed = formattedText.charAt(i) === ' ' ? speed * 0.3 : speed;
            await new Promise(resolve => setTimeout(resolve, currentSpeed));

            // التمرير التلقائي الذكي أثناء الكتابة
            autoScrollIfAtBottom(chatContainer, false);
        }
    }

    // الحصول على آخر 4 رسائل للسياق
    function getRecentContext() {
        const recentMessages = conversationMemory.slice(-8); // آخر 4 أسئلة + 4 ردود
        return recentMessages.map(msg => ({
            role: msg.isUser ? "user" : "assistant",
            content: msg.text
        }));
    }

    // الرد على سؤال اللجنة مع السياق
    async function respondToQuestion(question) {
        // إظهار مؤشر الكتابة
        const typingIndicator = showTypingIndicator(chatContainer);

        try {
            // بناء السياق مع آخر الرسائل
            const recentContext = getRecentContext();
            const messages = [
                { role: "system", content: defensePrompt },
                ...recentContext,
                { role: "user", content: question }
            ];

            // الحصول على الرد من OpenAI مع السياق
            const response = await getOpenAIResponseWithContext(messages);

            // إخفاء مؤشر الكتابة
            hideTypingIndicator();

            // إضافة الرد إلى الدردشة مع التأثير التدريجي
            await addDefenseMessage(response, false, true);
        } catch (error) {
            console.error('خطأ:', error);
            // إخفاء مؤشر الكتابة
            hideTypingIndicator();
            await addDefenseMessage('حدث خطأ أثناء التواصل مع الخادم. يرجى المحاولة لاحقاً.', false, true);
        }
    }

    // إرسال رسالة المستخدم
    async function sendMessage() {
        const question = userInput.value.trim();
        if (!question) return;

        // إضافة سؤال المستخدم
        await addDefenseMessage(question, true);

        // مسح حقل الإدخال
        userInput.value = '';

        // الرد على السؤال
        await respondToQuestion(question);
    }

    // عرض رسالة الشرح الأولية إذا لم تكن موجودة
    if (!hasShownInitialMessage) {
        await addDefenseMessage(explainMessage, false, true, true); // true = احفظ في قاعدة البيانات
    }


    // معالجة النقر على زر الإرسال
    sendButton.addEventListener('click', sendMessage);

    // معالجة الضغط على Enter في حقل الإدخال
    userInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            sendMessage();
        }
    });
}

// تهيئة الصفحة عند التحميل
window.addEventListener('DOMContentLoaded', function() {
    setupNavigation();
    setupMusicControl(); // هذا سيتعامل مع تشغيل الموسيقى تلقائياً
    setupDefenseChat();
    setupMediaTypeSelector();
    loadProjects();
    loadPhotos();
    loadVideos();
    loadOtherMedia();

    // تهيئة عناصر PDF
    pdfPreview = document.getElementById('pdfPreview');
    pdfView = document.getElementById('pdfView');
    pdfLoading = document.getElementById('pdfLoading');
    pdfError = document.getElementById('pdfError');
    pdfControls = document.getElementById('pdfControls');

    // تهيئة القراءة الصوتية
    const speechSupported = initSpeechSynthesis();
    if (speechSupported) {
        console.log('القراءة الصوتية مدعومة');
    } else {
        console.warn('القراءة الصوتية غير مدعومة في هذا المتصفح');
    }
});

// إعداد أزرار التبويبات
function setupMediaTabs() {
    // استخدام setTimeout لضمان تحميل العناصر بالكامل
    setTimeout(() => {
        document.querySelectorAll('.media-tab').forEach(tab => {
            // إزالة جميع معالجات الأحداث السابقة
            const newTab = tab.cloneNode(true);
            tab.parentNode.replaceChild(newTab, tab);

            // إضافة معالج حدث جديد مع أولوية عالية
            newTab.addEventListener('click', handleTabClick, { capture: true, passive: false });
        });
    }, 100);
}

// دالة منفصلة لمعالجة النقر على التبويبات
function handleTabClick(e) {
    e.preventDefault();
    e.stopImmediatePropagation();

    const tab = e.currentTarget;
    const tabId = tab.dataset.tab + 'Tab';
    const targetContent = document.getElementById(tabId);

    if (!targetContent) {
        console.error('Tab content not found:', tabId);
        return;
    }

    const currentProjectTabs = tab.closest('.project-media-section');
    if (!currentProjectTabs) return;

    const isCurrentlyActive = tab.classList.contains('active') && targetContent.classList.contains('active');

    // إزالة التنشيط من جميع التبويبات في هذا المشروع
    currentProjectTabs.querySelectorAll('.media-tab').forEach(t => {
        t.classList.remove('active');
    });
    currentProjectTabs.querySelectorAll('.media-tab-content').forEach(content => {
        content.classList.remove('active');
    });

    // إذا لم يكن التبويب مفعلاً من قبل، قم بتفعيله
    if (!isCurrentlyActive) {
        tab.classList.add('active');
        targetContent.classList.add('active');
    }
    // إذا كان مفعلاً، فسيبقى مغلقاً (تم إزالة التنشيط أعلاه)
}

// إعداد معالجات النقر للوسائط
function setupMediaClickHandlers() {
    setTimeout(() => {
        // إزالة المعالجات السابقة أولاً
        document.querySelectorAll('[data-click-handler="true"]').forEach(element => {
            element.removeAttribute('data-click-handler');
            // إنشاء عنصر جديد لإزالة جميع المعالجات السابقة
            const newElement = element.cloneNode(true);
            element.parentNode.replaceChild(newElement, element);
        });

        // إضافة معالجات جديدة للصور والفيديوهات
        document.querySelectorAll('.media-thumb, .media-item').forEach(element => {
            element.setAttribute('data-click-handler', 'true');
            element.addEventListener('click', handleMediaClick, { passive: false });
        });

        // إضافة معالجات خاصة للوسائط الأخرى (الأزرار) إذا لم تكن موجودة مسبقاً
        document.querySelectorAll('.media-button:not(.youtube-button):not(.pdf-button)').forEach(button => {
            if (!button.hasAttribute('data-click-setup')) {
                button.setAttribute('data-click-setup', 'true');
                button.style.cursor = 'pointer';

                const type = button.dataset.type;
                const url = button.dataset.url;
                const description = button.dataset.description;
                const mediaIndex = parseInt(button.dataset.mediaIndex) || 0;

                if (type && url && description) {
                    button.addEventListener('click', function(e) {
                        e.preventDefault();
                        e.stopPropagation();
                        console.log('Direct button click:', {type, url, description});
                        openMediaPreview(type, url, description, mediaIndex, 'other');
                    });
                }
            }
        });
    }, 250);
}

// دالة منفصلة لمعالجة النقر على الوسائط
function handleMediaClick(e) {
    // التأكد من أن الحدث ليس من تبويبة
    if (e.target.closest('.media-tab')) {
        return;
    }

    e.preventDefault();
    e.stopPropagation();

    // البحث عن العنصر المناسب بناءً على السياق
    let mediaElement = e.target;
    let type, url, description, mediaIndex = 0, tabType = '';

    // إذا كان العنصر المنقور عليه صورة مصغرة (صور أو فيديوهات)
    if (mediaElement.classList.contains('media-thumb')) {
        type = mediaElement.dataset.type;
        url = mediaElement.dataset.url;
        description = mediaElement.dataset.description;

        // الحصول على معلومات التنقل
        const mediaItem = mediaElement.closest('.media-item');
        if (mediaItem) {
            mediaIndex = parseInt(mediaItem.dataset.mediaIndex) || 0;
            tabType = mediaItem.dataset.mediaType || '';

            // إذا لم يكن هناك وصف في dataset، ابحث عنه في العنصر
            if (!description) {
                const descElement = mediaItem.querySelector('.media-description');
                description = descElement ? descElement.textContent.trim() : 'وسائط بدون وصف';
            }
        }
    }
    // إذا كان العنصر المنقور عليه زر وسائط (للروابط واليوتيوب والـPDF)
    else if (mediaElement.closest('.media-button')) {
        const button = mediaElement.closest('.media-button');

        // الحصول على البيانات من dataset
        type = button.dataset.type;
        url = button.dataset.url;
        description = button.dataset.description;
        mediaIndex = parseInt(button.dataset.mediaIndex) || 0;
        tabType = button.dataset.mediaType || 'other';

        // إذا لم تكن البيانات متوفرة في dataset، استخدم الطريقة المحسنة
        if (!type || !url) {
            // تحديد النوع بناءً على الأيقونة
            if (button.querySelector('.fab.fa-youtube')) {
                type = 'youtube';
                tabType = 'other';
            } else if (button.querySelector('.fas.fa-file-pdf')) {
                type = 'pdf';
                tabType = 'other';
            } else if (button.querySelector('.fas.fa-external-link-alt') || button.querySelector('.fas.fa-link')) {
                type = 'link';
                tabType = 'other';
                // للروابط الخارجية، افتح في نافذة جديدة بدلاً من المعاينة
                if (button.href) {
                    window.open(button.href, '_blank');
                    return;
                }
            }

            // الحصول على الوصف من النص
            const labelElement = button.querySelector('.media-label');
            description = labelElement ? labelElement.textContent.trim() : 'وسائط بدون وصف';

            // البحث عن URL في مصفوفة الوسائط الأخرى بناءً على الوصف والنوع
            if (projectMediaData.otherMedia) {
                const mediaItem = projectMediaData.otherMedia.find(item => 
                    item.description === description && item.type === type
                );
                if (mediaItem) {
                    url = mediaItem.url;
                    mediaIndex = projectMediaData.otherMedia.indexOf(mediaItem);
                } else {
                    // البحث بناءً على النوع فقط إذا لم نجد تطابق مع الوصف
                    const typeMatches = projectMediaData.otherMedia.filter(item => item.type === type);
                    if (typeMatches.length > 0) {
                        const foundItem = typeMatches[0];
                        url = foundItem.url;
                        description = foundItem.description;
                        mediaIndex = projectMediaData.otherMedia.indexOf(foundItem);
                    }
                }
            }
        }
    }
    // إذا كان داخل عنصر وسائط
    else {
        const mediaItem = mediaElement.closest('.media-item');
        if (mediaItem) {
            mediaIndex = parseInt(mediaItem.dataset.mediaIndex) || 0;
            tabType = mediaItem.dataset.mediaType || '';

            const thumbElement = mediaItem.querySelector('.media-thumb');
            if (thumbElement) {
                type = thumbElement.dataset.type;
                url = thumbElement.dataset.url;
                description = thumbElement.dataset.description;

                // إذا لم يكن هناك وصف، ابحث في العنصر
                if (!description) {
                    const descElement = mediaItem.querySelector('.media-description');
                    description = descElement ? descElement.textContent.trim() : 'وسائط بدون وصف';
                }
            }
        }
    }

    // إذا تم العثور على البيانات المطلوبة، افتح المعاينة
    if (type && url && description) {
        console.log('Media click detected:', {type, url, description, mediaIndex, tabType});
        openMediaPreview(type, url, description, mediaIndex, tabType);
    } else {
        console.log('No media data found for click event', {type, url, description, mediaElement, button: mediaElement.closest('.media-button')});
    }

}
