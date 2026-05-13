# SkinDesk · Lineamientos de copy en español

Guía para todo el equipo (devs, diseño, marketing) al redactar strings
visibles para el usuario. Cubre tono, terminología, conjugación verbal y
ejemplos do/don't.

> **TL;DR** Hablamos español neutro LATAM con sesgo MX, tuteo (`tú`), tono
> cálido y profesional. Sin voseo argentino, sin Spain Spanish, sin
> diminutivos cariñosos, sin anglicismos cuando hay un equivalente
> castellano claro.

---

## 1. Reglas de oro

1. **Tuteo, siempre.** `tú agregas / tú puedes / tú tienes`. Nunca
   `vos agregás / vos podés / vos tenés`.
2. **Aquí, no acá.** "Acá" es Argentina/Uruguay; el público mexicano lo
   percibe como extranjero.
3. **Términos castellanos antes que anglicismos** cuando exista
   equivalente claro: `enlace`, `etiqueta`, `sugerencia`, `clic`,
   `presionar`. Excepciones permitidas para terminología técnica con uso
   establecido en cosmética profesional (`skincare`, `oil-free`,
   `CC cream`, `peeling`, `SPF`).
4. **Genéricos en navegación, género contextual en copy descriptivo.**
   `Clientes` en el menú; `tu clienta` cuando hablamos a la cosmetóloga
   sobre una persona específica.
5. **Sin diminutivos cariñosos** (`linksito`, `productitos`,
   `clientita`). Sí calidez sobria: `Tu catálogo`, `Tu referencia
   clínica curada`.
6. **Concisión sobre exhaustividad** en CTAs. `Nueva rutina` mejor que
   `Crear nueva rutina`.
7. **Empty states accionables**, no descriptivos. Decir qué hacer, no
   solo qué falta.

---

## 2. Tono de marca

SkinDesk es una plataforma **clínica premium para cosmetólogos**.
El copy debe sentirse:

- **Cálido**, sin ser informal
- **Directo**, sin ser brusco
- **Profesional**, sin ser corporativo
- **Educado**, sin ser servicial-en-exceso

### Ejemplos de tono

| ✅ Correcto | ❌ Evitar |
|---|---|
| Aquí tienes un resumen del negocio hoy. | ¡Hola hola! Te dejamos lo mejor del día 🎉 |
| Tu referencia clínica curada. | Material educativo aprobado por nuestro equipo médico interno. |
| No tienes permisos para crear productos. | Acceso denegado. ERROR_403_PERMISSION. |
| Esta entrada aún no es visible para los profesionales. | ¡Ups! Tu contenido todavía está en draft mode. |
| Agrega un producto a tu catálogo. | ¡Vamos! Sumá productitos copados a tu catálogo. |

### Saludos

- **Dashboard banner:** `¡Hola, {firstName}!` — neutro de género, cálido,
  reutilizable en cada login.
- **Onboarding / primer login:** `¡Bienvenida, {firstName}!` cuando el
  usuario se registra (sabemos que es una cosmetóloga). Si el género no
  está confirmado, usar `¡Hola, {firstName}!`.
- **Emails transaccionales:** abrir con `Hola {firstName},` (con coma,
  saludo neutro y profesional).

---

## 3. Conjugación verbal (tuteo MX)

Usamos siempre **tuteo**. Reglas básicas:

| Persona | Imperativo | Presente |
|---|---|---|
| Verbos en -ar (agregar) | `Agrega` | `agregas` |
| Verbos en -er (comer) | `Come` | `comes` |
| Verbos en -ir (subir) | `Sube` | `subes` |

### Voseo argentino — PROHIBIDO

Reemplazos directos:

| ❌ Voseo (AR) | ✅ Tuteo (MX-LATAM) |
|---|---|
| Probá / probá | Prueba / prueba |
| Sumá / sumá | Agrega / agrega |
| Cargá / cargá | Carga / carga |
| Editá / Editalo | Edita / Edítalo |
| Configurá / Configurala | Configura / Configúrala |
| Cambiá / Cambialo | Cambia / Cámbialo |
| Activá / activá | Activa / activa |
| Limpiá / limpiá | Limpia / limpia |
| Empezá / empezá | Empieza / empieza |
| Hacé / hacé | Haz / haz |
| Tocá / Arrastrá | Toca / Arrastra |
| Pegá / Soltá | Pega / Suelta |
| Avisanos / Escribinos | Avísanos / Escríbenos |
| Escribile / Decime | Escríbele / Dime |
| Volvé / Mantené | Vuelve / Mantén |
| Mirá / Pensá | Mira / Piensa |
| Vení / Pedí | Ven / Pide |
| Creá / Usá | Crea / Usa |
| podés / Podés | puedes / Puedes |
| tenés / Tenés | tienes / Tienes |
| querés / Querés | quieres / Quieres |
| subís / Subís | subes / Subes |
| pensás / decís | piensas / dices |
| necesitás | necesitas |

### "Acá" — PROHIBIDO

Siempre `Aquí`. Sin excepciones.

---

## 4. Glosario maestro

### Roles y personas

| Concepto | Término oficial | Notas |
|---|---|---|
| Profesional de la piel | **profesional** (genérico) · **cosmetólogo/a** (específico) | Evitar "esteticista" salvo en contexto específico |
| Usuario final del profesional | **cliente / clientes** (nav y listas genéricas) · **clienta / clientas** (copy contextual a la cosmetóloga) | Nunca "paciente" salvo contexto médico real |
| Equipo de soporte interno | **administrador** o **super administrador** | Evitar "admin" en UI; OK en código |

### Acciones (verbos)

| Acción | Término oficial | Evitar |
|---|---|---|
| Anexar a colección | **Agregar** | Sumá, Añadir (inconsistente) |
| Crear entidad nueva | **Crear** / **Nueva X** | "Crear nueva X" (redundante) |
| Editar existente | **Editar** | Modificar |
| Persistir cambios | **Guardar** / **Guardar cambios** | OK |
| Borrar definitivo | **Eliminar** | Borrar (informal) |
| Soft-delete | **Archivar** | OK |
| Cambiar a publicado | **Publicar** | OK |
| Confirmar selección | **Aceptar** o **Confirmar** | OK |
| Cerrar sin guardar | **Cancelar** | OK |
| Compartir vía enlace | **Compartir** (primary) · **Generar enlace** (submenu) | OK |
| Acción del cursor | **Hacer clic** o **Presionar** | Pulsar (Spain) |

### Sustantivos UI

| Concepto | Término oficial | Evitar |
|---|---|---|
| Configuración global | **Configuración** | Ajustes (Spain) |
| Panel de administración | **Administración** | CMS, Admin panel |
| Listado de productos | **Productos** (en nav) | "Catálogo" como nav label |
| Perfil de persona | **Perfil** | Ficha |
| Identificador URL | **URL** o **dirección** | Slug (jerga tech) |
| Hipervínculo | **Enlace** | Link |
| Sugerencia/consejo inline | **Sugerencia:** o **Consejo:** | Tip: |
| Click del mouse/touch | **clic** | click (mantener un solo término) |
| Etiquetas de contenido | **Etiquetas** o **tags** (mantener uno consistente por surface) | Mezclar ambos |

### Pagos / financieras

| Concepto | Término oficial |
|---|---|
| Pago no completado | **Saldo pendiente** |
| Pago a cuenta | **Pago parcial** |
| Pago completo | **Pago registrado** |
| Suma de pagos hechos | **Total pagado** |
| Lo que falta pagar | **Saldo restante** |
| Vía de pago | **Método de pago** |
| Recurrencia | **Plan mensual / anual** |
| Estado del paquete | **Estado del plan** |

### Clínico

Toda esta terminología es estándar profesional y no debe traducirse:

- **Biotipo cutáneo** (no "tipo de piel" en interfaz clínica)
- **Estado cutáneo** (descripción del estado momentáneo)
- **Fototipo** (escala de respuesta solar)
- **Escala de Fitzpatrick** (no traducir)
- **Escala de Glogau** (no traducir)
- **Principios activos** (no "ingredientes activos")
- **Compatibilidad de activos** (no "interacciones")
- **Pirámide del skincare** (mantener "skincare", está establecido)
- **Antiedad** (sin guión, RAE moderna)
- **Despigmentante**, **Hidratante**, **Regenerante**, **Exfoliante**
- **Post-tratamiento** (con guión)
- **Queratolítico** (técnico pero correcto)
- **Ampolleta** (MX) — en otros LATAM "ampolla"

---

## 5. Estructura de mensajes

### Toasts

| Tipo | Longitud | Ejemplo |
|---|---|---|
| Éxito | 2-4 palabras | `Cambios guardados.` `Producto duplicado.` |
| Error | Qué pasó + cómo resolver | `No se pudo guardar. Intenta de nuevo en unos segundos.` |
| Info | Acción concreta | `Enlace copiado al portapapeles.` |

**Reglas:**

- Punto final solo si la frase tiene más de 3 palabras.
- Nunca mencionar códigos de error técnicos al usuario.
- Auto-dismiss 3–5 segundos.

### Helper text bajo input

- Máximo **90 caracteres**.
- Tono neutro: explica formato o restricción, no la obviedad.
- Ejemplo bueno: `Hasta 20 etiquetas. Te sugerimos las del Atlas para evitar duplicados.`
- Ejemplo malo: `Aquí debes escribir el nombre del producto que quieres agregar al catálogo.`

### Empty states

```
Título corto (3-5 palabras)
Una oración accionable.
[CTA opcional]
```

Ejemplo:

```
Sin entradas todavía
Crea la primera para empezar.
[Nueva entrada]
```

### Confirmación destructiva

```
{Acción} "{Nombre del objeto}" definitivamente.
{Consecuencia en 1 línea}.
[Cancelar] [Eliminar]
```

Ejemplo:

```
Eliminar "Niacinamida 5%" definitivamente.
Esta acción no se puede deshacer.
[Cancelar] [Eliminar]
```

---

## 6. Email transaccional

Estructura uniforme:

1. **Saludo:** `Hola {firstName},`
2. **Contexto:** una oración explicando por qué llega el correo.
3. **CTA principal:** un solo botón, etiqueta accionable.
4. **Información complementaria:** opcional, en texto chico.
5. **Cierre:** `¿Necesitas ayuda? Escríbenos a {SUPPORT_EMAIL}.`
6. **Firma:** `El equipo de SkinDesk.` (no "saludos cordiales", no "atentamente")

**Reglas adicionales:**

- Asunto: 4–7 palabras, claro, sin emojis.
- Preheader: complementa el asunto, no lo repite.
- Un solo CTA primario por email.
- "Enlace" (no "link"), "Sugerencia" (no "Tip"), "clic" (no "click").

---

## 7. Quick reference — antes / después

### Empty states

| ❌ Antes | ✅ Después |
|---|---|
| Sin resultados. Probá con otros filtros. | Sin resultados. Ajusta los filtros o borra la búsqueda. |
| Sumá productos al catálogo para empezar. | Agrega productos al catálogo para empezar. |
| Cuando registres pagos, los vas a ver acá. | Cuando registres pagos, los verás aquí. |

### CTAs

| ❌ Antes | ✅ Después |
|---|---|
| Crear nueva rutina | Nueva rutina |
| Sumá un producto | Agregar producto |
| Editar en CMS | Editar en administración |

### Errores

| ❌ Antes | ✅ Después |
|---|---|
| No autenticado. | Inicia sesión para continuar. |
| Sin permisos para crear productos. | No tienes permisos para crear productos. |
| Revisá los campos del formulario. | Revisa los campos del formulario. |
| Ese slug ya existe. | Esa URL ya existe. |

### Greetings

| ❌ Antes | ✅ Después |
|---|---|
| ¡Bienvenida(o), Carla! | ¡Hola, Carla! |
| Acá tenés un resumen | Aquí tienes un resumen |

---

## 8. Linter mental para code review

Cuando revises un PR con strings nuevos, pregúntate:

1. ¿Hay alguna palabra con tilde "fuera de lugar" como `probá`, `tenés`,
   `Acá`? → **rechazar**.
2. ¿La cadena dice "link", "tip", "click", "pulsar", "ficha de persona",
   "CMS" en UI? → **rechazar**.
3. ¿Un error técnico está expuesto al usuario? → **rechazar**.
4. ¿Un CTA dice "Crear nueva X"? → **simplificar a "Nueva X"**.
5. ¿El tono es coloquial-exceso o corporativo-frío? → **ajustar**.

---

## 9. Cuando agregues una feature nueva

Antes de mergear, corre este checklist mental sobre tus strings:

- [ ] Cero voseo (`probá`, `tenés`, etc.)
- [ ] Cero "acá"
- [ ] Cero anglicismos innecesarios (`link`, `tip`, `click`)
- [ ] Errores humanos ("No tienes permisos" > "Sin permisos")
- [ ] Empty states accionables
- [ ] CTAs concisos sin redundancia ("Nueva X" > "Crear nueva X")
- [ ] Saludo neutro (`Hola`) por defecto
- [ ] Helper text ≤ 90 caracteres

Si dudas en un término, consulta el glosario (§4) o pregunta al equipo
de marca antes de inventar.
