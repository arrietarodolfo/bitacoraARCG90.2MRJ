# Bitácora de Entregas ARCG90 2MRJ

Sistema web de gestión de eventos de entregas con autoguardado automático, importación/exportación CSV, búsqueda avanzada y paginación.

## 🚀 Características

### ✨ Funcionalidades Principales

- **📝 Registro de Eventos**: Formulario intuitivo para registrar eventos de entregas
- **💾 Autoguardado Automático**: Los cambios se guardan automáticamente mientras escribes
- **📊 Estadísticas en Tiempo Real**: Contador de eventos, entregas e incidencias
- **🔍 Búsqueda Avanzada**: Busca eventos por título, descripción o ruta
- **📄 Paginación**: Navegación eficiente con controles de paginación
- **📥 Importación CSV**: Importa eventos desde archivos CSV
- **📤 Exportación CSV**: Exporta todos los eventos a formato CSV
- **🎨 Diseño Responsive**: Funciona perfectamente en móviles y tablets

### 🛠️ Tecnologías Utilizadas

- HTML5
- CSS3 (Variables CSS, Grid, Flexbox)
- JavaScript Vanilla (ES6+)
- LocalStorage para persistencia de datos
- Font Awesome para iconos

## 📁 Estructura del Proyecto

```
bitacoraARCG90.2MRJ/
│
├── index.html          # Página principal
├── css/
│   └── styles.css      # Estilos de la aplicación
├── js/
│   └── script.js       # Lógica de la aplicación
├── assets/             # Recursos adicionales
├── PLAN_DE_TRABAJO.md  # Plan de desarrollo del proyecto
└── README.md           # Este archivo
```

## 🎯 Uso

### Inicio Rápido

1. Abre `index.html` en tu navegador
2. Comienza a registrar eventos usando el formulario
3. Los datos se guardan automáticamente en tu navegador

### Registro de Eventos

1. **Título del Evento**: Escribe un título descriptivo
2. **Fecha**: Selecciona la fecha del evento
3. **Tipo**: Elige entre Entrega exitosa, Incidente, Observación u Otro
4. **Ruta** (opcional): Especifica la ruta si aplica
5. **Descripción**: Describe con detalle lo ocurrido
6. Haz clic en "Guardar Evento Final"

### Búsqueda y Filtros

- **Búsqueda de texto**: Escribe en el campo "Buscar Eventos" para filtrar por contenido
- **Filtro por fecha**: Selecciona una fecha específica
- **Filtro por tipo**: Filtra por tipo de evento
- **Limpiar filtros**: Usa el botón para resetear todos los filtros

### Importación CSV

1. Haz clic en "Seleccionar archivo CSV"
2. Elige un archivo CSV con el formato correcto:
   ```csv
   ID,Fecha,Tipo,Ruta,Título,Descripción,Creado
   1234567890,2024-01-15,delivery,Ruta Centro,"Entrega exitosa","Descripción",2024-01-15T10:30:00.000Z
   ```
3. El sistema validará y procesará los eventos
4. Si hay duplicados, podrás elegir cómo manejarlos

### Exportación CSV

- Los eventos se exportan automáticamente al guardar
- También puedes exportar manualmente con el botón "Exportar CSV Ahora"
- Los archivos se descargan con formato: `bitacora_entregas_YYYY-MM-DD_HH-MM-SS.csv`

## 📋 Formato CSV

### Columnas Requeridas

- `ID`: Identificador único (número)
- `Fecha`: Fecha en formato YYYY-MM-DD
- `Tipo`: Uno de: `delivery`, `incident`, `observation`, `other`
- `Ruta`: Texto (opcional)
- `Título`: Texto (requerido)
- `Descripción`: Texto (requerido)
- `Creado`: Fecha ISO (opcional, se genera si falta)

## 🔧 Características Técnicas

### Autoguardado

- Guarda automáticamente cada 500ms después de dejar de escribir
- Guarda inmediatamente al cambiar de campo
- Guarda al cerrar la página
- Recupera borradores al recargar

### Almacenamiento

- Usa LocalStorage del navegador
- Validación de límite de almacenamiento (5MB)
- Advertencias cuando se acerca al límite

### Paginación

- Configurable: 10, 20, 50, 100 eventos por página o todos
- Navegación con botones anterior/siguiente
- Números de página con elipsis para muchas páginas
- Mantiene filtros y búsqueda al cambiar de página

## 🌐 Compatibilidad

- ✅ Chrome/Edge (recomendado)
- ✅ Firefox
- ✅ Safari
- ✅ Opera

## 📝 Notas

- Los datos se almacenan localmente en tu navegador
- Para respaldar datos, exporta regularmente a CSV
- El autoguardado funciona incluso si cierras el navegador
- Los borradores se recuperan automáticamente al volver

## 🚧 Próximas Mejoras

Ver `PLAN_DE_TRABAJO.md` para el plan completo de desarrollo.

## 📄 Licencia

Este proyecto es de uso privado.

## 👤 Autor

ARCG90 2MRJ

---

**Versión**: 1.0  
**Última actualización**: 2024

