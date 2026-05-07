// ===== Firebase Init =====
(function () {
    firebase.initializeApp({
        apiKey: "AIzaSyDhdID2wAdkpl-Hc-8mWvMz83PNfAgRto8",
        authDomain: "kid-id.firebaseapp.com",
        databaseURL: "https://kid-id-default-rtdb.firebaseio.com",
        projectId: "kid-id",
        storageBucket: "kid-id.appspot.com",
        messagingSenderId: "103513152686",
        appId: "1:103513152686:web:0b7c7f3c7b9c9b3c1a3e0a"
    });
})();

const db      = firebase.database();
const storage = firebase.storage();
const DB      = 'dental_lab/portfolio';
const ST      = 'dental_lab';

// ===== State =====
let currentProjectId   = null;
let currentProjectData = {};   // { photoURL, name }
let selectedProjMediaType = 'youtube';
let isMusicPlaying = false;

// viewer state
let viewerImages = [];   // [{url, desc}] — only images
let viewerIndex  = 0;
let viewerZoom   = 1;
let viewerDragging = false;
let viewerDragStart = { x: 0, y: 0 };
let viewerOffset = { x: 0, y: 0 };

// ===== DOM refs =====
const projectsContainer      = document.getElementById('projectsContainer');
const projectModal           = document.getElementById('projectModal');
const projectModalBody       = document.getElementById('projectModalBody');
const projectModalTitle      = document.getElementById('projectModalTitle');
const createProjectModal     = document.getElementById('createProjectModal');
const addProjectPhotoModal   = document.getElementById('addProjectPhotoModal');
const addProjectVideoModal   = document.getElementById('addProjectVideoModal');
const addProjectMediaModal   = document.getElementById('addProjectMediaModal');
const confirmDeleteModal     = document.getElementById('confirmDeleteModal');
const musicControl           = document.getElementById('musicControl');
const backgroundMusic        = document.getElementById('backgroundMusic');

// ===== Helpers =====
function showOverlay(el)  { el.style.display = 'flex'; }
function hideOverlay(el)  { el.style.display = 'none';  }
function showStatus(el, msg, isError = false) {
    el.textContent = msg;
    el.style.color = isError ? '#ef5350' : '#4fc3f7';
}

// ===== Confirm Delete dialog =====
function confirmDelete(title, msg) {
    return new Promise(resolve => {
        document.getElementById('confirmDeleteTitle').textContent = title;
        document.getElementById('confirmDeleteMsg').textContent   = msg;
        showOverlay(confirmDeleteModal);
        const yes = document.getElementById('confirmDeleteYes');
        const no  = document.getElementById('confirmDeleteNo');
        function cleanup(val) {
            hideOverlay(confirmDeleteModal);
            yes.removeEventListener('click', onYes);
            no.removeEventListener('click',  onNo);
            resolve(val);
        }
        function onYes() { cleanup(true);  }
        function onNo()  { cleanup(false); }
        yes.addEventListener('click', onYes);
        no.addEventListener('click',  onNo);
    });
}

// ===== Music =====
function setupMusic() {
    function tryPlay() {
        backgroundMusic.play().then(() => {
            isMusicPlaying = true;
            musicControl.innerHTML = '<i class="fas fa-pause"></i>';
        }).catch(() => {
            isMusicPlaying = false;
            musicControl.innerHTML = '<i class="fas fa-music"></i>';
        });
    }
    tryPlay();
    document.addEventListener('click', () => { if (!isMusicPlaying) tryPlay(); }, { once: true });
    musicControl.addEventListener('click', e => {
        e.stopPropagation();
        if (isMusicPlaying) { backgroundMusic.pause(); isMusicPlaying = false; musicControl.innerHTML = '<i class="fas fa-music"></i>'; }
        else                { backgroundMusic.play().then(() => { isMusicPlaying = true; musicControl.innerHTML = '<i class="fas fa-pause"></i>'; }).catch(() => {}); }
    });
}

// ===== Load & render products grid =====
async function loadProjects() {
    projectsContainer.innerHTML = '<div class="loading-state"><div class="spinner"></div></div>';
    const snap = await db.ref(`${DB}/projectsPhotos`).once('value');
    const data = snap.val() || {};
    projectsContainer.innerHTML = '';

    const items = Object.entries(data)
        .map(([id, v]) => ({
            id:       Number(id),
            photoURL: typeof v === 'string' ? v : (v?.photoURL || ''),
            name:     typeof v === 'object' && v?.name ? v.name : `منتج ${id}`
        }))
        .sort((a, b) => a.id - b.id);

    if (!items.length) {
        projectsContainer.innerHTML = '<div class="empty-hint"><i class="fas fa-box-open"></i><p>لا توجد منتجات حتى الآن</p></div>';
        return;
    }

    items.forEach(p => {
        const card = document.createElement('div');
        card.className = 'product-card';
        card.innerHTML = `
            <div class="card-img-wrap">
                <img src="${p.photoURL}" alt="${p.name}" onerror="this.src='data:image/svg+xml,<svg xmlns=%22http://www.w3.org/2000/svg%22 width=%22300%22 height=%22200%22><rect fill=%22%230d1f3c%22 width=%22300%22 height=%22200%22/><text fill=%22%2342a5f5%22 x=%22150%22 y=%22105%22 text-anchor=%22middle%22 font-size=%2224%22>🦷</text></svg>'">
            </div>
            <div class="card-body">
                <span class="card-name">${p.name}</span>
                <button class="card-delete-btn" data-id="${p.id}" title="حذف المنتج"><i class="fas fa-trash"></i></button>
            </div>`;
        card.querySelector('.card-img-wrap').addEventListener('click', () => openProject(p.id, p.photoURL, p.name));
        card.querySelector('.card-name').addEventListener('click',     () => openProject(p.id, p.photoURL, p.name));
        card.querySelector('.card-delete-btn').addEventListener('click', async e => {
            e.stopPropagation();
            const ok = await confirmDelete(`حذف "${p.name}"`, 'سيتم حذف المنتج وجميع محتوياته نهائياً');
            if (!ok) return;
            await deleteProject(p.id);
        });
        projectsContainer.appendChild(card);
    });
}

async function deleteProject(pid) {
    // حذف الإدخال الرئيسي
    await db.ref(`${DB}/projectsPhotos/${pid}`).remove();
    // حذف الوسائط المرتبطة
    for (const coll of ['photos', 'videos', 'otherMedia']) {
        const snap = await db.ref(`${DB}/${coll}`).orderByChild('projectId').equalTo(pid).once('value');
        const val  = snap.val() || {};
        for (const key of Object.keys(val)) await db.ref(`${DB}/${coll}/${key}`).remove();
    }
    await loadProjects();
}

// ===== Create project =====
function setupCreateProject() {
    const btn      = document.getElementById('createProjectBtn');
    const closeBtn = document.getElementById('closeCreateProjectModal');
    const dropZone = document.getElementById('coverDropZone');
    const fileIn   = document.getElementById('projectCoverFile');
    const preview  = document.getElementById('coverPreview');
    const prevImg  = document.getElementById('coverPreviewImg');
    const removeBtn= document.getElementById('removeCoverBtn');
    const form     = document.getElementById('createProjectForm');
    const status   = document.getElementById('createProjectStatus');
    const submitBtn= document.getElementById('createProjectSubmit');

    btn.addEventListener('click',      () => showOverlay(createProjectModal));
    closeBtn.addEventListener('click', () => { hideOverlay(createProjectModal); resetCreateForm(); });
    document.getElementById('createProjectModal').addEventListener('click', e => {
        if (e.target === createProjectModal) { hideOverlay(createProjectModal); resetCreateForm(); }
    });

    dropZone.addEventListener('click', () => fileIn.click());
    dropZone.addEventListener('dragover', e => { e.preventDefault(); dropZone.classList.add('drag-over'); });
    dropZone.addEventListener('dragleave', () => dropZone.classList.remove('drag-over'));
    dropZone.addEventListener('drop', e => {
        e.preventDefault(); dropZone.classList.remove('drag-over');
        const f = e.dataTransfer.files[0];
        if (f?.type.startsWith('image/')) { showPreview(f); const dt = new DataTransfer(); dt.items.add(f); fileIn.files = dt.files; }
    });
    fileIn.addEventListener('change', e => { if (e.target.files[0]) showPreview(e.target.files[0]); });
    removeBtn.addEventListener('click', () => { preview.style.display = 'none'; dropZone.style.display = 'flex'; fileIn.value = ''; prevImg.src = ''; });

    function showPreview(f) {
        const r = new FileReader();
        r.onload = ev => { prevImg.src = ev.target.result; preview.style.display = 'block'; dropZone.style.display = 'none'; };
        r.readAsDataURL(f);
    }

    form.addEventListener('submit', async e => {
        e.preventDefault();
        const file = fileIn.files[0];
        if (!file) { showStatus(status, 'اختر صورة الغلاف', true); return; }
        submitBtn.disabled = true;
        showStatus(status, 'جاري الإنشاء...');

        const snap   = await db.ref(`${DB}/projectsPhotos`).once('value');
        const ids    = Object.keys(snap.val() || {}).map(Number);
        const newId  = ids.length ? Math.max(...ids) + 1 : 1;
        const name   = document.getElementById('projectName').value.trim() || `منتج ${newId}`;
        const ref    = storage.ref(`${ST}/projects/${newId}/cover/${Date.now()}_${file.name}`);
        const task   = ref.put(file);

        task.on('state_changed',
            s => showStatus(status, `${Math.round(s.bytesTransferred / s.totalBytes * 100)}%`),
            () => { showStatus(status, 'خطأ في الرفع', true); submitBtn.disabled = false; },
            async () => {
                const url = await task.snapshot.ref.getDownloadURL();
                await db.ref(`${DB}/projectsPhotos/${newId}`).set({ photoURL: url, name, createdAt: Date.now() });
                showStatus(status, 'تم الإنشاء بنجاح ✓');
                setTimeout(() => { hideOverlay(createProjectModal); resetCreateForm(); loadProjects(); }, 1200);
            }
        );
    });

    function resetCreateForm() {
        form.reset(); prevImg.src = '';
        preview.style.display = 'none'; dropZone.style.display = 'flex';
        status.textContent = ''; submitBtn.disabled = false;
    }
}

// ===== Open project modal =====
async function openProject(pid, photoURL, name) {
    currentProjectId   = pid;
    currentProjectData = { photoURL, name };
    projectModalTitle.textContent = name;
    projectModalBody.innerHTML    = '<div class="loading-state"><div class="spinner"></div></div>';
    showOverlay(projectModal);
    await refreshProjectBody();
}

async function refreshProjectBody() {
    const pid = currentProjectId;

    const [photoSnap, videoSnap, mediaSnap] = await Promise.all([
        db.ref(`${DB}/photos`).orderByChild('projectId').equalTo(pid).once('value'),
        db.ref(`${DB}/videos`).orderByChild('projectId').equalTo(pid).once('value'),
        db.ref(`${DB}/otherMedia`).orderByChild('projectId').equalTo(pid).once('value'),
    ]);

    const photos = toArray(photoSnap.val(), 'image');
    const videos = toArray(videoSnap.val(), 'video');
    const others = toArray(mediaSnap.val(), null);
    const all    = [...photos, ...videos, ...others].sort((a, b) => (b.timestamp || 0) - (a.timestamp || 0));

    // بناء الواجهة
    const body = document.createElement('div');
    body.className = 'proj-body-inner';

    // صورة الغلاف
    const cover = document.createElement('div');
    cover.className = 'proj-cover';
    cover.innerHTML = `<img src="${currentProjectData.photoURL}" alt="غلاف" onerror="this.parentElement.style.display='none'">`;
    body.appendChild(cover);

    // بناء قائمة الصور للـ viewer
    viewerImages = all
        .filter(i => i.type === 'image')
        .map(i => ({ url: i.url, desc: i.description || '' }));

    if (!all.length) {
        const emp = document.createElement('div');
        emp.className = 'empty-hint';
        emp.innerHTML = '<i class="fas fa-photo-video"></i><p>لا توجد وسائط — استخدم أزرار الإضافة في الأعلى</p>';
        body.appendChild(emp);
    } else {
        const grid = document.createElement('div');
        grid.className = 'media-grid';
        let imgIdx = 0;
        all.forEach(item => grid.appendChild(buildMediaCard(item, item.type === 'image' ? imgIdx++ : -1)));
        body.appendChild(grid);
    }

    projectModalBody.innerHTML = '';
    projectModalBody.appendChild(body);
}

function toArray(val, forcedType) {
    if (!val) return [];
    return Object.entries(val).map(([key, v]) => ({ ...v, _key: key, type: forcedType || v.type }));
}

function buildMediaCard(item, imgIdx) {
    const card = document.createElement('div');
    card.className = 'media-card';

    let preview = '';
    if (item.type === 'image') {
        preview = `<img src="${item.url}" alt="${item.description || ''}" class="mc-img" onclick="openViewer('image',${imgIdx},'${esc(item.description)}')">`;
    } else if (item.type === 'video') {
        preview = `<video src="${item.url}" class="mc-video" controls></video>`;
    } else if (item.type === 'youtube') {
        const vid = getYTId(item.url);
        preview = vid
            ? `<div class="mc-yt" onclick="openViewer('youtube','${item.url}','${esc(item.description)}')"><img src="https://img.youtube.com/vi/${vid}/mqdefault.jpg" class="mc-img"><div class="yt-play"><i class="fab fa-youtube"></i></div></div>`
            : `<div class="mc-icon"><i class="fab fa-youtube" style="color:#f00"></i></div>`;
    } else if (item.type === 'pdf') {
        preview = `<div class="mc-icon" onclick="openViewer('pdf','${item.url}','${esc(item.description)}')"><i class="fas fa-file-pdf" style="color:#ef5350"></i></div>`;
    } else {
        preview = `<div class="mc-icon"><a href="${item.url}" target="_blank"><i class="fas fa-external-link-alt"></i></a></div>`;
    }

    card.innerHTML = `
        ${preview}
        <div class="mc-info">
            <span class="mc-desc">${item.description || ''}</span>
            <button class="mc-delete" title="حذف"><i class="fas fa-trash"></i></button>
        </div>`;

    card.querySelector('.mc-delete').addEventListener('click', async () => {
        const ok = await confirmDelete('حذف العنصر', 'سيتم حذف هذا العنصر نهائياً');
        if (!ok) return;
        const coll = item.type === 'image' ? 'photos' : item.type === 'video' ? 'videos' : 'otherMedia';
        await db.ref(`${DB}/${coll}/${item._key}`).remove();
        await refreshProjectBody();
    });

    return card;
}

function esc(s) { return (s || '').replace(/'/g, "\\'"); }

// ===== Viewer modal =====
// For images: urlOrIndex = numeric index into viewerImages[]
// For others: urlOrIndex = URL string
window.openViewer = function(type, urlOrIndex, desc) {
    const existing = document.getElementById('viewerOverlay');
    if (existing) existing.remove();

    if (type === 'image') {
        viewerIndex = Number(urlOrIndex);
        viewerZoom  = 1;
        viewerOffset = { x: 0, y: 0 };
        _buildImageViewer();
    } else {
        _buildSimpleViewer(type, urlOrIndex, desc);
    }
};

function _buildImageViewer() {
    const existing = document.getElementById('viewerOverlay');
    if (existing) existing.remove();

    const item  = viewerImages[viewerIndex];
    if (!item) return;
    const total = viewerImages.length;

    const ov = document.createElement('div');
    ov.id = 'viewerOverlay';
    ov.className = 'viewer-overlay';
    ov.innerHTML = `
        <div class="viewer-box viewer-box--img">
            <button class="viewer-close" id="viewerClose"><i class="fas fa-times"></i></button>

            <!-- شريط علوي -->
            <div class="viewer-top-bar">
                <span class="viewer-counter">${viewerIndex + 1} / ${total}</span>
                <div class="viewer-zoom-btns">
                    <button class="vzoom-btn" id="vzoomIn"  title="تكبير"><i class="fas fa-search-plus"></i></button>
                    <button class="vzoom-btn" id="vzoomOut" title="تصغير"><i class="fas fa-search-minus"></i></button>
                    <button class="vzoom-btn" id="vzoomReset" title="إعادة ضبط"><i class="fas fa-compress"></i></button>
                </div>
                <a href="${item.url}" target="_blank" class="viewer-open-btn" title="فتح في نافذة جديدة">
                    <i class="fas fa-external-link-alt"></i>
                </a>
            </div>

            <!-- منطقة الصورة -->
            <div class="viewer-img-area" id="viewerImgArea">
                <img src="${item.url}" class="viewer-img" id="viewerImg" draggable="false">
            </div>

            <!-- وصف -->
            ${item.desc ? `<p class="viewer-desc">${item.desc}</p>` : ''}

            <!-- أزرار التنقل -->
            ${total > 1 ? `
            <button class="viewer-nav viewer-prev" id="viewerPrev"><i class="fas fa-chevron-right"></i></button>
            <button class="viewer-nav viewer-next" id="viewerNext"><i class="fas fa-chevron-left"></i></button>
            ` : ''}
        </div>`;

    document.body.appendChild(ov);
    _applyZoom();

    // إغلاق
    document.getElementById('viewerClose').addEventListener('click', () => ov.remove());
    ov.addEventListener('click', e => { if (e.target === ov || e.target.classList.contains('viewer-img-area')) _resetAndClose(ov); });

    // التنقل بالأزرار
    const prevBtn = document.getElementById('viewerPrev');
    const nextBtn = document.getElementById('viewerNext');
    if (prevBtn) prevBtn.addEventListener('click', () => _navigateViewer(-1));
    if (nextBtn) nextBtn.addEventListener('click', () => _navigateViewer(+1));

    // زوم
    document.getElementById('vzoomIn').addEventListener('click',    () => _changeZoom(0.2));
    document.getElementById('vzoomOut').addEventListener('click',   () => _changeZoom(-0.2));
    document.getElementById('vzoomReset').addEventListener('click', () => { viewerZoom = 1; viewerOffset = { x:0, y:0 }; _applyZoom(); });

    // عجلة الماوس
    const imgArea = document.getElementById('viewerImgArea');
    imgArea.addEventListener('wheel', e => {
        e.preventDefault();
        _changeZoom(e.deltaY < 0 ? 0.15 : -0.15);
    }, { passive: false });

    // سحب الصورة عند التكبير
    const img = document.getElementById('viewerImg');
    img.addEventListener('mousedown', e => {
        if (viewerZoom <= 1) return;
        viewerDragging = true;
        viewerDragStart = { x: e.clientX - viewerOffset.x, y: e.clientY - viewerOffset.y };
        img.style.cursor = 'grabbing';
        e.preventDefault();
    });
    window.addEventListener('mousemove', _onDragMove);
    window.addEventListener('mouseup',   _onDragEnd);

    // لمس (موبايل)
    let lastPinchDist = null;
    imgArea.addEventListener('touchstart', e => {
        if (e.touches.length === 2) {
            lastPinchDist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY);
        } else if (e.touches.length === 1 && viewerZoom > 1) {
            viewerDragging = true;
            viewerDragStart = { x: e.touches[0].clientX - viewerOffset.x, y: e.touches[0].clientY - viewerOffset.y };
        }
    }, { passive: true });
    imgArea.addEventListener('touchmove', e => {
        if (e.touches.length === 2 && lastPinchDist !== null) {
            e.preventDefault();
            const dist = Math.hypot(
                e.touches[0].clientX - e.touches[1].clientX,
                e.touches[0].clientY - e.touches[1].clientY);
            _changeZoom((dist - lastPinchDist) * 0.005);
            lastPinchDist = dist;
        } else if (e.touches.length === 1 && viewerDragging) {
            viewerOffset.x = e.touches[0].clientX - viewerDragStart.x;
            viewerOffset.y = e.touches[0].clientY - viewerDragStart.y;
            _applyZoom();
        }
    }, { passive: false });
    imgArea.addEventListener('touchend', () => { viewerDragging = false; lastPinchDist = null; });

    // لوحة المفاتيح
    ov._keyHandler = e => {
        if (e.key === 'ArrowRight')  _navigateViewer(-1);
        if (e.key === 'ArrowLeft')   _navigateViewer(+1);
        if (e.key === 'Escape')      { _cleanupViewer(); ov.remove(); }
        if (e.key === '+')           _changeZoom(0.2);
        if (e.key === '-')           _changeZoom(-0.2);
    };
    document.addEventListener('keydown', ov._keyHandler);
}

function _onDragMove(e) {
    if (!viewerDragging) return;
    viewerOffset.x = e.clientX - viewerDragStart.x;
    viewerOffset.y = e.clientY - viewerDragStart.y;
    _applyZoom();
}
function _onDragEnd() {
    viewerDragging = false;
    const img = document.getElementById('viewerImg');
    if (img) img.style.cursor = viewerZoom > 1 ? 'grab' : 'default';
}

function _applyZoom() {
    const img = document.getElementById('viewerImg');
    if (!img) return;
    if (viewerZoom <= 1) { viewerOffset = { x:0, y:0 }; }
    img.style.transform = `translate(${viewerOffset.x}px, ${viewerOffset.y}px) scale(${viewerZoom})`;
    img.style.cursor = viewerZoom > 1 ? 'grab' : 'default';
}

function _changeZoom(delta) {
    viewerZoom = Math.min(5, Math.max(0.5, viewerZoom + delta));
    _applyZoom();
}

function _navigateViewer(dir) {
    const total = viewerImages.length;
    viewerIndex = (viewerIndex + dir + total) % total;
    viewerZoom  = 1;
    viewerOffset = { x:0, y:0 };
    _cleanupViewer();
    _buildImageViewer();
}

function _resetAndClose(ov) {
    _cleanupViewer();
    ov.remove();
}

function _cleanupViewer() {
    window.removeEventListener('mousemove', _onDragMove);
    window.removeEventListener('mouseup',   _onDragEnd);
    const ov = document.getElementById('viewerOverlay');
    if (ov?._keyHandler) document.removeEventListener('keydown', ov._keyHandler);
}

function _buildSimpleViewer(type, url, desc) {
    let content = '';
    if (type === 'youtube') { const v = getYTId(url); content = v ? `<iframe src="https://www.youtube.com/embed/${v}" frameborder="0" allowfullscreen class="viewer-iframe"></iframe>` : ''; }
    if (type === 'pdf')     content = `<iframe src="https://docs.google.com/gview?url=${encodeURIComponent(url)}&embedded=true" frameborder="0" class="viewer-iframe"></iframe>`;

    const ov = document.createElement('div');
    ov.id = 'viewerOverlay';
    ov.className = 'viewer-overlay';
    ov.innerHTML = `
        <div class="viewer-box">
            <button class="viewer-close" id="viewerClose"><i class="fas fa-times"></i></button>
            <div class="viewer-content">${content}</div>
            ${desc ? `<p class="viewer-desc">${desc}</p>` : ''}
            <a href="${url}" target="_blank" class="viewer-open-btn"><i class="fas fa-external-link-alt"></i> فتح في نافذة جديدة</a>
        </div>`;
    document.body.appendChild(ov);
    document.getElementById('viewerClose').addEventListener('click', () => ov.remove());
    ov.addEventListener('click', e => { if (e.target === ov) ov.remove(); });
    ov._keyHandler = e => { if (e.key === 'Escape') ov.remove(); };
    document.addEventListener('keydown', ov._keyHandler);
}

// ===== Project toolbar buttons =====
function setupProjectToolbar() {
    document.getElementById('closeProjectModal').addEventListener('click', () => hideOverlay(projectModal));
    projectModal.addEventListener('click', e => { if (e.target === projectModal) hideOverlay(projectModal); });

    document.getElementById('addPhotoToProjectBtn').addEventListener('click', () => {
        if (!currentProjectId) return;
        document.getElementById('projectPhotoForm').reset();
        document.getElementById('projectPhotoStatus').textContent = '';
        showOverlay(addProjectPhotoModal);
    });
    document.getElementById('addVideoToProjectBtn').addEventListener('click', () => {
        if (!currentProjectId) return;
        document.getElementById('projectVideoForm').reset();
        document.getElementById('projectVideoStatus').textContent = '';
        showOverlay(addProjectVideoModal);
    });
    document.getElementById('addMediaToProjectBtn').addEventListener('click', () => {
        if (!currentProjectId) return;
        document.getElementById('projectMediaForm').reset();
        document.getElementById('projectMediaStatus').textContent = '';
        showOverlay(addProjectMediaModal);
    });
    document.getElementById('deleteProjectBtn').addEventListener('click', async () => {
        if (!currentProjectId) return;
        const ok = await confirmDelete(`حذف "${currentProjectData.name}"`, 'سيتم حذف المنتج وجميع محتوياته نهائياً');
        if (!ok) return;
        hideOverlay(projectModal);
        await deleteProject(currentProjectId);
        currentProjectId = null;
    });

    // إغلاق النوافذ الداخلية
    document.getElementById('closeProjectPhotoModal').addEventListener('click', () => hideOverlay(addProjectPhotoModal));
    document.getElementById('closeProjectVideoModal').addEventListener('click', () => hideOverlay(addProjectVideoModal));
    document.getElementById('closeProjectMediaModal').addEventListener('click', () => hideOverlay(addProjectMediaModal));
    [addProjectPhotoModal, addProjectVideoModal, addProjectMediaModal].forEach(m => {
        m.addEventListener('click', e => { if (e.target === m) hideOverlay(m); });
    });
}

// ===== Upload forms =====
function setupUploadForms() {

    // --- صورة ---
    document.getElementById('projectPhotoForm').addEventListener('submit', async e => {
        e.preventDefault();
        const status = document.getElementById('projectPhotoStatus');
        const file   = document.getElementById('projectPhotoFile').files[0];
        const desc   = document.getElementById('projectPhotoDescription').value.trim();
        if (!file)  { showStatus(status, 'اختر صورة', true); return; }
        showStatus(status, 'جاري الرفع...');
        const ref  = storage.ref(`${ST}/projects/${currentProjectId}/images/${Date.now()}_${file.name}`);
        const task = ref.put(file);
        task.on('state_changed',
            s => showStatus(status, `${Math.round(s.bytesTransferred / s.totalBytes * 100)}%`),
            () => showStatus(status, 'خطأ في الرفع', true),
            async () => {
                const url = await task.snapshot.ref.getDownloadURL();
                await db.ref(`${DB}/photos`).push({ url, projectId: currentProjectId, description: desc, timestamp: Date.now() });
                showStatus(status, 'تم ✓');
                setTimeout(() => { hideOverlay(addProjectPhotoModal); refreshProjectBody(); }, 800);
            }
        );
    });

    // --- فيديو ---
    document.getElementById('projectVideoForm').addEventListener('submit', async e => {
        e.preventDefault();
        const status = document.getElementById('projectVideoStatus');
        const file   = document.getElementById('projectVideoFile').files[0];
        const desc   = document.getElementById('projectVideoDescription').value.trim();
        if (!file) { showStatus(status, 'اختر فيديو', true); return; }
        showStatus(status, 'جاري الرفع...');
        const ref  = storage.ref(`${ST}/projects/${currentProjectId}/videos/${Date.now()}_${file.name}`);
        const task = ref.put(file);
        task.on('state_changed',
            s => showStatus(status, `${Math.round(s.bytesTransferred / s.totalBytes * 100)}%`),
            () => showStatus(status, 'خطأ في الرفع', true),
            async () => {
                const url = await task.snapshot.ref.getDownloadURL();
                await db.ref(`${DB}/videos`).push({ url, projectId: currentProjectId, description: desc, timestamp: Date.now() });
                showStatus(status, 'تم ✓');
                setTimeout(() => { hideOverlay(addProjectVideoModal); refreshProjectBody(); }, 800);
            }
        );
    });

    // --- وسائط: type chips ---
    const chips = document.querySelectorAll('#projectMediaForm .type-chip');
    chips.forEach(chip => {
        chip.addEventListener('click', () => {
            chips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            selectedProjMediaType = chip.dataset.type;
            document.getElementById('pmLinkField').style.display = selectedProjMediaType === 'pdf' ? 'none' : 'block';
            document.getElementById('pmFileField').style.display = selectedProjMediaType === 'pdf' ? 'block' : 'none';
        });
    });

    // --- وسائط: submit ---
    document.getElementById('projectMediaForm').addEventListener('submit', async e => {
        e.preventDefault();
        const status = document.getElementById('projectMediaStatus');
        const desc   = document.getElementById('projectMediaDescription').value.trim();
        if (!desc) { showStatus(status, 'أدخل الوصف', true); return; }
        showStatus(status, 'جاري الحفظ...');

        if (selectedProjMediaType === 'pdf') {
            const file = document.getElementById('projectMediaPdfFile').files[0];
            if (!file) { showStatus(status, 'اختر ملف PDF', true); return; }
            const ref  = storage.ref(`${ST}/projects/${currentProjectId}/media/${Date.now()}_${file.name}`);
            const task = ref.put(file);
            task.on('state_changed',
                s => showStatus(status, `${Math.round(s.bytesTransferred / s.totalBytes * 100)}%`),
                () => showStatus(status, 'خطأ في الرفع', true),
                async () => {
                    const url = await task.snapshot.ref.getDownloadURL();
                    await db.ref(`${DB}/otherMedia`).push({ url, type: 'pdf', projectId: currentProjectId, description: desc, timestamp: Date.now() });
                    showStatus(status, 'تم ✓');
                    setTimeout(() => { hideOverlay(addProjectMediaModal); refreshProjectBody(); }, 800);
                }
            );
        } else {
            const url = document.getElementById('projectMediaLink').value.trim();
            if (!url) { showStatus(status, 'أدخل الرابط', true); return; }
            await db.ref(`${DB}/otherMedia`).push({ url, type: selectedProjMediaType, projectId: currentProjectId, description: desc, timestamp: Date.now() });
            showStatus(status, 'تم ✓');
            setTimeout(() => { hideOverlay(addProjectMediaModal); refreshProjectBody(); }, 800);
        }
    });
}

// ===== Confirm delete close =====
document.getElementById('confirmDeleteNo').addEventListener('click', () => hideOverlay(confirmDeleteModal));
confirmDeleteModal.addEventListener('click', e => { if (e.target === confirmDeleteModal) hideOverlay(confirmDeleteModal); });

// ===== YouTube ID =====
function getYTId(url) {
    if (!url) return null;
    const m = url.match(/(?:youtu\.be\/|v\/|embed\/|watch\?v=|&v=)([^#&?]{11})/);
    return m ? m[1] : null;
}

// ===== Init =====
document.addEventListener('DOMContentLoaded', () => {
    setupMusic();
    setupCreateProject();
    setupProjectToolbar();
    setupUploadForms();
    loadProjects();
});
