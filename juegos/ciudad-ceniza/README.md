# Ciudad Ceniza

Juego de navegador (HTML5 Canvas + JavaScript, sin dependencias) en el que dos héroes originales patrullan juntos la misma ciudad:

- **Hilo**: telaraña de péndulo, se agarra a las paredes y trepa.
- **Vigía**: gancho a las cornisas, planeo con capa y picado.
- **Relevo en el aire** (`Q` o botón RELEVO): cambias de héroe sin perder la inercia y con un impulso extra. El compañero te sigue y tumba a los matones que tenga cerca.

Para jugar, abre `index.html` en cualquier navegador. En el móvil aparecen mandos táctiles.

Controles: `A`/`D` moverse · `Espacio` saltar/planear · `J` o clic telaraña/gancho · `W`/`S` recoger cuerda o trepar · `K` golpe · `Q` relevo · `P` pausa · `M` sonido.

## Gráficos y animación

- **Edificios**: cuatro estilos (ladrillo, piedra, art déco y muro cortina de cristal) pintados por procedimiento con textura del material, ventanas de guillotina con interiores (cortinas, persianas, siluetas), escaleras de incendios, cornisas, tiendas con toldos y neones, y azoteas con depósitos de agua, antenas con baliza y casetas. Cada fachada se pinta una vez y se guarda en caché.
- **Figuras**: esqueleto de 10 articulaciones con miembros con volumen, luz de luna y sombra en el suelo. Animación procedural: marcha y carrera según la zancada, respiración en reposo, flexión al aterrizar, balanceo colgado de la mano, trepar alternando manos y pies, planeo, voltereta y puñetazo con carga.
- **Capa** de Vigía con física de tela (Verlet) que ondea con la velocidad.
- **Matones** que patrullan, se paran a mirar, se ponen en guardia al verte y caen con física al recibir un golpe.

## Sonido

Todo sintetizado con Web Audio, sin archivos: lluvia, tráfico lejano, relámpagos con trueno retrasado, viento según la velocidad, telaraña, gancho, pasos, aterrizajes, golpes y caídas con paneo estéreo, y música en re menor cuya intensidad sube cuando hay matones cerca. Se silencia con `M` o con el botón SONIDO.
