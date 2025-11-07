# ⚡ Configuración Rápida - ELIMFILTERS WordPress Integration

## 📋 Resumen de Estado
✅ **API Node.js**: Configurada con CORS para `elimfilters.com`  
✅ **Plugin WordPress**: Listo con URL correcta  
✅ **Archivos**: Todos creados y completos  

## 🚀 Pasos de Instalación

### 1️⃣ **Subir Plugin a WordPress**
```bash
# Conectar por FTP/SFTP
# Subir carpeta 'wordpress-integration' a:
/wp-content/plugins/elimfilters-search/
```

### 2️⃣ **Activar Plugin**
- Entrar a WordPress Admin
- Ir a **Plugins** → **Plugins Instalados**
- Buscar **"ELIMFILTERS Part Search Integration"**
- Click en **"Activar"**

### 3️⃣ **Agregar Buscador al Header**

#### Opción A: Directo en header.php
```php
<?php echo do_shortcode('[elimfilters_search_form]'); ?>
```

#### Opción B: En functions.php (Recomendado)
```php
// Agregar buscador al header
add_action('wp_head', 'elimfilters_header_search');
function elimfilters_header_search() {
    if (is_front_page()) {
        echo '<div class="header-search-container">';
        echo do_shortcode('[elimfilters_search_form placeholder="Busca por OEM o Cross Reference..."]');
        echo '</div>';
    }
}
```

### 4️⃣ **Verificar Funcionamiento**
- Visitar: `https://elimfilters.com/wp-admin/admin-ajax.php`
- Debe mostrar `0` (normal)
- Visitar: `https://elimfilters.com/part-search`
- Probar búsqueda con: `P551039`

## 🔧 Personalización Rápida

### Cambiar Textos del Formulario
```php
[elimfilters_search_form 
    placeholder="Tu código OEM..."
    button_text="Buscar Equivalente"
]
```

### Agregar a Menú de Navegación
```php
// En functions.php
add_filter('wp_nav_menu_items', 'elimfilters_menu_search', 10, 2);
function elimfilters_menu_search($items, $args) {
    if ($args->theme_location == 'primary') {
        $search_item = '<li class="menu-item elimfilters-menu-search">';
        $search_item .= do_shortcode('[elimfilters_search_form]');
        $search_item .= '</li>';
        $items = $items . $search_item;
    }
    return $items;
}
```

## ⚠️ Solución de Problemas

### Error: "No se puede conectar con el servicio"
1. Verificar que la API esté corriendo en puerto 8080
2. Verificar firewall del servidor
3. Probar: `curl -X POST http://localhost:8080/api/detect-filter -H "Content-Type: application/json" -d '{"query":"P551039"}'`

### Error: "CORS bloqueado"
1. Verificar que `server.js` tenga el dominio correcto
2. Reiniciar el servicio Node.js

### Error: "Página no encontrada"
1. Ir a **Ajustes** → **Enlaces permanentes**
2. Click en **"Guardar cambios"** (sin cambiar nada)

## 📞 Soporte

Si tienes problemas:
1. Ejecutar: `verificar-configuracion.php`
2. Revisar logs en: `/wp-content/debug.log`
3. Verificar consola del navegador (F12)

**¡Listo! Tu integración debería estar funcionando.** 🎉