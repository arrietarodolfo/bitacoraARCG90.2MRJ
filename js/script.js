// Variables globales
let events = [];
let currentDraft = null;
let autoSaveTimeout = null;

// Variables de scroll infinito y búsqueda
let visibleEventsCount = 20; // Eventos visibles inicialmente
let filteredEvents = [];
let searchQuery = '';
let editingEventId = null; // ID del evento que se está editando
let isLoadingMore = false; // Flag para evitar múltiples cargas simultáneas

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
    
    // Configurar toggle del formulario
    const toggleFormBtn = document.getElementById('toggle-form-btn');
    const formContent = document.getElementById('form-content');
    const formCard = document.getElementById('form-card');
    if (toggleFormBtn && formContent && formCard) {
        toggleFormBtn.addEventListener('click', function() {
            const isVisible = formContent.style.display !== 'none';
            
            if (isVisible) {
                // Colapsar: ocultar contenido y minimizar card
                formContent.style.display = 'none';
                formCard.classList.add('card-form-collapsed');
                formCard.style.padding = '0';
                formCard.style.height = '0';
                formCard.style.marginBottom = '0';
                toggleFormBtn.classList.remove('active');
            } else {
                // Expandir: mostrar contenido y restaurar card
                formCard.classList.remove('card-form-collapsed');
                formCard.style.padding = '25px';
                formCard.style.height = 'auto';
                formCard.style.marginBottom = '20px';
                formContent.style.display = 'block';
                toggleFormBtn.classList.add('active');
                
                // Scroll suave hacia el formulario
                setTimeout(() => {
                    formCard.scrollIntoView({ behavior: 'smooth', block: 'start' });
                }, 100);
            }
        });
    }
    
    // Configurar eventos del formulario
    document.getElementById('event-form').addEventListener('submit', saveFinalEvent);
    document.getElementById('clear-form').addEventListener('click', clearForm);
    document.getElementById('export-now').addEventListener('click', exportToCSV);
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
    // Configurar scroll infinito después de cargar eventos
    setTimeout(() => {
        setupInfiniteScroll();
    }, 500);
    
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

// Exportar bitácora (descargar CSV)

// Guardar evento (sin exportar CSV)
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
    
    if (editingEventId !== null) {
        // Modo edición: actualizar evento existente
        const eventIndex = events.findIndex(e => e.id === editingEventId);
        if (eventIndex !== -1) {
            // Mantener el ID y createdAt originales
            events[eventIndex] = {
                ...events[eventIndex],
                date: formData.date,
                type: formData.type,
                route: formData.route,
                title: formData.title,
                description: formData.description
            };
            
            showNotification('Evento actualizado exitosamente');
        } else {
            showNotification('Error: No se encontró el evento a editar', 'warning');
            showSaveIndicator('error');
            return;
        }
    } else {
        // Modo creación: crear nuevo evento
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
        showNotification('Evento guardado exitosamente');
    }
    
    // Ordenar eventos por fecha y hora de creación (más reciente primero)
    events.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(a.date + 'T00:00:00');
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(b.date + 'T00:00:00');
        return dateB - dateA; // Más reciente primero
    });
    
    // Guardar en localStorage
    saveEventsToStorage();
    
    // Limpiar borrador
    clearDraft();
    
    // Salir del modo edición
    cancelEdit();
    
    // Actualizar la interfaz
    visibleEventsCount = 20; // Resetear contador
    applyFiltersAndRender();
    updateStatistics();
    clearForm();
    
    // Mostrar indicador de guardado exitoso
    showSaveIndicator('saved');
}

// Editar evento (disponible globalmente)
window.editEvent = function(id) {
    const event = events.find(e => e.id === id);
    if (!event) {
        showNotification('Error: No se encontró el evento', 'warning');
        return;
    }
    
    // Guardar el ID del evento que se está editando
    editingEventId = id;
    
    // Cargar datos en el formulario
    document.getElementById('event-title').value = event.title || '';
    document.getElementById('event-date').value = event.date || '';
    document.getElementById('event-type').value = event.type || '';
    document.getElementById('event-route').value = event.route || '';
    document.getElementById('event-desc').value = event.description || '';
    
    // Actualizar el título del formulario
    const formTitle = document.querySelector('.card h2');
    if (formTitle) {
        const originalTitle = formTitle.innerHTML;
        formTitle.setAttribute('data-original-title', originalTitle);
        formTitle.innerHTML = '<i class="fas fa-edit"></i> Editar Evento';
    }
    
    // Mostrar botón de cancelar edición si no existe
    let cancelEditBtn = document.getElementById('cancel-edit-btn');
    if (!cancelEditBtn) {
        const btnGroup = document.querySelector('.btn-group');
        if (btnGroup) {
            cancelEditBtn = document.createElement('button');
            cancelEditBtn.type = 'button';
            cancelEditBtn.id = 'cancel-edit-btn';
            cancelEditBtn.className = 'btn btn-secondary';
            cancelEditBtn.innerHTML = '<i class="fas fa-times"></i> Cancelar Edición';
            cancelEditBtn.onclick = cancelEdit;
            btnGroup.insertBefore(cancelEditBtn, btnGroup.firstChild);
        }
    }
    if (cancelEditBtn) {
        cancelEditBtn.style.display = 'inline-block';
    }
    
    // Cambiar texto del botón de guardar
    const saveButton = document.getElementById('save-button');
    if (saveButton) {
        saveButton.innerHTML = '<i class="fas fa-save"></i> Actualizar Evento';
    }
    
    // Scroll al formulario
    document.querySelector('.card h2').scrollIntoView({ behavior: 'smooth', block: 'start' });
    
    showNotification('Modo edición activado. Modifica los campos y haz clic en "Actualizar Evento"', 'info');
}

// Cancelar edición
window.cancelEdit = function() {
    editingEventId = null;
    
    // Restaurar título del formulario
    const formTitle = document.querySelector('.card h2');
    if (formTitle && formTitle.getAttribute('data-original-title')) {
        formTitle.innerHTML = formTitle.getAttribute('data-original-title');
        formTitle.removeAttribute('data-original-title');
    }
    
    // Ocultar botón de cancelar
    const cancelEditBtn = document.getElementById('cancel-edit-btn');
    if (cancelEditBtn) {
        cancelEditBtn.style.display = 'none';
    }
    
    // Restaurar texto del botón de guardar
    const saveButton = document.getElementById('save-button');
    if (saveButton) {
        saveButton.innerHTML = '<i class="fas fa-save"></i> Guardar Evento';
    }
    
    // Limpiar borrador
    clearDraft();
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
        // Escapar comillas y asegurar que los campos de texto estén entre comillas
        const escapeCSV = (field) => {
            if (field === null || field === undefined) return '""';
            const str = String(field);
            // Escapar comillas dobles y envolver en comillas
            return `"${str.replace(/"/g, '""')}"`;
        };
        
        const row = [
            event.id || '',
            event.date || '',
            event.type || '',
            event.route ? escapeCSV(event.route) : '""',
            escapeCSV(event.title || ''),
            escapeCSV(event.description || ''),
            event.createdAt || new Date().toISOString()
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

// Función para renderizar eventos con scroll infinito
function renderEvents(filteredEvents = null, append = false) {
    const eventsList = document.getElementById('events-list');
    const eventsToRender = filteredEvents || events;
    
    // Ordenar eventos por fecha y hora de creación (más reciente primero)
    eventsToRender.sort((a, b) => {
        // Usar createdAt si existe, si no usar date con hora actual
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(a.date + 'T00:00:00');
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(b.date + 'T00:00:00');
        return dateB - dateA; // Más reciente primero
    });
    
    // Si no hay eventos, mostrar mensaje
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
        visibleEventsCount = 20; // Resetear contador
        return;
    }
    
    // Calcular cuántos eventos mostrar
    let startIndex, endIndex;
    if (append) {
        // En modo append, agregar los siguientes 20 eventos
        startIndex = visibleEventsCount - 20; // Ya mostramos hasta aquí
        endIndex = Math.min(visibleEventsCount, eventsToRender.length);
    } else {
        // En modo normal, mostrar desde el inicio
        startIndex = 0;
        endIndex = Math.min(20, eventsToRender.length);
        visibleEventsCount = 20; // Resetear contador
    }
    
    const eventsToShow = eventsToRender.slice(startIndex, endIndex);
    
    // Si no hay eventos para mostrar y estamos en modo append, no hacer nada
    if (append && eventsToShow.length === 0) {
        isLoadingMore = false;
        return;
    }
    
    // Si no es append, limpiar y mostrar desde el inicio
    let html = '';
    if (append) {
        // En modo append, mantener el HTML existente y agregar al final
        html = eventsList.innerHTML;
        // Remover el indicador de carga si existe
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
    }
    
    eventsToShow.forEach(event => {
        // Formatear fecha para mostrar
        // Formatear fecha y hora de creación
        const formattedDate = formatDateWithTime(event.date, event.createdAt);
        
        // Determinar la clase del tipo de evento
        let typeClass = '';
        let typeText = '';
        
        switch(event.type) {
            case 'driver-registration':
                typeClass = 'type-delivery';
                typeText = 'Registro de driver en app';
                break;
            case 'first-day-driver':
                typeClass = 'type-incident';
                typeText = 'Primer día Driver';
                break;
            case 'driver-resignation':
                typeClass = 'type-observation';
                typeText = 'Renuncia Driver';
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
            default:
                typeClass = 'type-other';
                typeText = event.type;
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
                    <button class="btn btn-edit" onclick="editEvent(${event.id})" title="Editar evento">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-delete" onclick="deleteEvent(${event.id})" title="Eliminar evento">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    });
    
    eventsList.innerHTML = html;
    
    // Actualizar contador de resultados
    updateResultsCount();
    
    // Configurar scroll infinito si hay más eventos por cargar
    if (endIndex < eventsToRender.length) {
        setupInfiniteScroll();
    } else {
        // Remover el indicador de carga si existe
        const loadingIndicator = document.getElementById('loading-indicator');
        if (loadingIndicator) {
            loadingIndicator.remove();
        }
    }
}

// Configurar scroll infinito
function setupInfiniteScroll() {
    // Remover listeners anteriores
    if (window._scrollHandler) {
        window.removeEventListener('scroll', window._scrollHandler);
    }
    
    // Crear nuevo handler para el scroll de la ventana
    const handleScroll = () => {
        if (isLoadingMore) return;
        
        const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
        const scrollHeight = document.documentElement.scrollHeight;
        const clientHeight = window.innerHeight;
        
        // Cuando el usuario está cerca del final (200px antes)
        if (scrollTop + clientHeight >= scrollHeight - 200) {
            loadMoreEvents();
        }
    };
    
    // Guardar referencia al handler
    window._scrollHandler = handleScroll;
    window.addEventListener('scroll', handleScroll, { passive: true });
}

// Cargar más eventos
function loadMoreEvents() {
    if (isLoadingMore) return;
    
    const eventsToRender = filteredEvents.length > 0 ? filteredEvents : events;
    
    if (visibleEventsCount >= eventsToRender.length) {
        return; // Ya se mostraron todos los eventos
    }
    
    isLoadingMore = true;
    
    // Mostrar indicador de carga
    const eventsList = document.getElementById('events-list');
    if (eventsList && !document.getElementById('loading-indicator')) {
        const loadingDiv = document.createElement('div');
        loadingDiv.id = 'loading-indicator';
        loadingDiv.className = 'loading-indicator';
        loadingDiv.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Cargando más eventos...';
        eventsList.appendChild(loadingDiv);
    }
    
    // Simular un pequeño delay para mejor UX
    setTimeout(() => {
        visibleEventsCount += 20;
        renderEvents(filteredEvents.length > 0 ? filteredEvents : null, true);
        isLoadingMore = false;
    }, 300);
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
    visibleEventsCount = 20; // Resetear contador al buscar
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
    
    // Renderizar eventos (sin append, desde el inicio)
    renderEvents(filteredEvents, false);
}

// Limpiar todos los filtros
function clearAllFilters() {
    document.getElementById('search-input').value = '';
    document.getElementById('filter-date').value = '';
    document.getElementById('filter-type').value = '';
    searchQuery = '';
    visibleEventsCount = 20; // Resetear contador
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

// Hacer funciones disponibles globalmente para onclick
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
        visibleEventsCount = 20; // Resetear contador
        applyFiltersAndRender();
        updateStatistics();
        showNotification('Evento eliminado');
    }
}


// Limpiar formulario
function clearForm() {
    document.getElementById('event-form').reset();
    document.getElementById('event-date').valueAsDate = new Date();
    clearDraft();
    // Cancelar edición si está activa
    if (editingEventId !== null) {
        cancelEdit();
    }
}

// Actualizar estadísticas
function updateStatistics() {
    const total = events.length;
    const today = new Date().toISOString().split('T')[0];
    const todayEvents = events.filter(event => event.date === today).length;
    // Contar renuncias e incidentes como "incidencias reportadas"
    const incidents = events.filter(event => event.type === 'driver-resignation' || event.type === 'incident').length;
    
    document.getElementById('total-events').textContent = total;
    document.getElementById('today-events').textContent = todayEvents;
    document.getElementById('incident-count').textContent = incidents;
}

// Formatear fecha para mostrar
function formatDate(dateString) {
    const date = new Date(dateString + 'T00:00:00');
    const options = { year: 'numeric', month: 'long', day: 'numeric' };
    return date.toLocaleDateString('es-ES', options);
}

// Formatear fecha y hora de creación
function formatDateWithTime(dateString, createdAt) {
    const date = new Date(dateString + 'T00:00:00');
    const dateOptions = { year: 'numeric', month: 'long', day: 'numeric' };
    const dateStr = date.toLocaleDateString('es-ES', dateOptions);
    
    // Si hay createdAt, mostrar también la hora
    if (createdAt) {
        try {
            const createdDate = new Date(createdAt);
            const timeOptions = { hour: '2-digit', minute: '2-digit' };
            const timeStr = createdDate.toLocaleTimeString('es-ES', timeOptions);
            return `${dateStr} - ${timeStr}`;
        } catch (e) {
            // Si hay error al parsear createdAt, solo mostrar fecha
            return dateStr;
        }
    }
    
    return dateStr;
}

// Cargar eventos desde localStorage
function loadEvents() {
    const savedEvents = localStorage.getItem(STORAGE_KEYS.EVENTS);
    if (savedEvents) {
        try {
            events = JSON.parse(savedEvents);
            // Ordenar eventos por fecha y hora de creación (más reciente primero)
            events.sort((a, b) => {
                const dateA = a.createdAt ? new Date(a.createdAt) : new Date(a.date + 'T00:00:00');
                const dateB = b.createdAt ? new Date(b.createdAt) : new Date(b.date + 'T00:00:00');
                return dateB - dateA; // Más reciente primero
            });
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
            if (!csvContent || csvContent.trim() === '') {
                showNotification('El archivo CSV está vacío', 'warning');
                return;
            }
            parseAndImportCSV(csvContent);
        } catch (error) {
            console.error('Error al leer archivo:', error);
            showNotification('Error al leer el archivo CSV: ' + error.message, 'warning');
        }
    };
    
    reader.onerror = function() {
        showNotification('Error al leer el archivo', 'warning');
    };
    
    // Intentar leer como UTF-8 primero (con BOM si existe), si falla intentar Latin1
    reader.readAsText(file, 'UTF-8');
}

// Parsear e importar CSV
function parseAndImportCSV(csvContent) {
    // Normalizar saltos de línea y dividir
    csvContent = csvContent.replace(/\r\n/g, '\n').replace(/\r/g, '\n');
    
    // Dividir en líneas, pero manejar campos multilínea entre comillas
    const lines = [];
    let currentLine = '';
    let inQuotes = false;
    
    for (let i = 0; i < csvContent.length; i++) {
        const char = csvContent[i];
        const nextChar = csvContent[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Comilla escapada ("" dentro de comillas)
                currentLine += '"';
                i++; // Saltar siguiente comilla
            } else {
                // Inicio o fin de comillas
                inQuotes = !inQuotes;
                // Mantener las comillas en la línea para que parseCSVLine las maneje
                currentLine += char;
            }
        } else if (char === '\n' && !inQuotes) {
            // Solo dividir en nueva línea si NO estamos dentro de comillas
            if (currentLine.trim()) {
                lines.push(currentLine);
            }
            currentLine = '';
        } else {
            // Agregar carácter al campo actual (incluyendo saltos de línea si estamos en comillas)
            currentLine += char;
        }
    }
    
    // Agregar última línea si existe
    if (currentLine.trim()) {
        lines.push(currentLine);
    }
    
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
    
    // Mapear índices de columnas (normalizar para comparar sin espacios ni acentos)
    const columnMap = {};
    const normalize = (str) => str.toLowerCase().trim().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '');
    
    expectedHeaders.forEach((header) => {
        const headerIndex = headers.findIndex(h => normalize(h) === normalize(header));
        if (headerIndex !== -1) {
            columnMap[header] = headerIndex;
        } else {
            console.warn(`⚠️ Columna no encontrada: "${header}". Columnas disponibles:`, headers);
        }
    });
    
    // Verificar que todas las columnas requeridas estén mapeadas
    const requiredColumns = ['ID', 'Fecha', 'Tipo', 'Título', 'Descripción'];
    const missingRequired = requiredColumns.filter(col => columnMap[col] === undefined);
    if (missingRequired.length > 0) {
        showNotification(`Error: Faltan columnas requeridas: ${missingRequired.join(', ')}`, 'warning');
        console.error('Columnas faltantes:', missingRequired, 'Columnas encontradas:', headers);
        return;
    }
    
    // Parsear y validar datos
    const importedEvents = [];
    const errors = [];
    
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (!line || line.trim() === '') continue;
        
            try {
            const row = parseCSVLine(line);
            
            // Debug: mostrar información de la fila parseada
            if (row.length !== expectedHeaders.length) {
                console.warn(`Fila ${i + 1}: Número de columnas incorrecto. Esperado: ${expectedHeaders.length}, Obtenido: ${row.length}`);
                console.warn('Fila parseada:', row);
                console.warn('Headers esperados:', expectedHeaders);
            }
            
            // Debug: mostrar valores de cada columna (especialmente la descripción)
            console.log(`\n=== Procesando fila ${i + 1} ===`);
            console.log('Longitud de la línea:', line.length);
            console.log('Número de campos parseados:', row.length);
            expectedHeaders.forEach(header => {
                const idx = columnMap[header];
                if (idx !== undefined && idx < row.length) {
                    const value = row[idx];
                    const preview = value ? (value.length > 100 ? value.substring(0, 100) + '...' : value) : '(vacío)';
                    console.log(`  ${header} (índice ${idx}):`, preview, `(longitud: ${value ? value.length : 0})`);
                } else {
                    console.warn(`  ${header}: índice no encontrado o fuera de rango`);
                }
            });
            
            const validationResult = validateCSVRow(row, columnMap, i + 1);
            
            if (validationResult.valid) {
                // Verificar que todos los campos estén presentes
                if (!validationResult.event.description || validationResult.event.description.trim() === '') {
                    console.error(`Fila ${i + 1}: Descripción vacía después de validación`, validationResult.event);
                    console.error('Valor original de descripción en la fila:', row[columnMap['Descripción']]);
                } else {
                    console.log(`Fila ${i + 1}: Descripción importada correctamente (${validationResult.event.description.length} caracteres)`);
                }
                importedEvents.push(validationResult.event);
            } else {
                errors.push(`Fila ${i + 1}: ${validationResult.error}`);
                console.error(`Error en fila ${i + 1}:`, validationResult.error);
                console.error('Fila parseada completa:', row);
                console.error('Valor de descripción en la fila:', row[columnMap['Descripción']]);
            }
        } catch (error) {
            errors.push(`Fila ${i + 1}: Error al parsear - ${error.message}`);
            console.error(`Error al parsear fila ${i + 1}:`, error);
            console.error('Línea original:', line.substring(0, 200)); // Primeros 200 caracteres
        }
    }
    
    // Manejar duplicados
    if (importedEvents.length > 0) {
        handleDuplicateEvents(importedEvents, errors);
    } else {
        showNotification('No se encontraron eventos válidos para importar', 'warning');
    }
}

// Parsear línea CSV (maneja comillas, comas y saltos de línea)
function parseCSVLine(line) {
    const result = [];
    let current = '';
    let inQuotes = false;
    
    for (let i = 0; i < line.length; i++) {
        const char = line[i];
        const nextChar = line[i + 1];
        
        if (char === '"') {
            if (inQuotes && nextChar === '"') {
                // Comilla escapada ("" dentro de comillas)
                current += '"';
                i++; // Saltar siguiente comilla
            } else {
                // Inicio o fin de comillas
                inQuotes = !inQuotes;
                // No agregar las comillas al contenido
            }
        } else if (char === ',' && !inQuotes) {
            // Fin de campo (solo si no estamos dentro de comillas)
            result.push(current);
            current = '';
        } else {
            // Agregar carácter al campo actual (incluyendo saltos de línea si estamos en comillas)
            current += char;
        }
    }
    
    // Agregar el último campo
    result.push(current);
    
    // Limpiar y procesar cada campo
    return result.map(field => {
        // Reemplazar comillas dobles escapadas por comillas simples
        field = field.replace(/""/g, '"');
        // NO hacer trim aquí para preservar espacios importantes en la descripción
        return field;
    });
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
    const validTypes = ['driver-registration', 'first-day-driver', 'driver-resignation', 'incident', 'observation', 'other'];
    // También aceptar el tipo antiguo 'delivery' para compatibilidad
    const legacyTypes = ['delivery'];
    const allValidTypes = [...validTypes, ...legacyTypes];
    
    if (!typeValue) {
        errors.push('Tipo es requerido');
    } else {
        const normalizedType = typeValue.toLowerCase().trim();
        if (allValidTypes.includes(normalizedType)) {
            // Si es el tipo legado 'delivery', mapearlo a 'driver-registration'
            if (normalizedType === 'delivery') {
                event.type = 'driver-registration';
            } else {
                event.type = normalizedType;
            }
        } else {
            errors.push(`Tipo inválido: ${typeValue}. Debe ser uno de: ${validTypes.join(', ')}`);
        }
    }
    
    // Ruta (opcional)
    const routeValue = row[columnMap['Ruta']];
    event.route = routeValue ? routeValue.trim() : '';
    
    // Validar Título
    const titleIndex = columnMap['Título'];
    if (titleIndex === undefined || titleIndex >= row.length) {
        errors.push('Título no encontrado en la fila');
    } else {
        const titleValue = row[titleIndex];
        if (!titleValue || (typeof titleValue === 'string' && titleValue.trim() === '')) {
            errors.push('Título es requerido');
        } else {
            event.title = String(titleValue).trim();
        }
    }
    
    // Validar Descripción
    const descIndex = columnMap['Descripción'];
    if (descIndex === undefined || descIndex >= row.length) {
        errors.push('Descripción no encontrada en la fila');
    } else {
        const descValue = row[descIndex];
        if (descValue === undefined || descValue === null) {
            errors.push('Descripción es requerida y no puede estar vacía');
        } else {
            // Convertir a string y limpiar espacios al inicio y final, pero mantener saltos de línea
            const descStr = String(descValue);
            // Solo hacer trim de espacios en blanco al inicio y final, no de saltos de línea
            event.description = descStr.replace(/^[\s\uFEFF\xA0]+|[\s\uFEFF\xA0]+$/g, '');
            // Verificar que la descripción no esté vacía después del procesamiento
            if (event.description === '' || event.description.trim() === '') {
                errors.push('Descripción está vacía después de procesar');
            }
        }
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
    
    // Ordenar eventos por fecha y hora de creación (más reciente primero)
    events.sort((a, b) => {
        const dateA = a.createdAt ? new Date(a.createdAt) : new Date(a.date + 'T00:00:00');
        const dateB = b.createdAt ? new Date(b.createdAt) : new Date(b.date + 'T00:00:00');
        return dateB - dateA; // Más reciente primero
    });
    
    // Guardar en localStorage
    saveEventsToStorage();
    
    // Actualizar interfaz
    visibleEventsCount = 20; // Resetear contador
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

