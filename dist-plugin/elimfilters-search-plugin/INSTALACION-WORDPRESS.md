# Integración WordPress - ELIMFILTERS API

## 📋 Descripción

Esta integración permite conectar tu página WordPress con la API de ELIMFILTERS para búsqueda de filtros por código OEM o Cross Reference.

## 📁 Archivos Incluidos

```
wordpress-integration/
├── elimfilters-search-plugin.php    # Plugin principal
├── assets/
│   ├── search.js                    # JavaScript para búsqueda
│   └── search.css                   # Estilos CSS
└── INSTALACION-WORDPRESS.md         # Este archivo
```

## 🚀 Instalación

### Paso 1: Subir el Plugin

1. **Opción A - Instalación directa:**
   - Copia el archivo `elimfilters-search-plugin.php` a la carpeta `/wp-content/plugins/` de tu WordPress
   - Copia la carpeta `assets/` a `/wp-content/plugins/`

2. **Opción B - Crear ZIP:**
   - Comprime todos los archivos en un archivo ZIP
   - Ve a WordPress Admin → Plugins → Agregar Nuevo → Subir Plugin
   - Sube el archivo ZIP

### Paso 2: Activar el Plugin

1. Ve a WordPress Admin → Plugins
2. Busca "ELIMFILTERS Part Search Integration"
3. Haz clic en "Activar"

### Paso 3: Configurar la URL de la API

**IMPORTANTE:** Edita la línea 15 del archivo `elimfilters-search-plugin.php`:

```php
define('ELIMFILTERS_API_URL', 'https://TU-DOMINIO.com/api/detect-filter');
```

Reemplaza `TU-DOMINIO.com` con el dominio donde está alojada tu API.

## 📝 Uso

### Agregar el Formulario de Búsqueda

#### Opción 1: Shortcode en el Header

Agrega este código en tu archivo `header.php` donde quieras que aparezca el buscador:

```php
<?php echo do_shortcode('[elimfilters_search_form]'); ?>
```

#### Opción 2: Widget

1. Ve a Apariencia → Widgets
2. Arrastra un widget de "Texto" a la ubicación deseada
3. Agrega el shortcode: `[elimfilters_search_form]`

#### Opción 3: Menú de Navegación

Para agregarlo al menú principal, puedes usar este código en tu `functions.php`:

```php
add_filter('wp_nav_menu_items', 'add_search_to_menu', 10, 2);
function add_search_to_menu($items, $args) {
    if ($args->theme_location == 'primary') { // Ajusta según tu tema
        $search_form = do_shortcode('[elimfilters_search_form]');
        $items .= '<li class="menu-item search-item">' . $search_form . '</li>';
    }
    return $items;
}
```

### Página de Resultados

El plugin automáticamente creará una página llamada "Part Search Results" con el slug `/part-search/`.

Para acceder a los resultados, el formulario redirigirá a:
```
/part-search/?part=CODIGO-BUSCADO
```

## ⚙️ Personalización

### Personalizar el Formulario

Puedes personalizar el formulario usando atributos:

```php
[elimfilters_search_form 
    placeholder="Busca tu filtro..."
    button_text="Buscar"
    show_loading="true"
]
```

**Atributos disponibles:**
- `placeholder`: Texto del placeholder (default: "Ingrese código OEM o Cross Reference...")
- `button_text`: Texto del botón (default: "Buscar")
- `show_loading`: Mostrar spinner de carga (default: "true")

### Personalizar Estilos

Los estilos están en `assets/search.css`. Puedes:

1. **Editar directamente:** Modifica el archivo CSS
2. **Sobrescribir:** Agrega tus propios estilos en el tema hijo

**Clases principales:**
- `.elimfilters-search-container` - Contenedor principal
- `.elimfilters-search-input` - Campo de entrada
- `.elimfilters-search-button` - Botón de búsqueda
- `.elimfilters-result-card` - Tarjeta de resultados
- `.elimfilters-no-results` - Mensaje sin resultados

## 🔧 Solución de Problemas

### La búsqueda no funciona

1. **Verifica la URL de la API:**
   - Abre el archivo `elimfilters-search-plugin.php`
   - Asegúrate que la URL esté correcta en la línea 15

2. **Verifica CORS:**
   - Tu API debe tener configurado CORS para permitir tu dominio WordPress
   - Verifica en `server.js` que tu dominio esté en `allowedOrigins`

3. **Verifica logs:**
   - En WordPress: activa `WP_DEBUG` en `wp-config.php`
   - En el navegador: abre la consola (F12)

### No se muestran resultados

1. **Verifica que la página de resultados exista:**
   - Ve a Páginas → Busca "Part Search Results"
   - Verifica que tenga el shortcode `[elimfilters_search_results]`

2. **Verifica permalinks:**
   - Ve a Ajustes → Enlaces permanentes
   - Guarda cambios para regenerar los enlaces

### Errores de JavaScript

1. **Verifica que jQuery esté cargado:**
   ```php
   wp_enqueue_script('jquery');
   ```

2. **Verifica conflictos:**
   - Desactiva otros plugins temporalmente
   - Cambia al tema por defecto de WordPress

## 📱 Responsive

El diseño es completamente responsive y se adapta a:
- Desktop (> 768px)
- Tablet (481px - 768px)
- Mobile (< 480px)

## 🎨 Personalización Avanzada

### Hooks (Filtros y Acciones)

**Filtros:**
```php
// Modificar datos antes de enviar a la API
add_filter('elimfilters_search_query', function($query) {
    return strtoupper($query);
});

// Modificar resultados antes de mostrarlos
add_filter('elimfilters_search_results', function($results) {
    // Tu código aquí
    return $results;
});
```

**Acciones:**
```php
// Antes de la búsqueda
add_action('elimfilters_before_search', function($query) {
    // Tu código aquí
});

// Después de la búsqueda
add_action('elimfilters_after_search', function($query, $results) {
    // Tu código aquí
}, 10, 2);
```

## 🔒 Seguridad

- Verificación de nonce para AJAX
- Sanitización de entradas
- Escapado de salidas
- Validación de datos

## 📞 Soporte

Para problemas o preguntas:
1. Verifica esta documentación
2. Revisa los logs de error
3. Contacta al desarrollador del plugin

## 🔄 Actualizaciones

Para actualizar:
1. Desactiva el plugin actual
2. Sustituye los archivos
3. Reactiva el plugin
4. Verifica la configuración