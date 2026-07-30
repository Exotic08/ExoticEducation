import { db } from './firebase-config.js';

const app = document.getElementById('app');

/* ==========================================================================
   UI HELPERS
========================================================================== */

function showToast(message, type = 'success') {
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    el.textContent = message;
    document.body.appendChild(el);
    setTimeout(() => el.remove(), 3000);
}

const checkDevPermission = async () => {
    const currentUser = getCurrentUser();
    if (!currentUser) return false;
    if (Number(currentUser.dev) !== 1) {
        const banUntil = Date.now() + 60 * 60 * 1000; // 1 giờ sau
        await db.ref(`users/${currentUser.userId}`).update({
            isBanned: true,
            bannedUntil: banUntil
        });
        alert("CẢNH BÁO BẢO MẬT: Phát hiện thao tác trái phép! Tài khoản của bạn đã bị khóa trong 1 giờ.");
        location.reload();
        return false;
    }
    return true;
};

function initials(name) {
    if (!name) return '?';
    return name.trim().split(/\s+/).slice(-1)[0][0].toUpperCase();
}

function escapeHtml(str = '') {
    return String(str).replace(/[&<>"']/g, (c) => ({
        '&': '&', '<': '<', '>': '>', '"': '"', "'": '&#39;'
    }[c]));
}

function uid() {
    return 'q_' + Math.random().toString(36).slice(2, 10);
}

function generatePIN() {
    return Math.floor(100000 + Math.random() * 900000).toString();
}

function showConfirmModal({ title, message, confirmText = 'Xác nhận', danger = true, onConfirm }) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.innerHTML = `
        <div class="modal-box">
            <h3>${escapeHtml(title)}</h3>
            <p>${escapeHtml(message)}</p>
            <div class="modal-actions">
                <button class="btn-outline" id="modal-cancel">Hủy</button>
                <button class="${danger ? 'btn-danger' : ''}" id="modal-confirm">${escapeHtml(confirmText)}</button>
            </div>
        </div>
    `;
    document.body.appendChild(backdrop);
    backdrop.querySelector('#modal-cancel').addEventListener('click', () => backdrop.remove());
    backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });
    backdrop.querySelector('#modal-confirm').addEventListener('click', () => {
        backdrop.remove();
        onConfirm();
    });
}

function showBroadcastBanner(msg, ts) {
    if (document.getElementById('sys-broadcast-banner')) return;
    const banner = document.createElement('div');
    banner.id = 'sys-broadcast-banner';
    banner.style.cssText = `position: fixed; top: 0; left: 0; width: 100%; background: linear-gradient(135deg, #ef4444, #f97316); color: white; padding: 1rem 2rem; z-index: 9999; display: flex; align-items: center; justify-content: space-between; box-shadow: 0 4px 12px rgba(0,0,0,0.2); animation: pageFadeIn 0.4s var(--ease); font-weight: 600; flex-wrap: wrap; gap: 1rem;`;
    banner.innerHTML = `
        <div style="display:flex; align-items:center; gap:0.75rem;">
            <span style="font-size:1.5rem; animation: shakeIn 0.5s infinite alternate;">📢</span> 
            <span style="font-size: 0.95rem;">${escapeHtml(msg)}</span>
        </div> 
        <button style="background: white; color: #ef4444; padding: 0.4rem 1.25rem; border-radius: 999px; border: none; font-weight: 800; cursor: pointer; white-space: nowrap; box-shadow: var(--shadow-sm);">Đã hiểu</button>
    `;
    document.body.appendChild(banner);
    banner.querySelector('button').addEventListener('click', () => {
        localStorage.setItem('lastBroadcastTime', ts);
        banner.style.transform = 'translateY(-100%)';
        banner.style.opacity = '0';
        banner.style.transition = 'all 0.3s';
        setTimeout(() => banner.remove(), 300);
    });
}

function getCurrentUser() {
    const raw = localStorage.getItem('user');
    return raw ? JSON.parse(raw) : null;
}

function getTodayStr() {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
}

function getDaysDiff(dateStr1, dateStr2) {
    if(!dateStr1 || !dateStr2) return 999;
    const d1 = new Date(dateStr1);
    const d2 = new Date(dateStr2);
    return Math.floor((d2 - d1) / (1000 * 60 * 60 * 24));
}

async function addExp(amount) {
    const u = getCurrentUser();
    if(!u) return;
    const ref = db.ref(`users/${u.userId}`);
    const snap = await ref.once('value');
    const data = snap.val();
    if(!data) return;

    const oldExp = data.exp || 0;
    const newExp = oldExp + amount;
    const oldLevel = Math.floor(oldExp / 100) + 1;
    const newLevel = Math.floor(newExp / 100) + 1;

    await ref.update({ exp: newExp });

    if(newLevel > oldLevel) {
        showToast(`🎉 Level Up! Bạn đã đạt Cấp ${newLevel}`, 'success');
    }
}

const QUESTION_TYPES = {
    multiple_choice: { label: 'Trắc nghiệm', icon: '🔤' },
    short_answer: { label: 'Trả lời ngắn', icon: '✏️' },
    true_false: { label: 'Đúng/Sai', icon: '⚖️' },
    essay: { label: 'Tự luận', icon: '📝' }
};

const SUBJECTS = ['Toán', 'Vật Lý', 'Hóa Học', 'Sinh Học', 'Tiếng Anh', 'Lịch Sử', 'Địa Lý', 'Khác'];

/* ==========================================================================
   ULTIMATE SANDBOX ENGINE (AUDIO & 3D TILT & INTERACTIVE STATES)
========================================================================== */
window.playSandboxAudio = function(url) {
    if(!url) return;
    const audio = new Audio(url);
    audio.volume = 0.5;
    audio.play().catch(e=>console.warn("Audio blocked by browser"));
};

document.addEventListener('mouseover', e => {
    const el = e.target.closest('[data-audio-hover]');
    if(el && !el.dataset.hoverPlayed) {
        window.playSandboxAudio(el.dataset.audioHover);
        el.dataset.hoverPlayed = "true";
    }
});
document.addEventListener('mouseout', e => {
    const el = e.target.closest('[data-audio-hover]');
    if(el) el.dataset.hoverPlayed = "";
});
document.addEventListener('mousedown', e => {
    const el = e.target.closest('[data-audio-click]');
    if(el) window.playSandboxAudio(el.dataset.audioClick);
});

document.addEventListener('mousemove', e => {
    const tilts = document.querySelectorAll('.tilt-enabled');
    tilts.forEach(tilt => {
        const rect = tilt.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const centerX = rect.width / 2;
        const centerY = rect.height / 2;
        const rotateX = ((y - centerY) / centerY) * -15;
        const rotateY = ((x - centerX) / centerX) * 15;
        tilt.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.05, 1.05, 1.05)`;
    });
});
document.addEventListener('mouseout', e => {
    const tilts = document.querySelectorAll('.tilt-enabled');
    tilts.forEach(tilt => {
        tilt.style.transform = `perspective(1000px) rotateX(0deg) rotateY(0deg) scale3d(1, 1, 1)`;
    });
});

/* ==========================================================================
   DYNAMIC CONFIGURATION MANAGERS (REALTIME SYNC)
========================================================================== */

let dynamicBorders = [];
let dynamicFrames = [];
let dynamicTitles = [];
let dynamicAvatars = [];
let activeListeners = [];

function initGlobalSync() {
    activeListeners.forEach(l => l.ref.off('value', l.cb));
    activeListeners = [];

    const user = getCurrentUser();

    if (user) {
        const userRef = db.ref(`users/${user.userId}`);
        const userCb = snap => {
            const data = snap.val();
            if (data) {
                if (data.isBanned) {
                    if (data.bannedUntil && Date.now() >= data.bannedUntil) {
                        db.ref(`users/${user.userId}`).update({ isBanned: false, bannedUntil: null });
                    } else {
                        renderBannedScreen();
                        return;
                    }
                }
                const today = getTodayStr();
                let newStreak = data.streak || 1;
                let newExp = data.exp || 0;
                let needsUpdate = false;

                if (data.lastActiveDate !== today) {
                    const diff = getDaysDiff(data.lastActiveDate, today);
                    if (diff === 1) {
                        newStreak += 1;
                    } else if (diff > 1) {
                        newStreak = 1;
                    }
                    newExp += 20;
                    needsUpdate = true;
                }

                if (needsUpdate) {
                    db.ref(`users/${user.userId}`).update({
                        lastActiveDate: today,
                        streak: newStreak,
                        exp: newExp
                    });
                    showToast(`🔥 Điểm danh hàng ngày: +20 EXP. Chuỗi: ${newStreak} ngày!`);
                    return;
                }

                localStorage.setItem('user', JSON.stringify({
                    userId: user.userId,
                    username: data.username,
                    displayName: data.displayName || data.username,
                    avatarBorderId: data.avatarBorderId || 'none',
                    chatFrameId: data.chatFrameId || 'none',
                    chatTitleId: data.chatTitleId || 'none',
                    avatarPresetId: data.avatarPresetId || 'none',
                    avatarUrl: data.avatarUrl || '',
                    points: data.points !== undefined ? data.points : 500,
                    streak: data.streak || 1,
                    exp: data.exp || 0,
                    dev: data.dev !== undefined ? Number(data.dev) : 0,
                    lastActiveDate: data.lastActiveDate || '',
                    isMuted: data.isMuted || false,
                    inventory: data.inventory || { borders: ['none'], frames: ['none'], titles: ['none'], presets: ['none'] }
                }));
                refreshCurrentUI();
            }
        };
        userRef.on('value', userCb);
        activeListeners.push({ ref: userRef, cb: userCb });

        const connectedRef = db.ref('.info/connected');
        const connectedCb = (snap) => {
            if (snap.val() === true) {
                const myStatusRef = db.ref(`users/${user.userId}/isOnline`);
                const myLastSeenRef = db.ref(`users/${user.userId}/lastSeen`);
                myStatusRef.onDisconnect().set(false).then(() => {
                    myStatusRef.set(true);
                    myLastSeenRef.set(firebase.database.ServerValue.TIMESTAMP);
                });
            }
        };
        connectedRef.on('value', connectedCb);
        activeListeners.push({ ref: connectedRef, cb: connectedCb });
    }

    const broadcastRef = db.ref('app_settings/broadcast');
    const broadcastCb = snap => {
        const data = snap.val();
        if (data) {
            const lastTs = parseInt(localStorage.getItem('lastBroadcastTime') || '0');
            if (data.timestamp > lastTs) {
                showBroadcastBanner(data.message, data.timestamp);
            }
        }
    };
    broadcastRef.on('value', broadcastCb);
    activeListeners.push({ ref: broadcastRef, cb: broadcastCb });

    const bordersRef = db.ref('app_borders');
    const bordersCb = snap => {
        const data = snap.val() || {};
        dynamicBorders = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        refreshCurrentUI();
    };
    bordersRef.on('value', bordersCb);
    activeListeners.push({ ref: bordersRef, cb: bordersCb });

    const framesRef = db.ref('app_chat_bubbles');
    const framesCb = snap => {
        const data = snap.val() || {};
        dynamicFrames = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        refreshCurrentUI();
    };
    framesRef.on('value', framesCb);
    activeListeners.push({ ref: framesRef, cb: framesCb });

    const titlesRef = db.ref('app_titles');
    const titlesCb = snap => {
        const data = snap.val() || {};
        dynamicTitles = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        refreshCurrentUI();
    };
    titlesRef.on('value', titlesCb);
    activeListeners.push({ ref: titlesRef, cb: titlesCb });

    const avatarsRef = db.ref('app_preset_avatars');
    const avatarsCb = snap => {
        const data = snap.val() || {};
        dynamicAvatars = Object.keys(data).map(key => ({ id: key, ...data[key] }));
        refreshCurrentUI();
    };
    avatarsRef.on('value', avatarsCb);
    activeListeners.push({ ref: avatarsRef, cb: avatarsCb });
}

function refreshCurrentUI() {
    const user = getCurrentUser();
    if (!user) return;

    const userChip = document.getElementById('sidebar-user-chip');
    if (userChip) {
        const borderConfig = getBorderById(user.avatarBorderId);
        const presetConfig = getPresetById(user.avatarPresetId);
        const currentLevel = Math.floor((user.exp || 0) / 100) + 1;
        userChip.innerHTML = `
            ${renderAvatarWithBorderObj(user.displayName, borderConfig, 'sm', '', user.avatarUrl, presetConfig)}
            <div style="display:flex; flex-direction:column; overflow:hidden;">
                <div class="name">${escapeHtml(user.displayName)}</div>
                <div style="font-size:0.75rem; color:var(--text-soft); font-weight:700;">Lv.${currentLevel} • 🔥 ${user.streak || 1}</div>
            </div>
        `;
    }

    const isDev = Number(user.dev) === 1;
    const devBtnDesktop = document.querySelector('.nav-item[data-page="dev"]');
    const devBtnMobile = document.querySelector('.nav-item-mobile[data-page="dev"]');
    if (devBtnDesktop) devBtnDesktop.style.display = isDev ? 'flex' : 'none';
    if (devBtnMobile) devBtnMobile.style.display = isDev ? 'flex' : 'none';

    const activeNav = document.querySelector('.nav-item.active');
    if (activeNav && activeNav.dataset.page === 'dev' && !isDev) {
        setActivePage('public');
    }
    if (activeNav) {
        const page = activeNav.dataset.page;
        const main = getMain();
        if (page === 'dev') renderDeveloper(main);
        if (page === 'shop') renderShop(main);
        if (page === 'leaderboard' && typeof renderGlobalLeaderboard === 'function') renderGlobalLeaderboard(main);
    }
    
    const chatInput = document.getElementById('chat-input');
    const chatSendBtn = document.getElementById('chat-send-btn');
    if (chatInput && chatSendBtn) {
        if (user.isMuted) {
            chatInput.disabled = true;
            chatInput.placeholder = "🚫 Bạn đã bị hạn chế quyền nhắn tin";
            chatSendBtn.disabled = true;
        } else {
            chatInput.disabled = false;
            chatInput.placeholder = "Nhập tin nhắn của bạn...";
            chatSendBtn.disabled = false;
        }
    }
}

function getAvatarBorders() {
    return [{ id: 'none', name: 'Mặc định / Không sử dụng', url: '', offsetX: 0, offsetY: 0, scale: 100, price: 0 }, ...dynamicBorders];
}

function getChatFrames() {
    return [{ id: 'none', name: 'Mặc định / Không sử dụng', url: '', bgPosX: 50, bgPosY: 50, bgSize: 100, price: 0 }, ...dynamicFrames];
}

function getChatTitles() {
    return [{ id: 'none', name: 'Không có', type: 'text_bg', imageUrl: '', textContent: '', textColor: '#4b4560', bgColor: 'transparent', borderColor: 'transparent', price: 0 }, ...dynamicTitles];
}

function getPresetAvatars() {
    return [{ id: 'none', name: 'Mặc định / Tự Upload', url: '', offsetX: 0, offsetY: 0, scale: 100, price: 0 }, ...dynamicAvatars];
}

function getBorderById(id) {
    const borders = getAvatarBorders();
    return borders.find(x => x.id === id) || borders[0];
}

function getFrameById(id) {
    const frames = getChatFrames();
    return frames.find(x => x.id === id) || frames[0];
}

function getTitleById(id) {
    const titles = getChatTitles();
    return titles.find(x => x.id === id) || titles[0];
}

function getPresetById(id) {
    const presets = getPresetAvatars();
    return presets.find(x => x.id === id) || presets[0];
}

/* ==========================================================================
   COMPONENT: AVATAR WITH BORDER & CROPPER MODAL & PUBLIC PROFILE
========================================================================== */

function renderAvatarWithBorderObj(name, borderObj, size = 'md', imgId = '', avatarUrl = '', presetObj = null) {
    const sizeClasses = {
        sm: { container: '48px', avatar: '32px', font: '0.9rem' },
        md: { container: '56px', avatar: '40px', font: '1.1rem' },
        lg: { container: '80px', avatar: '56px', font: '1.5rem' },
        xl: { container: '120px', avatar: '80px', font: '2.5rem' },
    };
    const s = sizeClasses[size] || sizeClasses.md;
    const uid = `ava-${Math.random().toString(36).substr(2,5)}`;

    let borderHtml = '';
    let borderSandboxStyle = '';
    let borderAudio = '';
    let borderTilt = '';
    let borderFilter = '';

    if (borderObj && borderObj.id !== 'none') {
        const { url = '', offsetX = 0, offsetY = 0, scale = 100, cssVars, defaultCSS, hoverCSS, activeCSS, audioHover, audioClick, enableTilt, svgFilter } = borderObj;
        
        if (cssVars || defaultCSS || hoverCSS || activeCSS) {
            borderSandboxStyle = `<style>
                .border-${uid} { ${cssVars || ''} ${defaultCSS || ''} transition: all 0.3s ease; }
                .border-${uid}:hover { ${hoverCSS || ''} }
                .border-${uid}:active { ${activeCSS || ''} }
            </style>`;
        }
        
        borderAudio = `${audioHover ? `data-audio-hover="${escapeHtml(audioHover)}"` : ''} ${audioClick ? `data-audio-click="${escapeHtml(audioClick)}"` : ''}`;
        borderTilt = enableTilt ? 'tilt-enabled' : '';
        borderFilter = svgFilter ? `<div style="position:absolute; width:0; height:0; overflow:hidden;">${svgFilter}</div>` : '';

        const transformStyle = `translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) scale(${scale / 100})`;
        if (url) {
            borderHtml = `<img class="border-${uid}" ${imgId ? `id="${imgId}"` : ''} src="${escapeHtml(url)}" style="position: absolute; top: 50%; left: 50%; width: 100%; height: 100%; object-fit: contain; pointer-events: none; transform-origin: center center; transform: ${transformStyle}; z-index: 4;" />`;
        } else {
            borderHtml = `<div class="border-${uid}" style="position: absolute; top: 50%; left: 50%; width: 100%; height: 100%; pointer-events: none; transform-origin: center center; transform: ${transformStyle}; z-index: 4;"></div>`;
        }
    }

    let coreAvatar = '';
    let styleBlock = '';
    let effectHtml = '';
    let avaAudio = '';
    let avaTilt = '';
    let avaFilter = '';

    if (presetObj && presetObj.id !== 'none') {
        const pClass = `preset-${presetObj.id}-${uid}`;
        const { cssVars, defaultCSS, hoverCSS, activeCSS, audioHover, audioClick, enableTilt, svgFilter, effectCode, designCode, avatarType, effectLayer, offsetX=0, offsetY=0, scale=100 } = presetObj;
        
        if (cssVars || defaultCSS || hoverCSS || activeCSS || effectCode) {
            styleBlock = `<style>
                .${pClass}-design { ${cssVars || ''} ${defaultCSS || ''} transition: all 0.3s ease; }
                .${pClass}-design:hover { ${hoverCSS || ''} }
                .${pClass}-design:active { ${activeCSS || ''} }
                ${effectCode || ''}
            </style>`;
        }
        
        avaAudio = `${audioHover ? `data-audio-hover="${escapeHtml(audioHover)}"` : ''} ${audioClick ? `data-audio-click="${escapeHtml(audioClick)}"` : ''}`;
        avaTilt = enableTilt ? 'tilt-enabled' : '';
        avaFilter = svgFilter ? `<div style="position:absolute; width:0; height:0; overflow:hidden;">${svgFilter}</div>` : '';

        if (avatarType === 'code') {
            coreAvatar = `<div class="${pClass}-design" style="width:100%; height:100%; display:flex; align-items:center; justify-content:center;">${designCode || ''}</div>`;
        } else {
            const realUrl = avatarUrl || presetObj.url;
            if (realUrl) {
                coreAvatar = `<img class="${pClass}-design" src="${escapeHtml(realUrl)}" style="position: absolute; top: 50%; left: 50%; width: 100%; height: 100%; object-fit: contain; transform: translate(calc(-50% + ${offsetX}px), calc(-50% + ${offsetY}px)) scale(${scale / 100});" />`;
            } else {
                coreAvatar = `<div class="${pClass}-design">${initials(name)}</div>`;
            }
        }
        effectHtml = effectCode ? `<div class="preset-${presetObj.id}-effect" style="position:absolute; top:50%; left:50%; width:${s.avatar}; height:${s.avatar}; transform:translate(-50%, -50%); z-index: ${effectLayer === 'front' ? 3 : 0}; pointer-events:none;"></div>` : '';
    } else {
        coreAvatar = avatarUrl ? `<img src="${escapeHtml(avatarUrl)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: 50%;" />` : initials(name);
    }

    return `
        ${borderSandboxStyle} ${borderFilter} ${styleBlock} ${avaFilter}
        <div class="${avaTilt} ${borderTilt}" ${avaAudio} ${borderAudio} title="${escapeHtml(name)}" style="position: relative; width: ${s.container}; height: ${s.container}; display: flex; align-items: center; justify-content: center; flex-shrink: 0; overflow: visible;">
            ${presetObj && presetObj.effectLayer === 'back' ? effectHtml : ''}
            <div style="position: relative; width: ${s.avatar}; height: ${s.avatar}; border-radius: 50%; background: linear-gradient(135deg, var(--accent), var(--primary)); color: white; display: flex; align-items: center; justify-content: center; font-weight: 700; font-size: ${s.font}; overflow: hidden; z-index: 1;">
                ${coreAvatar}
            </div>
            ${presetObj && presetObj.effectLayer === 'front' ? effectHtml : ''}
            ${borderHtml}
        </div>
    `;
}

function getTitleHtml(titleObj) {
    if(!titleObj || titleObj.id === 'none' || (!titleObj.textContent && !titleObj.imageUrl)) return '';
    const { id, type, imageUrl, textContent, textColor, bgColor, borderColor, cssVars, defaultCSS, hoverCSS, activeCSS, svgFilter, audioHover, audioClick, enableTilt } = titleObj;
    
    const uid = `title-${id}-${Math.random().toString(36).substr(2,5)}`;
    let styleStr = '';
    
    if (cssVars || defaultCSS || hoverCSS || activeCSS) {
        styleStr = `<style>
            .${uid} { ${cssVars || ''} ${defaultCSS || ''} transition: all 0.3s ease; }
            .${uid}:hover { ${hoverCSS || ''} }
            .${uid}:active { ${activeCSS || ''} }
        </style>`;
    }

    const audioAttrs = `${audioHover ? `data-audio-hover="${escapeHtml(audioHover)}"` : ''} ${audioClick ? `data-audio-click="${escapeHtml(audioClick)}"` : ''}`;
    const tiltClass = enableTilt ? 'tilt-enabled' : '';
    const filterHtml = svgFilter ? `<div style="position:absolute; width:0; height:0; overflow:hidden;">${svgFilter}</div>` : '';

    return `
        ${styleStr}${filterHtml}
        <span class="${uid} ${tiltClass}" ${audioAttrs} style="position: relative; display: inline-flex; align-items: center; gap: 0.25rem; padding: 0.15rem 0.4rem; border-radius: 4px; background-color: ${escapeHtml(bgColor || 'transparent')}; border: 1px solid ${escapeHtml(borderColor || 'transparent')}; color: ${escapeHtml(textColor || '#000')}; font-size: 0.65rem; font-weight: 800; text-transform: uppercase; margin-right: 0.4rem; letter-spacing: 0.5px; z-index: 10;">
            ${type === 'image_text' && imageUrl ? `<img src="${escapeHtml(imageUrl)}" style="width: 14px; height: 14px; object-fit: contain; position: relative; z-index: 2;" />` : ''}
            ${textContent ? `<span style="position: relative; z-index: 2;">${escapeHtml(textContent)}</span>` : ''}
        </span>
    `;
}

function showCropperModal(imageSrc, onSave) {
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    backdrop.style.zIndex = '3000';
    backdrop.innerHTML = `
        <div class="modal-box" style="width: 90vw; max-width: 350px; padding: 1.5rem; display: flex; flex-direction: column; align-items: center;">
            <h3 style="margin-top: 0; margin-bottom: 1rem;">Cắt ảnh đại diện</h3>
            <div id="cropper-viewport" style="width: 100%; aspect-ratio: 1/1; position: relative; overflow: hidden; border-radius: var(--radius-sm); background: #eee; cursor: grab; user-select: none; touch-action: none;">
                <img id="cropper-img" src="${imageSrc}" style="position: absolute; transform-origin: top left; pointer-events: none; max-width: none;" />
                <div style="position: absolute; inset: 0; pointer-events: none; width: 100%; height: 100%; border: 2px dashed rgba(255,255,255,0.8); box-sizing: border-box; box-shadow: 0 0 0 9999px rgba(0,0,0,0.4);"></div>
            </div>
            <div style="width: 100%; margin-top: 1rem;">
                <label style="font-size: 0.8rem; font-weight: bold; color: var(--text-soft); display: flex; justify-content: space-between;">
                    <span>Thu phóng</span>
                    <span id="cropper-zoom-val">100%</span>
                </label>
                <input type="range" id="cropper-zoom" min="0.1" max="3" step="0.01" value="1" style="width: 100%; accent-color: var(--primary);">
            </div>
            <div class="modal-actions" style="width: 100%; justify-content: space-between; margin-top: 1.5rem;">
                <button class="btn-outline" id="cropper-cancel" style="flex: 1;">Hủy</button>
                <button id="cropper-save" style="flex: 1;">Cắt & Lưu</button>
            </div>
        </div>
    `;
    document.body.appendChild(backdrop);

    const imgEl = backdrop.querySelector('#cropper-img');
    const vp = backdrop.querySelector('#cropper-viewport');
    const zoomSlider = backdrop.querySelector('#cropper-zoom');
    const zoomVal = backdrop.querySelector('#cropper-zoom-val');
    const cancelBtn = backdrop.querySelector('#cropper-cancel');
    const saveBtn = backdrop.querySelector('#cropper-save');

    let img = new Image();
    let currentX = 0, currentY = 0, scale = 1;
    let isDragging = false, startX, startY;
    let vpWidth, vpHeight;

    img.onload = () => {
        try {
            vpWidth = vp.clientWidth;
            vpHeight = vp.clientHeight;
            const scaleX = vpWidth / img.width;
            const scaleY = vpHeight / img.height;
            scale = Math.max(scaleX, scaleY);
            zoomSlider.min = scale * 0.2; 
            zoomSlider.max = scale * 5;
            zoomSlider.value = scale;
            zoomVal.textContent = Math.round(scale * 100) + '%';

            currentX = (vpWidth - img.width * scale) / 2;
            currentY = (vpHeight - img.height * scale) / 2;
            updateTransform();
        } catch (e) {
            console.error("Error processing image onload:", e);
            showToast('Lỗi xử lý ảnh. Vui lòng thử ảnh khác.', 'error');
            backdrop.remove();
        }
    };
    img.onerror = () => {
        showToast('Không thể tải ảnh. Vui lòng kiểm tra đường dẫn hoặc thử ảnh khác.', 'error');
        backdrop.remove();
    };
    img.src = imageSrc;

    function updateTransform() {
        imgEl.style.transform = `translate(${currentX}px, ${currentY}px) scale(${scale})`;
    }

    function handleDragStart(clientX, clientY) {
        isDragging = true;
        startX = clientX - currentX;
        startY = clientY - currentY;
        vp.style.cursor = 'grabbing';
    }

    function handleDragMove(clientX, clientY) {
        if (!isDragging) return;
        currentX = clientX - startX;
        currentY = clientY - startY;
        updateTransform();
    }

    function handleDragEnd() {
        isDragging = false;
        vp.style.cursor = 'grab';
    }

    vp.addEventListener('mousedown', e => handleDragStart(e.clientX, e.clientY));
    window.addEventListener('mousemove', e => handleDragMove(e.clientX, e.clientY));
    window.addEventListener('mouseup', handleDragEnd);

    vp.addEventListener('touchstart', e => {
        e.preventDefault();
        handleDragStart(e.touches[0].clientX, e.touches[0].clientY);
    }, {passive: false});
    vp.addEventListener('touchmove', e => {
        e.preventDefault();
        handleDragMove(e.touches[0].clientX, e.touches[0].clientY);
    }, {passive: false});
    window.addEventListener('touchend', handleDragEnd);

    zoomSlider.addEventListener('input', e => {
        const newScale = parseFloat(e.target.value);
        zoomVal.textContent = Math.round(newScale * 100) + '%';
        const cx = vpWidth / 2, cy = vpHeight / 2;
        const imgCx = (cx - currentX) / scale;
        const imgCy = (cy - currentY) / scale;
        
        scale = newScale;
        currentX = cx - imgCx * scale;
        currentY = cy - imgCy * scale;
        
        updateTransform();
    });

    cancelBtn.addEventListener('click', () => backdrop.remove());

    saveBtn.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = 150;
        canvas.height = 150;
        const ctx = canvas.getContext('2d');
        
        const sourceX = -currentX / scale;
        const sourceY = -currentY / scale;
        const sourceWidth = vpWidth / scale;
        const sourceHeight = vpHeight / scale;
        
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, 150, 150);
        ctx.drawImage(img, sourceX, sourceY, sourceWidth, sourceHeight, 0, 0, 150, 150);
        
        const base64 = canvas.toDataURL('image/jpeg', 0.6);
        backdrop.remove();
        onSave(base64);
    });
}

async function showPublicProfile(userId) {
    try {
        const userSnap = await db.ref(`users/${userId}`).once('value');
        const userData = userSnap.val();
        if (!userData) return showToast('Không tìm thấy người dùng', 'error');

        const [examsSnap, resultsSnap] = await Promise.all([
            db.ref('exams').orderByChild('ownerId').equalTo(userId).once('value'),
            db.ref('results').once('value')
        ]);

        const examsData = examsSnap.val() || {};
        const allResults = resultsSnap.val() || {};
        
        const publicExams = Object.entries(examsData)
            .filter(([_, e]) => e.isPublic)
            .map(([id, e]) => ({ id, ...e }));

        let totalAttempts = 0;
        Object.values(allResults).forEach(examResults => {
            if (examResults[userId]) {
                totalAttempts += examResults[userId].attempts || 1;
            }
        });

        const exp = userData.exp || 0;
        const points = userData.points !== undefined ? userData.points : 500;
        const level = Math.floor(exp / 100) + 1;
        const expProgress = exp % 100;
        const streak = userData.streak || 1;

        const borderObj = getBorderById(userData.avatarBorderId);
        const frameObj = getFrameById(userData.chatFrameId);
        const titleObj = getTitleById(userData.chatTitleId);
        const presetObj = getPresetById(userData.avatarPresetId);
        const displayName = userData.displayName || userData.username;

        let frameStyle = '';
        let frameClass = '';
        if (frameObj && frameObj.id !== 'none' && frameObj.designCode) {
            frameStyle = frameObj.designCode;
            frameClass = `frame-${frameObj.id}`;
            if (frameObj.effectCode && !document.getElementById('frame-style-' + frameObj.id)) {
                const style = document.createElement('style');
                style.id = 'frame-style-' + frameObj.id;
                style.textContent = frameObj.effectCode;
                document.head.appendChild(style);
            }
        } else {
            frameStyle = `background: var(--surface); color: var(--text-heading); border: 1px solid var(--border);`;
        }

        const backdrop = document.createElement('div');
        backdrop.className = 'modal-backdrop';
        backdrop.style.zIndex = '4000';
        backdrop.innerHTML = `
            <div class="profile-modal-box" style="padding: 0; width: 95%; max-width: 550px; background: transparent; box-shadow: none;">
                <!-- 1. HERO BANNER -->
                <div class="profile-hero-card" style="margin-bottom: 1rem; position: relative;">
                    <button class="profile-modal-close" id="profile-close" style="position: absolute; top: 0.75rem; right: 0.75rem; z-index: 10;">✖</button>
                    
                    <div style="display:inline-flex; justify-content:center; align-items:center; flex-shrink:0;">
                        ${renderAvatarWithBorderObj(displayName, borderObj, 'lg', '', userData.avatarUrl || '', presetObj)}
                    </div>
                    
                    <div class="profile-hero-info" style="text-align: left; width: 100%;">
                        <div style="display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 0.5rem;">
                            <div>
                                <div style="display: flex; align-items: center; margin-bottom: 0.25rem;">
                                    ${getTitleHtml(titleObj)}
                                    <h2 style="margin: 0; font-size: 1.4rem; color: var(--text-heading);">${escapeHtml(displayName)}</h2>
                                </div>
                                <p style="margin: 0; font-size: 0.85rem; color: var(--text-soft);">@${escapeHtml(userData.username)}</p>
                            </div>
                        </div>

                        <div class="profile-stats-row" style="margin-top:0.75rem; padding-top:1rem; border-top:1px solid var(--border);">
                            <div class="profile-stat-box">
                                <div style="font-size: 1.2rem; margin-bottom: 0.2rem;">🔥</div>
                                <div style="font-weight: 800; color: #ef4444; font-size: 1rem;">${streak}</div>
                                <div style="font-size: 0.65rem; color: var(--text-soft); font-weight: 600;">Chuỗi ngày</div>
                            </div>
                            <div class="profile-stat-box" style="display: flex; flex-direction: column; justify-content: center;">
                                <div style="display: flex; justify-content: space-between; font-size: 0.7rem; font-weight: 800; color: var(--primary-dark); margin-bottom: 0.2rem;">
                                    <span>🏆 Lv.${level}</span>
                                    <span>${Math.round(expProgress)}%</span>
                                </div>
                                <div class="level-progress-track" style="margin-top: 0; margin-bottom: 0.2rem; height: 6px;">
                                    <div class="level-progress-fill" style="width: ${expProgress}%"></div>
                                </div>
                                <div style="font-size: 0.65rem; color: var(--text-soft); font-weight: 600; margin-top: auto;">Tiến trình</div>
                            </div>
                            <div class="profile-stat-box">
                                <div style="font-size: 1.2rem; margin-bottom: 0.2rem;">💰</div>
                                <div style="font-weight: 800; color: #d97706; font-size: 1rem;">${points}</div>
                                <div style="font-size: 0.65rem; color: var(--text-soft); font-weight: 600;">Điểm thưởng</div>
                            </div>
                            <div class="profile-stat-box">
                                <div style="font-size: 1.2rem; margin-bottom: 0.2rem;">📜</div>
                                <div style="font-weight: 800; color: var(--primary-dark); font-size: 1rem;">${totalAttempts}</div>
                                <div style="font-size: 0.65rem; color: var(--text-soft); font-weight: 600;">Bài đã làm</div>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- 2. PHẦN BỔ SUNG BÊN DƯỚI -->
                <div class="form-card" style="margin-top: 0; padding: 1.5rem; text-align: left; background: var(--surface); border-radius: var(--radius-md); box-shadow: var(--shadow-sm);">
                    <h4 style="margin: 0 0 0.75rem 0; font-size: 0.95rem; color: var(--text-heading);">💬 Khung Chat Đang Dùng</h4>
                    <div class="${frameClass}" style="font-size: 0.9rem; padding: 0.65rem 1rem; border-radius: 1.25rem; word-wrap: break-word; box-shadow: var(--shadow-sm); ${frameStyle}; margin-bottom: 1.5rem; display: inline-block;">
                        Xin chào! Rất vui được gặp bạn 👋
                    </div>

                    <h4 style="margin: 0 0 0.75rem 0; font-size: 0.95rem; color: var(--text-heading);">📚 Bài Thi Công Khai (${publicExams.length})</h4>
                    <div style="max-height: 160px; overflow-y: auto;">
                        ${publicExams.length === 0 ? `<div style="font-size: 0.85rem; color: var(--text-soft);">Chưa có bài thi công khai nào.</div>` : ''}
                        ${publicExams.slice(0, 3).map(e => `
                            <div class="profile-exam-item">
                                <span style="font-weight: 700; font-size: 0.9rem; color: var(--text-heading); white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 70%;">${escapeHtml(e.title)}</span>
                                <span class="badge blue" style="font-size: 0.7rem;">${escapeHtml(e.subjectTag || 'Khác')}</span>
                            </div>
                        `).join('')}
                        ${publicExams.length > 3 ? `<div style="font-size: 0.8rem; color: var(--primary); text-align: center; margin-top: 0.5rem; font-weight: 600;">+ ${publicExams.length - 3} bài thi khác</div>` : ''}
                    </div>
                </div>
            </div>
        `;
        document.body.appendChild(backdrop);

        backdrop.querySelector('#profile-close').addEventListener('click', () => backdrop.remove());
        backdrop.addEventListener('click', (e) => { if (e.target === backdrop) backdrop.remove(); });

    } catch (err) {
        showToast('Lỗi tải hồ sơ', 'error');
    }
}

let activeChatAddedListener = null;
let activeChatChangedListener = null;
let activeLeaderboardListenerRef = null;
let activeLeaderboardListenerCb = null;
let activeOnlineCountListenerRef = null;
let activeOnlineCountListenerCb = null;

/* ==========================================================================
   AUTH SCREENS
========================================================================== */

function renderBannedScreen() {
    app.innerHTML = `
        <div class="auth-wrapper page-fade" style="text-align:center; max-width: 400px; margin: 4rem auto;">
            <div style="font-size: 4rem; margin-bottom: 1rem;">🚫</div>
            <h2>Tài khoản bị khóa</h2>
            <p style="color:var(--text-soft); margin-bottom:2rem;">Tài khoản của bạn đã bị quản trị viên khóa do vi phạm quy định của hệ thống.</p>
            <button id="logout-banned" style="width:100%;">Đăng xuất</button>
        </div>
    `;
    document.getElementById('logout-banned').addEventListener('click', () => {
        localStorage.removeItem('user');
        location.reload();
    });
}

function renderAuth() {
    app.innerHTML = `
        <div class="auth-wrapper page-fade">
            <div class="auth-logo">
                <span class="dot"></span>
                <span>ExoticStudy</span>
            </div>
            <div id="auth-slot"></div>
        </div>
    `;
    renderLoginForm();
}

function renderLoginForm() {
    const slot = document.getElementById('auth-slot');
    slot.innerHTML = `
        <div class="auth-container">
            <h2>Chào mừng trở lại 👋</h2>
            <p class="auth-subtitle">Đăng nhập để tiếp tục học tập nhé</p>
            <div class="field">
                <label>Tên đăng nhập</label>
                <input type="text" id="username" placeholder="vd: hoc_sinh_gioi">
            </div>
            <div class="field">
                <label>Mật khẩu</label>
                <input type="password" id="password" placeholder="••••••••">
            </div>
            <div class="error-text" id="auth-error"></div>
            <button id="loginBtn">Đăng nhập</button>
            <p class="auth-switch">Chưa có tài khoản? <button class="link-btn" id="toggleRegister">Đăng ký ngay</button></p>
        </div>
    `;

    const errorEl = document.getElementById('auth-error');
    const loginBtn = document.getElementById('loginBtn');

    loginBtn.addEventListener('click', async () => {
        const rawUsername = document.getElementById('username').value.trim();
        const username = rawUsername.toLowerCase();
        const password = document.getElementById('password').value;
        errorEl.textContent = '';

        if (!username || !password) {
            errorEl.textContent = 'Vui lòng nhập đầy đủ tên đăng nhập và mật khẩu.';
            return;
        }

        loginBtn.disabled = true;
        loginBtn.textContent = 'Đang kiểm tra...';

        try {
            const snapshot = await db.ref('users').orderByChild('username').equalTo(username).once('value');
            if (snapshot.exists()) {
                const userId = Object.keys(snapshot.val())[0];
                const userData = Object.values(snapshot.val())[0];
                const hashedPassword = CryptoJS.SHA256(password).toString();

                if (userData.isBanned) {
                    errorEl.textContent = 'Tài khoản của bạn đã bị khóa.';
                    loginBtn.disabled = false;
                    loginBtn.textContent = 'Đăng nhập';
                    return;
                }

                if (userData.passwordHash === hashedPassword) {
                    localStorage.setItem('user', JSON.stringify({
                        userId: userId,
                        username: username,
                        displayName: userData.displayName || username,
                        avatarBorderId: userData.avatarBorderId || 'none',
                        chatFrameId: userData.chatFrameId || 'none',
                        chatTitleId: userData.chatTitleId || 'none',
                        avatarPresetId: userData.avatarPresetId || 'none',
                        avatarUrl: userData.avatarUrl || '',
                        points: userData.points !== undefined ? userData.points : 500,
                        streak: userData.streak || 1,
                        exp: userData.exp || 0,
                        dev: userData.dev !== undefined ? Number(userData.dev) : 0,
                        lastActiveDate: userData.lastActiveDate || '',
                        isMuted: userData.isMuted || false,
                        inventory: userData.inventory || { borders: ['none'], frames: ['none'], titles: ['none'], presets: ['none'] }
                    }));
                    showToast(`Chào mừng ${userData.displayName || username}!`);
                    initGlobalSync();
                    renderDashboard();
                } else {
                    errorEl.textContent = 'Sai mật khẩu, vui lòng thử lại.';
                }
            } else {
                errorEl.textContent = 'Tài khoản không tồn tại.';
            }
        } catch (err) {
            errorEl.textContent = 'Lỗi kết nối, vui lòng thử lại.';
        } finally {
            loginBtn.disabled = false;
            loginBtn.textContent = 'Đăng nhập';
        }
    });

    document.getElementById('toggleRegister').addEventListener('click', renderRegisterForm);
    slot.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') loginBtn.click(); });
    });
}

function renderRegisterForm() {
    const slot = document.getElementById('auth-slot');
    slot.innerHTML = `
        <div class="auth-container">
            <h2>Tạo tài khoản mới ✨</h2>
            <p class="auth-subtitle">Chỉ mất 30 giây để bắt đầu</p>
            <div class="field">
                <label>Họ và tên</label>
                <input type="text" id="displayName" placeholder="Nguyễn Văn A">
            </div>
            <div class="field">
                <label>Tên đăng nhập</label>
                <input type="text" id="username" placeholder="Không dấu, không khoảng trắng">
            </div>
            <div class="field">
                <label>Mật khẩu</label>
                <input type="password" id="password" placeholder="Tối thiểu 6 ký tự">
            </div>
            <div class="error-text" id="auth-error"></div>
            <button id="registerBtn">Đăng ký</button>
            <p class="auth-switch">Đã có tài khoản? <button class="link-btn" id="toggleLogin">Đăng nhập</button></p>
        </div>
    `;

    const errorEl = document.getElementById('auth-error');
    const registerBtn = document.getElementById('registerBtn');

    registerBtn.addEventListener('click', async () => {
        const displayName = document.getElementById('displayName').value.trim();
        const rawUsername = document.getElementById('username').value.trim();
        const username = rawUsername.toLowerCase();
        const password = document.getElementById('password').value;
        errorEl.textContent = '';

        if (!displayName || !username || !password) {
            errorEl.textContent = 'Vui lòng nhập đầy đủ thông tin.';
            return;
        }
        if (password.length < 6) {
            errorEl.textContent = 'Mật khẩu phải có ít nhất 6 ký tự.';
            return;
        }

        registerBtn.disabled = true;
        registerBtn.textContent = 'Đang tạo tài khoản...';

        try {
            const snapshot = await db.ref('users').orderByChild('username').equalTo(username).once('value');
            if (snapshot.exists()) {
                errorEl.textContent = 'Tên đăng nhập đã tồn tại, hãy chọn tên khác.';
                registerBtn.disabled = false;
                registerBtn.textContent = 'Đăng ký';
                return;
            }
            
            const hashedPassword = CryptoJS.SHA256(password).toString();
            const newUserRef = db.ref('users').push();
            const newUserId = newUserRef.key;
            
            await newUserRef.set({ 
                displayName, 
                username, 
                passwordHash: hashedPassword, 
                createdAt: Date.now(),
                avatarBorderId: 'none',
                chatFrameId: 'none',
                chatTitleId: 'none',
                avatarPresetId: 'none',
                avatarUrl: '',
                points: 500,
                exp: 0,
                streak: 1,
                dev: 0,
                lastActiveDate: '',
                isMuted: false,
                isBanned: false,
                bannedUntil: null,
                inventory: { borders: ['none'], frames: ['none'], titles: ['none'], presets: ['none'] }
            });

            showToast('Đăng ký thành công! Đang tự động đăng nhập...');
            
            // Auto Login sau khi đăng ký
            localStorage.setItem('user', JSON.stringify({
                userId: newUserId,
                username: username,
                displayName: displayName,
                avatarBorderId: 'none',
                chatFrameId: 'none',
                chatTitleId: 'none',
                avatarPresetId: 'none',
                avatarUrl: '',
                points: 500,
                streak: 1,
                exp: 0,
                dev: 0,
                lastActiveDate: '',
                isMuted: false,
                inventory: { borders: ['none'], frames: ['none'], titles: ['none'], presets: ['none'] }
            }));
            
            initGlobalSync();
            renderDashboard();

        } catch (err) {
            errorEl.textContent = 'Lỗi kết nối, vui lòng thử lại.';
            registerBtn.disabled = false;
            registerBtn.textContent = 'Đăng ký';
        }
    });

    document.getElementById('toggleLogin').addEventListener('click', renderLoginForm);
    slot.querySelectorAll('input').forEach(inp => {
        inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') registerBtn.click(); });
    });
}

/* ==========================================================================
   DASHBOARD SHELL
========================================================================== */

function renderDashboard() {
    const user = getCurrentUser();
    if (!user) return renderAuth();

    const borderConfig = getBorderById(user.avatarBorderId);
    const presetConfig = getPresetById(user.avatarPresetId);

    app.innerHTML = `
        <div class="dashboard-layout page-fade">
            <aside class="sidebar desktop-only">
                <div class="sidebar-brand"><span class="dot"></span><span>ExoticStudy</span></div>
                
                <div class="sidebar-menu">
                    <div class="menu-group-title">HỌC TẬP</div>
                    <button class="nav-item" data-page="public"><span class="icon">📢</span> Bài thi công khai</button>
                    <button class="nav-item" data-page="library"><span class="icon">📚</span> Thư viện của bạn</button>
                    <button class="nav-item" data-page="create"><span class="icon">✍️</span> Tạo bài thi</button>
                    <button class="nav-item" data-page="history"><span class="icon">🕐</span> Lịch sử</button>
                    
                    <div class="menu-group-title">CỘNG ĐỒNG</div>
                    <button class="nav-item" data-page="leaderboard"><span class="icon">🏆</span> Bảng Xếp Hạng</button>
                    <button class="nav-item" data-page="chat"><span class="icon">💬</span> Chat Tổng</button>
                    <button class="nav-item" data-page="shop"><span class="icon">🛒</span> Cửa Hàng</button>
                    
                    <div class="menu-group-title">CÀI ĐẶT</div>
                    <button class="nav-item" data-page="stats"><span class="icon">👤</span> Hồ sơ cá nhân</button>
                    <button class="nav-item" data-page="dev" style="display: ${Number(user.dev) === 1 ? 'flex' : 'none'}"><span class="icon">🛠️</span> Developer</button>
                </div>

                <div class="sidebar-footer">
                    <div class="compact-user-card">
                        <div class="user-info" id="sidebar-user-chip" style="cursor:pointer;" onclick="document.querySelector('[data-page=\\'stats\\']').click()">
                            ${renderAvatarWithBorderObj(user.displayName, borderConfig, 'sm', '', user.avatarUrl, presetConfig)}
                            <div class="name">${escapeHtml(user.displayName)}</div>
                        </div>
                        <button class="icon-btn-logout" id="logout" title="Đăng xuất">
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"></path><polyline points="16 17 21 12 16 7"></polyline><line x1="21" y1="12" x2="9" y2="12"></line></svg>
                        </button>
                    </div>
                </div>
            </aside>
            
            <main class="main-content" id="main-content"></main>

            <nav class="bottom-nav mobile-only">
                <button class="nav-item-mobile" data-page="public"><span class="icon">📢</span>Khám phá</button>
                <button class="nav-item-mobile" data-page="leaderboard"><span class="icon">🏆</span>Rank</button>
                <button class="nav-item-mobile" data-page="chat"><span class="icon">💬</span>Chat</button>
                <button class="nav-item-mobile" data-page="shop"><span class="icon">🛒</span>Shop</button>
                <button class="nav-item-mobile" data-page="stats"><span class="icon">👤</span>Hồ sơ</button>
                <button class="nav-item-mobile" data-page="dev" style="display: ${Number(user.dev) === 1 ? 'flex' : 'none'}"><span class="icon">🛠️</span>Dev</button>
            </nav>
        </div>
    `;

    document.getElementById('logout').addEventListener('click', () => {
        localStorage.removeItem('user');
        showToast('Đã đăng xuất');
        renderAuth();
    });

    document.querySelectorAll('.nav-item, .nav-item-mobile').forEach(btn => {
        btn.addEventListener('click', () => setActivePage(btn.dataset.page));
    });

    setActivePage('public');
}

function getMain() { return document.getElementById('main-content'); }

function fadeMain() {
    if (activeChatAddedListener) {
        db.ref('global_chat').off('child_added', activeChatAddedListener);
        activeChatAddedListener = null;
    }
    if (activeChatChangedListener) {
        db.ref('global_chat').off('child_changed', activeChatChangedListener);
        activeChatChangedListener = null;
    }
    if (activeLeaderboardListenerRef && activeLeaderboardListenerCb) {
        activeLeaderboardListenerRef.off('value', activeLeaderboardListenerCb);
        activeLeaderboardListenerRef = null;
        activeLeaderboardListenerCb = null;
    }
    if (activeOnlineCountListenerRef && activeOnlineCountListenerCb) {
        activeOnlineCountListenerRef.off('value', activeOnlineCountListenerCb);
        activeOnlineCountListenerRef = null;
        activeOnlineCountListenerCb = null;
    }

    const main = getMain();
    main.classList.remove('page-fade');
    void main.offsetWidth;
    main.classList.add('page-fade');
    main.style.paddingBottom = ''; // Reset padding if modified by sticky
    return main;
}

function setActivePage(page, opts = {}) {
    document.querySelectorAll('.nav-item, .nav-item-mobile').forEach(b => {
        b.classList.toggle('active', b.dataset.page === page);
    });
    const main = fadeMain();
    if (page === 'public') renderPublicExams(main);
    if (page === 'library') renderLibrary(main);
    if (page === 'create') renderCreateChoice(main, opts.editExamId || null);
    if (page === 'leaderboard') renderGlobalLeaderboard(main);
    if (page === 'chat') renderChat(main);
    if (page === 'stats') renderStats(main);
    if (page === 'shop') renderShop(main);
    if (page === 'history') renderHistory(main);
    if (page === 'dev') renderDeveloper(main);
}

/* ==========================================================================
   GLOBAL LEADERBOARD
========================================================================== */

let lbCurrentTab = 'level';

function renderGlobalLeaderboard(main) {
    const user = getCurrentUser();
    
    main.innerHTML = `
        <style>
            .lb-tabs { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; max-width: 100%; overflow-x: auto; white-space: nowrap; padding-bottom: 5px; scrollbar-width: none; -webkit-overflow-scrolling: touch; }
            .lb-tabs::-webkit-scrollbar { display: none; }
            .lb-tabs button { flex: 0 0 auto; white-space: nowrap; border-radius: var(--radius-sm); padding: 0.6rem 1rem; }
            .podium-container { display: flex; align-items: flex-end; justify-content: center; gap: 1rem; margin-top: 2rem; margin-bottom: 2.5rem; height: 220px; }
            .podium-item { display: flex; flex-direction: column; align-items: center; text-align: center; width: 30%; position: relative; animation: cardIn 0.5s var(--ease) backwards; }
            .podium-item.rank-1 { width: 36%; z-index: 3; animation-delay: 0.1s; }
            .podium-item.rank-2 { z-index: 2; animation-delay: 0.2s; }
            .podium-item.rank-3 { z-index: 1; animation-delay: 0.3s; }
            .podium-bar { width: 100%; border-top-left-radius: 8px; border-top-right-radius: 8px; display: flex; justify-content: center; font-weight: 800; font-size: 1.5rem; color: white; padding-top: 0.5rem; box-shadow: var(--shadow-sm); transition: height 0.4s var(--ease); }
            .rank-1 .podium-bar { height: 100px; background: linear-gradient(135deg, #fbbf24, #f59e0b); }
            .rank-2 .podium-bar { height: 75px; background: linear-gradient(135deg, #94a3b8, #64748b); }
            .rank-3 .podium-bar { height: 55px; background: linear-gradient(135deg, #d97706, #b45309); }
            .podium-avatar { position: relative; margin-bottom: -15px; z-index: 5; }
            .podium-badge { position: absolute; bottom: -5px; right: -5px; font-size: 1.5rem; z-index: 10; }
            .lb-list { display: flex; flex-direction: column; gap: 0.5rem; padding-bottom: 80px; }
            .lb-row { display: flex; align-items: center; background: var(--surface-soft); padding: 0.75rem 1rem; border-radius: var(--radius-sm); border: 1px solid var(--border); animation: cardIn 0.3s var(--ease) backwards; transition: transform 0.2s; }
            .lb-row:hover { transform: translateX(4px); border-color: var(--primary); }
            .lb-row.is-me { background: rgba(167, 139, 250, 0.15); border-color: var(--primary); }
            .lb-rank { width: 40px; font-weight: 800; color: var(--text-soft); font-size: 1.1rem; }
            .lb-info { flex: 1; display: flex; align-items: center; gap: 0.75rem; overflow: hidden; }
            .lb-score { font-weight: 800; font-size: 1.1rem; color: var(--primary-dark); text-align: right; }
            
            .sticky-user-rank { position: fixed; bottom: 0; left: 0; right: 0; background: var(--surface); padding: 1rem 1.5rem; box-shadow: 0 -4px 20px rgba(0,0,0,0.1); z-index: 2000; display: flex; justify-content: space-between; align-items: center; border-top: 2px solid var(--primary); animation: pageFadeIn 0.4s var(--ease); }
            @media (max-width: 760px) { .sticky-user-rank { bottom: 65px; padding: 0.75rem 1rem; } .podium-container { gap: 0.25rem; } .podium-bar { font-size: 1.2rem; } }
        </style>

        <div class="content-header">
            <div class="content-header-main">
                <h2>🏆 Bảng Xếp Hạng</h2>
                <p>Vinh danh những người dùng xuất sắc nhất hệ thống</p>
            </div>
        </div>

        <div class="lb-tabs">
           <button class="${lbCurrentTab === 'level' ? 'active' : 'btn-outline'}" data-tab="level">🏆 Top Cấp Độ</button>
           <button class="${lbCurrentTab === 'streak' ? 'active' : 'btn-outline'}" data-tab="streak">🔥 Top Chuỗi Học</button>
           <button class="${lbCurrentTab === 'points' ? 'active' : 'btn-outline'}" data-tab="points">💰 Top Điểm Thưởng</button>
        </div>
        
        <div id="lb-content"><div class="spinner"></div></div>
        <div id="lb-sticky-slot"></div>
    `;

    main.querySelectorAll('.lb-tabs button').forEach(btn => {
        btn.addEventListener('click', () => {
            lbCurrentTab = btn.dataset.tab;
            renderGlobalLeaderboard(main);
        });
    });

    loadLeaderboardData();

    function loadLeaderboardData() {
        const orderBy = (lbCurrentTab === 'streak') ? 'streak' : (lbCurrentTab === 'level' ? 'exp' : 'points');
        
        if (activeLeaderboardListenerRef && activeLeaderboardListenerCb) {
            activeLeaderboardListenerRef.off('value', activeLeaderboardListenerCb);
        }

        activeLeaderboardListenerRef = db.ref('users').orderByChild(orderBy).limitToLast(50);
        activeLeaderboardListenerCb = activeLeaderboardListenerRef.on('value', snap => {
            const data = snap.val() || {};
            let usersList = Object.keys(data).map(k => ({ uid: k, ...data[k] }));
            
            usersList.sort((a, b) => {
                const valA = a[orderBy] || 0;
                const valB = b[orderBy] || 0;
                return valB - valA;
            });

            renderLeaderboardUI(usersList, orderBy);
        });
    }

    function renderLeaderboardUI(usersList, orderBy) {
        const contentSlot = document.getElementById('lb-content');
        const stickySlot = document.getElementById('lb-sticky-slot');
        if (!contentSlot) return;

        const currentUser = getCurrentUser();
        let myRank = -1;
        let myData = null;

        usersList.forEach((u, idx) => {
            if (u.uid === currentUser.userId) {
                myRank = idx + 1;
                myData = u;
            }
        });

        if (myRank === -1) {
            db.ref(`users/${currentUser.userId}`).once('value').then(snap => {
                myData = snap.val();
                if(!myData) myData = { points: currentUser.points, streak: currentUser.streak || 1 };
                renderSticky(myRank, myData, orderBy);
            });
        } else {
            renderSticky(myRank, myData, orderBy);
        }

        if (usersList.length === 0) {
            contentSlot.innerHTML = `<div class="empty-state">Chưa có dữ liệu xếp hạng.</div>`;
            return;
        }

        const top3 = usersList.slice(0, 3);
        const rest = usersList.slice(3);

        let podiumHtml = '';
        if (top3.length > 0) {
            const p1 = top3[0];
            const p2 = top3.length > 1 ? top3[1] : null;
            const p3 = top3.length > 2 ? top3[2] : null;

            const renderPodiumItem = (u, rank) => {
                if (!u) return `<div class="podium-item rank-${rank}"></div>`;
                const borderObj = getBorderById(u.avatarBorderId);
                const presetObj = getPresetById(u.avatarPresetId);
                const titleObj = getTitleById(u.chatTitleId);
                const badge = rank === 1 ? '🥇' : (rank === 2 ? '🥈' : '🥉');
                
                let scoreText = '';
                if (lbCurrentTab === 'level') {
                    scoreText = `Lv.${Math.floor((u.exp || 0) / 100) + 1}`;
                } else if (lbCurrentTab === 'streak') {
                    scoreText = `${u.streak || 0} 🔥`;
                } else {
                    scoreText = `${u.points || 0} 💰`;
                }

                return `
                    <div class="podium-item rank-${rank}" style="cursor:pointer;" onclick="showPublicProfile('${u.uid}')">
                        <div class="podium-avatar">
                            ${renderAvatarWithBorderObj(u.displayName || u.username, borderObj, rank === 1 ? 'lg' : 'md', '', u.avatarUrl || '', presetObj)}
                            <div class="podium-badge">${badge}</div>
                        </div>
                        <div style="margin-top: 0.5rem; margin-bottom: 0.5rem; width: 100%; padding: 0 0.25rem;">
                            <div style="font-size: 0.8rem; font-weight: 700; color: var(--text-heading); white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(u.displayName || u.username)}</div>
                            <div style="transform: scale(0.8); transform-origin: top center; margin-top: 2px;">${getTitleHtml(titleObj)}</div>
                        </div>
                        <div class="podium-bar">${scoreText}</div>
                    </div>
                `;
            };

            podiumHtml = `
                <div class="podium-container">
                    ${renderPodiumItem(p2, 2)}
                    ${renderPodiumItem(p1, 1)}
                    ${renderPodiumItem(p3, 3)}
                </div>
            `;
        }

        let listHtml = '';
        if (rest.length > 0) {
            listHtml = `
                <div class="lb-list">
                    ${rest.map((u, i) => {
                        const rank = i + 4;
                        const isMe = u.uid === currentUser.userId;
                        const borderObj = getBorderById(u.avatarBorderId);
                        const presetObj = getPresetById(u.avatarPresetId);
                        const titleObj = getTitleById(u.chatTitleId);

                        let scoreText = '';
                        if (lbCurrentTab === 'level') {
                            scoreText = `Lv.${Math.floor((u.exp || 0) / 100) + 1} <span style="font-size:0.75em; color:var(--text-soft); font-weight:600;">(${u.exp || 0} exp)</span>`;
                        } else if (lbCurrentTab === 'streak') {
                            scoreText = `${u.streak || 0} 🔥`;
                        } else {
                            scoreText = `${u.points || 0} 💰`;
                        }

                        return `
                            <div class="lb-row ${isMe ? 'is-me' : ''}" style="animation-delay: ${i * 0.05}s; cursor:pointer;" onclick="showPublicProfile('${u.uid}')">
                                <div class="lb-rank">#${rank}</div>
                                <div class="lb-info">
                                    ${renderAvatarWithBorderObj(u.displayName || u.username, borderObj, 'sm', '', u.avatarUrl || '', presetObj)}
                                    <div style="display:flex; flex-direction:column; overflow:hidden;">
                                        <div style="font-weight:700; color:var(--text-heading); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(u.displayName || u.username)}</div>
                                        <div style="display:flex;">${getTitleHtml(titleObj)}</div>
                                    </div>
                                </div>
                                <div class="lb-score">${scoreText}</div>
                            </div>
                        `;
                    }).join('')}
                </div>
            `;
        }

        contentSlot.innerHTML = podiumHtml + listHtml;
    }

    function renderSticky(rank, myData, orderBy) {
        const stickySlot = document.getElementById('lb-sticky-slot');
        if (!stickySlot || !myData) return;

        const rankText = rank !== -1 ? `#${rank}` : '50+';
        
        let scoreText = '';
        let missingText = '';
        if (lbCurrentTab === 'level') {
            const lvl = Math.floor((myData.exp || 0) / 100) + 1;
            const expProgress = (myData.exp || 0) % 100;
            const needed = 100 - expProgress;
            scoreText = `Lv.${lvl}`;
            missingText = `Còn ${needed} exp lên Lv.${lvl + 1}`;
        } else if (lbCurrentTab === 'streak') {
            scoreText = `${myData.streak || 0} 🔥`;
            missingText = `Học đều đặn mỗi ngày!`;
        } else {
            scoreText = `${myData.points || 0} 💰`;
            missingText = `Tích cực làm bài để kiếm thêm điểm!`;
        }

        stickySlot.innerHTML = `
            <div class="sticky-user-rank">
                <div style="display:flex; align-items:center; gap: 1rem;">
                    <div style="font-size: 1.5rem; font-weight: 800; color: var(--primary-dark);">${rankText}</div>
                    <div style="display:flex; flex-direction:column;">
                        <span style="font-weight: 700; color: var(--text-heading);">Thứ hạng của bạn</span>
                        <span style="font-size: 0.75rem; color: var(--text-soft);">${missingText}</span>
                    </div>
                </div>
                <div style="font-size: 1.25rem; font-weight: 800; color: var(--primary);">${scoreText}</div>
            </div>
        `;

        const mainEl = document.getElementById('main-content');
        if(mainEl) mainEl.style.paddingBottom = '100px';
    }
}

/* ==========================================================================
   ITEM SHOP (NEW TAB)
========================================================================== */

let shopCurrentTab = 'avatars';

function renderShop(main) {
    const user = getCurrentUser();
    const inventory = user.inventory || { borders: ['none'], frames: ['none'], titles: ['none'], presets: ['none'] };
    
    function renderUI() {
        const borders = getAvatarBorders().filter(i => i.id !== 'none');
        const frames = getChatFrames().filter(i => i.id !== 'none');
        const titles = getChatTitles().filter(i => i.id !== 'none');
        const presets = getPresetAvatars().filter(i => i.id !== 'none');

        let displayItems = [];
        let groupKey = '';
        if (shopCurrentTab === 'avatars') { displayItems = presets; groupKey = 'presets'; }
        if (shopCurrentTab === 'borders') { displayItems = borders; groupKey = 'borders'; }
        if (shopCurrentTab === 'frames')  { displayItems = frames; groupKey = 'frames'; }
        if (shopCurrentTab === 'titles')  { displayItems = titles; groupKey = 'titles'; }

        main.innerHTML = `
            <div class="content-header">
                <div class="content-header-main" style="display:flex; justify-content:space-between; align-items:center; width:100%;">
                    <div>
                        <h2>🛒 Cửa Hàng Trang Bị</h2>
                        <p>Dùng điểm học tập để mua sắm vật phẩm</p>
                    </div>
                    <div class="shop-points-badge">
                        <span style="font-size:1.2rem;">💰</span> <span id="shop-pts-val">${user.points || 0}</span> điểm
                    </div>
                </div>
            </div>

            <div class="mode-toggle" style="margin-bottom: 1.5rem; width: 100%; display: flex; overflow-x: auto; white-space: nowrap; gap: 0.5rem; padding: 0.4rem; scrollbar-width: none; -webkit-overflow-scrolling: touch;">
               <button class="${shopCurrentTab === 'avatars' ? 'active' : ''}" data-tab="avatars" style="flex: 0 0 auto; border-radius: var(--radius-sm);">🖼️ Avatar (${presets.length})</button>
               <button class="${shopCurrentTab === 'borders' ? 'active' : ''}" data-tab="borders" style="flex: 0 0 auto; border-radius: var(--radius-sm);">🖼️ Viền (${borders.length})</button>
               <button class="${shopCurrentTab === 'frames' ? 'active' : ''}" data-tab="frames" style="flex: 0 0 auto; border-radius: var(--radius-sm);">💬 Khung Chat (${frames.length})</button>
               <button class="${shopCurrentTab === 'titles' ? 'active' : ''}" data-tab="titles" style="flex: 0 0 auto; border-radius: var(--radius-sm);">🎖️ Danh hiệu (${titles.length})</button>
            </div>
            
            <div class="${shopCurrentTab === 'frames' ? 'visual-picker-grid' : 'avatar-grid'}" id="shop-grid">
                ${displayItems.length === 0 ? `<div class="empty-state" style="grid-column:1/-1;">Chưa có vật phẩm nào được bày bán.</div>` : ''}
                ${displayItems.map((item, idx) => {
                    const price = item.price || 0;
                    const isOwned = price === 0 || (inventory[groupKey] && inventory[groupKey].includes(item.id));
                    
                    let previewContent = '';
                    if(shopCurrentTab === 'avatars') previewContent = renderAvatarWithBorderObj('A', {id:'none'}, 'lg', '', item.url, item);
                    if(shopCurrentTab === 'borders') previewContent = renderAvatarWithBorderObj('A', item, 'lg');
                    if(shopCurrentTab === 'frames') {
                        let styleBlock = '';
                        if (item.effectCode && !document.getElementById('frame-style-' + item.id)) {
                            styleBlock = `<style id="frame-style-${item.id}">${item.effectCode}</style>`;
                        }
                        previewContent = `${styleBlock}<div class="frame-${item.id}" style="font-size: 0.8rem; padding: 0.5rem 0.75rem; border-radius: 1rem; ${item.designCode ? item.designCode : 'background: var(--surface); color: var(--text-heading); border: 1px solid var(--border);'}">Xin chào! 👋</div>`;
                    }
                    if(shopCurrentTab === 'titles') previewContent = `<div style="display:flex; align-items:center;">${getTitleHtml(item)}<span style="font-size: 0.85rem; font-weight: 700; color: var(--text-heading);">Tên</span></div>`;

                    return `
                        <div class="picker-card" style="animation: cardIn 0.3s var(--ease) ${idx*0.05}s backwards; cursor:default; background:var(--surface);">
                            <div class="picker-preview" style="${shopCurrentTab === 'avatars' || shopCurrentTab === 'borders' ? 'height:100px;' : ''}">
                                ${previewContent}
                            </div>
                            <div class="picker-name" style="margin-bottom:0.5rem;">${escapeHtml(item.name)}</div>
                            ${isOwned 
                                ? `<button class="buy-btn" disabled>Đã sở hữu</button>` 
                                : `<button class="buy-btn btn-buy-action" data-id="${item.id}" data-price="${price}">Mua ngay (${price} pts)</button>`
                            }
                        </div>
                    `;
                }).join('')}
            </div>
        `;

        main.querySelectorAll('.mode-toggle button').forEach(btn => {
            btn.addEventListener('click', () => {
                shopCurrentTab = btn.dataset.tab;
                renderUI();
            });
        });

        main.querySelectorAll('.btn-buy-action').forEach(btn => {
            btn.addEventListener('click', async () => {
                const cost = Number(btn.dataset.price);
                const itemId = btn.dataset.id;

                if (user.points < cost) {
                    showToast('Không đủ điểm để mua vật phẩm này!', 'error');
                    return;
                }

                btn.disabled = true;
                btn.textContent = 'Đang mua...';

                try {
                    const newPoints = user.points - cost;
                    const newInventory = JSON.parse(JSON.stringify(user.inventory || { borders: ['none'], frames: ['none'], titles: ['none'], presets: ['none'] }));
                    
                    if(!newInventory[groupKey]) newInventory[groupKey] = ['none'];
                    if(!newInventory[groupKey].includes(itemId)) {
                        newInventory[groupKey].push(itemId);
                    }

                    await db.ref(`users/${user.userId}`).update({
                        points: newPoints,
                        inventory: newInventory
                    });

                    user.points = newPoints;
                    user.inventory = newInventory;
                    localStorage.setItem('user', JSON.stringify(user));
                    
                    showToast('Mua vật phẩm thành công!', 'success');
                    renderUI(); // Reload UI
                } catch(e) {
                    showToast('Có lỗi xảy ra, thử lại sau.', 'error');
                    btn.disabled = false;
                    btn.textContent = `Mua ngay (${cost} pts)`;
                }
            });
        });
    }

    renderUI();
}

/* ==========================================================================
   DEVELOPER TAB (DYNAMIC CUSTOMIZATION MANAGER WITH REALTIME FIREBASE)
========================================================================== */

let devCurrentTab = 'users';
let devSelBorderId = 'none';
let devSelFrameId = 'none';
let devSelTitleId = 'none';
let devSelPresetId = 'none';
let currentDevEdit = null;

function renderDeveloper(main) {
    function updatePreviewBox() {
        if (!currentDevEdit) return;
        
        if (devCurrentTab === 'borders') {
            const previewEl = document.getElementById('dev-preview-image');
            if (previewEl) {
                previewEl.style.transform = `translate(calc(-50% + ${currentDevEdit.offsetX}px), calc(-50% + ${currentDevEdit.offsetY}px)) scale(${currentDevEdit.scale / 100})`;
                previewEl.src = currentDevEdit.url || '';
                previewEl.style.display = (currentDevEdit.url && currentDevEdit.url !== 'none') ? 'block' : 'none';
            }
        } 
        else if (devCurrentTab === 'frames') {
            const box = document.getElementById('dev-preview-box');
            if (box) {
                box.style.backgroundImage = currentDevEdit.url ? `url('${escapeHtml(currentDevEdit.url)}')` : 'none';
                box.style.backgroundPosition = `${currentDevEdit.bgPosX}% ${currentDevEdit.bgPosY}%`;
                box.style.backgroundSize = `${currentDevEdit.bgSize}%`;
            }
        }
        else if (devCurrentTab === 'titles') {
            const box = document.getElementById('dev-preview-box');
            if (box) {
                box.innerHTML = getTitleHtml(currentDevEdit);
            }
        }
        else if (devCurrentTab === 'avatars') {
            const box = document.getElementById('dev-preview-box');
            if (box) {
                box.innerHTML = renderAvatarWithBorderObj('A', {id:'none'}, 'lg', '', currentDevEdit.url, currentDevEdit);
            }
        }
    }

    function renderUI() {
        const borders = getAvatarBorders();
        if (!borders.find(b => b.id === devSelBorderId)) devSelBorderId = 'none';
        
        const frames = getChatFrames();
        if (!frames.find(f => f.id === devSelFrameId)) devSelFrameId = 'none';
        
        const titles = getChatTitles();
        if (!titles.find(t => t.id === devSelTitleId)) devSelTitleId = 'none';

        const presets = getPresetAvatars();
        if (presets.length > 0 && devSelPresetId === 'none') devSelPresetId = presets[0].id;
        else if (!presets.find(p => p.id === devSelPresetId) && presets.length > 0) devSelPresetId = presets[0].id;

        let activeItem;
        if (devCurrentTab === 'borders') activeItem = borders.find(b => b.id === devSelBorderId);
        if (devCurrentTab === 'frames') activeItem = frames.find(f => f.id === devSelFrameId);
        if (devCurrentTab === 'titles') activeItem = titles.find(t => t.id === devSelTitleId);
        if (devCurrentTab === 'avatars') activeItem = presets.find(p => p.id === devSelPresetId) || { id: 'dummy', name: 'Chưa có', url: '', offsetX: 0, offsetY: 0, scale: 100, price: 0 };

        if (!currentDevEdit || (activeItem && currentDevEdit.id !== activeItem.id)) {
            currentDevEdit = JSON.parse(JSON.stringify(activeItem || {}));
        }

        main.innerHTML = `
            <div class="content-header">
                <div class="content-header-main">
                    <h2>🛠️ Developer Manager</h2>
                    <p>Quản trị hệ thống, người dùng và cài đặt (Đồng bộ Realtime Firebase)</p>
                </div>
            </div>

            <div class="mode-toggle" style="margin-bottom: 1.5rem; width: 100%; display: flex; flex-wrap: wrap; gap: 0.5rem;">
               <button class="${devCurrentTab === 'users' ? 'active' : ''}" data-tab="users" style="flex:1; border-radius: var(--radius-sm); min-width: 120px;">👤 Người Dùng</button>
               <button class="${devCurrentTab === 'broadcast' ? 'active' : ''}" data-tab="broadcast" style="flex:1; border-radius: var(--radius-sm); min-width: 120px;">📢 Thông Báo</button>
               <button class="${devCurrentTab === 'avatars' ? 'active' : ''}" data-tab="avatars" style="flex:1; border-radius: var(--radius-sm); min-width: 120px;">🖼️ Avatar</button>
               <button class="${devCurrentTab === 'borders' ? 'active' : ''}" data-tab="borders" style="flex:1; border-radius: var(--radius-sm); min-width: 120px;">🖼️ Viền</button>
               <button class="${devCurrentTab === 'frames' ? 'active' : ''}" data-tab="frames" style="flex:1; border-radius: var(--radius-sm); min-width: 120px;">💬 Khung</button>
               <button class="${devCurrentTab === 'titles' ? 'active' : ''}" data-tab="titles" style="flex:1; border-radius: var(--radius-sm); min-width: 120px;">🎖️ Danh hiệu</button>
            </div>
            
            <div id="dev-workspace"></div>
        `;

        main.querySelectorAll('.mode-toggle button').forEach(btn => {
            btn.addEventListener('click', () => {
                devCurrentTab = btn.dataset.tab;
                currentDevEdit = null; 
                renderUI();
            });
        });

        const workspace = document.getElementById('dev-workspace');
        
        if (devCurrentTab === 'users') {
            workspace.innerHTML = `<div class="spinner"></div>`;
            db.ref('users').once('value').then(snap => {
                const usersData = snap.val() || {};
                const usersList = Object.keys(usersData).map(k => ({uid: k, ...usersData[k]}));
                
                workspace.innerHTML = `
                    <div class="form-card" style="overflow-x: auto; padding: 1.5rem;">
                        <h3 style="margin-top: 0; margin-bottom: 1rem;">Quản lý Người Dùng (${usersList.length})</h3>
                        <table class="leaderboard" style="min-width: 600px; margin-top: 0;">
                            <thead>
                                <tr>
                                    <th>Username</th>
                                    <th>Tên hiển thị</th>
                                    <th>Điểm</th>
                                    <th>Trạng thái</th>
                                    <th>Thao tác</th>
                                </tr>
                            </thead>
                            <tbody>
                                ${usersList.map(u => `
                                    <tr>
                                        <td>${escapeHtml(u.username)}</td>
                                        <td>${escapeHtml(u.displayName || u.username)}</td>
                                        <td><strong style="color: #d97706;">${u.points !== undefined ? u.points : 500}</strong></td>
                                        <td>
                                            ${u.isBanned ? '<span class="badge peach">Khóa</span>' : (u.isMuted ? '<span class="badge" style="background:#fef3c7;color:#b45309;">Mute</span>' : '<span class="badge mint">Bình thường</span>')}
                                        </td>
                                        <td><button class="btn-outline mng-user-btn" data-uid="${u.uid}" style="padding: 0.35rem 0.75rem; font-size: 0.8rem;">Sửa</button></td>
                                    </tr>
                                `).join('')}
                            </tbody>
                        </table>
                    </div>
                `;

                workspace.querySelectorAll('.mng-user-btn').forEach(btn => {
                    btn.addEventListener('click', () => {
                        const targetUid = btn.dataset.uid;
                        const uInfo = usersList.find(x => x.uid === targetUid);
                        showManageUserModal(targetUid, uInfo);
                    });
                });
            });

            function showManageUserModal(targetUid, uInfo) {
                const backdrop = document.createElement('div');
                backdrop.className = 'modal-backdrop';
                backdrop.style.zIndex = '5000';
                backdrop.innerHTML = `
                    <div class="modal-box" style="max-width: 450px;">
                        <h3 style="margin-top:0; margin-bottom: 1rem;">Quản lý: ${escapeHtml(uInfo.username)}</h3>
                        <div class="field" style="margin-bottom: 1rem;">
                            <label>Cộng/Trừ Điểm (Points)</label>
                            <input type="number" id="mng-points" value="${uInfo.points !== undefined ? uInfo.points : 500}">
                        </div>
                        <div class="field" style="margin-bottom: 1rem;">
                            <label>Chuỗi ngày (Streak)</label>
                            <input type="number" id="mng-streak" value="${uInfo.streak || 1}">
                        </div>
                        <div style="display: flex; gap: 1rem; margin-bottom: 1rem; padding: 0.75rem; background: var(--surface-soft); border-radius: var(--radius-sm); border: 1px dashed var(--border);">
                            <label style="display:flex; align-items:center; gap:0.5rem; font-weight:600; font-size:0.9rem; cursor: pointer;">
                                <input type="checkbox" id="mng-mute" ${uInfo.isMuted ? 'checked' : ''} style="width: auto;"> Cấm Chat (Mute)
                            </label>
                            <label style="display:flex; align-items:center; gap:0.5rem; font-weight:600; font-size:0.9rem; color: #ef4444; cursor: pointer;">
                                <input type="checkbox" id="mng-ban" ${uInfo.isBanned ? 'checked' : ''} style="width: auto;"> Khóa Tài Khoản
                            </label>
                        </div>
                        
                        <div class="field" style="margin-bottom: 1rem; padding: 0.75rem; background: #fff1f2; border-radius: var(--radius-sm); border: 1px dashed #fca5a5;">
                            <label style="color: #ef4444; font-weight: bold;">🔑 Đặt lại mật khẩu (Tùy chọn)</label>
                            <input type="text" id="mng-new-password" placeholder="Nhập mật khẩu mới nếu muốn đổi..." style="border-color: #fca5a5;">
                            <span style="font-size: 0.75rem; color: #ef4444;">* Bỏ trống nếu không muốn đổi mật khẩu. User sẽ dùng pass này để đăng nhập.</span>
                        </div>

                        <div style="margin-bottom: 1.5rem;">
                            <button id="mng-reset-info" class="btn-ghost" style="color: #ef4444; border: 1.5px dashed #ef4444; width: 100%;">🔄 Đặt lại Avatar/Tên/Danh hiệu về mặc định</button>
                        </div>
                        <div class="modal-actions">
                            <button class="btn-outline" id="mng-cancel">Hủy</button>
                            <button id="mng-save">Lưu thay đổi</button>
                        </div>
                    </div>
                `;
                document.body.appendChild(backdrop);
                
                backdrop.querySelector('#mng-cancel').addEventListener('click', () => backdrop.remove());
                
                let resetTriggered = false;
                const resetBtn = backdrop.querySelector('#mng-reset-info');
                resetBtn.addEventListener('click', () => {
                    resetTriggered = true;
                    resetBtn.textContent = '✔️ Sẽ đặt lại khi Lưu';
                    resetBtn.style.background = '#fee2e2';
                });

                backdrop.querySelector('#mng-save').addEventListener('click', async () => {
                    if (!(await checkDevPermission())) return;
                    const saveBtn = backdrop.querySelector('#mng-save');
                    saveBtn.disabled = true;
                    saveBtn.textContent = 'Đang lưu...';

                    const newPoints = parseInt(backdrop.querySelector('#mng-points').value) || 0;
                    const newStreak = parseInt(backdrop.querySelector('#mng-streak').value) || 1;
                    const isMuted = backdrop.querySelector('#mng-mute').checked;
                    const isBanned = backdrop.querySelector('#mng-ban').checked;
                    const adminResetPw = backdrop.querySelector('#mng-new-password').value.trim();

                    if (adminResetPw && adminResetPw.length < 6) {
                        showToast('Mật khẩu mới phải từ 6 ký tự trở lên!', 'error');
                        saveBtn.disabled = false;
                        saveBtn.textContent = 'Lưu thay đổi';
                        return;
                    }

                    const updates = {
                        points: newPoints,
                        streak: newStreak,
                        isMuted: isMuted,
                        isBanned: isBanned
                    };

                    if (adminResetPw) {
                        updates.passwordHash = CryptoJS.SHA256(adminResetPw).toString();
                    }

                    if (resetTriggered) {
                        updates.displayName = uInfo.username;
                        updates.avatarUrl = '';
                        updates.avatarPresetId = 'none';
                        updates.avatarBorderId = 'none';
                        updates.chatFrameId = 'none';
                        updates.chatTitleId = 'none';
                    }

                    try {
                        await db.ref(`users/${targetUid}`).update(updates);
                        showToast('Cập nhật người dùng thành công!');
                        backdrop.remove();
                        document.querySelector('[data-tab="users"]').click();
                    } catch (e) {
                        showToast('Lỗi cập nhật', 'error');
                        saveBtn.disabled = false;
                        saveBtn.textContent = 'Lưu thay đổi';
                    }
                });
            }
            
        } else if (devCurrentTab === 'broadcast') {
            workspace.innerHTML = `
                <div class="form-card dev-editor-inputs">
                    <h3 style="margin-top:0;">📢 Gửi thông báo toàn hệ thống</h3>
                    <p style="color:var(--text-soft); font-size:0.9rem; margin-bottom:1rem;">Thông báo sẽ hiển thị dưới dạng Banner nổi bật cho tất cả người dùng đang online.</p>
                    <textarea id="broadcast-msg" rows="4" placeholder="Nhập nội dung thông báo... (Hỗ trợ text thông thường)" style="width:100%; border-color:var(--border); font-family: inherit; font-size: 0.95rem;"></textarea>
                    <button id="send-broadcast-btn" style="margin-top: 1rem; width:100%; padding: 1rem;">Phát thông báo ngay</button>
                </div>
            `;

            workspace.querySelector('#send-broadcast-btn').addEventListener('click', async () => {
                if (!(await checkDevPermission())) return;
                const text = workspace.querySelector('#broadcast-msg').value.trim();
                if (!text) {
                    showToast('Vui lòng nhập nội dung!', 'error');
                    return;
                }
                const btn = workspace.querySelector('#send-broadcast-btn');
                btn.disabled = true;
                btn.textContent = 'Đang phát...';
                try {
                    await db.ref('app_settings/broadcast').set({
                        message: text,
                        timestamp: firebase.database.ServerValue.TIMESTAMP
                    });
                    showToast('Đã phát thông báo thành công!');
                    workspace.querySelector('#broadcast-msg').value = '';
                } catch(e) {
                    showToast('Lỗi phát thông báo', 'error');
                } finally {
                    btn.disabled = false;
                    btn.textContent = 'Phát thông báo ngay';
                }
            });
            
        } else if (devCurrentTab === 'borders') {
            workspace.innerHTML = `
                <div class="dev-editor-layout">
                    <div class="form-card dev-editor-inputs" style="max-height: 600px; overflow-y: auto;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3 style="margin: 0;">Danh sách Viền</h3>
                            <button id="dev-add-btn" class="btn-outline" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">+ Thêm mới</button>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            ${borders.map((item) => `
                                <div class="dev-item ${item.id === devSelBorderId ? 'active' : ''}" data-id="${item.id}" style="padding: 0.75rem; border: 1.5px solid ${item.id === devSelBorderId ? 'var(--primary)' : 'var(--border)'}; border-radius: var(--radius-sm); cursor: pointer; display: flex; align-items: center; gap: 0.5rem; background: ${item.id === devSelBorderId ? 'rgba(167, 139, 250, 0.1)' : 'var(--surface)'}; font-weight: 600;">
                                    <div class="icon-slot" style="width:24px; height:24px; flex-shrink:0;">
                                        ${item.url ? `<img src="${escapeHtml(item.url)}" style="width: 100%; height: 100%; object-fit: contain;" />` : `<div style="width:100%; height:100%; text-align:center; opacity:0.5;">🚫</div>`}
                                    </div>
                                    <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(item.name)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="form-card dev-editor-inputs">
                        ${devSelBorderId === 'none' ? `
                            <div class="empty-state">Không thể chỉnh sửa viền Mặc định. Vui lòng chọn hoặc tạo viền khác.</div>
                        ` : `
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                <h3 style="margin: 0;">Tùy chỉnh: ${escapeHtml(currentDevEdit.name)}</h3>
                                <button id="dev-delete-btn" class="btn-ghost" style="color: #ef4444; padding: 0.3rem 0.6rem; font-size: 0.85rem;">🗑️ Xóa viền</button>
                            </div>
                            
                            <div class="dev-editor-layout">
                                <div class="dev-editor-inputs">
                                    <div class="field" style="margin-bottom: 1rem;">
                                        <label>Tên Viền</label>
                                        <input type="text" id="dev-name" value="${escapeHtml(currentDevEdit.name)}">
                                    </div>
                                    <div class="field" style="margin-bottom: 1rem;">
                                        <label>Link Ảnh (PNG URL)</label>
                                        <input type="text" id="dev-url" value="${escapeHtml(currentDevEdit.url)}" placeholder="https://...">
                                    </div>
                                    <div class="field" style="margin-bottom: 1rem;">
                                        <label>Giá bán (Điểm Shop)</label>
                                        <input type="number" id="dev-price" value="${currentDevEdit.price || 0}" min="0">
                                    </div>
                                    <div class="field" style="margin-bottom: 1rem;">
                                        <label style="display:flex; justify-content:space-between;"><span>Tọa độ X (Ngang)</span><span id="val-x" style="color:var(--primary-dark);">${currentDevEdit.offsetX}px</span></label>
                                        <input type="range" id="dev-x" min="-50" max="50" value="${currentDevEdit.offsetX}" style="width: 100%;">
                                    </div>
                                    <div class="field" style="margin-bottom: 1rem;">
                                        <label style="display:flex; justify-content:space-between;"><span>Tọa độ Y (Dọc)</span><span id="val-y" style="color:var(--primary-dark);">${currentDevEdit.offsetY}px</span></label>
                                        <input type="range" id="dev-y" min="-50" max="50" value="${currentDevEdit.offsetY}" style="width: 100%;">
                                    </div>
                                    <div class="field" style="margin-bottom: 1rem;">
                                        <label style="display:flex; justify-content:space-between;"><span>Kích thước (Scale %)</span><span id="val-scale" style="color:var(--primary-dark);">${currentDevEdit.scale}%</span></label>
                                        <input type="range" id="dev-scale" min="50" max="300" value="${currentDevEdit.scale}" style="width: 100%;">
                                    </div>

                                <div class="dev-editor-preview">
                                    <span style="font-size: 0.85rem; color: var(--text-soft); font-weight: 600; margin-bottom: 1.5rem;">Xem trước trực tiếp</span>
                                    ${renderAvatarWithBorderObj('A', currentDevEdit, 'lg', 'dev-preview-image')}
                                </div>
                            </div>
                            <button id="dev-save-btn" style="width: 100%; margin-top: 1.5rem; padding: 1rem;">💾 Cập nhật lên Firebase</button>
                        `}
                    </div>
                </div>
            `;

            workspace.querySelectorAll('.dev-item').forEach(item => {
                item.addEventListener('click', () => { 
                    devSelBorderId = item.dataset.id; 
                    currentDevEdit = null; 
                    renderUI(); 
                });
            });

            workspace.querySelector('#dev-add-btn').addEventListener('click', async () => {
                const btn = workspace.querySelector('#dev-add-btn');
                btn.disabled = true; btn.textContent = '...';
                try {
                    const newRef = await db.ref('app_borders').push({
                        name: 'Viền Mới ' + Math.floor(Math.random()*100), url: '', offsetX: 0, offsetY: 0, scale: 125, price: 0
                    });
                    devSelBorderId = newRef.key;
                    showToast('Đã thêm Viền mới lên Firebase');
                } catch(e) { showToast('Lỗi khi thêm', 'error'); }
            });

            if (devSelBorderId !== 'none') {
                workspace.querySelector('#dev-delete-btn').addEventListener('click', () => {
                    showConfirmModal({
                        title: 'Xóa?', message: 'Hành động này sẽ Xóa viền trên toàn hệ thống và Reset người dùng đang trang bị.', confirmText: 'Xóa ngay',
                        onConfirm: async () => {
                            try {
                                await db.ref(`app_borders/${devSelBorderId}`).remove();
                                const usersSnap = await db.ref('users').once('value');
                                const users = usersSnap.val() || {};
                                for (const uid in users) {
                                    if (users[uid].avatarBorderId === devSelBorderId) {
                                        await db.ref(`users/${uid}`).update({ avatarBorderId: 'none' });
                                    }
                                }
                                devSelBorderId = 'none';
                                showToast('Đã xóa Viền khỏi hệ thống');
                            } catch(e) { showToast('Lỗi xóa', 'error'); }
                        }
                    });
                });

                workspace.querySelector('#dev-name').addEventListener('input', e => { currentDevEdit.name = e.target.value; });
                workspace.querySelector('#dev-url').addEventListener('input', e => { currentDevEdit.url = e.target.value; updatePreviewBox(); });
                workspace.querySelector('#dev-price').addEventListener('input', e => { currentDevEdit.price = Number(e.target.value); });
                workspace.querySelector('#dev-x').addEventListener('input', e => { currentDevEdit.offsetX = Number(e.target.value); document.getElementById('val-x').textContent = e.target.value+'px'; updatePreviewBox(); });
                workspace.querySelector('#dev-y').addEventListener('input', e => { currentDevEdit.offsetY = Number(e.target.value); document.getElementById('val-y').textContent = e.target.value+'px'; updatePreviewBox(); });
                workspace.querySelector('#dev-scale').addEventListener('input', e => { currentDevEdit.scale = Number(e.target.value); document.getElementById('val-scale').textContent = e.target.value+'%'; updatePreviewBox(); });

                workspace.querySelector('#dev-save-btn').addEventListener('click', async () => {
                    if (!(await checkDevPermission())) return;
                    const btn = workspace.querySelector('#dev-save-btn');
                    btn.disabled = true; btn.textContent = 'Đang lưu...';
                    try {
                        const { id, ...dataToSave } = currentDevEdit;
                        await db.ref(`app_borders/${id}`).update(dataToSave);
                        showToast('Đã đồng bộ lên Firebase!');
                    } catch(e) { showToast('Lỗi đồng bộ', 'error'); }
                    finally { btn.disabled = false; btn.textContent = '💾 Cập nhật lên Firebase'; }
                });
            }

        } else if (devCurrentTab === 'frames') {
            workspace.innerHTML = `
                <div class="dev-editor-layout">
                    <div class="form-card dev-editor-inputs" style="max-height: 600px; overflow-y: auto;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3 style="margin: 0;">Danh sách Khung</h3>
                            <button id="dev-add-btn" class="btn-outline" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">+ Thêm mới</button>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            ${frames.map((item) => `
                                <div class="dev-item ${item.id === devSelFrameId ? 'active' : ''}" data-id="${item.id}" style="padding: 0.75rem; border: 1.5px solid ${item.id === devSelFrameId ? 'var(--primary)' : 'var(--border)'}; border-radius: var(--radius-sm); cursor: pointer; display: flex; align-items: center; gap: 0.5rem; background: ${item.id === devSelFrameId ? 'rgba(167, 139, 250, 0.1)' : 'var(--surface)'}; font-weight: 600;">
                                    <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(item.name)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="form-card dev-editor-inputs">
                        ${devSelFrameId === 'none' ? `
                            <div class="empty-state">Không thể chỉnh sửa khung Mặc định.</div>
                        ` : `
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                <h3 style="margin: 0;">Tùy chỉnh: ${escapeHtml(currentDevEdit.name)}</h3>
                                <button id="dev-delete-btn" class="btn-ghost" style="color: #ef4444; padding: 0.3rem 0.6rem; font-size: 0.85rem;">🗑️ Xóa khung</button>
                            </div>
                            
                            <div class="dev-editor-layout">
                                <div class="dev-editor-inputs">
                                    <div class="field" style="margin-bottom: 1rem;">
                                        <label>Tên Khung</label>
                                        <input type="text" id="dev-name" value="${escapeHtml(currentDevEdit.name)}">
                                    </div>
                                    <div class="field" style="margin-bottom: 1rem;">
                                        <label>Giá bán (Điểm Shop)</label>
                                        <input type="number" id="dev-price" value="${currentDevEdit.price || 0}" min="0">
                                    </div>
                                    <div class="field" style="margin-bottom: 1rem;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                            <label style="margin: 0;">CSS Thiết kế tĩnh (Dùng cho bản thân khung chat)</label>
                                            <button class="btn-ghost copy-prompt-design" style="padding: 0.2rem 0.5rem; font-size: 0.7rem; border: 1px solid var(--border); border-radius: 4px; box-shadow: var(--shadow-sm); color: var(--primary-dark);">🤖 Copy Prompt AI</button>
                                        </div>
                                        <textarea id="dev-design" rows="4" placeholder="VD: background: linear-gradient(to right, #ff7e5f, #feb47b); color: white; border: 2px solid #fff; position: relative; overflow: hidden;" style="font-family: monospace; font-size: 0.85rem; padding: 10px;">${currentDevEdit.designCode || ''}</textarea>
                                    </div>
                                    <div class="field" style="margin-bottom: 1rem;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                            <label style="margin: 0;">CSS Hiệu ứng động (Keyframes / Pseudo-elements)</label>
                                            <button class="btn-ghost copy-prompt-effect" style="padding: 0.2rem 0.5rem; font-size: 0.7rem; border: 1px solid var(--border); border-radius: 4px; box-shadow: var(--shadow-sm); color: var(--primary-dark);">🤖 Copy Prompt AI</button>
                                        </div>
                                        <textarea id="dev-effect" rows="6" placeholder="VD: .frame-${currentDevEdit.id} { animation: pulse 2s infinite; }" style="font-family: monospace; font-size: 0.85rem; padding: 10px;">${currentDevEdit.effectCode || ''}</textarea>
                                        <span style="font-size:0.75rem; color:var(--text-soft); margin-top:4px;">* Dùng class <strong>.frame-${currentDevEdit.id}</strong> để tạo animation cho khung.</span>
                                    </div>
                                </div>

                                <div class="dev-editor-preview">
                                    <span style="font-size: 0.85rem; color: var(--text-soft); font-weight: 600; margin-bottom: 1.5rem;">Xem trước trực tiếp</span>
                                    <div id="dev-preview-box" class="frame-${currentDevEdit.id}" style="font-size: 0.95rem; padding: 0.65rem 1rem; border-radius: 1.25rem; max-width: 100%; word-wrap: break-word; box-shadow: var(--shadow-sm); border-bottom-right-radius: 4px; ${currentDevEdit.designCode || 'background: var(--surface); border: 1px solid var(--border);'}">
                                        Xin chào! Đây là tin nhắn thử nghiệm... 👋
                                    </div>
                                </div>
                            </div>
                            <button id="dev-save-btn" style="width: 100%; margin-top: 1.5rem; padding: 1rem;">💾 Cập nhật lên Firebase</button>
                        `}
                    </div>
                </div>
            `;

            workspace.querySelectorAll('.dev-item').forEach(item => {
                item.addEventListener('click', () => { devSelFrameId = item.dataset.id; currentDevEdit = null; renderUI(); });
            });

            workspace.querySelector('#dev-add-btn').addEventListener('click', async () => {
                if (!(await checkDevPermission())) return;
                const btn = workspace.querySelector('#dev-add-btn');
                btn.disabled = true; btn.textContent = '...';
                try {
                    const newIdRef = db.ref('app_chat_bubbles').push();
                    await newIdRef.set({
                        name: 'Khung Code Mới', designCode: 'background: linear-gradient(135deg, #3b82f6, #8b5cf6); color: white; border: 2px solid #60a5fa;', effectCode: '', price: 0
                    });
                    devSelFrameId = newIdRef.key;
                    showToast('Đã tạo template Khung mới lên Firebase');
                } catch(e) { showToast('Lỗi khi thêm', 'error'); }
            });

            if (devSelFrameId !== 'none') {
                workspace.querySelector('#dev-delete-btn').addEventListener('click', async () => {
                    if (!(await checkDevPermission())) return;
                    showConfirmModal({ title: 'Xóa?', message: 'Chắc chắn muốn xóa Khung Chat này?', confirmText: 'Xóa ngay', onConfirm: async () => {
                        try {
                            await db.ref(`app_chat_bubbles/${devSelFrameId}`).remove();
                            const usersSnap = await db.ref('users').once('value');
                            const users = usersSnap.val() || {};
                            for (const uid in users) {
                                if (users[uid].chatFrameId === devSelFrameId) {
                                    await db.ref(`users/${uid}`).update({ chatFrameId: 'none' });
                                }
                            }
                            devSelFrameId = 'none';
                            showToast('Đã xóa Khung khỏi hệ thống');
                        } catch(e) { showToast('Lỗi xóa', 'error'); }
                    }});
                });

                const refreshPreview = () => {
                    const box = document.getElementById('dev-preview-box');
                    box.style.cssText = `font-size: 0.95rem; padding: 0.65rem 1rem; border-radius: 1.25rem; max-width: 100%; word-wrap: break-word; box-shadow: var(--shadow-sm); border-bottom-right-radius: 4px; ${currentDevEdit.designCode || ''}`;
                    
                    let styleTag = document.getElementById('dev-preview-style');
                    if (!styleTag) {
                        styleTag = document.createElement('style');
                        styleTag.id = 'dev-preview-style';
                        document.head.appendChild(styleTag);
                    }
                    styleTag.textContent = currentDevEdit.effectCode || '';
                };

                workspace.querySelector('#dev-name').addEventListener('input', e => { currentDevEdit.name = e.target.value; });
                workspace.querySelector('#dev-price').addEventListener('input', e => { currentDevEdit.price = Number(e.target.value); });
                workspace.querySelector('#dev-design').addEventListener('input', e => { currentDevEdit.designCode = e.target.value; refreshPreview(); });
                workspace.querySelector('#dev-effect').addEventListener('input', e => { currentDevEdit.effectCode = e.target.value; refreshPreview(); });

                const copyDesignBtn = workspace.querySelector('.copy-prompt-design');
                if (copyDesignBtn) {
                    copyDesignBtn.addEventListener('click', () => {
                        const promptText = "Hãy viết CSS inline (chỉ các thuộc tính CSS, ngăn cách bởi dấu chấm phẩy) để trang trí cho một thẻ DIV chat bubble. Tôi muốn một phong cách Cyberpunk. Yêu cầu: Nền gradient tối màu chuyển từ tím sang xanh dương đen. Chữ màu trắng sáng. Viền màu xanh dương sáng 1px. Bo tròn góc mượt mà. Không cần viết class hay selector, chỉ viết chuỗi style nội tuyến (inline CSS).";
                        navigator.clipboard.writeText(promptText).then(() => showToast('Đã copy Prompt Thiết kế!'));
                    });
                }

                const copyEffectBtn = workspace.querySelector('.copy-prompt-effect');
                if (copyEffectBtn) {
                    copyEffectBtn.addEventListener('click', () => {
                        const promptText = `Tôi có một thẻ Div chat bubble mang class .frame-${currentDevEdit.id}. Thẻ này đã được set position: relative và overflow: hidden ở inline CSS. Hãy viết một đoạn mã CSS <style> để tạo hiệu ứng:\n1. Viền sáng lướt quanh khung chat liên tục (dùng pseudo-element ::before hoặc ::after kết hợp với animation dạng conic-gradient xoay vòng).\n2. Có một chút ánh sáng (glow/box-shadow) màu Neon bên ngoài khung đập nhịp nhàng (pulse).\nHãy code tối ưu, sử dụng keyframes và selector chuẩn xác nhắm vào class .frame-${currentDevEdit.id}.`;
                        navigator.clipboard.writeText(promptText).then(() => showToast('Đã copy Prompt Hiệu ứng!'));
                    });
                }

                workspace.querySelector('#dev-save-btn').addEventListener('click', async () => {
                    if (!(await checkDevPermission())) return;
                    const btn = workspace.querySelector('#dev-save-btn');
                    btn.disabled = true; btn.textContent = 'Đang lưu...';
                    try {
                        const { id, ...dataToSave } = currentDevEdit;
                        await db.ref(`app_chat_bubbles/${id}`).update(dataToSave);
                        showToast('Đã đồng bộ code lên Firebase!');
                    } catch(e) { showToast('Lỗi đồng bộ', 'error'); }
                    finally { btn.disabled = false; btn.textContent = '💾 Cập nhật lên Firebase'; }
                });
            }

        } else if (devCurrentTab === 'titles') {
            workspace.innerHTML = `
                <div class="dev-editor-layout">
                    <div class="form-card dev-editor-inputs" style="max-height: 600px; overflow-y: auto;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3 style="margin: 0;">Danh sách Danh Hiệu</h3>
                            <button id="dev-add-btn" class="btn-outline" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">+ Thêm mới</button>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            ${titles.map((item) => `
                                <div class="dev-item ${item.id === devSelTitleId ? 'active' : ''}" data-id="${item.id}" style="padding: 0.75rem; border: 1.5px solid ${item.id === devSelTitleId ? 'var(--primary)' : 'var(--border)'}; border-radius: var(--radius-sm); cursor: pointer; display: flex; align-items: center; gap: 0.5rem; background: ${item.id === devSelTitleId ? 'rgba(167, 139, 250, 0.1)' : 'var(--surface)'}; font-weight: 600;">
                                    <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(item.name)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="form-card dev-editor-inputs">
                        ${devSelTitleId === 'none' ? `
                            <div class="empty-state">Không thể chỉnh sửa Mặc định.</div>
                        ` : `
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                <h3 style="margin: 0;">Tùy chỉnh: ${escapeHtml(currentDevEdit.name)}</h3>
                                <button id="dev-delete-btn" class="btn-ghost" style="color: #ef4444; padding: 0.3rem 0.6rem; font-size: 0.85rem;">🗑️ Xóa danh hiệu</button>
                            </div>
                            
                            <div class="dev-editor-layout">
                                <div class="dev-editor-inputs">
                                    <div class="field" style="margin-bottom: 1rem;">
                                        <label>Tên Quản lý (Không hiện trong Chat)</label>
                                        <input type="text" id="dev-name" value="${escapeHtml(currentDevEdit.name)}">
                                    </div>
                                    <div class="field" style="margin-bottom: 1rem;">
                                        <label>Kiểu hiển thị</label>
                                        <select id="dev-type">
                                            <option value="image_text" ${currentDevEdit.type === 'image_text' ? 'selected' : ''}>Hình ảnh + Chữ</option>
                                            <option value="text_bg" ${currentDevEdit.type === 'text_bg' ? 'selected' : ''}>Chữ + Nền Badge</option>
                                        </select>
                                    </div>
                                    <div class="field" id="wrap-img" style="margin-bottom: 1rem; display: ${currentDevEdit.type === 'image_text' ? 'flex' : 'none'};">
                                        <label>Link Ảnh Icon (URL PNG)</label>
                                        <input type="text" id="dev-url" value="${escapeHtml(currentDevEdit.imageUrl || '')}" placeholder="https://...">
                                    </div>
                                    <div class="field" style="margin-bottom: 1rem;">
                                        <label>Nội dung Chữ</label>
                                        <input type="text" id="dev-text" value="${escapeHtml(currentDevEdit.textContent || '')}">
                                    </div>
                                    <div class="field" style="margin-bottom: 1rem;">
                                        <label>Giá bán (Điểm Shop)</label>
                                        <input type="number" id="dev-price" value="${currentDevEdit.price || 0}" min="0">
                                    </div>
                                    <div style="display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.5rem; margin-bottom: 1rem;">
                                        <div class="field">
                                            <label>Màu chữ</label>
                                            <input type="color" id="dev-color-text" value="${currentDevEdit.textColor || '#000000'}" style="padding:0; height:44px;">
                                        </div>
                                        <div class="field wrap-bg" style="display: ${currentDevEdit.type === 'text_bg' ? 'flex' : 'none'};">
                                            <label>Màu nền</label>
                                            <input type="color" id="dev-color-bg" value="${currentDevEdit.bgColor || '#ffffff'}" style="padding:0; height:44px;">
                                        </div>
                                        <div class="field wrap-bg" style="display: ${currentDevEdit.type === 'text_bg' ? 'flex' : 'none'};">
                                            <label>Màu viền</label>
                                            <input type="color" id="dev-color-border" value="${currentDevEdit.borderColor || '#cccccc'}" style="padding:0; height:44px;">
                                        </div>
                                    </div>
                                </div>

                                <div class="dev-editor-preview">
                                    <span style="font-size: 0.85rem; color: var(--text-soft); font-weight: 600; margin-bottom: 1.5rem;">Xem trước trực tiếp</span>
                                    <div style="display: flex; align-items: center; margin-bottom: 0.25rem;">
                                        <div id="dev-preview-box">${getTitleHtml(currentDevEdit)}</div>
                                        <span style="font-size: 0.75rem; font-weight: 700; color: var(--primary-dark);">Tên của bạn</span>
                                    </div>
                                </div>
                            </div>
                            <button id="dev-save-btn" style="width: 100%; margin-top: 1.5rem; padding: 1rem;">💾 Cập nhật lên Firebase</button>
                        `}
                    </div>
                </div>
            `;

            workspace.querySelectorAll('.dev-item').forEach(item => {
                item.addEventListener('click', () => { devSelTitleId = item.dataset.id; currentDevEdit = null; renderUI(); });
            });

            workspace.querySelector('#dev-add-btn').addEventListener('click', async () => {
                const btn = workspace.querySelector('#dev-add-btn');
                btn.disabled = true; btn.textContent = '...';
                try {
                    const newRef = await db.ref('app_titles').push({
                        name: 'Danh hiệu Mới ' + Math.floor(Math.random()*100), type: 'image_text', imageUrl: '', textContent: 'NEW', textColor: '#000000', bgColor: '#ffffff', borderColor: '#cccccc', price: 0
                    });
                    devSelTitleId = newRef.key;
                    showToast('Đã thêm Danh hiệu mới lên Firebase');
                } catch(e) { showToast('Lỗi khi thêm', 'error'); }
            });

            if (devSelTitleId !== 'none') {
                workspace.querySelector('#dev-delete-btn').addEventListener('click', () => {
                    showConfirmModal({ title: 'Xóa?', message: 'Chắc chắn muốn xóa Danh hiệu này?', confirmText: 'Xóa ngay', onConfirm: async () => {
                        try {
                            await db.ref(`app_titles/${devSelTitleId}`).remove();
                            const usersSnap = await db.ref('users').once('value');
                            const users = usersSnap.val() || {};
                            for (const uid in users) {
                                if (users[uid].chatTitleId === devSelTitleId) {
                                    await db.ref(`users/${uid}`).update({ chatTitleId: 'none' });
                                }
                            }
                            devSelTitleId = 'none';
                            showToast('Đã xóa Danh hiệu khỏi hệ thống');
                        } catch(e) { showToast('Lỗi xóa', 'error'); }
                    }});
                });

                const refreshPreview = () => {
                    document.getElementById('dev-preview-box').innerHTML = getTitleHtml(currentDevEdit);
                };

                const typeSelect = workspace.querySelector('#dev-type');
                typeSelect.addEventListener('change', e => {
                    currentDevEdit.type = e.target.value;
                    workspace.querySelector('#wrap-img').style.display = e.target.value === 'image_text' ? 'flex' : 'none';
                    workspace.querySelectorAll('.wrap-bg').forEach(el => el.style.display = e.target.value === 'text_bg' ? 'flex' : 'none');
                    refreshPreview();
                });

                workspace.querySelector('#dev-name').addEventListener('input', e => { currentDevEdit.name = e.target.value; });
                workspace.querySelector('#dev-url').addEventListener('input', e => { currentDevEdit.imageUrl = e.target.value; refreshPreview(); });
                workspace.querySelector('#dev-text').addEventListener('input', e => { currentDevEdit.textContent = e.target.value; refreshPreview(); });
                workspace.querySelector('#dev-price').addEventListener('input', e => { currentDevEdit.price = Number(e.target.value); });
                workspace.querySelector('#dev-color-text').addEventListener('input', e => { currentDevEdit.textColor = e.target.value; refreshPreview(); });
                workspace.querySelector('#dev-color-bg').addEventListener('input', e => { currentDevEdit.bgColor = e.target.value; refreshPreview(); });
                workspace.querySelector('#dev-color-border').addEventListener('input', e => { currentDevEdit.borderColor = e.target.value; refreshPreview(); });

                workspace.querySelector('#dev-save-btn').addEventListener('click', async () => {
                    const btn = workspace.querySelector('#dev-save-btn');
                    btn.disabled = true; btn.textContent = 'Đang lưu...';
                    try {
                        const { id, ...dataToSave } = currentDevEdit;
                        await db.ref(`app_titles/${id}`).update(dataToSave);
                        showToast('Đã đồng bộ lên Firebase!');
                    } catch(e) { showToast('Lỗi đồng bộ', 'error'); }
                    finally { btn.disabled = false; btn.textContent = '💾 Cập nhật lên Firebase'; }
                });
            }
        } else if (devCurrentTab === 'avatars') {
            const presets = getPresetAvatars();
            
            if (!currentDevEdit || currentDevEdit.id !== (devSelPresetId || 'dummy')) {
                const activeItem = presets.find(p => p.id === devSelPresetId) || { id: 'dummy', name: 'Chưa có', url: '', offsetX: 0, offsetY: 0, scale: 100, price: 0 };
                currentDevEdit = JSON.parse(JSON.stringify(activeItem));
            }
            if (!currentDevEdit.avatarType) currentDevEdit.avatarType = 'image';
            if (!currentDevEdit.effectLayer) currentDevEdit.effectLayer = 'back';
            if (!currentDevEdit.designCode) currentDevEdit.designCode = '';
            if (!currentDevEdit.effectCode) currentDevEdit.effectCode = '';

            workspace.innerHTML = `
                <div class="dev-editor-layout">
                    <div class="form-card dev-editor-inputs" style="max-height: 600px; overflow-y: auto;">
                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                            <h3 style="margin: 0;">Thư viện Avatar</h3>
                            <button id="dev-add-btn" class="btn-outline" style="padding: 0.3rem 0.6rem; font-size: 0.8rem;">+ Thêm mới</button>
                        </div>
                        <div style="display: flex; flex-direction: column; gap: 0.5rem;">
                            ${presets.map((item) => `
                                <div class="dev-item ${item.id === devSelPresetId ? 'active' : ''}" data-id="${item.id}" style="padding: 0.75rem; border: 1.5px solid ${item.id === devSelPresetId ? 'var(--primary)' : 'var(--border)'}; border-radius: var(--radius-sm); cursor: pointer; display: flex; align-items: center; gap: 0.5rem; background: ${item.id === devSelPresetId ? 'rgba(167, 139, 250, 0.1)' : 'var(--surface)'}; font-weight: 600;">
                                    <div class="icon-slot" style="width:24px; height:24px; flex-shrink:0;">
                                        ${item.url ? `<img src="${escapeHtml(item.url)}" style="width: 100%; height: 100%; object-fit: contain;" />` : (item.avatarType === 'code' ? `<div style="font-size:1.2rem;">💻</div>` : `<div style="width:100%; height:100%; text-align:center; opacity:0.5;">🚫</div>`)}
                                    </div>
                                    <span style="flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${escapeHtml(item.name)}</span>
                                </div>
                            `).join('')}
                        </div>
                    </div>

                    <div class="form-card dev-editor-inputs">
                        ${(!currentDevEdit || currentDevEdit.id === 'none' || currentDevEdit.id === 'dummy') ? `
                            <div class="empty-state">Vui lòng chọn hoặc tạo mới Avatar để tùy chỉnh.</div>
                        ` : `
                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
                                <h3 style="margin: 0;">Tùy chỉnh: ${escapeHtml(currentDevEdit.name)}</h3>
                                <button id="dev-delete-btn" class="btn-ghost" style="color: #ef4444; padding: 0.3rem 0.6rem; font-size: 0.85rem;">🗑️ Xóa</button>
                            </div>
                            
                            <div class="dev-editor-layout">
                                <div class="dev-editor-inputs">
                                    <div style="display: flex; gap: 0.5rem; margin-bottom: 1.5rem;">
                                        <button class="btn-outline ${currentDevEdit.avatarType === 'image' ? 'active' : ''}" id="mode-img" style="flex:1; padding:0.5rem;">📸 Ảnh + Hiệu ứng</button>
                                        <button class="btn-outline ${currentDevEdit.avatarType === 'code' ? 'active' : ''}" id="mode-code" style="flex:1; padding:0.5rem;">💻 Code Thuần</button>
                                    </div>

                                    <div class="field" style="margin-bottom: 1rem;">
                                        <label>Tên Avatar Preset</label>
                                        <input type="text" id="dev-name" value="${escapeHtml(currentDevEdit.name)}">
                                    </div>
                                    <div class="field" style="margin-bottom: 1rem;">
                                        <label>Giá bán (Điểm Shop)</label>
                                        <input type="number" id="dev-price" value="${currentDevEdit.price || 0}" min="0">
                                    </div>

                                    <div id="wrap-image-mode" style="display: ${currentDevEdit.avatarType === 'image' ? 'block' : 'none'};">
                                        <div class="field" style="margin-bottom: 1rem;">
                                            <label>Link Ảnh (Dùng làm Base UI)</label>
                                            <input type="text" id="dev-url" value="${escapeHtml(currentDevEdit.url)}" placeholder="https://...">
                                        </div>
                                        <div class="field" style="margin-bottom: 1rem;">
                                            <label style="display:flex; justify-content:space-between;"><span>Tọa độ X (Ngang)</span><span id="val-x" style="color:var(--primary-dark);">${currentDevEdit.offsetX}px</span></label>
                                            <input type="range" id="dev-x" min="-50" max="50" value="${currentDevEdit.offsetX}" style="width: 100%;">
                                        </div>
                                        <div class="field" style="margin-bottom: 1rem;">
                                            <label style="display:flex; justify-content:space-between;"><span>Tọa độ Y (Dọc)</span><span id="val-y" style="color:var(--primary-dark);">${currentDevEdit.offsetY}px</span></label>
                                            <input type="range" id="dev-y" min="-50" max="50" value="${currentDevEdit.offsetY}" style="width: 100%;">
                                        </div>
                                        <div class="field" style="margin-bottom: 1rem;">
                                            <label style="display:flex; justify-content:space-between;"><span>Kích thước (Scale %)</span><span id="val-scale" style="color:var(--primary-dark);">${currentDevEdit.scale}%</span></label>
                                            <input type="range" id="dev-scale" min="50" max="300" value="${currentDevEdit.scale}" style="width: 100%;">
                                        </div>
                                    </div>

                                    <div id="wrap-code-mode" style="display: ${currentDevEdit.avatarType === 'code' ? 'block' : 'none'};">
                                        <div class="field" style="margin-bottom: 1rem;">
                                            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                                <label style="margin: 0;">Code Thiết kế (HTML/SVG)</label>
                                                <button id="copy-prompt-design-ava" class="btn-ghost" style="padding: 0.2rem 0.5rem; font-size: 0.7rem; border: 1px solid var(--border); border-radius: 4px; color: var(--primary-dark);">🤖 Copy Prompt</button>
                                            </div>
                                            <textarea id="dev-design" rows="4" placeholder="<svg>...</svg> hoặc <div>...</div>" style="font-family: monospace; font-size: 0.85rem; padding: 10px;">${currentDevEdit.designCode}</textarea>
                                        </div>
                                    </div>

                                    <div class="field" style="margin-bottom: 1rem;">
                                        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
                                            <label style="margin: 0;">Code Hiệu ứng (CSS Keyframes)</label>
                                            <button id="copy-prompt-effect-ava" class="btn-ghost" style="padding: 0.2rem 0.5rem; font-size: 0.7rem; border: 1px solid var(--border); border-radius: 4px; color: var(--primary-dark);">🤖 Copy Prompt</button>
                                        </div>
                                        <textarea id="dev-effect" rows="4" placeholder=".preset-${currentDevEdit.id}-effect { ... }" style="font-family: monospace; font-size: 0.85rem; padding: 10px;">${currentDevEdit.effectCode}</textarea>
                                        <span style="font-size:0.75rem; color:var(--text-soft); margin-top:4px;">* Selector: dùng <strong>.preset-${currentDevEdit.id}-effect</strong> (cho hào quang/viền ngoài) hoặc <strong>.preset-${currentDevEdit.id}-design</strong> (cho code thuần bên trong).</span>
                                    </div>

                                    <div class="field" style="margin-bottom: 1rem; display: ${currentDevEdit.avatarType === 'image' ? 'flex' : 'none'}; flex-direction:column;" id="wrap-layer">
                                        <label>Vị trí Hiệu ứng (Image Mode)</label>
                                        <select id="dev-layer" style="padding: 0.5rem; border-radius: var(--radius-sm); border: 1.5px solid var(--border);">
                                            <option value="back" ${currentDevEdit.effectLayer === 'back' ? 'selected' : ''}>Phía sau ảnh (Hào quang, Glow)</option>
                                            <option value="front" ${currentDevEdit.effectLayer === 'front' ? 'selected' : ''}>Phía trước ảnh (Viền nổi, Khói, Tuyết)</option>
                                        </select>
                                    </div>
                                </div>

                                <div class="dev-editor-preview">
                                    <span style="font-size: 0.85rem; color: var(--text-soft); font-weight: 600; margin-bottom: 1rem;">Live Multi-size Preview</span>
                                    <div style="display:flex; gap:0.5rem; margin-bottom: 1.5rem;">
                                        <button id="bg-light" class="btn-outline" style="padding: 0.3rem 0.6rem; font-size:0.75rem;">Nền Sáng</button>
                                        <button id="bg-dark" class="btn-outline" style="padding: 0.3rem 0.6rem; font-size:0.75rem; background: #1e1e2f; color: white;">Nền Tối</button>
                                    </div>
                                    <div id="dev-preview-box" style="display:flex; align-items:center; justify-content:center; gap:1.5rem; padding:2rem; border-radius:var(--radius-md); background:#f8f7ff; width:100%; transition:background 0.3s; flex-wrap:wrap;">
                                        ${renderAvatarWithBorderObj('A', {id:'none'}, 'sm', '', currentDevEdit.avatarType === 'image' ? currentDevEdit.url : '', currentDevEdit)}
                                        ${renderAvatarWithBorderObj('A', {id:'none'}, 'md', '', currentDevEdit.avatarType === 'image' ? currentDevEdit.url : '', currentDevEdit)}
                                        ${renderAvatarWithBorderObj('A', {id:'none'}, 'lg', '', currentDevEdit.avatarType === 'image' ? currentDevEdit.url : '', currentDevEdit)}
                                    </div>
                                </div>
                            </div>
                            <button id="dev-save-btn" style="width: 100%; margin-top: 1.5rem; padding: 1rem;">💾 Cập nhật lên Firebase</button>
                        `}
                    </div>
                </div>
            `;

            workspace.querySelectorAll('.dev-item').forEach(item => {
                item.addEventListener('click', () => { 
                    devSelPresetId = item.dataset.id; 
                    currentDevEdit = null; 
                    renderUI(); 
                });
            });

            const btnAdd = workspace.querySelector('#dev-add-btn');
            if (btnAdd) {
                btnAdd.addEventListener('click', async () => {
                    if (!(await checkDevPermission())) return;
                    btnAdd.disabled = true; btnAdd.textContent = '...';
                    try {
                        const newRef = await db.ref('app_preset_avatars').push({
                            name: 'Avatar Mới ' + Math.floor(Math.random()*100), url: '', offsetX: 0, offsetY: 0, scale: 100, price: 0,
                            avatarType: 'image', effectLayer: 'back', designCode: '', effectCode: ''
                        });
                        devSelPresetId = newRef.key;
                        showToast('Đã thêm Avatar mới lên Firebase');
                    } catch(e) { showToast('Lỗi khi thêm', 'error'); }
                });
            }

            if (devSelPresetId !== 'none' && devSelPresetId !== 'dummy' && currentDevEdit.id !== 'dummy') {
                workspace.querySelector('#dev-delete-btn').addEventListener('click', async () => {
                    if (!(await checkDevPermission())) return;
                    showConfirmModal({
                        title: 'Xóa?', message: 'Hành động này sẽ Xóa avatar trên toàn hệ thống và Reset người dùng đang dùng.', confirmText: 'Xóa ngay',
                        onConfirm: async () => {
                            try {
                                await db.ref(`app_preset_avatars/${devSelPresetId}`).remove();
                                const usersSnap = await db.ref('users').once('value');
                                const users = usersSnap.val() || {};
                                for (const uid in users) {
                                    if (users[uid].avatarPresetId === devSelPresetId) {
                                        await db.ref(`users/${uid}`).update({ avatarPresetId: 'none', avatarUrl: '' });
                                    }
                                }
                                devSelPresetId = 'none';
                                showToast('Đã xóa Avatar khỏi hệ thống');
                            } catch(e) { showToast('Lỗi xóa', 'error'); }
                        }
                    });
                });

                const refreshPreview = () => {
                    const box = document.getElementById('dev-preview-box');
                    if (box) box.innerHTML = `
                        ${renderAvatarWithBorderObj('A', {id:'none'}, 'sm', '', currentDevEdit.avatarType === 'image' ? currentDevEdit.url : '', currentDevEdit)}
                        ${renderAvatarWithBorderObj('A', {id:'none'}, 'md', '', currentDevEdit.avatarType === 'image' ? currentDevEdit.url : '', currentDevEdit)}
                        ${renderAvatarWithBorderObj('A', {id:'none'}, 'lg', '', currentDevEdit.avatarType === 'image' ? currentDevEdit.url : '', currentDevEdit)}
                    `;
                };

                workspace.querySelector('#mode-img').addEventListener('click', () => { currentDevEdit.avatarType = 'image'; renderUI(); });
                workspace.querySelector('#mode-code').addEventListener('click', () => { currentDevEdit.avatarType = 'code'; renderUI(); });
                
                workspace.querySelector('#bg-light').addEventListener('click', () => document.getElementById('dev-preview-box').style.background = '#f8f7ff');
                workspace.querySelector('#bg-dark').addEventListener('click', () => document.getElementById('dev-preview-box').style.background = '#1e1e2f');

                workspace.querySelector('#dev-name').addEventListener('input', e => { currentDevEdit.name = e.target.value; });
                workspace.querySelector('#dev-url').addEventListener('input', e => { currentDevEdit.url = e.target.value; refreshPreview(); });
                workspace.querySelector('#dev-price').addEventListener('input', e => { currentDevEdit.price = Number(e.target.value); });
                workspace.querySelector('#dev-x').addEventListener('input', e => { currentDevEdit.offsetX = Number(e.target.value); document.getElementById('val-x').textContent = e.target.value+'px'; refreshPreview(); });
                workspace.querySelector('#dev-y').addEventListener('input', e => { currentDevEdit.offsetY = Number(e.target.value); document.getElementById('val-y').textContent = e.target.value+'px'; refreshPreview(); });
                workspace.querySelector('#dev-scale').addEventListener('input', e => { currentDevEdit.scale = Number(e.target.value); document.getElementById('val-scale').textContent = e.target.value+'%'; refreshPreview(); });
                
                workspace.querySelector('#dev-design').addEventListener('input', e => { currentDevEdit.designCode = e.target.value; refreshPreview(); });
                workspace.querySelector('#dev-effect').addEventListener('input', e => { currentDevEdit.effectCode = e.target.value; refreshPreview(); });
                workspace.querySelector('#dev-layer').addEventListener('change', e => { currentDevEdit.effectLayer = e.target.value; refreshPreview(); });

                // Prompts
                const promptAvaDesign = workspace.querySelector('#copy-prompt-design-ava');
                if (promptAvaDesign) promptAvaDesign.addEventListener('click', () => {
                    const text = `Tôi cần code HTML/SVG và CSS inline để tạo một Avatar [Cyberpunk / Hiệp sĩ / Cổ tích...]. Kích thước linh hoạt 100%. Phần thiết kế bọc trong thẻ div class="preset-${currentDevEdit.id}-design". Hãy viết mã tối giản, không cần giải thích.`;
                    navigator.clipboard.writeText(text).then(() => showToast('Đã copy Prompt Thiết Kế!'));
                });
                
                const promptAvaEffect = workspace.querySelector('#copy-prompt-effect-ava');
                if (promptAvaEffect) promptAvaEffect.addEventListener('click', () => {
                    const mode = currentDevEdit.avatarType;
                    const text = mode === 'image' 
                        ? `Tôi có một avatar tròn. Hãy viết CSS Animation (dùng thẻ <style>) để tạo hiệu ứng [phát sáng / viền lửa xoay / hào quang ma thuật] cho thẻ div mang class .preset-${currentDevEdit.id}-effect. Thẻ này được set position: absolute lồng cùng avatar. Đảm bảo dùng keyframes chuẩn.`
                        : `Hãy viết CSS Animation (dùng thẻ <style>) để tạo chuyển động nhịp nhàng, lấp lánh cho Avatar có class .preset-${currentDevEdit.id}-design và hào quang bao quanh ở class .preset-${currentDevEdit.id}-effect. Dùng keyframes chuẩn và hiệu ứng bắt mắt.`;
                    navigator.clipboard.writeText(text).then(() => showToast('Đã copy Prompt Hiệu Ứng!'));
                });

                workspace.querySelector('#dev-save-btn').addEventListener('click', async () => {
                    if (!(await checkDevPermission())) return;
                    const btn = workspace.querySelector('#dev-save-btn');
                    btn.disabled = true; btn.textContent = 'Đang lưu...';
                    try {
                        const { id, ...dataToSave } = currentDevEdit;
                        await db.ref(`app_preset_avatars/${id}`).update(dataToSave);
                        showToast('Đã đồng bộ lên Firebase!');
                    } catch(e) { showToast('Lỗi đồng bộ', 'error'); }
                    finally { btn.disabled = false; btn.textContent = '💾 Cập nhật lên Firebase'; }
                });
            }
        }
    }

    renderUI();
}

/* ==========================================================================
   GRADING HELPERS
========================================================================== */

function normalize(str) {
    return String(str || '').trim().toLowerCase().replace(/\s+/g, ' ');
}

function gradeExam(questions, answers) {
    let earned = 0, possible = 0;
    const detail = [];

    questions.forEach(q => {
        const userAnswer = answers[q.id];
        if (q.type === 'essay') {
            detail.push({ id: q.id, graded: false, userAnswer });
            return;
        }
        possible += q.points || 1;
        let correct = false;
        if (q.type === 'multiple_choice') {
            correct = userAnswer === q.correctAnswer;
        } else if (q.type === 'short_answer') {
            correct = normalize(userAnswer) === normalize(q.correctAnswer);
        } else if (q.type === 'true_false') {
            correct = userAnswer === q.correctAnswer;
        }
        if (correct) earned += q.points || 1;
        detail.push({ id: q.id, graded: true, correct, userAnswer });
    });

    const accuracy = possible > 0 ? Math.round((earned / possible) * 1000) / 10 : 0;
    return { earned, possible, accuracy, detail };
}

async function submitResult(examId, gradeInfo) {
    const user = getCurrentUser();
    const resultRef = db.ref(`results/${examId}/${user.userId}`);
    const snap = await resultRef.once('value');
    const prev = snap.val();
    const attempts = (prev?.attempts || 0) + 1;

    if (!prev || gradeInfo.accuracy >= prev.accuracy) {
        await resultRef.set({
            displayName: user.displayName,
            score: gradeInfo.earned,
            possible: gradeInfo.possible,
            accuracy: gradeInfo.accuracy,
            attempts,
            submittedAt: Date.now()
        });
    } else {
        await resultRef.update({ attempts });
    }
}

async function renderLeaderboard(container, examId) {
    container.innerHTML = `<div class="spinner"></div>`;
    const snap = await db.ref(`results/${examId}`).once('value');
    const data = snap.val() || {};
    const rows = Object.values(data).sort((a, b) => b.accuracy - a.accuracy || a.submittedAt - b.submittedAt);

    if (rows.length === 0) {
        container.innerHTML = `<div class="empty-state"><span class="emoji">🏆</span>Chưa có ai làm bài thi này.</div>`;
        return;
    }

    container.innerHTML = `
        <table class="leaderboard">
            <thead><tr><th>#</th><th>Tên</th><th>Độ chính xác</th><th>Lượt làm</th></tr></thead>
            <tbody>
                ${rows.map((r, i) => `
                    <tr>
                        <td class="${i === 0 ? 'rank-1' : i === 1 ? 'rank-2' : i === 2 ? 'rank-3' : ''}">${i + 1}</td>
                        <td>${escapeHtml(r.displayName)}</td>
                        <td>${r.accuracy}%</td>
                        <td class="attempts-tag">${r.attempts} lần</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

/* ==========================================================================
   PUBLIC EXAMS
========================================================================== */

async function renderPublicExams(main) {
    main.innerHTML = `
        <div class="form-card" style="margin-top: 0; margin-bottom: 1.5rem; display: flex; flex-wrap: wrap; gap: 1rem; align-items: center; justify-content: space-between; background: linear-gradient(135deg, var(--primary), var(--secondary)); color: white; border: none;">
            <div>
                <h3 style="margin:0 0 0.25rem 0; color: white; font-size: 1.25rem;">⚡ Vào thi nhanh</h3>
                <p style="margin:0; font-size: 0.9rem; opacity: 0.95;">Nhập mã pin của bài thi để truy cập nhanh, mã pin lấy từ người tạo bài thi đó</p>
            </div>
            <div style="display: flex; gap: 0.5rem; width: 100%; max-width: 300px;">
                <input type="text" id="quick-pin-input" placeholder="Mã 6 số..." maxlength="6" style="border: none; border-radius: var(--radius-sm); padding: 0.6rem; font-family: monospace; font-size: 1.1rem; font-weight: bold; flex: 1; text-align: center; color: var(--text-heading); background: white;">
                <button id="quick-join-btn" style="background: var(--text-heading); color: white; box-shadow: var(--shadow-sm); white-space: nowrap;">Vào</button>
            </div>
        </div>

        <div class="content-header">
            <div class="content-header-main">
                <h2>Bài thi công khai</h2>
                <p>Khám phá và làm thử các đề thi được cộng đồng chia sẻ</p>
            </div>
            <div class="search-bar-wrapper">
                <input type="text" id="search-exam" placeholder="Nhập từ khóa tìm kiếm...">
                <button class="btn-ghost" id="search-btn">🔍</button>
                <button class="btn-ghost" id="filter-toggle">☰</button>
                <div class="filter-popover" id="filter-popover">
                    <div class="field">
                        <label>Tìm theo tên</label>
                        <input type="text" id="filter-name" placeholder="Tên bài thi...">
                    </div>
                    <div class="field">
                        <label>Lọc theo môn học</label>
                        <select id="filter-subject" style="padding: 0.4rem; border-radius: var(--radius-sm); border: 1.5px solid var(--border); outline: none;">
                            <option value="">Tất cả môn học</option>
                            ${SUBJECTS.map(subj => `<option value="${subj}">${subj}</option>`).join('')}
                        </select>
                    </div>
                    <div class="field">
                        <label>Tìm theo người tạo</label>
                        <input type="text" id="filter-owner" placeholder="Tên người tạo...">
                    </div>
                    <div class="field">
                        <label>Số câu tối thiểu</label>
                        <input type="number" id="filter-q" placeholder="0">
                    </div>
                    <div class="actions">
                        <button id="apply-filter">Áp dụng</button>
                        <button class="btn-outline" id="reset-filter">Xóa</button>
                    </div>
                </div>
            </div>
        </div>
        <div class="card-grid" id="public-grid">
            <div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>
        </div>
    `;

    document.getElementById('quick-join-btn').addEventListener('click', async () => {
        const pin = document.getElementById('quick-pin-input').value.trim();
        if (!pin || pin.length !== 6) {
            showToast('Vui lòng nhập mã PIN 6 số hợp lệ', 'error');
            return;
        }
        const btn = document.getElementById('quick-join-btn');
        btn.textContent = 'Đang tìm...';
        btn.disabled = true;

        try {
            const snap = await db.ref('exams').orderByChild('pin').equalTo(pin).once('value');
            if (snap.exists()) {
                const examData = snap.val();
                const examId = Object.keys(examData)[0];
                startExam(examId, examData[examId], 'public');
            } else {
                showToast('Không tìm thấy bài thi với mã PIN này', 'error');
                btn.textContent = 'Vào';
                btn.disabled = false;
            }
        } catch (err) {
            showToast('Lỗi kết nối', 'error');
            btn.textContent = 'Vào';
            btn.disabled = false;
        }
    });

    document.getElementById('quick-pin-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') document.getElementById('quick-join-btn').click();
    });

    try {
        const [examsSnap, likesSnap] = await Promise.all([
            db.ref('exams').orderByChild('isPublic').equalTo(true).once('value'),
            db.ref('likes').once('value')
        ]);
        const exams = examsSnap.val() || {};
        const likes = likesSnap.val() || {};
        const grid = document.getElementById('public-grid');
        const user = getCurrentUser();
        
        const renderList = (filter = '', filterQ = 0, filterOwner = '', filterSubject = '') => {
            const entries = Object.entries(exams).filter(([_, e]) => {
                const qCount = e.questions ? Object.keys(e.questions).length : 0;
                const matchName = e.title.toLowerCase().includes(filter.toLowerCase());
                const matchQ = filterQ === 0 || qCount >= filterQ;
                const matchOwner = filterOwner === '' || (e.ownerName || '').toLowerCase().includes(filterOwner.toLowerCase());
                const matchSubject = filterSubject === '' || (e.subjectTag || 'Khác') === filterSubject;
                return matchName && matchQ && matchOwner && matchSubject;
            });

            if (entries.length === 0) {
                grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><span class="emoji">🗂️</span>Không tìm thấy đề thi nào.</div>`;
                return;
            }

            grid.innerHTML = entries.map(([id, exam], i) => {
                const qCount = exam.questions ? Object.keys(exam.questions).length : 0;
                const examLikes = likes[id] || {};
                const likeCount = Object.keys(examLikes).length;
                const isLiked = user && examLikes[user.userId];
                return `
                    <div class="exam-card flex flex-col h-full" style="animation-delay:${i * 0.05}s">
                        <div class="card-body flex-1">
                            <h3 class="title">${escapeHtml(exam.title)}</h3>
                            <p class="description" style="font-size:0.85rem;color:var(--text-soft);margin:0;">${escapeHtml(exam.description || 'Không có mô tả')}</p>
                        </div>
                        <div class="card-footer pt-4">
                            <div class="meta flex items-center gap-2 mb-3" style="flex-wrap: wrap;">
                                <span class="badge blue">🏷️ ${escapeHtml(exam.subjectTag || 'Khác')}</span>
                                <span class="badge">${qCount} câu hỏi</span>
                                <span class="badge mint">bởi ${escapeHtml(exam.ownerName || 'Ẩn danh')}</span>
                            </div>
                            <div class="card-actions flex gap-2">
                                <button data-id="${id}" class="take-btn flex-1">Làm bài</button>
                                <button data-id="${id}" class="btn-outline board-btn flex-1">Bảng xếp hạng</button>
                                <div class="like-container ${isLiked ? 'liked' : ''}" data-id="${id}">
                                    <span class="like-icon">${isLiked ? '❤️' : '🤍'}</span>
                                    <span class="like-count">${likeCount}</span>
                                </div>
                            </div>
                        </div>
                    </div>
            `;
        }).join('');

        grid.querySelectorAll('.take-btn').forEach(b => {
            b.addEventListener('click', () => startExam(b.dataset.id, exams[b.dataset.id], 'public'));
        });
        grid.querySelectorAll('.board-btn').forEach(b => {
            b.addEventListener('click', () => showLeaderboardPage(b.dataset.id, exams[b.dataset.id], 'public'));
        });
        grid.querySelectorAll('.like-container').forEach(el => {
            el.addEventListener('click', async () => {
                if (!user) return showToast('Vui lòng đăng nhập để thích!');
                const id = el.dataset.id;
                const isLiked = el.classList.contains('liked');
                const ref = db.ref(`likes/${id}/${user.userId}`);
                
                if (isLiked) {
                    await ref.remove();
                    el.classList.remove('liked');
                    el.querySelector('.like-icon').textContent = '🤍';
                    el.querySelector('.like-count').textContent = parseInt(el.querySelector('.like-count').textContent) - 1;
                } else {
                    await ref.set(true);
                    el.classList.add('liked');
                    el.querySelector('.like-icon').textContent = '❤️';
                    el.querySelector('.like-count').textContent = parseInt(el.querySelector('.like-count').textContent) + 1;
                }
            });
        });
        };

        const toggleFilter = document.getElementById('filter-toggle');
        const popover = document.getElementById('filter-popover');
        toggleFilter.addEventListener('click', () => popover.classList.toggle('active'));

        const updateList = () => {
            const name = document.getElementById('search-exam').value || document.getElementById('filter-name').value;
            const q = parseInt(document.getElementById('filter-q').value) || 0;
            const owner = document.getElementById('filter-owner').value;
            const subject = document.getElementById('filter-subject').value;
            renderList(name, q, owner, subject);
        };

        document.getElementById('apply-filter').addEventListener('click', () => {
            updateList();
            popover.classList.remove('active');
        });

        document.getElementById('reset-filter').addEventListener('click', () => {
            document.getElementById('search-exam').value = '';
            document.getElementById('filter-name').value = '';
            document.getElementById('filter-owner').value = '';
            document.getElementById('filter-subject').value = '';
            document.getElementById('filter-q').value = '';
            renderList();
            popover.classList.remove('active');
        });

        document.getElementById('search-btn').addEventListener('click', updateList);
        renderList();

        grid.querySelectorAll('.take-btn').forEach(b => {
            b.addEventListener('click', () => startExam(b.dataset.id, exams[b.dataset.id], 'public'));
        });
        grid.querySelectorAll('.board-btn').forEach(b => {
            b.addEventListener('click', () => showLeaderboardPage(b.dataset.id, exams[b.dataset.id], 'public'));
        });
    } catch (err) {
        document.getElementById('public-grid').innerHTML = `<div class="empty-state" style="grid-column:1/-1;">Lỗi tải dữ liệu. Thử lại sau.</div>`;
    }
}

function showLeaderboardPage(examId, exam, backPage) {
    const main = fadeMain();
    main.innerHTML = `
        <div class="content-header">
            <div class="content-header-main">
                <h2>🏆 Bảng xếp hạng — ${escapeHtml(exam.title)}</h2>
                <p>Xếp hạng theo độ chính xác cao nhất</p>
            </div>
            <button class="btn-outline" id="back-btn">← Quay lại</button>
        </div>
        <div id="board-slot"></div>
    `;
    document.getElementById('back-btn').addEventListener('click', () => setActivePage(backPage));
    renderLeaderboard(document.getElementById('board-slot'), examId);
}

/* ==========================================================================
   GLOBAL CHAT (REALTIME + CUSTOMIZATIONS + REACTIONS)
========================================================================== */

function renderChat(main) {
    const user = getCurrentUser();
    
    main.innerHTML = `
        <style>
            @keyframes pulse-green {
                0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0.7); }
                70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(16, 185, 129, 0); }
                100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(16, 185, 129, 0); }
            }
        </style>
        <div class="content-header">
            <div class="content-header-main">
                <div style="display: flex; align-items: center; justify-content: space-between; width: 100%; margin-bottom: 0.25rem;">
                    <div style="display: flex; align-items: center; gap: 1rem; flex-wrap: wrap;">
                        <h2 style="margin: 0;">💬 Chat Tổng</h2>
                        <span id="online-count-badge" style="display: inline-flex; align-items: center; gap: 0.4rem; padding: 0.25rem 0.75rem; border-radius: 999px; font-size: 0.8rem; font-weight: 700; background: #ecfdf5; color: #059669; border: 1px solid #a7f3d0;">
                            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; animation: pulse-green 2s infinite;"></span> Đang tải...
                        </span>
                    </div>
                    <button id="clear-chat-btn" style="display: ${Number(user.dev) === 1 ? 'inline-flex' : 'none'}; padding: 0.4rem 0.8rem; font-size: 0.8rem; background: #fee2e2; color: #ef4444; border: 1px solid #fca5a5; box-shadow: none; align-items: center; gap: 0.3rem; transition: background 0.2s;">🗑️ Xóa lịch sử</button>
                </div>
                <p style="margin: 0; color: var(--text-soft); font-size: 0.875rem;">Nơi giao lưu, trao đổi học tập cùng mọi người</p>
            </div>
        </div>
        <div class="chat-container">
            <div class="chat-messages" id="chat-messages">
                <div class="spinner" id="chat-spinner"></div>
            </div>
            <div class="chat-input-area">
                <input type="text" id="chat-input" placeholder="Nhập tin nhắn của bạn..." maxlength="200" ${user.isMuted ? 'disabled' : ''}>
                <button id="chat-send-btn" ${user.isMuted ? 'disabled' : ''}>Gửi</button>
            </div>
        </div>
    `;

    const messagesEl = document.getElementById('chat-messages');
    
    // Lắng nghe đếm số người Online
    activeOnlineCountListenerRef = db.ref('users');
    activeOnlineCountListenerCb = activeOnlineCountListenerRef.on('value', snap => {
        let count = 0;
        snap.forEach(child => {
            if (child.val().isOnline) count++;
        });
        const badge = document.getElementById('online-count-badge');
        if (badge) {
            badge.innerHTML = `<span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: #10b981; animation: pulse-green 2s infinite;"></span> ${count} người đang online`;
        }
    });
    const inputEl = document.getElementById('chat-input');
    const sendBtn = document.getElementById('chat-send-btn');
    let isCooldown = false;

    const clearChatBtn = document.getElementById('clear-chat-btn');
    if (clearChatBtn) {
        clearChatBtn.addEventListener('click', async () => {
            if (!window.confirm("⚠️ BẠN CÓ CHẮC CHẮN MUỐN XÓA TOÀN BỘ LỊCH SỬ CHAT? Hành động này không thể hoàn tác!")) return;
            if (!(await checkDevPermission())) return;
            
            try {
                clearChatBtn.textContent = 'Đang xóa...';
                clearChatBtn.disabled = true;
                
                await db.ref('global_chat').remove();
                messagesEl.innerHTML = ''; // Làm sạch giao diện cục bộ ngay lập tức
                
                await db.ref('global_chat').push({
                    text: "DEV đã xóa lịch sử chat",
                    displayName: "Hệ Thống",
                    isSystem: true,
                    timestamp: firebase.database.ServerValue.TIMESTAMP
                });
                showToast('Đã xóa lịch sử chat!', 'success');
            } catch (e) {
                showToast('Lỗi khi xóa lịch sử chat', 'error');
            } finally {
                clearChatBtn.textContent = '🗑️ Xóa lịch sử';
                clearChatBtn.disabled = false;
            }
        });
    }

    if (user.isMuted) {
        inputEl.placeholder = "🚫 Bạn đã bị hạn chế quyền nhắn tin";
    }

    db.ref('global_chat').limitToLast(100).once('value').then(() => {
        const spinner = document.getElementById('chat-spinner');
        if(spinner) spinner.remove();
    });

    function createMessageNode(snapshot, user) {
        const msg = snapshot.val();
        const msgId = snapshot.key;

        const div = document.createElement('div');
        div.id = `chat-msg-${msgId}`;

        if (msg.isSystem) {
            div.style.cssText = 'display: flex; justify-content: center; margin: 1rem 0; animation: pageFadeIn 0.3s var(--ease); width: 100%;';
            div.innerHTML = `<div style="background: var(--surface); padding: 0.4rem 1.25rem; border-radius: 999px; font-size: 0.8rem; color: #ef4444; font-weight: 600; font-style: italic; border: 1px dashed #fca5a5; opacity: 0.8;">${escapeHtml(msg.text)}</div>`;
            return div;
        }

        const isOwn = msg.userId === user.userId;
        div.style.display = 'flex';
        div.style.gap = '0.5rem';
        div.style.marginBottom = '1.5rem'; 
        div.style.alignItems = 'flex-end';
        div.style.animation = 'pageFadeIn 0.3s var(--ease)';
        div.style.justifyContent = isOwn ? 'flex-end' : 'flex-start';

        const timeStr = new Date(msg.timestamp).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});

        const titleObj = msg.chatTitleObj || getTitleById(msg.chatTitleId);
        const titleHtml = getTitleHtml(titleObj);

        const borderObj = msg.avatarBorderObj || getBorderById(msg.avatarBorderId);
        const presetObj = msg.avatarPresetObj || getPresetById(msg.avatarPresetId);

        const avatarHtml = `
            <div class="chat-avatar-click" style="cursor: pointer; transition: opacity 0.2s;" title="${escapeHtml(msg.displayName)}">
                ${renderAvatarWithBorderObj(msg.displayName, borderObj, 'md', '', msg.avatarUrl || '', presetObj)}
            </div>
        `;

        const nameWithTitleHtml = `
            <div class="chat-name-click" style="display: flex; align-items: center; margin-bottom: 0.25rem; cursor: pointer; transition: opacity 0.2s;">
                ${titleHtml}
                <span style="font-size: 0.75rem; font-weight: 700; color: var(--primary-dark);">${escapeHtml(msg.displayName)}</span>
            </div>
        `;

        const bubbleBaseStyle = `font-size: 0.95rem; padding: 0.65rem 1rem; border-radius: 1.25rem; max-width: 100%; word-wrap: break-word; box-shadow: var(--shadow-sm); position: relative; z-index: 2;`;
        const bubbleRadiusStyle = isOwn ? `border-bottom-right-radius: 4px;` : `border-bottom-left-radius: 4px;`;

        const frameObj = msg.chatFrameObj || getFrameById(msg.chatFrameId);
        let frameStyle = '';
        let frameClass = '';
        let sbStyleHtml = '';
        let audioAttrs = '';
        let tiltClass = '';
        let filterHtml = '';
        
        if (frameObj && frameObj.id !== 'none') {
            const { id, designCode, effectCode, cssVars, defaultCSS, hoverCSS, activeCSS, audioHover, audioClick, enableTilt, svgFilter } = frameObj;
            const uId = `f-${id}-${msgId}`;
            frameClass = `frame-${id} ${uId}`;
            frameStyle = designCode || '';
            
            sbStyleHtml = `<style>
                .${uId} { ${cssVars || ''} ${defaultCSS || ''} transition: all 0.3s ease; }
                .${uId}:hover { ${hoverCSS || ''} }
                .${uId}:active { ${activeCSS || ''} }
                ${effectCode ? effectCode.replace(new RegExp(`\\.frame-${id}`, 'g'), `.${uId}`) : ''}
            </style>`;
            
            audioAttrs = `${audioHover ? `data-audio-hover="${escapeHtml(audioHover)}"` : ''} ${audioClick ? `data-audio-click="${escapeHtml(audioClick)}"` : ''}`;
            tiltClass = enableTilt ? 'tilt-enabled' : '';
            if (svgFilter) filterHtml = `<div style="position:absolute; width:0; height:0; overflow:hidden;">${svgFilter}</div>`;
        } else {
            frameStyle = isOwn
                ? `background: linear-gradient(135deg, var(--primary), var(--secondary)); color: white; border: none;`
                : `background: var(--surface); color: var(--text-heading); border: 1px solid var(--border);`;
        }

        const emojis = ['👍', '❤️', '😂', '😮', '🔥'];
        const pickerHtml = `
            <div class="reaction-picker">
                ${emojis.map(e => `<button class="reaction-btn" data-msg-id="${msgId}" data-emoji="${e}">${e}</button>`).join('')}
            </div>
        `;

        let badgesHtml = '';
        const reactions = msg.reactions || {};
        let badgeContent = '';
        for (const emoji in reactions) {
            const users = Object.keys(reactions[emoji]);
            const count = users.length;
            if (count > 0) {
                const reacted = users.includes(user.userId);
                badgeContent += `
                    <div class="reaction-badge ${reacted ? 'reacted' : ''}" data-msg-id="${msgId}" data-emoji="${emoji}">
                        ${emoji} <span>${count}</span>
                    </div>
                `;
            }
        }
        if (badgeContent) {
            badgesHtml = `<div class="reaction-badges">${badgeContent}</div>`;
        }

        if (isOwn) {
            div.innerHTML = `
                ${sbStyleHtml} ${filterHtml}
                <div style="display: flex; flex-direction: column; align-items: flex-end; margin-right: 0.5rem; max-width: 75%;">
                    ${nameWithTitleHtml}
                    <div class="chat-message-container ${tiltClass}" ${audioAttrs}>
                        <div class="${frameClass}" style="${bubbleBaseStyle} ${bubbleRadiusStyle} ${frameStyle}">
                            ${escapeHtml(msg.text)}
                        </div>
                        ${badgesHtml}
                        ${pickerHtml}
                    </div>
                    <div style="font-size: 0.65rem; margin-top: 0.25rem; opacity: 0.7;">${timeStr}</div>
                </div>
                ${avatarHtml}
            `;
        } else {
            div.innerHTML = `
                ${sbStyleHtml} ${filterHtml}
                ${avatarHtml}
                <div style="display: flex; flex-direction: column; align-items: flex-start; margin-left: 0.5rem; max-width: 75%;">
                    ${nameWithTitleHtml}
                    <div class="chat-message-container ${tiltClass}" ${audioAttrs}>
                        <div class="${frameClass}" style="${bubbleBaseStyle} ${bubbleRadiusStyle} ${frameStyle}">
                            ${escapeHtml(msg.text)}
                        </div>
                        ${badgesHtml}
                        ${pickerHtml}
                    </div>
                    <div style="font-size: 0.65rem; margin-top: 0.25rem; opacity: 0.7;">${timeStr}</div>
                </div>
            `;
        }

        return div;
    }

    activeChatAddedListener = db.ref('global_chat').orderByChild('timestamp').limitToLast(100).on('child_added', (snapshot) => {
        const spinner = document.getElementById('chat-spinner');
        if(spinner) spinner.remove();

        const div = createMessageNode(snapshot, user);
        messagesEl.appendChild(div);
        messagesEl.scrollTop = messagesEl.scrollHeight;

        const nameClick = div.querySelector('.chat-name-click');
        if (nameClick && snapshot.val().userId) nameClick.addEventListener('click', () => showPublicProfile(snapshot.val().userId));

        const avatarClick = div.querySelector('.chat-avatar-click');
        if (avatarClick && snapshot.val().userId) avatarClick.addEventListener('click', () => showPublicProfile(snapshot.val().userId));
    });

    activeChatChangedListener = db.ref('global_chat').limitToLast(100).on('child_changed', (snapshot) => {
        const msgId = snapshot.key;
        const oldDiv = document.getElementById(`chat-msg-${msgId}`);
        if (oldDiv) {
            const isScrolledToBottom = messagesEl.scrollHeight - messagesEl.clientHeight <= messagesEl.scrollTop + 1;
            const newDiv = createMessageNode(snapshot, user);
            newDiv.style.animation = 'none'; 
            oldDiv.replaceWith(newDiv);

            if (isScrolledToBottom) {
                messagesEl.scrollTop = messagesEl.scrollHeight;
            }

            const nameClick = newDiv.querySelector('.chat-name-click');
            if (nameClick && snapshot.val().userId) nameClick.addEventListener('click', () => showPublicProfile(snapshot.val().userId));

            const avatarClick = newDiv.querySelector('.chat-avatar-click');
            if (avatarClick && snapshot.val().userId) avatarClick.addEventListener('click', () => showPublicProfile(snapshot.val().userId));
        }
    });

    messagesEl.addEventListener('click', async (e) => {
        const reactBtn = e.target.closest('.reaction-btn');
        const badge = e.target.closest('.reaction-badge');

        if (reactBtn || badge) {
            const el = reactBtn || badge;
            const msgId = el.dataset.msgId;
            const emoji = el.dataset.emoji;
            const ref = db.ref(`global_chat/${msgId}/reactions/${emoji}/${user.userId}`);
            
            const snap = await ref.once('value');
            if (snap.exists()) {
                await ref.remove();
            } else {
                await ref.set(true);
            }
            
            messagesEl.querySelectorAll('.active-picker').forEach(picker => picker.classList.remove('active-picker'));
            return;
        }

        messagesEl.querySelectorAll('.active-picker').forEach(picker => picker.classList.remove('active-picker'));
    });

    let pressTimer;
    messagesEl.addEventListener('touchstart', (e) => {
        const container = e.target.closest('.chat-message-container');
        if (container) {
            pressTimer = setTimeout(() => {
                messagesEl.querySelectorAll('.active-picker').forEach(picker => picker.classList.remove('active-picker'));
                container.classList.add('active-picker');
            }, 500);
        }
    }, {passive: true});

    messagesEl.addEventListener('touchend', () => clearTimeout(pressTimer));
    messagesEl.addEventListener('touchmove', () => clearTimeout(pressTimer));
    messagesEl.addEventListener('touchcancel', () => clearTimeout(pressTimer));

    async function sendMessage() {
        if (isCooldown) return;
        const freshUser = getCurrentUser();
        
        if (freshUser.isMuted) {
            showToast('Bạn đã bị hạn chế quyền nhắn tin', 'error');
            return;
        }
        
        const text = inputEl.value.trim();
        if (!text) return;

        isCooldown = true;
        inputEl.value = '';
        
        try {
            await db.ref('global_chat').push({
                userId: freshUser.userId,
                displayName: freshUser.displayName,
                text: text,
                timestamp: firebase.database.ServerValue.TIMESTAMP,
                avatarBorderObj: getBorderById(freshUser.avatarBorderId),
                chatFrameObj: getFrameById(freshUser.chatFrameId),
                chatTitleObj: getTitleById(freshUser.chatTitleId),
                avatarPresetObj: getPresetById(freshUser.avatarPresetId),
                avatarUrl: freshUser.avatarUrl || ''
            });
            addExp(5); // Thưởng +5 EXP khi gửi tin nhắn chat
        } catch (err) {
            showToast('Lỗi gửi tin nhắn', 'error');
        }

        let timeLeft = 5;
        sendBtn.disabled = true;
        sendBtn.textContent = `${timeLeft}s`;
        
        const timer = setInterval(() => {
            timeLeft--;
            if (timeLeft <= 0) {
                clearInterval(timer);
                isCooldown = false;
                sendBtn.disabled = false;
                sendBtn.textContent = 'Gửi';
            } else {
                sendBtn.textContent = `${timeLeft}s`;
            }
        }, 1000);
    }

    sendBtn.addEventListener('click', sendMessage);
    inputEl.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') sendMessage();
    });
}

/* ==========================================================================
   SHUFFLE HELPERS
========================================================================== */
function shuffleArray(array) {
    for (let i = array.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [array[i], array[j]] = [array[j], array[i]];
    }
    return array;
}

/* ==========================================================================
   TAKE EXAM FLOW
========================================================================== */

function startExam(examId, exam, backPage) {
    let questions = Object.entries(exam.questions || {})
        .map(([id, q]) => ({ id, ...q }))
        .sort((a, b) => (a.order ?? 0) - (b.order ?? 0));

    if (questions.length === 0) {
        showToast('Đề thi này chưa có câu hỏi nào.', 'error');
        return;
    }

    if (exam.isShuffleEnabled) {
        questions = shuffleArray([...questions]);
        questions = questions.map(q => {
            if (q.type === 'multiple_choice' && q.options) {
                const optKeys = Object.keys(q.options);
                const shuffledKeys = shuffleArray([...optKeys]);
                const newOptions = {};
                let newCorrect = null;
                
                shuffledKeys.forEach((key, index) => {
                    const newLetter = String.fromCharCode(65 + index); // A, B, C, D
                    newOptions[newLetter] = q.options[key];
                    if (key === q.correctAnswer) {
                        newCorrect = newLetter;
                    }
                });
                return { ...q, options: newOptions, correctAnswer: newCorrect };
            }
            return q;
        });
    }

    const state = { mode: 'scroll', current: 0, answers: {}, locked: false };
    let timerInterval = null;

    const timeLimit = exam.timeLimit || 0;
    const storageKey = `endTime_${examId}_${getCurrentUser().userId}`;
    let endTime = localStorage.getItem(storageKey);

    if (timeLimit > 0 && !endTime) {
        endTime = Date.now() + timeLimit * 60 * 1000;
        localStorage.setItem(storageKey, endTime);
    }

    function renderTakeExam() {
        const main = fadeMain();
        main.innerHTML = `
            <div id="timer-slot"></div>
            <div class="content-header">
                <div class="content-header-main">
                    <h2>${escapeHtml(exam.title)}</h2>
                    <p>${questions.length} câu hỏi — ${timeLimit > 0 ? `Giới hạn ${timeLimit} phút` : 'Không giới hạn thời gian'}</p>
                </div>
                <button class="btn-outline" id="back-btn">← Quay lại</button>
            </div>
            <div class="exam-progress">
                <div class="progress-track"><div class="progress-fill" id="progress-fill" style="width:0%"></div></div>
                <div class="mode-toggle">
                    <button data-mode="scroll" id="mode-scroll">Cuộn tất cả</button>
                    <button data-mode="slide" id="mode-slide">Từng câu</button>
                </div>
            </div>
            <div id="questions-slot"></div>
        `;

        document.getElementById('back-btn').addEventListener('click', () => {
            clearInterval(timerInterval);
            setActivePage(backPage);
        });
        document.getElementById('mode-scroll').addEventListener('click', () => { state.mode = 'scroll'; renderQuestions(); });
        document.getElementById('mode-slide').addEventListener('click', () => { state.mode = 'slide'; renderQuestions(); });

        if (timeLimit > 0) startTimer();
        renderQuestions();
    }

    // Warning Modal
    showConfirmModal({
        title: '⚠️ CHÚ Ý',
        message: 'Thời gian làm bài sẽ liên tục đếm ngược kể cả khi bạn đóng trình duyệt hoặc không làm bài!',
        confirmText: 'Đã hiểu',
        danger: false,
        onConfirm: () => {}
    });

    window.onbeforeunload = () => "Bạn có chắc chắn muốn rời khỏi trang? Bài làm sẽ không được lưu nếu bạn chưa nộp!";
    
    // Auto-submit check on load
    if (timeLimit > 0 && endTime && Date.now() >= parseInt(endTime)) {
        handleSubmit();
        return;
    }

    function startTimer() {
        const timerSlot = document.getElementById('timer-slot');
        timerInterval = setInterval(() => {
            const now = Date.now();
            const remaining = endTime - now;
            if (remaining <= 0) {
                clearInterval(timerInterval);
                localStorage.removeItem(storageKey);
                state.locked = true;
                handleSubmit();
                return;
            }
            const mins = Math.floor(remaining / 60000);
            const secs = Math.floor((remaining % 60000) / 1000);
            const timeStr = `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
            timerSlot.innerHTML = `<div class="timer-sticky ${remaining < 60000 ? 'warning' : ''}">${timeStr}</div>`;
        }, 1000);
    }

    function updateProgress() {
        const answeredCount = Object.keys(state.answers).length;
        const pct = Math.round((answeredCount / questions.length) * 100);
        const fill = document.getElementById('progress-fill');
        if (fill) fill.style.width = pct + '%';
        document.getElementById('mode-scroll').classList.toggle('active', state.mode === 'scroll');
        document.getElementById('mode-slide').classList.toggle('active', state.mode === 'slide');
    }

    function questionCardHtml(q, index) {
        const ans = state.answers[q.id];
        let body = '';
        if (q.type === 'multiple_choice') {
            body = `<div class="option-list">${['A','B','C','D'].map(letter => `
                <div class="option-item ${ans === letter ? 'selected' : ''} ${state.locked ? 'disabled' : ''}" data-letter="${letter}">
                    <span class="opt-letter">${letter}</span>
                    <span>${escapeHtml(q.options?.[letter] || '')}</span>
                </div>
            `).join('')}</div>`;
        } else if (q.type === 'true_false') {
            body = `<div class="tf-buttons">
                <button class="${ans === true ? 'selected' : ''} ${state.locked ? 'disabled' : ''}" data-val="true">Đúng</button>
                <button class="${ans === false ? 'selected' : ''} ${state.locked ? 'disabled' : ''}" data-val="false">Sai</button>
            </div>`;
        } else if (q.type === 'short_answer') {
            body = `<input type="text" data-qid="${q.id}" class="short-input" placeholder="Nhập câu trả lời..." value="${escapeHtml(ans || '')}" ${state.locked ? 'disabled' : ''}>`;
        } else {
            body = `<textarea data-qid="${q.id}" rows="4" placeholder="Viết câu trả lời của bạn..." ${state.locked ? 'disabled' : ''}>${escapeHtml(ans || '')}</textarea>`;
        }

        return `
            <div class="question-card" data-qid="${q.id}">
                <div class="q-index">Câu ${index + 1} / ${questions.length} · ${QUESTION_TYPES[q.type].icon} ${QUESTION_TYPES[q.type].label}</div>
                <div class="q-content">${escapeHtml(q.content)}</div>
                ${body}
            </div>
        `;
    }

    function bindQuestionCard(cardEl, q) {
        if (state.locked) return;
        cardEl.querySelectorAll('.option-item').forEach(opt => {
            opt.addEventListener('click', () => {
                state.answers[q.id] = opt.dataset.letter;
                cardEl.querySelectorAll('.option-item').forEach(o => o.classList.remove('selected'));
                opt.classList.add('selected');
                updateProgress();
                renderDots();
            });
        });
        cardEl.querySelectorAll('.tf-buttons button').forEach(btn => {
            btn.addEventListener('click', () => {
                state.answers[q.id] = btn.dataset.val === 'true';
                cardEl.querySelectorAll('.tf-buttons button').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
                updateProgress();
                renderDots();
            });
        });
        const shortInput = cardEl.querySelector('.short-input');
        if (shortInput) shortInput.addEventListener('input', () => {
            state.answers[q.id] = shortInput.value;
            updateProgress(); renderDots();
        });
        const textarea = cardEl.querySelector('textarea');
        if (textarea) textarea.addEventListener('input', () => {
            state.answers[q.id] = textarea.value;
            updateProgress(); renderDots();
        });
    }

    function renderDots() {
        const dotsEl = document.getElementById('slide-dots');
        if (!dotsEl) return;
        dotsEl.innerHTML = questions.map((q, i) => `
            <button class="slide-dot ${state.answers[q.id] !== undefined ? 'answered' : ''} ${i === state.current ? 'current' : ''}" data-i="${i}"></button>
        `).join('');
        dotsEl.querySelectorAll('.slide-dot').forEach(d => {
            d.addEventListener('click', () => { state.current = Number(d.dataset.i); renderQuestions(); });
        });
    }

    function renderQuestions() {
        const slot = document.getElementById('questions-slot');
        updateProgress();

        if (state.mode === 'scroll') {
            slot.innerHTML = questions.map((q, i) => questionCardHtml(q, i)).join('') +
                `<button id="submit-exam-btn" style="width:100%;margin-top:1rem;" ${state.locked ? 'disabled' : ''}>Nộp bài</button>`;
            questions.forEach(q => bindQuestionCard(slot.querySelector(`[data-qid="${q.id}"]`), q));
        } else {
            const q = questions[state.current];
            slot.innerHTML = questionCardHtml(q, state.current) + `
                <div class="slide-nav">
                    <button class="btn-outline" id="prev-btn" ${state.current === 0 ? 'disabled' : ''}>← Trước</button>
                    <div class="slide-dots" id="slide-dots"></div>
                    ${state.current === questions.length - 1
                        ? `<button id="submit-exam-btn" ${state.locked ? 'disabled' : ''}>Nộp bài</button>`
                        : `<button id="next-btn">Tiếp →</button>`}
                </div>
            `;
            bindQuestionCard(slot.querySelector(`[data-qid="${q.id}"]`), q);
            renderDots();

            const prevBtn = document.getElementById('prev-btn');
            const nextBtn = document.getElementById('next-btn');
            if (prevBtn) prevBtn.addEventListener('click', () => { state.current--; renderQuestions(); });
            if (nextBtn) nextBtn.addEventListener('click', () => { state.current++; renderQuestions(); });
        }

        const submitBtn = document.getElementById('submit-exam-btn');
        if (submitBtn) submitBtn.addEventListener('click', handleSubmit);
    }

    async function handleSubmit() {
        clearInterval(timerInterval);
        localStorage.removeItem(storageKey);
        const gradeInfo = gradeExam(questions, state.answers);
        try {
            await submitResult(examId, gradeInfo);
            addExp(50); // Thưởng +50 EXP khi nộp bài
            renderResultScreen(gradeInfo, questions, state.answers);
        } catch (err) {
            showToast('Lỗi khi nộp bài, thử lại nhé.', 'error');
        }
    }

    function renderResultScreen(gradeInfo, qs, answers) {
        const main = fadeMain();
        
        let reviewHtml = qs.map((q, index) => {
            const ans = answers[q.id];
            const detail = gradeInfo.detail.find(d => d.id === q.id);
            const isCorrect = detail ? detail.correct : false;
            const isGraded = detail ? detail.graded : false;

            let badgeHtml = '';
            if (!isGraded) {
                badgeHtml = `<span class="badge" style="background:#fef3c7;color:#b45309;">Chờ chấm (Tự luận)</span>`;
            } else if (isCorrect) {
                badgeHtml = `<span class="badge" style="background:#d1fae5;color:#065f46;">✅ Đúng</span>`;
            } else {
                badgeHtml = `<span class="badge" style="background:#fee2e2;color:#991b1b;">❌ Sai</span>`;
            }

            let bodyHtml = '';
            if (q.type === 'multiple_choice') {
                bodyHtml = `<div class="option-list">` + ['A','B','C','D'].map(letter => {
                    let rowClass = 'opt-review-faded';
                    let icon = '';
                    if (letter === q.correctAnswer) {
                        rowClass = 'opt-review-correct';
                        icon = ' ✅';
                    } else if (ans === letter && letter !== q.correctAnswer) {
                        rowClass = 'opt-review-wrong';
                        icon = ' ❌';
                    }
                    return `
                        <div class="option-item ${rowClass} disabled" style="cursor:default;">
                            <span class="opt-letter">${letter}</span>
                            <span>${escapeHtml(q.options?.[letter] || '')}<strong>${icon}</strong></span>
                        </div>
                    `;
                }).join('') + `</div>`;
            } else if (q.type === 'true_false') {
                const isTrueCorrect = q.correctAnswer === true;
                const isFalseCorrect = q.correctAnswer === false;
                const userTrue = ans === true;
                const userFalse = ans === false;

                let trueClass = 'opt-review-faded', falseClass = 'opt-review-faded';
                let trueIcon = '', falseIcon = '';

                if (isTrueCorrect) {
                    trueClass = 'opt-review-correct'; trueIcon = ' ✅';
                } else if (userTrue) {
                    trueClass = 'opt-review-wrong'; trueIcon = ' ❌';
                }

                if (isFalseCorrect) {
                    falseClass = 'opt-review-correct'; falseIcon = ' ✅';
                } else if (userFalse) {
                    falseClass = 'opt-review-wrong'; falseIcon = ' ❌';
                }

                bodyHtml = `<div class="tf-buttons">
                    <button class="${trueClass} disabled" style="cursor:default;">Đúng<strong>${trueIcon}</strong></button>
                    <button class="${falseClass} disabled" style="cursor:default;">Sai<strong>${falseIcon}</strong></button>
                </div>`;
            } else if (q.type === 'short_answer') {
                bodyHtml = `
                    <div style="margin-bottom: 0.5rem;">
                        <label style="font-size:0.85rem;color:var(--text-soft);font-weight:600;">Câu trả lời của bạn:</label>
                        <div class="disabled ${isCorrect ? 'opt-review-correct' : 'opt-review-wrong'}" style="padding:0.75rem; border-radius:var(--radius-sm); border:1.5px solid; margin-top:0.25rem;">
                            ${escapeHtml(ans || '(Không trả lời)')} <strong>${isCorrect ? '✅' : '❌'}</strong>
                        </div>
                    </div>
                    ${!isCorrect ? `
                    <div style="margin-top: 0.75rem;">
                        <label style="font-size:0.85rem;color:var(--text-soft);font-weight:600;">Đáp án đúng:</label>
                        <div class="disabled opt-review-correct" style="padding:0.75rem; border-radius:var(--radius-sm); border:1.5px solid; margin-top:0.25rem;">
                            ${escapeHtml(q.correctAnswer)} <strong>✅</strong>
                        </div>
                    </div>` : ''}
                `;
            } else {
                bodyHtml = `<textarea rows="4" disabled style="width:100%; opacity:0.8; cursor:default; border-color:var(--border);">${escapeHtml(ans || '')}</textarea>`;
            }

            return `
                <div class="question-card" style="animation: cardIn 0.35s var(--ease) backwards; animation-delay: ${index * 0.05}s;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 0.75rem;">
                        <div class="q-index" style="margin:0;">Câu ${index + 1} / ${qs.length} · ${QUESTION_TYPES[q.type].icon} ${QUESTION_TYPES[q.type].label}</div>
                        ${badgeHtml}
                    </div>
                    <div class="q-content">${escapeHtml(q.content)}</div>
                    ${bodyHtml}
                </div>
            `;
        }).join('');

        main.innerHTML = `
            <div class="content-header">
                <div class="content-header-main">
                    <h2>Kết quả làm bài</h2>
                    <p>${escapeHtml(exam.title)}</p>
                </div>
                <button class="btn-outline" id="back-btn-top">← Quay lại</button>
            </div>
            <div class="result-hero" style="animation: pageFadeIn 0.4s var(--ease);">
                <div class="score-big">${gradeInfo.accuracy}%</div>
                <p>Đúng ${gradeInfo.earned}/${gradeInfo.possible} điểm chấm được tự động</p>
            </div>
            
            <h3 style="margin:1.5rem 0 1rem; color: var(--primary-dark);">🏆 Bảng xếp hạng</h3>
            <div id="board-slot"></div>
            
            <div style="margin-top: 2.5rem; padding-top: 1.5rem; border-top: 2px dashed var(--border);">
                <h3 style="margin-bottom: 1rem; display: flex; align-items: center; gap: 0.5rem; color: var(--text-heading);">
                    <span>📈</span> Xem lại bài làm
                </h3>
                <div id="review-slot">
                    ${reviewHtml}
                </div>
                
                <div style="display: flex; gap: 1rem; margin-top: 2rem;">
                    <button class="btn-outline" id="back-btn-bottom" style="flex: 1; padding: 1rem;">🏠 Quay lại trang chủ</button>
                    <button id="retry-btn" style="flex: 1; padding: 1rem;">🔄 Làm lại bài thi</button>
                </div>
            </div>
        `;

        document.getElementById('back-btn-top').addEventListener('click', () => setActivePage(backPage));
        document.getElementById('back-btn-bottom').addEventListener('click', () => setActivePage(backPage));
        document.getElementById('retry-btn').addEventListener('click', () => startExam(examId, exam, backPage));
        
        renderLeaderboard(document.getElementById('board-slot'), examId);
    }

    renderTakeExam();
}

/* ==========================================================================
   PROFILE & CUSTOMIZATION
========================================================================== */

async function renderStats(main) {
    const user = getCurrentUser();
    
    // Fetch latest user data
    const userRef = db.ref(`users/${user.userId}`);
    const userSnap = await userRef.once('value');
    const userData = userSnap.val() || {};
    
    let currentBorderId = userData.avatarBorderId || 'none';
    let currentFrameId = userData.chatFrameId || 'none';
    let currentTitleId = userData.chatTitleId || 'none';
    let currentPresetId = userData.avatarPresetId || 'none';
    let currentAvatarUrl = userData.avatarUrl || '';
    let currentDisplayName = userData.displayName || user.username;
    
    const inventory = userData.inventory || { borders: ['none'], frames: ['none'], titles: ['none'], presets: ['none'] };
    const exp = userData.exp || 0;
    const points = userData.points !== undefined ? userData.points : 500;
    const streak = userData.streak || 1;
    
    // Tính toán Level & EXP theo EXP thực tế
    const level = Math.floor(exp / 100) + 1;
    const expProgress = exp % 100;
    
    main.innerHTML = `
        <div class="content-header">
            <div class="content-header-main">
                <h2>👤 Hồ sơ cá nhân</h2>
                <p>Quản lý thành tích, trang bị và cài đặt tài khoản</p>
            </div>
            <button class="btn-outline mobile-only" id="mobile-logout-btn" style="padding: 0.4rem 0.8rem; font-size: 0.85rem;">Đăng xuất</button>
        </div>
        <div class="spinner" id="profile-spinner"></div>
    `;
    
    const mobileLogoutBtn = document.getElementById('mobile-logout-btn');
    if (mobileLogoutBtn) {
        mobileLogoutBtn.addEventListener('click', () => {
            localStorage.removeItem('user');
            showToast('Đã đăng xuất');
            renderAuth();
        });
    }
    
    const [examsSnap, resultsSnap] = await Promise.all([
        db.ref('exams').orderByChild('ownerId').equalTo(user.userId).once('value'),
        db.ref('results').once('value')
    ]);

    const spinner = document.getElementById('profile-spinner');
    if(spinner) spinner.remove();
    
    const exams = examsSnap.val() || {};
    const allResults = resultsSnap.val() || {};
    
    let totalAttempts = 0;

    Object.values(allResults).forEach(examResults => {
        if (examResults[user.userId]) {
            totalAttempts += examResults[user.userId].attempts || 1;
        }
    });

    const borders = getAvatarBorders();
    const frames = getChatFrames();
    const titles = getChatTitles();
    const presets = getPresetAvatars();
    const currentTitleObj = getTitleById(currentTitleId);

    const statsDiv = document.createElement('div');
    statsDiv.innerHTML = `
        <!-- 1. HERO BANNER THÀNH TÍCH -->
        <div class="profile-hero-card">
            <div class="avatar-upload-wrapper" id="profile-avatar-preview" style="position:relative; width:80px; height:80px; flex-shrink:0; cursor:pointer; display:inline-flex; justify-content:center;">
                ${renderAvatarWithBorderObj(currentDisplayName, getBorderById(currentBorderId), 'lg', '', currentAvatarUrl, getPresetById(currentPresetId))}
                <label class="avatar-upload-overlay" title="Tải ảnh từ máy">
                    <span style="font-size: 1.5rem;">📷</span>
                    <input type="file" id="avatar-upload-input" accept="image/*" style="display:none;">
                </label>
            </div>
            
            <div class="profile-hero-info">
                <div style="display: flex; align-items: center; margin-bottom: 0.5rem; flex-wrap: wrap; gap: 0.5rem;">
                    <div style="display: flex; align-items: center; gap: 0.5rem;">
                        ${getTitleHtml(currentTitleObj)}
                        <h2 style="margin: 0; font-size: 1.6rem; color: var(--text-heading);">${escapeHtml(currentDisplayName)}</h2>
                    </div>
                </div>
                <p style="margin: 0 0 1rem 0; font-size: 0.9rem; color: var(--text-soft);">@${escapeHtml(user.username)}</p>

                <div class="profile-stats-row" style="margin-top:0; padding-top:1rem; border-top:1px solid var(--border);">
                    <div class="profile-stat-box">
                        <div style="font-size: 1.3rem; margin-bottom: 0.2rem;">🔥</div>
                        <div style="font-weight: 800; color: #ef4444; font-size: 1.1rem;">${streak}</div>
                        <div style="font-size: 0.7rem; color: var(--text-soft); font-weight: 600;">Chuỗi ngày</div>
                    </div>
                    <div class="profile-stat-box" style="display: flex; flex-direction: column; justify-content: center;">
                        <div style="display: flex; justify-content: space-between; font-size: 0.75rem; font-weight: 800; color: var(--primary-dark); margin-bottom: 0.2rem;">
                            <span>🏆 Lv.${level}</span>
                            <span>${Math.round(expProgress)}%</span>
                        </div>
                        <div class="level-progress-track" style="margin-top: 0; margin-bottom: 0.2rem; height: 6px;">
                            <div class="level-progress-fill" style="width: ${expProgress}%"></div>
                        </div>
                        <div style="font-size: 0.7rem; color: var(--text-soft); font-weight: 600; margin-top: auto;">Tiến trình</div>
                    </div>
                    <div class="profile-stat-box">
                        <div style="font-size: 1.3rem; margin-bottom: 0.2rem;">💰</div>
                        <div style="font-weight: 800; color: #d97706; font-size: 1.1rem;">${points}</div>
                        <div style="font-size: 0.7rem; color: var(--text-soft); font-weight: 600;">Điểm thưởng</div>
                    </div>
                    <div class="profile-stat-box">
                        <div style="font-size: 1.3rem; margin-bottom: 0.2rem;">📜</div>
                        <div style="font-weight: 800; color: var(--primary-dark); font-size: 1.1rem;">${totalAttempts}</div>
                        <div style="font-size: 0.7rem; color: var(--text-soft); font-weight: 600;">Bài đã làm</div>
                    </div>
                </div>
            </div>
        </div>

        <!-- 2. TRANG BỊ CÁ NHÂN -->
        <div class="content-header" style="margin-top: 2rem;">
            <div class="content-header-main">
                <h2>🎨 Tủ đồ trang bị</h2>
                <p>Tùy chỉnh diện mạo của bạn trên Chat Tổng</p>
            </div>
            <button id="save-equip-btn" style="padding: 0.6rem 1.2rem; font-size: 0.9rem; box-shadow: var(--shadow-sm); white-space: nowrap;">💾 Lưu Trang Bị</button>
        </div>
        
        <div class="form-card stagger-0" style="margin-top: 0.5rem; animation: cardIn 0.4s var(--ease) backwards;">
            <h3 style="margin-top: 0; margin-bottom: 0.5rem; color: var(--text-heading); font-size: 1.1rem;">🖼️ Thư viện Avatar có sẵn</h3>
            <div class="avatar-grid" id="preset-grid">
                ${presets.map(a => {
                    const price = Number(a.price || 0);
                    const isOwned = price === 0 || (inventory.presets && inventory.presets.includes(a.id));
                    return `
                    <div class="picker-card ${currentPresetId === a.id ? 'active' : ''} ${!isOwned ? 'item-locked' : ''}" data-group="preset" data-value="${a.id}" data-url="${escapeHtml(a.url)}" data-owned="${isOwned}">
                        ${!isOwned ? `<div class="locked-overlay">🔒</div>` : ''}
                        <div class="picker-preview" style="height: 100px;">
                            ${renderAvatarWithBorderObj('A', {id:'none'}, 'lg', '', a.url, a)}
                        </div>
                        <div class="picker-name" style="font-size: 0.75rem;">${escapeHtml(a.name)}</div>
                    </div>
                `}).join('')}
            </div>
        </div>
        
        <div class="form-card stagger-1" style="margin-top: 1.25rem; animation: cardIn 0.4s var(--ease) backwards; animation-delay: 0.05s;">
            <h3 style="margin-top: 0; margin-bottom: 0.5rem; color: var(--text-heading); font-size: 1.1rem;">🖼️ Viền Avatar</h3>
            <div class="avatar-grid" id="border-grid">
                ${borders.map(b => {
                    const price = Number(b.price || 0);
                    const isOwned = price === 0 || (inventory.borders && inventory.borders.includes(b.id));
                    return `
                    <div class="picker-card ${currentBorderId === b.id ? 'active' : ''} ${!isOwned ? 'item-locked' : ''}" data-group="border" data-value="${b.id}" data-owned="${isOwned}">
                        ${!isOwned ? `<div class="locked-overlay">🔒</div>` : ''}
                        <div class="picker-preview" style="height: 100px;">
                            ${renderAvatarWithBorderObj('A', b, 'lg')}
                        </div>
                        <div class="picker-name" style="font-size: 0.75rem;">${escapeHtml(b.name)}</div>
                    </div>
                `}).join('')}
            </div>
        </div>

        <div class="form-card stagger-2" style="margin-top: 1.25rem; animation: cardIn 0.4s var(--ease) backwards; animation-delay: 0.1s;">
            <h3 style="margin-top: 0; margin-bottom: 0.5rem; color: var(--text-heading); font-size: 1.1rem;">💬 Khung Chat</h3>
            <div class="visual-picker-grid">
                ${frames.map(f => {
                    const price = Number(f.price || 0);
                    const isOwned = price === 0 || (inventory.frames && inventory.frames.includes(f.id));
                    let styleBlock = '';
                    if (f.effectCode && !document.getElementById('frame-style-' + f.id)) {
                        styleBlock = `<style id="frame-style-${f.id}">${f.effectCode}</style>`;
                    }
                    return `
                    <div class="picker-card ${currentFrameId === f.id ? 'active' : ''} ${!isOwned ? 'item-locked' : ''}" data-group="frame" data-value="${f.id}" data-owned="${isOwned}">
                        ${!isOwned ? `<div class="locked-overlay">🔒</div>` : ''}
                        <div class="picker-preview">
                            ${styleBlock}
                            <div class="frame-${f.id}" style="font-size: 0.8rem; padding: 0.5rem 0.75rem; border-radius: 1rem; ${f.designCode ? f.designCode : 'background: var(--surface); color: var(--text-heading); border: 1px solid var(--border);'}">
                                Xin chào! 👋
                            </div>
                        </div>
                        <div class="picker-name">${escapeHtml(f.name)}</div>
                    </div>
                `}).join('')}
            </div>
        </div>

        <div class="form-card stagger-3" style="margin-top: 1.25rem; animation: cardIn 0.4s var(--ease) backwards; animation-delay: 0.15s;">
            <h3 style="margin-top: 0; margin-bottom: 0.5rem; color: var(--text-heading); font-size: 1.1rem;">👑 Danh hiệu</h3>
            <div class="visual-picker-grid">
                ${titles.map(t => {
                    const price = Number(t.price || 0);
                    const isOwned = price === 0 || (inventory.titles && inventory.titles.includes(t.id));
                    return `
                    <div class="picker-card ${currentTitleId === t.id ? 'active' : ''} ${!isOwned ? 'item-locked' : ''}" data-group="title" data-value="${t.id}" data-owned="${isOwned}">
                        ${!isOwned ? `<div class="locked-overlay">🔒</div>` : ''}
                        <div class="picker-preview">
                            <div style="display:flex; align-items:center;">
                                ${getTitleHtml(t)}
                                <span style="font-size: 0.85rem; font-weight: 700; color: var(--text-heading);">Tên</span>
                            </div>
                        </div>
                        <div class="picker-name">${escapeHtml(t.name)}</div>
                    </div>
                `}).join('')}
            </div>
        </div>

        <!-- 3. CÀI ĐẶT TÀI KHOẢN -->
        <div class="content-header" style="margin-top: 2.5rem;">
            <div class="content-header-main">
                <h2>⚙️ Cài đặt tài khoản</h2>
            </div>
        </div>
        <div class="form-card" style="margin-top: 0.5rem;">
            <div class="field" style="max-width: 400px;">
                <label>Tên hiển thị</label>
                <div style="display:flex; gap:0.5rem;">
                    <input type="text" id="setting-display-name" value="${escapeHtml(currentDisplayName)}" style="flex:1;">
                    <button id="save-name-btn" class="btn-outline">Cập nhật</button>
                </div>
            </div>
            <div class="field" style="max-width: 400px; margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px dashed var(--border);">
                <h4 style="margin: 0 0 1rem 0; color: var(--text-heading); font-size: 1rem;">🔐 Đổi mật khẩu</h4>
                <div style="display:flex; flex-direction:column; gap:0.75rem;">
                    <input type="password" id="setting-old-pw" placeholder="Mật khẩu hiện tại">
                    <input type="password" id="setting-new-pw" placeholder="Mật khẩu mới (tối thiểu 6 ký tự)">
                    <input type="password" id="setting-confirm-pw" placeholder="Xác nhận mật khẩu mới">
                    <button id="save-pw-btn" class="btn-outline" style="width: fit-content; margin-top: 0.5rem;">Cập nhật mật khẩu</button>
                </div>
            </div>
        </div>
    `;
    main.appendChild(statsDiv);

    function updateProfilePreview() {
        const previewEl = document.getElementById('profile-avatar-preview');
        if(previewEl) {
            previewEl.innerHTML = `
                ${renderAvatarWithBorderObj(currentDisplayName, getBorderById(currentBorderId), 'lg', '', currentAvatarUrl, getPresetById(currentPresetId))}
                <label class="avatar-upload-overlay" title="Tải ảnh từ máy">
                    <span style="font-size: 1.5rem;">📷</span>
                    <input type="file" id="avatar-upload-input" accept="image/*" style="display:none;">
                </label>
            `;
            bindFileInput();
        }
    }

    function bindFileInput() {
        const uploadInput = document.getElementById('avatar-upload-input');
        if (uploadInput) {
            uploadInput.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (!file) return;

                const reader = new FileReader();
                reader.onload = function(event) {
                    showCropperModal(event.target.result, (base64Img) => {
                        currentAvatarUrl = base64Img;
                        currentPresetId = 'none'; // Reset preset if uploading custom
                        main.querySelectorAll('.picker-card[data-group="preset"]').forEach(c => c.classList.remove('active'));
                        updateProfilePreview();
                    });
                };
                reader.readAsDataURL(file);
                e.target.value = '';
            });
        }
    }

    // Bind Picker Cards
    main.querySelectorAll('.picker-card').forEach(card => {
        card.addEventListener('click', () => {
            if (card.dataset.owned === 'false') return;

            const group = card.dataset.group;
            const value = card.dataset.value;
            const url = card.dataset.url;
            
            main.querySelectorAll(`.picker-card[data-group="${group}"]`).forEach(c => c.classList.remove('active'));
            card.classList.add('active');

            if (group === 'preset') {
                currentPresetId = value;
                currentAvatarUrl = url || '';
            }
            if (group === 'border') currentBorderId = value;
            if (group === 'frame') currentFrameId = value;
            if (group === 'title') currentTitleId = value;

            updateProfilePreview();
        });
    });

    bindFileInput();

    // Bind Name Change
    document.getElementById('save-name-btn').addEventListener('click', async () => {
        const newName = document.getElementById('setting-display-name').value.trim();
        if(!newName) return showToast('Tên không được để trống', 'error');
        try {
            await db.ref(`users/${user.userId}`).update({ displayName: newName });
            currentDisplayName = newName;
            updateProfilePreview();
            showToast('Đã cập nhật tên hiển thị!');
            
            // Re-render hero name
            const heroNameEl = main.querySelector('.profile-hero-info h2');
            if(heroNameEl) heroNameEl.textContent = newName;
        } catch(e) {
            showToast('Lỗi cập nhật tên', 'error');
        }
    });

    // Bind Change Password
    document.getElementById('save-pw-btn').addEventListener('click', async () => {
        const oldPw = document.getElementById('setting-old-pw').value;
        const newPw = document.getElementById('setting-new-pw').value;
        const confirmPw = document.getElementById('setting-confirm-pw').value;

        if (!oldPw || !newPw || !confirmPw) return showToast('Vui lòng nhập đầy đủ thông tin mật khẩu!', 'error');
        if (newPw.length < 6) return showToast('Mật khẩu mới phải có ít nhất 6 ký tự!', 'error');
        if (newPw !== confirmPw) return showToast('Mật khẩu xác nhận không khớp!', 'error');

        const btn = document.getElementById('save-pw-btn');
        btn.disabled = true;
        btn.textContent = 'Đang kiểm tra...';

        try {
            const snap = await db.ref(`users/${user.userId}`).once('value');
            const data = snap.val();
            const hashedOldPw = CryptoJS.SHA256(oldPw).toString();

            if (data.passwordHash !== hashedOldPw) {
                showToast('Mật khẩu hiện tại không đúng!', 'error');
                btn.disabled = false;
                btn.textContent = 'Cập nhật mật khẩu';
                return;
            }

            const hashedNewPw = CryptoJS.SHA256(newPw).toString();
            await db.ref(`users/${user.userId}`).update({ passwordHash: hashedNewPw });
            
            showToast('Đổi mật khẩu thành công!', 'success');
            document.getElementById('setting-old-pw').value = '';
            document.getElementById('setting-new-pw').value = '';
            document.getElementById('setting-confirm-pw').value = '';
        } catch (e) {
            showToast('Lỗi đổi mật khẩu', 'error');
        } finally {
            btn.disabled = false;
            btn.textContent = 'Cập nhật mật khẩu';
        }
    });

    // Bind Save Equipment
    document.getElementById('save-equip-btn').addEventListener('click', async () => {
        const btn = document.getElementById('save-equip-btn');
        btn.textContent = 'Đang lưu...';
        btn.disabled = true;

        try {
            await db.ref(`users/${user.userId}`).update({
                avatarBorderId: currentBorderId,
                chatFrameId: currentFrameId,
                chatTitleId: currentTitleId,
                avatarPresetId: currentPresetId,
                avatarUrl: currentAvatarUrl
            });
            showToast('Đã lưu trang bị thành công!');
            
            // Re-render the title in Hero if it changed
            const titleObj = getTitleById(currentTitleId);
            const titleContainer = main.querySelector('.profile-hero-info h2').previousElementSibling;
            if(titleContainer && titleContainer.tagName === 'SPAN') {
                titleContainer.outerHTML = getTitleHtml(titleObj);
            } else {
                main.querySelector('.profile-hero-info h2').insertAdjacentHTML('beforebegin', getTitleHtml(titleObj));
            }
            
        } catch(e) {
            showToast('Lỗi khi lưu trang bị', 'error');
        } finally {
            if(btn) {
                btn.textContent = '💾 Lưu Trang Bị';
                btn.disabled = false;
            }
        }
    });
}

async function renderHistory(main) {
    const user = getCurrentUser();
    main.innerHTML = `
        <div class="content-header">
            <div class="content-header-main">
                <h2>🕐 Lịch sử làm bài</h2>
            </div>
        </div>
        <div class="spinner"></div>
    `;
    
    const resultsSnap = await db.ref('results').once('value');
    const allResults = resultsSnap.val() || {};
    const history = [];

    for (const examId in allResults) {
        if (allResults[examId][user.userId]) {
            const r = allResults[examId][user.userId];
            const examSnap = await db.ref(`exams/${examId}`).once('value');
            history.push({ title: examSnap.val()?.title || 'Đề thi đã xóa', ...r });
        }
    }

    if (history.length === 0) {
        main.innerHTML = `
            <div class="content-header">
                <div class="content-header-main">
                    <h2>🕐 Lịch sử làm bài</h2>
                </div>
            </div>
            <div class="empty-state">Chưa có lịch sử làm bài.</div>
        `;
        return;
    }

    main.innerHTML = `
        <div class="content-header">
            <div class="content-header-main">
                <h2>🕐 Lịch sử làm bài</h2>
            </div>
        </div>
        <table class="leaderboard">
            <thead><tr><th>Đề thi</th><th>Điểm</th><th>Thời gian</th></tr></thead>
            <tbody>
                ${history.map(r => `<tr><td>${escapeHtml(r.title)}</td><td>${r.accuracy}%</td><td>${new Date(r.submittedAt).toLocaleDateString()}</td></tr>`).join('')}
            </tbody>
        </table>
    `;
}

async function renderLibrary(main) {
    const user = getCurrentUser();
    main.innerHTML = `
        <div class="content-header">
            <div class="content-header-main">
                <h2>Thư viện của bạn</h2>
                <p>Quản lý các đề thi bạn đã tạo</p>
            </div>
        </div>
        <div class="card-grid" id="library-grid"><div class="skeleton"></div><div class="skeleton"></div></div>
    `;

    try {
        const snap = await db.ref('exams').orderByChild('ownerId').equalTo(user.userId).once('value');
        const exams = snap.val() || {};
        const grid = document.getElementById('library-grid');
        const entries = Object.entries(exams);

        if (entries.length === 0) {
            grid.innerHTML = `<div class="empty-state" style="grid-column:1/-1;"><span class="emoji">📭</span>Bạn chưa tạo đề thi nào. Bấm "Tạo bài thi" để bắt đầu!</div>`;
            return;
        }

        grid.innerHTML = entries.map(([id, exam], i) => {
            const qCount = exam.questions ? Object.keys(exam.questions).length : 0;
            return `
                <div class="exam-card flex flex-col h-full" style="animation-delay:${i * 0.05}s">
                    <div class="card-body flex-1">
                        <h3 class="title">${escapeHtml(exam.title)}</h3>
                        <p class="description" style="font-size:0.85rem;color:var(--text-soft);margin:0;">${escapeHtml(exam.description || 'Không có mô tả')}</p>
                    </div>
                    <div class="card-footer pt-4">
                        <div class="meta flex items-center gap-2 mb-3" style="flex-wrap: wrap;">
                            <span class="badge blue">🏷️ ${escapeHtml(exam.subjectTag || 'Khác')}</span>
                            <span class="badge copy-pin-btn" data-pin="${exam.pin || ''}" style="background:#fef08a;color:#92400e;cursor:pointer;" title="Nhấn để copy mã PIN">🔑 PIN: ${exam.pin || 'Chưa có'}</span>
                            <span class="badge">${qCount} câu hỏi</span>
                            <span class="badge ${exam.isPublic ? 'mint' : 'peach'}">${exam.isPublic ? 'Công khai' : 'Riêng tư'}</span>
                        </div>
                        <div class="card-actions grid grid-cols-2 gap-2 mt-2">
                            <button class="btn-outline edit-btn" data-id="${id}">Chỉnh sửa</button>
                            <button class="btn-outline toggle-btn" data-id="${id}">${exam.isPublic ? 'Ẩn' : 'Công khai'}</button>
                            <button class="btn-outline board-btn" data-id="${id}">Bảng xếp hạng</button>
                            <button class="btn-danger delete-btn" data-id="${id}">Xóa</button>
                        </div>
                    </div>
                </div>
            `;
        }).join('');

        grid.querySelectorAll('.copy-pin-btn').forEach(b => {
            b.addEventListener('click', () => {
                const pin = b.dataset.pin;
                if(pin && pin !== 'Chưa có') {
                    navigator.clipboard.writeText(pin);
                    showToast('Đã copy mã PIN: ' + pin);
                }
            });
        });

        grid.querySelectorAll('.edit-btn').forEach(b => {
            b.addEventListener('click', () => setActivePage('create', { editExamId: b.dataset.id }));
        });
        grid.querySelectorAll('.board-btn').forEach(b => {
            b.addEventListener('click', () => showLeaderboardPage(b.dataset.id, exams[b.dataset.id], 'library'));
        });
        grid.querySelectorAll('.toggle-btn').forEach(b => {
            b.addEventListener('click', async () => {
                const id = b.dataset.id;
                const newVal = !exams[id].isPublic;
                await db.ref(`exams/${id}`).update({ isPublic: newVal });
                showToast(newVal ? 'Đã công khai đề thi' : 'Đã chuyển về riêng tư');
                renderLibrary(main);
            });
        });
        grid.querySelectorAll('.delete-btn').forEach(b => {
            b.addEventListener('click', () => {
                const id = b.dataset.id;
                showConfirmModal({
                    title: 'Xóa đề thi?',
                    message: 'Hành động này không thể hoàn tác. Toàn bộ câu hỏi và kết quả liên quan sẽ bị xóa.',
                    confirmText: 'Xóa',
                    onConfirm: async () => {
                        await db.ref(`exams/${id}`).remove();
                        await db.ref(`results/${id}`).remove();
                        showToast('Đã xóa đề thi');
                        renderLibrary(main);
                    }
                });
            });
        });
    } catch (err) {
        document.getElementById('library-grid').innerHTML = `<div class="empty-state" style="grid-column:1/-1;">Lỗi tải dữ liệu. Thử lại sau.</div>`;
    }
}

/* ==========================================================================
   CREATE EXAM — CHOICE
========================================================================== */

async function renderCreateChoice(main, editExamId) {
    if (editExamId) {
        main.innerHTML = `<div class="spinner"></div>`;
        const snap = await db.ref(`exams/${editExamId}`).once('value');
        const exam = snap.val();
        if (!exam) { showToast('Không tìm thấy đề thi', 'error'); return renderCreateChoice(main, null); }
        return renderManualCreateForm(main, editExamId, exam);
    }

    main.innerHTML = `
        <div class="content-header">
            <div class="content-header-main">
                <h2>Tạo bài thi</h2>
                <p>Chọn cách bạn muốn tạo đề thi mới</p>
            </div>
        </div>
        <div class="choice-grid">
            <button class="choice-card" id="manual-create">
                <span class="choice-icon">🛠️</span><h3>Tạo thủ công</h3>
                <p>Tự nhập từng câu hỏi: trắc nghiệm, trả lời ngắn, đúng/sai, tự luận.</p>
            </button>
            <button class="choice-card" id="ai-create">
                <span class="choice-icon">🤖</span><h3>Tạo thông minh (AI)</h3>
                <p>Dán JSON do AI tạo sẵn từ file đề thi của bạn để tạo đề chỉ trong vài giây.</p>
            </button>
        </div>
        <div id="create-form"></div>
    `;

    document.getElementById('manual-create').addEventListener('click', () => renderManualCreateForm(main, null, null));
    document.getElementById('ai-create').addEventListener('click', () => renderAiCreateForm(main));
}

/* ==========================================================================
   MANUAL CREATE / EDIT FORM
========================================================================== */

function renderManualCreateForm(main, editExamId, existingExam) {
    const state = {
        title: existingExam?.title || '',
        description: existingExam?.description || '',
        subjectTag: existingExam?.subjectTag || 'Khác',
        isPublic: existingExam?.isPublic || false,
        timeLimit: existingExam?.timeLimit || 0,
        isShuffleEnabled: existingExam?.isShuffleEnabled || false,
        questions: existingExam?.questions
            ? Object.entries(existingExam.questions).map(([id, q]) => ({ id, ...q })).sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
            : [],
        pickerType: null
    };

    function renderAll() {
        main.innerHTML = `
            <style>
                .setting-row { display: flex; align-items: center; justify-content: space-between; padding: 1.2rem 0; border-bottom: 1.5px solid var(--border); }
                .setting-row:last-child { border-bottom: none; padding-bottom: 0; }
                .setting-info h4 { margin: 0 0 0.25rem 0; font-size: 1.05rem; color: var(--text-heading); font-weight: 700; }
                .setting-info p { margin: 0; font-size: 0.85rem; color: var(--text-soft); }
                .custom-switch { position: relative; display: inline-block; width: 48px; height: 26px; flex-shrink: 0; }
                .custom-switch input { opacity: 0; width: 0; height: 0; }
                .custom-slider { position: absolute; cursor: pointer; top: 0; left: 0; right: 0; bottom: 0; background-color: #cbd5e1; transition: 0.35s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 34px; box-shadow: inset 0 2px 4px rgba(0,0,0,0.05); }
                .custom-slider:before { position: absolute; content: ""; height: 20px; width: 20px; left: 3px; bottom: 3px; background-color: white; transition: 0.35s cubic-bezier(0.4, 0, 0.2, 1); border-radius: 50%; box-shadow: 0 2px 4px rgba(0,0,0,0.15); }
                .custom-switch input:checked + .custom-slider { background: linear-gradient(135deg, var(--primary), var(--secondary)); }
                .custom-switch input:checked + .custom-slider:before { transform: translateX(22px); }
                .timer-expand { max-height: 0; opacity: 0; overflow: hidden; transition: all 0.4s cubic-bezier(0.4, 0, 0.2, 1); transform: translateY(-10px); }
                .timer-expand.show { max-height: 100px; opacity: 1; transform: translateY(0); margin-top: 1rem; margin-bottom: 0.5rem; }
                .stagger-1 { animation-delay: 0.05s; }
                .stagger-2 { animation-delay: 0.15s; }
            </style>

            <div class="content-header">
                <div class="content-header-main">
                    <h2>${editExamId ? 'Chỉnh sửa đề thi' : 'Tạo đề thi thủ công'}</h2>
                    <p>Điền thông tin và thêm câu hỏi bên dưới</p>
                </div>
                <button class="btn-outline" id="back-btn">← Quay lại</button>
            </div>
            
            <div class="form-card stagger-1" style="animation: cardIn 0.45s var(--ease) backwards;">
                <h3 style="margin-top: 0; margin-bottom: 1.2rem; display: flex; align-items: center; gap: 0.5rem; color: var(--primary-dark);"><span>📝</span> Thông tin chung</h3>
                <div class="form-row">
                    <div class="field">
                        <label>Tên đề thi</label>
                        <input type="text" id="exam-title" placeholder="vd: Kiểm tra Toán chương 1" value="${escapeHtml(state.title)}">
                    </div>
                    <div class="field">
                        <label>Mô tả ngắn</label>
                        <input type="text" id="exam-desc" placeholder="Mô tả ngắn gọn..." value="${escapeHtml(state.description)}">
                    </div>
                </div>
            </div>
            
            <div class="form-card stagger-2" style="animation: cardIn 0.45s var(--ease) backwards; margin-top: 1.25rem;">
                <h3 style="margin-top: 0; margin-bottom: 0.5rem; display: flex; align-items: center; gap: 0.5rem; color: var(--primary-dark);"><span>⚙️</span> Tùy chỉnh bài thi</h3>
                
                <div class="setting-row">
                    <div class="setting-info">
                        <h4>🏷️ Môn học / Thẻ phân loại</h4>
                        <p>Phân loại đề thi theo môn học</p>
                    </div>
                    <select id="exam-subject" style="padding: 0.5rem; border-radius: var(--radius-sm); border: 1.5px solid var(--border); outline: none; font-family: inherit; font-weight: 600; color: var(--text-heading); background: var(--surface);">
                        ${SUBJECTS.map(subj => `<option value="${subj}" ${state.subjectTag === subj ? 'selected' : ''}>${subj}</option>`).join('')}
                    </select>
                </div>

                <div class="setting-row">
                    <div class="setting-info">
                        <h4>Công khai đề thi</h4>
                        <p>Cho phép mọi người tìm thấy và làm bài thi này trong cộng đồng</p>
                    </div>
                    <label class="custom-switch">
                        <input type="checkbox" id="exam-public" ${state.isPublic ? 'checked' : ''}>
                        <span class="custom-slider"></span>
                    </label>
                </div>

                <div class="setting-row">
                    <div class="setting-info">
                        <h4>Giới hạn thời gian</h4>
                        <p>Hệ thống tự động thu bài khi đồng hồ đếm ngược kết thúc</p>
                    </div>
                    <label class="custom-switch">
                        <input type="checkbox" id="exam-timer-toggle" ${state.timeLimit > 0 ? 'checked' : ''}>
                        <span class="custom-slider"></span>
                    </label>
                </div>
                
                <div class="timer-expand ${state.timeLimit > 0 ? 'show' : ''}" id="timer-input-wrapper">
                    <div class="field" style="background: var(--surface); padding: 1rem; border-radius: var(--radius-sm); border: 1.5px dashed var(--primary);">
                        <label style="color: var(--primary-dark); font-weight: 700;">Thời gian làm bài (Phút)</label>
                        <input type="number" id="exam-time-limit" min="1" placeholder="Nhập số phút..." value="${state.timeLimit || 15}" style="border-color: var(--border);">
                    </div>
                </div>

                <div class="setting-row" style="border-bottom: none; padding-bottom: 0;">
                    <div class="setting-info">
                        <h4>Trộn ngẫu nhiên 🔀</h4>
                        <p>Đảo vị trí hiển thị của cả Câu hỏi & Đáp án mỗi lần học sinh làm bài</p>
                    </div>
                    <label class="custom-switch">
                        <input type="checkbox" id="exam-shuffle-toggle" ${state.isShuffleEnabled ? 'checked' : ''}>
                        <span class="custom-slider"></span>
                    </label>
                </div>
            </div>

            <div style="margin-top: 2rem; display: flex; justify-content: space-between; align-items: center;">
                <h3 style="color: var(--primary-dark);">Danh sách câu hỏi (${state.questions.length})</h3>
                <button id="add-question-btn" style="box-shadow: var(--shadow-md);">+ Thêm câu hỏi</button>
            </div>
            
            <div id="questions-list" style="margin-top: 1rem;"></div>
            <div id="picker-slot"></div>

            <button id="save-exam-btn" style="width: 100%; margin-top: 2rem; padding: 1rem; font-size: 1.1rem; border-radius: var(--radius-md); box-shadow: var(--shadow-lg);">${editExamId ? '💾 Lưu thay đổi' : '✨ Tạo đề thi mới'}</button>
        `;

        document.getElementById('back-btn').addEventListener('click', () => setActivePage(editExamId ? 'library' : 'create'));
        
        document.getElementById('exam-title').addEventListener('input', e => state.title = e.target.value);
        document.getElementById('exam-desc').addEventListener('input', e => state.description = e.target.value);
        document.getElementById('exam-subject').addEventListener('change', e => state.subjectTag = e.target.value);
        document.getElementById('exam-public').addEventListener('change', e => state.isPublic = e.target.checked);
        document.getElementById('exam-shuffle-toggle').addEventListener('change', e => state.isShuffleEnabled = e.target.checked);
        
        const timerToggle = document.getElementById('exam-timer-toggle');
        const timerWrapper = document.getElementById('timer-input-wrapper');
        const timerInput = document.getElementById('exam-time-limit');
        
        timerToggle.addEventListener('change', e => {
            if (e.target.checked) {
                timerWrapper.classList.add('show');
                state.timeLimit = parseInt(timerInput.value) || 15;
                timerInput.focus();
            } else {
                timerWrapper.classList.remove('show');
                state.timeLimit = 0;
            }
        });
        
        timerInput.addEventListener('input', e => {
            if (timerToggle.checked) state.timeLimit = parseInt(e.target.value) || 0;
        });

        document.getElementById('add-question-btn').addEventListener('click', () => { state.pickerType = 'choose'; renderPicker(); });
        document.getElementById('save-exam-btn').addEventListener('click', saveExam);

        renderQuestionsList();
    }

    function renderQuestionsList() {
        const listEl = document.getElementById('questions-list');
        if (state.questions.length === 0) {
            listEl.innerHTML = `<div class="empty-state"><span class="emoji">📝</span>Chưa có câu hỏi nào. Bấm "+ Thêm câu hỏi" để bắt đầu.</div>`;
            return;
        }
        listEl.innerHTML = state.questions.map((q, i) => `
            <div class="question-item" style="animation: cardIn 0.35s var(--ease) backwards; animation-delay: ${i * 0.04}s; border: 1.5px solid transparent; transition: border-color 0.25s, transform 0.25s;">
                <div class="q-item-header">
                    <strong>Câu ${i + 1} · ${QUESTION_TYPES[q.type].icon} ${QUESTION_TYPES[q.type].label}</strong>
                    <div class="q-item-actions">
                        <button class="btn-ghost edit-q-btn" data-i="${i}" style="color: var(--accent);">Sửa</button>
                        <button class="btn-ghost remove-q-btn" data-i="${i}" style="color: #ef4477;">Xóa</button>
                    </div>
                </div>
                <p style="margin: 0; color: var(--text-soft); font-size: 0.95rem;">${escapeHtml(q.content)}</p>
            </div>
        `).join('');

        listEl.querySelectorAll('.question-item').forEach(item => {
            item.addEventListener('mouseenter', () => {
                item.style.borderColor = 'var(--primary)';
                item.style.transform = 'translateY(-2px)';
            });
            item.addEventListener('mouseleave', () => {
                item.style.borderColor = 'transparent';
                item.style.transform = 'none';
            });
        });

        listEl.querySelectorAll('.remove-q-btn').forEach(b => {
            b.addEventListener('click', () => {
                state.questions.splice(Number(b.dataset.i), 1);
                renderQuestionsList();
            });
        });
        listEl.querySelectorAll('.edit-q-btn').forEach(b => {
            b.addEventListener('click', () => {
                state.pickerType = 'edit';
                state.editingIndex = Number(b.dataset.i);
                renderPicker(state.questions[state.editingIndex]);
            });
        });
    }

    function renderPicker(existingQ = null) {
        const pickerSlot = document.getElementById('picker-slot');
        if (!state.pickerType) { pickerSlot.innerHTML = ''; return; }

        let chosenType = existingQ?.type || null;

        function renderPickerBody() {
            pickerSlot.innerHTML = `
                <div class="form-card" style="animation: cardIn 0.4s var(--ease) backwards; border: 1.5px solid var(--primary); box-shadow: var(--shadow-md);">
                    <p style="font-weight: 700; margin-bottom: 0.75rem; color: var(--primary-dark);">Chọn loại câu hỏi</p>
                    <div class="qtype-picker">
                        ${Object.entries(QUESTION_TYPES).map(([type, meta]) => `
                            <button class="${chosenType === type ? 'selected' : ''}" data-type="${type}" style="transition: all 0.2s;">
                                <span style="font-size:1.5rem; margin-bottom: 0.25rem;">${meta.icon}</span>${meta.label}
                            </button>
                        `).join('')}
                    </div>
                    <div id="qfields"></div>
                </div>
            `;

            pickerSlot.querySelectorAll('.qtype-picker button').forEach(b => {
                b.addEventListener('click', () => { 
                    chosenType = b.dataset.type; 
                    renderPickerBody(); 
                    renderFields(); 
                });
            });
            renderFields();
            
            // Smoothly scroll to the picker so user knows it opened
            pickerSlot.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }

        function renderFields() {
            const fieldsEl = document.getElementById('qfields');
            if (!chosenType) { fieldsEl.innerHTML = ''; return; }

            let html = `
                <div class="field" style="margin-top: 1.25rem; animation: pageFadeIn 0.3s var(--ease);">
                    <label>Nội dung câu hỏi</label>
                    <textarea id="q-content" rows="2" placeholder="Nhập nội dung câu hỏi..." style="border-color: var(--border);">${escapeHtml(existingQ?.type === chosenType ? (existingQ.content || '') : '')}</textarea>
                </div>
            `;

            if (chosenType === 'multiple_choice') {
                const opts = existingQ?.type === 'multiple_choice' ? existingQ.options : {};
                const correct = existingQ?.type === 'multiple_choice' ? existingQ.correctAnswer : null;
                html += ['A','B','C','D'].map((letter, idx) => `
                    <div class="option-input-row" style="animation: pageFadeIn 0.3s var(--ease); animation-delay: ${idx * 0.05}s; animation-fill-mode: backwards;">
                        <span class="opt-tag">${letter}</span>
                        <input type="text" id="opt-${letter}" placeholder="Lựa chọn ${letter}" value="${escapeHtml(opts?.[letter] || '')}" style="flex:1; border-color: var(--border);">
                        <label style="display:flex; align-items:center; gap:0.4rem; font-size:0.85rem; font-weight: 600; white-space:nowrap; cursor: pointer;">
                            <input type="radio" name="correct-opt" value="${letter}" style="width: 1.1rem; height: 1.1rem; accent-color: var(--accent-mint); cursor: pointer;" ${correct === letter ? 'checked' : ''}> Đáp án đúng
                        </label>
                    </div>
                `).join('');
            } else if (chosenType === 'short_answer') {
                const correct = existingQ?.type === 'short_answer' ? existingQ.correctAnswer : '';
                html += `<div class="field" style="animation: pageFadeIn 0.3s var(--ease); margin-top: 0.75rem;"><label>Đáp án đúng</label><input type="text" id="q-correct" value="${escapeHtml(correct)}" placeholder="Nhập đáp án chính xác nhất để hệ thống chấm" style="border-color: var(--border);"></div>`;
            } else if (chosenType === 'true_false') {
                const correct = existingQ?.type === 'true_false' ? existingQ.correctAnswer : null;
                html += `<div class="tf-buttons" style="margin-top:1rem; animation: pageFadeIn 0.3s var(--ease);">
                    <button type="button" class="tf-pick ${correct === true ? 'selected' : ''}" data-val="true" style="padding: 0.75rem;">Đúng</button>
                    <button type="button" class="tf-pick ${correct === false ? 'selected' : ''}" data-val="false" style="padding: 0.75rem;">Sai</button>
                </div>`;
            } else {
                html += `<p style="color:var(--text-soft); font-size:0.85rem; margin-top: 0.75rem; animation: pageFadeIn 0.3s var(--ease);">* Lưu ý: Câu tự luận sẽ không được hệ thống chấm điểm tự động. Bạn cần tự đọc và đánh giá.</p>`;
            }

            html += `
                <div style="display: flex; gap: 0.75rem; margin-top: 1.5rem; animation: pageFadeIn 0.3s var(--ease) backwards; animation-delay: 0.2s;">
                    <button id="confirm-question-btn" style="flex: 1;">${state.pickerType === 'edit' ? 'Cập nhật câu hỏi' : 'Xong, Thêm vào đề'}</button>
                    <button class="btn-outline" id="cancel-question-btn" style="padding: 0.85rem 1.5rem;">Hủy</button>
                </div>
            `;

            fieldsEl.innerHTML = html;

            let tfValue = existingQ?.type === 'true_false' ? existingQ.correctAnswer : null;
            fieldsEl.querySelectorAll('.tf-pick').forEach(b => {
                b.addEventListener('click', () => {
                    tfValue = b.dataset.val === 'true';
                    fieldsEl.querySelectorAll('.tf-pick').forEach(x => x.classList.remove('selected'));
                    b.classList.add('selected');
                });
            });

            document.getElementById('cancel-question-btn').addEventListener('click', () => {
                state.pickerType = null;
                pickerSlot.innerHTML = '';
            });

            document.getElementById('confirm-question-btn').addEventListener('click', () => {
                const content = document.getElementById('q-content').value.trim();
                if (!content) { showToast('Vui lòng nhập nội dung câu hỏi', 'error'); return; }

                let newQ = { type: chosenType, content, points: 1, order: state.questions.length };

                if (chosenType === 'multiple_choice') {
                    const options = {
                        A: document.getElementById('opt-A').value.trim(),
                        B: document.getElementById('opt-B').value.trim(),
                        C: document.getElementById('opt-C').value.trim(),
                        D: document.getElementById('opt-D').value.trim()
                    };
                    const correctRadio = fieldsEl.querySelector('input[name="correct-opt"]:checked');
                    if (!options.A || !options.B || !options.C || !options.D) { showToast('Vui lòng nhập đủ 4 lựa chọn', 'error'); return; }
                    if (!correctRadio) { showToast('Vui lòng chọn đáp án đúng', 'error'); return; }
                    newQ.options = options;
                    newQ.correctAnswer = correctRadio.value;
                } else if (chosenType === 'short_answer') {
                    const correct = document.getElementById('q-correct').value.trim();
                    if (!correct) { showToast('Vui lòng nhập đáp án đúng', 'error'); return; }
                    newQ.correctAnswer = correct;
                } else if (chosenType === 'true_false') {
                    if (tfValue === null) { showToast('Vui lòng chọn Đúng hoặc Sai', 'error'); return; }
                    newQ.correctAnswer = tfValue;
                } else {
                    newQ.correctAnswer = null;
                }

                if (state.pickerType === 'edit') {
                    newQ.id = state.questions[state.editingIndex].id;
                    newQ.order = state.questions[state.editingIndex].order;
                    state.questions[state.editingIndex] = newQ;
                } else {
                    newQ.id = uid();
                    state.questions.push(newQ);
                }

                state.pickerType = null;
                pickerSlot.innerHTML = '';
                renderQuestionsList();
                showToast('Đã lưu câu hỏi vào đề thi');
            });
        }

        renderPickerBody();
    }

    async function saveExam() {
        if (!state.title.trim()) { showToast('Vui lòng nhập tên đề thi', 'error'); return; }
        if (state.questions.length === 0) { showToast('Đề thi cần ít nhất 1 câu hỏi', 'error'); return; }

        const user = getCurrentUser();
        const questionsObj = {};
        state.questions.forEach((q, i) => {
            const { id, ...rest } = q;
            questionsObj[id] = { ...rest, order: i };
        });

        const examData = {
            ownerId: user.userId,
            ownerName: user.displayName,
            title: state.title.trim(),
            description: state.description.trim(),
            subjectTag: state.subjectTag,
            isPublic: state.isPublic,
            timeLimit: state.timeLimit,
            isShuffleEnabled: state.isShuffleEnabled,
            pin: existingExam?.pin || generatePIN(),
            questions: questionsObj,
            createdAt: existingExam?.createdAt || Date.now()
        };

        const saveBtn = document.getElementById('save-exam-btn');
        saveBtn.disabled = true;
        saveBtn.textContent = 'Đang lưu...';

        try {
            if (editExamId) {
                await db.ref(`exams/${editExamId}`).set(examData);
            } else {
                await db.ref('exams').push(examData);
            }
            showToast('Đã lưu đề thi thành công!');
            setActivePage('library');
        } catch (err) {
            showToast('Lỗi khi lưu đề thi', 'error');
            saveBtn.disabled = false;
            saveBtn.textContent = editExamId ? 'Lưu thay đổi' : 'Lưu đề thi';
        }
    }

    renderAll();
}

/* ==========================================================================
   AI CREATE FORM (JSON import)
========================================================================== */

const AI_PROMPT_TEXT = `Bạn là một trợ lý chuyển đổi đề thi sang định dạng JSON chuẩn cho hệ thống ExoticStudy.
NHIỆM VỤ BẮT BUỘC: Đọc kỹ file đề thi tôi đính kèm và chuyển toàn bộ nội dung thành JSON theo ĐÚNG
CHÍNH XÁC cấu trúc mẫu bên dưới, không thêm bớt field, không thêm text giải thích.

TRƯỚC KHI XUẤT JSON, BẮT BUỘC PHẢI HỎI TÔI CHỌN 1 TRONG 3 CÁCH XỬ LÝ ĐÁP ÁN:
1) "Tự giải toàn bộ" — tự giải và xác định đáp án đúng cho TẤT CẢ câu hỏi.
2) "Chỉ trích xuất đáp án có sẵn" — chỉ lấy đáp án nếu file đã ghi rõ sẵn.
3) "Chỉ giải các câu chưa có đáp án" — giữ nguyên câu đã có đáp án, tự giải câu còn thiếu.

Sau khi tôi chọn xong, XUẤT DUY NHẤT MỘT KHỐI JSON HỢP LỆ theo mẫu:
{
  "examTitle": "Tên đề thi",
  "examDescription": "Mô tả ngắn",
  "questions": [
    { "id": 1, "type": "multiple_choice", "content": "...", "options": {"A":"...","B":"...","C":"...","D":"..."}, "correctAnswer": "A", "points": 1 },
    { "id": 2, "type": "short_answer", "content": "...", "correctAnswer": "...", "points": 1 },
    { "id": 3, "type": "true_false", "content": "...", "correctAnswer": true, "points": 1 },
    { "id": 4, "type": "essay", "content": "...", "correctAnswer": null, "points": 1 }
  ]
}
Chỉ trả về JSON thuần túy, không dùng markdown code fence.`;

function renderAiCreateForm(main) {
    main.innerHTML = `
        <div class="content-header">
            <div class="content-header-main">
                <h2>Tạo thông minh (AI)</h2>
                <p>Copy prompt, gửi cho AI kèm file đề thi, rồi dán JSON kết quả vào đây</p>
            </div>
            <button class="btn-outline" id="back-btn">← Quay lại</button>
        </div>
        <div class="form-card">
            <p style="font-weight:700;">Bước 1 — Copy prompt chuẩn gửi cho AI</p>
            <button id="copy-prompt-btn" class="btn-outline">📋 Copy Prompt AI</button>
            
            <p style="font-weight:700;margin-top:1.25rem;">Bước 2 — Dán JSON AI trả về</p>
            <textarea id="json-input" rows="10" placeholder='{ "examTitle": "...", "questions": [...] }'></textarea>
            <div class="error-text" id="json-error"></div>
            
            <div class="field" style="margin-top:0.75rem;">
                <label>🏷️ Chọn môn học cho đề thi này</label>
                <select id="ai-exam-subject" style="padding: 0.5rem; border-radius: var(--radius-sm); border: 1.5px solid var(--border); outline: none;">
                    ${SUBJECTS.map(subj => `<option value="${subj}">${subj}</option>`).join('')}
                </select>
            </div>

            <label style="display:flex;align-items:center;gap:0.5rem;margin-top:0.75rem;font-size:0.9rem;">
                <input type="checkbox" id="ai-exam-public" style="width:auto;"> Công khai đề thi này ngay khi lưu
            </label>
            <button id="submit-json" style="margin-top:0.75rem;">Xác thực & Tạo đề thi</button>
        </div>
        <div id="preview-slot"></div>
    `;

    document.getElementById('back-btn').addEventListener('click', () => setActivePage('create'));
    document.getElementById('copy-prompt-btn').addEventListener('click', () => {
        navigator.clipboard.writeText(AI_PROMPT_TEXT).then(() => showToast('Đã copy prompt vào clipboard!'));
    });

    document.getElementById('submit-json').addEventListener('click', () => {
        const errorEl = document.getElementById('json-error');
        errorEl.textContent = '';
        let data;
        try {
            data = JSON.parse(document.getElementById('json-input').value);
        } catch (e) {
            errorEl.textContent = 'JSON không hợp lệ, kiểm tra lại dấu phẩy/ngoặc.';
            return;
        }

        if (!data.examTitle || !Array.isArray(data.questions) || data.questions.length === 0) {
            errorEl.textContent = 'JSON thiếu examTitle hoặc questions rỗng.';
            return;
        }

        for (const q of data.questions) {
            if (!QUESTION_TYPES[q.type]) { errorEl.textContent = `Câu hỏi id ${q.id}: type không hợp lệ.`; return; }
            if (q.type === 'multiple_choice' && (!q.options || !['A','B','C','D'].every(k => q.options[k]))) {
                errorEl.textContent = `Câu hỏi id ${q.id}: thiếu options A/B/C/D.`; return;
            }
        }

        renderPreview(data);
    });

    function renderPreview(data) {
        const slot = document.getElementById('preview-slot');
        slot.innerHTML = `
            <div class="form-card">
                <h3>Xem trước: ${escapeHtml(data.examTitle)}</h3>
                <p style="color:var(--text-soft);">${escapeHtml(data.examDescription || '')}</p>
                ${data.questions.map((q, i) => `
                    <div class="question-item">
                        <strong>Câu ${i + 1} · ${QUESTION_TYPES[q.type].icon} ${QUESTION_TYPES[q.type].label}</strong>
                        <p style="margin:0.3rem 0 0;color:var(--text-soft);">${escapeHtml(q.content)}</p>
                    </div>
                `).join('')}
                <button id="confirm-save-btn" style="width:100%;margin-top:1rem;">✅ Xác nhận lưu đề thi</button>
            </div>
        `;

        document.getElementById('confirm-save-btn').addEventListener('click', async () => {
            const user = getCurrentUser();
            const questionsObj = {};
            data.questions.forEach((q, i) => {
                questionsObj[uid()] = {
                    type: q.type,
                    content: q.content,
                    options: q.options || null,
                    correctAnswer: q.correctAnswer ?? null,
                    points: q.points || 1,
                    order: i
                };
            });

            try {
                await db.ref('exams').push({
                    ownerId: user.userId,
                    ownerName: user.displayName,
                    title: data.examTitle,
                    description: data.examDescription || '',
                    subjectTag: document.getElementById('ai-exam-subject').value,
                    isPublic: document.getElementById('ai-exam-public').checked,
                    pin: generatePIN(),
                    questions: questionsObj,
                    createdAt: Date.now()
                });
                showToast('Đã tạo đề thi từ JSON thành công!');
                setActivePage('library');
            } catch (err) {
                showToast('Lỗi khi lưu đề thi', 'error');
            }
        });
    }
}

/* ==========================================================================
   INIT
========================================================================== */

const currentUser = getCurrentUser();
if (currentUser) {
    initGlobalSync();
    renderDashboard();
} else {
    renderAuth();
}