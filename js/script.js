// Variables globales
let events = [];
let currentDraft = null;
let autoSaveTimeout = null;

// Variables de paginación y búsqueda
let currentPage = 1;
let itemsPerPage = 20;
let filteredEvents = [];
let searchQuery = '';

// Claves de almacenamiento
const STORAGE_KEYS = {
    EVENTS: 'delivery_log_events',
    DRAFT: 'delivery_log_draft',
    LAST_SAVE: 'delivery_log_last_save'
};

// Obtener el año actual para el footer
document.getElementById('current-year').textContent = new Date().getFullYear();

// Establecer la fecha actual como predeterminada en el formulario
document.getElementById('event-date').valueAsDate = new Date();

// Cargar eventos y borradores al iniciar
document.addEventListener('DOMContentLoaded', function() {
    loadEvents();
    checkForDraft();
    updateStatistics();
    
    // Configurar eventos del formulario
    document.getElementById('event-form').addEventListener('submit', saveFinalEvent);
    document.getElementById('clear-form').addEventListener('click', clearForm);
    document.getElementById('clear-all').addEventListener('click', clearAllEvents);
    document.getElementById('export-now').addEventListener('click', exportToCSV);
    document.getElementById('save-draft').addEventListener('click', manualSaveDraft);
    document.getElementById('restoreDraft').addEventListener('click', restoreDraft);
    document.getElementById('discardDraft').addEventListener('click', discardDraft);
    
    // Configurar importación CSV
    const importFileInput = document.getElementById('import-csv-file');
    if (importFileInput) {
        importFileInput.addEventListener('change', handleCSVImport);
    }
    
    const importCSVBtn = document.getElementById('import-csv-btn');
    if (importCSVBtn) {
        importCSVBtn.addEventListener('click', () => {
            importFileInput.click();
        });
    }
    
    // Configurar autoguardado en campos del formulario
    setupAutoSave();
    
    // Configurar búsqueda
    const searchInput = document.getElementById('search-input');
    if (searchInput) {
        searchInput.addEventListener('input', debounce(handleSearch, 300));
        searchInput.addEventListener('keyup', (e) => {
            if (e.key === 'Enter') {
                handleSearch();
            }
        });
    }
    
    // Configurar filtros
    document.getElementById('filter-date').addEventListener('change', applyFiltersAndRender);
    document.getElementById('filter-type').addEventListener('change', applyFiltersAndRender);
    
    // Configurar botón limpiar filtros
    const clearFiltersBtn = document.getElementById('clear-filters');
    if (clearFiltersBtn) {
        clearFiltersBtn.addEventListener('click', clearAllFilters);
    }
    
    // Configurar paginación
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const prevPageBtnBottom = document.getElementById('prev-page-bottom');
    const nextPageBtnBottom = document.getElementById('next-page-bottom');
    const itemsPerPageSelect = document.getElementById('items-per-page-select');
    
    if (prevPageBtn) prevPageBtn.addEventListener('click', () => goToPage(currentPage - 1));
    if (nextPageBtn) nextPageBtn.addEventListener('click', () => goToPage(currentPage + 1));
    if (prevPageBtnBottom) prevPageBtnBottom.addEventListener('click', () => goToPage(currentPage - 1));
    if (nextPageBtnBottom) nextPageBtnBottom.addEventListener('click', () => goToPage(currentPage + 1));
    if (itemsPerPageSelect) {
        itemsPerPageSelect.addEventListener('change', (e) => {
            itemsPerPage = parseInt(e.target.value) || events.length;
            currentPage = 1;
            applyFiltersAndRender();
        });
    }
    
    // Configurar autoguardado cuando se cierra la pestaña
    window.addEventListener('beforeunload', handleBeforeUnload);
    
    // Mostrar mensaje de bienvenida
    setTimeout(() => {
        showNotification('Sistema de autoguardado activado', 'info');
    }, 1000);
});

// Configurar autoguardado para todos los campos
function setupAutoSave() {
    const autoSaveFields = document.querySelectorAll('[data-autosave]');
    
    autoSaveFields.forEach(field => {
        // Guardar mientras escribe (con debounce más corto para mejor respuesta)
        field.addEventListener('input', debounce(autoSaveDraft, 500));
        
        // Guardar inmediatamente al perder el foco
        field.addEventListener('blur', () => {
            // Pequeño delay para asegurar que el valor se actualizó
            setTimeout(autoSaveDraft, 100);
        });
        
        // Guardar cuando cambia el valor (para select y date)
        field.addEventListener('change', autoSaveDraft);
        
        // Guardar al presionar teclas importantes
        if (field.tagName === 'TEXTAREA' || field.tagName === 'INPUT') {
            field.addEventListener('keydown', (e) => {
                // Guardar al presionar Enter en campos de texto (excepto textarea)
                if (e.key === 'Enter' && field.tagName === 'INPUT') {
                    setTimeout(autoSaveDraft, 100);
                }
            });
        }
    });
    
    // También guardar cuando se hace clic fuera del formulario
    document.addEventListener('click', (e) => {
        const form = document.getElementById('event-form');
        if (form && !form.contains(e.target)) {
            // Verificar si hay cambios sin guardar
            const formData = getFormData();
            if (formData.title || formData.description || formData.type || formData.date) {
                autoSaveDraft();
            }
        }
    });
}

// Función debounce para evitar guardados excesivos
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Autoguardado del borrador
function autoSaveDraft() {
    const formData = getFormData();
    
    // Guardar si hay cualquier dato en el formulario (título, descripción, tipo o fecha)
    const hasData = formData.title || formData.description || formData.type || formData.date;
    
    if (hasData) {
        // Crear borrador con todos los datos
        currentDraft = {
            ...formData,
            lastSaved: new Date().toISOString()
        };
        
        try {
            localStorage.setItem(STORAGE_KEYS.DRAFT, JSON.stringify(currentDraft));
            localStorage.setItem(STORAGE_KEYS.LAST_SAVE, new Date().toISOString());
            
            // Mostrar badge de borrador
            const draftBadge = document.getElementById('draftBadge');
            if (draftBadge) {
                draftBadge.style.display = 'inline-flex';
            }
            
            // Mostrar indicador breve solo si hay cambios significativos
            // (evitar spam de indicadores mientras escribe)
            if (formData.title || formData.description) {
                showSaveIndicator('saving');
                setTimeout(() => {
                    showSaveIndicator('saved');
                }, 300);
            }
        } catch (e) {
            console.error('Error al guardar borrador:', e);
            if (e.name === 'QuotaExceededError') {
                showNotification('Error: No hay suficiente espacio para guardar el borrador', 'warning');
            }
        }
    } else {
        // Si no hay datos, limpiar el borrador
        clearDraft();
    }
}

// Guardado manual del borrador
function manualSaveDraft() {
    autoSaveDraft();
    showNotification('Borrador guardado automáticamente', 'info');
}

// Guardar evento final (con CSV)
function saveFinalEvent(e) {
    e.preventDefault();
    
    // Mostrar indicador de guardando
    showSaveIndicator('saving');
    
    // Obtener valores del formulario
    const formData = getFormData();
    
    // Validar que la fecha no sea futura
    const today = new Date().toISOString().split('T')[0];
    if (formData.date > today) {
        showNotification('La fecha no puede ser futura', 'warning');
        showSaveIndicator('error');
        return;
    }
    
    // Validar campos requeridos
    if (!formData.title || !formData.description || !formData.type) {
        showNotification('Por favor complete todos los campos requeridos', 'warning');
        showSaveIndicator('error');
        return;
    }
    
    // Crear objeto de evento final
    const event = {
        id: Date.now(), // ID único basado en timestamp
        date: formData.date,
        type: formData.type,
        route: formData.route,
        title: formData.title,
        description: formData.description,
        createdAt: new Date().toISOString()
    };
    
    // Agregar a la lista de eventos
    events.push(event);
    
    // Guardar en localStorage
    saveEventsToStorage();
    
    // Limpiar borrador
    clearDraft();
    
            // Actualizar la interfaz
            currentPage = 1; // Resetear a primera página
            applyFiltersAndRender();
            updateStatistics();
            clearForm();
    
    // Exportar a CSV automáticamente
    exportToCSV();
    
    // Mostrar notificación
    showNotification('Evento guardado y exportado a CSV');
    
    // Mostrar indicador de guardado exitoso
    showSaveIndicator('saved');
}

// Obtener datos del formulario
function getFormData() {
    return {
        date: document.getElementById('event-date').value,
        type: document.getElementById('event-type').value,
        route: document.getElementById('event-route').value,
        title: document.getElementById('event-title').value,
        description: document.getElementById('event-desc').value
    };
}

// Comprobar si hay borrador guardado
function checkForDraft() {
    const savedDraft = localStorage.getItem(STORAGE_KEYS.DRAFT);
    const lastSave = localStorage.getItem(STORAGE_KEYS.LAST_SAVE);
    
    if (savedDraft) {
        try {
            currentDraft = JSON.parse(savedDraft);
            
            // Mostrar sección de borrador recuperado
            document.getElementById('draftSection').style.display = 'block';
            
            // Calcular tiempo desde el último guardado
            if (lastSave) {
                const lastSaveDate = new Date(lastSave);
                const now = new Date();
                const diffMinutes = Math.floor((now - lastSaveDate) / (1000 * 60));
                
                if (diffMinutes > 0) {
                    const draftInfo = document.querySelector('#draftSection p');
                    draftInfo.textContent = `Tenemos un borrador no guardado de hace ${diffMinutes} minutos. ¿Quieres recuperarlo?`;
                }
            }
        } catch (e) {
            console.error('Error al cargar borrador:', e);
        }
    }
}

// Restaurar borrador
function restoreDraft() {
    if (!currentDraft) return;
    
    document.getElementById('event-date').value = currentDraft.date || new Date().toISOString().split('T')[0];
    document.getElementById('event-type').value = currentDraft.type || '';
    document.getElementById('event-route').value = currentDraft.route || '';
    document.getElementById('event-title').value = currentDraft.title || '';
    document.getElementById('event-desc').value = currentDraft.description || '';
    
    // Ocultar sección de borrador
    document.getElementById('draftSection').style.display = 'none';
    
    // Mostrar badge
    document.getElementById('draftBadge').style.display = 'inline-flex';
    
    showNotification('Borrador recuperado', 'info');
}

// Descartar borrador
function discardDraft() {
    clearDraft();
    document.getElementById('draftSection').style.display = 'none';
    showNotification('Borrador descartado', 'info');
}

// Limpiar borrador
function clearDraft() {
    currentDraft = null;
    localStorage.removeItem(STORAGE_KEYS.DRAFT);
    localStorage.removeItem(STORAGE_KEYS.LAST_SAVE);
    document.getElementById('draftBadge').style.display = 'none';
}

// Función para mostrar indicador de guardado
function showSaveIndicator(state) {
    const indicator = document.getElementById('saveIndicator');
    const icon = indicator.querySelector('i');
    const text = indicator.querySelector('span');
    
    indicator.classList.add('show');
    
    if (state === 'saving') {
        indicator.classList.add('saving');
        icon.className = 'fas fa-spinner fa-spin';
        text.textContent = 'Guardando...';
    } else if (state === 'saved') {
        indicator.classList.remove('saving');
        icon.className = 'fas fa-check';
        text.textContent = 'Guardado';
        
        // Ocultar después de 2 segundos
        setTimeout(() => {
            indicator.classList.remove('show');
        }, 2000);
    } else if (state === 'error') {
        indicator.classList.add('error');
        icon.className = 'fas fa-exclamation-triangle';
        text.textContent = 'Error';
        
        // Ocultar después de 2 segundos
        setTimeout(() => {
            indicator.classList.remove('show');
            indicator.classList.remove('error');
        }, 2000);
    }
}

// Manejar cierre de pestaña
function handleBeforeUnload(e) {
    const formData = getFormData();
    
    // Si hay cualquier dato en el formulario, guardar automáticamente
    const hasData = formData.title || formData.description || formData.type || formData.date;
    if (hasData) {
        // Guardar de forma síncrona antes de cerrar
        try {
            currentDraft = {
                ...formData,
                lastSaved: new Date().toISOString()
            };
            localStorage.setItem(STORAGE_KEYS.DRAFT, JSON.stringify(currentDraft));
            localStorage.setItem(STORAGE_KEYS.LAST_SAVE, new Date().toISOString());
        } catch (error) {
            console.error('Error al guardar antes de cerrar:', error);
        }
    }
}

// Función para mostrar notificaciones
function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    const icon = notification.querySelector('i');
    const text = document.getElementById('notification-text');
    
    text.textContent = message;
    
    if (type === 'warning') {
        notification.classList.add('warning');
        icon.className = 'fas fa-exclamation-triangle';
    } else if (type === 'info') {
        notification.classList.add('info');
        icon.className = 'fas fa-info-circle';
    } else {
        notification.classList.remove('warning');
        notification.classList.remove('info');
        icon.className = 'fas fa-check-circle';
    }
    
    notification.classList.add('show');
    
    setTimeout(() => {
        notification.classList.remove('show');
    }, 3000);
}

// Guardar eventos en localStorage
function saveEventsToStorage() {
    try {
        localStorage.setItem(STORAGE_KEYS.EVENTS, JSON.stringify(events));
        checkStorageLimit();
    } catch (e) {
        if (e.name === 'QuotaExceededError') {
            showNotification('Error: No hay suficiente espacio de almacenamiento. Por favor, elimina algunos eventos.', 'warning');
        } else {
            console.error('Error al guardar:', e);
        }
    }
}

// Validar límite de almacenamiento
function checkStorageLimit() {
    try {
        const used = JSON.stringify(localStorage).length;
        const limit = 5 * 1024 * 1024; // 5MB típico
        const percentage = (used / limit) * 100;
        
        if (percentage > 80) {
            showNotification(`Advertencia: El almacenamiento está al ${Math.round(percentage)}% de su capacidad`, 'warning');
        }
    } catch (e) {
        console.error('Error al verificar límite de almacenamiento:', e);
    }
}

// Exportar a CSV
function exportToCSV() {
    if (events.length === 0) {
        showNotification('No hay eventos para exportar', 'warning');
        return;
    }
    
    // Convertir eventos a formato CSV con BOM UTF-8 para Excel
    let csv = '\uFEFFID,Fecha,Tipo,Ruta,Título,Descripción,Creado\n';
    
    events.forEach(event => {
        const row = [
            event.id,
            event.date,
            event.type,
            event.route || '',
            `"${(event.title || '').replace(/"/g, '""')}"`,
            `"${(event.description || '').replace(/"/g, '""')}"`,
            event.createdAt
        ];
        
        csv += row.join(',') + '\n';
    });
    
    // Crear un blob y descargar
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    // Generar nombre de archivo con fecha actual
    const now = new Date();
    const dateStr = now.toISOString().split('T')[0];
    const timeStr = now.toTimeString().split(' ')[0].replace(/:/g, '-');
    const filename = `bitacora_entregas_${dateStr}_${timeStr}.csv`;
    
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    // Mostrar mensaje sobre dónde guardar
    showNotification(`CSV exportado: ${filename}. Guárdalo en la carpeta "storage".`);
}

// Función para renderizar eventos
function renderEvents(filteredEvents = null) {
    const eventsList = document.getElementById('events-list');
    const eventsToRender = filteredEvents || events;
    
    // Ordenar eventos por fecha (más reciente primero)
    eventsToRender.sort((a, b) => new Date(b.date) - new Date(a.date));
    
            if (eventsToRender.length === 0) {
        if (events.length === 0) {
            eventsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-clipboard-list"></i>
                    <h3>No hay eventos registrados</h3>
                    <p>Comienza agregando tu primer evento usando el formulario.</p>
                </div>
            `;
        } else {
            eventsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-search"></i>
                    <h3>No se encontraron eventos</h3>
                    <p>No hay eventos que coincidan con los filtros o búsqueda aplicados.</p>
                    <button class="btn" onclick="clearAllFilters()" style="margin-top: 15px;">
                        <i class="fas fa-times"></i> Limpiar Filtros
                    </button>
                </div>
            `;
        }
        return;
    }
    
    let html = '';
    
    eventsToRender.forEach(event => {
        // Formatear fecha para mostrar
        const formattedDate = formatDate(event.date);
        
        // Determinar la clase del tipo de evento
        let typeClass = '';
        let typeText = '';
        
        switch(event.type) {
            case 'delivery':
                typeClass = 'type-delivery';
                typeText = 'Entrega exitosa';
                break;
            case 'incident':
                typeClass = 'type-incident';
                typeText = 'Incidente';
                break;
            case 'observation':
                typeClass = 'type-observation';
                typeText = 'Observación';
                break;
            case 'other':
                typeClass = 'type-other';
                typeText = 'Otro';
                break;
        }
        
        html += `
            <div class="event-item">
                <div class="event-header">
                    <div>
                        <span class="event-type ${typeClass}">${typeText}</span>
                        ${event.route ? `<span class="event-route">${event.route}</span>` : ''}
                    </div>
                    <span class="event-date">${formattedDate}</span>
                </div>
                <div class="event-title">${escapeHtml(event.title)}</div>
                <div class="event-desc">${escapeHtml(event.description)}</div>
                <div class="event-actions">
                    <button class="btn btn-delete" onclick="deleteEvent(${event.id})">
                        <i class="fas fa-trash"></i> Eliminar
                    </button>
                </div>
            </div>
        `;
    });
    
    eventsList.innerHTML = html;
}

// Escapar HTML para prevenir XSS
function escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Manejar búsqueda
function handleSearch() {
    searchQuery = document.getElementById('search-input').value.trim().toLowerCase();
    currentPage = 1; // Resetear a primera página al buscar
    applyFiltersAndRender();
}

// Aplicar todos los filtros y búsqueda
function applyFiltersAndRender() {
    const filterDate = document.getElementById('filter-date').value;
    const filterType = document.getElementById('filter-type').value;
    
    // Empezar con todos los eventos
    filteredEvents = [...events];
    
    // Aplicar búsqueda de texto
    if (searchQuery) {
        filteredEvents = filteredEvents.filter(event => {
            const title = (event.title || '').toLowerCase();
            const description = (event.description || '').toLowerCase();
            const route = (event.route || '').toLowerCase();
            return title.includes(searchQuery) || 
                   description.includes(searchQuery) || 
                   route.includes(searchQuery);
        });
    }
    
    // Aplicar filtro de fecha
    if (filterDate) {
        filteredEvents = filteredEvents.filter(event => event.date === filterDate);
    }
    
    // Aplicar filtro de tipo
    if (filterType) {
        filteredEvents = filteredEvents.filter(event => event.type === filterType);
    }
    
    // Actualizar contador de resultados
    updateResultsCount();
    
    // Mostrar/ocultar botón limpiar filtros
    const clearFiltersBtn = document.getElementById('clear-filters');
    const hasActiveFilters = searchQuery || filterDate || filterType;
    if (clearFiltersBtn) {
        clearFiltersBtn.style.display = hasActiveFilters ? 'inline-flex' : 'none';
    }
    
    // Renderizar con paginación
    renderPaginatedEvents();
}

// Limpiar todos los filtros
function clearAllFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('filter-date').value = '';
    document.getElementById('filter-type').value = '';
    searchQuery = '';
    currentPage = 1;
    applyFiltersAndRender();
}

// Actualizar contador de resultados
function updateResultsCount() {
    const resultsCount = document.getElementById('results-count');
    if (resultsCount) {
        const total = filteredEvents.length;
        const totalAll = events.length;
        if (total === totalAll) {
            resultsCount.textContent = `${total} evento(s)`;
        } else {
            resultsCount.textContent = `${total} de ${totalAll} evento(s)`;
        }
    }
}

// Renderizar eventos con paginación
function renderPaginatedEvents() {
    const totalEvents = filteredEvents.length;
    
    // Calcular paginación
    const totalPages = itemsPerPage > 0 ? Math.ceil(totalEvents / itemsPerPage) : 1;
    const startIndex = itemsPerPage > 0 ? (currentPage - 1) * itemsPerPage : 0;
    const endIndex = itemsPerPage > 0 ? Math.min(startIndex + itemsPerPage, totalEvents) : totalEvents;
    
    // Obtener eventos para la página actual
    const eventsToRender = filteredEvents.slice(startIndex, endIndex);
    
    // Renderizar eventos
    renderEvents(eventsToRender);
    
    // Actualizar controles de paginación
    updatePaginationControls(totalPages, startIndex, endIndex, totalEvents);
}

// Actualizar controles de paginación
function updatePaginationControls(totalPages, startIndex, endIndex, totalEvents) {
    const paginationTop = document.getElementById('pagination-controls-top');
    const paginationBottom = document.getElementById('pagination-controls-bottom');
    
    // Mostrar/ocultar controles según si hay eventos
    const shouldShow = totalEvents > 0 && itemsPerPage > 0 && totalPages > 1;
    if (paginationTop) paginationTop.style.display = shouldShow ? 'flex' : 'none';
    if (paginationBottom) paginationBottom.style.display = shouldShow ? 'flex' : 'none';
    
    if (!shouldShow) return;
    
    // Actualizar información de paginación
    const infoText = `Mostrando ${startIndex + 1}-${endIndex} de ${totalEvents} eventos`;
    const infoTextTop = document.getElementById('pagination-info-text');
    const infoTextBottom = document.getElementById('pagination-info-text-bottom');
    if (infoTextTop) infoTextTop.textContent = infoText;
    if (infoTextBottom) infoTextBottom.textContent = infoText;
    
    // Actualizar botones anterior/siguiente
    const prevPageBtn = document.getElementById('prev-page');
    const nextPageBtn = document.getElementById('next-page');
    const prevPageBtnBottom = document.getElementById('prev-page-bottom');
    const nextPageBtnBottom = document.getElementById('next-page-bottom');
    
    const canGoPrev = currentPage > 1;
    const canGoNext = currentPage < totalPages;
    
    if (prevPageBtn) prevPageBtn.disabled = !canGoPrev;
    if (nextPageBtn) nextPageBtn.disabled = !canGoNext;
    if (prevPageBtnBottom) prevPageBtnBottom.disabled = !canGoPrev;
    if (nextPageBtnBottom) nextPageBtnBottom.disabled = !canGoNext;
    
    // Generar números de página
    renderPageNumbers(totalPages);
}

// Renderizar números de página
function renderPageNumbers(totalPages) {
    const pageNumbersTop = document.getElementById('page-numbers');
    const pageNumbersBottom = document.getElementById('page-numbers-bottom');
    
    if (!pageNumbersTop || !pageNumbersBottom) return;
    
    let html = '';
    const maxVisible = 7; // Máximo de números visibles
    let startPage = 1;
    let endPage = totalPages;
    
    if (totalPages > maxVisible) {
        if (currentPage <= 4) {
            startPage = 1;
            endPage = maxVisible;
        } else if (currentPage >= totalPages - 3) {
            startPage = totalPages - maxVisible + 1;
            endPage = totalPages;
        } else {
            startPage = currentPage - 3;
            endPage = currentPage + 3;
        }
    }
    
    // Botón primera página
    if (startPage > 1) {
        html += `<button class="page-number" onclick="goToPage(1)">1</button>`;
        if (startPage > 2) {
            html += `<span class="page-number ellipsis">...</span>`;
        }
    }
    
    // Números de página
    for (let i = startPage; i <= endPage; i++) {
        const isActive = i === currentPage;
        html += `<button class="page-number ${isActive ? 'active' : ''}" onclick="goToPage(${i})">${i}</button>`;
    }
    
    // Botón última página
    if (endPage < totalPages) {
        if (endPage < totalPages - 1) {
            html += `<span class="page-number ellipsis">...</span>`;
        }
        html += `<button class="page-number" onclick="goToPage(${totalPages})">${totalPages}</button>`;
    }
    
    pageNumbersTop.innerHTML = html;
    pageNumbersBottom.innerHTML = html;
}

// Ir a página específica (disponible globalmente)
function goToPage(page) {
    const totalPages = itemsPerPage > 0 ? Math.ceil(filteredEvents.length / itemsPerPage) : 1;
    if (page < 1 || page > totalPages) return;
    
    currentPage = page;
    applyFiltersAndRender();
    
    // Scroll suave hacia arriba de la lista
    const eventsList = document.getElementById('events-list');
    if (eventsList) {
        eventsList.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
}

// Hacer funciones disponibles globalmente para onclick
window.goToPage = goToPage;
window.clearAllFilters = clearAllFilters;

// Filtrar eventos (mantener compatibilidad)
function filterEvents() {
    applyFiltersAndRender();
}

// Eliminar evento
function deleteEvent(id) {
    if (confirm('¿Estás seguro de que quieres eliminar este evento?')) {
        events = events.filter(event => event.id !== id);
        saveEventsToStorage();
        currentPage = 1; // Resetear a primera página
        applyFiltersAndRender();
        updateStatistics();
        showNotification('Evento eliminado');
    }
}

// Eliminar todos los eventos
function clearAllEvents() {
    if (confirm('¿Estás seguro de que quieres eliminar TODOS los eventos? Esta acción no se puede deshacer.')) {
        events = [];
        saveEventsToStorage();
        currentPage = 1;
        filteredEvents = [];
        applyFiltersAndRender();
        updateStatistics();
        showNotification('Todos los eventos han sido eliminados', 'warning');
    }
}

// Limpiar formulario
function clearForm() {
    document.getElementById('event-form').reset();
    document.getElementById('event-date').valueAsDate = new Date();
    clearDraft();
}

// Actualizar estadísticas
function updateStatistics() {
    const total = events.length;
    const today = new Date().toISOString().split('T')[0];
    const todayEvents = events.filter(event => event.date === today).length;
    const deliveries = events.filter(event => event.type === 'delivery').length;
    const incidents = events.filter(event => event.type === 'incident').length;
    
    document.getElementById('total-events').textContent = total;
    document.getElementById('today-events').textContent = todayEvents;
    document.getElementById('delivery-count').textContent = deliveries;
    document.getElementById('incident-count').textContent = incidents;
}

// Formatear fecha para mostrar
function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('es-ES', options);
}

// Cargar eventos desde localStorage
function loadEvents() {
    const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
    if (savedEvents) {
        try {
            events = JSON.parse(savedEvents);
            filteredEvents = [...events];
            applyFiltersAndRender();
        } catch (e) {
            console.error('Error al cargar eventos:', e);
            events = [];
            filteredEvents = [];
        }
    }
}

// ========== FUNCIONALIDAD DE IMPORTACIÓN CSV ==========

// Manejar importación de CSV
function handleCSVImport(event) {
    const file = event.target.files[0];
    if (!file) return;
    
    if (!file.name.toLowerCase().endsWith('.csv')) {
        showNotification('Por favor selecciona un archivo CSV', 'warning');
        return;
    }
    
    const reader = new FileReader();
    
    reader.onload = function(e) {
        try {
            const csvContent = e.target.result;
            parseAndImportCSV(csvContent);
        } catch (error) {
            console.error('Error al leer archivo:', error);
            showNotification('Error al leer el archivo CSV', 'warning');
        }
    };
    
    reader.onerror = function() {
        showNotification('Error al leer el archivo', 'warning');
    };
    
    // Intentar leer como UTF-8 primero, si falla intentar Latin1
    reader.readAsText(file, 'UTF-8');
}

// Parsear e importar CSV
function parseAndImportCSV(csvContent) {
    const lines = csvContent.split('\n').filter(line => line.trim());
    if (lines.length < 2) {
        showNotification('El archivo CSV está vacío o no tiene el formato correcto', 'warning');
        return;
    }
    
    // Parsear encabezados
    const headers = parseCSVLine(lines[0]);
    const expectedHeaders = ['ID', 'Fecha', 'Tipo', 'Ruta', 'Título', 'Descripción', 'Creado'];
    
    // Validar estructura
    const validation = validateCSVStructure(headers, expectedHeaders);
    if (!validation.valid) {
        showNotification(`Error en estructura CSV: ${validation.error}`, 'warning');
        return;
    }
    
    // Mapear índices de columnas
    const columnMap = {};
    expectedHeaders.forEach((header, index) => {
        const headerIndex = headers.findIndex(h => h.toLowerCase() === header.toLowerCase());
        if (headerIndex !== -1) {
            columnMap[header] = headerIndex;
        }
    });
    
    // Parsear y validar datos
    const importedEvents = [];
    const errors = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        if (!line) continue;
        
        const row = parseCSVLine(line);
        const validationResult = validateCSVRow(row, columnMap, i + 1);
        
        if (validationResult.valid) {
            importedEvents.push(validationResult.event);
        } else {
            errors.push(`Fila ${i + 1}: ${validationResult.error}`);
        }
    }
    
    // Manejar duplicados
    if (importedEvents.length > 0) {
        handleDuplicateEvents(importedEvents, errors);
    } else {
        showNotification('No se encontraron eventos válidos para importar', 'warning');
    }
}

// Parsear línea CSV (maneja comillas y comas)
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        if (char === '"') {
            if (inQuotes && line[i + 1] === '"') {
                current += '"';
                i++; // Saltar siguiente comilla
            } else {
                inQuotes = !inQuotes;
            }
        } else if (char === ',' && !inQuotes) {
            result.push(current.trim());
            current = '';
        } else {
            current += char;
        }
    }
    
    result.push(current.trim());
    return result;
}

// Validar estructura del CSV
function validateCSVStructure(headers, expectedHeaders) {
    const missingHeaders = [];
    
    expectedHeaders.forEach(expected => {
        const found = headers.some(h => h.toLowerCase() === expected.toLowerCase());
        if (!found) {
            missingHeaders.push(expected);
        }
    });
    
    if (missingHeaders.length > 0) {
        return {
            valid: false,
            error: `Faltan las siguientes columnas: ${missingHeaders.join(', ')}`
        };
    }
    
    return { valid: true };
}

// Validar fila CSV
function validateCSVRow(row, columnMap, rowNumber) {
    const event = {};
    const errors = [];
    
    // Validar ID
    const idValue = row[columnMap['ID']];
    if (idValue && !isNaN(idValue)) {
        event.id = parseInt(idValue);
    } else {
        event.id = Date.now() + rowNumber; // Generar ID único si no existe
    }
    
    // Validar Fecha
    const dateValue = row[columnMap['Fecha']];
    if (!dateValue) {
        errors.push('Fecha es requerida');
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
        errors.push('Formato de fecha inválido (debe ser YYYY-MM-DD)');
    } else {
        event.date = dateValue;
    }
    
    // Validar Tipo
    const typeValue = row[columnMap['Tipo']];
    const validTypes = ['delivery', 'incident', 'observation', 'other'];
    if (!typeValue) {
        errors.push('Tipo es requerido');
    } else if (!validTypes.includes(typeValue.toLowerCase())) {
        errors.push(`Tipo inválido: ${typeValue}. Debe ser uno de: ${validTypes.join(', ')}`);
    } else {
        event.type = typeValue.toLowerCase();
    }
    
    // Ruta (opcional)
    event.route = row[columnMap['Ruta']] || '';
    
    // Validar Título
    const titleValue = row[columnMap['Título']];
    if (!titleValue || titleValue.trim() === '') {
        errors.push('Título es requerido');
    } else {
        event.title = titleValue.trim();
    }
    
    // Validar Descripción
    const descValue = row[columnMap['Descripción']];
    if (!descValue || descValue.trim() === '') {
        errors.push('Descripción es requerida');
    } else {
        event.description = descValue.trim();
    }
    
    // Creado (opcional, generar si no existe)
    const createdValue = row[columnMap['Creado']];
    if (createdValue) {
        event.createdAt = createdValue;
    } else {
        event.createdAt = new Date().toISOString();
    }
    
    if (errors.length > 0) {
        return {
            valid: false,
            error: errors.join('; ')
        };
    }
    
    return {
        valid: true,
        event: event
    };
}

// Manejar eventos duplicados
function handleDuplicateEvents(importedEvents, errors) {
    const duplicates = [];
    const newEvents = [];
    
    importedEvents.forEach(importedEvent => {
        // Buscar duplicados por ID o por fecha+título
        const duplicate = events.find(existingEvent => 
            existingEvent.id === importedEvent.id || 
            (existingEvent.date === importedEvent.date && 
             existingEvent.title === importedEvent.title)
        );
        
        if (duplicate) {
            duplicates.push(importedEvent);
        } else {
            newEvents.push(importedEvent);
        }
    });
    
    if (duplicates.length > 0 && newEvents.length === 0) {
        // Solo hay duplicados
        showDuplicateModal(duplicates, errors, 'replace');
    } else if (duplicates.length > 0) {
        // Hay duplicados y eventos nuevos
        showDuplicateModal(duplicates, newEvents, errors);
    } else {
        // No hay duplicados, importar directamente
        importEvents(newEvents, errors);
    }
}

// Mostrar modal de duplicados
function showDuplicateModal(duplicates, newEventsOrErrors, errorsOrAction) {
    const modal = document.getElementById('duplicate-modal');
    if (!modal) {
        // Si no existe el modal, crear uno dinámico
        createDuplicateModal(duplicates, newEventsOrErrors, errorsOrAction);
        return;
    }
    
    const duplicateCount = document.getElementById('duplicate-count');
    const newCount = document.getElementById('new-count');
    
    if (duplicateCount) duplicateCount.textContent = duplicates.length;
    if (newCount && Array.isArray(newEventsOrErrors)) {
        newCount.textContent = newEventsOrErrors.length;
    }
    
    modal.classList.add('show');
    
    // Configurar botones
    const replaceBtn = document.getElementById('replace-duplicates');
    const keepBothBtn = document.getElementById('keep-both');
    const cancelBtn = document.getElementById('cancel-import');
    
    if (replaceBtn) {
        replaceBtn.onclick = () => {
            modal.classList.remove('show');
            if (Array.isArray(newEventsOrErrors)) {
                importEvents([...duplicates, ...newEventsOrErrors], errorsOrAction || []);
            } else {
                importEvents(duplicates, newEventsOrErrors || [], 'replace');
            }
        };
    }
    
    if (keepBothBtn) {
        keepBothBtn.onclick = () => {
            modal.classList.remove('show');
            if (Array.isArray(newEventsOrErrors)) {
                // Generar nuevos IDs para duplicados
                duplicates.forEach(dup => {
                    dup.id = Date.now() + Math.random();
                });
                importEvents([...duplicates, ...newEventsOrErrors], errorsOrAction || []);
            } else {
                duplicates.forEach(dup => {
                    dup.id = Date.now() + Math.random();
                });
                importEvents(duplicates, newEventsOrErrors || []);
            }
        };
    }
    
    if (cancelBtn) {
        cancelBtn.onclick = () => {
            modal.classList.remove('show');
            showNotification('Importación cancelada', 'info');
        };
    }
}

// Crear modal de duplicados dinámicamente
function createDuplicateModal(duplicates, newEventsOrErrors, errorsOrAction) {
    const modal = document.createElement('div');
    modal.id = 'duplicate-modal';
    modal.className = 'modal';
    
    const isReplaceOnly = typeof errorsOrAction === 'string' && errorsOrAction === 'replace';
    const newEvents = Array.isArray(newEventsOrErrors) ? newEventsOrErrors : [];
    const errors = Array.isArray(newEventsOrErrors) ? errorsOrAction : newEventsOrErrors;
    
    modal.innerHTML = `
        <div class="modal-content">
            <h3><i class="fas fa-exclamation-triangle"></i> Eventos Duplicados Detectados</h3>
            <p>Se encontraron <strong id="duplicate-count">${duplicates.length}</strong> eventos duplicados${newEvents.length > 0 ? ` y <strong id="new-count">${newEvents.length}</strong> eventos nuevos` : ''}.</p>
            <p>¿Qué deseas hacer con los eventos duplicados?</p>
            <div class="modal-actions">
                <button id="replace-duplicates" class="btn btn-warning">
                    <i class="fas fa-sync"></i> Reemplazar Duplicados
                </button>
                <button id="keep-both" class="btn btn-success">
                    <i class="fas fa-plus"></i> Mantener Ambos
                </button>
                <button id="cancel-import" class="btn btn-delete">
                    <i class="fas fa-times"></i> Cancelar
                </button>
            </div>
        </div>
    `;
    
    document.body.appendChild(modal);
    
    // Configurar eventos
    document.getElementById('replace-duplicates').onclick = () => {
        modal.classList.remove('show');
        if (isReplaceOnly) {
            importEvents(duplicates, errors || [], 'replace');
        } else {
            importEvents([...duplicates, ...newEvents], errors || []);
        }
    };
    
    document.getElementById('keep-both').onclick = () => {
        modal.classList.remove('show');
        duplicates.forEach(dup => {
            dup.id = Date.now() + Math.random();
        });
        if (isReplaceOnly) {
            importEvents(duplicates, errors || []);
        } else {
            importEvents([...duplicates, ...newEvents], errors || []);
        }
    };
    
    document.getElementById('cancel-import').onclick = () => {
        modal.classList.remove('show');
        showNotification('Importación cancelada', 'info');
    };
    
    modal.classList.add('show');
}

// Importar eventos
function importEvents(eventsToImport, errors = [], action = 'add') {
    if (action === 'replace') {
        // Reemplazar duplicados
        eventsToImport.forEach(importedEvent => {
            const index = events.findIndex(e => 
                e.id === importedEvent.id || 
                (e.date === importedEvent.date && e.title === importedEvent.title)
            );
            if (index !== -1) {
                events[index] = importedEvent;
            } else {
                events.push(importedEvent);
            }
        });
    } else {
        // Agregar eventos
        events.push(...eventsToImport);
    }
    
    // Guardar en localStorage
    saveEventsToStorage();
    
    // Actualizar interfaz
    currentPage = 1;
    applyFiltersAndRender();
    updateStatistics();
    
    // Mostrar resumen
    const successMsg = `Se importaron ${eventsToImport.length} evento(s) exitosamente`;
    const errorMsg = errors.length > 0 ? `. ${errors.length} error(es) encontrado(s)` : '';
    
    showNotification(successMsg + errorMsg, errors.length > 0 ? 'warning' : 'success');
    
    // Mostrar detalles de errores si hay
    if (errors.length > 0) {
        console.warn('Errores de importación:', errors);
    }
    
    // Limpiar input de archivo
    const fileInput = document.getElementById('import-csv-file');
    if (fileInput) {
        fileInput.value = '';
    }
}

