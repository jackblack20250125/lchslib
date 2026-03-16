// Google Sheets Database ID
const SHEET_ID = '1wrsQ5CLv-AA3_sZDlDfaUqtfuko8-0jtzSIOFxMrnog';

// Helper function to fetch and parse Google Sheets JSON endpoint
async function fetchSheetData(sheetName) {
    const url = `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:json&sheet=${encodeURIComponent(sheetName)}`;
    try {
        const response = await fetch(url);
        const text = await response.text();
        // Google Sheets returns a JSON wrapped in a function call. We need to strip it.
        const jsonString = text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1);
        const data = JSON.parse(jsonString);
        
        // Extract rows and columns into a more friendly array of objects format
        const cols = data.table.cols.map(c => c ? c.label : '');
        const rows = data.table.rows.map(row => {
            let rowData = {};
            row.c.forEach((cell, i) => {
                const colName = cols[i] || `Column${i}`;
                // Fallback for dates or null values
                rowData[colName] = cell ? (cell.f || cell.v || '') : ''; 
            });
            return rowData;
        });
        return rows;
    } catch (error) {
        console.error(`Error fetching sheet [${sheetName}]:`, error);
        return null;
    }
}

// Helper function to find cell value safely based on possible column keywords
function getCellValue(row, keywords, fallbackColIndex) {
    for (const key in row) {
        if (keywords.some(kw => key.includes(kw))) {
            return row[key] || '';
        }
    }
    return row[`Column${fallbackColIndex}`] || '';
}

// 全域變數儲存新聞資料，以供 Modal 使用
let newsData = [];
let newsVisibleCount = 3; // 預設顯示3筆
const NEWS_MAX_ITEMS = 30; // 點擊更多後最多顯示30筆

// 渲染單筆新聞的 HTML (變成橫條列狀)
function renderNewsItemHtml(item) {
    let tagColor = 'bg-sky-100 text-primary';
    if(item.tag.includes('活動')) tagColor = 'bg-orange-100 text-accent';
    if(item.tag.includes('競賽') || item.tag.includes('榮譽') || item.tag.includes('得獎')) tagColor = 'bg-purple-100 text-purple-600';

    const isSchoolLink = item.isSchoolLink && item.schoolLink !== '#' && item.schoolLink !== '';
    const clickAttr = isSchoolLink ? `href="${item.schoolLink}" target="_blank"` : `href="javascript:void(0)" onclick="openNewsModal(${item.id})"`;
    const actionText = isSchoolLink ? '前往校網' : '閱讀詳情';
    const WrapperTag = isSchoolLink ? 'a' : 'div';

    return `
    <${WrapperTag} ${isSchoolLink ? clickAttr : `onclick="openNewsModal(${item.id})"`} class="group bg-white rounded-2xl p-5 md:p-6 border ${item.isPinned ? 'border-rose-200 bg-rose-50/30 ring-1 ring-rose-100 shadow-rose-100/50' : 'border-gray-100'} hover:border-primary/30 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center gap-4 cursor-pointer relative overflow-hidden">
        <!-- Hover Gradient -->
        <div class="absolute right-0 top-0 bottom-0 w-32 bg-gradient-to-l from-sky-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none"></div>
        
        <!-- Date & Tag (Left/Top) -->
        <div class="flex items-center md:flex-col md:items-start md:w-32 flex-shrink-0 gap-3 md:gap-2">
            <div class="flex flex-wrap items-center gap-2">
                ${item.isPinned ? '<span class="px-3 py-1 rounded-full text-xs font-bold bg-rose-100 text-rose-600"><i class="fa-solid fa-thumbtack mr-1"></i>置頂</span>' : ''}
                <span class="px-3 py-1 rounded-full text-xs font-bold ${tagColor}">${item.tag}</span>
            </div>
            <span class="text-sm text-gray-500 font-en font-medium"><i class="fa-regular fa-calendar md:hidden mr-1"></i>${item.date}</span>
        </div>
        
        <!-- Title & Excerpt (Middle) -->
        <div class="flex-1 min-w-0">
            <h3 class="text-lg md:text-xl font-bold text-gray-900 group-hover:text-primary transition-colors mb-2 truncate">${item.title}</h3>
            <p class="text-gray-500 text-sm line-clamp-1 group-hover:text-gray-600">${item.excerpt}</p>
        </div>
        
        <!-- Action Button (Right/Bottom) -->
        <div class="mt-2 md:mt-0 flex-shrink-0 text-right">
            <span class="inline-flex items-center text-sm font-bold text-primary opacity-0 group-hover:opacity-100 transform translate-x-4 group-hover:translate-x-0 transition-all">
                ${actionText} <i class="fa-solid fa-arrow-right ml-2 text-xs"></i>
            </span>
            <div class="md:hidden inline-flex items-center text-sm font-bold text-primary group-hover:hidden">
                ${actionText} <i class="fa-solid fa-arrow-right ml-2 text-xs"></i>
            </div>
        </div>
    </${WrapperTag}>`;
}

// 根據最新筆數重新繪製最新消息區塊
function updateNewsDisplay() {
    const container = document.getElementById('news-container');
    const loadMoreContainer = document.getElementById('news-load-more-container');
    
    // 限制首頁顯示筆數，最大不超過資料總數或 30 筆
    const displayCount = Math.min(newsVisibleCount, newsData.length, NEWS_MAX_ITEMS);
    const visibleCards = newsData.slice(0, displayCount);
    
    let html = '';
    visibleCards.forEach(item => {
        html += renderNewsItemHtml(item);
    });
    
    container.innerHTML = html;

    // 控制「載入更多」按鈕顯示與隱藏
    if (newsVisibleCount < newsData.length && newsVisibleCount < NEWS_MAX_ITEMS) {
        loadMoreContainer.classList.remove('hidden');
    } else {
        loadMoreContainer.classList.add('hidden');
    }
}

// 點擊「載入更多」按鈕
function loadMoreNews() {
    newsVisibleCount = NEWS_MAX_ITEMS;
    updateNewsDisplay();
}

// 渲染: 最新消息
async function renderNews() {
    const container = document.getElementById('news-container');
    const loading = document.getElementById('news-loading');
    const rows = await fetchSheetData('最新消息');
    
    loading.classList.add('hidden');
    container.classList.remove('hidden');

    if (!rows || rows.length === 0) {
        container.innerHTML = `<div class="col-span-1 md:col-span-3 text-center text-gray-500 py-8 border-2 border-dashed border-gray-200 rounded-3xl">目前沒有最新消息或無法存取試算表。請確認試算表名稱為「最新消息」且已發佈到網路。</div>`;
        return;
    }

    // Reverse array to show newest first
    const displayRows = rows.slice().reverse();
    
    newsData = [];
    newsVisibleCount = 3; // 重置為 3 筆
    
    displayRows.forEach(row => {
        const isShowRaw = getCellValue(row, ['是否顯示'], 9);
        const isShow = isShowRaw.toString().toUpperCase() !== 'FALSE';
        if (!isShow) return;

        const date = getCellValue(row, ['公告日期', '日期'], 1);
        const tag = getCellValue(row, ['分類'], 2) || '公告';
        const title = getCellValue(row, ['標題'], 3) || '未命名公告';
        const content = getCellValue(row, ['詳細內容'], 4) || '';
        const media = getCellValue(row, ['照片', '檔案'], 5) || '';
        const useSchoolLinkRaw = getCellValue(row, ['使用校網'], 6);
        const isSchoolLink = useSchoolLinkRaw.toString().includes('是') || useSchoolLinkRaw.toString().toUpperCase() === 'TRUE';
        const schoolLink = getCellValue(row, ['校網連結'], 7) || '#';
        const optionalLink = getCellValue(row, ['連結(非必須)', '其他連結'], 8) || '';
        const isPinnedRaw = getCellValue(row, ['置頂'], 9);
        const isPinned = isPinnedRaw.toString().includes('是') || isPinnedRaw.toString().toUpperCase() === 'TRUE';
        
        // 產生摘要
        let excerpt = content.replace(/(<([^>]+)>)/gi, "").substring(0, 80);
        if (content.length > 80) excerpt += '...';
        
        if (isSchoolLink && !excerpt) {
            excerpt = '本公告為校網發佈內容，請點擊閱讀詳情前往學校官方網站查看完整公告...';
        }

        const newsItem = {
            id: newsData.length, // Temporary ID, will be updated after sorting
            date,
            tag,
            title,
            content,
            media,
            isSchoolLink,
            schoolLink,
            optionalLink,
            excerpt,
            isPinned
        };
        
        newsData.push(newsItem);
    });

    // 依據日期由新到舊排序，置頂文章優先
    newsData.sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;

        const dateA = new Date(a.date);
        const dateB = new Date(b.date);
        
        // Handle invalid dates by pushing them to the bottom or keeping original order
        if (isNaN(dateA.getTime()) && isNaN(dateB.getTime())) return 0;
        if (isNaN(dateA.getTime())) return 1;
        if (isNaN(dateB.getTime())) return -1;
        
        return dateB - dateA;
    });
    
    // 重新排序後更新 ID 以確保 Modal 對應正確
    newsData.forEach((item, index) => {
        item.id = index;
    });

    updateNewsDisplay();
    
    // 綁定載入更多按鈕
    const loadMoreBtn = document.getElementById('news-load-more-btn');
    if (loadMoreBtn) {
        // 確保不會重複綁定
        loadMoreBtn.onclick = loadMoreNews;
    }
}

// 開啟新聞 Modal
window.openNewsModal = function(id) {
    const item = newsData[id];
    if (!item) return;

    const modal = document.getElementById('news-modal');
    const backdrop = document.getElementById('news-modal-backdrop');
    const content = document.getElementById('news-modal-content');

    // 填充資料
    document.getElementById('modal-tag').textContent = item.tag;
    document.getElementById('modal-date').innerHTML = `<i class="fa-regular fa-calendar mr-1"></i>${item.date}`;
    document.getElementById('modal-title').textContent = item.title;
    
    // 處理詳細內容 (保留換行)
    let bodyHtml = item.content.replace(/\n/g, '<br>');
    document.getElementById('modal-body').innerHTML = bodyHtml;

    // 處理附件與連結
    const attachmentsContainer = document.getElementById('modal-attachments');
    const attachmentsList = document.getElementById('modal-attachments-list');
    
    let hasAttachments = false;
    let attachmentsHtml = '';

    // 照片或檔案
    if (item.media) {
        hasAttachments = true;
        const mediaUrls = item.media.split(/[,\s]+/).filter(u => u.startsWith('http'));
        
        if (mediaUrls.length > 0) {
            mediaUrls.forEach((url, index) => {
                let displayUrl = url;
                let isImage = false;
                
                if (url.match(/\.(jpeg|jpg|gif|png|webp)$/i)) {
                    isImage = true;
                }
                
                // Google Drive 連結轉換
                if (url.includes('drive.google.com/file/d/')) {
                    const idMatch = url.match(/file\/d\/([a-zA-Z0-9_-]+)/);
                    if (idMatch && idMatch[1]) {
                        displayUrl = `https://drive.google.com/uc?export=view&id=${idMatch[1]}`;
                    }
                }
                
                // 如果來源暗示為照片
                if (isImage || (url.includes('drive.google.com') && item.media.includes('照片'))) {
                    attachmentsHtml += `
                    <div class="mt-4 rounded-xl overflow-hidden border border-gray-200">
                        <img src="${displayUrl}" alt="活動照片" class="w-full h-auto max-h-[400px] object-contain bg-gray-50" onerror="this.outerHTML='<a href=\\'${url}\\' target=\\'_blank\\' class=\\'flex items-center justify-between p-4 bg-gray-50 hover:bg-sky-50 rounded-xl border border-gray-100 transition-colors group\\'><div class=\\'flex items-center gap-3\\'><div class=\\'w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center text-primary\\'><i class=\\'fa-solid fa-file-arrow-down\\'></i></div><span class=\\'font-bold text-gray-700 group-hover:text-primary\\'>照片無法預覽，點此開啟或下載</span></div><i class=\\'fa-solid fa-arrow-up-right-from-square text-gray-400 group-hover:text-primary\\'></i></a>'">
                        <div class="bg-gray-50 p-3 border-t border-gray-200 flex justify-between items-center px-4">
                            <span class="text-sm text-gray-500 font-medium">照片/圖片 ${index + 1}</span>
                            <a href="${url}" target="_blank" class="text-primary hover:text-primaryDark font-bold text-sm bg-sky-100 px-3 py-1.5 rounded-lg transition-colors"><i class="fa-solid fa-arrow-up-right-from-square mr-1"></i> 原始連結</a>
                        </div>
                    </div>`;
                } else {
                    attachmentsHtml += `
                    <a href="${url}" target="_blank" class="flex items-center justify-between p-4 bg-gray-50 hover:bg-sky-50 rounded-xl border border-gray-100 transition-colors group">
                        <div class="flex items-center gap-3">
                            <div class="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center text-primary">
                                <i class="fa-solid fa-file-arrow-down"></i>
                            </div>
                            <span class="font-bold text-gray-700 group-hover:text-primary">附件檔案 ${index + 1}</span>
                        </div>
                        <i class="fa-solid fa-arrow-up-right-from-square text-gray-400 group-hover:text-primary"></i>
                    </a>`;
                }
            });
        }
    }

    // 額外連結
    if (item.optionalLink && item.optionalLink.startsWith('http')) {
        hasAttachments = true;
        attachmentsHtml += `
        <a href="${item.optionalLink}" target="_blank" class="flex items-center justify-between p-4 bg-orange-50 hover:bg-orange-100 rounded-xl border border-orange-100 transition-colors group mt-2">
            <div class="flex items-center gap-3">
                <div class="w-10 h-10 bg-white rounded-lg shadow-sm flex items-center justify-center text-accent">
                    <i class="fa-solid fa-link"></i>
                </div>
                <span class="font-bold text-gray-700 group-hover:text-accent">相關連結</span>
            </div>
            <i class="fa-solid fa-arrow-up-right-from-square text-orange-300 group-hover:text-accent"></i>
        </a>`;
    }

    if (hasAttachments) {
        attachmentsList.innerHTML = attachmentsHtml;
        attachmentsContainer.classList.remove('hidden');
    } else {
        attachmentsContainer.classList.add('hidden');
    }

    // 顯示 Modal
    modal.classList.remove('hidden');
    modal.classList.add('flex');
    
    // 強制重繪
    void modal.offsetWidth;
    
    backdrop.classList.remove('opacity-0');
    backdrop.classList.add('opacity-100');
    
    content.classList.remove('opacity-0', 'scale-95');
    content.classList.add('opacity-100', 'scale-100');
    
    // 鎖定背景滾動
    document.body.style.overflow = 'hidden';
}

function closeNewsModal() {
    const modal = document.getElementById('news-modal');
    const backdrop = document.getElementById('news-modal-backdrop');
    const content = document.getElementById('news-modal-content');
    
    backdrop.classList.remove('opacity-100');
    backdrop.classList.add('opacity-0');
    
    content.classList.remove('opacity-100', 'scale-100');
    content.classList.add('opacity-0', 'scale-95');
    
    setTimeout(() => {
        modal.classList.add('hidden');
        modal.classList.remove('flex');
        document.body.style.overflow = '';
    }, 300);
}

function initModal() {
    const closeBtn = document.getElementById('close-modal-btn');
    const backdrop = document.getElementById('news-modal-backdrop');
    
    if(closeBtn) closeBtn.addEventListener('click', closeNewsModal);
    if(backdrop) backdrop.addEventListener('click', closeNewsModal);
    
    // ESC 鍵關閉
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !document.getElementById('news-modal').classList.contains('hidden')) {
            closeNewsModal();
        }
    });
}

// 渲染: 檔案下載
async function renderDownloads() {
    const container = document.getElementById('downloads-container');
    const loading = document.getElementById('downloads-loading');
    const rows = await fetchSheetData('檔案下載');
    
    loading.classList.add('hidden');
    container.classList.remove('hidden');

    if (!rows || rows.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-500 py-8 border-2 border-dashed border-gray-200 rounded-3xl">無下載檔案。請確認試算表名稱為「檔案下載」。</div>`;
        return;
    }

    let html = '';
    
    // Group by category manually
    let categories = {};
    rows.forEach(row => {
        const cat = getCellValue(row, ['分類'], 0) || '未分類';
        if(!categories[cat]) categories[cat] = [];
        categories[cat].push(row);
    });

    for (const [cat, items] of Object.entries(categories)) {
        html += `<div class="mb-6"><h4 class="text-lg font-bold text-gray-800 border-l-4 border-primary pl-3 mb-4">${cat}</h4><div class="space-y-3">`;
        
        items.forEach(row => {
            const name = getCellValue(row, ['名稱', '檔案名稱'], 1) || '未知檔案';
            let link = getCellValue(row, ['連結', '網址'], 2) || '#';
            const type = (getCellValue(row, ['類型', '格式'], 3)).toLowerCase();
            
            // 嘗試將 Google Drive 連結轉換為直接下載連結
            if (link.includes('drive.google.com/file/d/')) {
                const idMatch = link.match(/file\/d\/([a-zA-Z0-9_-]+)/);
                if (idMatch && idMatch[1]) {
                    let qs = '';
                    if (link.includes('resourcekey=')) {
                        const rkMatch = link.match(/resourcekey=([^&]+)/);
                        if (rkMatch && rkMatch[1]) qs = `&resourcekey=${rkMatch[1]}`;
                    }
                    link = `https://drive.google.com/uc?export=download&id=${idMatch[1]}${qs}`;
                }
            } else if (link.includes('drive.google.com/open?id=')) {
                try {
                    const urlParams = new URLSearchParams(link.split('?')[1]);
                    const id = urlParams.get('id');
                    let qs = '';
                    if (urlParams.has('resourcekey')) {
                         qs = `&resourcekey=${urlParams.get('resourcekey')}`;
                    }
                    if (id) {
                        link = `https://drive.google.com/uc?export=download&id=${id}${qs}`;
                    }
                } catch(e) {}
            } else if (link.includes('github.com') && link.includes('/blob/')) {
                // 將 GitHub blob 連結轉換為可以下載的 raw 連結
                link = link.replace('github.com', 'raw.githubusercontent.com').replace('/blob/', '/');
            }

            let fileIcon = 'fa-file';
            let iconColor = 'text-gray-400';
            if(type.includes('pdf')) { fileIcon = 'fa-file-pdf'; iconColor = 'text-red-500'; }
            if(type.includes('doc') || type.includes('word')) { fileIcon = 'fa-file-word'; iconColor = 'text-blue-600'; }
            if(type.includes('xls') || type.includes('excel')) { fileIcon = 'fa-file-excel'; iconColor = 'text-green-600'; }

            html += `
            <a href="${link}" target="_blank" class="flex items-center justify-between p-4 bg-gray-50 hover:bg-sky-50 rounded-2xl border border-gray-100 transition-colors group">
                <div class="flex items-center gap-4">
                    <div class="w-10 h-10 bg-white rounded-xl shadow-sm flex items-center justify-center text-xl ${iconColor}">
                        <i class="fa-solid ${fileIcon}"></i>
                    </div>
                    <span class="font-medium text-gray-700 group-hover:text-primary transition-colors">${name}</span>
                </div>
                <div class="w-8 h-8 rounded-full bg-white flex items-center justify-center text-gray-400 group-hover:text-primary shadow-sm group-hover:shadow transition-all group-hover:scale-110">
                    <i class="fa-solid fa-download text-sm"></i>
                </div>
            </a>`;
        });
        
        html += `</div></div>`;
    }

    container.innerHTML = html;
}

// 渲染: 網站連結
async function renderLinks() {
    const container = document.getElementById('links-container');
    const loading = document.getElementById('links-loading');
    const rows = await fetchSheetData('網站連結');
    
    loading.classList.add('hidden');
    container.classList.remove('hidden');

    if (!rows || rows.length === 0) {
        container.innerHTML = `<div class="col-span-1 sm:col-span-2 text-center text-gray-500 py-8 border-2 border-dashed border-gray-200 rounded-3xl">無網站連結。請確認試算表名稱為「網站連結」。</div>`;
        return;
    }

    let html = '';
    rows.forEach(row => {
        const cat = getCellValue(row, ['分類'], 0);
        const name = getCellValue(row, ['名稱', '網站名稱'], 1) || '未知連結';
        const link = getCellValue(row, ['連結', '網址', '網址連結'], 2) || '#';
        const desc = getCellValue(row, ['備註', '描述', '備註描述'], 3);

        html += `
        <a href="${link}" target="_blank" class="block p-5 rounded-2xl border border-gray-200 link-card bg-white relative overflow-hidden group">
            <div class="absolute right-0 top-0 w-16 h-16 bg-gradient-to-br from-transparent to-orange-100 rounded-bl-full opacity-50 transition-all group-hover:scale-150"></div>
            <div class="flex items-start justify-between relative z-10">
                <div>
                    ${cat ? `<span class="text-xs font-bold text-accent mb-1 block">${cat}</span>` : ''}
                    <h4 class="font-bold text-gray-800 text-lg mb-1 group-hover:text-primary transition-colors">${name}</h4>
                    ${desc ? `<p class="text-sm text-gray-500 line-clamp-1">${desc}</p>` : ''}
                </div>
                <div class="text-gray-300 group-hover:text-accent transition-colors">
                    <i class="fa-solid fa-arrow-up-right-from-square"></i>
                </div>
            </div>
        </a>`;
    });

    container.innerHTML = html;
}



// Navbar Scroll Effect & Mobile Menu Logic
function setupUI() {
    const navbar = document.getElementById('navbar');
    
    window.addEventListener('scroll', () => {
        if (window.scrollY > 10) {
            navbar.classList.add('shadow-md');
            navbar.classList.replace('bg-white/80', 'bg-white/95');
        } else {
            navbar.classList.remove('shadow-md');
            navbar.classList.replace('bg-white/95', 'bg-white/80');
        }
    });

    // Mobile menu toggle
    const btn = document.getElementById('mobile-menu-btn');
    const menu = document.getElementById('mobile-menu');
    
    btn.addEventListener('click', () => {
        menu.classList.toggle('hidden');
    });

    // Close mobile menu on link click
    menu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', () => {
            menu.classList.add('hidden');
        });
    });
}

// 檢查是否為校內 IP 並設定 OPAC 相關連結與介面
function setupOpacLinks() {
    const opacBtn = document.getElementById('opac-btn');
    const mobileOpacLink = document.getElementById('mobile-opac-link');
    const opacSearch = document.getElementById('opac-search');
    const opacHint = document.getElementById('opac-hint');
    const opacCard = document.getElementById('opac-card');
    const searchBtn = document.getElementById('opac-search-btn');

    // 預設先隱藏所有 OPAC 相關按鈕與搜尋框，只顯示提示
    if(opacBtn) opacBtn.style.display = 'none';
    if(mobileOpacLink) mobileOpacLink.style.display = 'none';
    if(opacSearch) opacSearch.style.display = 'none';

    // 取得使用者真實公網 IP
    fetch('https://api.ipify.org?format=json')
        .then(response => response.json())
        .then(data => {
            const ip = data.ip;
            // 檢查是否為學校 IP
            if (ip.startsWith('163.16.72.')) {
                // 是校內 IP：顯示按鈕與搜尋，隱藏警告提示
                if(opacBtn) opacBtn.style.display = 'flex';
                if(mobileOpacLink) mobileOpacLink.style.display = 'inline-flex';
                if(opacSearch) opacSearch.style.display = 'block';
                if(opacHint) opacHint.style.display = 'none';

                // 綁定「萬本藏書」卡片點擊事件
                if (opacCard) {
                    opacCard.classList.add('cursor-pointer');
                    opacCard.addEventListener('click', () => {
                        window.open('http://192.168.11.242/webopac', '_blank');
                    });
                }

                // 綁定快速查詢按鈕點擊事件 (避免直接使用 form 送出產生 HTTPS 警告)
                if (searchBtn) {
                    searchBtn.addEventListener('click', () => {
                        // 這裡可以根據需要組合搜尋參數，這裡先直接導向首頁
                        window.open('http://192.168.11.242/webopac/', '_blank');
                    });
                }
                
                // 讓舊有的 a 標籤直接連過去
                const anchors = document.querySelectorAll('a[href^="http://192.168.11.242"]');
                anchors.forEach(a => a.addEventListener('click', (e) => {
                    e.preventDefault();
                    window.open(a.href, a.target || '_blank');
                }));
            } else {
                // 非校內 IP：保持原本的隱藏狀態 (只顯示 hint)
                console.log("非校內連線", ip);
            }
        })
        .catch(err => {
            console.error("無法取得 IP 資訊:", err);
            // 失敗時視同非校內
        });
}

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    setupUI();
    initModal();
    setupOpacLinks();
    // Fetch and render data
    renderNews();
    renderDownloads();
    renderLinks();
});
