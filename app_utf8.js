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

    let html = '';
    // Reverse array to show newest first, assuming user adds to the bottom. Slice to max 6 items.
    const displayRows = rows.slice().reverse().slice(0, 6);

    displayRows.forEach(row => {
        // Fallback column names in case user didn't name them exactly as suggested
        const date = row['日期'] || row['Column0'] || '';
        const tag = row['分類'] || row['Column1'] || '公告';
        const title = row['標題'] || row['Column2'] || '未命名公告';
        const excerpt = row['內容摘要'] || row['Column3'] || '';
        const link = row['詳細連結'] || row['Column4'] || '#';
        
        const isHidden = (row['是否顯示'] || '').toString().toLowerCase() === 'false';
        if(isHidden) return;

        // Determine tag color
        let tagColor = 'bg-sky-100 text-primary';
        if(tag.includes('活動')) tagColor = 'bg-orange-100 text-accent';
        if(tag.includes('競賽')) tagColor = 'bg-purple-100 text-purple-600';

        html += `
        <article class="bg-white rounded-3xl overflow-hidden border border-gray-100 news-card flex flex-col h-full shadow-sm">
            <div class="p-8 flex-1 flex flex-col">
                <div class="flex items-center gap-3 mb-4">
                    <span class="px-3 py-1 rounded-full text-xs font-bold ${tagColor}">${tag}</span>
                    <span class="text-sm text-gray-400 font-en"><i class="fa-regular fa-calendar mr-1"></i>${date}</span>
                </div>
                <h3 class="text-xl font-bold text-gray-900 mb-3 leading-snug line-clamp-2">${title}</h3>
                <p class="text-gray-600 mb-6 flex-1 text-sm leading-relaxed line-clamp-3">${excerpt}</p>
                <a href="${link}" target="${link !== '#' ? '_blank' : '_self'}" class="inline-flex items-center font-bold text-primary hover:text-primaryDark transition-colors mt-auto group">
                    閱讀詳情 
                    <i class="fa-solid fa-arrow-right ml-2 transform group-hover:translate-x-1 transition-transform"></i>
                </a>
            </div>
        </article>`;
    });

    container.innerHTML = html;
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
        const cat = row['分類'] || row['Column0'] || '未分類';
        if(!categories[cat]) categories[cat] = [];
        categories[cat].push(row);
    });

    for (const [cat, items] of Object.entries(categories)) {
        html += `<div class="mb-6"><h4 class="text-lg font-bold text-gray-800 border-l-4 border-primary pl-3 mb-4">${cat}</h4><div class="space-y-3">`;
        
        items.forEach(row => {
            const name = row['檔案名稱'] || row['Column1'] || '未知檔案';
            const link = row['檔案連結'] || row['Column2'] || '#';
            const type = (row['檔案類型'] || row['Column3'] || '').toLowerCase();
            
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
        const cat = row['分類'] || row['Column0'] || '';
        const name = row['網站名稱'] || row['Column1'] || '未知連結';
        const link = row['網址連結'] || row['Column2'] || '#';
        const desc = row['備註描述'] || row['Column3'] || '';

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

// 渲染: 相片牆
async function renderGallery() {
    const container = document.getElementById('gallery-container');
    const loading = document.getElementById('gallery-loading');
    const rows = await fetchSheetData('活動照片');
    
    loading.classList.add('hidden');
    container.classList.remove('hidden');

    if (!rows || rows.length === 0) {
        container.innerHTML = `<div class="text-center text-gray-500 py-8 border-2 border-dashed border-gray-700/50 rounded-3xl col-span-1 sm:col-span-2 lg:col-span-3">無相片資料。請確認試算表名稱為「相片」。</div>`;
        return;
    }

    let html = '';
    rows.slice(0, 9).forEach(row => { // Limit to 9 for layout
        const title = row['相簿/活動名稱'] || row['Column0'] || '';
        const desc = row['照片名稱/描述'] || row['Column1'] || '';
        const imgLink = row['圖片連結'] || row['Column2'] || '';
        const albumLink = row['相簿網址'] || row['Column3'] || ''; // 新增相簿網址欄位
        
        if(!imgLink) return;

        // Try to convert Google Drive link to direct image viewing link
        let src = imgLink;
        if (imgLink.includes('drive.google.com/file/d/')) {
            const idMatch = imgLink.match(/file\/d\/([a-zA-Z0-9_-]+)/);
            if (idMatch && idMatch[1]) {
                src = `https://drive.google.com/uc?export=view&id=${idMatch[1]}`;
            }
        } else if (imgLink.includes('drive.google.com/open?id=')) {
            const urlParams = new URLSearchParams(imgLink.split('?')[1]);
            const id = urlParams.get('id');
            if (id) {
                src = `https://drive.google.com/uc?export=view&id=${id}`;
            }
        }
        
        // 如果有相簿網址，將整個卡片變成一個連結 <a>；如果沒有，維持 <div>
        const CardTag = albumLink ? 'a' : 'div';
        const linkAttrs = albumLink ? `href="${albumLink}" target="_blank"` : '';
        const hoverIcon = albumLink ? `<div class="mt-2 text-primary opacity-0 group-hover:opacity-100 transition-opacity"><i class="fa-solid fa-link mr-1"></i>前往相簿</div>` : '';

        html += `
        <${CardTag} ${linkAttrs} class="break-inside-avoid block mb-6 bg-gray-800 rounded-3xl overflow-hidden shadow-lg gallery-card group relative ${albumLink ? 'cursor-pointer' : ''}">
            <div class="gallery-img-container">
                <img src="${src}" alt="${title}" class="w-full h-auto object-cover" loading="lazy" onerror="this.src='https://via.placeholder.com/400x300?text=Image+Not+Found'">
            </div>
            <div class="absolute inset-x-0 bottom-0 bg-gradient-to-t from-gray-900 via-gray-900/80 to-transparent p-6 pt-16 transform translate-y-4 opacity-0 group-hover:translate-y-0 group-hover:opacity-100 transition-all duration-300">
                <h4 class="text-white font-bold text-lg leading-tight mb-1">${title || desc}</h4>
                ${title && desc ? `<p class="text-gray-300 text-sm line-clamp-2">${desc}</p>` : ''}
                ${hoverIcon}
            </div>
        </${CardTag}>`;
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

// 初始化
document.addEventListener('DOMContentLoaded', () => {
    setupUI();
    // Fetch and render data
    renderNews();
    renderDownloads();
    renderLinks();
    renderGallery();
});
