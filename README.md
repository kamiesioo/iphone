# Tienda de iPhone · Korion Systems

Plantilla de tienda para vender a cuentas de Instagram. Un contenedor = una tienda.

- **Sitio público:** inicio, catálogo, ofertas, nosotros, carrito y pedido.
- **Panel `/admin`:** productos (con foto y stock), pedidos, datos de la tienda, promo y respaldo.
- **Backend:** Node (sin dependencias) + SQLite en un solo archivo. Los pedidos se guardan, descuentan stock y se pueden enviar por WhatsApp.

## Probar en tu PC

```bash
npm start                      # http://localhost:3000   (datos en ./data)
ADMIN_PASSWORD=miclave npm start
```
Requiere Node 22.13 o superior. Si no definís `ADMIN_PASSWORD`, se genera una y se imprime en la consola.

## Desplegar en un VPS (AWS EC2) con Docker

```bash
git clone <este repo> tienda && cd tienda
cp .env.example .env && nano .env      # poné ADMIN_PASSWORD (y TIENDA si querés otro perfil)
docker compose up -d --build
```
- Abrí el puerto 80 en el Security Group de la instancia.
- Panel: `http://IP-DEL-VPS/admin`.
- Los datos viven en el volumen `tienda-data` (montado en `/data`): sobreviven a reinicios y a `docker compose up --build`.

### HTTPS (recomendado, el panel usa contraseña)
Poné un proxy delante. Con Caddy, `/etc/caddy/Caddyfile`:
```
tienda.midominio.com {
    reverse_proxy localhost:3000
}
```
y en `.env`: `PORT=127.0.0.1:3000`, `COOKIE_SECURE=1`, `TRUST_PROXY=1`.

### Respaldos
- Base de datos: panel → **Tienda → Descargar respaldo de la base**.
- Todo (base + fotos): 
  ```bash
  docker run --rm -v tienda_tienda-data:/data -v $PWD:/out alpine tar czf /out/respaldo.tgz -C /data .
  ```

## Vender a un cliente nuevo
1. Levantá un contenedor nuevo (otro directorio o `-p`/volumen distinto).
2. Entrá a `/admin` → **Tienda**: nombre, WhatsApp, Instagram, dirección, servicios, color y moneda.
3. **Productos**: borrá los de ejemplo, cargá los reales con foto.
4. Para empezar sin ejemplos: `SEED_PRODUCTOS=0` antes del primer arranque.

## Estructura
```
server/   index.js (HTTP + API) · db.js (SQLite) · logic.js (validación, pedidos, auth) · seed.js
public/   páginas, css/, js/ e img/ (el logo de la pantalla de carga es img/logo-ks.png)
```
