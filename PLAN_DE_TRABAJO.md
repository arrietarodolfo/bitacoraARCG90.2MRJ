# Plan de Trabajo - Bitácora de Entregas ARCG90 2MRJ

## 📋 Resumen Ejecutivo

Este documento describe el plan de trabajo para mejorar y expandir las funcionalidades de la aplicación web "Bitácora de Entregas". El plan incluye mejoras de arquitectura, nuevas funcionalidades y optimizaciones de rendimiento.

---

## 🎯 Objetivos

1. Mejorar la estructura y mantenibilidad del código
2. Agregar funcionalidad de importación de CSV
3. Optimizar el rendimiento y la experiencia del usuario
4. Implementar características avanzadas de gestión de datos

---

## 📅 Fases del Proyecto

### **FASE 1: Refactorización y Organización del Código**
**Prioridad: Alta** | **Tiempo estimado: 2-3 horas**

#### 1.1 Separar CSS en archivo externo
- **Objetivo**: Mejorar mantenibilidad y organización
- **Tareas**:
  - Crear archivo `styles.css`
  - Mover todos los estilos del `<style>` al archivo externo
  - Actualizar `index.html` para referenciar el CSS externo
  - Verificar que todos los estilos funcionen correctamente
- **Archivos afectados**: `index.html`, `styles.css` (nuevo)

#### 1.2 Separar JavaScript en archivo externo
- **Objetivo**: Mejorar organización y facilitar debugging
- **Tareas**:
  - Crear archivo `script.js`
  - Mover todo el código JavaScript al archivo externo
  - Actualizar `index.html` para referenciar el JS externo
  - Verificar que todas las funcionalidades funcionen
- **Archivos afectados**: `index.html`, `script.js` (nuevo)

#### 1.3 Organizar estructura de carpetas
- **Tareas**:
  - Crear carpeta `css/` para estilos
  - Crear carpeta `js/` para scripts
  - Crear carpeta `assets/` para recursos futuros
  - Actualizar rutas en `index.html`

---

### **FASE 2: Funcionalidad de Importación CSV**
**Prioridad: Alta** | **Tiempo estimado: 3-4 horas**

#### 2.1 Diseñar interfaz de importación
- **Tareas**:
  - Agregar botón "Importar CSV" en la sección de eventos
  - Crear modal o sección para cargar archivo
  - Agregar input de tipo file con aceptación de .csv
  - Diseñar UI para mostrar progreso de importación
- **Archivos afectados**: `index.html`, `styles.css`

#### 2.2 Implementar parser de CSV
- **Tareas**:
  - Crear función `parseCSVFile(file)` para leer archivo CSV
  - Implementar validación de formato CSV
  - Manejar diferentes codificaciones (UTF-8, Latin1)
  - Manejar errores de lectura de archivo
- **Archivos afectados**: `script.js`

#### 2.3 Validar datos del CSV
- **Tareas**:
  - Validar estructura de columnas esperadas:
    - ID, Fecha, Tipo, Ruta, Título, Descripción, Creado
  - Validar formato de fechas
  - Validar tipos de evento permitidos
  - Validar campos requeridos
  - Mostrar errores específicos por fila si hay problemas
- **Archivos afectados**: `script.js`

#### 2.4 Procesar e importar eventos
- **Tareas**:
  - Crear función `importEventsFromCSV(csvData)`
  - Manejar duplicados (comparar por ID o fecha+título)
  - Opción para usuario: reemplazar o agregar eventos
  - Mostrar resumen de importación (cuántos eventos se importaron)
  - Actualizar lista de eventos y estadísticas
- **Archivos afectados**: `script.js`

#### 2.5 Manejar conflictos y duplicados
- **Tareas**:
  - Detectar eventos duplicados
  - Mostrar diálogo para decidir: reemplazar, mantener ambos, o cancelar
  - Implementar merge inteligente si es necesario
- **Archivos afectados**: `script.js`

#### 2.6 Mejorar exportación CSV
- **Tareas**:
  - Asegurar que el formato de exportación sea compatible con importación
  - Agregar BOM UTF-8 para mejor compatibilidad con Excel
  - Mejorar manejo de caracteres especiales
- **Archivos afectados**: `script.js`

---

### **FASE 3: Validación y Gestión de Almacenamiento**
**Prioridad: Media** | **Tiempo estimado: 2 horas**

#### 3.1 Validar límite de localStorage
- **Tareas**:
  - Crear función `checkStorageLimit()`
  - Detectar cuando se acerca al límite (5MB típico)
  - Mostrar advertencias al usuario
  - Implementar limpieza automática de borradores antiguos si es necesario
- **Archivos afectados**: `script.js`

#### 3.2 Implementar sistema de backup periódico
- **Tareas**:
  - Crear función `createBackup()`
  - Guardar backup automático cada X eventos guardados
  - Guardar backup antes de operaciones críticas (eliminar todos)
  - Permitir descargar backup manualmente
  - Mostrar fecha del último backup
- **Archivos afectados**: `script.js`

#### 3.3 Gestión de almacenamiento
- **Tareas**:
  - Mostrar estadísticas de uso de almacenamiento
  - Opción para limpiar borradores antiguos
  - Opción para exportar y limpiar todos los datos
- **Archivos afectados**: `script.js`, `index.html`

---

### **FASE 4: Funcionalidades de Búsqueda y Filtrado**
**Prioridad: Media** | **Tiempo estimado: 2-3 horas**

#### 4.1 Implementar búsqueda de texto
- **Tareas**:
  - Agregar campo de búsqueda en la interfaz
  - Crear función `searchEvents(query)`
  - Buscar en título, descripción y ruta
  - Búsqueda en tiempo real mientras se escribe
  - Resaltar términos encontrados
- **Archivos afectados**: `index.html`, `script.js`, `styles.css`

#### 4.2 Mejorar sistema de filtros
- **Tareas**:
  - Combinar filtros de fecha y tipo con búsqueda de texto
  - Agregar filtro por rango de fechas
  - Agregar filtro por ruta
  - Botón para limpiar todos los filtros
  - Guardar preferencias de filtro en localStorage
- **Archivos afectados**: `script.js`, `index.html`

---

### **FASE 5: Optimización de Rendimiento**
**Prioridad: Media** | **Tiempo estimado: 2-3 horas**

#### 5.1 Implementar paginación
- **Tareas**:
  - Crear función `paginateEvents(page, itemsPerPage)`
  - Agregar controles de paginación (anterior, siguiente, números)
  - Permitir configurar cantidad de eventos por página
  - Mantener filtros y búsqueda al cambiar de página
- **Archivos afectados**: `script.js`, `index.html`, `styles.css`

#### 5.2 Optimizar renderizado
- **Tareas**:
  - Implementar virtualización si hay muchos eventos
  - Usar `requestAnimationFrame` para animaciones suaves
  - Lazy loading de eventos si es necesario
  - Optimizar re-renderizado innecesario
- **Archivos afectados**: `script.js`

#### 5.3 Mejorar rendimiento de localStorage
- **Tareas**:
  - Implementar compresión de datos si es necesario
  - Optimizar frecuencia de escritura
  - Usar IndexedDB para grandes volúmenes de datos (opcional)
- **Archivos afectados**: `script.js`

---

### **FASE 6: Mejoras de UX/UI**
**Prioridad: Baja** | **Tiempo estimado: 2 horas**

#### 6.1 Mejorar feedback visual
- **Tareas**:
  - Mejorar animaciones de carga
  - Agregar skeleton loaders
  - Mejorar mensajes de error y éxito
  - Agregar tooltips informativos
- **Archivos afectados**: `styles.css`, `script.js`

#### 6.2 Mejorar accesibilidad
- **Tareas**:
  - Agregar atributos ARIA donde sea necesario
  - Mejorar navegación por teclado
  - Mejorar contraste de colores
  - Agregar labels descriptivos
- **Archivos afectados**: `index.html`, `styles.css`

#### 6.3 Agregar modo oscuro (opcional)
- **Tareas**:
  - Crear tema oscuro
  - Agregar toggle para cambiar tema
  - Guardar preferencia en localStorage
- **Archivos afectados**: `styles.css`, `script.js`

---

## 📊 Priorización

### **Alta Prioridad (Hacer primero)**
1. ✅ Separar CSS y JavaScript en archivos externos
2. ✅ Implementar importación de CSV
3. ✅ Validar límite de almacenamiento

### **Media Prioridad (Hacer después)**
4. Sistema de backup periódico
5. Búsqueda de texto
6. Paginación de eventos

### **Baja Prioridad (Mejoras futuras)**
7. Optimizaciones avanzadas de rendimiento
8. Mejoras de UX/UI
9. Modo oscuro

---

## 🔧 Especificaciones Técnicas

### **Formato CSV para Importación**

El CSV debe tener la siguiente estructura:
```csv
ID,Fecha,Tipo,Ruta,Título,Descripción,Creado
1234567890,2024-01-15,delivery,Ruta Centro,"Entrega exitosa","Descripción del evento",2024-01-15T10:30:00.000Z
```

**Columnas requeridas:**
- `ID`: Identificador único (número)
- `Fecha`: Fecha en formato YYYY-MM-DD
- `Tipo`: Uno de: `delivery`, `incident`, `observation`, `other`
- `Ruta`: Texto (opcional)
- `Título`: Texto (requerido)
- `Descripción`: Texto (requerido)
- `Creado`: Fecha ISO (opcional, se genera si falta)

### **Validaciones de Importación**

1. **Validar estructura**: Verificar que existan las columnas requeridas
2. **Validar tipos**: Verificar que los tipos de evento sean válidos
3. **Validar fechas**: Verificar formato de fecha correcto
4. **Validar campos requeridos**: Título y descripción no pueden estar vacíos
5. **Manejar duplicados**: Comparar por ID o combinación fecha+título

### **Manejo de Errores**

- Mostrar mensajes claros y específicos
- Indicar número de fila con error
- Permitir continuar importación aunque haya errores parciales
- Generar reporte de errores al finalizar

---

## 📝 Checklist de Implementación

### Fase 1: Refactorización
- [ ] Crear estructura de carpetas
- [ ] Separar CSS a `css/styles.css`
- [ ] Separar JavaScript a `js/script.js`
- [ ] Actualizar referencias en HTML
- [ ] Probar que todo funcione correctamente

### Fase 2: Importación CSV
- [ ] Diseñar UI de importación
- [ ] Implementar lectura de archivo CSV
- [ ] Crear parser de CSV
- [ ] Validar estructura y datos
- [ ] Implementar importación de eventos
- [ ] Manejar duplicados y conflictos
- [ ] Probar con diferentes archivos CSV
- [ ] Mejorar exportación para compatibilidad

### Fase 3: Almacenamiento
- [ ] Implementar validación de límite
- [ ] Crear sistema de backup
- [ ] Agregar gestión de almacenamiento
- [ ] Probar con grandes volúmenes de datos

### Fase 4: Búsqueda y Filtros
- [ ] Implementar búsqueda de texto
- [ ] Mejorar sistema de filtros
- [ ] Agregar filtros avanzados
- [ ] Probar combinación de filtros

### Fase 5: Rendimiento
- [ ] Implementar paginación
- [ ] Optimizar renderizado
- [ ] Mejorar rendimiento de localStorage
- [ ] Probar con muchos eventos

### Fase 6: UX/UI
- [ ] Mejorar feedback visual
- [ ] Mejorar accesibilidad
- [ ] Agregar modo oscuro (opcional)

---

## 🧪 Testing

### Casos de Prueba para Importación CSV

1. **CSV válido con todos los campos**
2. **CSV con campos opcionales faltantes**
3. **CSV con formato incorrecto**
4. **CSV con fechas inválidas**
5. **CSV con tipos de evento inválidos**
6. **CSV con eventos duplicados**
7. **CSV muy grande (más de 1000 eventos)**
8. **CSV con caracteres especiales**
9. **CSV con diferentes codificaciones**

---

## 📈 Métricas de Éxito

- ✅ Código organizado en archivos separados
- ✅ Importación CSV funcional al 100%
- ✅ Validación robusta de datos importados
- ✅ Manejo adecuado de errores
- ✅ Rendimiento aceptable con 1000+ eventos
- ✅ Interfaz intuitiva y fácil de usar

---

## 🚀 Próximos Pasos

1. Comenzar con Fase 1 (Refactorización)
2. Implementar Fase 2 (Importación CSV) - **Prioridad del usuario**
3. Continuar con las siguientes fases según prioridad

---

**Última actualización**: 2024
**Versión del plan**: 1.0

